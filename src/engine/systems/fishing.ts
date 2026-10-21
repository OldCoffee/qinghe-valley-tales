import {
  DURABILITY,
  FISH_CAST,
  FISH_MAX_ROUNDS,
  FISH_ROUND_MINUTES,
  TRASH_CHANCE,
} from '../../data/config.js';
import { FISH, TRASH, weatherMatches, type FishDef } from '../../data/fish.js';
import { pick, random } from '../rng.js';
import { addXp, hasProf, skillLevel } from '../skills.js';
import type { Activity, GameEvent, GameState, LocationId } from '../types.js';
import { addItem, bad, good, info, round1, warn } from '../util.js';
import { toolUsable, wearTool } from './equipment.js';
import type { ActivityView } from './activityView.js';

type FishingActivity = Extract<Activity, { kind: 'fishing' }>;

export const FISHING_SPOTS: LocationId[] = ['beach', 'forest', 'mountain'];

const HINTS: Record<FishingActivity['hint'], string> = {
  struggle: '浮漂猛地往下一沉，鱼线绷得紧紧的！',
  rest: '水面渐渐平静，鱼好像没什么力气了。',
  unclear: '水面泛起一圈圈涟漪，看不出鱼在干什么……',
};

const fishById = (id: string): FishDef => FISH.find((f) => f.id === id)!;

export function availableFish(s: GameState): FishDef[] {
  const hour = s.minutes / 60;
  const level = skillLevel(s, 'fishing');
  return FISH.filter(
    (f) =>
      f.locations.includes(s.location) &&
      f.seasons.includes(s.season) &&
      weatherMatches(f.weather, s.weather) &&
      hour >= f.hours[0] &&
      hour < f.hours[1] &&
      (f.minLevel ?? 0) <= level,
  );
}

function rollMove(s: GameState, act: FishingActivity): void {
  const fish = fishById(act.fishId);
  const level = skillLevel(s, 'fishing');
  act.actual = random(s) < 0.3 + 0.08 * fish.difficulty ? 'struggle' : 'rest';
  const clearChance = Math.min(0.95, Math.max(0.4, 0.95 - 0.08 * fish.difficulty + 0.02 * level));
  act.hint = random(s) < clearChance ? act.actual : 'unclear';
}

export function startFishing(s: GameState, events: GameEvent[]): boolean {
  if (!FISHING_SPOTS.includes(s.location)) {
    events.push(warn('这里没有可以钓鱼的水域。去海滩、森林或山区吧。'));
    return false;
  }
  const rodProblem = toolUsable(s, 'rod');
  if (rodProblem) {
    events.push(warn(`${rodProblem}。`));
    return false;
  }
  const level = skillLevel(s, 'fishing');
  const energy = Math.max(FISH_CAST.minEnergy, FISH_CAST.energy - level * 0.5);
  if (s.energy < energy) {
    events.push(warn('体力不足，甩不动鱼竿了。'));
    return false;
  }
  s.energy = round1(s.energy - energy);
  s.minutes += FISH_CAST.minutes;
  if (wearTool(s, events, 'rod')) return true;

  const trashChance = hasProf(s, 'lucky_lure') ? 0 : Math.max(0.03, TRASH_CHANCE - level * 0.01);
  if (random(s) < trashChance) {
    const trash = pick(s, TRASH);
    addItem(s, trash.id, 1);
    addXp(s, 'fishing', 1, events);
    events.push(info(`你满怀期待地拉起鱼竿……钓上来一个${trash.name}。`));
    return true;
  }

  const candidates = availableFish(s);
  if (candidates.length === 0) {
    events.push(info('等了半天，一条鱼都没有咬钩。也许换个时间或地点试试。'));
    return true;
  }
  const weights = candidates.map((f) => (hasProf(s, 'lucky_lure') ? 3 : 7 - f.difficulty));
  let roll = random(s) * weights.reduce((a, b) => a + b, 0);
  let fish = candidates[0];
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll < 0) {
      fish = candidates[i];
      break;
    }
  }

  const act: FishingActivity = {
    kind: 'fishing',
    fishId: fish.id,
    progress: 30,
    tension: 20,
    round: 0,
    hint: 'rest',
    actual: 'rest',
  };
  rollMove(s, act);
  s.activity = act;
  events.push(good('🎣 有鱼咬钩了！'));
  return true;
}

function bar(value: number, width = 20): string {
  const filled = Math.max(0, Math.min(width, Math.round((value / 100) * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export function fishingView(act: FishingActivity): ActivityView {
  return {
    title: '🎣 拉锯中',
    lines: [
      `进度 ${bar(act.progress)} ${Math.round(act.progress)}%`,
      `张力 ${bar(act.tension)} ${Math.round(act.tension)}%`,
      HINTS[act.hint],
      `鱼放松时收线能拉近它；鱼挣扎时放线能卸掉张力。张力满了线会断，鱼竿还会额外磨损 ${DURABILITY.lineBreakWear} 点耐久。`,
    ],
    options: ['收线', '放线', '放弃'],
  };
}

export function chooseFishing(s: GameState, act: FishingActivity, index: number, events: GameEvent[]): boolean {
  if (index === 2) {
    s.activity = null;
    events.push(info('你剪断了鱼线，鱼游走了。'));
    return true;
  }
  if (index !== 0 && index !== 1) return false;

  const fish = fishById(act.fishId);
  const level = skillLevel(s, 'fishing');
  const rodBonus = s.tools.rod * 8;
  const tensionMult = hasProf(s, 'steady') ? 0.7 : 1;
  s.minutes += FISH_ROUND_MINUTES;
  act.round += 1;

  if (index === 0) {
    if (act.actual === 'rest') {
      act.progress += 22 + rodBonus + level * 1.5;
      events.push(info('你趁机飞快地收线！'));
    } else {
      act.tension += (25 + fish.difficulty * 6) * tensionMult;
      act.progress += 4;
      events.push(warn('鱼猛力挣扎，鱼线快要绷断了！'));
    }
  } else if (act.actual === 'struggle') {
    act.tension = Math.max(0, act.tension - 20 - rodBonus / 2);
    events.push(info('你顺势放线，卸掉了鱼的力气。'));
  } else {
    act.progress -= 10;
    act.tension = Math.max(0, act.tension - 5);
    events.push(info('鱼趁你放线往回游了一段。'));
  }

  if (act.progress >= 100) {
    s.activity = null;
    addItem(s, fish.id, 1);
    s.stats.fishCaught += 1;
    if (!s.stats.fishSpecies.includes(fish.id)) s.stats.fishSpecies.push(fish.id);
    events.push(good(`钓到了一条${fish.name}！`));
    addXp(s, 'fishing', 3 + fish.difficulty * 4, events);
  } else if (act.tension >= 100 || act.round >= FISH_MAX_ROUNDS) {
    const lineBroke = act.tension >= 100;
    s.activity = null;
    events.push(bad(lineBroke ? '啪！鱼线断了，鱼跑掉了。' : '鱼耗尽了你的耐心，挣脱鱼钩跑掉了。'));
    if (lineBroke) {
      events.push(warn(`断线回弹猛地抽打了鱼竿，鱼竿耐久额外 -${DURABILITY.lineBreakWear}。`));
      wearTool(s, events, 'rod', DURABILITY.lineBreakWear);
    }
    addXp(s, 'fishing', 1, events);
  } else {
    rollMove(s, act);
  }
  return true;
}
