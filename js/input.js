// Unified input: keyboard+mouse, standard gamepads and touch twin-sticks -> one action state.
import { G } from './state.js';
const KEYMAP = {
  KeyR: 'reload', KeyE: 'interact', KeyF: 'interact', Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', KeyG: 'grenade', KeyH: 'bandage', KeyJ: 'medkit', KeyK: 'soda',
  KeyC: 'crouch', ControlLeft: 'crouch', KeyM: 'map', Tab: 'map', Space: 'jump', Escape: 'pause', KeyP: 'pause', F1: 'help', Slash: 'help', KeyQ: 'horn', KeyX: 'swap',
};
export const Input = {
  keys: new Set(), edges: new Set(), mouse: { x: 0, y: 0, down: false, right: false }, wheel: 0,
  move: { x: 0, y: 0 }, aimDir: { x: 1, y: 0, mag: 0 }, fire: false, ads: false, sprint: false,
  padPrev: [], padIndex: -1, touch: { move: null, aim: null }, canvas: null,
  init(canvas) {
    this.canvas = canvas;
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (['Space', 'Tab', 'F1', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash'].includes(e.code)) e.preventDefault();
      G.inputMode = 'kbm';
      if (!e.repeat) { const a = KEYMAP[e.code]; if (a) this.edges.add(a); }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = this.mouse.right = false; });
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; if (G.inputMode !== 'kbm' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) G.inputMode = 'kbm'; });
    canvas.addEventListener('mousedown', (e) => { G.inputMode = 'kbm'; this.mouse.x = e.clientX; this.mouse.y = e.clientY; if (e.button === 0) { this.mouse.down = true; this.edges.add('click'); } if (e.button === 2) this.mouse.right = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.right = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.edges.add(e.deltaY > 0 ? 'next' : 'prev'); }, { passive: false });
    // touch twin-sticks (floating)
    const ts = (e) => {
      e.preventDefault(); G.inputMode = 'touch';
      for (const t of e.changedTouches) {
        const left = t.clientX < innerWidth * 0.45;
        const slot = left ? 'move' : 'aim';
        if (!this.touch[slot]) this.touch[slot] = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now() };
      }
    };
    const tm = (e) => { e.preventDefault(); for (const t of e.changedTouches) for (const k of ['move', 'aim']) { const s = this.touch[k]; if (s && s.id === t.identifier) { s.x = t.clientX; s.y = t.clientY; } } };
    const te = (e) => { for (const t of e.changedTouches) for (const k of ['move', 'aim']) { const s = this.touch[k]; if (s && s.id === t.identifier) { if (k === 'aim' && performance.now() - s.t0 < 200 && Math.hypot(s.x - s.ox, s.y - s.oy) < 12) this.edges.add('tapfire'); this.touch[k] = null; } } };
    canvas.addEventListener('touchstart', ts, { passive: false }); canvas.addEventListener('touchmove', tm, { passive: false });
    canvas.addEventListener('touchend', te); canvas.addEventListener('touchcancel', te);
    addEventListener('gamepadconnected', (e) => { this.padIndex = e.gamepad.index; G.inputMode = 'pad'; G.toast && G.toast('🎮 Controller connected'); });
    addEventListener('gamepaddisconnected', () => { this.padIndex = -1; if (G.inputMode === 'pad') G.inputMode = 'kbm'; });
  },
  hit(a) { return this.edges.has(a); },
  press(a) { this.edges.add(a); }, // used by on-screen buttons
  endFrame() { this.edges.clear(); },
  poll() {
    // keyboard
    const k = this.keys; let mx = 0, my = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1; if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1; if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    const l = Math.hypot(mx, my); if (l) { mx /= l; my /= l; }
    this.fire = this.mouse.down; this.ads = this.mouse.right; this.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    this.analog = false;
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && (pads[this.padIndex] || [...pads].find((p) => p));
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
      const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      const b = gp.buttons.map((x) => x.pressed || x.value > 0.5);
      const any = Math.abs(lx) + Math.abs(ly) + Math.abs(rx) + Math.abs(ry) > 0.1 || b.some((x) => x);
      if (any) G.inputMode = 'pad';
      if (G.inputMode === 'pad') {
        mx = lx; my = ly; const lm = Math.hypot(mx, my); if (lm > 1) { mx /= lm; my /= lm; }
        this.analog = true; this.sprint = lm > 0.94 || b[10];
        const rm = Math.hypot(rx, ry); if (rm > 0.25) this.aimDir = { x: rx / rm, y: ry / rm, mag: rm };
        else if (lm > 0.3 && !b[7]) this.aimDir = { x: mx / lm, y: my / lm, mag: 0 };
        this.fire = b[7]; this.ads = b[6];
        const map = { 0: 'interact', 1: 'crouch', 2: 'reload', 3: 'swap', 4: 'heal', 5: 'grenade', 8: 'map', 9: 'pause', 12: 'bandage', 13: 'soda', 14: 'slot1', 15: 'slot2', 11: 'slot3' };
        for (const i in map) if (b[i] && !this.padPrev[i]) this.edges.add(map[i]);
        if (b[0] && !this.padPrev[0]) this.edges.add('jump');
        this.padB = b;
      }
      this.padPrev = b;
    }
    // touch
    if (G.inputMode === 'touch') {
      const R = 60, mv = this.touch.move, am = this.touch.aim;
      mx = 0; my = 0; this.fire = false; this.analog = true; this.sprint = false;
      if (mv) { let dx = (mv.x - mv.ox) / R, dy = (mv.y - mv.oy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; mv.ox = mv.x - dx * R; mv.oy = mv.y - dy * R; } mx = dx; my = dy; this.sprint = m > 0.97; }
      if (am) { let dx = (am.x - am.ox) / R, dy = (am.y - am.oy) / R; const m = Math.hypot(dx, dy); if (m > 1) { am.ox = am.x - dx / m * R; am.oy = am.y - dy / m * R; } if (m > 0.2) { this.aimDir = { x: dx / m, y: dy / m, mag: Math.min(1, m) }; this.fire = m > 0.55; } }
      else if (Math.hypot(mx, my) > 0.3) { const m = Math.hypot(mx, my); this.aimDir = { x: mx / m, y: my / m, mag: 0 }; }
      this.ads = false;
    }
    this.move.x = mx; this.move.y = my;
  },
};
