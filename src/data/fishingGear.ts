import type { GameState } from '../engine/types.js';

export type WaterType = 'river' | 'lake' | 'ocean';
export type FishTag =
  | WaterType
  | 'deep'
  | 'small'
  | 'large'
  | 'predator'
  | 'carp'
  | 'coral'
  | 'night'
  | 'rain'
  | 'legendary';

export interface RodDef {
  id: string;
  itemId: string;
  name: string;
  tier: number;
  minLevel: number;
  price: number;
  /** 地点开放所需能力；通用表示可替代任何同阶普通能力 */
  capabilities: string[];
  affinity: FishTag[];
  encounterBonus: number;
  tensionReduction?: number;
  progressBonus?: number;
  castMinutesReduction?: number;
  tensionCapBonus?: number;
  lineBreakWearReduction?: number;
  allowsBait: boolean;
  allowsAdvancedBait?: boolean;
}

export interface BaitDef {
  id: string;
  name: string;
  price: number;
  minLevel: number;
  tags: FishTag[];
  weightBonus: number;
  stabilityBonus?: number;
  trashReduction?: number;
  castMinutesReduction?: number;
  rareBonus?: number;
  advanced?: boolean;
  legendaryOnly?: boolean;
}

export const RODS: RodDef[] = [
  { id: 'bamboo', itemId: 'rod_bamboo', name: '竹制鱼竿', tier: 0, minLevel: 0, price: 300, capabilities: ['basic'], affinity: ['small'], encounterBonus: 0.15, allowsBait: false },
  { id: 'fiberglass', itemId: 'rod_fiberglass', name: '玻璃纤维鱼竿', tier: 1, minLevel: 2, price: 1800, capabilities: ['basic', 'tier2'], affinity: ['river', 'lake', 'ocean'], encounterBonus: 0.12, allowsBait: true },
  { id: 'stream', itemId: 'rod_stream', name: '溪流竿', tier: 2, minLevel: 4, price: 4200, capabilities: ['basic', 'tier2', 'river3', 'river4'], affinity: ['river', 'rain'], encounterBonus: 0.35, tensionReduction: 0.2, allowsBait: true },
  { id: 'lake', itemId: 'rod_lake', name: '湖心竿', tier: 2, minLevel: 3, price: 3600, capabilities: ['basic', 'tier2', 'lake2', 'lake3'], affinity: ['lake', 'carp'], encounterBonus: 0.35, progressBonus: 0.15, allowsBait: true },
  { id: 'surf', itemId: 'rod_surf', name: '远投海竿', tier: 2, minLevel: 4, price: 4800, capabilities: ['basic', 'tier2', 'ocean2'], affinity: ['ocean', 'large'], encounterBonus: 0.3, castMinutesReduction: 5, allowsBait: true },
  { id: 'reef', itemId: 'rod_reef', name: '礁岩竿', tier: 3, minLevel: 6, price: 7200, capabilities: ['basic', 'tier2', 'ocean2', 'ocean3'], affinity: ['ocean', 'coral'], encounterBonus: 0.4, lineBreakWearReduction: 0.5, allowsBait: true, allowsAdvancedBait: true },
  { id: 'iridium', itemId: 'rod_iridium', name: '铱金鱼竿', tier: 3, minLevel: 6, price: 7500, capabilities: ['basic', 'tier2', 'river3', 'river4', 'lake2', 'lake3', 'lake4', 'ocean2', 'ocean3'], affinity: ['river', 'lake', 'ocean'], encounterBonus: 0.2, tensionReduction: 0.1, progressBonus: 0.1, allowsBait: true, allowsAdvancedBait: true },
  { id: 'deep_sea', itemId: 'rod_deep_sea', name: '深海竿', tier: 4, minLevel: 9, price: 16000, capabilities: ['basic', 'tier2', 'ocean2', 'ocean3', 'ocean4'], affinity: ['ocean', 'deep', 'large'], encounterBonus: 0.5, tensionCapBonus: 20, allowsBait: true, allowsAdvancedBait: true },
];

