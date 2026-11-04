// Match flow, player control, combat, loot, storm, supply drops, particles.
import { G } from './state.js';
import { WEAPONS, RARITY, ARMOR, rollLoot, BOT_NAMES, CREATURES } from './data.js';
import { buildWorld, isSolid, lineOfSight, collideCircle, groundAt, GR } from './world.js';
import { Human, Creature, Vehicle, makeContainer, makePickup, giveItem, dumpInventory } from './entities.js';
import { initBrain, botUpdate, DIFF } from './ai.js';
import { Input } from './input.js';
import { Audio, Music } from './audio.js';
import { rand, randi, choice, clamp, lerp, dist, angTo, angDiff, segCircle, screenDirToWorld, shuffle } from './util.js';

const STORM_PHASES = [
  { wait: 75, shrink: 40, r: 27, dmg: 2 }, { wait: 40, shrink: 32, r: 15, dmg: 4 }, { wait: 32, shrink: 26, r: 8, dmg: 7 },
  { wait: 26, shrink: 22, r: 3.5, dmg: 11 }, { wait: 18, shrink: 18, r: 0, dmg: 16 },
];
const VERBS = ['bonked', 'splatted', 'yeeted', 'flattened', 'deep-fried', 'popped', 'dusted', 'squashed', 'tenderized'];
let WORLD = null;

// ---------------- helpers: fx, decals, toasts, feed ----------------
function P(o) { if (G.particles.length > 700) G.particles.shift(); G.particles.push(o); return o; }
G.fx = {
  burst(x, y, color, n = 8, sp = 60, z = 20) { for (let i = 0; i < n; i++) { const a = rand(0, 6.28), s = rand(0.3, 1) * sp; P({ x, y, z, vx: Math.cos(a) * s / 32, vy: Math.sin(a) * s / 32, vz: rand(20, 90), g: 220, life: rand(0.35, 0.7), max: 0.7, size: rand(2.5, 5), color, type: 'puff' }); } },
  dust(x, y, k = 1) { P({ x: x + rand(-0.2, 0.2), y: y + rand(-0.2, 0.2), z: 2, vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), vz: rand(8, 20), g: 0, life: 0.8, max: 0.8, size: 6 + k * 6, color: 'rgba(205,180,135,0.55)', type: 'smoke' }); },
  smoke(x, y, col = 'rgba(70,70,70,0.5)') { P({ x, y, z: 20, vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2), vz: 30, g: -5, life: 1.6, max: 1.6, size: 8, color: col, type: 'smoke' }); },
  spark(x, y, z = 18) { for (let i = 0; i < 4; i++) { const a = rand(0, 6.28); P({ x, y, z, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, vz: rand(30, 100), g: 400, life: 0.25, max: 0.25, size: 2, color: '#ffd35a', type: 'spark' }); } },
  text(x, y, str, color = '#fff', size = 18) { P({ x, y, z: 50, vx: 0, vy: 0, vz: 40, g: 30, life: 0.9, max: 0.9, size, color, type: 'text', str }); },
  ring(x, y, r) { P({ x, y, z: 0, vx: 0, vy: 0, vz: 0, g: 0, life: 0.45, max: 0.45, size: r, color: '#fff3c0', type: 'ring' }); },
  shell(x, y) { const a = rand(0, 6.28); P({ x, y, z: 22, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, vz: 70, g: 400, life: 0.6, max: 0.6, size: 2, color: '#e0b04a', type: 'spark' }); },
  boom(x, y, r) {
    this.ring(x, y, r); for (let i = 0; i < 24; i++) { const a = rand(0, 6.28), s = rand(0.5, 1) * r * 1.2; P({ x, y, z: 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(40, 160), g: 120, life: rand(0.5, 0.9), max: 0.9, size: rand(8, 16), color: choice(['#ffd35a', '#ff8a3a', '#ff5a2a', '#fff3a0']), type: 'fire' }); }
    for (let i = 0; i < 12; i++) P({ x: x + rand(-1, 1), y: y + rand(-1, 1), z: rand(10, 40), vx: rand(-0.5, 0.5), vy: rand(-0.5, 0.5), vz: rand(20, 50), g: -10, life: rand(1.2, 2), max: 2, size: rand(12, 20), color: 'rgba(60,55,50,0.55)', type: 'smoke' });
  },
};
G.decal = (type, x, y, a = 0, s = 1) => { if (G.decals.length > 260) G.decals.shift(); G.decals.push({ type, x, y, a, s, t: 0, life: type === 'skid' ? 8 : 40 }); };
G.toast = (text, col) => { G.toasts.push({ text, t: 3.2, col }); if (G.toasts.length > 3) G.toasts.shift(); };
function feed(text, mine) { (G.feedLog = G.feedLog || []).push(Math.round(G.time) + ' ' + text); G.killFeed.push({ text, t: 6, mine }); if (G.killFeed.length > 5) G.killFeed.shift(); }

