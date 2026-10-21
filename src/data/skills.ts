import type { SkillId } from '../engine/types.js';

export const SKILL_NAMES: Record<SkillId, string> = {
  farming: '耕种',
  foraging: '采集',
  fishing: '钓鱼',
  mining: '采矿',
  combat: '战斗',
};

export const SKILL_ORDER: SkillId[] = ['farming', 'foraging', 'fishing', 'mining', 'combat'];

/** 到达第 n+1 级所需的累计经验 */
export const LEVEL_XP = [100, 380, 770, 1300, 2150, 3300, 4800, 6900, 10000, 15000];
export const PROFESSION_LEVELS = [5, 10];

export interface ProfessionDef {
  id: string;
  skill: SkillId;
  level: number;
  name: string;
  desc: string;
}

export const PROFESSIONS: ProfessionDef[] = [
  { id: 'tiller', skill: 'farming', level: 5, name: '农夫', desc: '作物售价 +10%' },
  { id: 'diligent', skill: 'farming', level: 5, name: '勤劳', desc: '开垦、浇水的体力消耗减半' },
  { id: 'expert', skill: 'farming', level: 10, name: '农艺大师', desc: '作物售价再 +15%' },
  { id: 'bountiful', skill: 'farming', level: 10, name: '丰收', desc: '收获时 20% 几率多得一个' },
  { id: 'gatherer', skill: 'foraging', level: 5, name: '采集者', desc: '采集时 20% 几率双倍' },
  { id: 'keen_eye', skill: 'foraging', level: 5, name: '慧眼', desc: '每个地点每天多刷新 1 个采集物' },
  { id: 'botanist', skill: 'foraging', level: 10, name: '植物学家', desc: '采集物售价 +50%' },
  { id: 'tracker', skill: 'foraging', level: 10, name: '追踪者', desc: '采集不消耗时间' },
  { id: 'fisher', skill: 'fishing', level: 5, name: '渔夫', desc: '鱼类售价 +25%' },
  { id: 'steady', skill: 'fishing', level: 5, name: '稳手', desc: '拉锯时张力增长 -30%' },
  { id: 'angler', skill: 'fishing', level: 10, name: '垂钓大师', desc: '鱼类售价再 +25%' },
  { id: 'lucky_lure', skill: 'fishing', level: 10, name: '幸运饵', desc: '不会钓到垃圾，稀有鱼更容易上钩' },
  { id: 'miner', skill: 'mining', level: 5, name: '矿工', desc: '敲出矿石时多得 1 个' },
  { id: 'geologist', skill: 'mining', level: 5, name: '地质学家', desc: '宝石几率翻倍' },
  { id: 'smith', skill: 'mining', level: 10, name: '冶金师', desc: '矿石、宝石售价 +50%' },
  { id: 'prospector', skill: 'mining', level: 10, name: '勘探者', desc: '找到梯子的几率翻倍' },
  { id: 'fighter', skill: 'combat', level: 5, name: '斗士', desc: '伤害 +10%，生命上限 +15' },
  { id: 'scout', skill: 'combat', level: 5, name: '侦察兵', desc: '暴击率 +15%' },
  { id: 'brute', skill: 'combat', level: 10, name: '蛮力', desc: '伤害再 +15%' },
  { id: 'defender', skill: 'combat', level: 10, name: '守护者', desc: '生命上限 +25，受到的伤害 -20%' },
];

export const TOOL_NAMES = { hoe: '锄头', can: '水壶', pickaxe: '镐子', rod: '鱼竿', axe: '斧头' } as const;
export const TOOL_LEVEL_NAMES = ['普通', '铜', '钢', '金'];
