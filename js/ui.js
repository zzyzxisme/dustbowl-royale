// HUD (canvas), minimap/full map, DOM menus, loot panel, touch buttons, settings persistence.
import { G } from './state.js';
import { R } from './render.js';
import { N, GR } from './world.js';
import { WEAPONS, HEALS, itemName, itemColor, ARMOR } from './data.js';
import { drawIcon, iconURL, ell, OL } from './art.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { fmtTime, clamp, worldDirToScreenAngle } from './util.js';
import { ammoCap } from './entities.js';

const $ = (s) => document.querySelector(s);
const DEFAULTS = { master: 0.8, music: 0.55, sfx: 0.85, musicOn: true, sfxOn: true, quality: 'high', shake: true, aimAssist: true, fps: false, bots: 15, difficulty: 'normal' };
export function loadSettings() {
  let s = {}; try { s = JSON.parse(localStorage.getItem('dustbowl.settings') || '{}'); } catch (_) {}
  G.settings = { ...DEFAULTS, ...s };
  if (!s.quality && matchMedia('(pointer: coarse)').matches) G.settings.quality = 'medium';
  Object.assign(Audio.settings, G.settings);
}
export function saveSettings() { try { localStorage.setItem('dustbowl.settings', JSON.stringify(G.settings)); } catch (_) {} Object.assign(Audio.settings, G.settings); Audio.apply(); }

