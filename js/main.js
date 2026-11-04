// Boot + main loop (fixed 60 Hz simulation, decoupled rendering).
import { G } from './state.js';
import * as Render from './render.js';
import { Input } from './input.js';
import { Audio, Music } from './audio.js';
import { newMatch, update } from './game.js';
import { loadSettings, initUI, show, drawHUD, showResults } from './ui.js';
import { clearSpriteCache } from './art.js';

loadSettings();
const cv = document.getElementById('game');
Render.init(cv); Input.init(cv);
G.showResults = showResults; window.__G = G;

function startAttract() { newMatch({ bots: 10, difficulty: 'normal' }); G.state = 'menu'; G.blimp.t = 0.3; }
function start() {
  Audio.init(); Audio.play('click'); Music.stop(); Music.start('game');
  newMatch({ bots: G.settings.bots, difficulty: G.settings.difficulty });
  G.cam.x = G.blimp.x; G.cam.y = G.blimp.y; show(null);
  if (matchMedia('(pointer: coarse)').matches) { try { document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch (_) {} }
}
function pause(on) { if (G.state === 'menu') return; G.paused = on; show(on ? 'pause' : null); if (on) Audio.engine(false); }
function menu() { G.paused = false; Audio.engine(false); Music.stop(); Music.start('menu'); startAttract(); show('menu'); }
initUI({ start, pause, menu, resize: () => { Render.resize(); clearSpriteCache(); } });
addEventListener('resize', () => Render.resize());
// first gesture unlocks audio and starts menu music
const unlock = () => { Audio.init(); if (!Music.playing) Music.start(G.state === 'menu' ? 'menu' : 'game'); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state !== 'menu' && !G.paused && G.state !== 'dead' && G.state !== 'win') pause(true); });

startAttract(); show('menu');
let last = performance.now(), acc = 0; const STEP = 1 / 60;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  Input.poll();
  // global hotkeys
  if (G.state !== 'menu') {
    if (Input.hit('pause')) { if (G.paused) pause(false); else if (!G.uiBlock) pause(true); else if (document.getElementById('results').classList.contains('hidden')) pause(false); }
    if (Input.hit('map') && !G.paused) G.mapOpen = !G.mapOpen;
    if (Input.hit('help') && !G.paused) { pause(true); show('howto'); }
  }
  let ran = false;
  if (!G.paused) {
    acc += dt; let n = 0;
    while (acc >= STEP && n < 6) { update(STEP); acc -= STEP; n++; if (!ran) { Input.endFrame(); ran = true; } if (G.state === 'menu') break; }
    if (G.state === 'menu') { acc = 0; const a = now / 9000; G.cam.x = 36 + Math.cos(a) * 14; G.cam.y = 36 + Math.sin(a) * 14; }
  } else ran = true;
  if (ran) Input.endFrame();
  if (G.state === 'menu') { const saved = G.player; Render.draw(dt); } else Render.draw(dt);
  drawHUD(Render.R.ctx, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
