import type { GameState, LocationId } from '../engine/types.js';

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

export type GearRarity = 0 | 1 | 2 | 3 | 4;

export interface RodDef {
  id: string;
  itemId: string;
  name: string;
  tier: number;
  rarity: GearRarity;
  minLevel: number;
  price: number;
  /** 地点开放所需能力；通用表示可替代任何同阶普通能力 */
  capabilities: string[];
  affinity: FishTag[];
  /** 针对特定鱼类的额外定向与拉锯加成 */
  targetFishIds?: string[];
  specialtyDesc: string;
  /** 制作该渔具所需的原料 */
  recipe?: Record<string, number>;
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
  rarity: GearRarity;
  price: number;
  minLevel: number;
  tags: FishTag[];
  targetFishIds?: string[];
  specialtyDesc: string;
  /** 制作该鱼饵所需的原料 */
  recipe?: Record<string, number>;
  /** 每次制作产出的鱼饵数量 */
  craftYield?: number;
  weightBonus: number;
  stabilityBonus?: number;
  trashReduction?: number;
  castMinutesReduction?: number;
  rareBonus?: number;
  advanced?: boolean;
  legendaryOnly?: boolean;
}

export type WorkbenchId = 'rod' | 'bait';

export interface WorkbenchDef {
  id: WorkbenchId;
  name: string;
  /** 工作台所在地点与展示名称 */
  location: LocationId;
  placeName: string;
  unlockId: string;
  unlockGold: number;
  unlockRecipe: Record<string, number>;
}

export const WORKBENCHES: Record<WorkbenchId, WorkbenchDef> = {
  rod: {
    id: 'rod',
    name: '渔具工作台',
    location: 'town',
    placeName: '白鹭镇阿铁铁匠铺',
    unlockId: 'rod_workbench',
    unlockGold: 500,
    unlockRecipe: { wood: 10, copper_ore: 5 },
  },
  bait: {
    id: 'bait',
    name: '鱼饵工作台',
    location: 'beach',
    placeName: '海滩老渔夫的小屋',
    unlockId: 'bait_workbench',
    unlockGold: 300,
    unlockRecipe: { wood: 5, clam: 2 },
  },
};