// ---------------- match setup ----------------
export function newMatch(opts) {
  if (!WORLD) WORLD = buildWorld();
  const W = G.world = WORLD;
  Object.assign(G, { humans: [], creatures: [], vehicles: [], containers: [], pickups: [], projectiles: [], grenades: [], barrels: [], particles: [], decals: [], killFeed: [], toasts: [], dmgInd: [] });
  G.time = 0; G.frame = 0; G.state = 'drop'; G.paused = false; G.lootOpen = null; G.combatT = -99; G.results = null; G.diff = DIFF[opts.difficulty] || DIFF.normal; G.airdrops = [100, 230];
  // loot
  for (const s of W.spots.crates) makeContainer('crate', s.x, s.y, rollLoot(1));
  for (const s of W.spots.boxes) makeContainer('box', s.x, s.y, rollLoot(0));
  for (const s of W.spots.premium) makeContainer('premium', s.x, s.y, rollLoot(2));
  for (const s of W.spots.floor) { const items = rollLoot(0).slice(0, 2); items.forEach((it, i) => makePickup(it, s.x + i * 0.4, s.y)); }
  for (const b of W.barrels) G.barrels.push({ kind: 'barrel', id: G.nextId++, x: b.x, y: b.y, hp: 25, r: 0.3 });
  for (const v of W.vehicleSpawns) G.vehicles.push(new Vehicle(v.type, v.x, v.y, v.a));
  for (const d of W.dens) for (let i = 0; i < d.n; i++) spawnCreature(d);
  G.tumble = []; for (let i = 0; i < 7; i++) G.tumble.push({ x: rand(0, 72), y: rand(0, 72), rot: 0, sp: rand(1.5, 3) });
  // players
  const names = shuffle([...BOT_NAMES]);
  const p = G.player = new Human('You', true); G.humans.push(p);
  for (let i = 0; i < opts.bots; i++) { const b = new Human(names[i % names.length]); initBrain(b); b.jumpAt = rand(0.08, 0.9); G.humans.push(b); }
  // blimp flight path across the map
  const a = rand(0, Math.PI * 2), off = rand(-10, 10), cx = 36 - Math.sin(a) * off, cy = 36 + Math.cos(a) * off;
  G.blimp = { x0: cx - Math.cos(a) * 52, y0: cy - Math.sin(a) * 52, x1: cx + Math.cos(a) * 52, y1: cy + Math.sin(a) * 52, t: 0, a, x: 0, y: 0, speed: 7 / 104 };
  // storm
  G.storm = { cx: 36, cy: 36, r: 56, phase: 0, mode: 'wait', t: STORM_PHASES[0].wait, dmgT: 0 };
  nextCircle();
  G.alive = G.humans.length; G.total = G.humans.length;
  G.toast('Press SPACE / A / tap JUMP to drop!', '#f2c14e');
}
function spawnCreature(d) { const c = new Creature(d.type, d.x + rand(-2, 2), d.y + rand(-2, 2), d); collideCircle(G.world, c, c.r); G.creatures.push(c); }
function nextCircle() {
  const st = G.storm, ph = STORM_PHASES[st.phase]; if (!ph) return;
  const maxOff = Math.max(0, st.r - ph.r) * (st.phase === 0 ? 0.45 : 0.85), a = rand(0, 6.28), o = rand(0, maxOff);
  st.ncx = clamp(st.cx + Math.cos(a) * o, 10, 62); st.ncy = clamp(st.cy + Math.sin(a) * o, 10, 62); st.nr = ph.r;
  if (Math.hypot(st.ncx - st.cx, st.ncy - st.cy) + st.nr > st.r) { st.ncx = st.cx; st.ncy = st.cy; }
  st.r0 = st.r; st.cx0 = st.cx; st.cy0 = st.cy;
}

