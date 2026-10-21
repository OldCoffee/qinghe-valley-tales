import type { LocationId, Season, Weather } from '../engine/types.js';

export interface FishDef {
  id: string;
  name: string;
  locations: LocationId[];
  seasons: Season[];
  /** any 表示任何天气；rain 包含暴风雨 */
  weather: 'any' | 'sunny' | 'rain';
  /** 出现时段 [开始, 结束)，单位为小时，可超过 24 */
  hours: [number, number];
  /** 1-6，越高越难 */
  difficulty: number;
  sellPrice: number;
  minLevel?: number;
}

const ALL: Season[] = ['spring', 'summer', 'fall', 'winter'];

export const FISH: FishDef[] = [
  { id: 'carp', name: '鲤鱼', locations: ['mountain'], seasons: ALL, weather: 'any', hours: [6, 26], difficulty: 1, sellPrice: 30 },
  { id: 'largemouth_bass', name: '大嘴鲈鱼', locations: ['mountain'], seasons: ALL, weather: 'any', hours: [6, 19], difficulty: 2, sellPrice: 100 },
  { id: 'sturgeon', name: '鲟鱼', locations: ['mountain'], seasons: ['summer', 'winter'], weather: 'any', hours: [6, 19], difficulty: 5, sellPrice: 200 },
  { id: 'legend', name: '山谷鱼王', locations: ['mountain'], seasons: ['spring'], weather: 'rain', hours: [6, 20], difficulty: 6, sellPrice: 5000, minLevel: 10 },
  { id: 'sunfish', name: '太阳鱼', locations: ['forest'], seasons: ['spring', 'summer'], weather: 'sunny', hours: [6, 19], difficulty: 1, sellPrice: 30 },
  { id: 'chub', name: '鲢鱼', locations: ['forest', 'mountain'], seasons: ALL, weather: 'any', hours: [6, 26], difficulty: 2, sellPrice: 50 },
  { id: 'rainbow_trout', name: '虹鳟鱼', locations: ['forest'], seasons: ['summer'], weather: 'sunny', hours: [6, 19], difficulty: 3, sellPrice: 65 },
  { id: 'catfish', name: '鲶鱼', locations: ['forest'], seasons: ['spring', 'fall'], weather: 'rain', hours: [6, 24], difficulty: 4, sellPrice: 200 },
  { id: 'salmon', name: '鲑鱼', locations: ['forest'], seasons: ['fall'], weather: 'any', hours: [6, 19], difficulty: 3, sellPrice: 75 },
  { id: 'pike', name: '狗鱼', locations: ['forest'], seasons: ['summer', 'winter'], weather: 'any', hours: [6, 26], difficulty: 4, sellPrice: 100 },
  { id: 'anchovy', name: '鳀鱼', locations: ['beach'], seasons: ['spring', 'fall'], weather: 'any', hours: [6, 26], difficulty: 1, sellPrice: 30 },
  { id: 'sardine', name: '沙丁鱼', locations: ['beach'], seasons: ['spring', 'fall', 'winter'], weather: 'any', hours: [6, 19], difficulty: 1, sellPrice: 40 },
  { id: 'herring', name: '鲱鱼', locations: ['beach'], seasons: ALL, weather: 'any', hours: [6, 26], difficulty: 2, sellPrice: 30 },
  { id: 'halibut', name: '大比目鱼', locations: ['beach'], seasons: ['spring', 'summer', 'winter'], weather: 'any', hours: [6, 11], difficulty: 3, sellPrice: 80 },
  { id: 'tuna', name: '金枪鱼', locations: ['beach'], seasons: ['summer', 'winter'], weather: 'any', hours: [6, 19], difficulty: 4, sellPrice: 100 },
  { id: 'red_snapper', name: '红鲷鱼', locations: ['beach'], seasons: ['summer', 'fall'], weather: 'rain', hours: [6, 19], difficulty: 3, sellPrice: 50 },
  { id: 'eel', name: '鳗鱼', locations: ['beach'], seasons: ['spring', 'fall'], weather: 'rain', hours: [16, 26], difficulty: 4, sellPrice: 85 },
  { id: 'pufferfish', name: '河豚', locations: ['beach'], seasons: ['summer'], weather: 'sunny', hours: [12, 16], difficulty: 5, sellPrice: 200 },
];

export const TRASH = [
  { id: 'driftwood', name: '浮木' },
  { id: 'old_boot', name: '旧靴子' },
  { id: 'soggy_newspaper', name: '湿报纸' },
];

export const ROD_NAMES = ['竹制鱼竿', '玻璃纤维鱼竿', '铱金鱼竿'];

export function weatherMatches(fishWeather: FishDef['weather'], weather: Weather): boolean {
  if (fishWeather === 'any') return true;
  const raining = weather === 'rain' || weather === 'storm';
  return fishWeather === 'rain' ? raining : !raining;
}
