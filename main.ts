// Sporekeeper — Last Light of the Hollow. The entry program for best-game-01.
//
// This file hands the game in. It takes the two folders that make up the entry —
// game/ (the playable game: plain static files a desktop browser loads offline,
// game/index.html and its ES modules, no library, no network request) and
// screenshots/ (three or four real renders of the game's own code, the first by
// name the cover) — copies them from beside this file into the output directory,
// and writes output/dossier.json with the vendored make.fun library, the summary
// the judge reads. The copy is byte for byte deterministic: the same repository
// state always writes the same output, so the grader's two runs agree.
//
// Node 22, standard library only. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader's container MAKEFUN_OUTPUT_DIR is unset and /output is used.
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// The scorer's caps, from the competition's gate: only text_max_bytes shapes the
// dossier's bytes; the rest make this program refuse an entry the scorer would
// refuse — more than 4 screenshots, one over 256 KiB, more than 993 files in
// game/ or 48 MiB of game files in all, or a path under game/ over 1000 bytes.
// game/ counts beside /output's own 1000-entry cap, together with screenshots/
// and dossier.json, so 993 game entries plus those make 1000.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  throw new Error(`best-game-01 entry: ${message}`);
}

if (!existsSync(join(gameDir, 'index.html')) || !statSync(join(gameDir, 'index.html')).isFile()) {
  fail('game/index.html is missing — nothing to hand in');
}
if (!existsSync(shotsDir)) fail('screenshots/ is missing — the entry needs 3 or 4 screenshots');
const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
if (shots.length < 3 || shots.length > 4) {
  fail(`screenshots/ holds ${shots.length} images — the entry needs 3 or 4`);
}

mkdirSync(outputDir, { recursive: true });
cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, CAPS));
console.log(`wrote ${outputDir}/dossier.json (${shots.length} screenshots)`);