export const RODS: RodDef[] = [
  {
    id: 'bamboo',
    itemId: 'rod_bamboo',
    name: '竹制鱼竿',
    tier: 0,
    rarity: 0,
    minLevel: 0,
    price: 300,
    capabilities: ['basic'],
    affinity: ['small'],
    targetFishIds: ['sunfish', 'chub', 'creek_goby', 'bitterling', 'anchovy', 'sardine'],
    specialtyDesc: '轻巧入门竿，对太阳鱼、鳑鲏、沙丁鱼等浅水小鱼更顺手',
    recipe: { wood: 10 },
    encounterBonus: 0.18,
    allowsBait: false,
  },
  {
    id: 'fiberglass',
    itemId: 'rod_fiberglass',
    name: '玻璃纤维鱼竿',
    tier: 1,
    rarity: 1,
    minLevel: 2,
    price: 1800,
    capabilities: ['basic', 'tier2'],
    affinity: ['river', 'lake', 'ocean'],
    targetFishIds: ['carp', 'herring', 'stone_minnow', 'mackerel'],
    specialtyDesc: '优秀通用竿，可装鱼饵，适合中近岸河湖海常见鱼种',
    recipe: { wood: 15, copper_ore: 5 },
    encounterBonus: 0.16,
    allowsBait: true,
  },
  {
    id: 'willow',
    itemId: 'rod_willow',
    name: '青柳微物竿',
    tier: 1,
    rarity: 1,
    minLevel: 2,
    price: 2100,
    capabilities: ['basic', 'tier2'],
    affinity: ['small', 'river', 'carp'],
    targetFishIds: ['sunfish', 'stone_minnow', 'bitterling', 'silver_crucian', 'bluegill'],
    specialtyDesc: '优秀微物专精竿，大幅提升溪流与湖畔小型鱼、鲫鱼咬钩与收线速度',
    recipe: { wood: 12, daffodil: 2, copper_ore: 4 },
    encounterBonus: 0.35,
    progressBonus: 0.12,
    allowsBait: true,
  },
  {
    id: 'copper_carp',
    itemId: 'rod_copper_carp',
    name: '赤铜鲤竿',
    tier: 1,
    rarity: 1,
    minLevel: 3,
    price: 2600,
    capabilities: ['basic', 'tier2', 'lake2'],
    affinity: ['carp', 'lake'],
    targetFishIds: ['carp', 'silver_crucian', 'chub', 'largemouth_bass'],
    specialtyDesc: '优秀湖钓竿，针对鲤鱼、银鲫、大嘴鲈鱼有强力控线加成',
    recipe: { wood: 14, copper_ore: 8, wild_horseradish: 1 },
    encounterBonus: 0.36,
    tensionReduction: 0.12,
    allowsBait: true,
  },
  {
    id: 'stream',
    itemId: 'rod_stream',
    name: '溪流竿',
    tier: 2,
    rarity: 2,
    minLevel: 4,
    price: 4200,
    capabilities: ['basic', 'tier2', 'river3', 'river4'],
    affinity: ['river', 'rain'],
    targetFishIds: ['rainbow_trout', 'catfish', 'salmon', 'ayu', 'loach'],
    specialtyDesc: '稀有急流竿，专克虹鳟、鲑鱼、鲶鱼、香鱼等急流与雨天河鱼',
    recipe: { wood: 18, iron_ore: 6, topaz: 1 },
    encounterBonus: 0.38,
    tensionReduction: 0.2,
    allowsBait: true,
  },
  {
    id: 'lake',
    itemId: 'rod_lake',
    name: '湖心竿',
    tier: 2,
    rarity: 2,
    minLevel: 3,
    price: 3600,
    capabilities: ['basic', 'tier2', 'lake2', 'lake3'],
    affinity: ['lake', 'carp'],
    targetFishIds: ['brook_trout', 'lake_trout', 'largemouth_bass', 'pike'],
    specialtyDesc: '稀有深湖竿，针对红点鲑、湖鳟、狗鱼等湖心鱼种收线更快',
    recipe: { wood: 16, iron_ore: 5, jade: 1 },
    encounterBonus: 0.38,
    progressBonus: 0.16,
    allowsBait: true,
  },
  {
    id: 'surf',
    itemId: 'rod_surf',
    name: '远投海竿',
    tier: 2,
    rarity: 2,
    minLevel: 4,
    price: 4800,
    capabilities: ['basic', 'tier2', 'ocean2'],
    affinity: ['ocean', 'large'],
    targetFishIds: ['halibut', 'tuna', 'sea_bream', 'sea_bass', 'bonito'],
    specialtyDesc: '稀有海湾远投竿，针对金枪鱼、大比目鱼、鲷鱼、鲣鱼并缩短等待时间',
    recipe: { wood: 16, iron_ore: 7, clam: 2 },
    encounterBonus: 0.36,
    castMinutesReduction: 5,
    allowsBait: true,
  },
  {
    id: 'night_lure',
    itemId: 'rod_night_lure',
    name: '月影路亚竿',
    tier: 2,
    rarity: 2,
    minLevel: 5,
    price: 5200,
    capabilities: ['basic', 'tier2', 'river3', 'lake2', 'ocean2'],
    affinity: ['predator', 'night'],
    targetFishIds: ['yellow_catfish', 'topmouth_culter', 'mandarin_fish', 'eel', 'freshwater_eel', 'squid'],
    specialtyDesc: '稀有夜行路亚竿，专门引诱鳜鱼、翘嘴、鳗鱼、乌贼等掠食与夜行鱼',
    recipe: { wood: 14, iron_ore: 8, amethyst: 1, bat_wing: 3 },
    encounterBonus: 0.42,
    progressBonus: 0.12,
    tensionReduction: 0.1,
    allowsBait: true,
  },
  {
    id: 'reef',
    itemId: 'rod_reef',
    name: '礁岩竿',
    tier: 3,
    rarity: 3,
    minLevel: 6,
    price: 7200,
    capabilities: ['basic', 'tier2', 'ocean2', 'ocean3'],
    affinity: ['ocean', 'coral'],
    targetFishIds: ['red_snapper', 'pufferfish', 'grouper', 'mahi_mahi', 'lobster', 'parrotfish'],
    specialtyDesc: '史诗外礁竿，针对石斑、鬼头刀、河豚、红鲷等珊瑚礁鱼，断线磨损减半',
    recipe: { wood: 15, gold_ore: 6, coral: 3, aquamarine: 1 },
    encounterBonus: 0.44,
    lineBreakWearReduction: 0.5,
    allowsBait: true,
    allowsAdvancedBait: true,
  },
  {
    id: 'iridium',
    itemId: 'rod_iridium',
    name: '铱金鱼竿',
    tier: 3,
    rarity: 3,
    minLevel: 6,
    price: 7500,
    capabilities: ['basic', 'tier2', 'river3', 'river4', 'lake2', 'lake3', 'lake4', 'ocean2', 'ocean3'],
    affinity: ['river', 'lake', 'ocean', 'large'],
    targetFishIds: ['sturgeon', 'paddlefish', 'taimen', 'mandarin_fish', 'octopus'],
    specialtyDesc: '史诗全水域竿，兼顾河湖海高阶水域，对哲罗鲑、鲟鱼、章鱼等大鱼表现稳定',
    recipe: { gold_ore: 10, emerald: 1, ruby: 1, bone_fragment: 4 },
    encounterBonus: 0.28,
    tensionReduction: 0.14,
    progressBonus: 0.14,
    allowsBait: true,
    allowsAdvancedBait: true,
  },
  {
    id: 'storm',
    itemId: 'rod_storm',
    name: '雷鸣暴风竿',
    tier: 3,
    rarity: 3,
    minLevel: 7,
    price: 8800,
    capabilities: ['basic', 'tier2', 'river3', 'river4', 'lake3', 'ocean3'],
    affinity: ['rain', 'predator', 'deep'],
    targetFishIds: ['catfish', 'eel', 'freshwater_eel', 'mist_fish', 'swordfish', 'anglerfish'],
    specialtyDesc: '史诗风雨深水竿，专攻暴风雨、寒雾与深水凶猛鱼种，大幅压低张力暴涨',
    recipe: { gold_ore: 8, amethyst: 2, golem_core: 1 },
    encounterBonus: 0.46,
    tensionReduction: 0.22,
    castMinutesReduction: 5,
    allowsBait: true,
    allowsAdvancedBait: true,
  },
  {
    id: 'deep_sea',
    itemId: 'rod_deep_sea',
    name: '深海竿',
    tier: 4,
    rarity: 4,
    minLevel: 9,
    price: 16000,
    capabilities: ['basic', 'tier2', 'ocean2', 'ocean3', 'ocean4'],
    affinity: ['ocean', 'deep', 'large', 'legendary'],
    targetFishIds: ['swordfish', 'octopus', 'anglerfish', 'abyss_oarfish'],
    specialtyDesc: '传说深海巨物竿，专为剑鱼、鮟鱇鱼与无光皇带鱼打造，张力上限 +20',
    recipe: { gold_ore: 12, diamond: 1, void_essence: 2, coral: 3 },
    encounterBonus: 0.55,
    tensionCapBonus: 20,
    progressBonus: 0.15,
    allowsBait: true,
    allowsAdvancedBait: true,
  },
  {
    id: 'celestial',
    itemId: 'rod_celestial',
    name: '星河神话竿',
    tier: 4,
    rarity: 4,
    minLevel: 10,
    price: 22000,
    capabilities: ['basic', 'tier2', 'river3', 'river4', 'lake2', 'lake3', 'lake4', 'ocean2', 'ocean3', 'ocean4'],
    affinity: ['legendary', 'deep', 'large', 'night', 'rain'],
    targetFishIds: ['legend', 'ancient_sturgeon', 'mirror_dragonfish', 'abyss_oarfish', 'taimen', 'paddlefish'],
    specialtyDesc: '传说终极神竿，通行全部 12 处水域，对四大鱼王与深水巨鱼拥有极高咬钩与控线加成',
    recipe: { diamond: 2, void_essence: 2, golem_core: 2, coral: 3 },
    encounterBonus: 0.65,
    tensionReduction: 0.22,
    progressBonus: 0.22,
    tensionCapBonus: 25,
    lineBreakWearReduction: 0.6,
    allowsBait: true,
    allowsAdvancedBait: true,
  },
];

