import { DURABILITY } from '../../data/config.js';
import { itemName } from '../../data/items.js';
import { WEAPONS } from '../../data/mine.js';
import { SHOPS } from '../../data/shops.js';
import { TOOL_NAMES } from '../../data/skills.js';
import { shopClosedReason } from '../calendar.js';
import type { GameEvent, GameState, ToolId } from '../types.js';
import { addItem, bad, good, info, removeItem, warn } from '../util.js';

const TOOLS: ToolId[] = ['hoe', 'can', 'pickaxe', 'rod', 'axe'];
export const FISTS = 'fists';

export function toolMaxDurability(level: number): number {
  return level < 0 ? 0 : DURABILITY.toolBase + DURABILITY.toolPerLevel * level;
}

export function weaponMaxDurability(weaponId: string): number {
  const def = WEAPONS.find((w) => w.id === weaponId);
  if (!def) return 0;
  return Math.round(60 + ((def.damage[0] + def.damage[1]) / 2) * 5);
}

/** 给老存档补齐装备字段，并把当前武器纳入背包 */
export function ensureEquipment(s: GameState): void {
  if (!s.durability) s.durability = {} as Record<ToolId, number>;
  if (!s.equippedTools) s.equippedTools = { hoe: true, can: true, pickaxe: true, rod: true, axe: true };
  if (!s.weaponDurability) s.weaponDurability = {};
  for (const tool of TOOLS) {
    if (typeof s.tools[tool] !== 'number') s.tools[tool] = 0;
    if (typeof s.equippedTools[tool] !== 'boolean') s.equippedTools[tool] = s.tools[tool] >= 0;
    if (s.tools[tool] < 0) {
      s.durability[tool] = 0;
      s.equippedTools[tool] = false;
    } else if (typeof s.durability[tool] !== 'number') {
      s.durability[tool] = toolMaxDurability(s.tools[tool]);
    }
  }
  if (s.weapon !== FISTS && !s.inventory[s.weapon]) s.inventory[s.weapon] = 1;
  for (const id of [s.weapon, ...Object.keys(s.inventory)]) {
    if (WEAPONS.some((w) => w.id === id) && id !== FISTS && typeof s.weaponDurability[id] !== 'number') {
      s.weaponDurability[id] = weaponMaxDurability(id);
    }
  }
}

/** 工具现在能不能用；不能用时返回原因 */
export function toolUsable(s: GameState, tool: ToolId): string | null {
  if (s.tools[tool] < 0) {
    return tool === 'rod' ? '鱼竿已经报废了，去海滩渔具店买新的' : `${TOOL_NAMES[tool]}已经报废了，去铁匠铺买新的`;
  }
  if (!s.equippedTools[tool]) return `先在背包装备区把${TOOL_NAMES[tool]}装备上`;
  if (s.toolUpgrade?.tool === tool) return `${TOOL_NAMES[tool]}还在铁匠铺升级`;
  return null;
}

/** 使用一次工具；amount 可指定额外磨损点数。返回 true 表示这次用坏了 */
export function wearTool(s: GameState, events: GameEvent[], tool: ToolId, amount = 1): boolean {
  if (s.tools[tool] < 0) return true;
  s.durability[tool] -= amount;
  if (s.durability[tool] > 0) return false;
  s.durability[tool] = 0;
  s.tools[tool] = -1;
  s.equippedTools[tool] = false;
  addItem(s, DURABILITY.scrapId, DURABILITY.scrapQty);
  events.push(bad(`${TOOL_NAMES[tool]}的耐久耗尽，直接报废了，变成${itemName(DURABILITY.scrapId)} ×${DURABILITY.scrapQty}。`));
  return true;
}

/** 使用一次当前武器；返回 true 表示这次打坏了 */
export function wearWeapon(s: GameState, events: GameEvent[]): boolean {
  if (s.weapon === FISTS) return false;
  const id = s.weapon;
  s.weaponDurability[id] = (s.weaponDurability[id] ?? weaponMaxDurability(id)) - 1;
  if (s.weaponDurability[id] > 0) return false;
  delete s.weaponDurability[id];
  removeItem(s, id, 1);
  s.weapon = FISTS;
  addItem(s, DURABILITY.scrapId, DURABILITY.scrapQty);
  events.push(bad(`${itemName(id)}的耐久耗尽，直接报废了，变成${itemName(DURABILITY.scrapId)} ×${DURABILITY.scrapQty}。你现在只能用拳头了。`));
  return true;
}

