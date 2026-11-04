// Procedural cartoon art. Static sprites are painted once into cached canvases; characters/creatures/vehicles are drawn live.
import { shade, HALF_W, HALF_H } from './util.js';
import { RARITY } from './data.js';
export const OL = '#2a1a12';

// ---------- primitives ----------
export function ell(c, x, y, rx, ry, fill, stroke = OL, lw = 2) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); } }
export function poly(c, pts, fill, stroke = OL, lw = 2) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = lw; c.lineJoin = 'round'; c.strokeStyle = stroke; c.stroke(); } }
export function rrect(c, x, y, w, h, r, fill, stroke = OL, lw = 2) { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); } }
function line(c, x1, y1, x2, y2, col = OL, lw = 2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.stroke(); }
const P = (x, y, z = 0) => [(x - y) * HALF_W, (x + y) * HALF_H - z];

// axis-aligned iso box centered at origin: footprint w (x) by d (y) in tiles, from z0 to z1 px
export function isoBox(c, w, d, z0, z1, col, o = {}) {
  const hw = w / 2, hd = d / 2;
  const top = [...P(-hw, -hd, z1), ...P(hw, -hd, z1), ...P(hw, hd, z1), ...P(-hw, hd, z1)];
  const left = [...P(-hw, hd, z1), ...P(hw, hd, z1), ...P(hw, hd, z0), ...P(-hw, hd, z0)];
  const right = [...P(hw, hd, z1), ...P(hw, -hd, z1), ...P(hw, -hd, z0), ...P(hw, hd, z0)];
  poly(c, left, o.left || shade(col, -0.18)); poly(c, right, o.right || shade(col, -0.36)); poly(c, top, o.top || col);
  return { top, left, right };
}
// oriented box at origin with heading a (radians, world), length l (along heading), width w
export function orientedBox(c, a, l, w, z0, z1, col, topCol) {
  const ca = Math.cos(a), sa = Math.sin(a), hl = l / 2, hw = w / 2;
  const cs = [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([u, v]) => [u * ca - v * sa, u * sa + v * ca]);
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const p = cs[i], q = cs[(i + 1) % 4], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (mx + my > 0.001) faces.push([p, q, mx + my, (mx - my)]);
  }
  faces.sort((f, g) => f[2] - g[2]);
  for (const [p, q, , side] of faces) poly(c, [...P(p[0], p[1], z1), ...P(q[0], q[1], z1), ...P(q[0], q[1], z0), ...P(p[0], p[1], z0)], shade(col, side < 0 ? -0.15 : -0.35));
  poly(c, cs.flatMap(([x, y]) => P(x, y, z1)), topCol || col);
  return cs;
}

// ---------- sprite cache ----------
const cache = new Map();
export function sprite(key, scale, w, h, ax, ay, paint) {
  const k = key + '@' + scale; let s = cache.get(k);
  if (!s) {
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * scale); cv.height = Math.ceil(h * scale);
    const c = cv.getContext('2d'); c.scale(scale, scale); c.translate(ax, ay); c.lineCap = 'round'; c.lineJoin = 'round'; paint(c);
    s = { cv, w, h, ax, ay }; cache.set(k, s);
    if (cache.size > 900) cache.delete(cache.keys().next().value);
  }
  return s;
}
export function clearSpriteCache() { cache.clear(); }
export function drawSprite(ctx, s, x, y) { ctx.drawImage(s.cv, x - s.ax, y - s.ay, s.w, s.h); }

