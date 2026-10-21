import type { ItemCategory, ToolId } from '../engine/types.js';
import { CROPS, type CropDef } from './crops.js';
import { FISH, TRASH } from './fish.js';
import { FORAGE } from './forage.js';
import { GEMS, MONSTERS, ORES, WEAPONS } from './mine.js';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  sellPrice: number;
  energy?: number;
  cropId?: string;
  toolGrant?: { tool: ToolId; level: number; minFishing?: number };
}

export function seedIdOf(cropId: string): string {
  return `${cropId}_seed`;
}

const FOODS: ItemDef[] = [
  { id: 'bread', name: '面包', category: 'food', sellPrice: 60, energy: 50 },
  { id: 'salad', name: '沙拉', category: 'food', sellPrice: 110, energy: 113 },
  { id: 'pizza', name: '披萨', category: 'food', sellPrice: 150, energy: 150 },
  { id: 'breakfast', name: '爱心早餐', category: 'food', sellPrice: 100, energy: 120 },
];

const SPECIALS: ItemDef[] = [
  { id: 'scrap', name: '金属碎片', category: 'ore', sellPrice: 5 },
  { id: 'wood', name: '木材', category: 'forage', sellPrice: 10 },
  { id: 'tool_hoe', name: '锄头', category: 'tool', sellPrice: 0, toolGrant: { tool: 'hoe', level: 0 } },
  { id: 'tool_can', name: '水壶', category: 'tool', sellPrice: 0, toolGrant: { tool: 'can', level: 0 } },
  { id: 'tool_pickaxe', name: '镐子', category: 'tool', sellPrice: 0, toolGrant: { tool: 'pickaxe', level: 0 } },
  { id: 'tool_axe', name: '斧头', category: 'tool', sellPrice: 0, toolGrant: { tool: 'axe', level: 0 } },
  { id: 'rod_bamboo', name: '竹制鱼竿', category: 'tool', sellPrice: 0, toolGrant: { tool: 'rod', level: 0 } },
  { id: 'bouquet', name: '花束', category: 'special', sellPrice: 100 },
  { id: 'pendant', name: '美人鱼吊坠', category: 'special', sellPrice: 2500 },
  { id: 'rod_fiberglass', name: '玻璃纤维鱼竿', category: 'tool', sellPrice: 0, toolGrant: { tool: 'rod', level: 1, minFishing: 2 } },
  { id: 'rod_iridium', name: '铱金鱼竿', category: 'tool', sellPrice: 0, toolGrant: { tool: 'rod', level: 2, minFishing: 6 } },
];

function buildItems(): Record<string, ItemDef> {
  const all: ItemDef[] = [...FOODS, ...SPECIALS];
  for (const crop of Object.values(CROPS)) {
    all.push({ id: crop.id, name: crop.name, category: 'crop', sellPrice: crop.sellPrice, cropId: crop.id, energy: crop.energy });
    all.push({
      id: seedIdOf(crop.id),
      name: `${crop.name}种子`,
      category: 'seed',
      sellPrice: Math.floor(crop.seedPrice / 2),
      cropId: crop.id,
    });
  }
  for (const f of FORAGE) all.push({ id: f.id, name: f.name, category: 'forage', sellPrice: f.sellPrice, energy: f.energy });
  for (const f of FISH) all.push({ id: f.id, name: f.name, category: 'fish', sellPrice: f.sellPrice });
  for (const t of TRASH) all.push({ id: t.id, name: t.name, category: 'trash', sellPrice: 0 });
  for (const o of ORES) all.push({ id: o.id, name: o.name, category: 'ore', sellPrice: o.sellPrice });
  for (const g of GEMS) all.push({ id: g.id, name: g.name, category: 'gem', sellPrice: g.sellPrice });
  for (const m of MONSTERS) all.push({ id: m.drop.id, name: m.drop.name, category: 'monster', sellPrice: m.drop.sellPrice });
  for (const w of WEAPONS)
    all.push({
      id: w.id,
      name: w.name,
      category: 'weapon',
      sellPrice: w.id === 'fists' ? 0 : w.price ? Math.floor(w.price * 0.4) : w.id === 'galaxy_sword' ? 1000 : 40,
    });

  const items: Record<string, ItemDef> = {};
  for (const item of all) {
    if (items[item.id]) throw new Error(`重复的物品 id：${item.id}`);
    items[item.id] = item;
  }
  return items;
}

export const ITEMS: Record<string, ItemDef> = buildItems();

export function findItem(query: string): ItemDef | undefined {
  const q = query.trim();
  return ITEMS[q.toLowerCase()] ?? Object.values(ITEMS).find((item) => item.name === q);
}

/** 按作物名、作物 id、种子名或种子 id 查找作物 */
export function findCrop(query: string): CropDef | undefined {
  const item = findItem(query);
  return item?.cropId ? CROPS[item.cropId] : undefined;
}

export function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}
