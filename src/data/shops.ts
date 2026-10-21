import type { GameState, ItemCategory, LocationId, ToolId } from '../engine/types.js';
import { CROPS } from './crops.js';
import { seedIdOf } from './items.js';
import { WEAPONS } from './mine.js';

export interface ShopItem {
  itemId: string;
  price: number;
}

export interface ShopDef {
  id: string;
  name: string;
  location: LocationId;
  open: number;
  close: number;
  /** 0 = 周一 */
  closedWeekday?: number;
  buys: ItemCategory[];
  stock(s: GameState): ShopItem[];
}

const hour = (h: number) => h * 60;

export const SHOPS: ShopDef[] = [
  {
    id: 'general',
    name: '白鹭杂货铺',
    location: 'town',
    open: hour(9),
    close: hour(17),
    closedWeekday: 2,
    buys: ['crop', 'forage', 'seed', 'food'],
    stock: (s) => [
      ...Object.values(CROPS)
        .filter((c) => c.seasons.includes(s.season) || s.unlocks.includes('greenhouse'))
        .map((c) => ({ itemId: seedIdOf(c.id), price: c.seedPrice })),
      { itemId: 'bouquet', price: 200 },
    ],
  },
  {
    id: 'blacksmith',
    name: '阿铁铁匠铺',
    location: 'town',
    open: hour(9),
    close: hour(16),
    buys: ['ore', 'gem', 'monster', 'weapon'],
    stock: (s) => [
      ...(['tool_hoe', 'tool_can', 'tool_pickaxe', 'tool_axe'] as const)
        .filter((id) => s.tools[{ tool_hoe: 'hoe', tool_can: 'can', tool_pickaxe: 'pickaxe', tool_axe: 'axe' }[id] as ToolId] < 0)
        .map((id) => ({ itemId: id, price: 300 })),
      ...WEAPONS.filter((w) => w.price && (w.requiresFloor ?? 0) <= s.mine.deepest).map((w) => ({
        itemId: w.id,
        price: w.price!,
      })),
    ],
  },
  {
    id: 'saloon',
    name: '星火酒馆',
    location: 'town',
    open: hour(12),
    close: hour(24),
    buys: [],
    stock: () => [
      { itemId: 'bread', price: 120 },
      { itemId: 'salad', price: 220 },
      { itemId: 'pizza', price: 300 },
    ],
  },
  {
    id: 'fish_shop',
    name: '老渔夫的小屋',
    location: 'beach',
    open: hour(9),
    close: hour(17),
    buys: ['fish'],
    stock: (s) => [
      ...(s.tools.rod < 0 ? [{ itemId: 'rod_bamboo', price: 300 }] : []),
      { itemId: 'rod_fiberglass', price: 1800 },
      { itemId: 'rod_iridium', price: 7500 },
      { itemId: 'pendant', price: 5000 },
    ],
  },
];
