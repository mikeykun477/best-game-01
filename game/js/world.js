// The game itself: state, the fixed-step update, waves, collisions, scoring, the
// combo chain, the Bloom heal loop and the between-wave upgrade offer. It knows
// nothing about the canvas, the keyboard or sound; main.js feeds it input and reads
// the event bits it returns to play sounds and change screens.
import {
  BLOOM_CORES, BLOOM_HEAL, BULLET, COMBO_CAP, COMBO_STEP, COMBO_WINDOW,
  FIELD, FINAL_WAVE, ORB, PALETTE, PLAYER, SPAWN, UPGRADES, WAVES,
} from './config.js';
import { addFloat, burst, createBullet, createCore, createEnemy, createOrb } from './entities.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_KILL = 4;
export const EVENT_PICKUP = 8;
export const EVENT_HURT = 16;
export const EVENT_WAVE_CLEAR = 32;
export const EVENT_UPGRADE = 64;
export const EVENT_OVER = 128;
export const EVENT_WIN = 256;
export const EVENT_BLOOM = 512;
export const EVENT_DASH = 1024;
export const EVENT_WAVE_START = 2048;

function freshPlayer() {
  return {
    x: FIELD.width / 2, y: FIELD.height / 2,
    vx: 0, vy: 0, angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.hull, maxHull: PLAYER.hull,
    speed: PLAYER.speed, damage: PLAYER.damage,
    projectiles: PLAYER.projectiles, pierce: PLAYER.pierce,
    bulletSpeed: PLAYER.bulletSpeed, fireInterval: PLAYER.fireInterval,
    magnet: PLAYER.magnet, dashCooldown: PLAYER.dashCooldown,
    bloomNeed: BLOOM_CORES,
    fireT: 0, dashT: 0, dashCd: 0, invuln: 0,
    upgrades: {},
  };
}

