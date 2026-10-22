import { FARM_COLS, TOTAL_ROWS } from '../data/config.js';
import { BAITS, RODS } from '../data/fishingGear.js';
import { findCrop, findItem, seedIdOf } from '../data/items.js';
import { findNpc } from '../data/npcs.js';
import { findLocation } from '../data/world.js';
import type { Action, Cell, Quantity, Target, ToolId } from '../engine/types.js';

export type UiCommand =
  | 'help'
  | 'inv'
  | 'map'
  | 'tv'
  | 'shop'
  | 'look'
  | 'quit'
  | 'status'
  | 'people'
  | 'bundles';

export type Parsed =
  | { kind: 'action'; action: Action }
  | { kind: 'ui'; command: UiCommand; args: string[] }
  | { kind: 'error'; message: string }
  | { kind: 'empty' };

const ALIASES: Record<string, string[]> = {
  till: ['till', 't', '开垦', '锄地'],
  water: ['water', 'w', '浇水'],
  plant: ['plant', 'p', '播种', '种'],
  harvest: ['harvest', 'h', '收获'],
  clear: ['clear', 'c', '清理'],
  deweed: ['deweed', '除草'],
  uproot: ['uproot', '铲除', '拔除'],
  go: ['go', 'g', '去', '前往'],
  buy: ['buy', 'b', '买', '购买'],
  sell: ['sell', '卖', '出售'],
  ship: ['ship', 's', '出货'],
  eat: ['eat', 'e', '吃'],
  wait: ['wait', '等', '等待'],
  sleep: ['sleep', 'z', '睡觉'],
  fish: ['fish', 'f', '钓鱼'],
  forage: ['forage', 'pick', '采集', '采'],
  chop: ['chop', '砍树', '砍'],
  grove: ['grove', '采点'],
  explore: ['explore', '探索', '逛林子'],
  talk: ['talk', '聊天', '说话'],
  gift: ['gift', '送', '送礼'],
  enter: ['enter', '进入', '进矿', '下矿'],
  rock: ['rock', 'r', '敲', '挖', '敲石头'],
  attack: ['attack', 'a', '攻击', '打'],
  down: ['down', 'd', '下楼'],
  leave: ['leave', '离开', '出矿'],
  upgrade: ['upgrade', '升级'],
  equip: ['equip', '装备'],
  equiprod: ['equiprod', '装备鱼竿', '换鱼竿'],
  equipbait: ['equipbait', '装备鱼饵', '换鱼饵'],
  unequip: ['unequip', '卸下'],
  repair: ['repair', '修理', '修复'],
  donate: ['donate', '捐', '捐献'],
  autofarm: ['autofarm', '自动农具', '自动干活'],
  festival: ['festival', '节日', '参加'],
  heal: ['heal', '治疗', '看病'],
  inv: ['inv', 'i', '背包'],
  map: ['map', 'm', '地图', '看看'],
  tv: ['tv', '天气', '电视'],
  shop: ['shop', '货架', '看货', '商店'],
  look: ['look', 'l', '查看'],
  status: ['status', 'skills', '状态', '技能'],
  people: ['people', 'who', '人物', '关系'],
  bundles: ['bundles', 'cc', '收集包', '社区中心'],
  help: ['help', '?', '？', '帮助'],
  quit: ['quit', 'q', 'exit', '退出'],
};

const ALL_WORDS = ['all', '全部', '所有'];

const TOOL_ALIASES: Record<ToolId, string[]> = {
  hoe: ['hoe', '锄头'],
  can: ['can', '水壶', '喷壶'],
  pickaxe: ['pickaxe', '镐', '镐子'],
  rod: ['rod', '鱼竿'],
  axe: ['axe', '斧头', '斧'],
};

function resolveVerb(word: string): string | undefined {
  const w = word.toLowerCase();
  return Object.keys(ALIASES).find((verb) => ALIASES[verb].includes(w));
}

export function parseCell(text: string): Cell | null {
  const m = /^([a-z])(\d+)$/i.exec(text);
  if (!m) return null;
  const row = m[1].toUpperCase().charCodeAt(0) - 65;
  const col = Number(m[2]) - 1;
  if (row < 0 || row >= TOTAL_ROWS || col < 0 || col >= FARM_COLS) return null;
  return { row, col };
}

/** 支持 all、A1、A1-C3，多个目标用空格或逗号分隔 */
export function parseTarget(tokens: string[], defaultAll: boolean): Target | { error: string } {
  const parts = tokens.join(' ').split(/[\s,，、]+/).filter(Boolean);
  if (parts.length === 0) {
    return defaultAll ? 'all' : { error: '请指定格子，例如 A1、A1-C3 或 all。' };
  }
  if (parts.some((p) => ALL_WORDS.includes(p.toLowerCase()))) return 'all';

  const seen = new Set<string>();
  const cells: Cell[] = [];
  for (const part of parts) {
    const [fromText, toText = fromText] = part.split('-');
    const from = parseCell(fromText);
    const to = parseCell(toText);
    if (!from || !to) {
      const lastRow = String.fromCharCode(64 + TOTAL_ROWS);
      return { error: `无法识别的格子"${part}"，行是 A-${lastRow}，列是 1-${FARM_COLS}，例如 A1 或 A1-C3。` };
    }
    for (let row = Math.min(from.row, to.row); row <= Math.max(from.row, to.row); row++) {
      for (let col = Math.min(from.col, to.col); col <= Math.max(from.col, to.col); col++) {
        const key = `${row},${col}`;
        if (!seen.has(key)) {
          seen.add(key);
          cells.push({ row, col });
        }
      }
    }
  }
  return cells;
}

