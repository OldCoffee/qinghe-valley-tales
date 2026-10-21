export interface OreDef {
  id: string;
  name: string;
  sellPrice: number;
  floors: [number, number];
}

export interface GemDef extends OreDef {
  /** 相对权重 */
  weight: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  hp: number;
  damage: number;
  xp: number;
  floors: [number, number];
  drop: { id: string; name: string; sellPrice: number; chance: number };
}

export interface WeaponDef {
  id: string;
  name: string;
  damage: [number, number];
  price?: number;
  /** 购买前需要到达的矿洞层数 */
  requiresFloor?: number;
}

export const ORES: OreDef[] = [
  { id: 'copper_ore', name: '铜矿石', sellPrice: 5, floors: [1, 19] },
  { id: 'iron_ore', name: '铁矿石', sellPrice: 10, floors: [20, 39] },
  { id: 'gold_ore', name: '金矿石', sellPrice: 25, floors: [40, 60] },
];

export const GEMS: GemDef[] = [
  { id: 'amethyst', name: '紫水晶', sellPrice: 100, floors: [1, 30], weight: 3 },
  { id: 'topaz', name: '黄玉', sellPrice: 80, floors: [1, 30], weight: 3 },
  { id: 'aquamarine', name: '海蓝宝石', sellPrice: 180, floors: [20, 60], weight: 2 },
  { id: 'jade', name: '翡翠', sellPrice: 200, floors: [20, 60], weight: 2 },
  { id: 'ruby', name: '红宝石', sellPrice: 250, floors: [40, 60], weight: 2 },
  { id: 'emerald', name: '绿宝石', sellPrice: 250, floors: [40, 60], weight: 2 },
  { id: 'diamond', name: '钻石', sellPrice: 750, floors: [50, 60], weight: 1 },
];

export const MONSTERS: MonsterDef[] = [
  { id: 'slime', name: '绿史莱姆', hp: 16, damage: 4, xp: 3, floors: [1, 25], drop: { id: 'slime', name: '黏液', sellPrice: 5, chance: 0.8 } },
  { id: 'bat', name: '蝙蝠', hp: 30, damage: 7, xp: 6, floors: [10, 45], drop: { id: 'bat_wing', name: '蝙蝠翅膀', sellPrice: 15, chance: 0.5 } },
  { id: 'skeleton', name: '骷髅', hp: 55, damage: 11, xp: 10, floors: [25, 60], drop: { id: 'bone_fragment', name: '骨头碎片', sellPrice: 15, chance: 0.6 } },
  { id: 'golem', name: '石魔', hp: 85, damage: 14, xp: 15, floors: [35, 60], drop: { id: 'golem_core', name: '石魔之核', sellPrice: 40, chance: 0.4 } },
  { id: 'shadow', name: '暗影人', hp: 120, damage: 18, xp: 22, floors: [50, 60], drop: { id: 'void_essence', name: '虚空精华', sellPrice: 50, chance: 0.5 } },
];

export const WEAPONS: WeaponDef[] = [
  { id: 'fists', name: '拳头', damage: [1, 3] },
  { id: 'rusty_sword', name: '生锈的剑', damage: [4, 8] },
  { id: 'steel_sword', name: '钢剑', damage: [8, 14], price: 2000 },
  { id: 'silver_blade', name: '银刃', damage: [14, 22], price: 6000, requiresFloor: 20 },
  { id: 'obsidian_sword', name: '黑曜石剑', damage: [24, 34], price: 15000, requiresFloor: 40 },
  { id: 'galaxy_sword', name: '银河剑', damage: [40, 55] },
];

/** 每 10 层第一次到达时的宝箱 */
export const MINE_CHESTS: Record<number, { gold?: number; weapon?: string; item?: [string, number] }> = {
  10: { gold: 500 },
  20: { weapon: 'silver_blade' },
  30: { gold: 2000, item: ['aquamarine', 2] },
  40: { weapon: 'obsidian_sword' },
  50: { gold: 5000, item: ['diamond', 1] },
  60: { weapon: 'galaxy_sword' },
};

export const ELEVATOR_STEP = 5;
