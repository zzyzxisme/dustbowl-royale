// All sound is synthesized live with the Web Audio API: SFX, positional audio, engine loop, storm wind and adaptive music.
export const Audio = {
  ctx: null, master: null, sfxBus: null, musicBus: null, noise: null, listener: { x: 0, y: 0 },
  settings: { master: 0.8, music: 0.55, sfx: 0.85, musicOn: true, sfxOn: true },
  intensity: 0, engineNode: null, windNode: null, lastPlay: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = c.createGain(); this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master.connect(this.comp).connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    // reverb (generated impulse) for space
    this.verb = c.createConvolver(); const len = c.sampleRate * 1.8, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb.buffer = ir; this.verbGain = c.createGain(); this.verbGain.gain.value = 0.22; this.verb.connect(this.verbGain).connect(this.master);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noise = nb;
    this.apply(); Music.init(this);
  },
  apply() {
    if (!this.ctx) return; const s = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfxOn ? s.sfx : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.musicOn ? s.music * 0.6 : 0, t, 0.1);
  },
  // build a voice chain: returns {out(gain), pan, t}
  voice(x, y, vol = 1, maxD = 26) {
    const c = this.ctx; let g = vol, p = 0;
    if (x !== undefined && x !== null) {
      const dx = x - this.listener.x, dy = y - this.listener.y, d = Math.hypot(dx, dy);
      if (d > maxD) return null; g *= Math.pow(1 - d / maxD, 1.6); p = Math.max(-1, Math.min(1, (dx - dy) / 14));
    }
    const out = c.createGain(); out.gain.value = g; let node = out;
    if (c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = p; out.connect(pn); node = pn; }
    node.connect(this.sfxBus); if (g > 0.15) { const s = c.createGain(); s.gain.value = 0.5; node.connect(s).connect(this.verb); }
    return { out, t: c.currentTime };
  },
  osc(v, type, f0, f1, t0, dur, vol, curve = 'exp') {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) curve === 'exp' ? o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur) : o.frequency.linearRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(v.out); o.start(t0); o.stop(t0 + dur + 0.05); return o;
  },
  nz(v, t0, dur, vol, ftype, f0, f1, q = 1) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; s.loopStart = Math.random(); f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(v.out); s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  },
  play(name, x, y, vol = 1) {
    if (!this.ctx || !this.settings.sfxOn) return;
    const now = this.ctx.currentTime; const k = name + (x === undefined ? '' : 'p');
    if (this.lastPlay[k] && now - this.lastPlay[k] < 0.025) return; this.lastPlay[k] = now;
    const S = SFX[name]; if (!S) return; const v = this.voice(x, y, vol, S.range || 26); if (!v) return; S.fn(this, v, v.t);
  },
  setListener(x, y) { this.listener.x = x; this.listener.y = y; },
  engine(on, speed = 0) {
    if (!this.ctx) return; const c = this.ctx;
    if (on && !this.engineNode) {
      const g = c.createGain(); g.gain.value = 0; const o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter();
      o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 500; o1.connect(f); o2.connect(f); f.connect(g).connect(this.sfxBus); o1.start(); o2.start();
      this.engineNode = { g, o1, o2, f };
    }
    if (!this.engineNode) return; const e = this.engineNode, t = c.currentTime;
    if (!on) { e.g.gain.setTargetAtTime(0, t, 0.1); setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch (_) {} }, 600); this.engineNode = null; return; }
    const sp = Math.min(1, Math.abs(speed) / 15);
    e.o1.frequency.setTargetAtTime(38 + sp * 70, t, 0.08); e.o2.frequency.setTargetAtTime(19 + sp * 35 + Math.random() * 2, t, 0.08);
    e.f.frequency.setTargetAtTime(300 + sp * 1200, t, 0.1); e.g.gain.setTargetAtTime(0.09 + sp * 0.08, t, 0.1);
  },
  wind(level) {
    if (!this.ctx) return; const c = this.ctx;
    if (!this.windNode) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.8; g.gain.value = 0; s.connect(f).connect(g).connect(this.sfxBus); s.start(); this.windNode = { f, g }; }
    const t = c.currentTime; this.windNode.g.gain.setTargetAtTime(0.02 + level * 0.25, t, 0.4); this.windNode.f.frequency.setTargetAtTime(300 + level * 500 + Math.sin(t * 0.7) * 120, t, 0.3);
  },
};