export function equipWeapon(s: GameState, events: GameEvent[], itemId: string): boolean {
  if (!WEAPONS.some((w) => w.id === itemId) || itemId === FISTS || !s.inventory[itemId]) {
    events.push(warn('你没有这件武器。'));
    return false;
  }
  s.weapon = itemId;
  if (typeof s.weaponDurability[itemId] !== 'number') s.weaponDurability[itemId] = weaponMaxDurability(itemId);
  events.push(good(`装备了${itemName(itemId)}。`));
  return true;
}

export function unequipWeapon(s: GameState, events: GameEvent[]): boolean {
  if (s.weapon === FISTS) {
    events.push(info('你现在本来就空着手。'));
    return false;
  }
  events.push(info(`卸下了${itemName(s.weapon)}，换上拳头。武器还在背包里。`));
  s.weapon = FISTS;
  return true;
}

export function setToolEquipped(s: GameState, events: GameEvent[], tool: ToolId, equipped: boolean): boolean {
  if (s.tools[tool] < 0) {
    events.push(warn(`${TOOL_NAMES[tool]}已经报废了，先去买新的。`));
    return false;
  }
  s.equippedTools[tool] = equipped;
  events.push(info(equipped ? `装备了${TOOL_NAMES[tool]}。` : `卸下了${TOOL_NAMES[tool]}，需要时在背包里重新装备。`));
  return true;
}

const REPAIR_SHOP: Record<string, string> = { hoe: 'blacksmith', can: 'blacksmith', pickaxe: 'blacksmith', rod: 'fish_shop', axe: 'blacksmith' };

export function repairCost(s: GameState, target: string): number | null {
  if ((TOOLS as string[]).includes(target)) {
    const tool = target as ToolId;
    if (s.tools[tool] < 0) return null;
    const missing = toolMaxDurability(s.tools[tool]) - s.durability[tool];
    return missing > 0 ? missing * DURABILITY.repairRate.tool : null;
  }
  if (WEAPONS.some((w) => w.id === target) && s.inventory[target]) {
    const missing = weaponMaxDurability(target) - (s.weaponDurability[target] ?? weaponMaxDurability(target));
    return missing > 0 ? missing * DURABILITY.repairRate.weapon : null;
  }
  return null;
}

/** target 是工具 id 或武器 id；在对应店铺把耐久修满 */
export function repair(s: GameState, events: GameEvent[], target: string): boolean {
  const isTool = (TOOLS as string[]).includes(target);
  const shopId = isTool ? REPAIR_SHOP[target] : 'blacksmith';
  const shop = SHOPS.find((sh) => sh.id === shopId)!;
  if (s.location !== shop.location) {
    events.push(warn(`修${isTool ? TOOL_NAMES[target as ToolId] : itemName(target)}要去${shop.name}。`));
    return false;
  }
  const closed = shopClosedReason(s, shop);
  if (closed) {
    events.push(warn(closed));
    return false;
  }
  const cost = repairCost(s, target);
  if (cost === null) {
    events.push(warn(isTool && s.tools[target as ToolId] < 0 ? '这件工具已经报废了，只能买新的。' : '这件装备耐久是满的，不用修。'));
    return false;
  }
  if (s.gold < cost) {
    events.push(warn(`修复需要 ${cost} 金，你只有 ${s.gold} 金。`));
    return false;
  }
  s.gold -= cost;
  if (isTool) s.durability[target as ToolId] = toolMaxDurability(s.tools[target as ToolId]);
  else s.weaponDurability[target] = weaponMaxDurability(target);
  events.push(good(`${shop.name}把${isTool ? TOOL_NAMES[target as ToolId] : itemName(target)}修好了，耐久回满，花费 ${cost} 金。`));
  return true;
}