// ---------------- screens ----------------
let screenStack = [];
export function show(id) { document.querySelectorAll('.screen').forEach((e) => e.classList.add('hidden')); if (id) $('#' + id).classList.remove('hidden'); G.uiBlock = !!id; document.body.classList.toggle('in-menu', !!id); }
function sync() {
  const s = G.settings;
  $('#s-music').checked = s.musicOn; $('#s-sfx').checked = s.sfxOn; $('#s-master').value = s.master; $('#s-musicv').value = s.music; $('#s-sfxv').value = s.sfx;
  $('#s-quality').value = s.quality; $('#s-shake').checked = s.shake; $('#s-assist').checked = s.aimAssist; $('#s-fps').checked = s.fps;
  $('#bots').value = s.bots; $('#bots-n').textContent = s.bots; document.querySelectorAll('#diff button').forEach((b) => b.classList.toggle('on', b.dataset.d === s.difficulty));
  $('#q-music').textContent = s.musicOn ? '🎵' : '🔇'; $('#q-sfx').textContent = s.sfxOn ? '🔊' : '🔈';
}
export function initUI(hooks) {
  const click = () => Audio.play('click');
  document.querySelectorAll('button').forEach((b) => b.addEventListener('click', click));
  $('#play').onclick = () => hooks.start();
  $('#howto-btn').onclick = () => { screenStack.push(currentScreen()); show('howto'); };
  $('#settings-btn').onclick = () => { screenStack.push(currentScreen()); sync(); show('settings'); };
  $('#p-settings').onclick = () => { screenStack.push('pause'); sync(); show('settings'); };
  $('#p-howto').onclick = () => { screenStack.push('pause'); show('howto'); };
  document.querySelectorAll('.back').forEach((b) => (b.onclick = () => show(screenStack.pop() || (G.state === 'menu' ? 'menu' : null))));
  $('#p-resume').onclick = () => hooks.pause(false);
  $('#p-quit').onclick = () => hooks.menu();
  $('#r-again').onclick = () => hooks.start();
  $('#r-menu').onclick = () => hooks.menu();
  $('#bots').oninput = (e) => { G.settings.bots = +e.target.value; $('#bots-n').textContent = e.target.value; saveSettings(); };
  document.querySelectorAll('#diff button').forEach((b) => (b.onclick = () => { G.settings.difficulty = b.dataset.d; sync(); saveSettings(); }));
  const bind = (id, key, num) => $(id).addEventListener('input', (e) => { G.settings[key] = e.target.type === 'checkbox' ? e.target.checked : num ? +e.target.value : e.target.value; saveSettings(); sync(); if (key === 'quality') hooks.resize(); });
  bind('#s-music', 'musicOn'); bind('#s-sfx', 'sfxOn'); bind('#s-master', 'master', 1); bind('#s-musicv', 'music', 1); bind('#s-sfxv', 'sfx', 1);
  bind('#s-quality', 'quality'); bind('#s-shake', 'shake'); bind('#s-assist', 'aimAssist'); bind('#s-fps', 'fps');
  $('#q-music').onclick = () => { G.settings.musicOn = !G.settings.musicOn; saveSettings(); sync(); };
  $('#q-sfx').onclick = () => { G.settings.sfxOn = !G.settings.sfxOn; saveSettings(); sync(); };
  $('#q-pause').onclick = () => hooks.pause(true);
  // touch buttons
  document.querySelectorAll('#touch [data-a]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); G.inputMode = 'touch'; Input.press(b.dataset.a); if (b.dataset.a2) Input.press(b.dataset.a2); }));
  $('#loot-all').onclick = () => { if (G.lootOpen) { G.loot.takeAll(G.player, G.lootOpen); if (!G.lootOpen.items.length) G.lootOpen = null; } };
  $('#loot-x').onclick = () => { G.lootOpen = null; };
  sync();
}
function currentScreen() { const e = [...document.querySelectorAll('.screen')].find((x) => !x.classList.contains('hidden')); return e ? e.id : null; }

export function showResults() {
  const p = G.player, win = !p.dead, place = win ? 1 : p.place;
  $('#r-title').textContent = win ? 'LAST CHONK STANDING!' : place <= 5 ? 'SO CLOSE! #' + place : 'YOU GOT DUSTED!';
  $('#r-sub').textContent = win ? 'Dinner is a warm can of beans. You earned it.' : G.killer ? `KO'd by ${G.killer.name}` + (G.killer.dead ? '' : ' — spectating them now') : 'The wasteland claimed another chubby hero.';
  $('#r-place').textContent = '#' + place + ' / ' + G.total; $('#r-kills').textContent = p.kills; $('#r-dmg').textContent = Math.round(p.dmg); $('#r-time').textContent = fmtTime(G.time);
  $('#results').classList.toggle('win', win);
  show('results');
}

// ---------------- loot panel ----------------
let lootSig = '';
function updateLootPanel() {
  const c = G.lootOpen, el = $('#loot');
  if (!c || G.player.dead) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); lootSig = ''; return; }
  el.classList.remove('hidden');
  const sig = c.id + ':' + c.items.map(itemName).join('|') + G.player.inv.w.map((w) => w && w.id).join();
  if (sig === lootSig) return; lootSig = sig;
  $('#loot-title').textContent = c.ck === 'deathbox' ? `${c.name}'s stash` : c.ck === 'airdrop' ? 'Supply Drop' : c.ck === 'premium' ? 'Bunker Locker' : 'Loot Crate';
  const list = $('#loot-items'); list.innerHTML = '';
  if (!c.items.length) list.innerHTML = '<div class="empty">Empty</div>';
  c.items.forEach((it, i) => {
    const b = document.createElement('button'); b.className = 'item'; b.style.setProperty('--c', itemColor(it));
    b.innerHTML = `<img src="${iconURL(it)}" alt=""><span>${itemName(it)}</span>`;
    b.onclick = () => { G.loot.takeItem(G.player, c, i); lootSig = ''; };
    list.appendChild(b);
  });
  $('#loot-all').textContent = G.inputMode === 'pad' ? 'Take All (A)' : G.inputMode === 'touch' ? 'Take All' : 'Take All [E]';
}

