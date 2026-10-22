import { PASS_OUT_PENALTY } from '../data/config.js';
import type { GameEvent, GameState } from './types.js';

export const info = (text: string): GameEvent => ({ level: 'info', text });
export const good = (text: string): GameEvent => ({ level: 'good', text });
export const warn = (text: string): GameEvent => ({ level: 'warn', text });
export const bad = (text: string): GameEvent => ({ level: 'bad', text });
export const love = (text: string): GameEvent => ({ level: 'love', text });

/** 体力等允许小数的数值统一保留一位小数，避免浮点误差累积 */
export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** 图鉴记录: 获得过即入册 (卖掉/用掉不移除); 顺带补齐老存档缺失的 collection 字段 */
export function recordCollected(s: GameState, id: string): void {
  if (!Array.isArray(s.collection)) s.collection = [];
  if (!s.collection.includes(id)) s.collection.push(id);
}

/** 老存档兜底: 用当前背包与已钓物种补齐图鉴收集记录 */
export function ensureCollection(s: GameState): void {
  if (!Array.isArray(s.collection)) s.collection = [];
  for (const id of Object.keys(s.inventory ?? {})) recordCollected(s, id);
  for (const id of s.stats?.fishSpecies ?? []) recordCollected(s, id);
}

export function addItem(s: GameState, id: string, qty: number): void {
  s.inventory[id] = (s.inventory[id] ?? 0) + qty;
  if (qty > 0) recordCollected(s, id);
}

export function removeItem(s: GameState, id: string, qty: number): boolean {
  const have = s.inventory[id] ?? 0;
  if (have < qty) return false;
  if (have === qty) delete s.inventory[id];
  else s.inventory[id] = have - qty;
  return true;
}

/** 昏倒/被打倒的费用：至少 min、按 ratio 收取、最高 max，且不会把金币扣成负数 */
export function passOutFee(gold: number): number {
  if (gold <= 0) return 0;
  const byRatio = Math.ceil(gold * PASS_OUT_PENALTY.ratio);
  return Math.min(gold, Math.min(PASS_OUT_PENALTY.max, Math.max(PASS_OUT_PENALTY.min, byRatio)));
}

export function spend(s: GameState, cost: { minutes: number; energy: number }): void {
  s.minutes += cost.minutes;
  s.energy = round1(s.energy - cost.energy);
}
