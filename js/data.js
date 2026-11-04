import { weighted, randi, choice } from './util.js';

export const WEAPONS = {
  wrench:  { name: 'Pipe Wrench', melee: true, dmg: 24, rate: 0.5, range: 1.25, arc: 1.2, icon: 'wrench' },
  pistol:  { name: 'Pea-Shooter', dmg: 19, rate: 0.26, mag: 12, reload: 1.2, spread: 0.05, speed: 32, range: 14, ammo: 'light', auto: false, kick: 2, sfx: 'pistol' },
  smg:     { name: 'Rattle SMG', dmg: 13, rate: 0.085, mag: 30, reload: 1.9, spread: 0.13, speed: 32, range: 12, ammo: 'light', auto: true, kick: 1.5, sfx: 'smg' },
  shotgun: { name: 'Boomstick', dmg: 11, pellets: 8, rate: 0.9, mag: 5, reload: 2.4, spread: 0.3, speed: 26, range: 7.5, ammo: 'shells', auto: false, kick: 6, sfx: 'shotgun' },
  rifle:   { name: 'Rust Rifle', dmg: 21, rate: 0.13, mag: 30, reload: 2.2, spread: 0.06, speed: 38, range: 18, ammo: 'heavy', auto: true, kick: 2.5, sfx: 'rifle' },
  sniper:  { name: 'Long Tom', dmg: 88, rate: 1.35, mag: 5, reload: 2.8, spread: 0.006, speed: 64, range: 32, ammo: 'heavy', auto: false, kick: 8, sfx: 'sniper', scope: true },
};
export const RARITY = [
  { name: 'Common', color: '#b9b2a3', mult: 1 },
  { name: 'Uncommon', color: '#6fd35b', mult: 1.12 },
  { name: 'Rare', color: '#b06cff', mult: 1.25 },
];
export const AMMO = { light: { name: 'Light Ammo', color: '#f2c14e' }, shells: { name: 'Shells', color: '#e5533d' }, heavy: { name: 'Heavy Ammo', color: '#5fb3e6' } };
export const HEALS = {
  bandage: { name: 'Bandage', time: 2.5, heal: 18, cap: 75, max: 8, key: 'H' },
  medkit:  { name: 'Medkit', time: 5, heal: 100, cap: 100, max: 3, key: 'J' },
  soda:    { name: 'Fizzy Soda', time: 1.4, boost: 45, max: 4, key: 'K' },
};
export const ARMOR = {
  helmet: [null, { red: 0.25, dur: 70 }, { red: 0.4, dur: 120 }, { red: 0.55, dur: 200 }],
  vest:   [null, { red: 0.22, dur: 100 }, { red: 0.35, dur: 160 }, { red: 0.5, dur: 240 }],
};
export const AMMO_CAP = { light: 120, shells: 30, heavy: 120 };
export const GRENADE_MAX = 4;

export function weaponItem(id, rar) {
  const w = WEAPONS[id];
  return { t: 'weapon', id, rar: rar ?? weighted([[0, 6], [1, 3], [2, 1]]), mag: w.mag || 0 };
}
export function itemName(it) {
  switch (it.t) {
    case 'weapon': return (it.rar ? RARITY[it.rar].name + ' ' : '') + WEAPONS[it.id].name;
    case 'ammo': return AMMO[it.id].name + ' ×' + it.n;
    case 'heal': return HEALS[it.id].name + (it.n > 1 ? ' ×' + it.n : '');
    case 'helmet': return 'Helmet Lv.' + it.lvl;
    case 'vest': return 'Vest Lv.' + it.lvl;
    case 'pack': return 'Backpack Lv.' + it.lvl;
    case 'grenade': return 'Jar Grenade' + (it.n > 1 ? ' ×' + it.n : '');
  }
  return '?';
}
export function itemColor(it) {
  if (it.t === 'weapon') return RARITY[it.rar].color;
  if (it.t === 'ammo') return AMMO[it.id].color;
  if (it.t === 'heal') return '#ff7b9c';
  if (it.t === 'grenade') return '#8fe36b';
  return ['#b9b2a3', '#b9b2a3', '#6fd35b', '#b06cff'][it.lvl];
}

