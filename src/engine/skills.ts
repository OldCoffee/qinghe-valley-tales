import { BASE_HP, HP_PER_COMBAT_LEVEL, SKILL_LEVEL_DISCOUNT, TOOL_LEVEL_DISCOUNT } from '../data/config.js';
import { ITEMS } from '../data/items.js';
import { LEVEL_XP, PROFESSION_LEVELS, PROFESSIONS, SKILL_NAMES } from '../data/skills.js';
import type { GameEvent, GameState, SkillId, ToolId } from './types.js';
import { good, info, round1 } from './util.js';

export function levelFromXp(xp: number): number {
  let level = 0;
  while (level < LEVEL_XP.length && xp >= LEVEL_XP[level]) level++;
  return level;
}

export function skillLevel(s: GameState, skill: SkillId): number {
  return levelFromXp(s.skills[skill]);
}

export interface SkillProgress {
  level: number;
  /** 当前等级内的经验（从本级起点算起） */
  into: number;
  /** 从当前等级升到下一级需要的经验（本级区间长度）；满级为 0 */
  span: number;
  /** 距离下一级还差多少经验；满级为 0 */
  toNext: number;
  isMax: boolean;
}

/** 按「一级一级」计算经验进度：只看当前等级区间，而不是累计总经验 */
export function skillProgress(xp: number): SkillProgress {
  const level = levelFromXp(xp);
  if (level >= LEVEL_XP.length) {
    return { level, into: 0, span: 0, toNext: 0, isMax: true };
  }
  const floor = level === 0 ? 0 : LEVEL_XP[level - 1];
  const next = LEVEL_XP[level];
  return { level, into: xp - floor, span: next - floor, toNext: next - xp, isMax: false };
}

export function skillProgressOf(s: GameState, skill: SkillId): SkillProgress {
  return skillProgress(s.skills[skill]);
}

export function hasProf(s: GameState, id: string): boolean {
  return s.professions.includes(id);
}

export function addXp(s: GameState, skill: SkillId, amount: number, events: GameEvent[]): void {
  const before = skillLevel(s, skill);
  s.skills[skill] += amount;
  const after = skillLevel(s, skill);
  for (let level = before + 1; level <= after; level++) {
    events.push(good(`✨ ${SKILL_NAMES[skill]}技能升到了 ${level} 级！`));
    if (PROFESSION_LEVELS.includes(level)) {
      s.pendingProfessions.push({ skill, level });
      events.push(info('今晚睡觉前可以选择一个职业。'));
    }
  }
}

export function maxHp(s: GameState): number {
  let hp = BASE_HP + skillLevel(s, 'combat') * HP_PER_COMBAT_LEVEL;
  if (hasProf(s, 'fighter')) hp += 15;
  if (hasProf(s, 'defender')) hp += 25;
  return hp;
}

/** 工具等级和技能等级共同降低体力与时间消耗 */
export function scaledCost(
  s: GameState,
  base: { minutes: number; energy: number },
  tool: ToolId | null,
  skill: SkillId,
): { minutes: number; energy: number } {
  const toolFactor = tool ? 1 - TOOL_LEVEL_DISCOUNT * Math.max(0, s.tools[tool]) : 1;
  const skillFactor = 1 - SKILL_LEVEL_DISCOUNT * skillLevel(s, skill);
  return {
    minutes: Math.max(1, Math.round(base.minutes * toolFactor)),
    energy: round1(base.energy * toolFactor * skillFactor),
  };
}

export function sellPrice(s: GameState, itemId: string): number {
  const item = ITEMS[itemId];
  if (!item) return 0;
  let mult = 1;
  if (item.category === 'crop') {
    if (hasProf(s, 'tiller')) mult += 0.1;
    if (hasProf(s, 'expert')) mult += 0.15;
  } else if (item.category === 'forage') {
    if (hasProf(s, 'botanist')) mult += 0.5;
  } else if (item.category === 'fish') {
    if (hasProf(s, 'fisher')) mult += 0.25;
    if (hasProf(s, 'angler')) mult += 0.25;
  } else if (item.category === 'ore' || item.category === 'gem') {
    if (hasProf(s, 'smith')) mult += 0.5;
  }
  return Math.floor(item.sellPrice * mult);
}

export function professionOptions(skill: SkillId, level: number) {
  return PROFESSIONS.filter((p) => p.skill === skill && p.level === level);
}