export const BAITS: BaitDef[] = [
  {
    id: 'bait_worm',
    name: '蚯蚓饵',
    rarity: 0,
    price: 15,
    minLevel: 2,
    tags: ['river', 'lake'],
    targetFishIds: ['sunfish', 'chub', 'carp', 'stone_minnow'],
    specialtyDesc: '基础淡水活饵，吸引溪流与湖岸常见鱼',
    recipe: { wood: 1, wild_horseradish: 1 },
    craftYield: 4,
    weightBonus: 0.3,
  },
  {
    id: 'bait_dough',
    name: '面团饵',
    rarity: 0,
    price: 10,
    minLevel: 2,
    tags: ['carp', 'small'],
    targetFishIds: ['carp', 'silver_crucian', 'bitterling', 'creek_goby'],
    specialtyDesc: '麦香面团，鲤鱼、银鲫和小型草食鱼最爱',
    recipe: { parsnip: 1 },
    craftYield: 4,
    weightBonus: 0.4,
  },
  {
    id: 'bait_grub',
    name: '虫蛹饵',
    rarity: 1,
    price: 22,
    minLevel: 3,
    tags: ['river', 'rain'],
    targetFishIds: ['rainbow_trout', 'catfish', 'loach', 'ayu'],
    specialtyDesc: '优秀河钓饵，雨天对鲶鱼、泥鳅、虹鳟格外有效',
    recipe: { slime: 2, common_mushroom: 1 },
    craftYield: 4,
    weightBonus: 0.38,
  },
  {
    id: 'bait_corn',
    name: '玉米饵',
    rarity: 1,
    price: 28,
    minLevel: 3,
    tags: ['lake', 'carp'],
    targetFishIds: ['carp', 'silver_crucian', 'bluegill', 'largemouth_bass'],
    specialtyDesc: '优秀甜香谷物饵，专攻湖泊鲤科与太阳鱼',
    recipe: { corn: 1 },
    craftYield: 5,
    weightBonus: 0.5,
  },
  {
    id: 'bait_universal',
    name: '万能饵',
    rarity: 1,
    price: 35,
    minLevel: 4,
    tags: ['river', 'lake', 'ocean'],
    specialtyDesc: '优秀综合饵，适度提升全水域咬钩并减少杂物',
    recipe: { slime: 2, clam: 1, wood: 1 },
    craftYield: 4,
    weightBonus: 0.2,
    trashReduction: 0.06,
  },
  {
    id: 'bait_shellfish',
    name: '贝肉饵',
    rarity: 1,
    price: 40,
    minLevel: 4,
    tags: ['ocean', 'coral'],
    targetFishIds: ['red_snapper', 'sea_bream', 'parrotfish', 'pufferfish', 'lobster'],
    specialtyDesc: '优秀海钓鲜饵，珊瑚礁鱼类与海鲷难以抗拒',
    recipe: { clam: 1, mussel: 1 },
    craftYield: 4,
    weightBonus: 0.48,
  },
  {
    id: 'bait_amber',
    name: '琥珀松脂饵',
    rarity: 1,
    price: 36,
    minLevel: 3,
    tags: ['river', 'small', 'carp'],
    targetFishIds: ['ayu', 'stone_minnow', 'bitterling', 'silver_crucian'],
    specialtyDesc: '优秀松林香饵，专门吸引香鱼、马口鱼等清澈溪流鱼并稳定鱼线',
    recipe: { wood: 2, sweet_pea: 1 },
    craftYield: 4,
    weightBonus: 0.45,
    stabilityBonus: 0.06,
  },
  {
    id: 'bait_shrimp',
    name: '河虾饵',
    rarity: 2,
    price: 38,
    minLevel: 5,
    tags: ['river', 'large'],
    targetFishIds: ['salmon', 'catfish', 'topmouth_culter', 'mandarin_fish'],
    specialtyDesc: '稀有鲜虾饵，专攻鲑鱼、鳜鱼、翘嘴等大型河鱼',
    recipe: { cockle: 1, spice_berry: 1 },
    craftYield: 4,
    weightBonus: 0.52,
    stabilityBonus: 0.1,
  },
  {
    id: 'bait_minnow',
    name: '小鱼活饵',
    rarity: 2,
    price: 48,
    minLevel: 5,
    tags: ['predator', 'lake', 'river'],
    targetFishIds: ['pike', 'largemouth_bass', 'mandarin_fish', 'lake_trout', 'brook_trout'],
    specialtyDesc: '稀有活鱼饵，对狗鱼、湖鳟、鳜鱼等凶猛掠食鱼极具诱惑',
    recipe: { sardine: 1, copper_ore: 1 },
    craftYield: 4,
    weightBonus: 0.55,
    castMinutesReduction: 5,
  },
  {
    id: 'bait_squid',
    name: '鱿鱼条',
    rarity: 2,
    price: 65,
    minLevel: 7,
    tags: ['ocean', 'deep', 'large'],
    targetFishIds: ['tuna', 'halibut', 'grouper', 'mahi_mahi', 'swordfish'],
    specialtyDesc: '稀有韧性海饵，专钓金枪鱼、石斑、鬼头刀、剑鱼等大型海鱼',
    recipe: { mussel: 2, coral: 1 },
    craftYield: 4,
    weightBonus: 0.56,
  },
  {
    id: 'bait_krill',
    name: '磷虾饵',
    rarity: 2,
    price: 70,
    minLevel: 7,
    tags: ['deep', 'ocean'],
    targetFishIds: ['sturgeon', 'paddlefish', 'octopus', 'anglerfish'],
    specialtyDesc: '稀有深水磷虾，提升深湖与外海高难度鱼咬钩率',
    recipe: { clam: 2, aquamarine: 1 },
    craftYield: 5,
    weightBonus: 0.48,
    rareBonus: 0.18,
  },
  {
    id: 'bait_jade',
    name: '翡翠萤光饵',
    rarity: 2,
    price: 78,
    minLevel: 6,
    tags: ['coral', 'night', 'lake'],
    targetFishIds: ['freshwater_eel', 'eel', 'lobster', 'squid', 'pufferfish'],
    specialtyDesc: '稀有矿彩微光饵，对鳗鲡、龙虾、乌贼等夜行与礁石奇鱼效果显著',
    recipe: { jade: 1, clam: 2 },
    craftYield: 5,
    weightBonus: 0.58,
    trashReduction: 0.2,
  },
  {
    id: 'bait_glow',
    name: '荧光饵',
    rarity: 3,
    price: 110,
    minLevel: 8,
    tags: ['night', 'deep'],
    targetFishIds: ['taimen', 'mist_fish', 'octopus', 'anglerfish', 'squid'],
    specialtyDesc: '史诗深渊荧光饵，完全不招杂物，专引哲罗鲑、寒雾鱼、鮟鱇鱼',
    recipe: { amethyst: 1, bat_wing: 2, crystal_fruit: 1 },
    craftYield: 4,
    weightBonus: 0.68,
    trashReduction: 1,
    advanced: true,
  },
  {
    id: 'bait_frost',
    name: '寒晶深水饵',
    rarity: 3,
    price: 135,
    minLevel: 8,
    tags: ['deep', 'large', 'rain'],
    targetFishIds: ['sturgeon', 'paddlefish', 'mist_fish', 'taimen', 'swordfish'],
    specialtyDesc: '史诗冰晶秘饵，专攻寒雾深湖与急流深水巨鱼，降低挣扎张力',
    recipe: { ruby: 1, winter_root: 1, gold_ore: 2 },
    craftYield: 4,
    weightBonus: 0.72,
    stabilityBonus: 0.14,
    rareBonus: 0.22,
    advanced: true,
  },
  {
    id: 'bait_void',
    name: '虚空深渊饵',
    rarity: 3,
    price: 160,
    minLevel: 9,
    tags: ['deep', 'predator', 'night', 'ocean'],
    targetFishIds: ['swordfish', 'anglerfish', 'octopus', 'taimen'],
    specialtyDesc: '史诗虚空魔饵，强烈吸引无光深海与秘河的顶级掠食鱼',
    recipe: { void_essence: 1, golem_core: 1, coral: 1 },
    craftYield: 4,
    weightBonus: 0.85,
    stabilityBonus: 0.16,
    castMinutesReduction: 5,
    advanced: true,
  },
  {
    id: 'bait_legend',
    name: '传说饵',
    rarity: 4,
    price: 0,
    minLevel: 10,
    tags: ['legendary'],
    targetFishIds: ['legend', 'ancient_sturgeon', 'mirror_dragonfish', 'abyss_oarfish'],
    specialtyDesc: '传说秘制鱼王饵，大幅提高四大传奇鱼王咬钩权重',
    recipe: { emerald: 1, void_essence: 1, coral: 2 },
    craftYield: 3,
    weightBonus: 2.0,
    stabilityBonus: 0.15,
    advanced: true,
    legendaryOnly: true,
  },
  {
    id: 'bait_dragon',
    name: '龙王黄金饵',
    rarity: 4,
    price: 260,
    minLevel: 10,
    tags: ['legendary', 'deep', 'large', 'predator'],
    targetFishIds: ['legend', 'ancient_sturgeon', 'mirror_dragonfish', 'abyss_oarfish', 'swordfish', 'taimen'],
    specialtyDesc: '传说黄金龙饵，通吃四大传奇鱼王与各水域霸主，兼具零杂物与控线稳固',
    recipe: { diamond: 1, gold_ore: 3, coral: 2 },
    craftYield: 3,
    weightBonus: 2.3,
    stabilityBonus: 0.2,
    trashReduction: 1,
    rareBonus: 0.35,
    advanced: true,
  },
];

export const ROD_BY_ID = Object.fromEntries(RODS.map((r) => [r.id, r])) as Record<string, RodDef>;
export const ROD_BY_ITEM = Object.fromEntries(RODS.map((r) => [r.itemId, r])) as Record<string, RodDef>;
export const BAIT_BY_ID = Object.fromEntries(BAITS.map((b) => [b.id, b])) as Record<string, BaitDef>;

export function equippedRod(s: GameState): RodDef {
  return ROD_BY_ID[s.equippedRodId] ?? RODS[Math.max(0, Math.min(2, s.tools.rod)) === 2 ? 9 : Math.max(0, s.tools.rod)] ?? RODS[0];
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