// ---------- static object painters (origin = footprint center on ground) ----------
const WALLS = [{ top: '#d8c3a5', face: '#e9dcc4', trim: '#8e6e4f' }, { top: '#a7a49a', face: '#c4c1b6', trim: '#6c6a62' }, { top: '#8d3a2c', face: '#b44a36', trim: '#e8dccb' }];
export const WALL_H = 46;
export function paintObject(c, o) {
  switch (o.type) {
    case 'wall': {
      const st = WALLS[o.style]; isoBox(c, 1, 1, 0, WALL_H, st.face, { top: st.top });
      if (o.style === 2) for (let i = 1; i < 4; i++) { line(c, ...P(-0.5, 0.5, i * 11), ...P(0.5, 0.5, i * 11), shade(st.face, -0.4), 1.2); line(c, ...P(0.5, 0.5, i * 11), ...P(0.5, -0.5, i * 11), shade(st.face, -0.5), 1.2); }
      line(c, ...P(-0.5, 0.5, 6), ...P(0.5, 0.5, 6), st.trim, 3); line(c, ...P(0.5, 0.5, 6), ...P(0.5, -0.5, 6), shade(st.trim, -0.2), 3);
      if (o.win) { poly(c, [...P(-0.2, 0.5, 34), ...P(0.2, 0.5, 34), ...P(0.2, 0.5, 20), ...P(-0.2, 0.5, 20)], '#5d8fa8'); poly(c, [...P(0.5, 0.2, 34), ...P(0.5, -0.2, 34), ...P(0.5, -0.2, 20), ...P(0.5, 0.2, 20)], '#3f6c82'); }
      break;
    }
    case 'trailer': {
      const col = ['#e9e4d4', '#cfe3e0', '#f1d7b0', '#d9d0e8'][o.v];
      ell(c, 0, 4, 100, 40, 'rgba(0,0,0,0.18)', null);
      isoBox(c, 3, 2, 6, 40, col);
      line(c, ...P(-1.5, 1, 24), ...P(1.5, 1, 24), '#3fa58c', 5); line(c, ...P(1.5, 1, 24), ...P(1.5, -1, 24), '#2d7a68', 5);
      for (const u of [-0.9, 0.5]) poly(c, [...P(u, 1, 34), ...P(u + 0.5, 1, 34), ...P(u + 0.5, 1, 27), ...P(u, 1, 27)], '#5d8fa8');
      poly(c, [...P(-0.2, 1, 33), ...P(0.15, 1, 33), ...P(0.15, 1, 6), ...P(-0.2, 1, 6)], '#8e6e4f');
      ell(c, ...P(-0.9, 1, 4), 7, 7, '#333'); ell(c, ...P(0.9, 1, 4), 7, 7, '#333');
      poly(c, [...P(-1.6, -1.1, 42), ...P(1.6, -1.1, 42), ...P(1.6, 1.1, 42), ...P(-1.6, 1.1, 42)], shade(col, -0.08));
      break;
    }
    case 'pump': {
      isoBox(c, 0.5, 0.4, 0, 6, '#777777'); isoBox(c, 0.36, 0.28, 6, 40, ['#d9534f', '#f0ad4e'][o.v % 2]);
      poly(c, [...P(-0.12, 0.14, 34), ...P(0.12, 0.14, 34), ...P(0.12, 0.14, 24), ...P(-0.12, 0.14, 24)], '#bfe6ff'); line(c, ...P(0.18, 0.1, 30), ...P(0.35, 0.2, 14), '#222', 2.5); break;
    }
    case 'sign': {
      line(c, 0, 0, 0, -70, '#555', 5); rrect(c, -28, -110, 56, 40, 6, '#f0ad4e'); c.fillStyle = OL; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('GAS', 0, -84); break;
    }
    case 'pillar': {
      isoBox(c, 0.9, 0.9, 0, 80, '#b8b2a5'); for (const dx of [-8, 0, 8]) line(c, dx, -80 - 8, dx + 3, -80 - 20, '#7a4a2a', 2);
      line(c, ...P(-0.1, 0.45, 60), ...P(0.2, 0.45, 40), '#7d776c', 1.5); break;
    }
    case 'slab': {
      isoBox(c, 2, 2, 0, 22, '#a9a397'); poly(c, [...P(-1, -1, 22), ...P(0.4, -1, 34), ...P(1, 0.2, 28), ...P(0.3, 1, 22), ...P(-1, 1, 22)], '#bfb9ad');
      for (const dx of [-14, -4, 9, 20]) line(c, dx, -28, dx + 4, -42, '#7a4a2a', 2); break;
    }
    case 'rubble': case 'rock': {
      const base = o.type === 'rock' ? ['#9b8a74', '#a3927c', '#8c7f6c', '#b09a7c'][o.v] : '#a9a397';
      ell(c, 0, 2, 24, 10, 'rgba(0,0,0,0.2)', null);
      ell(c, -6, -8, 14, 11, base); ell(c, 8, -5, 11, 8, shade(base, -0.1)); ell(c, -2, -14, 8, 6, shade(base, 0.15), null); break;
    }
    case 'sandbag': {
      for (let r = 0; r < 2; r++) for (let i = -1; i <= 1; i++) ell(c, i * 11 + r * 5 - 2, -6 - r * 9, 10, 6, r ? '#cbb68a' : '#b9a47a'); break;
    }
    case 'tower': {
      ell(c, 0, 0, 60, 26, 'rgba(0,0,0,0.18)', null);
      for (const [x, y] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) line(c, ...P(x, y, 0), ...P(x, y, 70), '#6b4a2b', 4);
      isoBox(c, 2, 2, 70, 80, '#8b6a45'); for (const [x, y] of [[-0.9, 0.9], [0.9, 0.9], [0.9, -0.9]]) line(c, ...P(x, y, 80), ...P(x, y, 100), '#6b4a2b', 3);
      poly(c, [...P(-1.1, -1.1, 104), ...P(1.1, -1.1, 104), ...P(1.1, 1.1, 104), ...P(-1.1, 1.1, 104)], '#6a8f3b'); break;
    }
    case 'scarecrow': {
      line(c, 0, 0, 0, -62, '#6b4a2b', 4); line(c, -22, -44, 22, -44, '#6b4a2b', 4);
      poly(c, [-14, -48, 14, -48, 10, -22, -10, -22], '#8e6bbf'); ell(c, 0, -60, 10, 10, '#e2c46b');
      poly(c, [-16, -64, 16, -64, 6, -70, -6, -70], '#5c4033'); ell(c, -4, -60, 2, 2, '#e5533d', null); ell(c, 4, -60, 2, 2, '#e5533d', null);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) line(c, s * 22, -44, s * (26 + i * 2), -38 + i * 3, '#e2c46b', 2); break;
    }
    case 'hay': { ell(c, 0, 2, 26, 10, 'rgba(0,0,0,0.2)', null); isoBox(c, 0.9, 0.7, 0, 24, '#e2c46b'); for (let i = 1; i < 3; i++) line(c, ...P(-0.45, 0.35, i * 8), ...P(0.45, 0.35, i * 8), '#b8973f', 1.5); break; }
    case 'radio': {
      ell(c, 0, 0, 60, 26, 'rgba(0,0,0,0.18)', null); isoBox(c, 1.6, 1.6, 0, 10, '#888888');
      const H = 200; for (const [x, y] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) line(c, ...P(x, y, 10), ...P(x * 0.15, y * 0.15, H), '#b0382a', 3);
      for (let z = 30; z < H; z += 28) { const k = 1 - z / H * 0.85; line(c, ...P(-0.6 * k, 0.6 * k, z), ...P(0.6 * k, 0.6 * k, z + 20), '#d9d0c0', 1.5); line(c, ...P(0.6 * k, 0.6 * k, z), ...P(0.6 * k, -0.6 * k, z + 20), '#d9d0c0', 1.5); }
      ell(c, 0, -H - 4, 6, 6, '#ff4a3a'); ell(c, 0, -H - 4, 12, 12, 'rgba(255,74,58,0.3)', null); break;
    }
    case 'fuselage': {
      const col = '#c9ced3'; ell(c, 0, 2, 60, 24, 'rgba(0,0,0,0.2)', null);
      if (o.v === 0) { poly(c, [...P(-1, -0.7, 4), ...P(1, -0.8, 4), ...P(1, -0.8, 44), ...P(-0.6, -0.4, 30)], shade(col, -0.2)); }
      isoBox(c, 2, 1.6, 2, 42, col, { top: '#dfe3e6' });
      if (o.v === 1) for (const u of [-0.6, 0, 0.6]) ell(c, ...P(u, 0.8, 28), 5, 5, '#5d8fa8');
      if (o.v === 2) poly(c, [...P(0.2, 0, 42), ...P(1, 0, 42), ...P(1, 0, 100), ...P(0.6, 0, 100)], '#e5533d');
      line(c, ...P(-1, 0.8, 16), ...P(1, 0.8, 16), '#e5533d', 4); break;
    }
    case 'wing': { isoBox(c, 2, 1.8, 6, 14, '#b9bfc4'); line(c, ...P(-0.8, 0.9, 14), ...P(0.8, -0.6, 14), '#8b9196', 1.5); break; }
    case 'fence': {
      const ax = o.v === 0;
      for (const t of [-0.5, 0.5]) line(c, ...(ax ? P(t, 0, 0) : P(0, t, 0)), ...(ax ? P(t, 0, 34) : P(0, t, 34)), '#6d6a64', 3);
      for (const z of [10, 20, 30]) line(c, ...(ax ? P(-0.5, 0, z) : P(0, -0.5, z)), ...(ax ? P(0.5, 0, z) : P(0, 0.5, z)), z === 20 ? '#a16b3d' : '#8b8780', z === 20 ? 4 : 2);
      break;
    }
    case 'carstackX': case 'carstackY': {
      const ax = o.type === 'carstackX', cols = ['#a14b3b', '#3b6aa1', '#6a8f3b', '#c48a2b'];
      ell(c, 0, 2, 70, 28, 'rgba(0,0,0,0.2)', null);
      isoBox(c, ax ? 2 : 1, ax ? 1 : 2, 0, 20, cols[o.v]); isoBox(c, ax ? 1.9 : 0.95, ax ? 0.95 : 1.9, 20, 38, cols[(o.v + 1) % 4]); isoBox(c, ax ? 1.7 : 0.9, ax ? 0.9 : 1.7, 38, 54, cols[(o.v + 2) % 4]);
      break;
    }
    case 'junk': {
      ell(c, 0, 4, 66, 28, 'rgba(0,0,0,0.2)', null); ell(c, 0, -10, 52, 26, '#7c6a58'); ell(c, -10, -22, 30, 16, '#8d7a64', null);
      isoBox(c, 0.6, 0.4, 14, 30, '#3b6aa1'); line(c, -30, -16, -8, -40, '#aaa', 4); ell(c, 20, -20, 10, 10, '#333'); ell(c, 20, -20, 4, 4, '#777', null); break;
    }
    case 'deadtree': {
      ell(c, 0, 2, 18, 7, 'rgba(0,0,0,0.2)', null);
      const tc = '#6b4a2b', h = [70, 60, 80, 66][o.v];
      poly(c, [-6, 0, 6, 0, 3, -h, -3, -h], tc);
      const br = [[-0.6, -18, 26], [0.7, -28, 22], [-0.9, -42, 18], [0.5, -52, 16]];
      for (const [a, y, l] of br) { if (-y > h) continue; line(c, 0, y, Math.sin(a) * l, y - Math.cos(a) * l * 0.8, tc, 4); line(c, Math.sin(a) * l, y - Math.cos(a) * l * 0.8, Math.sin(a) * l * 1.3, y - l * 1.1, tc, 2); }
      if (o.v === 1) for (const [x, y] of [[-14, -48], [14, -40], [0, -h - 4]]) ell(c, x, y, 9, 6, '#8a9a4a');
      break;
    }
    case 'cactus': {
      ell(c, 0, 2, 14, 6, 'rgba(0,0,0,0.2)', null); const g = '#6aa84f';
      rrect(c, -8, -50, 16, 50, 8, g); rrect(c, -22, -36, 10, 20, 5, g); rrect(c, 12, -42, 10, 22, 5, g);
      line(c, -12, -22, -8, -22, OL, 2); line(c, 12, -24, 8, -24, OL, 2); line(c, -2, -44, -2, -6, shade(g, -0.2), 1.5); break;
    }
    case 'tyres': { for (let i = 0; i < 3; i++) { ell(c, 0, -4 - i * 8, 16, 8, '#2d2d2d'); ell(c, 0, -6 - i * 8, 6, 3, '#555', null); } break; }
    case 'carX': case 'carY': {
      const col = ['#a14b3b', '#3b6aa1', '#c48a2b', '#6a8f3b'][o.v];
      ell(c, 0, 2, 60, 22, 'rgba(0,0,0,0.25)', null);
      const a = o.type === 'carX' ? 0.08 : 1.65;
      deadCar(c, a, col); break;
    }
  }
}
function deadCar(c, a, col) {
  const rust = '#8b5a3c';
  for (const [u, v] of [[0.6, 0.45], [-0.6, 0.45], [0.6, -0.45], [-0.6, -0.45]]) { const x = u * Math.cos(a) - v * Math.sin(a), y = u * Math.sin(a) + v * Math.cos(a); ell(c, ...P(x, y, 6), 7, 6, '#222'); }
  orientedBox(c, a, 1.8, 0.95, 6, 22, col);
  c.save(); c.translate(...P(-0.1 * Math.cos(a), -0.1 * Math.sin(a), 0)); orientedBox(c, a, 0.9, 0.8, 22, 36, shade(col, 0.05), '#6f8fa0'); c.restore();
  ell(c, ...P(0.5 * Math.cos(a), 0.5 * Math.sin(a), 23), 8, 4, rust, null);
}