export function createWorld(rng) {
  const state = {
    phase: 'play',
    time: 0,
    wave: 1,
    score: 0,
    kills: 0,
    cores: 0,
    bloom: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    player: freshPlayer(),
    enemies: [],
    bullets: [],
    orbs: [],
    pickups: [],
    particles: [],
    floats: [],
    spawnQueue: [],
    spawnT: 0,
    spawnInterval: SPAWN.first,
    shake: 0,
    hitStop: 0,
    banner: '',
    bannerT: 0,
    upgradeChoices: [],
  };

  function multiplier() {
    return 1 + COMBO_STEP * Math.min(state.combo, COMBO_CAP);
  }

  function spawnPoint() {
    const p = state.player;
    for (let tries = 0; tries < 8; tries += 1) {
      const edge = rng.int(0, 3);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = rng.range(40, FIELD.width - 40); y = 36; }
      else if (edge === 1) { x = FIELD.width - 36; y = rng.range(40, FIELD.height - 40); }
      else if (edge === 2) { x = rng.range(40, FIELD.width - 40); y = FIELD.height - 36; }
      else { x = 36; y = rng.range(40, FIELD.height - 40); }
      if (Math.hypot(x - p.x, y - p.y) > 260) return { x, y };
    }
    return { x: 40, y: 40 };
  }

  function startWave(n) {
    const def = WAVES[n - 1];
    const queue = [];
    for (const kind of Object.keys(def)) {
      for (let i = 0; i < def[kind]; i += 1) queue.push(kind);
    }
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    state.spawnQueue = queue;
    state.spawnT = 0.8;
    state.spawnInterval = SPAWN.first;
    state.banner = n === FINAL_WAVE ? 'FINAL WAVE — THE HOLLOW KING' : `WAVE ${n}`;
    state.bannerT = 2.2;
  }

  function rollUpgrades() {
    const owned = state.player.upgrades;
    const pool = UPGRADES.filter((u) => (owned[u.id] || 0) < u.max);
    const choices = [];
    while (choices.length < 3 && pool.length > 0) {
      const i = Math.floor(rng.next() * pool.length);
      choices.push(pool.splice(i, 1)[0]);
    }
    state.upgradeChoices = choices;
  }

  function killEnemy(enemy, award) {
    enemy.dead = true;
    state.kills += 1;
    if (award) {
      const gained = Math.round(enemy.score * multiplier());
      state.score += gained;
      addFloat(state.floats, enemy.x, enemy.y - enemy.radius, `+${gained}`, PALETTE.gold, 17);
      state.combo += 1;
      state.comboT = COMBO_WINDOW;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    }
    const color = PALETTE[enemy.kind] || PALETTE.mote;
    burst(state.particles, rng, enemy.x, enemy.y, color, enemy.kind === 'king' ? 46 : 14, 260);
    burst(state.particles, rng, enemy.x, enemy.y, PALETTE.bullet, 6, 180);
    for (let i = 0; i < enemy.cores; i += 1) state.pickups.push(createCore(rng, enemy.x, enemy.y));
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const child = createEnemy(rng, 'mote', enemy.x + (i === 0 ? -20 : 20), enemy.y, state.wave);
        child.spawnT = 0.3;
        state.enemies.push(child);
      }
    }
    if (enemy.kind === 'brute' || enemy.kind === 'king') state.shake = Math.max(state.shake, 0.35);
  }

  function hurtPlayer(damage, fromX, fromY) {
    const p = state.player;
    if (p.invuln > 0 || p.dashT > 0 || state.phase !== 'play') return 0;
    p.hull -= damage;
    p.invuln = PLAYER.hurtInvuln;
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    p.vx += (dx / len) * 320;
    p.vy += (dy / len) * 320;
    state.shake = Math.max(state.shake, 0.4);
    state.hitStop = 0.06;
    burst(state.particles, rng, p.x, p.y, PALETTE.danger, 16, 300);
    state.combo = 0;
    state.comboT = 0;
    if (p.hull <= 0) {
      p.hull = 0;
      state.phase = 'over';
      burst(state.particles, rng, p.x, p.y, PALETTE.player, 40, 380);
      burst(state.particles, rng, p.x, p.y, PALETTE.danger, 24, 300);
      return EVENT_HURT | EVENT_OVER;
    }
    return EVENT_HURT;
  }

  function updatePlayer(dt, ctrl) {
    const p = state.player;
    p.fireT -= dt;
    p.dashCd -= dt;
    p.invuln -= dt;
    const mx = ctrl ? ctrl.mx : 0;
    const my = ctrl ? ctrl.my : 0;
    if (ctrl && ctrl.dash && p.dashCd <= 0 && p.dashT <= 0) {
      const len = Math.hypot(mx, my);
      const dx = len > 0 ? mx / len : Math.cos(p.angle);
      const dy = len > 0 ? my / len : Math.sin(p.angle);
      p.vx = dx * PLAYER.dashSpeed;
      p.vy = dy * PLAYER.dashSpeed;
      p.dashT = PLAYER.dashTime;
      p.dashCd = p.dashCooldown;
      burst(state.particles, rng, p.x, p.y, PALETTE.playerCore, 10, 160);
      return EVENT_DASH;
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
    } else {
      p.vx += mx * PLAYER.accel * dt;
      p.vy += my * PLAYER.accel * dt;
      const speed = Math.hypot(p.vx, p.vy);
      const max = p.speed;
      if (speed > max) {
        p.vx = (p.vx / speed) * max;
        p.vy = (p.vy / speed) * max;
      }
      if (mx === 0 && my === 0) {
        const f = Math.max(0, speed - PLAYER.friction * dt);
        if (speed > 0) {
          p.vx = (p.vx / speed) * f;
          p.vy = (p.vy / speed) * f;
        }
      }
    }
    p.x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
    p.y = Math.min(FIELD.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));
    if (ctrl) p.angle = Math.atan2(ctrl.aimY - p.y, ctrl.aimX - p.x);
    if (ctrl && ctrl.firing && p.fireT <= 0) {
      p.fireT = p.fireInterval;
      const n = p.projectiles;
      for (let i = 0; i < n; i += 1) {
        const off = (i - (n - 1) / 2) * BULLET.spread;
        const a = p.angle + off;
        state.bullets.push(createBullet(
          p.x + Math.cos(a) * (p.radius + 6),
          p.y + Math.sin(a) * (p.radius + 6),
          a, p.bulletSpeed, p.damage, p.pierce,
        ));
      }
      burst(state.particles, rng, p.x + Math.cos(p.angle) * (p.radius + 8), p.y + Math.sin(p.angle) * (p.radius + 8), PALETTE.bullet, 3, 120);
      return EVENT_SHOT;
    }
    return 0;
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e.dead) continue;
      e.flash -= dt;
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        continue;
      }
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      e.t -= dt;
      if (e.kind === 'mote' || e.kind === 'splitter' || e.kind === 'brute') {
        const wob = Math.sin(state.time * 2 + e.wobble) * 0.35;
        e.vx = (nx - ny * wob) * e.speed;
        e.vy = (ny + nx * wob) * e.speed;
      } else if (e.kind === 'darter') {
        if (e.state === 'drift') {
          e.vx = nx * e.speed;
          e.vy = ny * e.speed;
          if (e.t <= 0) {
            e.state = 'windup';
            e.t = 0.35;
            e.dirX = nx;
            e.dirY = ny;
          }
        } else if (e.state === 'windup') {
          e.vx = 0;
          e.vy = 0;
          if (e.t <= 0) {
            e.state = 'charge';
            e.t = 0.5;
          }
        } else {
          e.vx = e.dirX * 420;
          e.vy = e.dirY * 420;
          if (e.t <= 0) {
            e.state = 'drift';
            e.t = rng.range(1.8, 2.8);
          }
        }
      } else if (e.kind === 'spitter') {
        if (dist < 240) {
          e.vx = -nx * e.speed;
          e.vy = -ny * e.speed;
        } else if (dist > 380) {
          e.vx = nx * e.speed;
          e.vy = ny * e.speed;
        } else {
          e.vx = -ny * e.speed * 0.6;
          e.vy = nx * e.speed * 0.6;
        }
        e.shootT -= dt;
        if (e.shootT <= 0 && dist < 560) {
          e.shootT = rng.range(2.2, 3.0);
          state.orbs.push(createOrb(e.x, e.y, Math.atan2(dy, dx)));
          burst(state.particles, rng, e.x, e.y, PALETTE.orb, 4, 100);
        }
      } else if (e.kind === 'king') {
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
        e.burstT -= dt;
        if (e.burstT <= 0) {
          e.burstT = 3.4;
          for (let i = 0; i < 12; i += 1) {
            const a = (i / 12) * Math.PI * 2 + rng.range(-0.1, 0.1);
            state.orbs.push(createOrb(e.x, e.y, a));
          }
          state.shake = Math.max(state.shake, 0.25);
        }
        if (e.t <= 0 && state.enemies.length < 40) {
          e.t = 6;
          for (let i = 0; i < 2; i += 1) {
            const child = createEnemy(rng, 'mote', e.x + (i === 0 ? -40 : 40), e.y, state.wave);
            child.spawnT = 0.4;
            state.enemies.push(child);
          }
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = Math.min(FIELD.width - e.radius, Math.max(e.radius, e.x));
      e.y = Math.min(FIELD.height - e.radius, Math.max(e.radius, e.y));
    }
  }

  function updateBullets(dt) {
    let events = 0;
    for (const b of state.bullets) {
      if (b.dead) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > FIELD.width || b.y < 0 || b.y > FIELD.height) {
        b.dead = true;
        continue;
      }
      for (const e of state.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const rr = e.radius + b.radius;
        if (dx * dx + dy * dy < rr * rr) {
          e.hp -= b.damage;
          e.flash = 0.09;
          const len = Math.hypot(b.vx, b.vy) || 1;
          e.x += (b.vx / len) * 6;
          e.y += (b.vy / len) * 6;
          burst(state.particles, rng, b.x, b.y, PALETTE.bullet, 3, 140);
          events |= EVENT_HIT;
          if (e.hp <= 0) {
            killEnemy(e, true);
            events |= EVENT_KILL;
          }
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            b.dead = true;
          }
          break;
        }
      }
    }
    return events;
  }

  function updateOrbs(dt) {
    let events = 0;
    const p = state.player;
    for (const o of state.orbs) {
      if (o.dead) continue;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      if (o.life <= 0 || o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) {
        o.dead = true;
        continue;
      }
      const dx = p.x - o.x;
      const dy = p.y - o.y;
      const rr = p.radius + o.radius;
      if (dx * dx + dy * dy < rr * rr) {
        o.dead = true;
        events |= hurtPlayer(ORB.damage, o.x, o.y);
      }
    }
    return events;
  }

  function updatePickups(dt) {
    let events = 0;
    const p = state.player;
    for (const c of state.pickups) {
      if (c.dead) continue;
      c.t += dt;
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < p.magnet) {
        const pull = 900 * (1 - dist / (p.magnet + 60));
        c.vx += (dx / dist) * pull * dt;
        c.vy += (dy / dist) * pull * dt;
      } else {
        c.vx *= 1 - 2.4 * dt;
        c.vy *= 1 - 2.4 * dt;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (dist < p.radius + 14) {
        c.dead = true;
        state.cores += 1;
        state.bloom += 1;
        const gained = Math.round(5 * multiplier());
        state.score += gained;
        events |= EVENT_PICKUP;
        if (state.bloom >= p.bloomNeed) {
          state.bloom = 0;
          p.hull = Math.min(p.maxHull, p.hull + BLOOM_HEAL);
          addFloat(state.floats, p.x, p.y - 30, `BLOOM +${BLOOM_HEAL}`, PALETTE.core, 18);
          burst(state.particles, rng, p.x, p.y, PALETTE.core, 18, 240);
          events |= EVENT_BLOOM;
        }
      }
    }
    return events;
  }

  function updateParticles(dt) {
    for (const pt of state.particles) {
      pt.t += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 3 * dt;
      pt.vy *= 1 - 3 * dt;
    }
    state.particles = state.particles.filter((pt) => pt.t < pt.life);
    for (const f of state.floats) {
      f.t += dt;
      f.y -= 34 * dt;
    }
    state.floats = state.floats.filter((f) => f.t < f.life);
  }

  function sweep(list) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].dead) list.splice(i, 1);
    }
  }

  function step(dt, ctrl) {
    state.time += dt;
    state.bannerT = Math.max(0, state.bannerT - dt);
    state.shake = Math.max(0, state.shake - dt * 1.6);
    if (state.hitStop > 0) {
      state.hitStop -= dt;
      updateParticles(dt);
      return 0;
    }
    updateParticles(dt);
    if (state.phase !== 'play') return 0;
    let events = 0;
    if (state.comboT > 0) {
      state.comboT -= dt;
      if (state.comboT <= 0) state.combo = 0;
    }
    events |= updatePlayer(dt, ctrl);
    if (state.phase !== 'play') return events;
    if (state.spawnQueue.length > 0) {
      state.spawnT -= dt;
      if (state.spawnT <= 0) {
        const kind = state.spawnQueue.shift();
        const at = spawnPoint();
        state.enemies.push(createEnemy(rng, kind, at.x, at.y, state.wave));
        state.spawnInterval = Math.max(SPAWN.last, state.spawnInterval * 0.94);
        state.spawnT = state.spawnInterval;
      }
    }
    updateEnemies(dt);
    events |= updateBullets(dt);
    events |= updateOrbs(dt);
    events |= updatePickups(dt);
    const p = state.player;
    for (const e of state.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const rr = p.radius + e.radius;
      if (dx * dx + dy * dy < rr * rr) {
        events |= hurtPlayer(e.touch, e.x, e.y);
        if (state.phase !== 'play') break;
      }
    }
    sweep(state.enemies);
    sweep(state.bullets);
    sweep(state.orbs);
    sweep(state.pickups);
    if (state.phase === 'play' && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      const bonus = 50 * state.wave;
      state.score += bonus;
      addFloat(state.floats, FIELD.width / 2, FIELD.height / 2 - 60, `WAVE CLEAR +${bonus}`, PALETTE.gold, 24);
      events |= EVENT_WAVE_CLEAR;
      if (state.wave >= FINAL_WAVE) {
        state.phase = 'won';
        events |= EVENT_WIN;
      } else {
        state.phase = 'upgrade';
        rollUpgrades();
        events |= EVENT_UPGRADE;
      }
    }
    return events;
  }

  function reset() {
    state.phase = 'play';
    state.time = 0;
    state.wave = 1;
    state.score = 0;
    state.kills = 0;
    state.cores = 0;
    state.bloom = 0;
    state.combo = 0;
    state.comboT = 0;
    state.bestCombo = 0;
    state.player = freshPlayer();
    state.enemies = [];
    state.bullets = [];
    state.orbs = [];
    state.pickups = [];
    state.particles = [];
    state.floats = [];
    state.spawnQueue = [];
    state.spawnT = 0;
    state.spawnInterval = SPAWN.first;
    state.shake = 0;
    state.hitStop = 0;
    state.banner = '';
    state.bannerT = 0;
    state.upgradeChoices = [];
    startWave(1);
  }

  function chooseUpgrade(index) {
    const choice = state.upgradeChoices[index];
    if (state.phase !== 'upgrade' || !choice) return 0;
    choice.apply(state.player);
    state.player.upgrades[choice.id] = (state.player.upgrades[choice.id] || 0) + 1;
    state.upgradeChoices = [];
    state.wave += 1;
    state.phase = 'play';
    startWave(state.wave);
    return EVENT_WAVE_START;
  }

  reset();

  return {
    state,
    step,
    reset,
    chooseUpgrade,
    multiplier,
    enemiesLeft() {
      return state.spawnQueue.length + state.enemies.length;
    },
  };
}
