import {
  DURABILITY,
  FISH_CAST,
  FISH_MAX_ROUNDS,
  FISH_ROUND_MINUTES,
  TOOL_POWER,
  TRASH_CHANCE,
} from '../../data/config.js';
import { FISH, FISHING_SPOT_DEFS, TRASH, weatherMatches, type FishDef } from '../../data/fish.js';
import { BAIT_BY_ID, RODS, ROD_BY_ID, equippedRod, ownsCapability } from '../../data/fishingGear.js';
import { ITEMS } from '../../data/items.js';
import { pick, random } from '../rng.js';
import { addXp, hasProf, skillLevel } from '../skills.js';
import type { Activity, GameEvent, GameState, LocationId } from '../types.js';
import { addItem, bad, good, info, recordCollected, removeItem, round1, warn } from '../util.js';
import { toolMaxDurability, toolUsable, wearTool } from './equipment.js';
import type { ActivityView } from './activityView.js';

type FishingActivity = Extract<Activity, { kind: 'fishing' }>;

export const FISHING_SPOTS: LocationId[] = FISHING_SPOT_DEFS.map((s) => s.id);

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
      f.waters.includes(s.location) &&
      f.seasons.includes(s.season) &&
      weatherMatches(f.weather, s.weather) &&
      hour >= f.hours[0] &&
      hour < f.hours[1] &&
      (f.minLevel ?? 0) <= level &&
      !(f.unique && s.stats.fishSpecies.includes(f.id)),
  );
}

export function fishingSpotAccessReason(s: GameState, location: LocationId): string | null {
  const spot = FISHING_SPOT_DEFS.find((x) => x.id === location);
  if (!spot) return '这里没有可以钓鱼的水域';
  const level = skillLevel(s, 'fishing');
  if (level < spot.minLevel) return `钓鱼技能需要 ${spot.minLevel} 级（当前 ${level} 级）`;
  if (!ownsCapability(s, spot.requiredCapability)) return `需要拥有能进入${spot.name}的鱼竿`;
  return null;
}

export function equipFishingRod(s: GameState, events: GameEvent[], rodId: string): boolean {
  const rod = ROD_BY_ID[rodId];
  if (!rod || !s.ownedRods.includes(rodId)) {
    events.push(warn('你还没有这支鱼竿。'));
    return false;
  }
  s.equippedRodId = rodId;
  s.tools.rod = rod.tier;
  s.equippedTools.rod = true;
  if (s.equippedBaitId) {
    const bait = BAIT_BY_ID[s.equippedBaitId];
    if (!rod.allowsBait || (bait?.advanced && !rod.allowsAdvancedBait)) s.equippedBaitId = null;
  }
  events.push(good(`装备了${rod.name}。`));
  return true;
}

export function equipFishingBait(s: GameState, events: GameEvent[], baitId: string | null): boolean {
  if (baitId === null) {
    s.equippedBaitId = null;
    events.push(info('卸下了鱼饵。'));
    return true;
  }
  const bait = BAIT_BY_ID[baitId];
  const rod = equippedRod(s);
  if (!bait || !(s.inventory[baitId] > 0)) {
    events.push(warn('背包里没有这种鱼饵。'));
    return false;
  }
  if (!rod.allowsBait || (bait.advanced && !rod.allowsAdvancedBait)) {
    events.push(warn(bait.advanced ? '这支鱼竿不能使用史诗/传说鱼饵。' : '竹制鱼竿不能安装鱼饵。'));
    return false;
  }
  s.equippedBaitId = baitId;
  events.push(good(`装上了${bait.name}（剩余 ${s.inventory[baitId]}）。`));
  return true;
}