// ---------- containers / props ----------
export function paintContainer(c, k, opened, t = 0) {
  if (k === 'box') {
    ell(c, 0, 2, 22, 9, 'rgba(0,0,0,0.25)', null); const b = isoBox(c, 0.62, 0.62, 0, 26, '#c08a4c', { top: '#d9a463' });
    line(c, ...P(-0.31, 0.31, 2), ...P(0.31, 0.31, 24), '#7a5530', 2.5); line(c, ...P(0.31, 0.31, 2), ...P(0.31, -0.31, 24), '#6a4728', 2.5);
  } else if (k === 'crate' || k === 'premium') {
    const col = k === 'premium' ? '#3e5f8a' : '#5b6b3a';
    ell(c, 0, 2, 30, 12, 'rgba(0,0,0,0.25)', null); isoBox(c, 0.9, 0.62, 0, 24, col);
    line(c, ...P(-0.45, 0.31, 12), ...P(0.45, 0.31, 12), '#f2c14e', 4);
    if (opened) { poly(c, [...P(-0.45, -0.31, 24), ...P(0.45, -0.31, 24), ...P(0.45, -0.6, 44), ...P(-0.45, -0.6, 44)], shade(col, 0.1)); poly(c, [...P(-0.4, -0.28, 24), ...P(0.4, -0.28, 24), ...P(0.4, 0.28, 24), ...P(-0.4, 0.28, 24)], '#2a2a22', null); }
    else { isoBox(c, 0.94, 0.66, 24, 30, shade(col, 0.12)); c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(...P(0, 0, 30), 4, 0, 7); c.fill(); }
  } else if (k === 'airdrop') {
    ell(c, 0, 2, 40, 16, 'rgba(0,0,0,0.3)', null); isoBox(c, 1.1, 1.1, 0, 36, '#2f6db5', { top: '#3f86d6' });
    for (const z of [8, 28]) line(c, ...P(-0.55, 0.55, z), ...P(0.55, 0.55, z), '#f2c14e', 4);
    line(c, ...P(0.55, 0.55, 18), ...P(0.55, -0.55, 18), '#e5533d', 4);
    if (opened) poly(c, [...P(-0.5, -0.5, 36), ...P(0.5, -0.5, 36), ...P(0.5, 0.5, 36), ...P(-0.5, 0.5, 36)], '#1a2a3a', null);
  } else if (k === 'deathbox') {
    ell(c, 0, 2, 20, 8, 'rgba(0,0,0,0.25)', null);
    ell(c, 0, -12, 16, 14, '#a07a50'); poly(c, [-6, -26, 6, -26, 9, -32, -9, -32], '#8a6640'); line(c, -10, -16, 10, -16, '#6a4a2a', 3);
    ell(c, 0, -10, 5, 5, '#f4efe6', OL, 1.5);
  } else if (k === 'barrel') {
    ell(c, 0, 2, 16, 7, 'rgba(0,0,0,0.25)', null);
    rrect(c, -11, -30, 22, 30, 4, '#c8402f'); ell(c, 0, -30, 11, 5, '#e05a45'); line(c, -11, -10, 11, -10, '#8f2a1e', 2); line(c, -11, -20, 11, -20, '#8f2a1e', 2);
    poly(c, [0, -22, 5, -14, -5, -14], '#f2c14e', OL, 1.2);
  }
}
export function paintTumbleweed(c, rot) {
  c.rotate(rot); ell(c, 0, 0, 11, 11, null, '#a0824f', 2);
  for (let i = 0; i < 6; i++) { const a = i * 1.05; line(c, Math.cos(a) * -9, Math.sin(a) * -9, Math.cos(a + 2) * 9, Math.sin(a + 2) * 9, '#b8975c', 1.5); }
}