// ---------------- combat ----------------
G.combat = {
  fire(h) {
    const w = h.curWeapon(), d = WEAPONS[w.id];
    if (h.fireCd > 0 || h.reloadT > 0 || h.healT > 0 || !h.canAct()) return false;
    if (d.melee) {
      h.fireCd = d.rate; h.swingT = 0.25; Audio.play('swing', h.x, h.y, 0.7); let hit = false;
      const targets = [...G.humans, ...G.creatures, ...G.containers.filter((c) => c.ck === 'box'), ...G.barrels];
      for (const t of targets) {
        if (t === h || t.dead || (t.kind === 'human' && t.drop !== 'ground')) continue;
        const dd = Math.hypot(t.x - h.x, t.y - h.y); if (dd > d.range + (t.r || 0.3)) continue;
        if (dd > 0.4 && Math.abs(angDiff(h.aim, angTo(h, t))) > d.arc / 2) continue;
        if (t.kind === 'creature' && t.def.fly && t.z > 40) continue;
        this.damage(t, d.dmg, h, { melee: true }); hit = true;
      }
      if (hit) { Audio.play('bonk', h.x, h.y); if (h.isPlayer) G.cam.shake = Math.max(G.cam.shake, 4); }
      return true;
    }
    if (w.mag <= 0) { h.fireCd = 0.3; Audio.play('empty', h.x, h.y, 0.6); if (h.isPlayer && !h.startReload() && h.inv.ammo[d.ammo] <= 0) G.toast('Out of ' + d.ammo + ' ammo!'); return false; }
    w.mag--; h.fireCd = d.rate; h.flashT = 0.06; h.recoil = 1;
    let spread = d.spread * (h.crouch ? 0.6 : 1) * (h.ads ? 0.5 : 1) * (h.moveAmt > 0.2 ? 1.35 : 1) + h.spread;
    if (d.auto) h.spread = Math.min(0.12, h.spread + d.spread * 0.18);
    const mult = RARITY[w.rar].mult, n = d.pellets || 1;
    for (let i = 0; i < n; i++) {
      const a = h.aim + (Math.random() * 2 - 1) * spread, sp = d.speed * (n > 1 ? rand(0.85, 1.1) : 1);
      G.projectiles.push({ x: h.x + Math.cos(h.aim) * 0.45, y: h.y + Math.sin(h.aim) * 0.45, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: d.dmg * mult, owner: h, trav: 0, max: d.range * (n > 1 ? rand(0.75, 1.05) : 1), w: w.id, px: h.x, py: h.y });
    }
    Audio.play(d.sfx, h.x, h.y, h.isPlayer ? 1 : 0.8); G.fx.shell(h.x, h.y);
    if (h.isPlayer) { G.cam.shake = Math.max(G.cam.shake, d.kick * 0.8); G.combatT = G.time; }
    else if (G.player && dist(h, G.player) < 16) G.combatT = G.time;
    if (w.mag === 0 && h.isPlayer) h.startReload();
    return true;
  },
  damage(t, amt, src, o = {}) {
    if (t.dead) return;
    if (t.kind === 'human') {
      if (t.drop !== 'ground') return;
      if (t.vehicle && !o.explosion) { this.damageVehicle(t.vehicle, amt * 0.75, src); amt *= 0.25; }
      let head = !o.melee && !o.explosion && Math.random() < 0.18, slot = head ? 'helmet' : 'vest';
      if (head) amt *= 1.4;
      const ar = t.inv[slot];
      if (ar && ar.dur > 0) { const red = ARMOR[slot][ar.lvl].red, ab = amt * red; ar.dur -= amt * 0.7; amt -= ab; if (ar.dur <= 0) { t.inv[slot] = null; if (t.isPlayer) G.toast('Your ' + slot + ' broke!', '#ff7b5a'); } if (src && src.isPlayer) Audio.play('armor', t.x, t.y, 0.5); }
      t.hp -= amt; t.hitT = 0.12; t.healT = 0; if (src) { t.lastHitBy = src; t.lastHitT = G.time; }
      if (src && src.kind === 'human') src.dmg += amt;
      G.fx.burst(t.x, t.y, choice(['#ff6b5a', '#ffb05a', '#fff']), 5, 50, 26);
      if (src && src.isPlayer) { G.fx.text(t.x, t.y, head ? 'HEADSHOT!' : Math.round(amt) + '', head ? '#ffd35a' : '#fff', head ? 18 : 15); Audio.play('hit', t.x, t.y, 0.8); G.hitMarker = 0.15; }
      if (t.isPlayer) { Audio.play('hitme'); G.cam.shake = Math.max(G.cam.shake, 5); if (src && src !== t) G.dmgInd.push({ a: Math.atan2(src.y - t.y, src.x - t.x), t: 1.2 }); G.combatT = G.time; }
      if (t.brain && src && src !== t && (src.kind === 'human' || src.kind === 'creature') && !src.dead) { const br = t.brain; if (!br.tgt || br.state !== 'fight' || Math.random() < 0.4) { br.tgt = src; br.state = 'fight'; br.seen = lineOfSight(G.world, t.x, t.y, src.x, src.y); br.lastSeen = { x: src.x, y: src.y }; br.chaseT = 3; br.react = Math.min(br.react, G.diff.react * 0.6); } }
      if (t.hp <= 0) killHuman(t, src, o);
    } else if (t.kind === 'creature') {
      t.hp -= amt; t.hitT = 0.12; t.aggroOn(src);
      G.fx.burst(t.x, t.y, t.type === 'dog' ? '#e2c46b' : t.type === 'rat' ? '#9fe36b' : t.type === 'crow' ? '#333' : '#9fd36b', 5, 50, (t.z || 0) + 16);
      if (src && src.isPlayer) { G.fx.text(t.x, t.y, Math.round(amt) + '', '#fff', 14); Audio.play('hit', t.x, t.y, 0.6); G.hitMarker = 0.15; }
      if (t.hp <= 0) killCreature(t, src);
    } else if (t.kind === 'vehicle') this.damageVehicle(t, amt, src);
    else if (t.kind === 'container' && t.ck === 'box') { t.hp -= amt; G.fx.burst(t.x, t.y, '#c08a4c', 3, 40, 14); if (t.hp <= 0) this.smashBox(t, src); }
    else if (t.kind === 'barrel') { t.hp -= amt; if (t.hp <= 0 && !t.dead) { t.dead = true; G.barrels = G.barrels.filter((b) => b !== t); this.explode(t.x, t.y, 2.8, 75, src); } }
  },
  damageVehicle(v, amt, src) {
    if (v.dead) return; v.hp -= amt; v.hitT = 0.08; G.fx.spark(v.x, v.y, 20);
    if (v.hp <= 0) { v.dead = true; const d = v.driver; if (d) exitVehicle(d, true); this.explode(v.x, v.y, 3.2, 90, src); G.decal('scorch', v.x, v.y, 0, 1.6); }
  },
  explode(x, y, r, dmg, src) {
    G.fx.boom(x, y, r); Audio.play('explode', x, y); G.decal('scorch', x, y, rand(0, 6), r / 2.5);
    if (G.player) { const d = dist(G.player, { x, y }); G.cam.shake = Math.max(G.cam.shake, clamp(22 - d * 1.5, 0, 18)); }
    const all = [...G.humans, ...G.creatures, ...G.vehicles, ...G.barrels, ...G.containers.filter((c) => c.ck === 'box')];
    for (const t of all) {
      if (t.dead || (t.kind === 'human' && t.vehicle)) continue; const d = Math.hypot(t.x - x, t.y - y); if (d > r + (t.r || 0)) continue;
      if (!lineOfSight(G.world, x, y, t.x, t.y) && d > 1) continue;
      const f = 1 - Math.max(0, d - 0.5) / r; this.damage(t, dmg * clamp(f, 0.15, 1), src, { explosion: true });
      if (t.kind !== 'vehicle' && t.kind !== 'barrel' && t.kind !== 'container' && !t.dead) { const l = d || 1; t.x += (t.x - x) / l * f * 0.8; t.y += (t.y - y) / l * f * 0.8; collideCircle(G.world, t, t.r); }
    }
  },
  smashBox(box, src) {
    if (box.gone) return; box.gone = true; G.containers = G.containers.filter((c) => c !== box);
    Audio.play('box', box.x, box.y); for (let i = 0; i < 8; i++) G.fx.burst(box.x, box.y, choice(['#c08a4c', '#d9a463', '#7a5530']), 1, 70, 16);
    box.items.forEach((it, i) => { const a = i * 2.2 + rand(0, 1); makePickup(it, box.x + Math.cos(a) * 0.35, box.y + Math.sin(a) * 0.35); });
  },
  throwGrenade(h, tx, ty) {
    if (h.inv.grenades <= 0 || !h.canAct() || h.fireCd > 0) return; h.inv.grenades--; h.fireCd = 0.6;
    let dx = tx - h.x, dy = ty - h.y; const d = Math.hypot(dx, dy) || 1, D = Math.min(d, 9); dx = dx / d * D; dy = dy / d * D;
    const T = 0.5 + D * 0.07; G.grenades.push({ x: h.x, y: h.y, z: 30, vx: dx / T, vy: dy / T, vz: 300 * T / 2 + -30 / T, fuse: 2.3, owner: h, rot: 0 });
    Audio.play('throw', h.x, h.y);
  },
};
function killHuman(h, src, o) {
  h.dead = true; h.hp = 0; if (h.vehicle) exitVehicle(h, true);
  const items = dumpInventory(h); if (items.length) makeContainer('deathbox', h.x, h.y, items, { name: h.name });
  h.place = G.humans.filter((x) => !x.dead).length + 1;
  Audio.play('death', h.x, h.y); G.fx.burst(h.x, h.y, '#fff', 14, 90, 24); G.fx.text(h.x, h.y, 'KO!', '#ffd35a', 24);
  G.decal('splat', h.x, h.y, rand(0, 6));
  const mine = (src && src.isPlayer) || h.isPlayer;
  if (src && src.kind === 'human' && src !== h) {
    src.kills++; feed(`${src.name} ${o && o.runover ? 'ran over' : o && o.explosion ? 'blew up' : choice(VERBS)} ${h.name}`, mine);
    if (src.isPlayer) { Audio.play('kill'); G.toast('💥 You KO\'d ' + h.name + '!', '#ffd35a'); }
  } else if (src && src.kind === 'creature') feed(`${src.def.name} chomped ${h.name}`, mine);
  else if (o && o.storm) feed(`${h.name} choked on the dust`, mine);
  else feed(`${h.name} had a very bad day`, mine);
  if (h.isPlayer) { G.state = 'dead'; G.killer = src && src.kind === 'human' ? src : null; G.endT = 1.6; Audio.play('lose'); }
}
function killCreature(c, src) {
  c.dead = true; G.creatures = G.creatures.filter((x) => x !== c); Audio.play('squish', c.x, c.y);
  G.fx.burst(c.x, c.y, c.type === 'rat' ? '#9fe36b' : c.type === 'crow' ? '#2b2b34' : '#e2c46b', 12, 80, (c.z || 0) + 14);
  if (c.def.boss) { makeContainer('crate', c.x, c.y, rollLoot(2)); feed(`${src ? src.name : 'Someone'} took down the Bloat Hog!`, src && src.isPlayer); G.toast('🐗 The Bloat Hog dropped a loot crate!', '#b06cff'); }
  else if (Math.random() < 0.3) makePickup(choice([{ t: 'ammo', id: choice(['light', 'heavy', 'shells']), n: 12 }, { t: 'heal', id: 'bandage', n: 1 }]), c.x, c.y);
  c.den.respawnT = G.time + 45;
}

