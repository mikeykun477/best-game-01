// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, upgrade, paused, game over
// and victory.
//
// ?seed=N fixes the spore pattern. ?shot=title|play|over|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_DIGIT_1, ACTION_DIGIT_2, ACTION_DIGIT_3, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART } from './input.js';
import {
  createWorld,
  EVENT_BLOOM, EVENT_DASH, EVENT_HURT, EVENT_KILL, EVENT_OVER,
  EVENT_PICKUP, EVENT_SHOT, EVENT_UPGRADE, EVENT_WAVE_CLEAR, EVENT_WAVE_START, EVENT_WIN,
} from './world.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN, upgradeCardRects } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, {
      best: Math.max(scene.best, readBest()),
      muted: true,
      enemiesLeft: world.enemiesLeft(),
      multiplier: world.multiplier(),
      mouse: { x: 640, y: 360 },
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toLogical);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Clear all 8 waves. Good luck, Keeper.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `Victory. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playSounds(events) {
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_BLOOM) audio.bloom();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_WAVE_CLEAR) audio.waveClear();
    if (events & EVENT_UPGRADE) audio.upgrade();
    if (events & EVENT_WAVE_START) audio.horn();
    if (events & EVENT_WIN) audio.win();
    if (events & EVENT_OVER) audio.lose();
  }

  function cardAt(mouse) {
    const rects = upgradeCardRects();
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) return i;
    }
    return -1;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.muted);
      announce(audio.muted ? 'Sound muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.click();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        startGame();
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_RESTART) {
        startGame();
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      let pick = -1;
      if (actions & ACTION_DIGIT_1) pick = 0;
      else if (actions & ACTION_DIGIT_2) pick = 1;
      else if (actions & ACTION_DIGIT_3) pick = 2;
      else if (actions & ACTION_CONFIRM) pick = cardAt(input.mouse);
      if (pick >= 0 && pick < world.state.upgradeChoices.length) {
        audio.click();
        world.chooseUpgrade(pick);
        screen = SCREEN_PLAY;
        announce(`Wave ${world.state.wave}. ${world.state.upgradeChoices.length} spores left.`);
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) {
        audio.click();
        startGame();
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.state.time += STEP;
      return;
    }
    const dir = input.direction();
    const mouse = input.mouse;
    const events = world.step(STEP, {
      mx: dir.x, my: dir.y,
      aimX: mouse.x, aimY: mouse.y,
      firing: input.firing,
      dash: input.dashing,
    });
    playSounds(events);
    if (events & EVENT_HURT) {
      announce(world.state.player.hull <= 0
        ? 'The light dies.'
        : `Hit. ${Math.ceil(world.state.player.hull)} hull left.`);
    }
    if (world.state.phase === 'upgrade' && screen === SCREEN_PLAY) {
      screen = SCREEN_UPGRADE;
      announce('Wave cleared. Choose a boon.');
    } else if (world.state.phase === 'won' && screen === SCREEN_PLAY) {
      endGame(true);
    } else if (world.state.phase === 'over' && screen === SCREEN_PLAY) {
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, {
      best,
      muted: audio.muted,
      enemiesLeft: world.enemiesLeft(),
      multiplier: world.multiplier(),
      mouse: input.mouse,
    });
  }

  // Leaving the tab pauses a running game rather than letting spores close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Sporekeeper. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
