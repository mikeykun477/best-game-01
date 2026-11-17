# Sporekeeper — Last Light of the Hollow

[![make.fun best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/mikeykun477/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/mikeykun477/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

An entry for [make.fun](https://make.fun)'s `best-game-01` — "Make the best game".

You are the last Keeper of a dying hollow. Hold the light through 8 waves of
voidspores, then break the Spore King, and the hollow lives one more dawn.

## Play

Open `game/index.html` in a desktop browser, or serve the game and play it at
`http://localhost:8080`:

```sh
node serve.ts
```

No build step, no network request: the game is plain static files under `game/`.

| Control | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold left click | Shoot light bolts |
| Space | Dash (brief invulnerability, recharges) |
| 1 / 2 / 3 or click a card | Pick a boon between waves |
| P or Esc | Pause |
| R | Restart |
| M | Mute / unmute |
| Space or click on the title / end screens | Start / play again |

## The game

- **8 waves** of voidspores that grow in number and kind: motes, darters,
  spitters (their orbs hurt), splitters that break apart, brutes — and the
  **Spore King** at the end of wave 8. Clear wave 8 and you win.
- **Boons between waves**: after every cleared wave, pick 1 of 3 upgrades —
  Twin Lantern, Heavy Light, Rapid Wick, Piercing Ray, Swift Step, Thick Bark,
  Magnet Bloom, Long Wick, Dash Sigil, Bloom Heart — and build your Keeper.
- **Combo multiplier**: kills within 3 seconds of each other chain the score
  multiplier, up to 3x.
- **Bloom**: collect 20 cores and the hollow blooms, healing you.
- **HUD** shows hull, wave, spores left, score, combo, cores and best score.
  Your best score is kept in the browser between visits.
- **Sound** is synthesized in the browser (WebAudio) — shots, kills, pickups,
  the wave horn, victory and defeat. Nothing is downloaded.
- **Screens**: title, play, upgrade choice, pause, game over, victory — each
  with its own art and a restart.

## Screenshots

`screenshots/` holds 4 real renders of the game's own code, staged
deterministically with `?shot=…&seed=1` (see `shots.json`):

1. `1-title.jpg` — the title screen (cover)
2. `2-play.jpg` — mid-fight, wave 3, HUD visible
3. `3-over.jpg` — game over
4. `4-win.jpg` — victory over the Spore King

The staging is built into the game: `game/js/shots.js` plays the real rules
forward from a fresh world with a simple autopilot, so each frame is what a
short game really looks like, and the same seed always gives the same frame.
`?seed=N` fixes the spore pattern for any run; `?shot=title|play|over|win`
stages a scene instead of running the loop.

## Layout

```
main.ts            entry program: copies game/ + screenshots/ to /output,
                   writes /output/dossier.json with vendor/makefun-game.ts
serve.ts           tiny static server for local play-testing
shots.json         the four staged screenshots and their ?shot= URLs
screenshots/       1-title, 2-play, 3-over, 4-win (JPEG, 1280x720)
vendor/            the kit's makefun-game.ts library, unchanged
game/
  index.html       canvas + boot script
  js/
    config.js      tuning numbers, waves, upgrades, palette
    random.js      seeded random (the same seed, the same game)
    input.js       keyboard + mouse + touch
    entities.js    player, enemies, bullets, orbs, cores
    world.js       simulation: waves, spawning, combat, combo, Bloom
    render.js      canvas painting: field, HUD, menus, screens
    audio.js       synthesized WebAudio sound effects
    shots.js       ?shot= staging: title / play / over / win
    main.js        boot, the fixed-step loop, screen flow
```

## Handing it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That writes `out/game/`, `out/screenshots/` and `out/dossier.json`. The
program runs twice in the grader and must write the same bytes both times.

## License

MIT — see `LICENSE`.