// ---------------- vehicles ----------------
function enterVehicle(h, v) { if (v.driver || v.dead) return; v.driver = h; h.vehicle = v; h.healT = 0; h.reloadT = 0; Audio.play('door', v.x, v.y); if (h.isPlayer) { G.lootOpen = null; Audio.engine(true, 0); } }
export function exitVehicle(h, forced) {
  const v = h.vehicle; if (!v) return; v.driver = null; h.vehicle = null;
  for (let i = 0; i < 12; i++) { const a = v.angle + Math.PI / 2 + i * 0.55, x = v.x + Math.cos(a) * 1.4, y = v.y + Math.sin(a) * 1.4; if (!isSolid(G.world, x, y)) { h.x = x; h.y = y; break; } }
  collideCircle(G.world, h, h.r); if (h.isPlayer) Audio.engine(false); if (!forced) Audio.play('door', v.x, v.y);
}

// ---------------- loot ----------------
G.loot = {
  takeAll(h, c) {
    let took = 0; const keep = [];
    for (const it of c.items) {
      const manual = h.isPlayer && it.t === 'weapon' ? false : false;
      if (h.isPlayer && it.t === 'weapon' && !h.inv.w.includes(null)) { keep.push(it); continue; }
      const r = giveItem(h, it, manual); if (r.taken) { took++; if (r.leftover) keep.push(r.leftover); } else keep.push(it);
    }
    c.items = keep; c.opened = true; if (took && h.isPlayer) Audio.play('pickup');
    if (c.ck === 'deathbox' && !keep.length) removeContainer(c);
    return took;
  },
  takeItem(h, c, i) {
    const it = c.items[i]; if (!it) return; const r = giveItem(h, it, true);
    if (!r.taken) { if (h.isPlayer) { Audio.play('empty'); G.toast(it.t === 'helmet' || it.t === 'vest' || it.t === 'pack' ? 'You already have better gear' : 'No room for that'); } return; }
    c.items.splice(i, 1); if (r.leftover) c.items.push(r.leftover); if (h.isPlayer) Audio.play(it.t === 'weapon' ? 'equip' : 'pickup');
    if (c.ck === 'deathbox' && !c.items.length) removeContainer(c);
  },
};
function removeContainer(c) { c.gone = true; G.containers = G.containers.filter((x) => x !== c); if (G.lootOpen === c) G.lootOpen = null; }
function autoPickup(h) {
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const p = G.pickups[i]; if (p.cool > 0 && p.coolFor === h) continue;
    if (Math.abs(p.x - h.x) > 0.8 || Math.abs(p.y - h.y) > 0.8) continue;
    if (Math.hypot(p.x - h.x, p.y - h.y) > 0.75) continue;
    if (p.item.t === 'weapon' && h.isPlayer && !h.inv.w.includes(null)) continue;
    const r = giveItem(h, p.item, false);
    if (r.taken) {
      if (h.isPlayer) { Audio.play(p.item.t === 'weapon' ? 'equip' : 'pickup'); G.fx.text(h.x, h.y, '+' + itemShort(p.item), '#bfffb0', 13); }
      if (r.leftover) { p.item = r.leftover; p.cool = 2; p.coolFor = h; } else { p.gone = true; G.pickups.splice(i, 1); }
    }
  }
}
function itemShort(it) { return it.t === 'ammo' ? it.n + ' ' + it.id : it.t === 'weapon' ? WEAPONS[it.id].name : it.t === 'heal' ? it.id : it.t === 'grenade' ? 'grenade' : it.t + ' ' + it.lvl; }
export function nearestInteract(p) {
  let best = null, bd = 9;
  const consider = (k, o, d) => { if (d < bd) { bd = d; best = { k, o }; } };
  for (const q of G.pickups) if (q.item.t === 'weapon') { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < 1.1) consider('pickup', q, d); }
  for (const c of G.containers) { if (c.falling || (c.opened && !c.items.length)) continue; const d = Math.hypot(c.x - p.x, c.y - p.y) - 0.3; if (d < 1.25) consider(c.ck === 'box' ? 'box' : 'container', c, d); }
  for (const v of G.vehicles) { if (v.dead || v.driver) continue; const d = Math.hypot(v.x - p.x, v.y - p.y) - 0.7; if (d < 1.3) consider('vehicle', v, d); }
  return best;
}

