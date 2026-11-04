// Shared mutable game context. Every module imports G and reads/writes on it.
export const G = {
  settings: null,
  world: null,
  humans: [], creatures: [], vehicles: [], containers: [], pickups: [],
  projectiles: [], grenades: [], barrels: [], particles: [], decals: [], texts: [],
  player: null, cam: { x: 36, y: 36, zoom: 1, shake: 0 },
  time: 0, state: 'menu', paused: false, storm: null, blimp: null,
  killFeed: [], toasts: [], inputMode: 'kbm', nextId: 1,
};
export const uid = () => G.nextId++;