const gun = (thump, crack, tail, vol = 1) => ({ fn: (A, v, t) => {
  A.osc(v, 'sine', thump, 40, t, 0.12 + tail * 0.1, 0.9 * vol); A.nz(v, t, 0.05 + tail * 0.12, 0.7 * vol, 'lowpass', crack, 300); A.nz(v, t, 0.02, 0.5 * vol, 'highpass', 3000, 3000);
  A.osc(v, 'square', crack / 8, 50, t, 0.05, 0.12 * vol); }, range: 40 });
const SFX = {
  pistol: gun(180, 5000, 0.2), smg: gun(160, 4200, 0.1, 0.75), rifle: gun(140, 4500, 0.35), shotgun: gun(110, 2600, 0.8, 1.2), sniper: gun(90, 6000, 1.2, 1.3),
  swing: { fn: (A, v, t) => A.nz(v, t, 0.15, 0.3, 'bandpass', 800, 2400, 2) },
  bonk: { fn: (A, v, t) => { A.osc(v, 'triangle', 620, 180, t, 0.18, 0.6); A.nz(v, t, 0.06, 0.5, 'lowpass', 1800, 400); } },
  empty: { fn: (A, v, t) => A.nz(v, t, 0.03, 0.4, 'highpass', 4000, 4000) },
  reload: { fn: (A, v, t) => { A.nz(v, t, 0.04, 0.4, 'bandpass', 2500, 2500, 4); A.nz(v, t + 0.25, 0.05, 0.5, 'bandpass', 1800, 1800, 4); A.osc(v, 'square', 900, 700, t + 0.5, 0.04, 0.12); } },
  hit: { fn: (A, v, t) => { A.nz(v, t, 0.07, 0.6, 'lowpass', 1400, 300); A.osc(v, 'sine', 240, 90, t, 0.1, 0.5); } },
  hitme: { fn: (A, v, t) => { A.nz(v, t, 0.1, 0.8, 'lowpass', 900, 200); A.osc(v, 'triangle', 300, 120, t, 0.15, 0.4); } },
  armor: { fn: (A, v, t) => { A.osc(v, 'square', 1400, 900, t, 0.06, 0.2); A.nz(v, t, 0.04, 0.4, 'highpass', 5000, 5000); } },
  boing: { fn: (A, v, t) => { const o = A.osc(v, 'sine', 300, 300, t, 0.35, 0.5); o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(520, t + 0.1); o.frequency.linearRampToValueAtTime(260, t + 0.3); } },
  death: { fn: (A, v, t) => { A.osc(v, 'sawtooth', 420, 90, t, 0.5, 0.25); A.osc(v, 'sine', 300, 60, t + 0.05, 0.6, 0.4); } },
  step: { fn: (A, v, t) => A.nz(v, t, 0.05, 0.12, 'lowpass', 500, 200), range: 12 },
  explode: { fn: (A, v, t) => { A.osc(v, 'sine', 120, 25, t, 1.0, 1); A.nz(v, t, 1.4, 1, 'lowpass', 2500, 80); A.nz(v, t, 0.15, 0.6, 'highpass', 2000, 800); }, range: 55 },
  box: { fn: (A, v, t) => { A.nz(v, t, 0.18, 0.7, 'bandpass', 700, 300, 2); A.osc(v, 'triangle', 200, 80, t, 0.15, 0.5); for (let i = 0; i < 3; i++) A.nz(v, t + 0.05 + i * 0.05, 0.05, 0.3, 'bandpass', 1500 - i * 300, 900, 3); } },
  crate: { fn: (A, v, t) => { A.osc(v, 'sawtooth', 160, 260, t, 0.25, 0.15, 'lin'); A.nz(v, t, 0.2, 0.3, 'bandpass', 900, 1500, 5); [880, 1109, 1319].forEach((f, i) => A.osc(v, 'sine', f, f, t + 0.15 + i * 0.07, 0.4, 0.18)); } },
  pickup: { fn: (A, v, t) => { A.osc(v, 'square', 660, 660, t, 0.07, 0.12); A.osc(v, 'square', 990, 990, t + 0.06, 0.1, 0.12); } },
  equip: { fn: (A, v, t) => { A.nz(v, t, 0.05, 0.4, 'bandpass', 2000, 2000, 3); A.osc(v, 'triangle', 500, 800, t, 0.1, 0.25); } },
  heal: { fn: (A, v, t) => { [523, 659, 784, 1046].forEach((f, i) => A.osc(v, 'sine', f, f, t + i * 0.08, 0.3, 0.2)); } },
  soda: { fn: (A, v, t) => { A.nz(v, t, 0.2, 0.5, 'highpass', 3000, 6000); for (let i = 0; i < 6; i++) A.osc(v, 'sine', 1500 + Math.random() * 1500, 2500, t + 0.15 + i * 0.04, 0.04, 0.08); } },
  bark: { fn: (A, v, t) => { A.osc(v, 'sawtooth', 380, 160, t, 0.16, 0.35); A.nz(v, t, 0.12, 0.4, 'bandpass', 900, 500, 3); A.osc(v, 'sawtooth', 340, 140, t + 0.2, 0.14, 0.3); } },
  growl: { fn: (A, v, t) => { const o = A.osc(v, 'sawtooth', 70, 60, t, 0.7, 0.25); A.nz(v, t, 0.7, 0.3, 'bandpass', 300, 250, 6); } },
  caw: { fn: (A, v, t) => { A.osc(v, 'sawtooth', 900, 500, t, 0.25, 0.25); A.nz(v, t, 0.22, 0.25, 'bandpass', 1400, 1100, 5); A.osc(v, 'sawtooth', 850, 450, t + 0.3, 0.2, 0.2); }, range: 30 },
  squeak: { fn: (A, v, t) => { A.osc(v, 'sine', 2600, 3400, t, 0.08, 0.2); A.osc(v, 'sine', 3000, 2400, t + 0.1, 0.06, 0.15); }, range: 16 },
  grunt: { fn: (A, v, t) => { A.osc(v, 'sawtooth', 110, 60, t, 0.45, 0.45); A.nz(v, t, 0.4, 0.5, 'lowpass', 600, 200); }, range: 34 },
  squish: { fn: (A, v, t) => { A.nz(v, t, 0.2, 0.6, 'lowpass', 1200, 150); A.osc(v, 'sine', 200, 60, t, 0.2, 0.4); } },
  horn: { fn: (A, v, t) => { A.osc(v, 'square', 392, 392, t, 0.4, 0.15); A.osc(v, 'square', 494, 494, t, 0.4, 0.12); }, range: 40 },
  crash: { fn: (A, v, t) => { A.nz(v, t, 0.4, 0.8, 'lowpass', 3000, 200); A.osc(v, 'sine', 90, 40, t, 0.3, 0.7); for (let i = 0; i < 4; i++) A.osc(v, 'square', 1800 + i * 400, 1200, t + i * 0.04, 0.06, 0.06); } },
  door: { fn: (A, v, t) => { A.nz(v, t, 0.1, 0.5, 'bandpass', 1200, 1200, 4); A.osc(v, 'square', 200, 150, t, 0.08, 0.2); } },
  throw: { fn: (A, v, t) => A.nz(v, t, 0.2, 0.3, 'bandpass', 600, 1800, 2) },
  click: { fn: (A, v, t) => A.osc(v, 'triangle', 900, 1200, t, 0.05, 0.2) },
  zone: { fn: (A, v, t) => { [440, 330, 440, 330].forEach((f, i) => A.osc(v, 'square', f, f, t + i * 0.22, 0.2, 0.1)); } },
  airdrop: { fn: (A, v, t) => { A.osc(v, 'sine', 200, 120, t, 1.2, 0.3); A.nz(v, t, 1.5, 0.2, 'lowpass', 400, 200); } },
  jump: { fn: (A, v, t) => { A.nz(v, t, 0.8, 0.5, 'bandpass', 500, 1500, 1); } },
  chute: { fn: (A, v, t) => { A.nz(v, t, 0.25, 0.6, 'bandpass', 900, 300, 1.5); } },
  win: { fn: (A, v, t) => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => { A.osc(v, 'square', f, f, t + i * 0.13, 0.25, 0.12); A.osc(v, 'triangle', f / 2, f / 2, t + i * 0.13, 0.25, 0.2); }); } },
  lose: { fn: (A, v, t) => { [392, 370, 349, 294].forEach((f, i) => A.osc(v, 'sawtooth', f, f * 0.97, t + i * 0.3, 0.32 + (i === 3) * 0.6, 0.12)); } },
  kill: { fn: (A, v, t) => { A.osc(v, 'square', 880, 880, t, 0.06, 0.12); A.osc(v, 'square', 1320, 1320, t + 0.07, 0.12, 0.12); } },
};

