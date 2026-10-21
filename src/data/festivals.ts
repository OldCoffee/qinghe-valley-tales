import type { LocationId, Season } from '../engine/types.js';

export interface FestivalDef {
  id: string;
  name: string;
  season: Season;
  day: number;
  location: LocationId;
  intro: string;
}

export const FESTIVAL_HOURS = { start: 9 * 60, end: 14 * 60, over: 22 * 60 };
export const FESTIVAL_FRIENDSHIP = 30;

export const FESTIVALS: FestivalDef[] = [
  { id: 'egg', name: '复活蛋节', season: 'spring', day: 13, location: 'town', intro: '广场上挂满彩旗，孩子们拎着篮子跑来跑去——寻蛋比赛要开始了！' },
  { id: 'luau', name: '夏日汤会', season: 'summer', day: 11, location: 'beach', intro: '海边支起一口大锅，镇民们轮流往汤里加食材。轮到你了。' },
  { id: 'fair', name: '秋收展会', season: 'fall', day: 16, location: 'town', intro: '展会上人头攒动，每位农场主都可以布置一个展台参加评比。' },
  { id: 'winter_star', name: '冬星宴', season: 'winter', day: 25, location: 'town', intro: '大家围坐在长桌旁，按传统要给抽到的"秘密朋友"送一份礼物。' },
];

export const EGG_SPOTS = ['草丛里', '大树后面', '水井旁边', '花坛中间'];
export const EGG_ROUNDS = 5;
export const EGG_WIN = 8;
export const FAIR_MAX_ITEMS = 6;
export const WINTER_STAR_GIFTS: [string, number][] = [
  ['diamond', 1],
  ['crystal_fruit', 3],
  ['pizza', 3],
  ['strawberry_seed', 10],
];

export function festivalOn(season: Season, day: number): FestivalDef | undefined {
  return FESTIVALS.find((f) => f.season === season && f.day === day);
}
