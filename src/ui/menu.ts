import { ITEMS, itemName } from '../data/items.js';
import { BAIT_BY_ID, ROD_BY_ID } from '../data/fishingGear.js';
import { TOOL_LEVEL_NAMES, TOOL_NAMES } from '../data/skills.js';
import { LOCATIONS, TRAVEL_DESTINATIONS } from '../data/world.js';
import { travelTime } from '../engine/actions.js';
import { todayFestival } from '../engine/calendar.js';
import { sellPrice } from '../engine/skills.js';
import { shopsAt } from '../engine/systems/economy.js';
import { fishingSpotAccessReason, FISHING_SPOTS } from '../engine/systems/fishing.js';
import { elevatorFloors } from '../engine/systems/mine.js';
import { npcsHere } from '../engine/systems/social.js';
import type { GameState, ToolId } from '../engine/types.js';
import { color } from './color.js';
import type { GameIO } from './io.js';
import { renderShops } from './render.js';

interface MenuEntry {
  label: string;
  when: (s: GameState) => boolean;
  /** 通过追问补全参数，返回一条文本命令；返回 null 表示取消 */
  build: (io: GameIO, s: GameState) => Promise<string | null>;
}

export interface MenuItem extends MenuEntry {
  key: string;
}

interface Choice {
  label: string;
  value: string;
}

const fixed = (command: string) => async () => command;
const at = (...locs: GameState['location'][]) => (s: GameState) => locs.includes(s.location);

async function askTarget(io: GameIO, defaultAll: boolean): Promise<string | null> {
  const hint = defaultAll ? '回车=全部' : '例如 A1、A1-C3、all';
  const answer = await io.ask(`  哪些格子？（${hint}）> `);
  if (answer === null) return null;
  const trimmed = answer.trim();
  if (!trimmed) return defaultAll ? 'all' : null;
  return trimmed;
}

async function chooseFrom(io: GameIO, title: string, choices: Choice[]): Promise<string | null> {
  if (choices.length === 0) {
    io.print(color.dim(`  ${title}：没有可选的。`));
    return null;
  }
  io.print(`  ${title}：`);
  choices.forEach((c, i) => io.print(`    ${i + 1}. ${c.label}`));
  const answer = await io.ask('  选几号？（回车取消）> ');
  const index = Number(answer?.trim()) - 1;
  return Number.isInteger(index) && choices[index] ? choices[index].value : null;
}

async function askQty(io: GameIO, prompt: string, fallback: string): Promise<string | null> {
  const answer = await io.ask(`  ${prompt}（回车=${fallback === 'all' ? '全部' : fallback}）> `);
  if (answer === null) return null;
  return answer.trim() || fallback;
}

const itemChoices = (s: GameState, filter: (id: string) => boolean, detail: (id: string) => string = () => '') =>
  Object.keys(s.inventory)
    .filter(filter)
    .map((id) => ({ label: `${itemName(id)} ×${s.inventory[id]}${detail(id) ? color.dim(`  ${detail(id)}`) : ''}`, value: id }));

const chooseNpc = (io: GameIO, s: GameState, title: string) =>
  chooseFrom(
    io,
    title,
    npcsHere(s).map((npc) => ({ label: npc.name, value: npc.id })),
  );

