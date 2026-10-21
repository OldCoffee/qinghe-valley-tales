import { TOOL_UPGRADE_DAYS, TOOL_UPGRADES } from '../../data/config.js';
import { itemName } from '../../data/items.js';
import { SHOPS } from '../../data/shops.js';
import { TOOL_LEVEL_NAMES, TOOL_NAMES } from '../../data/skills.js';
import { absoluteDay, shopClosedReason } from '../calendar.js';
import type { GameEvent, GameState, ToolId } from '../types.js';
import { good, removeItem, warn } from '../util.js';
import { toolMaxDurability } from './equipment.js';

const BLACKSMITH = SHOPS.find((shop) => shop.id === 'blacksmith')!;

export function upgradeCost(s: GameState, tool: ToolId) {
  const next = TOOL_UPGRADES[s.tools[tool]];
  if (!next) return null;
  const discounted = s.unlocks.includes('smith_discount');
  return {
    ...next,
    gold: discounted ? next.gold / 2 : next.gold,
    days: discounted ? 1 : TOOL_UPGRADE_DAYS,
  };
}

export function upgrade(s: GameState, events: GameEvent[], tool: ToolId): boolean {
  if (tool === 'rod') {
    events.push(warn('鱼竿要去海滩的老渔夫那里买。'));
    return false;
  }
  if (s.tools[tool] < 0) {
    events.push(warn(`你的${TOOL_NAMES[tool]}已经报废了，先在铁匠铺买一个新的再来升级。`));
    return false;
  }
  if (s.location !== BLACKSMITH.location) {
    events.push(warn(`工具升级要去小镇的${BLACKSMITH.name}。`));
    return false;
  }
  const closed = shopClosedReason(s, BLACKSMITH);
  if (closed) {
    events.push(warn(closed));
    return false;
  }
  if (s.toolUpgrade) {
    events.push(warn(`${TOOL_NAMES[s.toolUpgrade.tool]}还在升级中，一次只能升级一件工具。`));
    return false;
  }
  const cost = upgradeCost(s, tool);
  if (!cost) {
    events.push(warn(`你的${TOOL_NAMES[tool]}已经是最好的了。`));
    return false;
  }
  if (s.gold < cost.gold || (s.inventory[cost.ore] ?? 0) < cost.oreQty) {
    events.push(warn(`升级需要 ${cost.gold} 金和${itemName(cost.ore)} ×${cost.oreQty}。`));
    return false;
  }
  s.gold -= cost.gold;
  removeItem(s, cost.ore, cost.oreQty);
  s.toolUpgrade = { tool, readyDay: absoluteDay(s) + cost.days };
  events.push(
    good(`把${TOOL_NAMES[tool]}交给了铁匠，${cost.days} 天后会升级成${cost.name}${TOOL_NAMES[tool]}。这期间不能使用它。`),
  );
  return true;
}

export function finishUpgrades(s: GameState, events: GameEvent[]): void {
  if (!s.toolUpgrade || absoluteDay(s) < s.toolUpgrade.readyDay) return;
  const tool = s.toolUpgrade.tool;
  s.tools[tool] += 1;
  s.durability[tool] = toolMaxDurability(s.tools[tool]);
  s.toolUpgrade = null;
  events.push(good(`🔨 铁匠把升级好的${TOOL_LEVEL_NAMES[s.tools[tool]]}${TOOL_NAMES[tool]}送到了你家门口，耐久也回满了。`));
}