// ---------------- player ----------------
function updatePlayer(dt) {
  const p = G.player; if (p.dead) return; const I = Input;
  const mvMag = Math.min(1, Math.hypot(I.move.x, I.move.y)), wd = mvMag > 0.05 ? screenDirToWorld(I.move.x, I.move.y) : { x: 0, y: 0 };
  // aim
  if (G.inputMode === 'kbm') { const wp = G.screenToWorld(I.mouse.x, I.mouse.y); G.aimPoint = wp; if (Math.hypot(wp.x - p.x, wp.y - p.y) > 0.15) p.setAim(Math.atan2(wp.y - p.y, wp.x - p.x)); }
  else {
    const ad = I.aimDir; if (ad.mag > 0 || mvMag > 0.3) { const w = screenDirToWorld(ad.x, ad.y); let a = Math.atan2(w.y, w.x);
      if (ad.mag > 0 && G.settings.aimAssist) { let ba = null, bd = 13; for (const t of [...G.humans, ...G.creatures]) { if (t === p || t.dead || (t.kind === 'human' && t.drop !== 'ground')) continue; const d = dist(p, t); if (d > bd) continue; const df = angDiff(a, angTo(p, t)); if (Math.abs(df) < 0.3 && lineOfSight(G.world, p.x, p.y, t.x, t.y)) { bd = d; ba = df; } } if (ba !== null) a += ba * 0.75; }
      p.setAim(a); }
    G.aimPoint = { x: p.x + Math.cos(p.aim) * 7, y: p.y + Math.sin(p.aim) * 7 };
  }
  if (p.drop === 'blimp') { p.x = G.blimp.x; p.y = G.blimp.y; if (I.hit('jump') || I.hit('interact') || I.hit('click') || I.hit('tapfire') || G.blimp.t > 0.97) jump(p); return; }
  if (p.drop === 'fall') { fall(p, wd.x * mvMag, wd.y * mvMag, dt, I.hit('jump')); return; }
  if (p.vehicle) {
    const v = p.vehicle; v.drive(wd.x * mvMag, wd.y * mvMag, I.keys.has('Space') || (I.padB && I.padB[1]), dt);
    Audio.engine(true, v.speed);
    if (I.hit('horn') && v.hornCd <= 0) { v.hornCd = 0.5; Audio.play('horn', v.x, v.y); }
    if (I.hit('interact') || I.hit('jump')) exitVehicle(p);
    return;
  }
  if (I.hit('crouch')) p.crouch = !p.crouch;
  p.sprinting = I.sprint && mvMag > 0.1 && !I.ads; if (p.sprinting) p.crouch = false;
  p.ads = I.ads; const px = p.x, py = p.y;
  p.move(wd.x * mvMag, wd.y * mvMag, dt); p.vx = (p.x - px) / dt; p.vy = (p.y - py) / dt;
  if (mvMag > 0.1 && G.lootOpen && dist(p, G.lootOpen) > 2) G.lootOpen = null;
  // weapons
  const w = p.curWeapon(), d = WEAPONS[w.id];
  const wantFire = (I.fire && (d.auto || d.melee || !p.firePrev)) || I.hit('tapfire');
  p.firePrev = I.fire;
  if (wantFire && !G.lootOpen && !G.uiBlock) G.combat.fire(p);
  if (I.hit('reload')) p.startReload();
  if (I.hit('slot1')) p.switchSlot(0); if (I.hit('slot2')) p.switchSlot(1); if (I.hit('slot3')) p.switchSlot(2);
  if (I.hit('next') || I.hit('swap')) p.cycle(1); if (I.hit('prev')) p.cycle(-1);
  if (I.hit('grenade')) { if (p.inv.grenades > 0) G.combat.throwGrenade(p, G.aimPoint.x, G.aimPoint.y); else G.toast('No grenades'); }
  if (I.hit('bandage')) p.startHeal('bandage') || (!p.inv.heals.bandage && G.toast('No bandages'));
  if (I.hit('medkit')) p.startHeal('medkit') || (!p.inv.heals.medkit && G.toast('No medkits'));
  if (I.hit('soda')) p.startHeal('soda') || (!p.inv.heals.soda && G.toast('No sodas'));
  if (I.hit('heal')) { if (p.hp < 40 && p.inv.heals.medkit) p.startHeal('medkit'); else if (p.hp < 75 && p.inv.heals.bandage) p.startHeal('bandage'); else if (p.inv.heals.soda) p.startHeal('soda'); else if (p.inv.heals.medkit && p.hp < 100) p.startHeal('medkit'); }
  // interact
  G.interact = nearestInteract(p);
  if (I.hit('interact')) {
    if (G.lootOpen && dist(p, G.lootOpen) < 2.2) { G.loot.takeAll(p, G.lootOpen); if (G.lootOpen && !G.lootOpen.items.length) G.lootOpen = null; }
    else if (G.interact) {
      const it = G.interact;
      if (it.k === 'pickup') { const r = giveItem(p, it.o.item, true); if (r.taken) { Audio.play('equip'); G.pickups = G.pickups.filter((q) => q !== it.o); if (r.leftover) { const q = makePickup(r.leftover, p.x, p.y); q.cool = 1.5; q.coolFor = p; } } }
      else if (it.k === 'box') { G.combat.smashBox(it.o, p); }
      else if (it.k === 'container') { G.lootOpen = it.o; if (!it.o.opened) Audio.play('crate', it.o.x, it.o.y); it.o.opened = true; }
      else if (it.k === 'vehicle') enterVehicle(p, it.o);
    }
  }
}
function pickLanding(h) {
  const spots = [...G.world.spots.crates, ...G.world.spots.boxes].filter((s) => Math.hypot(s.x - h.x, s.y - h.y) < 30);
  const taken = G.humans.filter((o) => o !== h && o.landAt).map((o) => o.landAt);
  let best = { x: h.x, y: h.y }, bs = -1;
  for (let i = 0; i < 6 && spots.length; i++) { const s = choice(spots), md = taken.reduce((m, t) => Math.min(m, Math.hypot(t.x - s.x, t.y - s.y)), 99); if (md > bs) { bs = md; best = s; } }
  return { x: best.x + rand(-1.5, 1.5), y: best.y + rand(-1.5, 1.5) };
}
function jump(h) { h.drop = 'fall'; h.dropZ = 520; Audio.play('jump', h.x, h.y, h.isPlayer ? 1 : 0.4); if (h.isPlayer) G.toast('Steer your parachute with movement controls'); }
function fall(h, mx, my, dt, dive) {
  h.x = clamp(h.x + mx * 5.5 * dt, 2, 70); h.y = clamp(h.y + my * 5.5 * dt, 2, 70); h.dropZ -= dt * 78; h.moveAmt = 0;
  if (h.dropZ <= 0) { h.dropZ = 0; h.drop = 'ground'; collideCircle(G.world, h, h.r); Audio.play('chute', h.x, h.y, h.isPlayer ? 1 : 0.5); G.fx.dust(h.x, h.y, 1.5); if (h.isPlayer) G.state = 'play'; }
}

