import {
  DAY_START_MINUTES,
  DAYS_PER_SEASON,
  EVALUATION_YEAR,
  LIGHTNING_CHANCE,
  WEATHER_CHANCE,
} from '../data/config.js';
import { CROPS } from '../data/crops.js';
import { festivalOn } from '../data/festivals.js';
import { MORNING_LINES, LOCATIONS, WEATHER_NAMES } from '../data/world.js';
import { openNextProfession } from './activity.js';
import { formatDate, isRaining, nextSeason, todayFestival } from './calendar.js';
import { CANDLE_TEXT, evaluate } from './evaluation.js';
import { allTiles } from './farm.js';
import { pick, random } from './rng.js';
import { maxHp, sellPrice } from './skills.js';
import { spawnForage } from './systems/foraging.js';
import { resetForestDaily } from './systems/forest.js';
import { morningSocial, nightlySocial } from './systems/social.js';
import { finishUpgrades } from './systems/tools.js';
import type { GameEvent, GameState, Season, Weather } from './types.js';
import { bad, good, info, love, passOutFee, warn } from './util.js';

export function rollWeather(s: GameState, season: Season, day: number): Weather {
  if (day === 1 || festivalOn(season, day)) return 'sunny';
  let roll = random(s);
  for (const [weather, chance] of Object.entries(WEATHER_CHANCE[season]) as [Weather, number][]) {
    if (roll < chance) return weather;
    roll -= chance;
  }
  return 'sunny';
}

export function shippingValue(s: GameState): number {
  return Object.entries(s.shippingBin).reduce((sum, [id, qty]) => sum + sellPrice(s, id) * qty, 0);
}

function growCrops(s: GameState): void {
  for (const tile of allTiles(s)) {
    if (tile.crop && tile.watered && tile.crop.age < CROPS[tile.crop.cropId].growDays) {
      tile.crop.age += 1;
    }
    tile.watered = false;
  }
}

function lightning(s: GameState, events: GameEvent[]): void {
  if (s.weather !== 'storm' || random(s) >= LIGHTNING_CHANCE) return;
  const targets = allTiles(s).filter((t) => t.crop && !t.greenhouse);
  if (targets.length === 0) return;
  const tile = pick(s, targets);
  events.push(bad(`昨夜的闪电劈中了田里的一株${CROPS[tile.crop!.cropId].name}，把它烧焦了。`));
  tile.crop = null;
}

function advanceCalendar(s: GameState, events: GameEvent[]): void {
  s.day += 1;
  if (s.day <= DAYS_PER_SEASON) return;
  s.day = 1;
  s.season = nextSeason(s.season);
  if (s.season === 'spring') s.year += 1;
  let withered = 0;
  for (const tile of allTiles(s)) {
    if (tile.crop && !tile.greenhouse && !CROPS[tile.crop.cropId].seasons.includes(s.season)) {
      tile.crop = null;
      withered += 1;
    }
  }
  if (withered > 0) events.push(warn(`换季了，${withered} 株不合季节的作物枯萎了。`));
}

/** 结算当天并推进到次日早晨。直接修改传入的 state。 */
export function endDay(s: GameState, events: GameEvent[], passedOut: boolean): void {
  const income = shippingValue(s);
  s.shippingBin = {};
  s.gold += income;
  s.stats.totalEarned += income;

  growCrops(s);
  lightning(s, events);
  nightlySocial(s);

  if (passedOut) {
    const lost = passOutFee(s.gold);
    s.gold -= lost;
    s.stats.timesPassedOut += 1;
    events.push(bad(`你累得昏倒在地……被路过的镇民送回了家。医药费花掉了 ${lost} 金。`));
  }

  advanceCalendar(s, events);

  s.weather = s.tomorrowWeather;
  const tomorrowSeason = s.day === DAYS_PER_SEASON ? nextSeason(s.season) : s.season;
  const tomorrowDay = s.day === DAYS_PER_SEASON ? 1 : s.day + 1;
  s.tomorrowWeather = rollWeather(s, tomorrowSeason, tomorrowDay);
  for (const tile of allTiles(s)) {
    if (tile.ground !== 'tilled' || !tile.crop) continue;
    if (tile.greenhouse || isRaining(s)) tile.watered = true;
  }

  s.energy = passedOut ? Math.floor(s.maxEnergy / 2) : s.maxEnergy;
  s.hp = maxHp(s);
  s.minutes = DAY_START_MINUTES;
  s.location = 'farm';
  s.mine.floor = 0;
  s.activity = null;
  spawnForage(s);
  resetForestDaily(s);

  events.push(info(`—— ${formatDate(s)} ${WEATHER_NAMES[s.weather]} ——`));
  events.push(info(pick(s, MORNING_LINES[s.weather])));
  if (income > 0) events.push(good(`出货箱结算：+${income} 金。`));
  if (passedOut) events.push(warn('昨晚没休息好，今天体力只恢复了一半。'));

  finishUpgrades(s, events);
  morningSocial(s, events);

  const festival = todayFestival(s);
  if (festival) {
    events.push(love(`🎊 今天是${festival.name}！9:00-14:00 在${LOCATIONS[festival.location].name}入场。`));
  }

  if (s.year === EVALUATION_YEAR && s.season === 'spring' && s.day === 1 && !s.evaluation) {
    s.evaluation = evaluate(s);
    events.push(love('🕯 爷爷的灵魂出现在神龛前，回顾你这两年的生活……'));
    for (const note of s.evaluation.notes) events.push(info(`   · ${note}`));
    events.push(love(`点亮了 ${s.evaluation.candles} 根蜡烛。${CANDLE_TEXT[s.evaluation.candles]}`));
  }

  openNextProfession(s);
}
