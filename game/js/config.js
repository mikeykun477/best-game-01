// Sporekeeper — every tuning number, colour, wave list and upgrade in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size. Nothing here touches the DOM or Math.random.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves a run lasts; clearing the last one wins the game. */
export const FINAL_WAVE = 8;

export const PLAYER = {
  radius: 16,
  hull: 100,
  speed: 300,
  accel: 2600,
  friction: 2200,
  fireInterval: 0.24,
  damage: 1,
  projectiles: 1,
  pierce: 0,
  bulletSpeed: 640,
  magnet: 90,
  dashCooldown: 1.6,
  dashTime: 0.22,
  dashSpeed: 950,
  hurtInvuln: 0.9,
};

export const BULLET = { radius: 5, life: 0.95, spread: 0.14 };

/** Damage the player takes from each kind of touch, and what each kill is worth. */
export const ENEMIES = {
  mote:     { radius: 16, hp: 2,  speed: 72,  score: 10,  touch: 8,  core: 1 },
  darter:   { radius: 14, hp: 3,  speed: 62,  score: 15,  touch: 12, core: 1 },
  spitter:  { radius: 18, hp: 4,  speed: 55,  score: 20,  touch: 10, core: 2 },
  splitter: { radius: 22, hp: 6,  speed: 58,  score: 25,  touch: 10, core: 2 },
  brute:    { radius: 34, hp: 30, speed: 42,  score: 60,  touch: 20, core: 4 },
  king:     { radius: 52, hp: 140, speed: 34, score: 300, touch: 25, core: 12 },
};

/** Enemy kinds per wave. The king only ever appears once, at the end of wave 8. */
export const WAVES = [
  { mote: 6 },
  { mote: 8, darter: 2 },
  { mote: 10, darter: 3, spitter: 2 },
  { mote: 12, darter: 4, spitter: 3, splitter: 1 },
  { mote: 10, darter: 5, spitter: 4, splitter: 2, brute: 1 },
  { mote: 14, darter: 6, spitter: 5, splitter: 3, brute: 2 },
  { mote: 16, darter: 7, spitter: 6, splitter: 4, brute: 2 },
  { mote: 12, darter: 6, spitter: 5, splitter: 4, brute: 3, king: 1 },
];

/** Seconds between spawns at the start of a wave, shrinking as the wave goes on. */
export const SPAWN = { first: 0.9, last: 0.42, telegraph: 0.6 };

/** A kill within this many seconds of the last one extends the combo chain. */
export const COMBO_WINDOW = 3;
/** Score multiplier at combo n: 1 + 0.1 * min(n, 20), so a long chain triples points. */
export const COMBO_STEP = 0.1;
export const COMBO_CAP = 20;

/** Cores for one Bloom: collecting this many heals the keeper. */
export const BLOOM_CORES = 20;
export const BLOOM_HEAL = 15;

export const ORB = { radius: 7, speed: 175, damage: 8, life: 6 };

/**
 * The upgrades offered between waves. Each has a name, a one-line promise, how many
 * times it can be taken, and an apply() that changes the player's numbers. The world
 * picks three different ones at random after every cleared wave.
 */
export const UPGRADES = [
  {
    id: 'twin', name: 'Twin Lantern', max: 2,
    blurb: '+1 light bolt per shot',
    apply: (p) => { p.projectiles += 1; },
  },
  {
    id: 'heavy', name: 'Heavy Light', max: 4,
    blurb: '+1 damage per bolt',
    apply: (p) => { p.damage += 1; },
  },
  {
    id: 'rapid', name: 'Rapid Wick', max: 4,
    blurb: 'Shoot 25% faster',
    apply: (p) => { p.fireInterval *= 0.8; },
  },
  {
    id: 'pierce', name: 'Piercing Ray', max: 2,
    blurb: 'Bolts pass through +1 spore',
    apply: (p) => { p.pierce += 1; },
  },
  {
    id: 'swift', name: 'Swift Step', max: 3,
    blurb: 'Move 12% faster',
    apply: (p) => { p.speed *= 1.12; },
  },
  {
    id: 'bark', name: 'Thick Bark', max: 3,
    blurb: '+25 max hull, heal 25 now',
    apply: (p) => { p.maxHull += 25; p.hull = Math.min(p.maxHull, p.hull + 25); },
  },
  {
    id: 'magnet', name: 'Magnet Bloom', max: 3,
    blurb: 'Cores fly to you from 60% further',
    apply: (p) => { p.magnet *= 1.6; },
  },
  {
    id: 'longwick', name: 'Long Wick', max: 3,
    blurb: 'Bolts fly 25% faster and further',
    apply: (p) => { p.bulletSpeed *= 1.25; },
  },
  {
    id: 'dash', name: 'Dash Sigil', max: 2,
    blurb: 'Dash recharges 30% faster',
    apply: (p) => { p.dashCooldown *= 0.7; },
  },
  {
    id: 'heart', name: 'Bloom Heart', max: 2,
    blurb: 'Bloom needs 5 fewer cores',
    apply: (p) => { p.bloomNeed = Math.max(8, p.bloomNeed - 5); },
  },
];

export const PALETTE = {
  backdropTop: '#0b0e1a',
  backdropBottom: '#171a30',
  vignette: 'rgba(4, 5, 12, 0.55)',
  groundGlow: '#23264a',
  player: '#ffd97a',
  playerCore: '#fff3c4',
  bullet: '#ffe08a',
  core: '#7dffb0',
  mote: '#8b6cff',
  darter: '#c65cff',
  spitter: '#ff7ad9',
  splitter: '#7ee0ff',
  brute: '#ff5d5d',
  king: '#ff3d7f',
  orb: '#ff5da2',
  panel: '#1c2036',
  panelEdge: '#3a4066',
  text: '#f2f0e4',
  muted: '#9a9db8',
  danger: '#ff5d5d',
  gold: '#f5b942',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'sporekeeper.best';
