// Every pixel the game draws: the lantern-lit field, the spores, the keeper, the
// HUD and every menu. It reads state and never changes it. The playfield is a fixed
// 1280x720 logical area scaled to the window, so the game looks the same anywhere.
import { FIELD, FONT, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CARD_W = 300;
const CARD_H = 200;
const CARD_GAP = 24;
const CARD_Y = 252;

export function upgradeCardRects() {
  const total = 3 * CARD_W + 2 * CARD_GAP;
  const x0 = (FIELD.width - total) / 2;
  return [0, 1, 2].map((i) => ({
    x: x0 + i * (CARD_W + CARD_GAP),
    y: CARD_Y,
    w: CARD_W,
    h: CARD_H,
  }));
}

function hash01(i) {
  return (((i * 2654435761) >>> 0) % 1000) / 1000;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0, w: FIELD.width, h: FIELD.height };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || FIELD.width;
    const ch = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    const scale = Math.min(cw / FIELD.width, ch / FIELD.height);
    view = {
      scale,
      ox: (cw - FIELD.width * scale) / 2,
      oy: (ch - FIELD.height * scale) / 2,
      w: cw,
      h: ch,
    };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resize);
  resize();

  function toLogical(px, py) {
    return { x: (px - view.ox) / view.scale, y: (py - view.oy) / view.scale };
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align, weight) {
    ctx.font = `${weight || 400} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function glowCircle(x, y, radius, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawBackground(state, screen) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.backdropTop);
    g.addColorStop(1, PALETTE.backdropBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let i = 0; i < 90; i += 1) {
      const x = hash01(i) * FIELD.width;
      const y = hash01(i + 500) * FIELD.height;
      const tw = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(state.time * 1.3 + i * 1.7));
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#cdd2ff';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 14; i += 1) {
      const speed = 6 + hash01(i + 90) * 10;
      const x = (hash01(i + 200) * FIELD.width + state.time * speed) % (FIELD.width + 80) - 40;
      const y = 60 + hash01(i + 300) * (FIELD.height - 120) + Math.sin(state.time * 0.5 + i) * 18;
      glowCircle(x, y, 26, 'rgba(139,108,255,0.5)', 0.35);
      ctx.fillStyle = 'rgba(139,108,255,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const vg = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95,
    );
    vg.addColorStop(0, 'rgba(4,5,12,0)');
    vg.addColorStop(1, PALETTE.vignette);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (screen === SCREEN_PLAY || screen === SCREEN_UPGRADE || screen === SCREEN_PAUSED) {
      ctx.strokeStyle = PALETTE.groundGlow;
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, FIELD.width - 12, FIELD.height - 12);
    }
  }

  function drawCore(c) {
    const pulse = 1 + 0.18 * Math.sin(c.t * 5);
    glowCircle(c.x, c.y, 18 * pulse, 'rgba(125,255,176,0.55)', 0.7);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.core;
    const r = 6 * pulse;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  function drawEnemy(e, time) {
    const color = PALETTE[e.kind] || PALETTE.mote;
    if (e.spawnT > 0) {
      const p = 1 - e.spawnT / 0.6;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35 + 0.55 * p;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 26 * (1 - p), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.25 * p;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * p, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    const flash = e.flash > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = flash ? '#ffffff' : color;
    ctx.strokeStyle = flash ? '#ffffff' : color;
    ctx.lineWidth = 2;
    if (e.kind === 'mote') {
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + time * 0.4;
        const r = i % 2 === 0 ? e.radius : e.radius * 0.62;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0b0e1a';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'darter') {
      const aim = Math.atan2(e.vy, e.vx);
      ctx.rotate(aim);
      ctx.beginPath();
      ctx.moveTo(e.radius + 6, 0);
      ctx.lineTo(-e.radius * 0.7, e.radius * 0.75);
      ctx.lineTo(-e.radius * 0.3, 0);
      ctx.lineTo(-e.radius * 0.7, -e.radius * 0.75);
      ctx.closePath();
      ctx.fill();
      if (e.state === 'windup') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (e.kind === 'spitter') {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-e.radius * 0.72, -e.radius * 0.72, e.radius * 1.44, e.radius * 1.44);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = '#0b0e1a';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.orb;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'splitter') {
      ctx.beginPath();
      ctx.arc(-e.radius * 0.45, 0, e.radius * 0.62, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.45, 0, e.radius * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b0e1a';
      ctx.beginPath();
      ctx.arc(-e.radius * 0.45, 0, e.radius * 0.2, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.45, 0, e.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'brute') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + time * 0.25;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0b0e1a';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'king') {
      ctx.beginPath();
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2 + time * 0.3;
        const r = i % 2 === 0 ? e.radius + 8 : e.radius * 0.8;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0b0e1a';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flash ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(-e.radius * 0.2, -e.radius * 0.08, 7, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.2, -e.radius * 0.08, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (e.maxHp >= 6 && e.hp < e.maxHp) {
      const w = e.radius * 2;
      const x = e.x - w / 2;
      const y = e.y - e.radius - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y, w, 5);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w * (e.hp / e.maxHp), 5);
    }
  }

  function drawPlayer(p, time) {
    const blink = p.invuln > 0 && p.dashT <= 0 && Math.floor(time * 14) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (!blink) {
      glowCircle(0, 0, 74, 'rgba(245,185,66,0.5)', 0.8);
      glowCircle(0, 0, 40, 'rgba(255,217,122,0.65)', 0.9);
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.playerCore;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.rotate(p.angle);
      ctx.fillStyle = PALETTE.playerCore;
      ctx.beginPath();
      ctx.moveTo(p.radius + 12, 0);
      ctx.lineTo(p.radius - 2, -6);
      ctx.lineTo(p.radius - 2, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawHud(state, ui) {
    const p = state.player;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(11,14,26,0.55)';
    rr(16, 14, 300, 64, 10);
    ctx.fill();
    text('HULL', 30, 36, 13, PALETTE.muted, 'left', 600);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(30, 44, 200, 14, 7);
    ctx.fill();
    const hullFrac = Math.max(0, p.hull / p.maxHull);
    ctx.fillStyle = hullFrac > 0.5 ? PALETTE.core : hullFrac > 0.25 ? PALETTE.gold : PALETTE.danger;
    if (hullFrac > 0) {
      rr(30, 44, 200 * hullFrac, 14, 7);
      ctx.fill();
    }
    text(`${Math.ceil(p.hull)} / ${p.maxHull}`, 240, 56, 14, PALETTE.text, 'left', 600);
    text(`BLOOM ${state.bloom}/${p.bloomNeed}  ·  CORES ${state.cores}`, 30, 74, 12, PALETTE.muted, 'left', 600);

    ctx.fillStyle = 'rgba(11,14,26,0.55)';
    rr(FIELD.width / 2 - 130, 14, 260, 52, 10);
    ctx.fill();
    text(`WAVE ${state.wave} / 8`, FIELD.width / 2, 36, 17, PALETTE.text, 'center', 700);
    text(`SPORES LEFT ${ui.enemiesLeft}`, FIELD.width / 2, 58, 13, PALETTE.muted, 'center', 600);

    ctx.fillStyle = 'rgba(11,14,26,0.55)';
    rr(FIELD.width - 316, 14, 300, 64, 10);
    ctx.fill();
    text(`SCORE ${state.score.toLocaleString('en-US')}`, FIELD.width - 30, 38, 19, PALETTE.gold, 'right', 700);
    text(`BEST ${ui.best.toLocaleString('en-US')}`, FIELD.width - 30, 60, 13, PALETTE.muted, 'right', 600);
    if (state.combo >= 2) {
      text(`x${ui.multiplier.toFixed(1)} COMBO ${state.combo}`, FIELD.width - 30, 76, 13, PALETTE.core, 'right', 700);
    }

    const dashReady = p.dashCd <= 0;
    ctx.fillStyle = 'rgba(11,14,26,0.55)';
    rr(16, FIELD.height - 52, 220, 36, 10);
    ctx.fill();
    text('DASH [SPACE]', 30, FIELD.height - 29, 13, PALETTE.muted, 'left', 600);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(130, FIELD.height - 39, 88, 10, 5);
    ctx.fill();
    if (dashReady) {
      ctx.fillStyle = PALETTE.gold;
      rr(130, FIELD.height - 39, 88, 10, 5);
      ctx.fill();
    } else {
      ctx.fillStyle = PALETTE.player;
      rr(130, FIELD.height - 39, 88 * (1 - p.dashCd / p.dashCooldown), 10, 5);
      ctx.fill();
    }
    text('M mute', FIELD.width - 30, FIELD.height - 29, 13, PALETTE.muted, 'right', 600);
    if (ui.muted) text('MUTED', FIELD.width - 30, FIELD.height - 52, 13, PALETTE.danger, 'right', 700);

    if (state.bannerT > 0 && state.banner) {
      ctx.globalAlpha = Math.min(1, state.bannerT);
      text(state.banner, FIELD.width / 2, 150, 40, PALETTE.text, 'center', 800);
      ctx.globalAlpha = 1;
    }
    if (p.hull > 0 && p.hull <= 30) {
      const pulse = 0.12 + 0.1 * Math.sin(state.time * 6);
      const rg = ctx.createRadialGradient(
        FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.35,
        FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.9,
      );
      rg.addColorStop(0, 'rgba(255,93,93,0)');
      rg.addColorStop(1, `rgba(255,93,93,${pulse})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawCrosshair(mouse) {
    if (!mouse) return;
    ctx.strokeStyle = 'rgba(242,240,228,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouse.x - 16, mouse.y);
    ctx.lineTo(mouse.x - 6, mouse.y);
    ctx.moveTo(mouse.x + 6, mouse.y);
    ctx.lineTo(mouse.x + 16, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 16);
    ctx.lineTo(mouse.x, mouse.y - 6);
    ctx.moveTo(mouse.x, mouse.y + 6);
    ctx.lineTo(mouse.x, mouse.y + 16);
    ctx.stroke();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(11,14,26,0.78)';
    rr(x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    rr(x, y, w, h, 16);
    ctx.stroke();
  }

  function drawTitle(state, ui) {
    panel(240, 118, 800, 484);
    glowCircle(FIELD.width / 2, 210, 120, 'rgba(245,185,66,0.4)', 0.8);
    text('SPOREKEEPER', FIELD.width / 2, 218, 64, PALETTE.gold, 'center', 800);
    text('LAST LIGHT OF THE HOLLOW', FIELD.width / 2, 252, 20, PALETTE.text, 'center', 600);
    text('The voidspores are coming for the last lantern-garden.', FIELD.width / 2, 306, 17, PALETTE.muted, 'center');
    text('Hold the light. Clear all 8 waves. Do not let the dark in.', FIELD.width / 2, 330, 17, PALETTE.muted, 'center');
    text('WASD / ARROWS — move      MOUSE — aim      HOLD CLICK — shoot', FIELD.width / 2, 392, 16, PALETTE.text, 'center', 600);
    text('SPACE — dash through danger      P — pause      M — mute', FIELD.width / 2, 420, 16, PALETTE.text, 'center', 600);
    text('Slain spores drop lumen cores. Every 20 cores blooms: +15 hull.', FIELD.width / 2, 448, 16, PALETTE.text, 'center', 600);
    text('Between waves, choose one of three boons. Chain kills for a combo.', FIELD.width / 2, 472, 16, PALETTE.text, 'center', 600);
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    text('CLICK OR PRESS SPACE TO BEGIN', FIELD.width / 2, 540, 22, PALETTE.player, 'center', 700);
    ctx.globalAlpha = 1;
    if (ui.best > 0) text(`BEST SCORE ${ui.best.toLocaleString('en-US')}`, FIELD.width / 2, 576, 15, PALETTE.muted, 'center', 600);
  }

  function drawUpgrade(state, ui) {
    ctx.fillStyle = 'rgba(4,5,12,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 150, 40, PALETTE.gold, 'center', 800);
    text('Choose a boon — click a card or press 1, 2 or 3', FIELD.width / 2, 190, 18, PALETTE.text, 'center', 600);
    const rects = upgradeCardRects();
    state.upgradeChoices.forEach((u, i) => {
      const r = rects[i];
      const hover = ui.mouse && ui.mouse.x >= r.x && ui.mouse.x <= r.x + r.w && ui.mouse.y >= r.y && ui.mouse.y <= r.y + r.h;
      ctx.fillStyle = hover ? '#262b47' : PALETTE.panel;
      rr(r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.strokeStyle = hover ? PALETTE.gold : PALETTE.panelEdge;
      ctx.lineWidth = hover ? 3 : 2;
      rr(r.x, r.y, r.w, r.h, 14);
      ctx.stroke();
      text(`[${i + 1}]`, r.x + r.w / 2, r.y + 44, 15, PALETTE.muted, 'center', 700);
      text(u.name, r.x + r.w / 2, r.y + 84, 22, PALETTE.text, 'center', 700);
      text(u.blurb, r.x + r.w / 2, r.y + 118, 15, PALETTE.muted, 'center');
      const owned = state.player.upgrades[u.id] || 0;
      text(owned > 0 ? `Owned ${owned} / ${u.max}` : `New boon`, r.x + r.w / 2, r.y + 158, 13, PALETTE.gold, 'center', 600);
    });
    text(`SCORE ${state.score.toLocaleString('en-US')}  ·  HULL ${Math.ceil(state.player.hull)} / ${state.player.maxHull}`, FIELD.width / 2, 520, 16, PALETTE.muted, 'center', 600);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4,5,12,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, 330, 52, PALETTE.text, 'center', 800);
    text('Press P or click to keep playing', FIELD.width / 2, 380, 18, PALETTE.muted, 'center');
  }

  function drawEnd(state, ui, won) {
    ctx.fillStyle = 'rgba(4,5,12,0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(340, 150, 600, 420);
    if (won) {
      glowCircle(FIELD.width / 2, 240, 130, 'rgba(125,255,176,0.35)', 0.8);
      text('THE GARDEN BLOOMS', FIELD.width / 2, 240, 42, PALETTE.core, 'center', 800);
      text('The Hollow King is dust. The lantern burns on.', FIELD.width / 2, 280, 17, PALETTE.muted, 'center');
    } else {
      text('THE LIGHT DIES', FIELD.width / 2, 240, 46, PALETTE.danger, 'center', 800);
      text(`The spores overran the garden on wave ${state.wave}.`, FIELD.width / 2, 280, 17, PALETTE.muted, 'center');
    }
    text(`SCORE  ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 350, 26, PALETTE.gold, 'center', 700);
    text(`BEST  ${Math.max(ui.best, state.score).toLocaleString('en-US')}`, FIELD.width / 2, 384, 16, PALETTE.muted, 'center', 600);
    text(`WAVES CLEARED  ${won ? 8 : state.wave - 1} / 8     SPORES SLAIN  ${state.kills}     BEST COMBO  x${state.bestCombo}`, FIELD.width / 2, 424, 15, PALETTE.text, 'center', 600);
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    text('PRESS R OR CLICK TO PLAY AGAIN', FIELD.width / 2, 500, 20, PALETTE.player, 'center', 700);
    ctx.globalAlpha = 1;
  }

  function draw(state, screen, ui) {
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    const shakeX = state.shake > 0 ? Math.sin(state.time * 97) * state.shake * 10 : 0;
    const shakeY = state.shake > 0 ? Math.cos(state.time * 113) * state.shake * 10 : 0;
    ctx.translate(shakeX, shakeY);
    drawBackground(state, screen);
    if (screen !== SCREEN_TITLE) {
      for (const c of state.pickups) drawCore(c);
      for (const e of state.enemies) drawEnemy(e, state.time);
      for (const o of state.orbs) {
        glowCircle(o.x, o.y, 16, 'rgba(255,93,162,0.5)', 0.8);
        ctx.fillStyle = PALETTE.orb;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      if (state.phase !== 'over') drawPlayer(state.player, state.time);
      for (const b of state.bullets) {
        ctx.strokeStyle = PALETTE.bullet;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (const pt of state.particles) {
        ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const f of state.floats) {
        ctx.globalAlpha = Math.max(0, 1 - f.t / f.life);
        text(f.text, f.x, f.y, f.size, f.color, 'center', 700);
      }
      ctx.globalAlpha = 1;
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_UPGRADE || screen === SCREEN_PAUSED) {
      drawHud(state, ui);
      if (screen === SCREEN_PLAY) drawCrosshair(ui.mouse);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, ui);
    else if (screen === SCREEN_UPGRADE) drawUpgrade(state, ui);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawEnd(state, ui, false);
    else if (screen === SCREEN_WIN) drawEnd(state, ui, true);
    ctx.restore();
  }

  return { draw, resize, toLogical };
}
