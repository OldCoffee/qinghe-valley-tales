import { FARM_COLS, FARM_ROWS, MIDNIGHT_MINUTES, POINTS_PER_HEART } from '../data/config.js';
import { BUNDLES, ROOMS } from '../data/bundles.js';
import { CROPS } from '../data/crops.js';
import { ITEMS, itemName } from '../data/items.js';
import { WEAPONS } from '../data/mine.js';
import { NPCS } from '../data/npcs.js';
import { PROFESSIONS, SKILL_NAMES, SKILL_ORDER, TOOL_LEVEL_NAMES, TOOL_NAMES } from '../data/skills.js';
import { ROD_NAMES } from '../data/fish.js';
import { GAME_TITLE, LOCATIONS, WEATHER_NAMES, WEEKDAY_NAMES } from '../data/world.js';
import type { ActivityView } from '../engine/activity.js';
import { formatDate, formatTime, shopClosedReason, todayFestival } from '../engine/calendar.js';
import { shippingValue } from '../engine/day.js';
import { cellName, tileAt } from '../engine/farm.js';
import { maxHp, sellPrice, skillProgress } from '../engine/skills.js';
import { bundleDone, donatedCount } from '../engine/systems/bundles.js';
import { shopsAt } from '../engine/systems/economy.js';
import { FISHING_SPOTS } from '../engine/systems/fishing.js';
import { describeFloor, weaponDamage } from '../engine/systems/mine.js';
import { heartsOf, npcsHere } from '../engine/systems/social.js';
import { upgradeCost } from '../engine/systems/tools.js';
import type { Cell, GameEvent, GameState, ItemCategory, Tile, ToolId } from '../engine/types.js';
import { color } from './color.js';

export const RULE = '═'.repeat(52);
export const THIN_RULE = '─'.repeat(52);
const BAR_WIDTH = 16;

const STATUS_NAMES = { friend: '', dating: ' 💐交往中', engaged: ' 💍已订婚', married: ' 💒伴侣' };

function bar(value: number, max: number, width = BAR_WIDTH): string {
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
  const text = '█'.repeat(filled) + '░'.repeat(width - filled);
  const ratio = value / max;
  return ratio > 0.5 ? color.green(text) : ratio > 0.2 ? color.yellow(text) : color.red(text);
}

export function hearts(s: GameState, npcId: string): string {
  const n = heartsOf(s, npcId);
  return color.magenta('♥'.repeat(n)) + color.dim('♡'.repeat(10 - n));
}

export function renderTitle(): string {
  return [
    color.green(RULE),
    color.bold(`   ${GAME_TITLE}`) + color.dim('   v1.0'),
    color.dim('   种田、钓鱼、挖矿、交朋友，过好山谷里的每一天。'),
    color.green(RULE),
  ].join('\n');
}

export function renderHeader(s: GameState): string {
  const time = formatTime(s.minutes);
  const timeText = s.minutes >= MIDNIGHT_MINUTES ? color.red(time) : time;
  const hpMax = maxHp(s);
  const hpPart = s.location === 'mine' || s.hp < hpMax ? `   生命 ${bar(s.hp, hpMax, 10)} ${s.hp}/${hpMax}` : '';
  return [
    color.green(RULE),
    ` ${formatDate(s)}  ${timeText}  ${WEATHER_NAMES[s.weather]}   ${color.yellow(`金币 ${s.gold.toLocaleString()}`)}`,
    ` 体力 ${bar(s.energy, s.maxEnergy)} ${Math.ceil(s.energy)}/${s.maxEnergy}${hpPart}   📍 ${LOCATIONS[s.location].name}`,
    color.green(RULE),
  ].join('\n');
}

function tileGlyph(tile: Tile): string {
  const chars = { grass: '.', weed: '"', stone: 'o', tilled: tile.watered ? '~' : '=', locked: ' ' };
  const groundChar = chars[tile.ground];
  let ground = groundChar;
  if (tile.ground === 'weed') ground = color.green(groundChar);
  else if (tile.ground === 'stone') ground = color.dim(groundChar);
  else if (tile.ground === 'tilled') ground = tile.watered ? color.blue(groundChar) : color.yellow(groundChar);

  if (!tile.crop) return `${ground} `;
  const def = CROPS[tile.crop.cropId];
  if (tile.crop.age >= def.growDays) return ground + color.bold(color.magenta('*'));
  return ground + color.green(tile.crop.age === 0 ? ',' : 'v');
}

