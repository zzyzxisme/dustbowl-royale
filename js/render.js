// Isometric renderer: cached ground chunks, depth-sorted sprites, roofs, storm, particles, atmosphere.
import { G } from './state.js';
import { N, GR } from './world.js';
import { isoX, isoY, fromIso, HALF_W, HALF_H, mulberry32, clamp, lerp, shade, rand } from './util.js';
import { sprite, drawSprite, paintObject, paintContainer, paintTumbleweed, drawHuman, drawCreature, drawVehicle, drawBlimp, drawIcon, ell, WALL_H, OL } from './art.js';
import { Input } from './input.js';

export const R = { cv: null, ctx: null, W: 0, H: 0, scale: 1, zoom: 1, baseZoom: 1, chunks: new Map(), vign: null };
const C = 8; // chunk size in tiles
const OBJ_H = { wall: 62, trailer: 70, pump: 50, sign: 120, pillar: 100, slab: 50, rubble: 30, rock: 30, sandbag: 30, tower: 120, scarecrow: 80, hay: 36, radio: 225, fuselage: 110, wing: 30, fence: 45, carstackX: 75, carstackY: 75, junk: 60, deadtree: 100, cactus: 62, tyres: 36, carX: 56, carY: 56 };
const GROUND = {
  [GR.SAND]: ['#d9b77e', '#d4b078', '#dcbb84'], [GR.ROAD]: ['#5b5550', '#57514c', '#605a54'], [GR.GRASS]: ['#b8b06a', '#aea866', '#c0b672'],
  [GR.MUD]: ['#c9a87c', '#c4a276', '#cfae82'], [GR.FARM]: ['#a7834f', '#9f7c4a', '#ad8954'], [GR.FLOOR]: ['#a8784a', '#a37446', '#ad7d4e'],
  [GR.CONCRETE]: ['#a9a397', '#a49e92', '#aea89c'], [GR.GOO]: ['#7ed957', '#74cf50', '#86e05e'], [GR.GRAVEL]: ['#9b8f7d', '#958a78', '#a19583'], [GR.LINE]: ['#5b5550', '#5b5550', '#5b5550'],
};

export function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), q = G.settings.quality, res = q === 'low' ? 0.6 : q === 'medium' ? 0.85 : 1;
  R.scale = Math.max(0.75, dpr * res); R.W = innerWidth; R.H = innerHeight;
  R.cv.width = Math.round(R.W * R.scale); R.cv.height = Math.round(R.H * R.scale);
  R.baseZoom = clamp(Math.min(R.W / (20 * 64), R.H / (18 * 32)) * 1.05, 0.55, 1.5);
  R.chunks.clear(); R.vign = null;
}
export function init(cv) { R.cv = cv; R.ctx = cv.getContext('2d'); resize(); G.screenToWorld = screenToWorld; }
export function screenToWorld(sx, sy) {
  const ix = (sx - R.W / 2) / R.zoom + isoX(G.cam.x, G.cam.y), iy = (sy - R.H / 2) / R.zoom + isoY(G.cam.x, G.cam.y);
  return fromIso(ix, iy);
}
const q = (s) => Math.max(0.5, Math.round(s * 4) / 4);

