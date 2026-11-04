export const TW = 64, TH = 32, HALF_W = 32, HALF_H = 16;
export const isoX = (x, y) => (x - y) * HALF_W;
export const isoY = (x, y) => (x + y) * HALF_H;
export const fromIso = (sx, sy) => ({ x: (sx / HALF_W + sy / HALF_H) / 2, y: (sy / HALF_H - sx / HALF_W) / 2 });
// screen-space direction -> normalized world direction
export function screenDirToWorld(sx, sy) {
  const x = sx / HALF_W + sy / HALF_H, y = sy / HALF_H - sx / HALF_W;
  const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l };
}
export const worldDirToScreenAngle = (dx, dy) => Math.atan2((dx + dy) * HALF_H, (dx - dy) * HALF_W);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
export function approach(v, t, s) { return v < t ? Math.min(t, v + s) : Math.max(t, v - s); }
export function weighted(list) { // [[item, weight], ...]
  let t = 0; for (const e of list) t += e[1];
  let r = Math.random() * t; for (const e of list) { if ((r -= e[1]) <= 0) return e[0]; }
  return list[list.length - 1][0];
}
export function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// segment (x1,y1)-(x2,y2) vs circle; returns t in [0,1] or -1
export function segCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1, fx = x1 - cx, fy = y1 - cy;
  const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  let disc = b * b - 4 * a * c; if (disc < 0 || a === 0) return -1;
  disc = Math.sqrt(disc); const t = (-b - disc) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}
export function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
export function shade(hex, amt) { // amt -1..1
  let c = parseInt(hex.slice(1), 16), r = c >> 16, g = (c >> 8) & 255, b = c & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