export function renderFarm(s: GameState): string {
  const header = '   ' + Array.from({ length: FARM_COLS }, (_, i) => String(i + 1).padEnd(3)).join('');
  const lines = [header];
  s.farm.forEach((row, r) => {
    if (r === FARM_ROWS) {
      if (!s.unlocks.includes('greenhouse')) return;
      lines.push(color.cyan('   ── 温室（不分季节，自动浇水）──'));
    }
    if (r > FARM_ROWS && !s.unlocks.includes('greenhouse')) return;
    lines.push(` ${String.fromCharCode(65 + r)} ` + row.map((tile) => tileGlyph(tile)).join(' '));
  });
  lines.push(color.dim(' 地面 .草地 "杂草 o石头 =已开垦 ~已浇水 | 作物 ,种子 v生长中 *可收获'));
  const bin = Object.keys(s.shippingBin).length;
  if (bin > 0) lines.push(` 📦 出货箱里有 ${bin} 种物品，明早结算约 ${shippingValue(s)} 金。`);
  return lines.join('\n');
}

export function renderLocation(s: GameState): string {
  if (s.location === 'farm') return renderFarm(s);
  const lines: string[] = [];
  if (s.location === 'mine') {
    lines.push(color.bold(` ⛏ 矿洞第 ${s.mine.floor} 层`) + color.dim(`（最深到过第 ${s.mine.deepest} 层）`));
    for (const line of describeFloor(s)) lines.push(`   ${line}`);
    return lines.join('\n');
  }

  const festival = todayFestival(s);
  if (festival && festival.location === s.location) {
    lines.push(color.magenta(` 🎊 今天这里在举办${festival.name}（9:00-14:00 入场）`));
  }
  const people = npcsHere(s);
  if (people.length > 0) {
    lines.push(' 👥 这里有：' + people.map((npc) => `${npc.name} ${hearts(s, npc.id)}`).join('  '));
  }
  const found = s.forage[s.location] ?? [];
  if (found.length > 0) lines.push(` 🌿 可以采集：${found.map(itemName).join('、')}`);
  if (FISHING_SPOTS.includes(s.location)) lines.push(color.dim(' 🎣 这里可以钓鱼'));
  for (const shop of shopsAt(s)) {
    const closed = shopClosedReason(s, shop);
    lines.push(` 🏪 ${shop.name}` + (closed ? color.dim(`（${closed}）`) : color.green('（营业中）')));
  }
  if (s.location === 'town') lines.push(' 🏛 社区中心');
  if (s.location === 'mountain') lines.push(' ⛏ 矿洞入口');
  return lines.join('\n');
}

const PAINT: Record<GameEvent['level'], (t: string) => string> = {
  info: (t) => t,
  good: color.green,
  warn: color.yellow,
  bad: color.red,
  love: color.magenta,
};

export function renderEvents(events: GameEvent[]): string {
  return events.map((e) => ' ' + PAINT[e.level](e.text)).join('\n');
}

export function renderPrompt(s: GameState): string {
  return color.dim(`[${formatTime(s.minutes)} 体力${Math.ceil(s.energy)} ${s.gold}金] `) + '> ';
}

export function renderActivity(view: ActivityView): string {
  return [
    color.cyan(THIN_RULE),
    color.bold(` ${view.title}`),
    ...view.lines.map((l) => `   ${l}`),
    ...view.options.map((o, i) => `   [${i + 1}] ${o}`),
  ].join('\n');
}

const CATEGORY_NAMES: Partial<Record<ItemCategory, string>> = {
  seed: '种子',
  crop: '作物',
  forage: '采集物',
  fish: '鱼',
  ore: '矿石',
  gem: '宝石',
  monster: '怪物掉落',
  food: '食物',
  trash: '杂物',
  special: '特殊',
};

export function renderInventory(s: GameState): string {
  const lines = [color.bold(' 🎒 背包')];
  const groups = new Map<string, string[]>();
  for (const [id, qty] of Object.entries(s.inventory)) {
    const item = ITEMS[id];
    const group = CATEGORY_NAMES[item.category] ?? '其他';
    const extra = item.energy ? color.dim(` +${item.energy}体力`) : '';
    const price = sellPrice(s, id);
    const priceText = price > 0 ? color.dim(` ${price}金`) : '';
    groups.set(group, [...(groups.get(group) ?? []), `${item.name}×${qty}${priceText}${extra}`]);
  }
  if (groups.size === 0) lines.push(color.dim('   空空如也。'));
  for (const [group, items] of groups) lines.push(`   ${color.cyan(group)}：${items.join('，')}`);
  return lines.join('\n');
}

