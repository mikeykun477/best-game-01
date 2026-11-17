// The things that live in the field: enemies, bolts, orbs, cores, sparks and floating
// score text. These are plain data plus the small factories that build them; all
// behaviour lives in world.js. Every random choice comes from the world's seeded rng.
import { ENEMIES, ORB, SPAWN } from './config.js';

export function createEnemy(rng, kind, x, y, wave) {
  const def = ENEMIES[kind];
  const hp = Math.max(1, Math.round(def.hp * (1 + (wave - 1) * 0.06)));
  return {
    kind,
    x, y, vx: 0, vy: 0,
    hp, maxHp: hp,
    radius: def.radius,
    speed: def.speed * rng.range(0.9, 1.1) * (1 + (wave - 1) * 0.03),
    score: def.score,
    touch: def.touch,
    cores: def.core,
    spawnT: SPAWN.telegraph,
    flash: 0,
    t: rng.range(0.8, 2.6),
    state: 'drift',
    dirX: 0, dirY: 0,
    shootT: rng.range(1.2, 2.4),
    burstT: rng.range(2.5, 3.5),
    wobble: rng.range(0, Math.PI * 2),
    dead: false,
  };
}

export function createBullet(x, y, angle, speed, damage, pierce) {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage, pierce,
    radius: 5,
    life: 0.95,
    dead: false,
  };
}

export function createOrb(x, y, angle) {
  return {
    x, y,
    vx: Math.cos(angle) * ORB.speed,
    vy: Math.sin(angle) * ORB.speed,
    radius: ORB.radius,
    life: ORB.life,
    dead: false,
  };
}

export function createCore(rng, x, y) {
  const a = rng.angle();
  const s = rng.range(40, 140);
  return {
    x, y,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s,
    radius: 7,
    t: rng.range(0, Math.PI * 2),
    dead: false,
  };
}

export function burst(list, rng, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = rng.angle();
    const s = rng.range(speed * 0.3, speed);
    list.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      radius: rng.range(2, 4.5),
      color,
      t: 0,
      life: rng.range(0.3, 0.7),
    });
  }
}

export function addFloat(list, x, y, text, color, size) {
  list.push({ x, y, text, color, size: size || 16, t: 0, life: 0.9 });
}