export function craftFishingGear(s: GameState, events: GameEvent[], targetId: string): boolean {
  const rod = ROD_BY_ID[targetId] ?? RODS.find((r) => r.itemId === targetId);
  const bait = BAIT_BY_ID[targetId];
  if (!rod && !bait) {
    events.push(warn('没有这种渔具或鱼饵配方。'));
    return false;
  }
  const level = skillLevel(s, 'fishing');
  const minLevel = rod ? rod.minLevel : bait!.minLevel;
  if (level < minLevel) {
    events.push(warn(`制作${rod ? rod.name : bait!.name}需要钓鱼技能 ${minLevel} 级（当前 ${level} 级）。`));
    return false;
  }
  if (rod && s.ownedRods.includes(rod.id)) {
    events.push(warn(`你已经拥有${rod.name}了。`));
    return false;
  }
  const recipe = rod ? rod.recipe : bait!.recipe;
  if (!recipe || Object.keys(recipe).length === 0) {
    events.push(warn('该物品暂不支持手作配方。'));
    return false;
  }
  const missing = Object.entries(recipe)
    .filter(([itemId, need]) => (s.inventory[itemId] ?? 0) < need)
    .map(([itemId, need]) => `${ITEMS[itemId]?.name ?? itemId} ×${need - (s.inventory[itemId] ?? 0)}`);
  if (missing.length > 0) {
    events.push(warn(`原料不足，还差：${missing.join('、')}。`));
    return false;
  }
  for (const [itemId, need] of Object.entries(recipe)) {
    removeItem(s, itemId, need);
  }
  if (rod) {
    s.ownedRods.push(rod.id);
    s.equippedRodId = rod.id;
    s.tools.rod = Math.max(s.tools.rod, rod.tier);
    s.durability.rod = toolMaxDurability(Math.min(4, rod.tier));
    s.equippedTools.rod = true;
    recordCollected(s, rod.itemId);
    events.push(good(`✨ 锻造完成了${rod.name}，已收入渔具包并装备！`));
  } else if (bait) {
    const qty = bait.craftYield ?? 4;
    addItem(s, bait.id, qty);
    if (equippedRod(s).allowsBait && (!bait.advanced || equippedRod(s).allowsAdvancedBait)) {
      s.equippedBaitId = bait.id;
    }
    events.push(good(`✨ 调配完成了${bait.name} ×${qty}，已放入背包！`));
  }
  return true;
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
    events.push(warn('这里没有可以钓鱼的水域。打开地图选择河流、湖泊或海域吧。'));
    return false;
  }
  const access = fishingSpotAccessReason(s, s.location);
  if (access) {
    events.push(warn(access));
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
  const rod = equippedRod(s);
  const bait = s.equippedBaitId ? BAIT_BY_ID[s.equippedBaitId] : null;
  const castReduction = (rod.castMinutesReduction ?? 0) + (bait?.castMinutesReduction ?? 0);
  s.energy = round1(s.energy - energy);
  s.minutes += Math.max(5, FISH_CAST.minutes - castReduction);
  if (wearTool(s, events, 'rod')) return true;

  const rodLevel = rod.tier;
  const trashChance = hasProf(s, 'lucky_lure')
    ? 0
    : Math.max(0, TRASH_CHANCE - level * 0.01 - TOOL_POWER.rodTrashReductionPerLevel * rodLevel - (bait?.trashReduction ?? 0));
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
  const weights = candidates.map((f) => {
    let weight = f.baseWeight + (hasProf(s, 'lucky_lure') ? 2 : 0) + rodLevel * f.difficulty * 0.25;
    if (f.tags.some((tag) => rod.affinity.includes(tag))) weight *= 1 + rod.encounterBonus;
    if (rod.targetFishIds?.includes(f.id)) weight *= 1.45;
    if (bait && (!bait.legendaryOnly || f.tags.includes('legendary')) && f.tags.some((tag) => bait.tags.includes(tag))) {
      weight *= 1 + bait.weightBonus + (f.difficulty >= 5 ? bait.rareBonus ?? 0 : 0);
    }
    if (bait?.targetFishIds?.includes(f.id)) weight *= 1.5;
    return Math.max(0.05, weight);
  });
  let roll = random(s) * weights.reduce((a, b) => a + b, 0);
  let fish = candidates[0];
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll < 0) {
      fish = candidates[i];
      break;
    }
  }

  const rodTargetsFish = rod.targetFishIds?.includes(fish.id) ?? false;
  const baitTargetsFish = bait?.targetFishIds?.includes(fish.id) ?? false;
  const act: FishingActivity = {
    kind: 'fishing',
    fishId: fish.id,
    progress: 30 + (rodTargetsFish ? 6 : 0) + (baitTargetsFish ? 4 : 0),
    tension: 20,
    round: 0,
    hint: 'rest',
    actual: 'rest',
    rodId: rod.id,
    baitId: bait?.id ?? null,
    tensionCap: 100 + (rod.tensionCapBonus ?? 0),
    tensionMult: (1 - (rod.tensionReduction ?? 0)) * (1 - (bait?.stabilityBonus ?? 0)) * (rodTargetsFish ? 0.86 : 1) * (baitTargetsFish ? 0.92 : 1),
    progressMult: (1 + (rod.progressBonus ?? 0)) * (rodTargetsFish ? 1.18 : 1) * (baitTargetsFish ? 1.1 : 1),
    lineBreakWearMult: 1 - (rod.lineBreakWearReduction ?? 0),
  };
  if (bait) {
    removeItem(s, bait.id, 1);
    if (!(s.inventory[bait.id] > 0)) s.equippedBaitId = null;
  }
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
  const rod = ROD_BY_ID[act.rodId ?? s.equippedRodId] ?? equippedRod(s);
  const rodBonus = rod.tier * 8;
  const tensionMult = (hasProf(s, 'steady') ? 0.7 : 1) * (act.tensionMult ?? 1);
  const tensionCap = act.tensionCap ?? 100;
  const progressMult = act.progressMult ?? 1;
  s.minutes += FISH_ROUND_MINUTES;
  act.round += 1;

  if (index === 0) {
    if (act.actual === 'rest') {
      act.progress += (22 + rodBonus + level * 1.5) * progressMult;
      // 平静时收线也会慢慢绷紧鱼线，保证张力每回合都有变化
      act.tension += (6 + fish.difficulty * 2) * tensionMult;
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
    act.tension = Math.max(0, act.tension - 12);
    events.push(info('鱼趁你放线往回游了一段。'));
  }
  act.tension = Math.max(0, Math.min(tensionCap, act.tension));

  if (act.progress >= 100) {
    s.activity = null;
    addItem(s, fish.id, 1);
    s.stats.fishCaught += 1;
    if (!s.stats.fishSpecies.includes(fish.id)) s.stats.fishSpecies.push(fish.id);
    events.push(good(`钓到了一条${fish.name}！`));
    addXp(s, 'fishing', 3 + fish.difficulty * 4, events);
  } else if (act.tension >= tensionCap || act.round >= FISH_MAX_ROUNDS) {
    const lineBroke = act.tension >= tensionCap;
    s.activity = null;
    events.push(bad(lineBroke ? '啪！鱼线断了，鱼跑掉了。' : '鱼耗尽了你的耐心，挣脱鱼钩跑掉了。'));
    if (lineBroke) {
      const wear = Math.max(1, Math.ceil(DURABILITY.lineBreakWear * (act.lineBreakWearMult ?? 1)));
      events.push(warn(`断线回弹猛地抽打了鱼竿，鱼竿耐久额外 -${wear}。`));
      wearTool(s, events, 'rod', wear);
    }
    addXp(s, 'fishing', 1, events);
  } else {
    rollMove(s, act);
  }
  return true;
}