export function renderShops(s: GameState): string {
  const shops = shopsAt(s);
  if (shops.length === 0) return color.dim(' 这里没有商店。');
  const lines: string[] = [];
  for (const shop of shops) {
    const hours = `${formatTime(shop.open)}-${formatTime(shop.close)}${
      shop.closedWeekday !== undefined ? `，周${WEEKDAY_NAMES[shop.closedWeekday]}休息` : ''
    }`;
    lines.push(color.bold(` 🏪 ${shop.name}`) + color.dim(`（${hours}）`));
    const closed = shopClosedReason(s, shop);
    if (closed) lines.push(color.yellow(`   ${closed}`));
    for (const entry of shop.stock(s)) {
      const item = ITEMS[entry.itemId];
      let detail = '';
      if (item.cropId && item.category === 'seed') {
        const crop = CROPS[item.cropId];
        const regrow = crop.regrowDays ? `，之后每 ${crop.regrowDays} 天再收` : '';
        detail = `${crop.growDays} 天成熟${regrow}，售价 ${crop.sellPrice}`;
      } else if (item.category === 'weapon') {
        const w = WEAPONS.find((x) => x.id === item.id)!;
        detail = `伤害 ${w.damage[0]}-${w.damage[1]}`;
      } else if (item.energy) {
        detail = `+${item.energy} 体力`;
      }
      lines.push(`   ${item.name.padEnd(7, '　')} ${color.yellow(`${entry.price} 金`)}  ${color.dim(detail)}`);
    }
    if (shop.buys.length > 0) {
      lines.push(color.dim(`   收购：${shop.buys.map((c) => CATEGORY_NAMES[c] ?? c).join('、')}`));
    }
    if (shop.id === 'blacksmith') {
      for (const tool of ['hoe', 'can', 'pickaxe', 'axe'] as ToolId[]) {
        const cost = upgradeCost(s, tool);
        const text = s.tools[tool] < 0 ? '已报废，先买新的' : cost ? `升级为${cost.name}：${cost.gold} 金 + ${itemName(cost.ore)}×${cost.oreQty}` : '已满级';
        lines.push(color.dim(`   升级${TOOL_NAMES[tool]}（${s.tools[tool] < 0 ? '已报废' : TOOL_LEVEL_NAMES[s.tools[tool]]}）→ ${text}`));
      }
    }
  }
  return lines.join('\n');
}

export function renderForecast(s: GameState): string {
  const notes: Record<string, string> = {
    sunny: '明天是个晴天。',
    rain: '明天有雨，不用浇水啦。',
    storm: '明天有暴风雨，小心闪电！',
    snow: '明天会下雪。',
  };
  return ` 📺 天气预报：${WEATHER_NAMES[s.tomorrowWeather]}，${notes[s.tomorrowWeather]}`;
}

export function renderTile(s: GameState, cell: Cell): string {
  const tile = tileAt(s, cell);
  const groundText = { grass: '草地', weed: '杂草丛', stone: '石头', tilled: '已开垦的土地', locked: '还没修好的温室' }[
    tile.ground
  ];
  const parts = [`${cellName(cell)}：${groundText}`];
  if (tile.ground === 'tilled') parts.push(tile.watered ? '今天浇过水' : '今天还没浇水');
  if (tile.weeds) parts.push('长了杂草，需要除草');
  if (tile.crop) {
    const def = CROPS[tile.crop.cropId];
    const left = def.growDays - tile.crop.age;
    if (tile.crop.wilted) parts.push(`${def.name}已枯萎，没有产出`);
    else parts.push(left > 0 ? `种着${def.name}，还要 ${left} 天成熟` : `${def.name}可以收获了！`);
  }
  return ' ' + parts.join('，') + '。';
}

export function renderStatus(s: GameState): string {
  const lines = [color.bold(' 📊 状态')];
  for (const id of SKILL_ORDER) {
    const p = skillProgress(s.skills[id]);
    const progress = p.isMax
      ? color.dim('（已满级）')
      : color.dim(`（本级 ${p.into}/${p.span} 经验，还差 ${p.toNext}）`);
    lines.push(`   ${SKILL_NAMES[id]} ${String(p.level).padStart(2)} 级 ${progress}`);
  }
  const profs = PROFESSIONS.filter((p) => s.professions.includes(p.id)).map((p) => `${p.name}(${p.desc})`);
  if (profs.length > 0) lines.push(`   职业：${profs.join('；')}`);
  const tools = (['hoe', 'can', 'pickaxe', 'axe'] as ToolId[]).map(
    (t) => `${s.tools[t] < 0 ? '已报废的' : TOOL_LEVEL_NAMES[s.tools[t]]}${TOOL_NAMES[t]}${s.toolUpgrade?.tool === t ? '(升级中)' : ''}`,
  );
  lines.push(`   工具：${tools.join('、')}、${s.tools.rod < 0 ? '已报废的鱼竿' : ROD_NAMES[s.tools.rod]}`);
  const weapon = WEAPONS.find((w) => w.id === s.weapon)!;
  const [lo, hi] = weaponDamage(s);
  lines.push(`   武器：${weapon.name}（伤害 ${lo}-${hi}）  生命上限 ${maxHp(s)}`);
  lines.push(
    color.dim(
      `   累计收入 ${s.stats.totalEarned.toLocaleString()} 金 · 收获 ${s.stats.cropsHarvested} · 钓鱼 ${s.stats.fishCaught}（${s.stats.fishSpecies.length} 种）· 采集 ${s.stats.itemsForaged} · 击败怪物 ${s.stats.monstersKilled} · 矿洞最深 ${s.mine.deepest} 层`,
    ),
  );
  if (s.evaluation) lines.push(color.magenta(`   爷爷的评价：${s.evaluation.candles} 根蜡烛（${s.evaluation.score} 分）`));
  return lines.join('\n');
}

