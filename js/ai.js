// Bot brains: perceive -> choose state (fight / heal / zone / loot / roam) -> steer, aim and shoot.
import { G } from './state.js';
import { WEAPONS } from './data.js';
import { lineOfSight, findPath, isSolid } from './world.js';
import { rand, angTo, angDiff, dist, clamp, choice } from './util.js';
import { giveItem, weaponScore } from './entities.js';

export const DIFF = {
  easy: { err: 0.24, react: 0.75, turn: 3.2, sight: 11, burst: 0.55 },
  normal: { err: 0.13, react: 0.42, turn: 6, sight: 13, burst: 0.75 },
  hard: { err: 0.065, react: 0.22, turn: 10, sight: 15, burst: 0.92 },
};
const PREF = { wrench: 0.8, pistol: 6, smg: 5, shotgun: 3, rifle: 9, sniper: 15 };

export function initBrain(b) { b.brain = { state: 'roam', tgt: null, goal: null, path: null, pi: 0, thinkT: rand(0, 0.5), react: 0, strafe: 1, strafeT: 0, errT: 0, err: 0, seen: false, lastSeen: null, stuckT: 0, lx: 0, ly: 0, lootTgt: null, pathT: 0 }; }

function hostileValid(b, t) { return t && !t.dead && t !== b && (t.kind !== 'human' || t.drop === 'ground') && (t.kind !== 'vehicle'); }
function needsLoot(b) {
  const inv = b.inv; const guns = inv.w.filter(Boolean);
  if (!guns.length) return 3; let s = 0;
  if (guns.length < 2) s += 1; if (!inv.vest || !inv.helmet) s += 1; if (inv.heals.bandage + inv.heals.medkit < 2) s += 0.6;
  for (const g of guns) if (inv.ammo[WEAPONS[g.id].ammo] < 15) s += 1;
  return s;
}
function setGoal(b, x, y) {
  const br = b.brain; br.goal = { x, y }; br.path = null; br.pi = 0;
  if (G.pathBudget > 0) { G.pathBudget--; br.path = findPath(G.world, b.x, b.y, x, y) || null; }
  else br.pathPending = true;
}
function think(b) {
  const br = b.brain, D = G.diff, st = G.storm;
  // perception
  let best = null, bd = 1e9;
  const sight = D.sight;
  const cand = (t, range) => { const d = Math.hypot(t.x - b.x, t.y - b.y); if (d < range && d < bd && lineOfSight(G.world, b.x, b.y, t.x, t.y)) { best = t; bd = d; } };
  const armed = b.inv.w.some((w) => w && (w.mag > 0 || b.inv.ammo[WEAPONS[w.id].ammo] > 0));
  const early = G.time < 80;
  for (const h of G.humans) { if (h === b || h.dead || h.drop !== 'ground') continue; const r = armed ? sight : (h === br.tgt ? 5 : 3); cand(h, Math.min(r, early && h !== br.tgt ? 6.5 : 99, (h.crouch ? sight * 0.65 : sight) * (h === br.tgt ? 1.3 : 1))); }
  for (const c of G.creatures) { if (c.dead) continue; const close = c.target === b ? 9 : 6; cand(c, close); }
  if (best) {
    if (br.tgt !== best) br.react = D.react * rand(0.8, 1.3);
    br.tgt = best; br.state = 'fight'; br.seen = true; br.lastSeen = { x: best.x, y: best.y };
    // swap to a weapon that suits range and has ammo
    const inv = b.inv, cw = b.curWeapon();
    let bestS = b.inv.slot, bestV = -1;
    for (const s of [0, 1]) { const w = inv.w[s]; if (!w) continue; const d = WEAPONS[w.id]; if (w.mag + inv.ammo[d.ammo] <= 0) continue; const v = weaponScore(w) - Math.abs(PREF[w.id] - bd) * 0.3; if (v > bestV) { bestV = v; bestS = s; } }
    if (bestV < 0) bestS = 2; if (bestS !== inv.slot && (!cw || cw.id === 'wrench' || cw.mag === 0 || Math.random() < 0.3)) b.switchSlot(bestS);
    return;
  }
  if (br.state === 'fight' && br.tgt && !br.tgt.dead && br.lastSeen && dist(b, br.lastSeen) > 1.5 && br.chaseT > 0) { br.seen = false; return; }
  br.tgt = null; br.seen = false;
  // heal
  const inv = b.inv;
  if (b.healT <= 0) {
    if (b.hp < 45 && inv.heals.medkit) { b.startHeal('medkit'); br.state = 'heal'; return; }
    if (b.hp < 70 && inv.heals.bandage) { b.startHeal('bandage'); br.state = 'heal'; return; }
    if (b.boost < 40 && inv.heals.soda && b.hp < 95) { b.startHeal('soda'); }
    const w = b.curWeapon(); if (w && w.id !== 'wrench' && w.mag < WEAPONS[w.id].mag * 0.5) b.startReload();
  }
  // storm
  if (st) {
    const outNext = Math.hypot(b.x - st.ncx, b.y - st.ncy) > st.nr * 0.92, outCur = Math.hypot(b.x - st.cx, b.y - st.cy) > st.r - 1;
    if (outCur || (outNext && (st.mode === 'shrink' || st.t < 25))) {
      if (br.state !== 'zone' || !br.goal || Math.hypot(br.goal.x - st.ncx, br.goal.y - st.ncy) > st.nr) { const a = rand(0, 6.28), r = rand(0, st.nr * 0.6); setGoal(b, st.ncx + Math.cos(a) * r, st.ncy + Math.sin(a) * r); }
      br.state = 'zone'; return;
    }
  }
  // loot
  const need = needsLoot(b);
  if (need > 0.5) {
    if (br.state === 'loot' && br.lootTgt && !br.lootTgt.gone && br.goal) return;
    let tgt = null, td = 22;
    for (const c of G.containers) { if (c.claimed && c.claimed !== b) continue; if (c.items.length === 0 || c.falling) continue; const d = Math.hypot(c.x - b.x, c.y - b.y) - (c.ck === 'airdrop' ? 8 : 0); if (d < td) { td = d; tgt = c; } }
    for (const p of G.pickups) { const d = Math.hypot(p.x - b.x, p.y - b.y) + 2; if (d < td) { td = d; tgt = p; } }
    if (tgt) { if (br.lootTgt && br.lootTgt.claimed === b) br.lootTgt.claimed = null; br.lootTgt = tgt; if (tgt.kind === 'container') tgt.claimed = b; br.state = 'loot'; setGoal(b, tgt.x, tgt.y); return; }
  }
  // roam
  if (br.state !== 'roam' || !br.goal || dist(b, br.goal) < 1.5) {
    br.state = 'roam'; let gx, gy, k = 0;
    do { const a = rand(0, 6.28), r = st ? rand(0, st.nr * 0.8) : rand(0, 30); gx = (st ? st.ncx : 36) + Math.cos(a) * r; gy = (st ? st.ncy : 36) + Math.sin(a) * r; } while (isSolid(G.world, gx, gy) && k++ < 10);
    setGoal(b, clamp(gx, 2, 70), clamp(gy, 2, 70));
  }
}