const GUNS = ['pistol', 'smg', 'shotgun', 'rifle', 'sniper'];
function randomLoot(tier) { // tier 0 box, 1 crate, 2 airdrop/boss
  const k = weighted(tier === 2 ? [['weapon', 4], ['armor', 4], ['heal', 3], ['grenade', 1]]
    : [['weapon', 3], ['ammo', 4], ['heal', 3], ['armor', 2.2], ['grenade', 1.2], ['pack', 0.6]]);
  if (k === 'weapon') {
    const id = tier === 2 ? choice(['rifle', 'sniper', 'smg', 'shotgun']) : weighted([['pistol', 4], ['smg', 3], ['shotgun', 3], ['rifle', 2], ['sniper', 0.7]]);
    const rar = tier === 2 ? weighted([[1, 1], [2, 3]]) : tier === 1 ? weighted([[0, 4], [1, 4], [2, 2]]) : weighted([[0, 7], [1, 3], [2, 0.6]]);
    const out = [weaponItem(id, rar)];
    const a = WEAPONS[id].ammo; out.push({ t: 'ammo', id: a, n: a === 'shells' ? 10 : 30 });
    return out;
  }
  if (k === 'ammo') { const id = choice(['light', 'light', 'shells', 'heavy', 'heavy']); return [{ t: 'ammo', id, n: id === 'shells' ? randi(6, 12) : randi(20, 40) }]; }
  if (k === 'heal') { const id = weighted([['bandage', 5], ['soda', 2.5], ['medkit', tier ? 2 : 0.8]]); return [{ t: 'heal', id, n: id === 'bandage' ? randi(2, 4) : 1 }]; }
  if (k === 'armor') {
    const lvl = tier === 2 ? 3 : tier === 1 ? weighted([[1, 3], [2, 4], [3, 1.2]]) : weighted([[1, 5], [2, 2], [3, 0.3]]);
    const t = choice(['helmet', 'vest']); return [{ t, lvl, dur: ARMOR[t][lvl].dur }];
  }
  if (k === 'pack') return [{ t: 'pack', lvl: weighted([[1, 4], [2, 2], [3, tier ? 1 : 0.3]]) }];
  return [{ t: 'grenade', n: randi(1, 2) }];
}
export function rollLoot(tier) {
  const n = tier === 0 ? randi(1, 2) : tier === 1 ? randi(2, 4) : randi(4, 5);
  const items = []; for (let i = 0; i < n; i++) items.push(...randomLoot(tier));
  return items;
}

export const BOT_NAMES = ['Big Tuna', 'Mama Rust', 'Sir Crumbs', 'Chonky Bill', 'Dusty Pete', 'Gravy Train', 'Lil Biscuit', 'Tank Nana', 'Buttons', 'Meatloaf', 'Duchess Dumpling', 'Rusty Ricky', 'Pudge Royale', 'Captain Waffle', 'Muffin Max', 'Doughboy Dan', 'Gloria Gristle', 'Professor Pork', 'Tumbleweed Ted', 'Scrap Sally', 'Nugget', 'Barrel Barb', 'Spud Bud', 'Hambone', 'Sloppy Joe', 'Jelly Roll', 'Turbo Tater', 'Wombat Walt'];
export const SKINS = ['#f5cba7', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a46b45'];
export const SHIRTS = ['#d9534f', '#5bc0de', '#f0ad4e', '#6a8f3b', '#8e6bbf', '#e07b39', '#4d7ea8', '#c94f7c', '#7a6a53', '#3fa58c'];
export const PANTS = ['#4a4e69', '#5c4033', '#2f4858', '#6b705c', '#3d405b', '#7f5539'];
export const HATS = ['none', 'gasmask', 'bandana', 'goggles', 'mohawk', 'hardhat', 'cap', 'cowboy', 'bucket'];

export const CREATURES = {
  dog:  { name: 'Straw Dog', hp: 55, speed: 5.6, dmg: 12, cd: 0.8, r: 0.38, aggro: 8.5, reach: 0.95, xp: 1 },
  rat:  { name: 'Glow Rat', hp: 14, speed: 5.2, dmg: 5, cd: 0.6, r: 0.22, aggro: 6.5, reach: 0.7 },
  crow: { name: 'Carrion Crow', hp: 22, speed: 6.5, dmg: 9, cd: 2.4, r: 0.3, aggro: 11, reach: 0.8, fly: true },
  hog:  { name: 'Bloat Hog', hp: 420, speed: 3.1, dmg: 30, cd: 1.3, r: 0.85, aggro: 8, reach: 1.6, boss: true },
};
export const VEHICLES = {
  buggy:  { name: 'Dune Buggy', hp: 260, maxSpeed: 15, accel: 13, turn: 2.9, grip: 5, len: 1.7, wid: 1.05, r: 0.8, color: '#e8a33d' },
  pickup: { name: 'Rust Bucket', hp: 480, maxSpeed: 12, accel: 9, turn: 2.2, grip: 7, len: 2.2, wid: 1.2, r: 0.95, color: '#4d8aa8' },
};