// ---------- weapons ----------
export function drawWeapon(c, id, rar = 0) {
  const g = RARITY[rar].color, metal = '#4a4f57', wood = '#8a5a34';
  switch (id) {
    case 'wrench': rrect(c, 0, -2.5, 20, 5, 2, '#c8402f'); rrect(c, 18, -6, 9, 12, 2, '#9aa3ad'); rrect(c, 22, -2, 6, 4, 0, '#222', null); break;
    case 'pistol': rrect(c, 2, -3.5, 16, 7, 2, metal); rrect(c, 2, 1, 5, 7, 2, wood); line(c, 4, -3.5, 16, -3.5, g, 2); break;
    case 'smg': rrect(c, 0, -4, 24, 8, 2, metal); rrect(c, 10, 2, 5, 10, 1, '#333'); rrect(c, -6, -2, 7, 5, 2, '#333'); line(c, 2, -4, 22, -4, g, 2); break;
    case 'shotgun': rrect(c, -8, -3, 14, 7, 3, wood); rrect(c, 4, -4, 28, 4, 1, metal); rrect(c, 4, 0, 28, 4, 1, metal); line(c, 6, -4, 26, -4, g, 1.5); break;
    case 'rifle': rrect(c, -8, -3, 12, 7, 2, wood); rrect(c, 2, -4, 26, 8, 2, '#8b5a3c'); rrect(c, 26, -2, 10, 3, 1, metal); rrect(c, 12, 3, 5, 9, 1, '#333'); line(c, 4, -4, 26, -4, g, 2); break;
    case 'sniper': rrect(c, -10, -3, 14, 7, 3, wood); rrect(c, 2, -3, 40, 6, 2, '#3d4a3a'); rrect(c, 10, -11, 16, 6, 3, '#222'); ell(c, 26, -8, 2, 3, '#7fd3ff', null); line(c, 4, -3, 40, -3, g, 2); break;
  }
}