export const BAITS: BaitDef[] = [
  { id: 'bait_worm', name: '蚯蚓饵', price: 15, minLevel: 2, tags: ['river', 'lake'], weightBonus: 0.3 },
  { id: 'bait_dough', name: '面团饵', price: 10, minLevel: 2, tags: ['carp', 'small'], weightBonus: 0.4 },
  { id: 'bait_grub', name: '虫蛹饵', price: 22, minLevel: 3, tags: ['river', 'rain'], weightBonus: 0.35 },
  { id: 'bait_universal', name: '万能饵', price: 35, minLevel: 4, tags: ['river', 'lake', 'ocean'], weightBonus: 0.15, trashReduction: 0.05 },
  { id: 'bait_shrimp', name: '河虾饵', price: 38, minLevel: 5, tags: ['river', 'large'], weightBonus: 0.45, stabilityBonus: 0.1 },
  { id: 'bait_corn', name: '玉米饵', price: 28, minLevel: 3, tags: ['lake', 'carp'], weightBonus: 0.5 },
  { id: 'bait_minnow', name: '小鱼活饵', price: 48, minLevel: 5, tags: ['predator', 'lake', 'river'], weightBonus: 0.5, castMinutesReduction: 5 },
  { id: 'bait_shellfish', name: '贝肉饵', price: 40, minLevel: 4, tags: ['ocean', 'coral'], weightBonus: 0.45 },
  { id: 'bait_squid', name: '鱿鱼条', price: 65, minLevel: 7, tags: ['ocean', 'deep', 'large'], weightBonus: 0.5 },
  { id: 'bait_krill', name: '磷虾饵', price: 70, minLevel: 7, tags: ['deep', 'ocean'], weightBonus: 0.4, rareBonus: 0.15 },
  { id: 'bait_glow', name: '荧光饵', price: 110, minLevel: 8, tags: ['night', 'deep'], weightBonus: 0.6, trashReduction: 1, advanced: true },
  { id: 'bait_legend', name: '传说饵', price: 0, minLevel: 10, tags: ['legendary'], weightBonus: 2, advanced: true, legendaryOnly: true },
];

export const ROD_BY_ID = Object.fromEntries(RODS.map((r) => [r.id, r])) as Record<string, RodDef>;
export const ROD_BY_ITEM = Object.fromEntries(RODS.map((r) => [r.itemId, r])) as Record<string, RodDef>;
export const BAIT_BY_ID = Object.fromEntries(BAITS.map((b) => [b.id, b])) as Record<string, BaitDef>;

export function equippedRod(s: GameState): RodDef {
  return ROD_BY_ID[s.equippedRodId] ?? RODS[Math.max(0, Math.min(2, s.tools.rod)) === 2 ? 6 : Math.max(0, s.tools.rod)] ?? RODS[0];
}

export function ownsCapability(s: GameState, capability: string): boolean {
  return s.ownedRods.some((id) => ROD_BY_ID[id]?.capabilities.includes(capability));
}

/** Web/CLI 共用旧存档迁移：原 tools.rod 0/1/2 映射为竹制/玻纤/铱金。 */
export function ensureFishingGear(s: GameState): void {
  const legacyRod = s.tools?.rod >= 2 ? 'iridium' : s.tools?.rod === 1 ? 'fiberglass' : 'bamboo';
  if (!Array.isArray(s.ownedRods) || s.ownedRods.length === 0) {
    s.ownedRods = legacyRod === 'iridium' ? ['bamboo', 'fiberglass', 'iridium'] : legacyRod === 'fiberglass' ? ['bamboo', 'fiberglass'] : ['bamboo'];
  }
  s.ownedRods = [...new Set(s.ownedRods.filter((id) => !!ROD_BY_ID[id]))];
  if (!ROD_BY_ID[s.equippedRodId] || !s.ownedRods.includes(s.equippedRodId)) s.equippedRodId = legacyRod;
  if (typeof s.equippedBaitId !== 'string' || !BAIT_BY_ID[s.equippedBaitId] || !(s.inventory?.[s.equippedBaitId] > 0)) {
    s.equippedBaitId = null;
  }
}
