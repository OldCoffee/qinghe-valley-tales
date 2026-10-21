import { CLINIC } from '../../data/config.js';
import { NPC_BY_ID } from '../../data/npcs.js';
import { maxHp } from '../skills.js';
import type { GameEvent, GameState } from '../types.js';
import { good, warn } from '../util.js';
import { npcLocation } from './social.js';

/** 白芷是否在镇上坐诊（按她的日程：晴天 10 点后回镇，雨天整天在镇上） */
export function clinicOpen(s: GameState): boolean {
  const baizhi = NPC_BY_ID['bai_zhi'];
  return !!baizhi && npcLocation(s, baizhi) === 'town';
}

export function clinicCost(s: GameState): { missing: number; cost: number } {
  const missing = Math.max(0, maxHp(s) - s.hp);
  return { missing, cost: missing * CLINIC.goldPerHp };
}

/** 在白鹭镇诊所支付诊金治疗：按缺失生命每点收费，补满生命；金币不够时按能付的量治疗 */
export function healAtClinic(s: GameState, events: GameEvent[]): boolean {
  if (s.location !== 'town') {
    events.push(warn('诊所在白鹭镇，先去镇上吧。'));
    return false;
  }
  if (!clinicOpen(s)) {
    events.push(warn('白芷去森林采药了，还没回诊所（晴天 10 点后、雨天整天都在镇上）。'));
    return false;
  }
  const { missing } = clinicCost(s);
  if (missing <= 0) {
    events.push(warn('白芷给你把了把脉：「你健康得很，不用花这个钱。」'));
    return false;
  }
  const affordable = Math.floor(s.gold / CLINIC.goldPerHp);
  if (affordable <= 0) {
    events.push(warn(`诊金不够：补满需要 ${missing * CLINIC.goldPerHp} 金（每点生命 ${CLINIC.goldPerHp} 金）。`));
    return false;
  }
  const healed = Math.min(missing, affordable);
  const cost = healed * CLINIC.goldPerHp;
  s.gold -= cost;
  s.hp += healed;
  s.minutes += CLINIC.minutes;
  events.push(
    good(
      healed === missing
        ? `白芷给你包扎上药，生命补满了（${s.hp}/${maxHp(s)}），诊金 ${cost} 金。`
        : `金币只够先治一部分：生命 +${healed}（${s.hp}/${maxHp(s)}），诊金 ${cost} 金。`,
    ),
  );
  return true;
}