function parseQty(token: string | undefined, fallback: Quantity): Quantity | null {
  if (token === undefined) return fallback;
  if (ALL_WORDS.includes(token.toLowerCase())) return 'all';
  const n = Number(token);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** 把"物品名 [数量]"拆开，数量可省略 */
function splitItemAndQty(args: string[]): { name: string; qtyToken?: string } {
  const last = args[args.length - 1];
  if (args.length > 1 && (/^\d+$/.test(last) || ALL_WORDS.includes(last.toLowerCase()))) {
    return { name: args.slice(0, -1).join(' '), qtyToken: last };
  }
  return { name: args.join(' ') };
}

const action = (a: Action): Parsed => ({ kind: 'action', action: a });
const error = (message: string): Parsed => ({ kind: 'error', message });

export function parseCommand(line: string): Parsed {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { kind: 'empty' };
  const [word, ...args] = tokens;
  const verb = resolveVerb(word);
  if (!verb) return error(`不认识的命令"${word}"，输入 ? 查看帮助。`);

  const withTarget = (defaultAll: boolean, rest: string[], build: (t: Target) => Action): Parsed => {
    const t = parseTarget(rest, defaultAll);
    return typeof t === 'object' && 'error' in t ? error(t.error) : action(build(t));
  };

  switch (verb) {
    case 'till':
    case 'clear':
      return withTarget(false, args, (target) => ({ type: verb, target }));
    case 'water':
    case 'harvest':
    case 'deweed':
    case 'uproot':
      return withTarget(true, args, (target) => ({ type: verb, target }));
    case 'plant': {
      if (args.length === 0) return error('要种什么？例如：plant 防风草 A1-B4');
      const crop = findCrop(args[0]);
      if (!crop) return error(`不认识的种子"${args[0]}"。`);
      return withTarget(true, args.slice(1), (target) => ({ type: 'plant', cropId: crop.id, target }));
    }
    case 'go': {
      const loc = args[0] ? findLocation(args[0]) : undefined;
      if (!loc) return error('要去哪里？可以去：农场、小镇、海滩、森林、山区。');
      return action({ type: 'move', to: loc.id });
    }
    case 'buy': {
      if (args.length === 0) return error('要买什么？例如：buy 防风草 10');
      const { name, qtyToken } = splitItemAndQty(args);
      const item = findItem(name);
      if (!item) return error(`没有"${name}"这种东西。`);
      const qty = parseQty(qtyToken, 1);
      if (qty === null || qty === 'all') return error('购买数量要是正整数。');
      const itemId = item.category === 'crop' && item.cropId ? seedIdOf(item.cropId) : item.id;
      return action({ type: 'buy', itemId, qty });
    }
    case 'sell':
    case 'ship': {
      if (verb === 'ship' && (args.length === 0 || ALL_WORDS.includes(args[0].toLowerCase()))) {
        return action({ type: 'ship', itemId: 'all', qty: 'all' });
      }
      if (args.length === 0) return error('要卖什么？例如：sell 防风草 5');
      const { name, qtyToken } = splitItemAndQty(args);
      const item = findItem(name);
      if (!item) return error(`不认识的物品"${name}"。`);
      const qty = parseQty(qtyToken, 'all');
      if (qty === null) return error('数量要是正整数或 all。');
      return action({ type: verb, itemId: item.id, qty });
    }
    case 'eat': {
      const item = args[0] ? findItem(args.join(' ')) : undefined;
      if (!item) return error('要吃什么？例如：eat 防风草');
      return action({ type: 'eat', itemId: item.id });
    }
    case 'wait': {
      const minutes = args[0] === undefined ? 60 : Number(args[0]);
      return action({ type: 'wait', minutes });
    }
    case 'sleep':
      return action({ type: 'sleep' });
    case 'fish':
      return action({ type: 'fish' });
    case 'forage':
      return action({ type: 'forage' });
    case 'chop':
      return action({ type: 'chop' });
    case 'grove': {
      const map: Record<string, 'mushroom' | 'flowers' | 'fruit'> = {
        mushroom: 'mushroom',
        蘑菇圈: 'mushroom',
        flowers: 'flowers',
        野花丛: 'flowers',
        fruit: 'fruit',
        野果树: 'fruit',
      };
      const grove = args[0] ? map[args[0]] : undefined;
      if (!grove) return error('去哪个采集点？例如：grove 蘑菇圈 / 野花丛 / 野果树');
      return action({ type: 'grove', grove });
    }
    case 'explore':
      return action({ type: 'forestExplore' });
    case 'talk': {
      const npc = args[0] ? findNpc(args[0]) : undefined;
      if (!npc) return error('要和谁聊天？例如：talk 苏禾');
      return action({ type: 'talk', npcId: npc.id });
    }
    case 'gift': {
      const npc = args[0] ? findNpc(args[0]) : undefined;
      const item = args.length > 1 ? findItem(args.slice(1).join(' ')) : undefined;
      if (!npc || !item) return error('送什么给谁？例如：gift 苏禾 草莓');
      return action({ type: 'gift', npcId: npc.id, itemId: item.id });
    }
    case 'enter': {
      if (args[0] === undefined) return action({ type: 'enterMine' });
      const floor = Number(args[0]);
      if (!Number.isInteger(floor) || floor < 1) return error('楼层要是正整数，例如：enter 10');
      return action({ type: 'enterMine', floor });
    }
    case 'rock': {
      const count = parseQty(args[0], 'all');
      if (count === null) return error('要敲几块？例如：rock 3 或 rock all');
      return action({ type: 'mineRock', count });
    }
    case 'attack':
      return action({ type: 'attack' });
    case 'down':
      return action({ type: 'descend' });
    case 'leave':
      return action({ type: 'leaveMine' });
    case 'upgrade': {
      const word = args[0]?.toLowerCase() ?? '';
      const tool = (Object.keys(TOOL_ALIASES) as ToolId[]).find((t) => TOOL_ALIASES[t].includes(word));
      if (!tool) return error('要升级什么工具？锄头、水壶或镐子，例如：upgrade 镐子');
      return action({ type: 'upgrade', tool });
    }
    case 'autofarm': {
      const word = (args[0] ?? '').toLowerCase();
      const job = (['clear', 'plant', 'harvest'] as const).find((j) => j === word) ??
        (word.includes('清理') || word.includes('整地') ? 'clear' : word.includes('种') || word.includes('播') ? 'plant' : word.includes('收') ? 'harvest' : null);
      if (!job) return error('自动农具要做什么？autofarm clear（清理整地）/ plant（播种灌溉）/ harvest（除草收获）');
      // plant 需要作物: autofarm plant 防风草
      let cropId: string | undefined;
      if (job === 'plant' && args[1]) {
        const crop = findCrop(args.slice(1).join(' '));
        if (!crop) return error(`不认识的作物"${args.slice(1).join(' ')}"。`);
        cropId = crop.id;
      }
      return action({ type: 'autoFarm', job, cropId });
    }
    case 'donate': {
      if (args.length === 0 || ALL_WORDS.includes(args[0].toLowerCase())) {
        return action({ type: 'donate', itemId: 'all' });
      }
      const item = findItem(args.join(' '));
      if (!item) return error(`不认识的物品"${args.join(' ')}"。`);
      return action({ type: 'donate', itemId: item.id });
    }
    case 'equip': {
      const word = args[0]?.toLowerCase() ?? '';
      const tool = (Object.keys(TOOL_ALIASES) as ToolId[]).find((t) => TOOL_ALIASES[t].includes(word));
      if (tool) return action({ type: 'equipTool', tool });
      const item = findItem(args.join(' '));
      if (!item || item.category !== 'weapon') return error('要装备什么？例如：equip 镐子 或 equip 铁剑');
      return action({ type: 'equipWeapon', itemId: item.id });
    }
    case 'equiprod': {
      const name = args.join(' ').toLowerCase();
      const rod = RODS.find((r) => [r.id, r.itemId, r.name].some((x) => x.toLowerCase() === name));
      if (!rod) return error('要装备哪支鱼竿？');
      return action({ type: 'equipRod', rodId: rod.id });
    }
    case 'equipbait': {
      const name = args.join(' ').toLowerCase();
      if (['', 'none', '卸下', '无'].includes(name)) return action({ type: 'equipBait', baitId: null });
      const bait = BAITS.find((b) => [b.id, b.name].some((x) => x.toLowerCase() === name));
      if (!bait) return error('要装备哪种鱼饵？');
      return action({ type: 'equipBait', baitId: bait.id });
    }
    case 'unequip': {
      const word = args[0]?.toLowerCase() ?? '';
      const tool = (Object.keys(TOOL_ALIASES) as ToolId[]).find((t) => TOOL_ALIASES[t].includes(word));
      if (tool) return action({ type: 'unequipTool', tool });
      return action({ type: 'unequipWeapon' });
    }
    case 'repair': {
      const word = args[0]?.toLowerCase() ?? '';
      const tool = (Object.keys(TOOL_ALIASES) as ToolId[]).find((t) => TOOL_ALIASES[t].includes(word));
      if (tool) return action({ type: 'repair', target: tool });
      const item = findItem(args.join(' '));
      if (!item || item.category !== 'weapon') return error('要修什么？例如：repair 镐子 或 repair 铁剑（去铁匠铺，鱼竿去渔具店）');
      return action({ type: 'repair', target: item.id });
    }
    case 'festival':
      return action({ type: 'festival' });
    case 'heal':
      return action({ type: 'heal' });
    default:
      return { kind: 'ui', command: verb as UiCommand, args };
  }
}