// ---------------- main update ----------------
export function update(dt) {
  G.frame++; G.time += dt; G.pathBudget = 3;
  const st = G.storm, bl = G.blimp;
  // blimp
  if (bl.t < 1.2) { bl.t += bl.speed * dt; const k = Math.min(1, bl.t); bl.x = lerp(bl.x0, bl.x1, k); bl.y = lerp(bl.y0, bl.y1, k); }
  if (G.state === 'drop' || G.state === 'play' || G.state === 'dead' || G.state === 'win') updatePlayer(dt);
  // humans
  for (const h of G.humans) {
    if (h.dead) continue; h.update(dt);
    if (h.isPlayer) continue;
    if (h.drop === 'blimp') { h.x = bl.x; h.y = bl.y; if (bl.t >= h.jumpAt || bl.t > 0.97) { jump(h); h.landAt = pickLanding(h); } continue; }
    if (h.drop === 'fall') { const dx = h.landAt.x - h.x, dy = h.landAt.y - h.y, l = Math.hypot(dx, dy); fall(h, l > 0.3 ? dx / l : 0, l > 0.3 ? dy / l : 0, dt); continue; }
    botUpdate(h, dt);
  }
  // pickups (staggered)
  if (G.frame % 3 === 0) for (const h of G.humans) if (!h.dead && h.drop === 'ground' && !h.vehicle) autoPickup(h);
  for (const p of G.pickups) { p.t += dt; if (p.cool > 0) p.cool -= dt; }
  // vehicles
  for (const v of G.vehicles) {
    if (v.dead) continue; v.update(dt);
    const sp = Math.hypot(v.vx, v.vy);
    for (const t of [...G.humans, ...G.creatures]) {
      if (t.dead || t.vehicle || (t.kind === 'human' && t.drop !== 'ground') || (t.def && t.def.fly)) continue;
      const dx = t.x - v.x, dy = t.y - v.y, d = Math.hypot(dx, dy), md = v.r + t.r;
      if (d < md && d > 0.001) {
        if (sp > 5 && v.driver) { if (!t.runCd || t.runCd < G.time) { t.runCd = G.time + 0.5; G.combat.damage(t, sp * 5.5, v.driver, { runover: true, melee: true }); Audio.play('bonk', t.x, t.y); G.fx.text(t.x, t.y, 'SPLAT!', '#ffd35a', 18); } v.speed *= 0.85; }
        t.x += dx / d * (md - d); t.y += dy / d * (md - d); collideCircle(G.world, t, t.r);
      }
    }
    for (const o of G.vehicles) { if (o === v || o.dead) continue; const dx = o.x - v.x, dy = o.y - v.y, d = Math.hypot(dx, dy), md = v.r + o.r; if (d < md && d > 0.001) { const push = (md - d) / 2; o.x += dx / d * push; o.y += dy / d * push; v.x -= dx / d * push; v.y -= dy / d * push; if (sp > 6) { G.combat.damageVehicle(o, sp * 2, v.driver); G.combat.damageVehicle(v, sp, null); Audio.play('crash', v.x, v.y); } v.speed *= 0.5; } }
  }
  G.vehicles = G.vehicles.filter((v) => !v.dead);
  if (G.player.vehicle) Audio.setListener(G.player.vehicle.x, G.player.vehicle.y);
  // creatures + respawn
  for (const c of G.creatures) c.update(dt);
  if (G.frame % 60 === 0) for (const d of G.world.dens) {
    const alive = G.creatures.filter((c) => c.den === d).length;
    if (alive < d.n && (!d.respawnT || G.time > d.respawnT) && dist(G.player, d) > 14 && d.type !== 'hog') { spawnCreature(d); d.respawnT = G.time + 30; }
  }
  // separation (humans & creatures vs each other and solid props)
  const movers = G.humans.filter((h) => !h.dead && h.drop === 'ground' && !h.vehicle);
  const props = [...G.containers.filter((c) => c.ck !== 'deathbox' && !c.falling), ...G.barrels];
  const bodies = movers.concat(G.creatures.filter((c) => !c.def.fly));
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) { const b = bodies[j], dx = b.x - a.x, dy = b.y - a.y; if (Math.abs(dx) > 2 || Math.abs(dy) > 2) continue; const d = Math.hypot(dx, dy), md = a.r + b.r; if (d < md && d > 0.0001) { const p = (md - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; } }
    for (const o of props) { const dx = a.x - o.x, dy = a.y - o.y; if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) continue; const d = Math.hypot(dx, dy), md = a.r + o.r; if (d < md && d > 0.0001) { a.x += dx / d * (md - d); a.y += dy / d * (md - d); } }
  }
  // projectiles
  updateProjectiles(dt);
  // grenades
  for (const g of G.grenades) {
    g.fuse -= dt; g.rot += dt * 10; g.vz -= 300 * dt * 2; g.z += g.vz * dt;
    const nx = g.x + g.vx * dt; if (isSolid(G.world, nx, g.y)) g.vx *= -0.5; else g.x = nx;
    const ny = g.y + g.vy * dt; if (isSolid(G.world, g.x, ny)) g.vy *= -0.5; else g.y = ny;
    if (g.z <= 0) { g.z = 0; if (Math.abs(g.vz) > 60) { g.vz = -g.vz * 0.35; Audio.play('click', g.x, g.y, 0.4); } else g.vz = 0; g.vx *= 0.6; g.vy *= 0.6; }
    if (g.fuse <= 0) { g.dead = true; G.combat.explode(g.x, g.y, 3, 95, g.owner); }
  }
  G.grenades = G.grenades.filter((g) => !g.dead);
  // falling airdrops
  for (const c of G.containers) if (c.falling) { c.z -= 70 * dt; if (G.frame % 4 === 0) G.fx.smoke(c.x, c.y, 'rgba(255,80,60,0.45)'); if (c.z <= 0) { c.z = 0; c.falling = false; c.smokeT = 25; G.fx.dust(c.x, c.y, 3); Audio.play('box', c.x, c.y); } }
    else if (c.smokeT > 0) { c.smokeT -= dt; if (G.frame % 5 === 0) G.fx.smoke(c.x, c.y, 'rgba(255,80,60,0.45)'); }
  if (G.airdrops.length && G.time > G.airdrops[0]) { G.airdrops.shift(); const a = rand(0, 6.28), r = rand(0, st.nr * 0.7); let x = st.ncx + Math.cos(a) * r, y = st.ncy + Math.sin(a) * r; for (let k = 0; k < 10 && isSolid(G.world, x, y); k++) { x += rand(-2, 2); y += rand(-2, 2); } makeContainer('airdrop', x, y, rollLoot(2), { z: 460, falling: true }); G.toast('📦 Supply drop incoming! Look for the red smoke', '#5fb3e6'); Audio.play('airdrop'); }
  // storm
  st.t -= dt; const ph = STORM_PHASES[st.phase];
  if (ph) {
    if (st.mode === 'wait' && st.t <= 0) { st.mode = 'shrink'; st.t = ph.shrink; st.r0 = st.r; st.cx0 = st.cx; st.cy0 = st.cy; G.toast('🌪️ The dust storm is closing in!', '#9fe36b'); Audio.play('zone'); }
    else if (st.mode === 'shrink') {
      const k = 1 - Math.max(0, st.t) / ph.shrink; st.r = lerp(st.r0, st.nr, k); st.cx = lerp(st.cx0, st.ncx, k); st.cy = lerp(st.cy0, st.ncy, k);
      if (st.t <= 0) { st.phase++; st.mode = 'wait'; const np = STORM_PHASES[st.phase]; if (np) { st.t = np.wait; nextCircle(); G.toast('Next safe zone marked on your map', '#fff'); } else st.t = 1e9; }
    }
  }
  st.dmgT -= dt; const dmg = (STORM_PHASES[Math.min(st.phase, STORM_PHASES.length - 1)]).dmg;
  if (st.dmgT <= 0) { st.dmgT = 1; for (const h of G.humans) { if (h.dead || h.drop !== 'ground') continue; if (Math.hypot(h.x - st.cx, h.y - st.cy) > st.r) { h.hp -= dmg; if (h.isPlayer) { Audio.play('hitme'); G.stormHurt = 0.6; } if (h.hp <= 0) killHuman(h, null, { storm: true }); } } }
  // goo puddles hurt a little
  if (G.frame % 30 === 0) for (const h of G.humans) if (!h.dead && h.drop === 'ground' && !h.vehicle && groundAt(G.world, h.x, h.y) === GR.GOO) { G.combat.damage(h, 3, null, { explosion: true }); }
  // tumbleweeds
  for (const t of G.tumble) { t.x += t.sp * dt * 0.7; t.y += t.sp * dt * 0.3 + Math.sin(G.time + t.sp) * dt * 0.3; t.rot += t.sp * dt * 3; if (t.x > 74 || t.y > 74) { t.x = rand(-2, 40); t.y = rand(-2, 0); if (Math.random() < 0.5) { t.y = rand(0, 60); t.x = -2; } } }
  // particles, decals, ui timers
  for (const p of G.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt; if (p.z < 0 && p.type !== 'smoke') { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; } }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const d of G.decals) d.t += dt; G.decals = G.decals.filter((d) => d.t < d.life);
  for (const k of G.killFeed) k.t -= dt; G.killFeed = G.killFeed.filter((k) => k.t > 0);
  for (const k of G.toasts) k.t -= dt; G.toasts = G.toasts.filter((k) => k.t > 0);
  for (const k of G.dmgInd) k.t -= dt; G.dmgInd = G.dmgInd.filter((k) => k.t > 0);
  G.hitMarker = (G.hitMarker || 0) - dt; G.stormHurt = (G.stormHurt || 0) - dt;
  // music intensity & wind
  const pl = G.player, outside = Math.hypot(pl.x - st.cx, pl.y - st.cy) - st.r;
  Music.setIntensity(G.time - G.combatT < 6 ? 1 : (G.alive <= 5 ? 0.7 : st.phase >= 3 ? 0.5 : 0));
  Audio.wind(clamp(1 - Math.abs(outside) / 8, 0, 1) * 0.7 + (outside > 0 ? 0.3 : 0));
  if (!pl.vehicle) Audio.setListener(pl.x, pl.y);
  // end conditions
  G.alive = G.humans.filter((h) => !h.dead).length;
  if (G.state === 'play' && G.alive <= 1 && !pl.dead) { G.state = 'win'; G.endT = 1.2; Audio.play('win'); Music.setIntensity(0); }
  if (G.endT > 0) { G.endT -= dt; if (G.endT <= 0) G.showResults && G.showResults(); }
}

