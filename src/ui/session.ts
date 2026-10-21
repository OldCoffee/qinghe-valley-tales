import { SAVE_VERSION } from '../data/config.js';
import { applyAction } from '../engine/actions.js';
import { activityView } from '../engine/activity.js';
import { absoluteDay } from '../engine/calendar.js';
import { createNewGame } from '../engine/state.js';
import { ensureEquipment } from '../engine/systems/equipment.js';
import type { GameState } from '../engine/types.js';
import { color } from './color.js';
import type { GameIO, SaveStore } from './io.js';
import { menuFor, renderMenu } from './menu.js';
import { parseCell, parseCommand, type Parsed } from './parse.js';
import {
  renderActivity,
  renderBundles,
  renderEvents,
  renderForecast,
  renderHeader,
  renderHelp,
  renderInventory,
  renderLocation,
  renderPeople,
  renderPrompt,
  renderShops,
  renderStatus,
  renderTile,
  renderTitle,
  THIN_RULE,
} from './render.js';

const INTRO = [
  '',
  ' 爷爷留下的信里写着："山谷里那块地，就交给你了。"',
  ' 你推开木屋的门，眼前是一片长满杂草和石头的荒地。',
  ' 背包里有 15 包防风草种子。先清理、开垦、播种，再记得每天浇水。',
  ' 小镇上的人们、海边的鱼、山里的矿洞……都在等着你。',
  color.dim(' 提示：输入数字选择菜单，输入 ? 查看全部命令。'),
  '',
].join('\n');

export function renderScreen(s: GameState): string {
  return [renderHeader(s), renderLocation(s), color.dim(THIN_RULE), renderMenu(s)].filter(Boolean).join('\n');
}

export function loadState(store: SaveStore): GameState | null {
  const raw = store.load();
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as GameState;
    if (data.version !== SAVE_VERSION) return null;
    ensureEquipment(data);
    return data;
  } catch {
    return null;
  }
}

async function startGame(io: GameIO, store: SaveStore, seed: number): Promise<GameState | null> {
  const saved = loadState(store);
  if (saved) {
    const answer = await io.ask(' 发现存档。[1] 继续游戏  [2] 新游戏 > ');
    if (answer === null) return null;
    if (answer.trim() !== '2') return saved;
  }
  io.print(INTRO);
  return createNewGame(seed);
}

/** 返回 true 表示要退出游戏 */
async function handleUi(io: GameIO, s: GameState, parsed: Extract<Parsed, { kind: 'ui' }>): Promise<boolean> {
  switch (parsed.command) {
    case 'help':
      io.print(renderHelp());
      break;
    case 'inv':
      io.print(renderInventory(s));
      break;
    case 'map':
      io.print(renderScreen(s));
      break;
    case 'tv':
      io.print(renderForecast(s));
      break;
    case 'shop':
      io.print(renderShops(s));
      break;
    case 'status':
      io.print(renderStatus(s));
      break;
    case 'people':
      io.print(renderPeople(s));
      break;
    case 'bundles':
      io.print(renderBundles(s));
      break;
    case 'look': {
      const cell = parsed.args[0] ? parseCell(parsed.args[0]) : null;
      io.print(cell ? renderTile(s, cell) : color.yellow(' 要查看哪一格？例如：look A1'));
      break;
    }
    case 'quit': {
      const answer = await io.ask(' 进度已自动保存。确定退出？(y/N) > ');
      return answer === null || answer.trim().toLowerCase() === 'y';
    }
  }
  return false;
}

export async function runSession(io: GameIO, store: SaveStore, seed: number): Promise<void> {
  io.print(renderTitle());
  let state = await startGame(io, store, seed);
  if (!state) return;
  io.print(renderScreen(state));

  while (true) {
    const view = activityView(state);
    if (view) io.print(renderActivity(view));
    const line = await io.ask(view ? '选择 > ' : renderPrompt(state));
    if (line === null) break;

    let parsed: Parsed;
    const trimmed = line.trim();
    if (/^\d+$/.test(trimmed) && view) {
      parsed = { kind: 'action', action: { type: 'choose', index: Number(trimmed) - 1 } };
    } else if (/^\d+$/.test(trimmed)) {
      const item = menuFor(state).find((m) => m.key === trimmed);
      if (!item) {
        io.print(color.yellow(' 没有这个选项。'));
        continue;
      }
      const built = await item.build(io, state);
      if (!built) continue;
      parsed = parseCommand(built);
    } else {
      parsed = parseCommand(trimmed);
    }

    if (parsed.kind === 'empty') continue;
    if (parsed.kind === 'error') {
      io.print(color.yellow(' ' + parsed.message));
      continue;
    }
    if (parsed.kind === 'ui') {
      if (await handleUi(io, state, parsed)) return;
      continue;
    }

    const before = absoluteDay(state);
    const result = applyAction(state, parsed.action);
    io.print(renderEvents(result.events));
    if (!result.ok) continue;
    state = result.state;

    // 每个成功动作后都自动存档，避免没睡觉就退出时丢失当天进度
    store.save(JSON.stringify(state));
    if (absoluteDay(state) !== before) {
      io.print(color.dim(' （已自动存档）'));
    }
    if (!state.activity) io.print(renderScreen(state));
  }
  io.print(color.dim(' 再见，山谷会等你回来。'));
}
