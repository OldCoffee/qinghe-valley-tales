import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { setColorEnabled } from '../ui/color.js';
import type { SaveStore } from '../ui/io.js';
import { runSession } from '../ui/session.js';
import { LineInput } from './input.js';

// 存档固定放在用户主目录，与启动目录无关（npx 在任何目录启动都读同一份档）
const SAVE_DIR = process.env.QINGHE_SAVE_DIR ?? path.join(homedir(), '.qinghe-valley-tales');
const SAVE_FILE = path.join(SAVE_DIR, 'slot1.json');
// 旧版存档位置（运行目录下的 saves/），首次启动时自动迁移过来
const LEGACY_SAVE_FILE = path.join(process.cwd(), 'saves', 'slot1.json');

const fileStore: SaveStore = {
  load: () => {
    if (existsSync(SAVE_FILE)) return readFileSync(SAVE_FILE, 'utf8');
    if (existsSync(LEGACY_SAVE_FILE)) return readFileSync(LEGACY_SAVE_FILE, 'utf8');
    return null;
  },
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
