import { TOOL_UPGRADES } from '../../data/config.js';
import { itemName } from '../../data/items.js';
import { SHOPS } from '../../data/shops.js';
import { TOOL_LEVEL_NAMES, TOOL_NAMES } from '../../data/skills.js';
import { shopClosedReason } from '../calendar.js';
import type { GameEvent, GameState, ToolId } from '../types.js';
import { good, removeItem, warn } from '../util.js';
import { shopUnavailableReason } from './social.js';
import { toolMaxDurability } from './equipment.js';

const BLACKSMITH = SHOPS.find((shop) => shop.id === 'blacksmith')!;

export function upgradeCost(s: GameState, tool: ToolId) {
  const next = TOOL_UPGRADES[s.tools[tool]];
  if (!next) return null;
  return { ...next, gold: next.gold };
}

/** 旧存档里还在等待中的升级：直接完成（等级 +1、耐久回满），不再等工期 */
export function settlePendingUpgrade(s: GameState): boolean {
  if (!s.toolUpgrade) return false;
  const tool = s.toolUpgrade.tool;
  s.tools[tool] += 1;
  s.durability[tool] = toolMaxDurability(s.tools[tool]);
  s.toolUpgrade = null;
  return true;
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
  const closed = shopUnavailableReason(s, BLACKSMITH);
  if (closed) {
    events.push(warn(closed));
    return false;
  }
  // 旧存档若还有等待中的升级，先当场完成，避免重复收费或卡住
  settlePendingUpgrade(s);
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
  // 点击升级立刻成功：等级当场 +1、耐久回满，马上就能用
  s.tools[tool] += 1;
  s.durability[tool] = toolMaxDurability(s.tools[tool]);
  events.push(good(`🔨 铁匠当场把${TOOL_NAMES[tool]}升级成了${cost.name}${TOOL_NAMES[tool]}，耐久也回满了，立刻就能用。`));
  return true;
}

export function finishUpgrades(s: GameState, events: GameEvent[]): void {
  const tool = s.toolUpgrade?.tool;
  if (!tool || !settlePendingUpgrade(s)) return;
  events.push(good(`🔨 铁匠把升级好的${TOOL_LEVEL_NAMES[s.tools[tool]]}${TOOL_NAMES[tool]}送到了你家门口，耐久也回满了。`));
}