// ---------- humans ----------
const HELM = ['#000', '#7a8a5a', '#5a6b8a', '#2e3542'];
const VEST = ['#000', '#8a7a5a', '#4d6b48', '#2e3a4a'];
export function drawHuman(c, h, sx, sy, t) {
  const o = h.outfit, hit = h.hitT > 0, cr = h.crouch ? 1 : 0;
  const walk = h.walkT, moving = h.moveAmt > 0.1;
  const bob = moving ? Math.abs(Math.sin(walk * 2)) * 3 : Math.sin(t * 2 + h.id) * 0.8;
  const aimS = h.aimScreen; let flip = Math.cos(aimS) < 0;
  c.save(); c.translate(sx, sy);
  // shadow
  ell(c, 0, 0, 17, 7, 'rgba(0,0,0,0.28)', null);
  if (h.dropZ > 0) { // parachute
    c.translate(0, -h.dropZ);
    const sway = Math.sin(t * 2 + h.id) * 4;
    line(c, -14, -36, -30 + sway, -86, '#ddd', 1); line(c, 14, -36, 30 + sway, -86, '#ddd', 1);
    c.beginPath(); c.moveTo(-40 + sway, -84); c.quadraticCurveTo(sway, -128, 40 + sway, -84); c.quadraticCurveTo(sway, -94, -40 + sway, -84);
    c.fillStyle = h.isPlayer ? '#f2c14e' : '#e07b39'; c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.stroke();
  }
  if (flip) c.scale(-1, 1);
  const sqY = (cr ? 0.78 : 1) * (1 + (moving ? Math.sin(walk * 2) * 0.04 : Math.sin(t * 2 + h.id) * 0.02));
  const sqX = (cr ? 1.12 : 1) / Math.sqrt(sqY);
  const lg = moving ? Math.sin(walk * 2) * 5 : 0;
  // legs
  ell(c, -6 + lg, -5, 6, 6, o.pants); ell(c, 6 - lg, -5, 6, 6, o.pants);
  ell(c, -6 + lg, -1, 6, 3, '#3a2a1e'); ell(c, 6 - lg, -1, 6, 3, '#3a2a1e');
  c.translate(0, -bob); c.scale(sqX, sqY);
  // backpack
  if (h.inv && h.inv.pack) rrect(c, -22, -36, 12, 22, 5, ['#000', '#8a7a5a', '#6a5a3a', '#4a3a5a'][h.inv.pack]);
  // body
  const shirt = hit ? '#fff' : o.shirt;
  ell(c, 0, -22, 16, 16, shirt);
  ell(c, 3, -18, 9, 9, hit ? '#fff' : shade(o.shirt, 0.18), null);
  if (h.inv && h.inv.vest) { rrect(c, -14, -32, 28, 18, 7, VEST[h.inv.vest.lvl]); line(c, -6, -30, -6, -16, 'rgba(255,255,255,0.25)', 2); }
  // belt
  line(c, -15, -12, 15, -12, '#4a3020', 3);
  // head
  const skin = hit ? '#fff' : o.skin;
  ell(c, 1, -44, 12.5, 12, skin);
  ell(c, 8, -40, 3.5, 2.2, 'rgba(255,110,110,0.45)', null);
  // eyes look toward aim (we're flipped so always "right")
  const blink = (Math.sin(t * 0.7 + h.id * 3) > 0.985) || h.dead;
  const ey = -46 + Math.sin(aimS) * (flip ? 1 : 1) * 1.5;
  if (blink) { line(c, 3, ey, 7, ey, OL, 1.8); line(c, 10, ey, 13, ey, OL, 1.8); }
  else { ell(c, 5, ey, 3, 3.6, '#fff', OL, 1.2); ell(c, 11, ey, 2.6, 3.3, '#fff', OL, 1.2); ell(c, 6, ey + 0.5, 1.5, 1.8, '#111', null); ell(c, 11.8, ey + 0.5, 1.3, 1.6, '#111', null); }
  if (h.hitT > 0.05) { ell(c, 9, -37, 3, 3, '#5a2a1e', null); } else line(c, 6, -37, 11, -37.5, '#5a2a1e', 1.6);
  // hat / helmet
  if (h.inv && h.inv.helmet) { c.beginPath(); c.ellipse(1, -48, 14, 11, 0, Math.PI, Math.PI * 2); c.closePath(); c.fillStyle = HELM[h.inv.helmet.lvl]; c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.stroke(); line(c, -14, -48, 16, -48, shade(HELM[h.inv.helmet.lvl], -0.3), 3); }
  else drawHat(c, o.hat, o.hatCol);
  c.restore();
  // weapon + arms in un-flipped space with rotation
  c.save(); c.translate(sx, sy - (h.dropZ || 0) - bob - (cr ? 14 : 20));
  const a = aimS; c.rotate(a); if (flip) c.scale(1, -1);
  const w = h.curWeapon();
  const rk = h.recoil * 6;
  c.translate(-rk + 4, 0);
  if (h.healT > 0) { rrect(c, 4, -6, 12, 12, 3, '#fff'); line(c, 10, -3, 10, 3, '#e5533d', 2.5); line(c, 7, 0, 13, 0, '#e5533d', 2.5); }
  else if (w) {
    if (w.id === 'wrench') { c.rotate(h.swingT > 0 ? -1.4 + (1 - h.swingT / 0.25) * 2.4 : -0.6); }
    drawWeapon(c, w.id, w.rar);
    if (h.flashT > 0 && w.id !== 'wrench') { const L = { pistol: 20, smg: 26, shotgun: 34, rifle: 38, sniper: 44 }[w.id]; ell(c, L + 6, 0, 10, 6, '#fff3a0', null); ell(c, L + 4, 0, 6, 4, '#fff', null); }
  }
  ell(c, 6, 4, 5, 5, hit ? '#fff' : o.skin, OL, 1.5); // hand
  c.restore();
}
function drawHat(c, hat, col) {
  switch (hat) {
    case 'gasmask': ell(c, 9, -40, 7, 6, '#555'); ell(c, 14, -38, 3.5, 3.5, '#888'); line(c, -10, -47, 4, -44, '#333', 3); break;
    case 'bandana': c.beginPath(); c.ellipse(1, -49, 13, 8, 0, Math.PI, Math.PI * 2); c.fillStyle = col; c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.stroke(); poly(c, [-11, -50, -20, -46, -17, -42], col); break;
    case 'goggles': line(c, -11, -48, 14, -48, '#5c4033', 3); ell(c, 5, -48, 4, 3.5, '#7fd3ff'); ell(c, 12, -48, 3.5, 3.2, '#7fd3ff'); break;
    case 'mohawk': for (let i = 0; i < 5; i++) poly(c, [-8 + i * 4, -54, -6 + i * 4, -66 + Math.abs(i - 2) * 2, -4 + i * 4, -54], col); break;
    case 'hardhat': c.beginPath(); c.ellipse(1, -49, 13.5, 10, 0, Math.PI, Math.PI * 2); c.fillStyle = '#f2c14e'; c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.stroke(); line(c, -15, -49, 18, -49, '#d9a020', 3); break;
    case 'cap': c.beginPath(); c.ellipse(0, -50, 12.5, 8, 0, Math.PI, Math.PI * 2); c.fillStyle = col; c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.stroke(); poly(c, [8, -51, 21, -49, 8, -47], shade(col, -0.2)); break;
    case 'cowboy': ell(c, 1, -51, 20, 4.5, '#8b5a3c'); rrect(c, -8, -64, 18, 13, 5, '#9b6a4c'); line(c, -8, -55, 10, -55, '#5a3a20', 2.5); break;
    case 'bucket': rrect(c, -10, -64, 22, 14, 2, '#9aa3ad'); line(c, -12, -51, 14, -51, '#6c7480', 3); break;
  }
}

