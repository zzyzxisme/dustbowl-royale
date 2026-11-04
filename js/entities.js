// Entity classes: humans (player + bots), creatures, vehicles, containers, pickups, barrels. Plus inventory rules.
import { G, uid } from './state.js';
import { WEAPONS, HEALS, ARMOR, AMMO_CAP, GRENADE_MAX, CREATURES, VEHICLES, SKINS, SHIRTS, PANTS, HATS } from './data.js';
import { collideCircle, lineOfSight, isSolid, buildingAt } from './world.js';
import { choice, rand, angDiff, clamp, worldDirToScreenAngle, dist } from './util.js';
import { Audio } from './audio.js';

export function randomOutfit() {
  return { skin: choice(SKINS), shirt: choice(SHIRTS), pants: choice(PANTS), hat: choice(HATS), hatCol: choice(SHIRTS) };
}

export class Human {
  constructor(name, isPlayer = false) {
    this.id = uid(); this.kind = 'human'; this.name = name; this.isPlayer = isPlayer; this.outfit = randomOutfit();
    if (isPlayer) Object.assign(this.outfit, { skin: '#f5cba7', shirt: '#f0ad4e', pants: '#3d405b', hat: 'goggles' });
    this.x = 0; this.y = 0; this.r = 0.36; this.hp = 100; this.boost = 0; this.dead = false;
    this.inv = { w: [null, null], melee: { t: 'weapon', id: 'wrench', rar: 0 }, slot: 2, ammo: { light: 0, shells: 0, heavy: 0 }, heals: { bandage: 0, medkit: 0, soda: 0 }, grenades: 0, helmet: null, vest: null, pack: 0 };
    this.aim = 0; this.aimScreen = 0; this.moveAmt = 0; this.walkT = 0; this.stepT = 0;
    this.fireCd = 0; this.reloadT = 0; this.healT = 0; this.healId = null; this.swingT = 0; this.recoil = 0; this.flashT = 0; this.hitT = 0;
    this.crouch = false; this.vehicle = null; this.dropZ = 0; this.drop = 'blimp'; this.kills = 0; this.dmg = 0; this.lastHitBy = null; this.lastHitT = -9;
    this.spread = 0;
  }
  curWeapon() { const i = this.inv; return i.slot === 2 ? i.melee : i.w[i.slot]; }
  speed() {
    let s = 4.3; if (this.crouch) s = 2.4; else if (this.sprinting) s = 6.1; if (this.healT > 0) s = Math.min(s, 2.2);
    if (this.boost > 0) s *= 1.08; if (this.ads) s *= 0.7; return s;
  }
  move(mx, my, dt) {
    const sp = this.speed(); this.x += mx * sp * dt; this.y += my * sp * dt;
    collideCircle(G.world, this, this.r);
    this.x = clamp(this.x, 0.6, G.world.N - 0.6); this.y = clamp(this.y, 0.6, G.world.N - 0.6);
    const m = Math.min(1, Math.hypot(mx, my)); this.moveAmt = m;
    if (m > 0.05) { this.walkT += dt * sp * 1.6; this.stepT -= dt * sp; if (this.stepT <= 0) { this.stepT = 1.5; Audio.play('step', this.x, this.y, this.isPlayer ? 0.6 : 0.35); } }
  }
  setAim(a) { this.aim = a; this.aimScreen = worldDirToScreenAngle(Math.cos(a), Math.sin(a)); }
  update(dt) {
    this.fireCd -= dt; this.hitT -= dt; this.flashT -= dt; this.swingT -= dt; this.recoil = Math.max(0, this.recoil - dt * 6);
    this.spread = Math.max(0, this.spread - dt * 0.6);
    if (this.boost > 0) { this.boost = Math.max(0, this.boost - dt * 2.2); if (this.hp < 100) this.hp = Math.min(100, this.hp + dt * 1.2); }
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) this.finishReload(); }
    if (this.healT > 0) { this.healT -= dt; if (this.healT <= 0) this.finishHeal(); }
  }
  canAct() { return !this.dead && this.drop === 'ground' && !this.vehicle; }
  switchSlot(s) {
    const i = this.inv; if (s !== 2 && !i.w[s]) return; if (i.slot === s) return;
    i.slot = s; this.reloadT = 0; this.fireCd = Math.max(this.fireCd, 0.25); this.healT = 0; if (this.isPlayer) Audio.play('equip');
  }
  cycle(d) { const order = [0, 1, 2].filter((s) => s === 2 || this.inv.w[s]); const k = order.indexOf(this.inv.slot); this.switchSlot(order[(k + d + order.length) % order.length]); }
  startReload() {
    const w = this.curWeapon(); if (!w || w.id === 'wrench' || this.reloadT > 0) return false;
    const d = WEAPONS[w.id]; if (w.mag >= d.mag || this.inv.ammo[d.ammo] <= 0) return false;
    this.reloadT = d.reload; this.healT = 0; Audio.play('reload', this.x, this.y, 0.8); return true;
  }
  finishReload() {
    const w = this.curWeapon(); if (!w || w.id === 'wrench') return; const d = WEAPONS[w.id];
    const need = d.mag - w.mag, take = Math.min(need, this.inv.ammo[d.ammo]); w.mag += take; this.inv.ammo[d.ammo] -= take;
  }
  startHeal(id) {
    if (this.healT > 0 || this.inv.heals[id] <= 0) return false; const h = HEALS[id];
    if (h.cap && this.hp >= h.cap) { if (this.isPlayer) G.toast(id === 'bandage' ? 'Bandages only heal up to 75 HP' : 'Already at full health'); return false; }
    if (h.boost && this.boost > 80) return false;
    this.healT = h.time; this.healId = id; this.reloadT = 0; return true;
  }
  finishHeal() {
    const h = HEALS[this.healId]; this.inv.heals[this.healId]--;
    if (h.heal) this.hp = Math.min(h.cap, this.hp + h.heal); if (h.boost) this.boost = Math.min(100, this.boost + h.boost);
    Audio.play(this.healId === 'soda' ? 'soda' : 'heal', this.x, this.y, 0.8); G.fx.burst(this.x, this.y, '#7dff9a', 10, 30);
  }
}