export function renderPeople(s: GameState): string {
  const lines = [color.bold(' 👥 镇民')];
  for (const npc of NPCS) {
    const state = s.npcs[npc.id];
    const tag = npc.marriageable ? color.dim(' 可恋爱') : '';
    const gifts = color.dim(` 本周送礼 ${state.giftsThisWeek}/2${state.talkedToday ? ' · 今天聊过' : ''}`);
    lines.push(`   ${npc.name.padEnd(3, '　')} ${hearts(s, npc.id)} ${color.dim(`${state.friendship} 点`)}${STATUS_NAMES[state.status]}${tag}${gifts}`);
    lines.push(color.dim(`        ${npc.intro} 生日：${{ spring: '春', summer: '夏', fall: '秋', winter: '冬' }[npc.birthday.season]} ${npc.birthday.day} 日`));
  }
  lines.push(color.dim(`   每 ${POINTS_PER_HEART} 点好感 = 1 颗心。8 心送花束可以交往，10 心送美人鱼吊坠可以求婚。`));
  return lines.join('\n');
}

export function renderBundles(s: GameState): string {
  const lines = [color.bold(' 🏛 社区中心')];
  for (const room of ROOMS) {
    const done = s.rewardsClaimed.includes(room.id);
    lines.push(`   ${done ? color.green('✔') : '·'} ${color.cyan(room.name)}${done ? '' : color.dim(` → ${room.unlockText}`)}`);
    for (const bundle of BUNDLES.filter((b) => b.room === room.id)) {
      const parts = Object.entries(bundle.needs).map(([id, qty]) => {
        const have = Math.min(qty, donatedCount(s, bundle.id, id));
        const label = qty > 1 ? `${itemName(id)} ${have}/${qty}` : itemName(id);
        return have >= qty ? color.green(label) : color.dim(label);
      });
      lines.push(`      ${bundleDone(s, bundle) ? color.green('✔') : '·'} ${bundle.name}：${parts.join('、')}`);
    }
  }
  lines.push(color.dim('   在小镇输入 donate 可以一次捐出身上所有需要的物品。'));
  return lines.join('\n');
}

export function renderHelp(): string {
  return [
    color.bold(' 📖 命令帮助') + color.dim('（数字选菜单，或直接输入命令；中英文都行）'),
    color.cyan('   农场'),
    '   开垦 till <格子> · 清理 clear <格子> · 播种 plant <种子> [格子] · 浇水 water · 收获 harvest',
    '   除草 deweed [格子] · 铲除 uproot [格子]（不带格子为全部；铲除不返种子）',
    '   出货 ship [物品] [数量] · 查看 look <格子> · 睡觉 sleep',
    color.cyan('   外出'),
    '   去 go 农场|小镇|海滩|森林|山区 · 等待 wait [分钟] · 吃 eat <物品>',
    '   钓鱼 fish · 采集 forage · 聊天 talk <人> · 送礼 gift <人> <物品>',
    '   买 buy <物品> [数量] · 卖 sell <物品> [数量] · 货架 shop · 参加节日 festival',
    '   升级 upgrade 锄头|水壶|镐子 · 捐献 donate [物品]（社区中心）',
    color.cyan('   矿洞'),
    '   进入 enter [楼层] · 敲 rock [数量] · 攻击 attack · 下楼 down · 离开 leave',
    color.cyan('   查看'),
    '   背包 inv · 地图 map · 状态 status · 人物 people · 收集包 bundles · 天气 tv · 退出 quit',
    color.dim('   格子写法：A1 单格、A1-C3 矩形、多个用空格分隔、all 全部'),
  ].join('\n');
}
