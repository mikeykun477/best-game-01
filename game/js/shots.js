// The scenes behind ?shot=title|play|over|win. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot (lead
// the nearest spore, keep a fighting distance, sidestep orbs, dash out of a crowd,
// gather cores when the field is quiet), so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Upgrade pick order for the win run: damage first, then survival. */
const WIN_PICKS = ['twin', 'heavy', 'rapid', 'pierce', 'bark', 'swift', 'magnet', 'longwick', 'dash', 'heart'];

const PLAY_MAX_SECONDS = 150;
const END_MAX_SECONDS = 120;
const WIN_MAX_SECONDS = 900;

/** The control the autopilot feeds the world each step. */
function autopilot(state) {
  const p = state.player;
  let target = null;
  let td = Infinity;
  for (const e of state.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < td) {
      td = d;
      target = e;
    }
  }
  let threat = null;
  let od = Infinity;
  for (const o of state.orbs) {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < od) {
      od = d;
      threat = o;
    }
  }
  let mx = 0;
  let my = 0;
  let aimX = p.x + Math.cos(p.angle) * 100;
  let aimY = p.y + Math.sin(p.angle) * 100;
  if (target) {
    const flight = td / p.bulletSpeed;
    aimX = target.x + target.vx * flight;
    aimY = target.y + target.vy * flight;
    const dx = p.x - target.x;
    const dy = p.y - target.y;
    const len = Math.hypot(dx, dy) || 1;
    if (td < 150) {
      mx = dx / len;
      my = dy / len;
    } else if (td > 300) {
      mx = -dx / len;
      my = -dy / len;
    } else {
      mx = (-dy / len) * 0.7;
      my = (dx / len) * 0.7;
    }
  }
  if (threat && od < 130) {
    const ol = Math.hypot(threat.vx, threat.vy) || 1;
    mx = -threat.vy / ol;
    my = threat.vx / ol;
  }
  if ((!target || td > 200) && (!threat || od >= 130)) {
    let core = null;
    let cd = Infinity;
    for (const c of state.pickups) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < cd) {
        cd = d;
        core = c;
      }
    }
    if (core && cd < 280) {
      mx = (core.x - p.x) / cd;
      my = (core.y - p.y) / cd;
    }
  }
  return {
    mx, my, aimX, aimY,
    firing: !!target,
    dash: !!target && td < 80 && p.dashCd <= 0,
  };
}

function idlePilot() {
  return { mx: 0, my: 0, aimX: 640, aimY: 360, firing: false, dash: false };
}

function pickBestUpgrade(world) {
  const choices = world.state.upgradeChoices;
  for (const id of WIN_PICKS) {
    const i = choices.findIndex((u) => u.id === id);
    if (i !== -1) return i;
  }
  return 0;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * score to show. Any name other than play, over or win is the title.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'play') {
    for (let i = 0; i < PLAY_MAX_SECONDS / STEP; i += 1) {
      // A cleared wave waits on an upgrade pick: take the best one so the run
      // keeps going instead of stalling on the upgrade screen.
      if (state.phase === 'upgrade') {
        world.chooseUpgrade(pickBestUpgrade(world));
        continue;
      }
      world.step(STEP, autopilot(state));
      if (state.phase === 'over' || state.phase === 'won') break;
      if (state.wave >= 3 && state.enemies.length >= 4 && state.score > 0) break;
    }
    return { screen: state.phase === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'over') {
    for (let i = 0; i < END_MAX_SECONDS / STEP; i += 1) {
      world.step(STEP, idlePilot());
      if (state.phase === 'over') break;
    }
    return { screen: state.phase === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'win') {
    for (let i = 0; i < WIN_MAX_SECONDS / STEP; i += 1) {
      if (state.phase === 'upgrade') {
        world.chooseUpgrade(pickBestUpgrade(world));
        continue;
      }
      if (state.phase === 'won' || state.phase === 'over') break;
      world.step(STEP, autopilot(state));
    }
    return { screen: state.phase === 'won' ? SCREEN_WIN : SCREEN_OVER, best: state.score };
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