const ENTRIES: MenuEntry[] = [
  {
    label: '开垦',
    when: at('farm'),
    build: async (io) => {
      const t = await askTarget(io, false);
      return t && `till ${t}`;
    },
  },
  {
    label: '浇水',
    when: at('farm'),
    build: async (io) => {
      const t = await askTarget(io, true);
      return t && `water ${t}`;
    },
  },
  {
    label: '播种',
    when: at('farm'),
    build: async (io, s) => {
      const id = await chooseFrom(io, '种什么', itemChoices(s, (i) => ITEMS[i].category === 'seed'));
      if (!id) return null;
      const t = await askTarget(io, true);
      return t && `plant ${id} ${t}`;
    },
  },
  { label: '收获', when: at('farm'), build: fixed('harvest all') },
  { label: '自动农具 · 清理整地', when: (s) => s.location === 'farm' && s.unlocks.includes('auto_clear'), build: fixed('autofarm clear') },
  {
    label: '自动农具 · 播种灌溉',
    when: (s) => s.location === 'farm' && s.unlocks.includes('auto_plant'),
    build: async (io, s) => {
      const id = s.autoPlantCropId ?? (await chooseFrom(io, '种什么', itemChoices(s, (i) => ITEMS[i].category === 'seed')));
      return id && `autofarm plant ${id}`;
    },
  },
  { label: '自动农具 · 除草收获', when: (s) => s.location === 'farm' && s.unlocks.includes('auto_harvest'), build: fixed('autofarm harvest') },
  {
    label: '清理',
    when: at('farm'),
    build: async (io) => {
      const t = await askTarget(io, false);
      return t && `clear ${t}`;
    },
  },
  { label: '出货', when: at('farm'), build: fixed('ship all') },
  {
    label: '参加节日',
    when: (s) => todayFestival(s)?.location === s.location,
    build: fixed('festival'),
  },
  { label: '钓鱼', when: (s) => FISHING_SPOTS.includes(s.location), build: fixed('fish') },
  {
    label: '选择鱼竿',
    when: (s) => FISHING_SPOTS.includes(s.location),
    build: async (io, s) => {
      const id = await chooseFrom(io, '选择鱼竿', s.ownedRods.map((rodId) => ({ label: ROD_BY_ID[rodId]?.name ?? rodId, value: rodId })));
      return id && `equiprod ${id}`;
    },
  },
  {
    label: '选择鱼饵',
    when: (s) => FISHING_SPOTS.includes(s.location),
    build: async (io, s) => {
      const choices = Object.keys(s.inventory)
        .filter((id) => !!BAIT_BY_ID[id])
        .map((id) => ({ label: `${BAIT_BY_ID[id].name} ×${s.inventory[id]}`, value: id }));
      choices.unshift({ label: '卸下鱼饵', value: 'none' });
      const id = await chooseFrom(io, '选择鱼饵', choices);
      return id && `equipbait ${id}`;
    },
  },
  { label: '砍树', when: (s) => s.location === 'forest', build: fixed('chop') },
  { label: '探索林子', when: (s) => s.location === 'forest', build: fixed('explore') },
  { label: '采集', when: (s) => (s.forage[s.location]?.length ?? 0) > 0, build: fixed('forage') },
  {
    label: '聊天',
    when: (s) => npcsHere(s).length > 0,
    build: async (io, s) => {
      const id = await chooseNpc(io, s, '和谁聊天');
      return id && `talk ${id}`;
    },
  },
  {
    label: '送礼',
    when: (s) => npcsHere(s).length > 0,
    build: async (io, s) => {
      const npc = await chooseNpc(io, s, '送给谁');
      if (!npc) return null;
      const id = await chooseFrom(io, '送什么', itemChoices(s, (i) => ITEMS[i].category !== 'seed'));
      return id && `gift ${npc} ${id}`;
    },
  },
  {
    label: '买东西',
    when: (s) => shopsAt(s).length > 0,
    build: async (io, s) => {
      io.print(renderShops(s));
      const choices = shopsAt(s).flatMap((shop) =>
        shop.stock(s).map((e) => ({ label: `${itemName(e.itemId)} ${e.price}金`, value: e.itemId })),
      );
      const id = await chooseFrom(io, '买什么', choices);
      if (!id) return null;
      const single = ['tool', 'weapon'].includes(ITEMS[id].category) || id === 'pendant';
      const qty = single ? '1' : await askQty(io, `买几个？你有 ${s.gold} 金`, '1');
      return qty && `buy ${id} ${qty}`;
    },
  },
  {
    label: '卖东西',
    when: (s) => shopsAt(s).some((shop) => shop.buys.length > 0),
    build: async (io, s) => {
      const accepted = new Set(shopsAt(s).flatMap((shop) => shop.buys));
      const choices = itemChoices(
        s,
        (i) => accepted.has(ITEMS[i].category) && sellPrice(s, i) > 0,
        (i) => `单价 ${sellPrice(s, i)}`,
      );
      const id = await chooseFrom(io, '卖什么', choices);
      if (!id) return null;
      const qty = await askQty(io, '卖几个？', 'all');
      return qty && `sell ${id} ${qty}`;
    },
  },
  {
    label: '升级工具',
    when: at('town'),
    build: async (io, s) => {
      const tools: ToolId[] = ['hoe', 'can', 'pickaxe', 'axe'];
      const id = await chooseFrom(
        io,
        '升级哪件工具',
        tools.map((t) => ({ label: `${s.tools[t] < 0 ? '已报废的' : TOOL_LEVEL_NAMES[s.tools[t]]}${TOOL_NAMES[t]}`, value: t })),
      );
      return id && `upgrade ${id}`;
    },
  },
  { label: '捐献给社区中心（自动前往小镇）', when: () => true, build: fixed('donate all') },
  { label: '收集包进度', when: at('town'), build: fixed('bundles') },
  {
    label: '进入矿洞',
    when: at('mountain'),
    build: async (io, s) => {
      const floors = [1, ...elevatorFloors(s)];
      if (floors.length === 1) return 'enter 1';
      const f = await chooseFrom(
        io,
        '坐电梯去几层',
        floors.map((n) => ({ label: `第 ${n} 层`, value: String(n) })),
      );
      return f && `enter ${f}`;
    },
  },
  { label: '敲石头(全部)', when: (s) => s.location === 'mine' && s.mine.rocks > 0, build: fixed('rock all') },
  { label: '敲一块石头', when: (s) => s.location === 'mine' && s.mine.rocks > 0, build: fixed('rock 1') },
  { label: '攻击', when: (s) => s.location === 'mine' && s.mine.monsters.length > 0, build: fixed('attack') },
  { label: '下楼', when: (s) => s.location === 'mine' && s.mine.ladder, build: fixed('down') },
  { label: '离开矿洞', when: at('mine'), build: fixed('leave') },
  {
    label: '吃东西',
    when: (s) => Object.keys(s.inventory).some((id) => ITEMS[id]?.energy),
    build: async (io, s) => {
      const id = await chooseFrom(
        io,
        '吃什么',
        itemChoices(
          s,
          (i) => Boolean(ITEMS[i].energy),
          (i) => `+${ITEMS[i].energy} 体力`,
        ),
      );
      return id && `eat ${id}`;
    },
  },
  {
    label: '前往…',
    when: () => true,
    build: async (io, s) => {
      const choices = TRAVEL_DESTINATIONS.filter((loc) => loc !== s.location).map((loc) => ({
        label: `${LOCATIONS[loc].name} ${color.dim(fishingSpotAccessReason(s, loc) ?? `${travelTime(s, loc)} 分钟`)}`,
        value: loc,
      }));
      const loc = await chooseFrom(io, '去哪里', choices);
      return loc && `go ${loc}`;
    },
  },
  { label: '等一小时', when: (s) => s.location !== 'mine', build: fixed('wait 60') },
  { label: '睡觉', when: at('farm'), build: fixed('sleep') },
  { label: '背包', when: () => true, build: fixed('inv') },
  { label: '状态', when: () => true, build: fixed('status') },
  { label: '人物', when: () => true, build: fixed('people') },
  { label: '天气预报', when: at('farm'), build: fixed('tv') },
  { label: '帮助', when: () => true, build: fixed('help') },
];

export function menuFor(s: GameState): MenuItem[] {
  return ENTRIES.filter((e) => e.when(s)).map((e, i) => ({ ...e, key: String(i + 1) }));
}

export function renderMenu(s: GameState): string {
  const items = menuFor(s).map((m) => `[${m.key}] ${m.label}`);
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += 6) lines.push(' ' + items.slice(i, i + 6).join('  '));
  return lines.join('\n');
}