// ---------------- minimap ----------------
let miniCv = null;
function buildMini() {
  const W = G.world; miniCv = document.createElement('canvas'); miniCv.width = miniCv.height = N; const c = miniCv.getContext('2d'); const img = c.createImageData(N, N);
  const col = { [GR.SAND]: [217, 183, 126], [GR.ROAD]: [91, 85, 80], [GR.LINE]: [91, 85, 80], [GR.GRASS]: [184, 176, 106], [GR.MUD]: [201, 168, 124], [GR.FARM]: [167, 131, 79], [GR.FLOOR]: [140, 90, 60], [GR.CONCRETE]: [169, 163, 151], [GR.GOO]: [126, 217, 87], [GR.GRAVEL]: [155, 143, 125] };
  for (let i = 0; i < N * N; i++) { let k = col[W.ground[i]] || [0, 0, 0]; if (W.solid[i]) k = W.bld[i] ? [90, 50, 40] : k.map((v) => v * 0.65); if (W.bld[i] && !W.solid[i]) k = [150, 95, 65]; img.data.set([...k, 255], i * 4); }
  c.putImageData(img, 0, 0);
}
function drawMap(ctx, cx, cy, size, full) {
  if (!miniCv) buildMini();
  const k = size / (N * 2), st = G.storm, p = G.player;
  ctx.save(); ctx.translate(cx, cy - size / 4);
  ctx.save(); ctx.transform(k, k / 2, -k, k / 2, 0, 0);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(miniCv, 0, 0); ctx.imageSmoothingEnabled = true;
  ctx.strokeStyle = OL; ctx.lineWidth = 2 / k; ctx.strokeRect(0, 0, N, N);
  if (st) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, N, N); ctx.clip();
    ctx.beginPath(); ctx.rect(0, 0, N, N); ctx.arc(st.cx, st.cy, Math.max(0.1, st.r), 0, Math.PI * 2, true); ctx.fillStyle = 'rgba(110,170,40,0.45)'; ctx.fill('evenodd');
    ctx.strokeStyle = '#c8ff7a'; ctx.lineWidth = 1.6 / k; ctx.beginPath(); ctx.arc(st.cx, st.cy, Math.max(0.1, st.r), 0, 7); ctx.stroke();
    if (st.nr > 0) { ctx.strokeStyle = '#fff'; ctx.setLineDash([3 / k, 2 / k]); ctx.beginPath(); ctx.arc(st.ncx, st.ncy, st.nr, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }
  const bl = G.blimp; if (bl && bl.t < 1) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2 / k; ctx.setLineDash([2 / k, 2 / k]); ctx.beginPath(); ctx.moveTo(bl.x0, bl.y0); ctx.lineTo(bl.x1, bl.y1); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(bl.x, bl.y, 1.4, 0, 7); ctx.fill(); }
  for (const c of G.containers) if (c.ck === 'airdrop') { ctx.fillStyle = '#3f86d6'; ctx.fillRect(c.x - 1, c.y - 1, 2, 2); }
  if (full) for (const v of G.vehicles) { ctx.fillStyle = '#ffd35a'; ctx.fillRect(v.x - 0.7, v.y - 0.7, 1.4, 1.4); }
  ctx.restore();
  // player marker (screen space, arrow)
  const px = (p.x - p.y) * k, py = (p.x + p.y) * k / 2;
  ctx.translate(px, py); ctx.rotate(p.aimScreen); ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fillStyle = '#ffd35a'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  if (full) {
    ctx.font = '800 13px "Lilita One", system-ui'; ctx.textAlign = 'center';
    for (const b of G.world.buildings) if (b.name) { const X = cx + (b.x0 + b.w / 2 - b.y0 - b.h / 2) * k, Y = cy - size / 4 + (b.x0 + b.w / 2 + b.y0 + b.h / 2) * k / 2; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(b.name, X, Y - 8); ctx.fillStyle = '#fff'; ctx.fillText(b.name, X, Y - 8); }
    for (const [n, x, y] of [['Junkyard', 59, 59], ['Dry Lake', 18, 56], ['Fields', 60, 20], ['Overpass', 36, 34], ['Checkpoint', 37, 9]]) { const X = cx + (x - y) * k, Y = cy - size / 4 + (x + y) * k / 2; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(n, X, Y); ctx.fillStyle = '#ffe9c0'; ctx.fillText(n, X, Y); }
  }
}