// ---------- adaptive procedural music ----------
// Dusty western/post-apocalyptic groove in A minor; tension layer fades in with combat intensity.
export const Music = {
  A: null, playing: false, step: 0, nextT: 0, bpm: 96, timer: null, layerG: null,
  init(A) { this.A = A; const c = A.ctx; this.baseG = c.createGain(); this.baseG.connect(A.musicBus); this.layerG = c.createGain(); this.layerG.gain.value = 0; this.layerG.connect(A.musicBus);
    this.delay = c.createDelay(); this.delay.delayTime.value = 60 / this.bpm * 0.75; const fb = c.createGain(); fb.gain.value = 0.32; const dl = c.createGain(); dl.gain.value = 0.3; this.delay.connect(fb).connect(this.delay); this.delay.connect(dl).connect(A.musicBus); this.delayIn = this.delay; },
  start(mode = 'game') { if (!this.A || !this.A.ctx) return; this.mode = mode; if (this.playing) return; this.playing = true; this.nextT = this.A.ctx.currentTime + 0.1; this.step = 0; this.timer = setInterval(() => this.tick(), 50); },
  stop() { this.playing = false; clearInterval(this.timer); },
  setIntensity(x) { if (!this.layerG) return; this.layerG.gain.setTargetAtTime(Math.min(1, x) * 0.9, this.A.ctx.currentTime, 0.8); },
  note(dest, type, f, t, dur, vol, cutoff = 3000, attack = 0.005) {
    const c = this.A.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, t); fl.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.25), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl).connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05); return g;
  },
  drum(dest, kind, t, vol) {
    const A = this.A, c = A.ctx;
    if (kind === 'k') { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o.connect(g).connect(dest); o.start(t); o.stop(t + 0.35); return; }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = A.noise; f.type = kind === 'h' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'h' ? 7000 : 1800; f.Q.value = kind === 'h' ? 0.7 : 0.9;
    const d = kind === 'h' ? 0.04 : 0.16; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f).connect(g).connect(dest); s.start(t, Math.random()); s.stop(t + d + 0.02);
  },
  tick() {
    const c = this.A.ctx; if (!c) return; const spb = 60 / this.bpm / 4;
    while (this.nextT < c.currentTime + 0.25) { this.play16(this.step, this.nextT, spb); this.step++; this.nextT += spb; }
  },
  play16(s, t, spb) {
    const B = this.baseG, L = this.layerG, bar = Math.floor(s / 16) % 8, st = s % 16;
    const prog = [[57, 60, 64], [57, 60, 64], [55, 59, 62], [55, 59, 62], [53, 57, 60], [53, 57, 60], [52, 56, 59], [52, 56, 59]][bar];
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    if (this.mode === 'menu') {
      if (st % 4 === 0) this.note(B, 'triangle', hz(prog[0] - 24), t, spb * 3.5, 0.35, 900);
      if (st % 2 === 0 && Math.random() < 0.6) { const n = prog[(st / 2) % 3] + (Math.random() < 0.3 ? 12 : 0); const g = this.note(B, 'sawtooth', hz(n), t, spb * 2.2, 0.06, 2200); g.connect(this.delayIn); }
      if (st === 0) this.drum(B, 'k', t, 0.5); if (st === 8) this.drum(B, 's', t, 0.18); if (st % 4 === 2) this.drum(B, 'h', t, 0.06);
      return;
    }
    // bass: galloping western pattern
    if ([0, 3, 4, 8, 11, 12].includes(st)) this.note(B, 'triangle', hz(prog[0] - 24 + (st === 12 ? 7 : 0)), t, spb * 1.6, 0.42, 800);
    // twangy guitar arpeggio
    if (st % 2 === 0) { const n = prog[[0, 1, 2, 1, 0, 2, 1, 2][st / 2]] + 12; const g = this.note(B, 'sawtooth', hz(n) * (1 + Math.random() * 0.002), t, spb * 1.8, 0.055, 2600); g.connect(this.delayIn); }
    // melody phrase every 2 bars
    if (bar % 2 === 1 && [0, 6, 10].includes(st)) { const mel = [72, 76, 74, 69, 71, 72, 67, 64]; const g = this.note(B, 'square', hz(mel[(bar + st) % 8]), t, spb * 3, 0.03, 1800, 0.02); g.connect(this.delayIn); }
    // drums
    if (st === 0 || st === 10) this.drum(B, 'k', t, 0.55); if (st === 4 || st === 12) this.drum(B, 's', t, 0.22); if (st % 2 === 0) this.drum(B, 'h', t, 0.05 + (st % 4 === 2) * 0.03);
    // tension layer (combat / final circle)
    this.drum(L, 'h', t, 0.05); if (st % 4 === 0) this.drum(L, 'k', t, 0.4); if (st === 14) this.drum(L, 's', t, 0.18);
    if (st % 8 === 0) this.note(L, 'sawtooth', hz(prog[0] - 12), t, spb * 7, 0.07, 700, 0.15);
    if (st % 4 === 2) this.note(L, 'square', hz(prog[2] + 12), t, spb * 0.8, 0.025, 3000);
  },
};
