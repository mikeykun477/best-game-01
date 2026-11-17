// Keyboard and mouse, read as one input. The game polls direction(), firing and the
// aim point every frame, and takes edge-triggered actions (confirm, pause, digits)
// once through takeActions(). toLogical converts a page point to playfield coordinates.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_DIGIT_1 = 16;
export const ACTION_DIGIT_2 = 32;
export const ACTION_DIGIT_3 = 64;

const MOVE_KEYS = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
};

export function createInput(canvas, toLogical) {
  const keys = new Set();
  let queued = 0;
  let mouse = { x: FIELD.width / 2, y: FIELD.height / 2 };
  let firing = false;

  function press(action) {
    queued |= action;
  }

  function onKeyDown(event) {
    if (event.code in MOVE_KEYS || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') press(ACTION_CONFIRM);
    else if (event.code === 'KeyP' || event.code === 'Escape') press(ACTION_PAUSE);
    else if (event.code === 'KeyR') press(ACTION_RESTART);
    else if (event.code === 'KeyM') press(ACTION_MUTE);
    else if (event.code === 'Digit1') press(ACTION_DIGIT_1);
    else if (event.code === 'Digit2') press(ACTION_DIGIT_2);
    else if (event.code === 'Digit3') press(ACTION_DIGIT_3);
    else if (event.code === 'KeyJ' || event.code === 'KeyF') firing = true;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
    if (event.code === 'KeyJ' || event.code === 'KeyF') firing = false;
  }

  function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse = toLogical(event.clientX - rect.left, event.clientY - rect.top);
  }

  function onMouseDown(event) {
    trackMouse(event);
    if (event.button === 0) {
      firing = true;
      press(ACTION_CONFIRM);
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) firing = false;
  }

  function onBlur() {
    keys.clear();
    firing = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', trackMouse);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    direction() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const d = MOVE_KEYS[code];
        if (d) {
          x += d[0];
          y += d[1];
        }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    get firing() {
      return firing;
    },
    get dashing() {
      return keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    get mouse() {
      return mouse;
    },
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
  };
}