// ---------------- HUD ----------------
function panel(ctx, x, y, w, h, r = 10, a = 0.55) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = `rgba(30,20,12,${a})`; ctx.fill(); ctx.strokeStyle = 'rgba(255,233,192,0.18)'; ctx.lineWidth = 1.5; ctx.stroke(); }
function txt(ctx, s, x, y, size = 14, col = '#fff', align = 'left', weight = 800) { ctx.font = `${weight} ${size}px "Lilita One", system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,12,6,0.85)'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); }
function key(k) { const m = G.inputMode; if (m === 'pad') return { E: 'A', R: 'X', G: 'RB', H: 'LB', M: 'View', Space: 'A' }[k] || k; if (m === 'touch') return ''; return k; }
let fpsT = 0, fpsN = 0, fps = 60;
export function drawHUD(ctx, dt) {
  const W = R.W, H = R.H, p = G.player, touch = G.inputMode === 'touch', small = W < 760 || H < 500;
  updateLootPanel();
  $('#touch').classList.toggle('hidden', !(touch && G.state !== 'menu' && !G.uiBlock));
  if (G.state === 'menu') return;
  ctx.textBaseline = 'middle';
  const sc = small ? 0.8 : 1;
  // ---- top-right: minimap + counters ----
  const ms = (small || touch ? 124 : 180); const mx = W - ms / 2 - 14, my = 14 + ms / 4 + 4;
  panel(ctx, W - ms - 22, 8, ms + 16, ms / 2 + 64, 12);
  drawMap(ctx, mx, my + ms / 4 - 2, ms, false);
  const st = G.storm;
  txt(ctx, `👥 ${G.alive}`, W - ms - 12, ms / 2 + 34, 15 * sc); txt(ctx, `💀 ${p.kills}`, W - 16, ms / 2 + 34, 15 * sc, '#fff', 'right');
  const sMsg = st.phase >= 5 ? 'Final storm!' : st.mode === 'wait' ? `Storm moves in ${fmtTime(st.t)}` : `Storm closing ${fmtTime(st.t)}`;
  txt(ctx, sMsg, W - ms / 2 - 14, ms / 2 + 56, 13 * sc, st.mode === 'shrink' ? '#c8ff7a' : '#ffe9c0', 'center');
  // ---- top-left: kill feed ----
  let fy = touch ? 72 : 16;
  for (const k of G.killFeed) { ctx.globalAlpha = clamp(k.t, 0, 1); ctx.font = `800 ${13 * sc}px "Lilita One", system-ui`; const w = ctx.measureText(k.text).width + 18; panel(ctx, 12, fy, w, 22, 8, k.mine ? 0.75 : 0.5); txt(ctx, k.text, 21, fy + 11, 13 * sc, k.mine ? '#ffd35a' : '#fff'); fy += 26; }
  ctx.globalAlpha = 1;
  // ---- toasts ----
  let ty = H * 0.2; for (const t of G.toasts) { ctx.globalAlpha = clamp(t.t * 2, 0, 1); txt(ctx, t.text, W / 2, ty, 19 * sc, t.col || '#fff', 'center'); ty += 28; } ctx.globalAlpha = 1;
  if (p.dead) return drawFps(ctx, dt);
  // ---- damage direction ----
  for (const d of G.dmgInd) { const a = worldDirToScreenAngle(Math.cos(d.a), Math.sin(d.a)); ctx.globalAlpha = clamp(d.t, 0, 1); ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(W / 2, H / 2, 90, a - 0.3, a + 0.3); ctx.stroke(); } ctx.globalAlpha = 1;
  // ---- drop phase hint ----
  if (p.drop === 'blimp') { const msg = G.inputMode === 'pad' ? 'Press A to jump' : touch ? 'Tap JUMP to drop' : 'Press SPACE to jump'; panel(ctx, W / 2 - 150, H - 120, 300, 44, 12, 0.7); txt(ctx, msg, W / 2, H - 98, 20, '#ffd35a', 'center'); }
  if (p.drop === 'fall') txt(ctx, `Altitude ${Math.round(p.dropZ / 5)} m`, W / 2, H - 110, 18, '#fff', 'center');
  // ---- bottom center: health ----
  const bw = Math.min(touch ? 260 : 320, W * 0.3), bx = 18, by = touch ? 14 : H - 36;
  panel(ctx, bx - 6, by - 6, bw + 12, 30, 10, 0.6);
  ctx.fillStyle = '#3a1f14'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 18, 6); ctx.fill();
  const hpc = p.hp > 60 ? '#7dff9a' : p.hp > 30 ? '#ffd35a' : '#ff5a4a';
  ctx.fillStyle = hpc; ctx.beginPath(); ctx.roundRect(bx, by, bw * clamp(p.hp / 100, 0, 1), 18, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx + 4, by + 3, bw * clamp(p.hp / 100, 0, 1) - 8, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx + bw * 0.75, by, 2, 18);
  txt(ctx, Math.ceil(p.hp) + '', bx + bw / 2, by + 9, 13, '#fff', 'center');
  if (p.boost > 0) { ctx.fillStyle = '#5fb3e6'; ctx.fillRect(bx, by - 6, bw * p.boost / 100, 3); }
  // armor icons
  ['helmet', 'vest'].forEach((slot, i) => {
    const a = p.inv[slot]; if (!a) return;
    const x = touch ? bx + bw + 24 + i * 34 : bx + 14 + i * 36, y = touch ? by + 8 : by - 30;
    ctx.save(); ctx.translate(x, y); ctx.scale(0.55, 0.55); drawIcon(ctx, { t: slot, lvl: a.lvl }); ctx.restore();
    const f = clamp(a.dur / ARMOR[slot][a.lvl].dur, 0, 1); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 12, y + 12, 24, 3); ctx.fillStyle = '#fff'; ctx.fillRect(x - 12, y + 12, 24 * f, 3);
  });
  if (p.inv.pack && !touch) txt(ctx, `🎒 Lv.${p.inv.pack}`, bx + 88, by - 30, 12, '#ffe9c0');
  // ---- weapons ----
  const inv = p.inv, slots = [inv.w[0], inv.w[1], inv.melee];
  const sw = small || touch ? 84 : 118, sh = touch ? 46 : 54, gap = 8;
  const wx0 = touch ? W / 2 - (sw * 3 + gap * 2) / 2 - 30 : W - (sw + gap) * 3 - 8, wy = touch ? H - sh - 8 : H - sh - 14;
  slots.forEach((w, i) => {
    const x = wx0 + i * (sw + gap), on = inv.slot === i;
    panel(ctx, x, wy, sw, sh, 10, on ? 0.78 : 0.45);
    if (on) { ctx.strokeStyle = '#ffd35a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x, wy, sw, sh, 10); ctx.stroke(); }
    if (!touch) txt(ctx, String(i + 1), x + 9, wy + 11, 11, '#ffe9c0');
    if (w) {
      ctx.save(); ctx.translate(x + sw / 2, wy + (touch ? 18 : 22)); ctx.scale(small || touch ? 0.75 : 1, small || touch ? 0.75 : 1); drawIcon(ctx, w); ctx.restore();
      if (w.id !== 'wrench') { const d = WEAPONS[w.id]; txt(ctx, `${w.mag}/${inv.ammo[d.ammo]}`, x + sw / 2, wy + sh - 9, 13, w.mag === 0 ? '#ff5a4a' : '#fff', 'center'); }
      else txt(ctx, 'Melee', x + sw / 2, wy + sh - 9, 12, '#ffe9c0', 'center');
    } else txt(ctx, 'empty', x + sw / 2, wy + sh / 2, 12, 'rgba(255,255,255,0.4)', 'center');
  });
  // ---- consumables ----
  if (!touch) {
    const items = [['bandage', 'H'], ['medkit', 'J'], ['soda', 'K']];
    let cx = wx0 - 10;
    const gx = cx - 50; panel(ctx, gx, wy, 46, sh, 10); ctx.save(); ctx.translate(gx + 23, wy + 22); ctx.scale(0.6, 0.6); drawIcon(ctx, { t: 'grenade', n: 1 }); ctx.restore(); txt(ctx, `${key('G')} ×${inv.grenades}`, gx + 23, wy + sh - 9, 11, inv.grenades ? '#fff' : '#888', 'center');
    cx = gx - 6;
    for (let i = items.length - 1; i >= 0; i--) { const [id, k] = items[i]; cx -= 46; panel(ctx, cx, wy, 42, sh, 10); ctx.save(); ctx.translate(cx + 21, wy + 22); ctx.scale(0.55, 0.55); drawIcon(ctx, { t: 'heal', id }); ctx.restore(); txt(ctx, `${G.inputMode === 'pad' ? '' : k} ×${inv.heals[id]}`, cx + 21, wy + sh - 9, 11, inv.heals[id] ? '#fff' : '#888', 'center'); }
  } else {
    txt(ctx, `🩹${inv.heals.bandage} 💊${inv.heals.medkit} 🥤${inv.heals.soda} 🫙${inv.grenades}`, 16, 48, 13, '#fff');
  }
  // ---- interact prompt ----
  const it = G.interact;
  if (it && !G.lootOpen && p.drop === 'ground' && !p.vehicle) {
    const lab = it.k === 'pickup' ? `Take ${itemName(it.o.item)}` : it.k === 'box' ? 'Smash Wooden Box' : it.k === 'vehicle' ? `Drive ${it.o.def.name}` : it.o.ck === 'deathbox' ? `Loot ${it.o.name}'s stash` : it.o.ck === 'airdrop' ? 'Open Supply Drop' : 'Open Loot Crate';
    const kk = key('E'); const s = (kk ? `[${kk}] ` : '') + lab;
    ctx.font = '800 16px "Lilita One", system-ui'; const w = ctx.measureText(s).width + 28; panel(ctx, W / 2 - w / 2, H * 0.62, w, 34, 10, 0.72); txt(ctx, s, W / 2, H * 0.62 + 17, 16, '#ffd35a', 'center');
  }
  if (p.vehicle) { const v = p.vehicle, s = `${v.def.name}  ${Math.round(Math.abs(v.speed) * 7)} km/h  ♥${Math.ceil(v.hp)}`; ctx.font = '800 15px "Lilita One", system-ui'; const w = ctx.measureText(s).width + 26; panel(ctx, W / 2 - w / 2, H * 0.66, w, 30, 10, 0.7); txt(ctx, s, W / 2, H * 0.66 + 15, 15, '#fff', 'center'); txt(ctx, G.inputMode === 'pad' ? 'A: exit · B: brake' : touch ? 'Tap USE to exit' : '[E] exit · [Space] brake · [Q] horn', W / 2, H * 0.66 + 44, 12, '#ffe9c0', 'center'); }
  // touch: draw sticks + contextual labels
  if (touch) {
    for (const k of ['move', 'aim']) { const s = Input.touch[k]; if (!s) continue; ell(ctx, s.ox, s.oy, 60, 60, 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.4)', 2); const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy), m = Math.min(l, 60); ell(ctx, s.ox + (l ? dx / l * m : 0), s.oy + (l ? dy / l * m : 0), 26, 26, k === 'aim' && l > 33 ? 'rgba(255,90,74,0.6)' : 'rgba(255,255,255,0.45)', null); }
    $('#t-use').textContent = p.drop === 'blimp' ? 'JUMP' : G.lootOpen ? 'TAKE' : p.vehicle ? 'EXIT' : it ? (it.k === 'vehicle' ? 'DRIVE' : 'USE') : 'USE';
  }
  if (G.mapOpen) { ctx.fillStyle = 'rgba(20,12,6,0.82)'; ctx.fillRect(0, 0, W, H); const s = Math.min(W * 0.9, H * 1.7); drawMap(ctx, W / 2, H / 2 + s / 4 - s / 4, s, true); txt(ctx, 'RUSTWATER FLATS', W / 2, 70, 24, '#ffd35a', 'center'); txt(ctx, (G.inputMode === 'pad' ? 'View' : touch ? 'Tap MAP' : 'M') + ' to close', W / 2, H - 24, 14, '#ffe9c0', 'center'); }
  drawFps(ctx, dt);
}
function drawFps(ctx, dt) { fpsT += dt; fpsN++; if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; } if (G.settings.fps) txt(ctx, fps + ' fps', 10, R.H - 14, 12, '#fff'); }
