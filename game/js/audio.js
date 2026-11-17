// Every sound the game makes, synthesized with WebAudio — no audio files at all.
// Nothing is created until unlock() runs on a real user gesture, so the game stays
// silent (and error-free) in a headless run or before the player touches it.

export function createAudio() {
  let ctx = null;
  let master = null;
  let padNodes = null;
  let muted = false;

  function ensure() {
    if (ctx || muted) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone({ freq = 440, end = 0, dur = 0.12, type = 'sine', gain = 0.2, delay = 0 }) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.2, gain = 0.2, cutoff = 1200, delay = 0 }) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  }

  function startPad() {
    if (!ensure() || padNodes) return;
    const g = ctx.createGain();
    g.gain.value = 0.035;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 110;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 164.81;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(g);
    g.connect(master);
    o1.start();
    o2.start();
    lfo.start();
    padNodes = { o1, o2, lfo, g };
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startPad();
    },
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
      if (value && padNodes) {
        try { padNodes.o1.stop(); padNodes.o2.stop(); padNodes.lfo.stop(); } catch { /* already stopped */ }
        padNodes = null;
      } else if (!value && ctx) {
        startPad();
      }
    },
    shoot() { tone({ freq: 740, end: 320, dur: 0.09, type: 'square', gain: 0.07 }); },
    dash() { noise({ dur: 0.16, gain: 0.12, cutoff: 2400 }); },
    hit() { noise({ dur: 0.08, gain: 0.14, cutoff: 1800 }); },
    kill() { tone({ freq: 220, end: 60, dur: 0.18, type: 'sawtooth', gain: 0.12 }); noise({ dur: 0.18, gain: 0.1, cutoff: 900 }); },
    pickup() { tone({ freq: 880, end: 1320, dur: 0.1, type: 'sine', gain: 0.12 }); },
    hurt() { tone({ freq: 160, end: 70, dur: 0.28, type: 'sawtooth', gain: 0.2 }); noise({ dur: 0.2, gain: 0.14, cutoff: 700 }); },
    bloom() { tone({ freq: 523, dur: 0.12, gain: 0.14 }); tone({ freq: 659, dur: 0.12, gain: 0.14, delay: 0.09 }); tone({ freq: 784, dur: 0.2, gain: 0.14, delay: 0.18 }); },
    upgrade() { tone({ freq: 392, dur: 0.1, gain: 0.14 }); tone({ freq: 523, dur: 0.1, gain: 0.14, delay: 0.08 }); tone({ freq: 659, dur: 0.16, gain: 0.14, delay: 0.16 }); },
    horn() { tone({ freq: 98, end: 147, dur: 0.7, type: 'sawtooth', gain: 0.12 }); tone({ freq: 196, dur: 0.5, type: 'triangle', gain: 0.08, delay: 0.05 }); },
    waveClear() { tone({ freq: 523, dur: 0.12, gain: 0.13 }); tone({ freq: 784, dur: 0.2, gain: 0.13, delay: 0.1 }); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.22, gain: 0.14, delay: i * 0.14 })); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.14, delay: i * 0.18 })); },
    click() { tone({ freq: 660, dur: 0.05, gain: 0.08 }); },
  };
}
