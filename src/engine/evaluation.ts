import { MINE_FLOORS } from '../data/config.js';
import { NPCS } from '../data/npcs.js';
import { SKILL_ORDER } from '../data/skills.js';
import { skillLevel } from './skills.js';
import { communityCenterDone } from './systems/bundles.js';
import { heartsOf, spouseId } from './systems/social.js';
import type { Evaluation, GameState } from './types.js';

const EARNING_TIERS = [50_000, 100_000, 200_000, 300_000, 500_000];

export function evaluate(s: GameState): Evaluation {
  const notes: string[] = [];
  let score = 0;
  const add = (points: number, note: string) => {
    if (points <= 0) return;
    score += points;
    notes.push(`${note}（+${points}）`);
  };

  const earnTier = EARNING_TIERS.filter((t) => s.stats.totalEarned >= t).length;
  add(earnTier + (s.stats.totalEarned >= 1_000_000 ? 2 : 0), `累计收入 ${s.stats.totalEarned.toLocaleString()} 金`);

  const totalLevels = SKILL_ORDER.reduce((sum, id) => sum + skillLevel(s, id), 0);
  add((totalLevels >= 30 ? 1 : 0) + (totalLevels >= 50 ? 1 : 0), `技能总等级 ${totalLevels}`);

  const closeFriends = NPCS.filter((npc) => heartsOf(s, npc.id) >= 8).length;
  add((closeFriends >= 3 ? 1 : 0) + (closeFriends >= NPCS.length ? 1 : 0), `${closeFriends} 位镇民好感达到 8 心`);

  if (spouseId(s)) add(1, '组建了家庭');
  if (communityCenterDone(s)) add(3, '修复了社区中心');
  if (s.mine.deepest >= MINE_FLOORS) add(1, '探索到矿洞最底层');
  if (s.stats.fishSpecies.length >= 10) add(1, `钓到 ${s.stats.fishSpecies.length} 种鱼`);

  const candles = score >= 12 ? 4 : score >= 8 ? 3 : score >= 4 ? 2 : 1;
  return { score, candles, notes };
}

export const CANDLE_TEXT: Record<number, string> = {
  1: '"你还年轻，日子还长。"爷爷的灵魂轻声说，"慢慢来。"',
  2: '"你做得不错。"爷爷欣慰地点点头。',
  3: '"我为你骄傲。"爷爷的眼中闪着泪光。',
  4: '"这片土地交给你，是我这辈子最正确的决定。"四根蜡烛同时亮了起来。',
};
