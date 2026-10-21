import { SKILL_NAMES } from '../data/skills.js';
import { professionOptions } from './skills.js';
import type { ActivityView } from './systems/activityView.js';
import { chooseFestival, festivalView } from './systems/festivals.js';
import { chooseFishing, fishingView } from './systems/fishing.js';
import { chooseEvent, eventView } from './systems/social.js';
import type { GameEvent, GameState } from './types.js';
import { good, warn } from './util.js';

export type { ActivityView };

export function activityView(s: GameState): ActivityView | null {
  const act = s.activity;
  if (!act) return null;
  switch (act.kind) {
    case 'fishing':
      return fishingView(act);
    case 'event':
      return eventView(act);
    case 'festival':
      return festivalView(s, act);
    case 'profession':
      return {
        title: `🎓 ${SKILL_NAMES[act.skill]} ${act.level} 级 · 选择职业`,
        lines: ['选择后不能更改。'],
        options: professionOptions(act.skill, act.level).map((p) => `${p.name}：${p.desc}`),
      };
  }
}

/** 如果还有待选职业，打开下一个职业选择 */
export function openNextProfession(s: GameState): void {
  if (s.activity || s.pendingProfessions.length === 0) return;
  const next = s.pendingProfessions.shift()!;
  s.activity = { kind: 'profession', skill: next.skill, level: next.level };
}

export function chooseActivity(s: GameState, index: number, events: GameEvent[]): boolean {
  const act = s.activity;
  if (!act) {
    events.push(warn('现在没有需要选择的事情。'));
    return false;
  }
  let ok: boolean;
  switch (act.kind) {
    case 'fishing':
      ok = chooseFishing(s, act, index, events);
      break;
    case 'event':
      ok = chooseEvent(s, act, index, events);
      break;
    case 'festival':
      ok = chooseFestival(s, act, index, events);
      break;
    case 'profession': {
      const option = professionOptions(act.skill, act.level)[index];
      ok = Boolean(option);
      if (option) {
        s.professions.push(option.id);
        s.activity = null;
        events.push(good(`你成为了「${option.name}」：${option.desc}。`));
        openNextProfession(s);
      }
      break;
    }
  }
  if (!ok) events.push(warn('没有这个选项。'));
  return ok;
}