// ---------------- ground ----------------
function paintChunk(cx, cy, s) {
  const W = G.world, x0 = cx * C, y0 = cy * C, pad = 8;
  const ox = (x0 - y0 - C) * HALF_W - pad, oy = (x0 + y0) * HALF_H - pad;
  const cv = document.createElement('canvas'); cv.width = Math.ceil((C * 64 + pad * 2) * s); cv.height = Math.ceil((C * 32 + pad * 2) * s);
  const c = cv.getContext('2d'); c.scale(s, s); c.translate(-ox, -oy);
  for (let ty = y0; ty < y0 + C; ty++) for (let tx = x0; tx < x0 + C; tx++) {
    if (tx >= N || ty >= N) continue;
    const g = W.ground[ty * N + tx], rng = mulberry32(tx * 7919 + ty * 104729), cols = GROUND[g];
    const X = isoX(tx, ty), Y = isoY(tx, ty);
    c.beginPath(); c.moveTo(X, Y - 0.6); c.lineTo(X + HALF_W + 0.8, Y + HALF_H); c.lineTo(X, Y + 2 * HALF_H + 0.6); c.lineTo(X - HALF_W - 0.8, Y + HALF_H); c.closePath();
    c.fillStyle = cols[Math.floor(rng() * 3)]; c.fill();
    const pt = (u, v) => [X + (u - v) * HALF_W, Y + (u + v) * HALF_H];
    c.lineCap = 'round';
    if (g === GR.SAND || g === GR.GRAVEL) { const n = g === GR.GRAVEL ? 7 : 2; for (let i = 0; i < n; i++) { const [px, py] = pt(rng(), rng()); c.fillStyle = rng() < 0.5 ? 'rgba(120,90,50,0.35)' : 'rgba(255,240,200,0.35)'; c.beginPath(); c.ellipse(px, py, 1.5 + rng() * 2, 1 + rng(), 0, 0, 7); c.fill(); }
      if (rng() < 0.08) { c.strokeStyle = 'rgba(120,85,45,0.35)'; c.lineWidth = 1.2; c.beginPath(); let [px, py] = pt(rng(), rng()); c.moveTo(px, py); for (let k = 0; k < 3; k++) { px += rng() * 14 - 7; py += rng() * 8 - 4; c.lineTo(px, py); } c.stroke(); } }
    else if (g === GR.GRASS) { c.strokeStyle = 'rgba(110,105,40,0.6)'; c.lineWidth = 1.3; for (let i = 0; i < 4; i++) { const [px, py] = pt(rng(), rng()); c.beginPath(); c.moveTo(px, py); c.lineTo(px - 2, py - 5); c.moveTo(px, py); c.lineTo(px + 2, py - 6); c.stroke(); } }
    else if (g === GR.ROAD || g === GR.LINE) { if (rng() < 0.25) { c.strokeStyle = 'rgba(30,28,26,0.5)'; c.lineWidth = 1; c.beginPath(); let [px, py] = pt(rng(), rng()); c.moveTo(px, py); for (let k = 0; k < 3; k++) { px += rng() * 12 - 6; py += rng() * 6 - 3; c.lineTo(px, py); } c.stroke(); } if (g === GR.LINE) { c.strokeStyle = '#e8c547'; c.lineWidth = 3; c.beginPath(); c.moveTo(...pt(0.1, 0.5)); c.lineTo(...pt(0.9, 0.5)); c.stroke(); } }
    else if (g === GR.MUD) { c.strokeStyle = 'rgba(130,95,60,0.55)'; c.lineWidth = 1.2; c.beginPath(); const a = pt(rng() * 0.3, rng()), b = pt(0.5, 0.5), d = pt(1, rng()), e = pt(rng(), 1); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.moveTo(...b); c.lineTo(...e); c.stroke(); }
    else if (g === GR.FARM) { c.strokeStyle = 'rgba(90,65,35,0.5)'; c.lineWidth = 2; for (const v of [0.25, 0.75]) { c.beginPath(); c.moveTo(...pt(0, v)); c.lineTo(...pt(1, v)); c.stroke(); } if (rng() < 0.3) { c.fillStyle = '#8a9a4a'; const [px, py] = pt(rng(), 0.25); c.beginPath(); c.ellipse(px, py - 2, 3, 2, 0, 0, 7); c.fill(); } }
    else if (g === GR.FLOOR) { c.strokeStyle = 'rgba(80,50,25,0.45)'; c.lineWidth = 1; for (const v of [0.33, 0.66]) { c.beginPath(); c.moveTo(...pt(0, v)); c.lineTo(...pt(1, v)); c.stroke(); } }
    else if (g === GR.CONCRETE) { c.strokeStyle = 'rgba(90,85,78,0.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(...pt(0, 0)); c.lineTo(...pt(1, 0)); c.moveTo(...pt(0, 0)); c.lineTo(...pt(0, 1)); c.stroke(); if (rng() < 0.15) { c.fillStyle = 'rgba(60,50,40,0.25)'; const [px, py] = pt(rng(), rng()); c.beginPath(); c.ellipse(px, py, 6, 3, 0, 0, 7); c.fill(); } }
    else if (g === GR.GOO) { c.fillStyle = 'rgba(220,255,150,0.6)'; for (let i = 0; i < 2; i++) { const [px, py] = pt(rng() * 0.8 + 0.1, rng() * 0.8 + 0.1); c.beginPath(); c.ellipse(px, py, 2.5, 1.5, 0, 0, 7); c.fill(); } }
  }
  return { cv, ox, oy, s };
}
function drawGround(ctx, vx0, vy0, vx1, vy1) {
  const s = q(R.scale * R.zoom > 1.5 ? 1.5 : R.scale * R.zoom);
  // world-space bounds of the view
  const corners = [fromIso(vx0, vy0), fromIso(vx1, vy0), fromIso(vx0, vy1), fromIso(vx1, vy1)];
  const minX = Math.min(...corners.map((p) => p.x)), maxX = Math.max(...corners.map((p) => p.x)), minY = Math.min(...corners.map((p) => p.y)), maxY = Math.max(...corners.map((p) => p.y));
  const nc = Math.ceil(N / C);
  for (let cy = Math.max(0, Math.floor(minY / C) - 1); cy <= Math.min(nc - 1, Math.floor(maxY / C) + 1); cy++)
    for (let cx = Math.max(0, Math.floor(minX / C) - 1); cx <= Math.min(nc - 1, Math.floor(maxX / C) + 1); cx++) {
      const x0 = cx * C, y0 = cy * C, top = (x0 + y0) * HALF_H, bot = top + C * 32, left = (x0 - y0 - C) * HALF_W, right = left + C * 64;
      if (bot < vy0 || top > vy1 || right < vx0 || left > vx1) continue;
      const k = cx + ',' + cy; let ch = R.chunks.get(k);
      if (!ch || ch.s !== s) { ch = paintChunk(cx, cy, s); R.chunks.set(k, ch); if (R.chunks.size > 40) R.chunks.delete(R.chunks.keys().next().value); }
      ctx.drawImage(ch.cv, ch.ox, ch.oy, ch.cv.width / s, ch.cv.height / s);
    }
}

// ---------------- main draw ----------------
export function draw(dt) {
  const ctx = R.ctx, p = G.player, t = G.time;
  // camera
  let fx = p.x, fy = p.y, zoomT = R.baseZoom;
  if (p.drop === 'blimp' || p.drop === 'fall') zoomT *= p.drop === 'blimp' ? 0.62 : 0.75;
  if (p.vehicle) { fx += p.vehicle.vx * 0.25; fy += p.vehicle.vy * 0.25; zoomT *= 0.85; }
  const w = p.curWeapon();
  if (p.ads && w && w.id === 'sniper') zoomT *= 0.72; else if (p.ads) zoomT *= 0.9;
  if (G.state === 'dead' && G.killer && !G.killer.dead) { fx = G.killer.x; fy = G.killer.y; }
  if (!p.vehicle && p.drop === 'ground' && G.aimPoint && !p.dead) { const lead = p.ads ? (w && w.id === 'sniper' ? 0.55 : 0.35) : 0.18; fx += (G.aimPoint.x - p.x) * lead; fy += (G.aimPoint.y - p.y) * lead; }
  const cam = G.cam, k = 1 - Math.pow(0.0005, dt);
  if (G.state === 'menu') zoomT = R.baseZoom * 0.85;
  else { cam.x = lerp(cam.x, fx, k * (p.drop === 'ground' ? 1 : 3)); cam.y = lerp(cam.y, fy, k * (p.drop === 'ground' ? 1 : 3)); }
  R.zoom = lerp(R.zoom, zoomT, 1 - Math.pow(0.02, dt));
  cam.shake = Math.max(0, cam.shake - dt * 30);
  const sh = G.settings.shake ? cam.shake : 0, shx = rand(-sh, sh), shy = rand(-sh, sh);
  const z = R.zoom, S = R.scale, cix = isoX(cam.x, cam.y), ciy = isoY(cam.x, cam.y);
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.fillStyle = '#4a3a28'; ctx.fillRect(0, 0, R.W, R.H);
  ctx.setTransform(S * z, 0, 0, S * z, S * (R.W / 2 - cix * z + shx), S * (R.H / 2 - ciy * z + shy));
  const vx0 = cix - R.W / 2 / z - 40, vx1 = cix + R.W / 2 / z + 40, vy0 = ciy - R.H / 2 / z - 40, vy1 = ciy + R.H / 2 / z + 260;
  // map edge
  ctx.beginPath(); ctx.moveTo(isoX(0, 0), isoY(0, 0)); ctx.lineTo(isoX(N, 0), isoY(N, 0)); ctx.lineTo(isoX(N, N), isoY(N, N) + 26); ctx.lineTo(isoX(0, N), isoY(0, N)); ctx.closePath();
  ctx.fillStyle = '#6b5235'; ctx.fill();
  drawGround(ctx, vx0, vy0, vx1, vy1);
  // goo shimmer
  // decals
  for (const d of G.decals) {
    const X = isoX(d.x, d.y), Y = isoY(d.x, d.y); if (X < vx0 || X > vx1 || Y < vy0 || Y > vy1) continue;
    const a = 1 - d.t / d.life; ctx.globalAlpha = Math.min(1, a * 2) * (d.type === 'skid' ? 0.35 : 0.6);
    if (d.type === 'skid') { ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.ellipse(X, Y, 7, 3.5, 0, 0, 7); ctx.fill(); }
    else if (d.type === 'scorch') { ctx.fillStyle = '#2a2018'; ctx.beginPath(); ctx.ellipse(X, Y, 44 * d.s, 22 * d.s, 0, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = '#c94f3c'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(X + Math.cos(d.a + i * 1.7) * 9, Y + Math.sin(d.a + i * 1.7) * 4, 7, 3.5, 0, 0, 7); ctx.fill(); } }
  }
  ctx.globalAlpha = 1;
  // collect drawables
  const s = q(S * z), list = [], top = [];
  const vis = (x, y, m = 120) => { const X = isoX(x, y), Y = isoY(x, y); return X > vx0 - m && X < vx1 + m && Y > vy0 - m && Y < vy1 + m * 2; };
  const pd = p.x + p.y, psx = isoX(p.x, p.y), psy = isoY(p.x, p.y);
  for (const o of G.world.objects) {
    if (!vis(o.x, o.y, 160)) continue;
    const H = OBJ_H[o.type] || 60, ww = (o.w + o.h) * 32 + 64, ay = H + (o.w + o.h) * 8 + 16;
    const key = o.type + o.v + (o.win ? 'w' : '') + (o.style || '');
    const X = isoX(o.x, o.y), Y = isoY(o.x, o.y);
    let alpha = 1;
    if (o.tall && !p.dead && o.x + o.y > pd + 0.2 && Math.abs(X - psx) < (o.w + o.h) * 32 + 10 && psy < Y + 6 && psy > Y - H - (o.w + o.h) * 16 - 10) alpha = 0.38;
    list.push({ d: o.x + o.y, f: () => { const sp = sprite(key, s, ww, ay + (o.w + o.h) * 8 + 16, ww / 2, ay, (c) => paintObject(c, o)); if (alpha < 1) ctx.globalAlpha = alpha; drawSprite(ctx, sp, X, Y); ctx.globalAlpha = 1; } });
  }
  for (const c of G.containers) {
    if (!vis(c.x, c.y)) continue; const X = isoX(c.x, c.y), Y = isoY(c.x, c.y);
    const fn = () => {
      const zz = c.z || 0;
      if (zz > 0) { ell(ctx, X, Y, 26, 11, 'rgba(0,0,0,0.25)', null); drawChute(ctx, X, Y - zz - 36, t); }
      const sp = sprite('c' + c.ck + (c.opened ? 'o' : ''), s, 100, 100, 50, 70, (cc) => paintContainer(cc, c.ck, c.opened)); drawSprite(ctx, sp, X, Y - zz);
      if (c.ck === 'airdrop' || c.ck === 'premium' || (c.ck === 'crate' && !c.opened)) { ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.1; ell(ctx, X, Y - zz - 14, 34, 22, c.ck === 'crate' ? '#f2c14e' : '#7fd3ff', null); ctx.globalAlpha = 1; }
      if (c.ck === 'deathbox' && dist2p(c) < 30) label(ctx, X, Y - 44, c.name, '#ffe9c0');
    };
    if (c.z > 0) top.push(fn); else list.push({ d: c.x + c.y, f: fn });
  }
  for (const b of G.barrels) { if (!vis(b.x, b.y)) continue; const X = isoX(b.x, b.y), Y = isoY(b.x, b.y); list.push({ d: b.x + b.y, f: () => drawSprite(ctx, sprite('barrel', s, 50, 60, 25, 45, (cc) => paintContainer(cc, 'barrel')), X, Y) }); }
  for (const pk of G.pickups) {
    if (!vis(pk.x, pk.y)) continue; const X = isoX(pk.x, pk.y), Y = isoY(pk.x, pk.y), it = pk.item;
    list.push({ d: pk.x + pk.y - 0.3, f: () => {
      const bob = Math.sin(pk.t * 3) * 3; ctx.globalAlpha = 0.35; ell(ctx, X, Y, 16, 7, it.t === 'weapon' ? ['#fff', '#6fd35b', '#b06cff'][it.rar] : '#fff3c0', null); ctx.globalAlpha = 1;
      const key = 'i' + it.t + (it.id || '') + (it.lvl || '') + (it.rar ?? '');
      drawSprite(ctx, sprite(key, s, 60, 60, 30, 30, (cc) => { cc.scale(0.62, 0.62); drawIcon(cc, it); }), X, Y - 14 + bob);
    } });
  }
  for (const tw of G.tumble) { if (!vis(tw.x, tw.y)) continue; const X = isoX(tw.x, tw.y), Y = isoY(tw.x, tw.y); list.push({ d: tw.x + tw.y, f: () => { ell(ctx, X, Y, 9, 4, 'rgba(0,0,0,0.18)', null); ctx.save(); ctx.translate(X, Y - 11 - Math.abs(Math.sin(tw.rot)) * 4); paintTumbleweed(ctx, tw.rot); ctx.restore(); } }); }
  const ents = [];
  for (const v of G.vehicles) { if (!vis(v.x, v.y)) continue; const X = isoX(v.x, v.y), Y = isoY(v.x, v.y); const f = () => drawVehicle(ctx, v, X, Y); list.push({ d: v.x + v.y, f }); ents.push({ x: v.x, y: v.y, f }); }
  for (const c of G.creatures) {
    if (!vis(c.x, c.y)) continue; const X = isoX(c.x, c.y), Y = isoY(c.x, c.y);
    const f = () => { drawCreature(ctx, c, X, Y, t); if (c.hp < c.def.hp) bar(ctx, X, Y - (c.def.fly ? c.z + 26 : c.type === 'hog' ? 80 : 40), c.hp / c.def.hp, '#ff6b5a'); };
    if (c.def.fly) top.push(f); else { list.push({ d: c.x + c.y, f }); ents.push({ x: c.x, y: c.y, f }); }
  }
  for (const h of G.humans) {
    if (h.dead || h.vehicle || h.drop === 'blimp' || !vis(h.x, h.y)) continue; const X = isoX(h.x, h.y), Y = isoY(h.x, h.y);
    const f = () => {
      drawHuman(ctx, h, X, Y, t);
      if (!h.isPlayer && h.drop === 'ground') { const d = Math.hypot(h.x - p.x, h.y - p.y); if (d < 9 || h.hitT > -2) { label(ctx, X, Y - 76, h.name, '#fff'); bar(ctx, X, Y - 70, h.hp / 100, h.hp > 50 ? '#7dff9a' : '#ffb05a'); } }
      if (h.healT > 0) { const hd = { bandage: 2.5, medkit: 5, soda: 1.4 }[h.healId]; ring(ctx, X, Y - 90, 1 - h.healT / hd, '#7dff9a'); }
      if (h.reloadT > 0 && h.isPlayer) { const wd = h.curWeapon(); ring(ctx, X, Y - 90, 1 - h.reloadT / ({ pistol: 1.2, smg: 1.9, shotgun: 2.4, rifle: 2.2, sniper: 2.8 }[wd.id] || 2), '#ffd35a'); }
    };
    if (h.drop === 'fall') top.push(f); else { list.push({ d: h.x + h.y + 0.01, f }); ents.push({ x: h.x, y: h.y, f }); }
  }
  list.sort((a, b) => a.d - b.d);
  for (const e of list) e.f();
  // roofs
  const pb = !p.dead && G.world.bld[Math.floor(p.y) * N + Math.floor(p.x)];
  for (const b of G.world.buildings) {
    if (!vis(b.x0 + b.w / 2, b.y0 + b.h / 2, 300)) continue;
    const inside = pb === b.id;
    const behind = !inside && p.x + p.y < b.x1 + b.y1 && p.x > b.x0 - 2 && p.y > b.y0 - 2 && p.x < b.x1 + 1 && p.y < b.y1 + 1;
    b.alpha = lerp(b.alpha ?? 1, inside ? 0 : behind ? 0.45 : 1, Math.min(1, dt * 8));
    if (b.alpha < 0.03) continue;
    ctx.globalAlpha = b.alpha; drawRoof(ctx, b, s); ctx.globalAlpha = 1;
    // re-draw entities standing in front of this building (so the roof doesn't cover them)
    if (b.alpha > 0.4) for (const e of ents) { if ((e.x >= b.x1 || e.y >= b.y1) && e.x > b.x0 - 1.5 && e.y > b.y0 - 1.5 && e.x < b.x1 + 2.5 && e.y < b.y1 + 2.5) e.f(); }
  }
  // bullets
  ctx.lineCap = 'round';
  for (const b of G.projectiles) {
    const X1 = isoX(b.px, b.py), Y1 = isoY(b.px, b.py) - 22, X2 = isoX(b.x, b.y), Y2 = isoY(b.x, b.y) - 22;
    ctx.strokeStyle = 'rgba(255,240,170,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X1, Y1); ctx.lineTo(X2, Y2); ctx.stroke();
    ctx.strokeStyle = '#fff6c8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(X1, Y1); ctx.lineTo(X2, Y2); ctx.stroke();
  }
  for (const g of G.grenades) { const X = isoX(g.x, g.y), Y = isoY(g.x, g.y); ell(ctx, X, Y, 6, 3, 'rgba(0,0,0,0.25)', null); ctx.save(); ctx.translate(X, Y - g.z - 6); ctx.rotate(g.rot); ell(ctx, 0, 0, 5, 6, '#8fe36b'); ctx.restore(); if (g.fuse < 1 && Math.sin(g.fuse * 30) > 0) ell(ctx, X, Y - g.z - 6, 9, 9, null, '#ff4a3a', 2); }
  // particles
  for (const pt of G.particles) {
    const X = isoX(pt.x, pt.y), Y = isoY(pt.x, pt.y) - pt.z, a = clamp(pt.life / pt.max, 0, 1);
    if (X < vx0 || X > vx1 || Y < vy0 - 200 || Y > vy1) continue;
    if (pt.type === 'text') { ctx.globalAlpha = Math.min(1, a * 2); ctx.font = `900 ${pt.size}px "Lilita One", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = OL; ctx.strokeText(pt.str, X, Y); ctx.fillStyle = pt.color; ctx.fillText(pt.str, X, Y); }
    else if (pt.type === 'ring') { ctx.globalAlpha = a; ctx.strokeStyle = pt.color; ctx.lineWidth = 4 * a + 1; const rr = (1 - a) * pt.size; ctx.beginPath(); ctx.ellipse(X, Y, rr * 45 + 5, rr * 22.6 + 2.5, 0, 0, 7); ctx.stroke(); }
    else if (pt.type === 'smoke') { ctx.globalAlpha = a * 0.9; ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(X, Y, pt.size * (1.6 - a * 0.6), 0, 7); ctx.fill(); }
    else if (pt.type === 'fire') { ctx.globalAlpha = a; ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(X, Y, pt.size * (0.4 + a * 0.6), 0, 7); ctx.fill(); }
    else { ctx.globalAlpha = a; ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(X, Y, pt.size, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  for (const f of top) f();
  // blimp
  const bl = G.blimp; if (bl.t < 1.15) { const X = isoX(bl.x, bl.y), Y = isoY(bl.x, bl.y); ctx.globalAlpha = 0.18; ell(ctx, X, Y, 110, 40, '#000', null); ctx.globalAlpha = 1; drawBlimp(ctx, X, Y - 330, bl.a, t); if (p.drop === 'blimp' && G.state !== 'menu') label(ctx, X, Y - 420, 'You are aboard — choose when to jump!', '#ffd35a', 16); }
  drawStorm(ctx, vx0, vy0, vx1, vy1, t);
  // screen-space overlays
  ctx.setTransform(S, 0, 0, S, 0, 0);
  atmosphere(ctx);
  if (G.inputMode === 'kbm' && G.state !== 'menu' && !G.paused && !p.dead && !G.mapOpen) crosshair(ctx);
}
function dist2p(c) { const p = G.player; return (c.x - p.x) ** 2 + (c.y - p.y) ** 2; }
function label(ctx, x, y, text, col, size = 12) { ctx.font = `800 ${size}px "Lilita One", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(30,20,10,0.85)'; ctx.strokeText(text, x, y); ctx.fillStyle = col; ctx.fillText(text, x, y); }
function bar(ctx, x, y, f, col) { ctx.fillStyle = 'rgba(30,20,10,0.8)'; ctx.fillRect(x - 17, y - 3, 34, 6); ctx.fillStyle = col; ctx.fillRect(x - 16, y - 2, 32 * clamp(f, 0, 1), 4); }
function ring(ctx, x, y, f, col) { ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,20,10,0.7)'; ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); }
function drawChute(ctx, x, y, t) { const sw = Math.sin(t * 2) * 4; ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 20, y + 30); ctx.lineTo(x - 40 + sw, y - 20); ctx.moveTo(x + 20, y + 30); ctx.lineTo(x + 40 + sw, y - 20); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 50 + sw, y - 18); ctx.quadraticCurveTo(x + sw, y - 70, x + 50 + sw, y - 18); ctx.quadraticCurveTo(x + sw, y - 30, x - 50 + sw, y - 18); ctx.fillStyle = '#e5533d'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke(); }
function drawRoof(ctx, b, s) {
  const o = 0.18, x0 = b.x0 - o, y0 = b.y0 - o, x1 = b.x1 + o, y1 = b.y1 + o, Z = WALL_H + 2, Zr = Z + Math.min(b.w, b.h) * 7;
  const P = (x, y, zz) => [isoX(x, y), isoY(x, y) - zz];
  const key = 'roof' + b.id, minX = isoX(x0, y1) - 10, maxX = isoX(x1, y0) + 10, minY = isoY(x0, y0) - Zr - 10, maxY = isoY(x1, y1) - Z + 30;
  const sp = sprite(key, s, maxX - minX, maxY - minY, -minX, -minY, (c) => {
    const col = b.roof, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, alongX = b.w >= b.h;
    const r1 = alongX ? [x0 + 0.8, my] : [mx, y0 + 0.8], r2 = alongX ? [x1 - 0.8, my] : [mx, y1 - 0.8];
    const face = (pts, cl) => { c.beginPath(); pts.forEach(([x, y, zz], i) => { const [X, Y] = P(x, y, zz); i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.fillStyle = cl; c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke(); };
    // hip roof: 4 faces
    const A = [x0, y0, Z], B = [x1, y0, Z], Cc = [x1, y1, Z], D = [x0, y1, Z], R1 = [...r1, Zr], R2 = [...r2, Zr];
    if (alongX) { face([A, B, R2, R1], shade(col, 0.12)); face([B, Cc, R2], shade(col, -0.3)); face([D, A, R1], shade(col, 0.05)); face([D, Cc, R2, R1], shade(col, -0.12)); }
    else { face([A, D, R2, R1], shade(col, 0.05)); face([A, B, R1], shade(col, 0.12)); face([B, Cc, R2, R1], shade(col, -0.3)); face([D, Cc, R2], shade(col, -0.12)); }
    // shingle lines
    c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 1.2;
    for (let i = 1; i < 4; i++) { const k = i / 4; const e1 = alongX ? [D, Cc] : [B, Cc]; const p1 = P(lerp(e1[0][0], R1[0], k * 0.98), lerp(e1[0][1], R1[1], k * 0.98), lerp(Z, Zr, k)), p2 = P(lerp(e1[1][0], R2[0], k * 0.98), lerp(e1[1][1], R2[1], k * 0.98), lerp(Z, Zr, k)); c.beginPath(); c.moveTo(...p1); c.lineTo(...p2); c.stroke(); }
    if (b.name) { const [X, Y] = P(mx, my, Zr); c.font = '800 13px "Lilita One", system-ui'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.strokeText(b.name.toUpperCase(), X, Y + 20); c.fillStyle = '#ffe9c0'; c.fillText(b.name.toUpperCase(), X, Y + 20); }
  });
  drawSprite(ctx, sp, 0, 0);
}
function drawStorm(ctx, vx0, vy0, vx1, vy1, t) {
  const st = G.storm; if (!st) return; const k = Math.SQRT2;
  const X = isoX(st.cx, st.cy), Y = isoY(st.cx, st.cy), rx = st.r * HALF_W * k, ry = st.r * HALF_H * k;
  ctx.beginPath(); ctx.rect(vx0 - 200, vy0 - 600, vx1 - vx0 + 400, vy1 - vy0 + 900); ctx.ellipse(X, Y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(130,160,60,0.32)'; ctx.fill('evenodd');
  ctx.lineWidth = 4 + Math.sin(t * 4) * 1.5; ctx.strokeStyle = 'rgba(190,255,110,0.85)'; ctx.beginPath(); ctx.ellipse(X, Y, Math.max(1, rx), Math.max(1, ry), 0, 0, 7); ctx.stroke();
  if (st.nr > 0 && st.phase < 5) { ctx.setLineDash([14, 10]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(isoX(st.ncx, st.ncy), isoY(st.ncx, st.ncy), st.nr * HALF_W * k, st.nr * HALF_H * k, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
}
function atmosphere(ctx) {
  const W = R.W, H = R.H;
  if (!R.vign) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const c = cv.getContext('2d'); const g = c.createRadialGradient(128, 128, 60, 128, 128, 182); g.addColorStop(0, 'rgba(40,20,5,0)'); g.addColorStop(1, 'rgba(40,20,5,0.55)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); R.vign = cv; }
  // dusk: warm tint grows over the match
  const dusk = clamp(G.time / 420, 0, 1) * 0.22;
  if (dusk > 0.01) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,${Math.round(190 - dusk * 200)},${Math.round(150 - dusk * 300)},${dusk + 0.05})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  const p = G.player, st = G.storm, out = st && Math.hypot(p.x - st.cx, p.y - st.cy) > st.r;
  if (out && p.drop === 'ground') { ctx.fillStyle = 'rgba(120,170,60,0.22)'; ctx.fillRect(0, 0, W, H); }
  ctx.drawImage(R.vign, 0, 0, W, H);
  if (G.stormHurt > 0 || (p.hp < 30 && !p.dead)) { ctx.fillStyle = `rgba(200,30,20,${G.stormHurt > 0 ? G.stormHurt * 0.3 : 0.08 + Math.sin(G.time * 5) * 0.05})`; ctx.fillRect(0, 0, W, H); }
}
function crosshair(ctx) {
  const x = Input.mouse.x, y = Input.mouse.y, p = G.player, w = p.curWeapon();
  const gap = 6 + (w && w.id !== 'wrench' ? (p.spread + 0.03) * 60 * (p.ads ? 0.5 : 1) : 4);
  const col = G.hitMarker > 0 ? '#ff5a4a' : '#fff';
  ctx.lineCap = 'round';
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + dx * gap, y + dy * gap); ctx.lineTo(x + dx * (gap + 7), y + dy * (gap + 7)); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
  if (G.hitMarker > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.beginPath(); ctx.moveTo(x + dx * 5, y + dy * 5); ctx.lineTo(x + dx * 11, y + dy * 11); ctx.stroke(); } }
}
