import type { Season, Weather } from '../engine/types.js';

export const SAVE_VERSION = 2;

export const FARM_ROWS = 6;
export const GREENHOUSE_ROWS = 2;
export const TOTAL_ROWS = FARM_ROWS + GREENHOUSE_ROWS;
export const FARM_COLS = 8;
export const FARM_GEN = { weedChance: 0.22, stoneChance: 0.1 };

export const DAYS_PER_SEASON = 28;
export const SEASON_ORDER: Season[] = ['spring', 'summer', 'fall', 'winter'];
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASON_ORDER.length;
export const EVALUATION_YEAR = 3;

export const DAY_START_MINUTES = 6 * 60;
export const MIDNIGHT_MINUTES = 24 * 60;
export const PASS_OUT_MINUTES = 26 * 60;
export const NPC_BEDTIME_MINUTES = 22 * 60;

export const MAX_ENERGY = 270;
export const BASE_HP = 100;
export const HP_PER_COMBAT_LEVEL = 10;
export const START_GOLD = 500;
export const START_INVENTORY: Record<string, number> = { parsnip_seed: 15 };
export const START_WEAPON = 'rusty_sword';

export const PASS_OUT_PENALTY = { ratio: 0.2, min: 50, max: 100 };
export const MAX_WAIT_MINUTES = 600;

export const WEATHER_CHANCE: Record<Season, Partial<Record<Weather, number>>> = {
  spring: { rain: 0.18, storm: 0.05 },
  summer: { rain: 0.1, storm: 0.12 },
  fall: { rain: 0.18, storm: 0.04 },
  winter: { snow: 0.3 },
};
export const LIGHTNING_CHANCE = 0.3;

export const TILE_COSTS = {
  till: { minutes: 5, energy: 2 },
  water: { minutes: 5, energy: 2 },
  plant: { minutes: 3, energy: 0 },
  harvest: { minutes: 3, energy: 0 },
  clearWeed: { minutes: 2, energy: 1 },
  clearStone: { minutes: 6, energy: 4 },
  deweed: { minutes: 3, energy: 1 },
  uproot: { minutes: 4, energy: 1 },
};

/** 农田养护：连续缺水枯萎阈值、杂草每日滋生与邻格蔓延概率 */
export const CROP_CARE = { dryDaysToWilt: 2, weedChancePerDay: 0.08, weedSpreadChance: 0.05 };
/** 每级工具降低的体力与时间比例 */
export const TOOL_LEVEL_DISCOUNT = 0.15;

/** 工具专属效果（按工具等级每级增量，等级越高效果越强） */
export const TOOL_POWER = {
  /** 锄头：开垦时每级 +15% 概率使土地肥沃（肥沃地块作物首次正常生长额外 +1 天，触发后消耗） */
  hoeFertileChancePerLevel: 0.15,
  /** 水壶：浇水时每级 +10% 概率立即催长 1 天（不超过成熟） */
  canSproutChancePerLevel: 0.1,
  /** 镐子：每级矿石出现概率 +5%、宝石概率 +1% */
  pickaxeOreChancePerLevel: 0.05,
  pickaxeGemChancePerLevel: 0.01,
  /** 斧头：每级 +25% 概率额外多得 1 块木材 */
  axeExtraWoodChancePerLevel: 0.25,
  /** 鱼竿：每级钓到垃圾概率 -2%、稀有鱼权重提升（见 fishing.ts） */
  rodTrashReductionPerLevel: 0.02,
  /** 武器：按武器档位（WEAPONS 顺序）每档暴击率 +2% */
  weaponCritPerTier: 0.02,
};
export const SKILL_LEVEL_DISCOUNT = 0.02;

export const FORAGE_MINUTES = 10;

export const FOREST = {
  treesPerDay: 8,
  chop: { minutes: 10, energy: 8 },
  grove: { minutes: 10, energy: 2 },
  explore: { minutes: 30, energy: 5 },
};
/** 白鹭镇诊所（白芷坐诊）：按缺失生命收费补满 */
export const CLINIC = { goldPerHp: 2, minutes: 10 };

/** 背包直接出售折扣（不去商店，随时卖但只拿八折） */
export const BAG_SELL_RATE = 0.8;

export const FISH_CAST = { minutes: 20, energy: 8, minEnergy: 3 };
export const FISH_ROUND_MINUTES = 5;
export const FISH_MAX_ROUNDS = 14;
export const TRASH_CHANCE = 0.15;

export const MINE_FLOORS = 60;
export const MINE_COSTS = {
  rock: { minutes: 4, energy: 3 },
  attack: { minutes: 2, energy: 2 },
};
export const MONSTER_HIT_CHANCE = 0.5;
export const MONSTERS_ATTACKING = 2;
export const BASE_CRIT_CHANCE = 0.05;

export const TALK_POINTS = 20;
export const DAILY_DECAY = 2;
export const POINTS_PER_HEART = 250;
export const GIFTS_PER_WEEK = 2;
export const BIRTHDAY_MULTIPLIER = 8;
export const GIFT_POINTS = { loved: 80, liked: 45, neutral: 20, disliked: -20, hated: -40 };
export const FRIENDSHIP_CAP = { friendMarriageable: 2000, max: 2500 };
export const DATING_HEARTS = 8;
export const PROPOSAL_HEARTS = 10;
export const WEDDING_DELAY_DAYS = 3;

export const TOOL_UPGRADES = [
  { level: 1, name: '铜', gold: 2000, ore: 'copper_ore', oreQty: 10 },
  { level: 2, name: '钢', gold: 5000, ore: 'iron_ore', oreQty: 10 },
  { level: 3, name: '金', gold: 10000, ore: 'gold_ore', oreQty: 10 },
];
export const TOOL_UPGRADE_DAYS = 2;

/** 耐久：每次使用扣 1 点；钓鱼断线会额外磨损鱼竿；归零报废变成金属碎片；修复按缺失点数收费 */
export const DURABILITY = {
  toolBase: 100,
  toolPerLevel: 50,
  scrapId: 'scrap',
  scrapQty: 3,
  repairRate: { tool: 2, weapon: 3 },
  baseToolPrice: 300,
  lineBreakWear: 5,
};