// ---------- inventory rules ----------
export const ammoCap = (h, a) => Math.round(AMMO_CAP[a] * (1 + 0.5 * h.inv.pack));
export const healCap = (h, id) => HEALS[id].max + h.inv.pack * (id === 'bandage' ? 3 : 1);
export const grenadeCap = (h) => GRENADE_MAX + h.inv.pack;
export function weaponScore(w) { if (!w) return 0; return ({ pistol: 2, smg: 5, shotgun: 5, rifle: 7, sniper: 6 }[w.id] || 0) * (1 + w.rar * 0.15); }
// Try to give item to human. Returns { taken:boolean, leftover:item|null }
export function giveItem(h, it, manual = true) {
  const inv = h.inv;
  switch (it.t) {
    case 'weapon': {
      if (inv.w.some((w) => w && w.id === it.id && w.rar >= it.rar) && !manual) return { taken: false };
      const empty = inv.w.indexOf(null);
      if (empty >= 0) { inv.w[empty] = it; if (inv.slot === 2) h.switchSlot(empty); return { taken: true }; }
      if (!manual) { // bots: replace the weakest if better
        const wi = weaponScore(inv.w[0]) < weaponScore(inv.w[1]) ? 0 : 1;
        if (weaponScore(it) <= weaponScore(inv.w[wi])) return { taken: false };
        const old = inv.w[wi]; inv.w[wi] = it; return { taken: true, leftover: old };
      }
      const s = inv.slot === 2 ? 0 : inv.slot; const old = inv.w[s]; inv.w[s] = it; h.reloadT = 0; return { taken: true, leftover: old };
    }
    case 'ammo': { const cap = ammoCap(h, it.id), n = Math.min(it.n, cap - inv.ammo[it.id]); if (n <= 0) return { taken: false }; inv.ammo[it.id] += n; return { taken: true, leftover: n < it.n ? { ...it, n: it.n - n } : null }; }
    case 'heal': { const cap = healCap(h, it.id), n = Math.min(it.n, cap - inv.heals[it.id]); if (n <= 0) return { taken: false }; inv.heals[it.id] += n; return { taken: true, leftover: n < it.n ? { ...it, n: it.n - n } : null }; }
    case 'grenade': { const n = Math.min(it.n, grenadeCap(h) - inv.grenades); if (n <= 0) return { taken: false }; inv.grenades += n; return { taken: true, leftover: n < it.n ? { ...it, n: it.n - n } : null }; }
    case 'helmet': case 'vest': {
      const cur = inv[it.t]; const better = !cur || it.lvl > cur.lvl || (it.lvl === cur.lvl && it.dur > cur.dur + 10);
      if (!better && !manual) return { taken: false }; if (!better && cur && manual && it.lvl < cur.lvl) return { taken: false };
      inv[it.t] = { lvl: it.lvl, dur: it.dur }; return { taken: true, leftover: cur ? { t: it.t, lvl: cur.lvl, dur: cur.dur } : null };
    }
    case 'pack': { if (it.lvl <= inv.pack) return { taken: false }; const old = inv.pack; inv.pack = it.lvl; return { taken: true, leftover: old ? { t: 'pack', lvl: old } : null }; }
  }
  return { taken: false };
}
// everything a human carries, as items (for death crates)
export function dumpInventory(h) {
  const inv = h.inv, out = [];
  for (const w of inv.w) if (w) out.push(w);
  for (const a in inv.ammo) if (inv.ammo[a] > 0) out.push({ t: 'ammo', id: a, n: inv.ammo[a] });
  for (const k in inv.heals) if (inv.heals[k] > 0) out.push({ t: 'heal', id: k, n: inv.heals[k] });
  if (inv.grenades) out.push({ t: 'grenade', n: inv.grenades });
  if (inv.helmet && inv.helmet.dur > 0) out.push({ t: 'helmet', ...inv.helmet });
  if (inv.vest && inv.vest.dur > 0) out.push({ t: 'vest', ...inv.vest });
  if (inv.pack) out.push({ t: 'pack', lvl: inv.pack });
  return out;
}

