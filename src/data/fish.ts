import type { LocationId, Season, Weather } from '../engine/types.js';
import type { FishTag, WaterType } from './fishingGear.js';

export interface FishDef {
  id: string;
  name: string;
  waters: LocationId[];
  seasons: Season[];
  /** any 表示任何天气；rain 包含暴风雨 */
  weather: 'any' | Weather;
  /** 出现时段 [开始, 结束)，单位为小时，可超过 24 */
  hours: [number, number];
  /** 1-6，越高越难 */
  difficulty: number;
  sellPrice: number;
  minLevel?: number;
  baseWeight: number;
  tags: FishTag[];
  unique?: boolean;
}

export interface FishingSpotDef {
  id: LocationId;
  name: string;
  waterType: WaterType;
  tier: 1 | 2 | 3 | 4;
  minLevel: number;
  requiredCapability: string;
  parent: 'forest' | 'mountain' | 'beach';
  description: string;
}

const ALL: Season[] = ['spring', 'summer', 'fall', 'winter'];

export const FISHING_SPOT_DEFS: FishingSpotDef[] = [
  { id: 'forest', name: '青禾溪', waterType: 'river', tier: 1, minLevel: 0, requiredCapability: 'basic', parent: 'forest', description: '林间浅溪，适合初学者和小型淡水鱼。' },
  { id: 'egret_river', name: '白鹭河', waterType: 'river', tier: 2, minLevel: 2, requiredCapability: 'tier2', parent: 'forest', description: '流经白鹭镇外的宽阔河道，雨天鱼群尤其活跃。' },
  { id: 'emerald_rapids', name: '翠谷急流', waterType: 'river', tier: 3, minLevel: 5, requiredCapability: 'river3', parent: 'forest', description: '水势湍急，只有擅长控线的钓手才能应付。' },
  { id: 'ancient_river', name: '古木秘河', waterType: 'river', tier: 4, minLevel: 9, requiredCapability: 'river4', parent: 'forest', description: '古树根系下的隐秘河段，传说栖息着远古巨鱼。' },
  { id: 'mountain', name: '山麓湖岸', waterType: 'lake', tier: 1, minLevel: 1, requiredCapability: 'basic', parent: 'mountain', description: '平静的山脚湖岸，鲤科鱼类很多。' },
  { id: 'mirror_lake', name: '镜月湖', waterType: 'lake', tier: 2, minLevel: 3, requiredCapability: 'lake2', parent: 'mountain', description: '湖面如镜，入夜后会出现特别的鱼影。' },
  { id: 'mist_lake', name: '寒雾深湖', waterType: 'lake', tier: 3, minLevel: 7, requiredCapability: 'lake3', parent: 'mountain', description: '常年寒雾笼罩的深水湖，鱼大而有力。' },
  { id: 'starfall_lake', name: '星陨湖', waterType: 'lake', tier: 4, minLevel: 10, requiredCapability: 'lake4', parent: 'mountain', description: '陨星形成的高山湖泊，只有顶尖钓手能抵达。' },
  { id: 'beach', name: '白鹭海滩', waterType: 'ocean', tier: 1, minLevel: 2, requiredCapability: 'tier2', parent: 'beach', description: '近岸浅海，盛产沙丁鱼和鲱鱼。' },
  { id: 'crescent_bay', name: '月牙海湾', waterType: 'ocean', tier: 2, minLevel: 4, requiredCapability: 'ocean2', parent: 'beach', description: '需要远投才能触及海湾中央的鱼群。' },
  { id: 'coral_reef', name: '珊瑚外礁', waterType: 'ocean', tier: 3, minLevel: 7, requiredCapability: 'ocean3', parent: 'beach', description: '色彩斑斓却暗流涌动的外海礁区。' },
  { id: 'abyssal_sea', name: '无光深海', waterType: 'ocean', tier: 4, minLevel: 9, requiredCapability: 'ocean4', parent: 'beach', description: '阳光无法抵达的深海，潜藏着庞大鱼影。' },
];