// ---------- creatures ----------
export function drawCreature(c, e, sx, sy, t) {
  const hit = e.hitT > 0; const flip = e.faceX < 0; const run = e.animT;
  c.save(); c.translate(sx, sy);
  const S = e.type === 'hog' ? 1 : 1;
  if (e.type === 'crow') {
    const z = e.z || 0; ell(c, 0, 0, 10 * (1 - z / 260) + 4, 4, 'rgba(0,0,0,0.25)', null);
    c.translate(0, -z - 10); if (flip) c.scale(-1, 1);
    const fl = Math.sin(t * 16 + e.id) * 0.9;
    const body = hit ? '#fff' : '#2b2b34';
    poly(c, [-2, -2, -24, -12 - fl * 14, -12, 2], '#1d1d24'); ell(c, 0, 0, 13, 8, body); poly(c, [2, -2, 24, -12 - fl * 14, 12, 2], '#3a3a46');
    ell(c, 11, -5, 6, 6, body); poly(c, [15, -6, 24, -3, 15, -2], '#f0ad4e', OL, 1.2); ell(c, 12, -6, 1.6, 1.6, '#ff4a3a', null);
    poly(c, [-12, 0, -20, -3, -20, 4], '#1d1d24', OL, 1.2);
    c.restore(); return;
  }
  ell(c, 0, 0, e.type === 'hog' ? 40 : e.type === 'dog' ? 20 : 10, e.type === 'hog' ? 14 : e.type === 'dog' ? 7 : 4, 'rgba(0,0,0,0.28)', null);
  if (flip) c.scale(-1, 1);
  const lg = Math.sin(run * 2) * (e.type === 'rat' ? 2 : 5);
  if (e.type === 'dog') {
    const straw = hit ? '#fff' : '#d6b45a', dk = '#a6852f';
    for (const [x, d] of [[-10, lg], [10, -lg]]) { line(c, x + d, -12, x + d * 1.4, -1, dk, 5); }
    for (let i = 0; i < 6; i++) line(c, -16, -22, -26 - i, -30 + i * 2, dk, 1.5);
    ell(c, 0, -20, 18, 11, straw); for (let i = -2; i <= 2; i++) line(c, i * 6, -30, i * 6 + 3, -36, dk, 2);
    rrect(c, -6, -26, 9, 7, 1, '#9b7653', OL, 1.2);
    ell(c, 17, -26, 10, 9, straw); poly(c, [22, -26, 33, -22, 22, -18], straw); ell(c, 32, -22, 2.5, 2, '#222', null);
    poly(c, [10, -32, 12, -42, 18, -33], dk); line(c, 16, -29, 20, -25, OL, 1.5); line(c, 20, -29, 16, -25, OL, 1.5);
    ell(c, 23, -28, 2.5, 2.5, '#ff3a2a', null); ell(c, 23, -28, 5, 5, 'rgba(255,60,40,0.3)', null);
    if (e.state === 'chase') { line(c, 24, -20, 31, -19, '#fff', 1.5); }
  } else if (e.type === 'rat') {
    const body = hit ? '#fff' : '#7fbf5a';
    c.beginPath(); c.moveTo(-8, -5); c.quadraticCurveTo(-18, -2 + lg, -22, -8); c.strokeStyle = '#e59aa0'; c.lineWidth = 2; c.stroke();
    ell(c, -3 + lg * 0.3, -2, 2.5, 2, '#c97a80', null); ell(c, 4 - lg * 0.3, -2, 2.5, 2, '#c97a80', null);
    ell(c, 0, -7, 9, 6, body); ell(c, 8, -9, 5, 4.5, body); ell(c, 5, -14, 3, 3, '#e59aa0');
    ell(c, 10, -10, 1.6, 1.6, '#eaff5a', null); ell(c, 10, -10, 4, 4, 'rgba(200,255,80,0.35)', null);
    ell(c, 0, -7, 13, 10, 'rgba(160,255,100,0.12)', null);
  } else if (e.type === 'hog') {
    const body = hit ? '#fff' : '#b77a8a', belly = '#cf9aa6';
    for (const [x, d] of [[-24, lg], [-8, -lg], [10, lg], [24, -lg]]) rrect(c, x + d - 5, -16, 10, 16, 4, '#8a5866');
    ell(c, 0, -34, 42, 28, body); ell(c, 6, -26, 28, 16, belly, null);
    for (const [x, y, r] of [[-20, -48, 6], [-4, -56, 5], [14, -50, 7], [-28, -32, 4]]) { ell(c, x, y, r, r, '#9fd36b'); ell(c, x - 1, y - 1, r * 0.4, r * 0.4, '#e9ffb0', null); }
    ell(c, 38, -38, 18, 16, body); ell(c, 52, -34, 8, 7, belly); ell(c, 50, -35, 1.6, 2.4, OL, null); ell(c, 55, -35, 1.6, 2.4, OL, null);
    poly(c, [44, -26, 52, -38, 47, -24], '#f4efe6'); poly(c, [38, -48, 30, -60, 42, -52], '#8a5866');
    line(c, 38, -48, 47, -45, OL, 2.5); ell(c, 43, -42, 2.5, 2.5, '#ff3a2a', null);
    if (e.chargeT > 0) for (let i = 0; i < 3; i++) line(c, -46 - i * 6, -30 + i * 8, -60 - i * 6, -30 + i * 8, '#fff', 2);
  }
  c.restore();
}

