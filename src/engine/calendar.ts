import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASON_ORDER } from '../data/config.js';
import { festivalOn, type FestivalDef } from '../data/festivals.js';
import type { ShopDef } from '../data/shops.js';
import { SEASON_NAMES, WEEKDAY_NAMES } from '../data/world.js';
import type { GameState, Season } from './types.js';

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 0 = 周一；每季第 1 天固定为周一 */
export function weekday(day: number): number {
  return (day - 1) % 7;
}

export function formatDate(s: Pick<GameState, 'season' | 'day' | 'year'>): string {
  return `第 ${s.year} 年 ${SEASON_NAMES[s.season]} · 第 ${s.day} 天（周${WEEKDAY_NAMES[weekday(s.day)]}）`;
}

export function nextSeason(season: Season): Season {
  return SEASON_ORDER[(SEASON_ORDER.indexOf(season) + 1) % SEASON_ORDER.length];
}

export function absoluteDay(s: Pick<GameState, 'season' | 'day' | 'year'>): number {
  return (s.year - 1) * DAYS_PER_YEAR + SEASON_ORDER.indexOf(s.season) * DAYS_PER_SEASON + s.day;
}

export function todayFestival(s: Pick<GameState, 'season' | 'day'>): FestivalDef | undefined {
  return festivalOn(s.season, s.day);
}

export function isRaining(s: Pick<GameState, 'weather'>): boolean {
  return s.weather === 'rain' || s.weather === 'storm';
}

export function shopClosedReason(s: GameState, shop: ShopDef): string | null {
  const festival = todayFestival(s);
  if (festival && festival.location === shop.location) {
    return `今天是${festival.name}，${shop.name}不营业。`;
  }
  if (shop.closedWeekday !== undefined && weekday(s.day) === shop.closedWeekday) {
    return `今天周${WEEKDAY_NAMES[shop.closedWeekday]}，${shop.name}休息。`;
  }
  if (s.minutes < shop.open) return `${shop.name} ${formatTime(shop.open)} 才开门。`;
  if (s.minutes >= shop.close) return `${shop.name}已经打烊了（${formatTime(shop.close)} 关门）。`;
  return null;
}