export const FISH: FishDef[] = [
  // 既有 18 种
  { id: 'carp', name: '鲤鱼', waters: ['mountain', 'mirror_lake', 'mist_lake', 'starfall_lake'], seasons: ALL, weather: 'any', hours: [6, 16], difficulty: 1, sellPrice: 30, baseWeight: 9, tags: ['lake', 'carp'] },
  { id: 'largemouth_bass', name: '大嘴鲈鱼', waters: ['mountain', 'mirror_lake', 'mist_lake'], seasons: ALL, weather: 'any', hours: [16, 26], difficulty: 2, sellPrice: 100, baseWeight: 7, tags: ['lake', 'predator'] },
  { id: 'sturgeon', name: '鲟鱼', waters: ['mist_lake'], seasons: ['summer', 'winter'], weather: 'any', hours: [6, 14], difficulty: 5, sellPrice: 400, minLevel: 7, baseWeight: 3, tags: ['lake', 'deep', 'large'] },
  { id: 'legend', name: '山谷鱼王', waters: ['starfall_lake'], seasons: ['spring'], weather: 'rain', hours: [6, 20], difficulty: 6, sellPrice: 5000, minLevel: 10, baseWeight: 0.5, tags: ['lake', 'legendary', 'large'], unique: true },
  { id: 'sunfish', name: '太阳鱼', waters: ['forest', 'egret_river'], seasons: ALL, weather: 'sunny', hours: [9, 17], difficulty: 1, sellPrice: 30, baseWeight: 9, tags: ['river', 'small'] },
  { id: 'chub', name: '鲢鱼', waters: ['forest', 'mountain'], seasons: ALL, weather: 'any', hours: [6, 20], difficulty: 2, sellPrice: 50, baseWeight: 8, tags: ['river', 'lake', 'small'] },
  { id: 'rainbow_trout', name: '虹鳟鱼', waters: ['egret_river', 'emerald_rapids'], seasons: ['summer'], weather: 'sunny', hours: [9, 16], difficulty: 3, sellPrice: 95, baseWeight: 5, tags: ['river', 'predator'] },
  { id: 'catfish', name: '鲶鱼', waters: ['egret_river'], seasons: ['spring', 'fall'], weather: 'rain', hours: [12, 24], difficulty: 4, sellPrice: 200, baseWeight: 4, tags: ['river', 'rain', 'large'] },
  { id: 'salmon', name: '鲑鱼', waters: ['emerald_rapids'], seasons: ['fall'], weather: 'any', hours: [6, 13], difficulty: 3, sellPrice: 175, minLevel: 5, baseWeight: 5, tags: ['river', 'large'] },
  { id: 'pike', name: '狗鱼', waters: ['egret_river', 'mirror_lake', 'mountain'], seasons: ['summer', 'winter'], weather: 'any', hours: [16, 26], difficulty: 4, sellPrice: 160, baseWeight: 4, tags: ['river', 'lake', 'predator'] },
  { id: 'anchovy', name: '鳀鱼', waters: ['beach'], seasons: ['spring', 'summer', 'fall'], weather: 'any', hours: [6, 12], difficulty: 1, sellPrice: 30, baseWeight: 9, tags: ['ocean', 'small'] },
  { id: 'sardine', name: '沙丁鱼', waters: ['beach'], seasons: ['spring', 'fall', 'winter'], weather: 'sunny', hours: [6, 19], difficulty: 1, sellPrice: 40, baseWeight: 9, tags: ['ocean', 'small'] },
  { id: 'herring', name: '鲱鱼', waters: ['beach', 'crescent_bay'], seasons: ALL, weather: 'any', hours: [18, 26], difficulty: 2, sellPrice: 45, baseWeight: 8, tags: ['ocean', 'small'] },
  { id: 'halibut', name: '大比目鱼', waters: ['crescent_bay'], seasons: ['spring', 'summer', 'winter'], weather: 'any', hours: [6, 11], difficulty: 3, sellPrice: 180, baseWeight: 5, tags: ['ocean', 'large'] },
  { id: 'tuna', name: '金枪鱼', waters: ['crescent_bay', 'coral_reef'], seasons: ['summer', 'winter'], weather: 'sunny', hours: [12, 19], difficulty: 4, sellPrice: 300, baseWeight: 4, tags: ['ocean', 'large', 'predator'] },
  { id: 'red_snapper', name: '红鲷鱼', waters: ['crescent_bay', 'coral_reef'], seasons: ['summer', 'fall'], weather: 'rain', hours: [9, 19], difficulty: 3, sellPrice: 150, baseWeight: 5, tags: ['ocean', 'coral', 'rain'] },
  { id: 'eel', name: '鳗鱼', waters: ['beach', 'crescent_bay'], seasons: ['spring', 'fall'], weather: 'rain', hours: [16, 26], difficulty: 4, sellPrice: 185, baseWeight: 4, tags: ['ocean', 'night', 'rain'] },
  { id: 'pufferfish', name: '河豚', waters: ['coral_reef'], seasons: ['summer'], weather: 'sunny', hours: [12, 16], difficulty: 5, sellPrice: 400, minLevel: 7, baseWeight: 3, tags: ['ocean', 'coral'] },
  // 新增河流 10 种
  { id: 'creek_goby', name: '溪石斑', waters: ['forest'], seasons: ALL, weather: 'sunny', hours: [6, 14], difficulty: 1, sellPrice: 45, baseWeight: 8, tags: ['river', 'small'] },
  { id: 'stone_minnow', name: '马口鱼', waters: ['forest', 'egret_river'], seasons: ALL, weather: 'sunny', hours: [6, 12], difficulty: 2, sellPrice: 70, baseWeight: 7, tags: ['river', 'small'] },
  { id: 'bitterling', name: '鳑鲏', waters: ['forest'], seasons: ['spring', 'summer'], weather: 'any', hours: [8, 14], difficulty: 1, sellPrice: 55, baseWeight: 7, tags: ['river', 'small'] },
  { id: 'loach', name: '泥鳅', waters: ['egret_river'], seasons: ['spring', 'fall'], weather: 'rain', hours: [18, 26], difficulty: 2, sellPrice: 90, minLevel: 2, baseWeight: 6, tags: ['river', 'rain'] },
  { id: 'yellow_catfish', name: '黄颡鱼', waters: ['egret_river'], seasons: ['summer', 'fall'], weather: 'any', hours: [16, 26], difficulty: 3, sellPrice: 180, minLevel: 3, baseWeight: 5, tags: ['river', 'night', 'predator'] },
  { id: 'topmouth_culter', name: '翘嘴', waters: ['emerald_rapids'], seasons: ALL, weather: 'any', hours: [6, 17], difficulty: 4, sellPrice: 320, minLevel: 5, baseWeight: 4, tags: ['river', 'large', 'predator'] },
  { id: 'mandarin_fish', name: '鳜鱼', waters: ['emerald_rapids'], seasons: ALL, weather: 'any', hours: [16, 26], difficulty: 5, sellPrice: 520, minLevel: 6, baseWeight: 3, tags: ['river', 'large', 'predator'] },
  { id: 'ayu', name: '香鱼', waters: ['emerald_rapids'], seasons: ['summer'], weather: 'sunny', hours: [6, 12], difficulty: 4, sellPrice: 280, minLevel: 5, baseWeight: 4, tags: ['river'] },
  { id: 'taimen', name: '哲罗鲑', waters: ['ancient_river'], seasons: ALL, weather: 'any', hours: [6, 26], difficulty: 6, sellPrice: 1300, minLevel: 9, baseWeight: 2, tags: ['river', 'large', 'predator', 'deep'] },
  { id: 'ancient_sturgeon', name: '古木鲟', waters: ['ancient_river'], seasons: ['fall'], weather: 'rain', hours: [18, 26], difficulty: 6, sellPrice: 6500, minLevel: 10, baseWeight: 0.5, tags: ['river', 'legendary', 'large', 'night'], unique: true },
  // 新增湖泊 8 种
  { id: 'silver_crucian', name: '银鲫', waters: ['mountain'], seasons: ALL, weather: 'rain', hours: [6, 16], difficulty: 1, sellPrice: 55, baseWeight: 8, tags: ['lake', 'carp', 'small'] },
  { id: 'brook_trout', name: '红点鲑', waters: ['mirror_lake'], seasons: ['spring', 'fall', 'winter'], weather: 'rain', hours: [6, 12], difficulty: 3, sellPrice: 190, minLevel: 3, baseWeight: 5, tags: ['lake', 'predator'] },
  { id: 'lake_trout', name: '湖鳟', waters: ['mirror_lake', 'mist_lake', 'starfall_lake'], seasons: ALL, weather: 'any', hours: [9, 26], difficulty: 4, sellPrice: 350, minLevel: 4, baseWeight: 4, tags: ['lake', 'large', 'predator'] },
  { id: 'freshwater_eel', name: '鳗鲡', waters: ['mirror_lake'], seasons: ['summer', 'fall'], weather: 'rain', hours: [18, 26], difficulty: 4, sellPrice: 300, minLevel: 4, baseWeight: 4, tags: ['lake', 'night', 'rain'] },
  { id: 'bluegill', name: '蓝鳃太阳鱼', waters: ['mountain', 'mirror_lake'], seasons: ['spring', 'summer'], weather: 'sunny', hours: [9, 17], difficulty: 2, sellPrice: 85, baseWeight: 7, tags: ['lake', 'small'] },
  { id: 'paddlefish', name: '匙吻鲟', waters: ['mist_lake'], seasons: ['summer'], weather: 'any', hours: [6, 14], difficulty: 5, sellPrice: 720, minLevel: 7, baseWeight: 3, tags: ['lake', 'deep', 'large'] },
  { id: 'mist_fish', name: '寒雾鱼', waters: ['mist_lake'], seasons: ['winter'], weather: 'snow', hours: [18, 26], difficulty: 5, sellPrice: 850, minLevel: 8, baseWeight: 2.5, tags: ['lake', 'deep', 'night'] },
  { id: 'mirror_dragonfish', name: '镜月龙鱼', waters: ['starfall_lake'], seasons: ['summer'], weather: 'any', hours: [20, 26], difficulty: 6, sellPrice: 7000, minLevel: 10, baseWeight: 0.5, tags: ['lake', 'legendary', 'night', 'large'], unique: true },
  // 新增海域 14 种
  { id: 'mackerel', name: '鲭鱼', waters: ['beach', 'crescent_bay'], seasons: ['spring', 'fall'], weather: 'sunny', hours: [6, 12], difficulty: 2, sellPrice: 90, baseWeight: 7, tags: ['ocean', 'small'] },
  { id: 'horse_mackerel', name: '竹荚鱼', waters: ['beach'], seasons: ['summer', 'fall'], weather: 'any', hours: [12, 20], difficulty: 2, sellPrice: 75, baseWeight: 7, tags: ['ocean', 'small'] },
  { id: 'sea_bream', name: '鲷鱼', waters: ['crescent_bay'], seasons: ['spring', 'summer'], weather: 'sunny', hours: [9, 17], difficulty: 3, sellPrice: 220, minLevel: 4, baseWeight: 5, tags: ['ocean'] },
  { id: 'grouper', name: '石斑鱼', waters: ['coral_reef'], seasons: ['summer', 'fall'], weather: 'rain', hours: [9, 17], difficulty: 4, sellPrice: 480, minLevel: 7, baseWeight: 4, tags: ['ocean', 'coral', 'large'] },
  { id: 'sea_bass', name: '海鲈', waters: ['crescent_bay'], seasons: ALL, weather: 'any', hours: [12, 22], difficulty: 3, sellPrice: 180, minLevel: 4, baseWeight: 5, tags: ['ocean', 'predator'] },
  { id: 'bonito', name: '鲣鱼', waters: ['crescent_bay', 'coral_reef'], seasons: ['summer', 'fall'], weather: 'sunny', hours: [6, 17], difficulty: 4, sellPrice: 360, minLevel: 5, baseWeight: 4, tags: ['ocean', 'large', 'predator'] },
  { id: 'swordfish', name: '剑鱼', waters: ['abyssal_sea'], seasons: ALL, weather: 'any', hours: [9, 19], difficulty: 6, sellPrice: 1400, minLevel: 9, baseWeight: 2, tags: ['ocean', 'deep', 'large', 'predator'] },
  { id: 'mahi_mahi', name: '鬼头刀', waters: ['coral_reef'], seasons: ['spring', 'summer', 'fall'], weather: 'sunny', hours: [9, 17], difficulty: 5, sellPrice: 650, minLevel: 7, baseWeight: 3, tags: ['ocean', 'coral', 'large'] },
  { id: 'lobster', name: '龙虾', waters: ['coral_reef'], seasons: ALL, weather: 'any', hours: [18, 26], difficulty: 3, sellPrice: 420, minLevel: 7, baseWeight: 3.5, tags: ['ocean', 'coral', 'night'] },
  { id: 'octopus', name: '章鱼', waters: ['coral_reef', 'abyssal_sea'], seasons: ALL, weather: 'any', hours: [6, 16], difficulty: 6, sellPrice: 900, minLevel: 8, baseWeight: 2, tags: ['ocean', 'coral', 'deep'] },
  { id: 'squid', name: '乌贼', waters: ['crescent_bay', 'abyssal_sea'], seasons: ['winter'], weather: 'any', hours: [18, 26], difficulty: 4, sellPrice: 380, minLevel: 5, baseWeight: 4, tags: ['ocean', 'night'] },
  { id: 'parrotfish', name: '鹦嘴鱼', waters: ['coral_reef'], seasons: ['summer'], weather: 'sunny', hours: [8, 16], difficulty: 3, sellPrice: 300, minLevel: 7, baseWeight: 4, tags: ['ocean', 'coral'] },
  { id: 'anglerfish', name: '鮟鱇鱼', waters: ['abyssal_sea'], seasons: ALL, weather: 'any', hours: [18, 26], difficulty: 5, sellPrice: 1100, minLevel: 9, baseWeight: 2.5, tags: ['ocean', 'deep', 'night', 'large'] },
  { id: 'abyss_oarfish', name: '无光皇带鱼', waters: ['abyssal_sea'], seasons: ['winter'], weather: 'storm', hours: [20, 26], difficulty: 6, sellPrice: 8000, minLevel: 10, baseWeight: 0.4, tags: ['ocean', 'deep', 'legendary', 'large', 'night'], unique: true },
  // 时段/天气专属鱼：补齐夜晚、雪天、暴风雨与晨昏生态位
  { id: 'firefly_minnow', name: '萤溪鱼', waters: ['forest'], seasons: ALL, weather: 'any', hours: [20, 26], difficulty: 2, sellPrice: 110, minLevel: 1, baseWeight: 5, tags: ['river', 'night', 'small'] },
  { id: 'rapids_shadowfish', name: '急流影鳡', waters: ['emerald_rapids'], seasons: ['spring', 'summer', 'fall'], weather: 'rain', hours: [19, 26], difficulty: 5, sellPrice: 560, minLevel: 6, baseWeight: 3, tags: ['river', 'night', 'rain', 'predator', 'large'] },
  { id: 'reef_night_snapper', name: '夜礁笛鲷', waters: ['coral_reef'], seasons: ['summer', 'fall'], weather: 'any', hours: [19, 26], difficulty: 5, sellPrice: 580, minLevel: 7, baseWeight: 3.5, tags: ['ocean', 'coral', 'night', 'large'] },
  { id: 'snow_mirror_trout', name: '雪镜鳟', waters: ['mirror_lake'], seasons: ['winter'], weather: 'snow', hours: [9, 17], difficulty: 4, sellPrice: 420, minLevel: 4, baseWeight: 3.5, tags: ['lake', 'predator'] },
  { id: 'frost_mist_perch', name: '霜雾鲈', waters: ['mist_lake'], seasons: ['winter'], weather: 'snow', hours: [6, 14], difficulty: 5, sellPrice: 680, minLevel: 7, baseWeight: 3, tags: ['lake', 'deep', 'large'] },
  { id: 'storm_bay_marlin', name: '风暴枪鱼', waters: ['crescent_bay'], seasons: ['summer', 'fall'], weather: 'storm', hours: [12, 20], difficulty: 5, sellPrice: 900, minLevel: 6, baseWeight: 2.5, tags: ['ocean', 'large', 'predator'] },
  { id: 'dawn_silver_carp', name: '破晓银鲤', waters: ['mountain'], seasons: ['spring', 'summer'], weather: 'sunny', hours: [6, 9], difficulty: 2, sellPrice: 120, minLevel: 1, baseWeight: 5, tags: ['lake', 'carp', 'small'] },
  { id: 'dusk_river_perch', name: '暮河鲈', waters: ['egret_river'], seasons: ALL, weather: 'any', hours: [16, 26], difficulty: 3, sellPrice: 210, minLevel: 3, baseWeight: 4, tags: ['river', 'predator', 'night'] },
];

export const TRASH = [
  { id: 'driftwood', name: '浮木' },
  { id: 'old_boot', name: '旧靴子' },
  { id: 'soggy_newspaper', name: '湿报纸' },
];

export function weatherMatches(fishWeather: FishDef['weather'], weather: Weather): boolean {
  if (fishWeather === 'any') return true;
  const raining = weather === 'rain' || weather === 'storm';
  return fishWeather === 'rain' ? raining : weather === fishWeather;
}
