// Map "Rustwater Flats": tile grid, static objects, buildings, collision, LOS and A* pathfinding.
import { mulberry32 } from './util.js';
export const N = 72;
export const GR = { SAND: 0, ROAD: 1, GRASS: 2, MUD: 3, FARM: 4, FLOOR: 5, CONCRETE: 6, GOO: 7, GRAVEL: 8, LINE: 9 };

export function buildWorld() {
  const rng = mulberry32(1337);
  const R = (a, b) => a + rng() * (b - a), RI = (a, b) => Math.floor(R(a, b + 1));
  const ground = new Uint8Array(N * N), solid = new Uint8Array(N * N), bld = new Int16Array(N * N);
  const objects = [], buildings = [], spots = { crates: [], boxes: [], floor: [], premium: [] };
  const dens = [], vehicleSpawns = [], barrels = [];
  const idx = (x, y) => y * N + x, inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const fill = (x0, y0, w, h, t) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inb(x, y)) ground[idx(x, y)] = t; };
  const ellipse = (cx, cy, rx, ry, t, jag = 0) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < 1 - jag * rng()) ground[idx(x, y)] = t; } };
  const free = (x, y, w = 1, h = 1) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { if (!inb(i, j) || i < 1 || j < 1 || i > N - 2 || j > N - 2 || solid[idx(i, j)] || bld[idx(i, j)]) return false; } return true; };
  const obj = (type, x, y, w = 1, h = 1, o = {}) => {
    const s = { type, x: x + w / 2, y: y + h / 2, tx: x, ty: y, w, h, v: o.v ?? RI(0, 3), solid: o.solid !== false, tall: !!o.tall, ...o };
    if (s.solid) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (inb(i, j)) solid[idx(i, j)] = 1;
    objects.push(s); return s;
  };
  // ---------- ground ----------
  for (let i = 0; i < 26; i++) ellipse(R(0, N), R(0, N), R(2, 6), R(2, 6), GR.GRASS, 0.4);
  // highway (west-east) with lane line, and two side roads
  fill(0, 33, N, 4, GR.ROAD); for (let x = 1; x < N; x += 3) ground[idx(x, 34)] = GR.LINE, ground[idx(x + 1, 34)] = GR.LINE;
  fill(20, 0, 3, 33, GR.ROAD); fill(44, 37, 3, 35, GR.ROAD);
  fill(46, 37, 18, 2, GR.ROAD); // spur to radio hill
  ellipse(18, 56, 13, 9.5, GR.MUD, 0.08);          // dried lake
  fill(50, 50, 19, 19, GR.GRAVEL);                  // junkyard
  fill(52, 15, 17, 10, GR.FARM);                    // fields
  fill(43, 24, 14, 9, GR.CONCRETE);                 // gas station lot
  fill(33, 6, 8, 7, GR.CONCRETE);                   // checkpoint
  for (let i = 0; i < 7; i++) { const cx = [56, 60, 13, 25, 63, 49, 30][i], cy = [58, 64, 61, 51, 48, 46, 66][i]; ellipse(cx, cy, R(1.2, 2.2), R(1, 1.8), GR.GOO, 0.3); }

  // ---------- buildings ----------
  function building(x0, y0, w, h, o = {}) {
    const b = { x0, y0, w, h, x1: x0 + w, y1: y0 + h, roof: o.roof || '#b5543c', wall: o.wall || 0, id: buildings.length + 1, name: o.name };
    buildings.push(b);
    const doors = o.doors || [['s', Math.floor(w / 2)]];
    const isDoor = (x, y) => doors.some(([side, p]) => (side === 's' && y === y0 + h - 1 && (x === x0 + p || x === x0 + p - 1)) ||
      (side === 'n' && y === y0 && (x === x0 + p || x === x0 + p - 1)) || (side === 'e' && x === x0 + w - 1 && (y === y0 + p || y === y0 + p - 1)) ||
      (side === 'w' && x === x0 && (y === y0 + p || y === y0 + p - 1)));
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      bld[idx(x, y)] = b.id; ground[idx(x, y)] = GR.FLOOR;
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      if (edge && !isDoor(x, y)) {
        const win = (x + y) % 3 === 0 && !(x === x0 || x === x0 + w - 1) || (y + x) % 3 === 0 && !(y === y0 || y === y0 + h - 1);
        obj('wall', x, y, 1, 1, { b: b.id, style: b.wall, win, tall: true, v: 0 });
      }
    }
    // interior loot spots
    const ix0 = x0 + 1, iy0 = y0 + 1, iw = w - 2, ih = h - 2;
    spots.crates.push({ x: ix0 + 0.5, y: iy0 + 0.5, b: b.id });
    spots.boxes.push({ x: ix0 + iw - 0.5, y: iy0 + 0.5, b: b.id });
    for (let k = 0; k < Math.max(1, Math.floor(iw * ih / 8)); k++) spots.floor.push({ x: ix0 + R(0.6, iw - 0.6), y: iy0 + R(1.2, ih - 0.4), b: b.id });
    return b;
  }
  building(6, 16, 7, 6, { roof: '#5e7d4a', name: 'Trailer Park' });
  building(14, 16, 6, 6, { roof: '#b5543c', doors: [['e', 3]] });
  building(25, 22, 7, 6, { roof: '#4f6d8c', name: 'Old Town' });
  building(34, 22, 6, 6, { roof: '#b5543c', doors: [['s', 3], ['n', 3]] });
  building(25, 40, 6, 6, { roof: '#8c5a3c', doors: [['n', 3]] });
  building(34, 41, 7, 6, { roof: '#5e7d4a', doors: [['n', 3], ['e', 3]] });
  building(50, 24, 7, 5, { roof: '#d0a03a', wall: 1, name: 'Gas Station', doors: [['w', 2], ['s', 4]] });
  building(54, 7, 7, 6, { roof: '#9c3b30', name: 'Farm', doors: [['s', 3], ['w', 3]] });
  building(62, 5, 8, 8, { roof: '#a33a2a', wall: 2, doors: [['s', 4], ['w', 4]] }); // barn
  const bunker = building(61, 40, 6, 5, { roof: '#6b6f63', wall: 1, name: 'Radio Hill', doors: [['w', 3]] });
  spots.premium.push({ x: bunker.x0 + 3.5, y: bunker.y0 + 2.5 });

  // ---------- points of interest ----------
  // trailer park
  for (const [x, y] of [[5, 4], [11, 4], [5, 9], [11, 9], [16, 7]]) { obj('trailer', x, y, 3, 2, { tall: true }); spots.boxes.push({ x: x + 1.5, y: y + 2.6 }); }
  spots.crates.push({ x: 9.5, y: 7.5 });
  // gas station pumps and sign
  obj('pump', 46, 27); obj('pump', 46, 30); obj('pump', 48, 27); obj('pump', 48, 30); obj('sign', 44, 24, 1, 1, { tall: true });
  spots.crates.push({ x: 47.5, y: 28.6 });
  // overpass ruins on the highway
  for (const [x, y] of [[30, 31], [30, 37], [36, 31], [36, 37], [42, 31], [42, 37]]) obj('pillar', x, y, 1, 1, { tall: true });
  obj('slab', 32, 33, 2, 2, { tall: true }); obj('slab', 39, 34, 2, 2, { tall: true }); obj('rubble', 34, 36); obj('rubble', 28, 32);
  spots.crates.push({ x: 35.5, y: 34.5 });
  // checkpoint with sandbags
  for (const [x, y] of [[33, 6], [34, 6], [35, 6], [38, 6], [39, 6], [40, 6], [33, 12], [34, 12], [38, 12], [39, 12], [40, 12], [33, 9], [40, 9]]) obj('sandbag', x, y);
  obj('tower', 36, 8, 2, 2, { tall: true, small: true });
  spots.crates.push({ x: 35.5, y: 10.5 }, { x: 38.5, y: 10.5 });
  // farm fields
  for (const [x, y] of [[54, 17], [58, 20], [62, 17], [66, 21], [56, 23]]) obj('scarecrow', x, y, 1, 1, { tall: true });
  for (const [x, y] of [[60, 15], [65, 15], [53, 21], [61, 23]]) obj('hay', x, y);
  spots.crates.push({ x: 63.5, y: 14.2 });
  // radio tower
  obj('radio', 66, 35, 2, 2, { tall: true });
  // crashed plane in the dried lake
  obj('fuselage', 13, 54, 2, 2, { tall: true, v: 0 }); obj('fuselage', 15, 54, 2, 2, { tall: true, v: 1 }); obj('fuselage', 17, 54, 2, 2, { tall: true, v: 2 });
  obj('wing', 15, 51, 2, 2, { v: 0 }); obj('wing', 15, 57, 2, 2, { v: 1 });
  spots.crates.push({ x: 19.6, y: 55.0 }, { x: 13.5, y: 57.2 });
  // junkyard: fence ring with gaps, stacks and piles
  for (let x = 50; x < 69; x++) { if (x < 55 || x > 57) obj('fence', x, 50, 1, 1, { v: 0 }); if (x < 59 || x > 61) obj('fence', x, 68, 1, 1, { v: 0 }); }
  for (let y = 51; y < 68; y++) { if (y < 58 || y > 60) obj('fence', 50, y, 1, 1, { v: 1 }); if (y < 54 || y > 56) obj('fence', 68, y, 1, 1, { v: 1 }); }
  for (const [x, y, d] of [[53, 53, 0], [53, 63, 1], [63, 53, 1], [64, 63, 0], [58, 55, 0], [56, 65, 1]]) obj(d ? 'carstackY' : 'carstackX', x, y, d ? 1 : 2, d ? 2 : 1, { tall: true });
  for (const [x, y] of [[60, 58], [54, 58], [63, 60]]) obj('junk', x, y, 2, 2, { tall: true });
  spots.crates.push({ x: 58.5, y: 62.5 }, { x: 65.5, y: 56.5 });

  // ---------- scatter props ----------
  const scatter = (type, n, w, h, ok, o) => { let tries = 0; while (n > 0 && tries++ < 4000) { const x = RI(1, N - 2 - w), y = RI(1, N - 2 - h); if (!free(x - 1, y - 1, w + 2, h + 2)) continue; if (ok && !ok(ground[idx(x, y)], x, y)) continue; obj(type, x, y, w, h, o); n--; } };
  const wild = (g) => g === GR.SAND || g === GR.GRASS || g === GR.MUD;
  scatter('deadtree', 46, 1, 1, wild, { tall: true });
  scatter('rock', 30, 1, 1, wild);
  scatter('cactus', 18, 1, 1, (g) => g === GR.SAND, { tall: true });
  scatter('tyres', 10, 1, 1, (g) => g !== GR.FARM);
  scatter('carX', 6, 2, 1, (g) => g === GR.ROAD, { tall: false });
  scatter('carY', 5, 1, 2, (g) => g === GR.ROAD || g === GR.SAND);
  scatter('carX', 3, 2, 1, (g) => g === GR.GRAVEL);
  // wooden box spots (scattered)
  let tries = 0, nb = 0;
  while (nb < 34 && tries++ < 3000) { const x = RI(2, N - 3), y = RI(2, N - 3); if (!free(x - 1, y - 1, 3, 3)) continue; spots.boxes.push({ x: x + 0.5, y: y + 0.5 }); solid[idx(x, y)] = 0; nb++; }
  tries = 0; while (barrels.length < 16 && tries++ < 3000) { const x = RI(2, N - 3), y = RI(2, N - 3); if (!free(x - 1, y - 1, 3, 3)) continue; barrels.push({ x: x + 0.5, y: y + 0.5 }); }
  barrels.push({ x: 49.5, y: 28.5 }, { x: 52.5, y: 31.2 }, { x: 57.5, y: 52.5 });
  // creature dens
  dens.push({ type: 'dog', x: 60, y: 19, n: 4 }, { type: 'dog', x: 9, y: 26, n: 3 }, { type: 'rat', x: 58, y: 60, n: 7 }, { type: 'rat', x: 15, y: 11, n: 5 },
    { type: 'rat', x: 30, y: 44, n: 4 }, { type: 'crow', x: 20, y: 58, n: 4 }, { type: 'crow', x: 40, y: 18, n: 3 }, { type: 'hog', x: 64, y: 47, n: 1 });
  vehicleSpawns.push({ type: 'buggy', x: 23.5, y: 30.5, a: 1.57 }, { type: 'buggy', x: 41.5, y: 38.8, a: 0 }, { type: 'pickup', x: 53, y: 31.6, a: 3.14 },
    { type: 'pickup', x: 30, y: 52, a: 0.8 }, { type: 'buggy', x: 47.5, y: 15.5, a: 2.2 });

  const W = { N, ground, solid, bld, objects, buildings, spots, dens, vehicleSpawns, barrels };
  return W;
}