// ---------- world props ----------
export function makeContainer(ck, x, y, items, extra = {}) {
  const c = { id: uid(), kind: 'container', ck, x, y, items, opened: false, r: ck === 'box' ? 0.34 : ck === 'airdrop' ? 0.55 : ck === 'deathbox' ? 0.3 : 0.42, hp: ck === 'box' ? 30 : 9999, z: 0, ...extra };
  G.containers.push(c); return c;
}
export function makePickup(item, x, y) {
  // keep off walls
  if (isSolid(G.world, x, y)) { for (let i = 0; i < 8; i++) { const a = i * 0.8, nx = x + Math.cos(a) * 0.6, ny = y + Math.sin(a) * 0.6; if (!isSolid(G.world, nx, ny)) { x = nx; y = ny; break; } } }
  const p = { id: uid(), kind: 'pickup', item, x, y, t: Math.random() * 6, cool: 0 }; G.pickups.push(p); return p;
}

// ---------- creatures ----------
export class Creature {
  constructor(type, x, y, den) {
    this.id = uid(); this.kind = 'creature'; this.type = type; this.def = CREATURES[type]; this.x = x; this.y = y; this.z = this.def.fly ? rand(70, 120) : 0;
    this.r = this.def.r; this.hp = this.def.hp; this.home = { x, y }; this.den = den; this.state = 'idle'; this.target = null; this.cd = 0; this.animT = 0; this.faceX = 1;
    this.hitT = 0; this.thinkT = Math.random(); this.goal = null; this.stuckT = 0; this.chargeT = 0; this.chargeCd = 2; this.soundT = rand(2, 6); this.circA = Math.random() * 6;
  }
  update(dt) {
    const d = this.def; this.cd -= dt; this.hitT -= dt; this.thinkT -= dt; this.soundT -= dt; this.chargeCd -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.4 + Math.random() * 0.3; this.think(); }
    let tx = this.x, ty = this.y, sp = d.speed;
    if (this.state === 'chase' && this.target) {
      const t = this.target; tx = t.x; ty = t.y; const dd = Math.hypot(tx - this.x, ty - this.y);
      if (this.type === 'hog') {
        if (this.chargeT > 0) { this.chargeT -= dt; sp *= 2.6; tx = this.x + this.cdx; ty = this.y + this.cdy; }
        else if (this.chargeCd <= 0 && dd < 7 && dd > 2) { this.chargeT = 1.1; this.chargeCd = 4.5; const l = dd || 1; this.cdx = (t.x - this.x) / l * 10; this.cdy = (t.y - this.y) / l * 10; Audio.play('grunt', this.x, this.y); }
      }
      if (d.fly) { // dive bomb cycle
        const want = this.cd > 0 ? 110 : Math.max(8, dd * 12);
        this.z += (want - this.z) * Math.min(1, dt * 3);
        if (this.cd > 0) { this.circA += dt * 2.2; tx = t.x + Math.cos(this.circA) * 5; ty = t.y + Math.sin(this.circA) * 5; }
      }
      const reach = d.reach + (t.r || 0.35);
      if (dd < reach && this.cd <= 0 && (!d.fly || this.z < 30)) {
        this.cd = d.cd; G.combat.damage(t, this.chargeT > 0 ? d.dmg * 1.6 : d.dmg, this, { melee: true });
        if (this.chargeT > 0) { this.chargeT = 0; const l = dd || 1; t.x += (t.x - this.x) / l * 1.2; t.y += (t.y - this.y) / l * 1.2; collideCircle(G.world, t, t.r); }
        Audio.play({ dog: 'bark', rat: 'squeak', crow: 'caw', hog: 'grunt' }[this.type], this.x, this.y, 0.8);
      }
      if (dd < reach * 0.8 && !d.fly) sp = 0;
    } else if (this.goal) { tx = this.goal.x; ty = this.goal.y; sp *= 0.35; if (d.fly) { this.circA += dt * 0.8; tx = this.home.x + Math.cos(this.circA) * 6; ty = this.home.y + Math.sin(this.circA) * 6; sp = d.speed * 0.6; } }
    const dx = tx - this.x, dy = ty - this.y, l = Math.hypot(dx, dy);
    if (l > 0.1 && sp > 0) {
      const px = this.x, py = this.y; const s = Math.min(l, sp * dt);
      this.x += dx / l * s; this.y += dy / l * s; if (!d.fly) collideCircle(G.world, this, this.r);
      this.x = clamp(this.x, 0.6, G.world.N - 0.6); this.y = clamp(this.y, 0.6, G.world.N - 0.6);
      const moved = Math.hypot(this.x - px, this.y - py); this.animT += moved * 3.2;
      const sxd = (dx - dy); if (Math.abs(sxd) > 0.05) this.faceX = sxd > 0 ? 1 : -1;
      if (moved < s * 0.3) { this.stuckT += dt; if (this.stuckT > 0.8) { this.stuckT = 0; this.goal = { x: this.x + rand(-4, 4), y: this.y + rand(-4, 4) }; if (this.state === 'chase') { this.state = 'wander'; this.thinkT = 1.2; } } }
      else this.stuckT = 0;
    } else if (this.goal && l <= 0.1) this.goal = null;
    if (this.soundT <= 0) { this.soundT = rand(3, 8); if (this.state === 'chase' || Math.random() < 0.4) Audio.play({ dog: 'growl', rat: 'squeak', crow: 'caw', hog: 'grunt' }[this.type], this.x, this.y, 0.5); }
  }
  think() {
    const d = this.def;
    if (this.state === 'chase') {
      const t = this.target;
      if (!t || t.dead || t.vehicle || t.drop !== 'ground' || Math.hypot(t.x - this.x, t.y - this.y) > d.aggro * 2.2 || Math.hypot(this.x - this.home.x, this.y - this.home.y) > 26) { this.state = 'return'; this.target = null; this.goal = { ...this.home }; }
      return;
    }
    // look for prey
    let best = null, bd = d.aggro;
    for (const h of G.humans) {
      if (h.dead || h.vehicle || h.drop !== 'ground') continue;
      const r = h.crouch ? d.aggro * 0.6 : d.aggro; const dd = Math.hypot(h.x - this.x, h.y - this.y);
      if (dd < Math.min(bd, r) && (d.fly || lineOfSight(G.world, this.x, this.y, h.x, h.y))) { best = h; bd = dd; }
    }
    if (best) { this.state = 'chase'; this.target = best; if (this.type === 'dog') Audio.play('bark', this.x, this.y); return; }
    if (this.state === 'return' && Math.hypot(this.x - this.home.x, this.y - this.home.y) > 2) { this.goal = { ...this.home }; return; }
    this.state = 'wander';
    if (!this.goal && Math.random() < 0.35) this.goal = { x: this.home.x + rand(-5, 5), y: this.home.y + rand(-5, 5) };
  }
  aggroOn(src) { if (src && src.kind === 'human' && !src.dead) { this.state = 'chase'; this.target = src; } }
}