function updateProjectiles(dt) {
  const W = G.world;
  for (const b of G.projectiles) {
    b.px = b.x; b.py = b.y; const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt, len = Math.hypot(nx - b.x, ny - b.y);
    // wall hit (sample)
    let wallT = 2; const steps = Math.ceil(len / 0.2);
    for (let i = 1; i <= steps; i++) { const t = i / steps; if (isSolid(W, b.x + (nx - b.x) * t, b.y + (ny - b.y) * t)) { wallT = t; break; } }
    let hitT = wallT, hitO = null;
    const test = (o, r) => { const t = segCircle(b.x, b.y, nx, ny, o.x, o.y, r); if (t >= 0 && t < hitT) { hitT = t; hitO = o; } };
    for (const h of G.humans) { if (h === b.owner || h.dead || h.drop !== 'ground' || h.vehicle) continue; test(h, h.r + 0.05); }
    for (const c of G.creatures) test(c, c.r + 0.05);
    for (const v of G.vehicles) if (v !== b.owner.vehicle) test(v, v.r);
    for (const c of G.containers) if (c.ck === 'box') test(c, c.r);
    for (const r of G.barrels) test(r, r.r);
    if (hitO) {
      const falloff = clamp(1.15 - b.trav / b.max * 0.5, 0.6, 1);
      G.combat.damage(hitO, b.dmg * falloff, b.owner); b.dead = true;
    } else if (wallT <= 1) { b.dead = true; const hx = b.x + (nx - b.x) * wallT, hy = b.y + (ny - b.y) * wallT; G.fx.spark(hx, hy); if (dist(G.player, { x: hx, y: hy }) < 14) Audio.play('click', hx, hy, 0.15); }
    b.x = nx; b.y = ny; b.trav += len; if (b.trav > b.max) b.dead = true;
  }
  G.projectiles = G.projectiles.filter((b) => !b.dead);
}