// ---------- queries ----------
export function isSolid(W, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= N || ty >= N) return true;
  return W.solid[ty * N + tx] === 1;
}
export function buildingAt(W, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= N || ty >= N) return 0;
  return W.bld[ty * N + tx];
}
export function groundAt(W, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= N || ty >= N) return 0;
  return W.ground[ty * N + tx];
}
// circle vs tile collision, slides along walls. Returns true if hit something.
export function collideCircle(W, e, r) {
  let hit = false;
  for (let it = 0; it < 2; it++) {
    const x0 = Math.floor(e.x - r), x1 = Math.floor(e.x + r), y0 = Math.floor(e.y - r), y1 = Math.floor(e.y + r);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const s = tx < 0 || ty < 0 || tx >= N || ty >= N || W.solid[ty * N + tx] === 1;
      if (!s) continue;
      const cx = Math.max(tx, Math.min(e.x, tx + 1)), cy = Math.max(ty, Math.min(e.y, ty + 1));
      let dx = e.x - cx, dy = e.y - cy; const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 < 1e-6) { // center inside tile: push out shortest way
          const l = e.x - tx, rr = tx + 1 - e.x, t = e.y - ty, b = ty + 1 - e.y, m = Math.min(l, rr, t, b);
          if (m === l) e.x = tx - r; else if (m === rr) e.x = tx + 1 + r; else if (m === t) e.y = ty - r; else e.y = ty + 1 + r;
        } else { const d = Math.sqrt(d2), p = (r - d) / d; e.x += dx * p; e.y += dy * p; }
      }
    }
  }
  return hit;
}
// grid ray march (Amanatides-Woo). Returns true if clear.
export function lineOfSight(W, ax, ay, bx, by) {
  let x = Math.floor(ax), y = Math.floor(ay); const ex = Math.floor(bx), ey = Math.floor(by);
  const dx = bx - ax, dy = by - ay, sx = Math.sign(dx), sy = Math.sign(dy);
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tmx = dx !== 0 ? (sx > 0 ? x + 1 - ax : ax - x) * tdx : Infinity, tmy = dy !== 0 ? (sy > 0 ? y + 1 - ay : ay - y) * tdy : Infinity;
  for (let i = 0; i < 200; i++) {
    if (x === ex && y === ey) return true;
    if (tmx < tmy) { tmx += tdx; x += sx; } else { tmy += tdy; y += sy; }
    if (x < 0 || y < 0 || x >= N || y >= N) return false;
    if (W.solid[y * N + x] === 1 && !(x === ex && y === ey)) return false;
  }
  return true;
}
// A* on the tile grid (8-way, no corner cutting). Returns array of {x,y} waypoints or null.
export function findPath(W, sx, sy, gx, gy, maxNodes = 2500) {
  let s = Math.floor(sy) * N + Math.floor(sx), g = Math.floor(gy) * N + Math.floor(gx);
  if (W.solid[g]) { // snap goal to a free neighbour
    let best = -1; for (let r = 1; r < 4 && best < 0; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const x = (g % N) + i, y = Math.floor(g / N) + j; if (x > 0 && y > 0 && x < N && y < N && !W.solid[y * N + x]) { best = y * N + x; } }
    if (best < 0) return null; g = best;
  }
  const gS = new Float32Array(N * N).fill(1e9), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
  const heap = [], gx2 = g % N, gy2 = Math.floor(g / N);
  const h = (i) => { const dx = Math.abs((i % N) - gx2), dy = Math.abs(Math.floor(i / N) - gy2); return dx + dy - 0.59 * Math.min(dx, dy); };
  const push = (i, f) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top[1]; };
  gS[s] = 0; push(s, h(s)); let n = 0;
  while (heap.length && n++ < maxNodes) {
    const c = pop(); if (c === g) break; if (closed[c]) continue; closed[c] = 1;
    const cx = c % N, cy = Math.floor(c / N);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const ni = y * N + x; if (W.solid[ni] || closed[ni]) continue;
      if (dx && dy && (W.solid[cy * N + x] || W.solid[y * N + cx])) continue;
      const ng = gS[c] + (dx && dy ? 1.414 : 1); if (ng < gS[ni]) { gS[ni] = ng; from[ni] = c; push(ni, ng + h(ni)); }
    }
  }
  if (from[g] < 0 && g !== s) return null;
  const path = []; for (let c = g; c !== s && c >= 0; c = from[c]) path.push({ x: (c % N) + 0.5, y: Math.floor(c / N) + 0.5 });
  path.reverse();
  // string-pull smoothing
  const out = []; let ax = sx, ay = sy, i = 0;
  while (i < path.length) { let j = path.length - 1; while (j > i && !lineOfSight(W, ax, ay, path[j].x, path[j].y)) j--; out.push(path[j]); ax = path[j].x; ay = path[j].y; i = j + 1; }
  return out;
}