// ---------- vehicles ----------
export function drawVehicle(c, v, sx, sy) {
  const T = v.def, a = v.angle, hit = v.hitT > 0;
  c.save(); c.translate(sx, sy);
  ell(c, 0, 2, 52, 22, 'rgba(0,0,0,0.3)', null);
  const ca = Math.cos(a), sa = Math.sin(a), L = T.len, W = T.wid;
  const wheel = (u, w2) => { const x = u * ca - w2 * sa, y = u * sa + w2 * ca; ell(c, ...P(x, y, 7), 8, 7, '#1f1f1f'); ell(c, ...P(x, y, 7), 3, 3, '#888', null); };
  const steer = v.steerVis || 0;
  wheel(L * 0.32, -W * 0.52); wheel(-L * 0.32, -W * 0.52);
  const col = hit ? '#fff' : T.color;
  if (v.type === 'buggy') {
    orientedBox(c, a, L, W * 0.9, 8, 20, col);
    c.save(); c.translate(...P(-0.15 * ca, -0.15 * sa, 0));
    // roll cage
    const pts = [[0.4, 0.4], [0.4, -0.4], [-0.4, -0.4], [-0.4, 0.4]].map(([u, w2]) => [u * ca - w2 * sa, u * sa + w2 * ca]);
    for (const [x, y] of pts) line(c, ...P(x, y, 20), ...P(x * 0.8, y * 0.8, 44), '#333', 3);
    poly(c, pts.flatMap(([x, y]) => P(x * 0.8, y * 0.8, 44)), null, '#333', 3);
    c.restore();
    ell(c, ...P(0.65 * ca, 0.65 * sa, 22), 6, 3, '#333', null);
  } else {
    orientedBox(c, a, L, W, 8, 26, col);
    c.save(); c.translate(...P(0.25 * ca, 0.25 * sa, 0)); orientedBox(c, a, L * 0.42, W * 0.92, 26, 44, shade(col, 0.08), '#86a9b8'); c.restore();
    for (let i = 0; i < 3; i++) ell(c, ...P((-0.6 + i * 0.12) * ca, (-0.6 + i * 0.12) * sa, 27), 7, 3, '#8b5a3c', null);
  }
  wheel(L * 0.32, W * 0.52); wheel(-L * 0.32, W * 0.52);
  if (v.driver) { const d = v.driver; ell(c, ...P(-0.1 * ca, -0.1 * sa, 34), 9, 9, d.outfit.skin); }
  c.restore();
}