export function botUpdate(b, dt) {
  const br = b.brain, D = G.diff;
  br.thinkT -= dt; br.react -= dt; br.strafeT -= dt; br.errT -= dt; br.chaseT = (br.chaseT || 0) - dt;
  if (br.thinkT <= 0) { const near = G.player && dist(b, G.player) < 24; br.thinkT = near ? rand(0.2, 0.35) : rand(0.5, 0.9); think(b); }
  if (br.pathPending && G.pathBudget > 0 && br.goal) { br.pathPending = false; G.pathBudget--; br.path = findPath(G.world, b.x, b.y, br.goal.x, br.goal.y); br.pi = 0; }
  let mx = 0, my = 0; b.sprinting = false; b.crouch = false; b.ads = false;
  const follow = () => {
    if (br.path && br.pi < br.path.length) {
      const wp = br.path[br.pi], dx = wp.x - b.x, dy = wp.y - b.y, l = Math.hypot(dx, dy);
      if (l < 0.45) br.pi++; else { mx = dx / l; my = dy / l; }
    } else if (br.goal) { const dx = br.goal.x - b.x, dy = br.goal.y - b.y, l = Math.hypot(dx, dy); if (l > 0.4) { mx = dx / l; my = dy / l; } else br.goal = null; }
  };
  const t = br.tgt;
  if (br.state === 'fight' && hostileValid(b, t)) {
    const w = b.curWeapon(), wd = WEAPONS[w.id], d = dist(b, t);
    const seen = br.seen;
    if (seen) { br.lastSeen = { x: t.x, y: t.y }; br.chaseT = 3; }
    if (seen || d < 3) {
      const pref = PREF[w.id], a = angTo(b, t);
      let fx = 0, fy = 0;
      if (d > pref * 1.15) { fx = Math.cos(a); fy = Math.sin(a); } else if (d < pref * 0.6 && w.id !== 'wrench') { fx = -Math.cos(a); fy = -Math.sin(a); }
      if (br.strafeT <= 0) { br.strafeT = rand(0.6, 1.6); br.strafe = Math.random() < 0.5 ? -1 : 1; }
      if (w.id !== 'wrench') { fx += -Math.sin(a) * br.strafe * 0.8; fy += Math.cos(a) * br.strafe * 0.8; }
      const l = Math.hypot(fx, fy); if (l > 0) { mx = fx / l; my = fy / l; }
      if (b.hp < 30 && d > 6) { mx = -Math.cos(a); my = -Math.sin(a); b.sprinting = true; }
      // aim with human-like error
      if (br.errT <= 0) { br.errT = rand(0.25, 0.6); br.err = rand(-1, 1) * D.err * (1 + d / 18); }
      const lead = wd.speed ? d / wd.speed : 0; const tvx = t.vx || 0, tvy = t.vy || 0;
      const aa = Math.atan2(t.y + tvy * lead * 0.6 - b.y, t.x + tvx * lead * 0.6 - b.x) + br.err;
      const df = angDiff(b.aim, aa); b.setAim(b.aim + clamp(df, -D.turn * dt, D.turn * dt));
      const range = wd.melee ? wd.range + (t.r || 0.4) : wd.range;
      if (br.react <= 0 && Math.abs(df) < 0.3 && d < range) {
        if (!wd.melee && w.mag <= 0) { if (!b.startReload()) { const o = b.inv.slot === 0 ? 1 : 0; if (b.inv.w[o] && (b.inv.w[o].mag > 0 || b.inv.ammo[WEAPONS[b.inv.w[o].id].ammo] > 0)) b.switchSlot(o); else b.switchSlot(2); } }
        else if (b.reloadT <= 0 && b.healT <= 0 && (wd.auto ? Math.random() < D.burst : true)) G.combat.fire(b);
      }
      if (wd.melee) { mx = Math.cos(a); my = Math.sin(a); if (d > 4) b.sprinting = true; }
    } else if (br.lastSeen && br.chaseT > 0) {
      const dx = br.lastSeen.x - b.x, dy = br.lastSeen.y - b.y, l = Math.hypot(dx, dy); if (l > 0.6) { mx = dx / l; my = dy / l; }
      b.setAim(Math.atan2(dy, dx));
    } else { br.state = 'roam'; br.tgt = null; }
  } else {
    if (br.state === 'fight') { br.state = 'roam'; br.tgt = null; br.thinkT = 0; }
    if (br.state === 'heal') { if (b.healT <= 0) { br.state = 'roam'; br.thinkT = 0; } }
    else follow();
    if (br.state === 'zone') b.sprinting = true;
    if (br.state === 'loot' && br.lootTgt) {
      const lt = br.lootTgt;
      if (lt.gone || (lt.kind === 'container' && lt.items.length === 0)) { br.lootTgt = null; br.state = 'roam'; br.thinkT = 0; }
      else if (dist(b, lt) < (lt.kind === 'container' ? 1.1 : 0.6)) {
        if (lt.kind === 'container') {
          if (lt.ck === 'box') G.combat.smashBox(lt, b);
          else { G.loot.takeAll(b, lt); lt.opened = true; lt.claimed = null; }
        }
        br.lootTgt = null; br.state = 'roam'; br.thinkT = rand(0.1, 0.4);
      }
    }
    if (mx || my) b.setAim(b.aim + clamp(angDiff(b.aim, Math.atan2(my, mx)), -5 * dt, 5 * dt));
  }
  // stuck detection
  const moved = Math.hypot(b.x - br.lx, b.y - br.ly); br.lx = b.x; br.ly = b.y;
  if ((mx || my) && moved < 0.01) { br.stuckT += dt; if (br.stuckT > 1) { br.stuckT = 0; br.goal && setGoal(b, br.goal.x + rand(-1, 1), br.goal.y + rand(-1, 1)); if (!br.path) { mx = rand(-1, 1); my = rand(-1, 1); } } } else br.stuckT = 0;
  const px = b.x, py = b.y; b.move(mx, my, dt); b.vx = (b.x - px) / dt; b.vy = (b.y - py) / dt;
}