// ---------- vehicles ----------
export class Vehicle {
  constructor(type, x, y, a) {
    this.id = uid(); this.kind = 'vehicle'; this.type = type; this.def = VEHICLES[type]; this.x = x; this.y = y; this.angle = a; this.speed = 0;
    this.vx = 0; this.vy = 0; this.hp = this.def.hp; this.r = this.def.r; this.driver = null; this.hitT = 0; this.skidT = 0; this.dead = false; this.hornCd = 0;
  }
  // ix,iy: desired world direction (or 0), brake: bool
  drive(ix, iy, brake, dt) {
    const D = this.def, il = Math.hypot(ix, iy);
    if (il > 0.1) {
      const ta = Math.atan2(iy, ix), diff = angDiff(this.angle, ta);
      if (Math.abs(diff) > 2.3 && this.speed < 1.5) { // reverse
        this.speed = Math.max(-D.maxSpeed * 0.4, this.speed - D.accel * dt);
        const rd = angDiff(this.angle + Math.PI, ta); this.angle -= clamp(rd, -1, 1) * D.turn * dt * Math.min(1, Math.abs(this.speed) / 3);
      } else {
        const thr = il * Math.max(0.2, Math.cos(Math.min(Math.abs(diff), 1.5)));
        this.speed = Math.min(D.maxSpeed * il, this.speed + D.accel * thr * dt);
        this.angle += clamp(diff * 2.5, -1, 1) * D.turn * dt * Math.min(1, Math.abs(this.speed) / 3.5 + 0.15);
      }
    } else this.speed *= Math.pow(0.35, dt);
    if (brake) this.speed *= Math.pow(0.05, dt);
  }
  update(dt) {
    this.hitT -= dt; this.hornCd -= dt;
    const D = this.def, hx = Math.cos(this.angle), hy = Math.sin(this.angle);
    if (!this.driver) this.speed *= Math.pow(0.3, dt);
    const tvx = hx * this.speed, tvy = hy * this.speed, k = Math.min(1, D.grip * dt);
    this.vx += (tvx - this.vx) * k; this.vy += (tvy - this.vy) * k;
    const slip = Math.abs(this.vx * -hy + this.vy * hx);
    const px = this.x, py = this.y; this.x += this.vx * dt; this.y += this.vy * dt;
    const hit = collideCircle(G.world, this, this.r);
    this.x = clamp(this.x, 1, G.world.N - 1); this.y = clamp(this.y, 1, G.world.N - 1);
    if (hit) {
      const sp = Math.abs(this.speed);
      if (sp > 6) { G.combat.damageVehicle(this, sp * 2.5, null); Audio.play('crash', this.x, this.y, Math.min(1, sp / 12)); G.cam.shake = Math.max(G.cam.shake, this.driver && this.driver.isPlayer ? sp * 0.6 : 0); G.fx.burst(this.x, this.y, '#c9b48a', 8, 40); }
      this.speed *= -0.25; this.vx = (this.x - px) / dt * 0.3; this.vy = (this.y - py) / dt * 0.3;
    }
    if (Math.abs(this.speed) > 3 && G.frame % 3 === 0) G.fx.dust(this.x - hx * 0.8, this.y - hy * 0.8, Math.abs(this.speed) / D.maxSpeed);
    if (slip > 2.5) { this.skidT += dt; if (G.frame % 2 === 0) G.decal('skid', this.x - hx * 0.6, this.y - hy * 0.6, this.angle); }
    if (this.hp < D.hp * 0.3 && G.frame % 6 === 0) G.fx.smoke(this.x + hx * 0.6, this.y + hy * 0.6);
    if (this.driver) { this.driver.x = this.x; this.driver.y = this.y; }
  }
}