// ---------- blimp ----------
export function drawBlimp(c, sx, sy, a, t) {
  c.save(); c.translate(sx, sy);
  c.rotate(Math.atan2(Math.sin(a) * HALF_H + Math.cos(a) * HALF_H, (Math.cos(a) - Math.sin(a)) * HALF_W));
  ell(c, 0, 0, 120, 44, '#c9b48a'); ell(c, -10, -14, 90, 18, '#dccaa2', null);
  for (let i = -2; i <= 2; i++) line(c, i * 30, -40, i * 30, 40, 'rgba(90,60,30,0.35)', 2);
  poly(c, [-110, 0, -150, -40, -140, 0, -150, 40], '#b5543c');
  rrect(c, -30, 40, 60, 20, 6, '#6b4a2b'); for (let i = 0; i < 4; i++) rrect(c, -24 + i * 14, 44, 8, 8, 2, '#f2c14e', null);
  const pr = Math.sin(t * 30) * 12; line(c, 34, 50, 34, 50 + pr, '#333', 3);
  c.fillStyle = '#5a3a20'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('DUSTBOWL', 0, 8);
  c.restore();
}

// ---------- item icons (UI + ground pickups); origin = center, ~40px box ----------
export function drawIcon(c, it) {
  switch (it.t) {
    case 'weapon': { c.save(); const L = { wrench: 28, pistol: 18, smg: 28, shotgun: 40, rifle: 44, sniper: 52 }[it.id]; c.scale(40 / Math.max(L + 10, 34), 40 / Math.max(L + 10, 34)); c.translate(-L / 2, 0); drawWeapon(c, it.id, it.rar); c.restore(); break; }
    case 'ammo': rrect(c, -13, -9, 26, 18, 3, '#6b5a3a'); for (let i = 0; i < 3; i++) { rrect(c, -9 + i * 7, -17, 5, 10, 2, '#d9a020', OL, 1.2); rrect(c, -9 + i * 7, -17, 5, 4, 2, { light: '#f2c14e', shells: '#e5533d', heavy: '#5fb3e6' }[it.id], OL, 1.2); } break;
    case 'heal':
      if (it.id === 'bandage') { rrect(c, -14, -8, 28, 16, 6, '#f4efe6'); rrect(c, -5, -8, 10, 16, 0, '#e8d8c0', OL, 1.2); }
      else if (it.id === 'medkit') { rrect(c, -15, -12, 30, 24, 4, '#e5533d'); rrect(c, -3, -8, 6, 16, 1, '#fff', null); rrect(c, -8, -3, 16, 6, 1, '#fff', null); }
      else { rrect(c, -8, -15, 16, 30, 4, '#3fa58c'); rrect(c, -8, -4, 16, 8, 0, '#f2c14e', null); ell(c, 0, -15, 6, 2, '#ccc', OL, 1); }
      break;
    case 'helmet': c.beginPath(); c.ellipse(0, 6, 16, 14, 0, Math.PI, Math.PI * 2); c.closePath(); c.fillStyle = HELM[it.lvl]; c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.stroke(); line(c, -18, 6, 18, 6, OL, 3); break;
    case 'vest': rrect(c, -13, -14, 26, 28, 7, VEST[it.lvl]); line(c, 0, -14, 0, 14, 'rgba(0,0,0,0.35)', 2); rrect(c, -9, -4, 7, 6, 1, shade(VEST[it.lvl], 0.2), OL, 1); rrect(c, 2, -4, 7, 6, 1, shade(VEST[it.lvl], 0.2), OL, 1); break;
    case 'pack': rrect(c, -12, -12, 24, 26, 7, ['#000', '#8a7a5a', '#6a5a3a', '#4a3a5a'][it.lvl]); rrect(c, -8, 0, 16, 9, 3, 'rgba(0,0,0,0.2)', OL, 1.2); line(c, -6, -12, -4, -17, OL, 2); line(c, 6, -12, 4, -17, OL, 2); break;
    case 'grenade': ell(c, 0, 3, 11, 12, '#8fe36b'); rrect(c, -7, -14, 14, 6, 2, '#9aa3ad'); ell(c, -3, 0, 3, 5, 'rgba(255,255,255,0.4)', null); break;
  }
  if (it.lvl || it.t === 'weapon') {
    const n = it.t === 'weapon' ? it.rar + 1 : it.lvl;
    for (let i = 0; i < n; i++) ell(c, -12 + i * 7, 17, 2.5, 2.5, itemCol(it), OL, 1);
  }
}
function itemCol(it) { return it.t === 'weapon' ? RARITY[it.rar].color : ['#fff', '#b9b2a3', '#6fd35b', '#b06cff'][it.lvl]; }
const iconURLs = new Map();
export function iconURL(it) {
  const k = it.t + (it.id || '') + (it.lvl || '') + (it.rar ?? '');
  if (!iconURLs.has(k)) { const cv = document.createElement('canvas'); cv.width = cv.height = 96; const c = cv.getContext('2d'); c.scale(2, 2); c.translate(24, 22); c.lineCap = c.lineJoin = 'round'; drawIcon(c, it); iconURLs.set(k, cv.toDataURL()); }
  return iconURLs.get(k);
}
