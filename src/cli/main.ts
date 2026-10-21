import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setColorEnabled } from '../ui/color.js';
import type { SaveStore } from '../ui/io.js';
import { runSession } from '../ui/session.js';
import { LineInput } from './input.js';

const SAVE_DIR = process.env.QINGHE_SAVE_DIR ?? path.join(process.cwd(), 'saves');
const SAVE_FILE = path.join(SAVE_DIR, 'slot1.json');

const fileStore: SaveStore = {
  load: () => (existsSync(SAVE_FILE) ? readFileSync(SAVE_FILE, 'utf8') : null),
  save: (data) => {
    mkdirSync(SAVE_DIR, { recursive: true });
    const tmp = `${SAVE_FILE}.tmp`;
    writeFileSync(tmp, data);
    renameSync(tmp, SAVE_FILE);
  },
};

function seedFromArgs(): number {
  const index = process.argv.indexOf('--seed');
  const value = index >= 0 ? Number(process.argv[index + 1]) : NaN;
  return Number.isFinite(value) ? value : Date.now();
}

async function main(): Promise<void> {
  setColorEnabled(Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
  const input = new LineInput();
  await runSession({ print: (text) => console.log(text), ask: (prompt) => input.ask(prompt) }, fileStore, seedFromArgs());
  input.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
