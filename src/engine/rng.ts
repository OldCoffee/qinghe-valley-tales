import type { GameState } from './types.js';

/** mulberry32：状态保存在存档里，保证同一存档下的随机结果可复现 */
export function nextRandom(seed: number): [value: number, nextSeed: number] {
  const nextSeed = (seed + 0x6d2b79f5) | 0;
  let t = nextSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, nextSeed >>> 0];
}

export function random(s: GameState): number {
  const [value, next] = nextRandom(s.rngState);
  s.rngState = next;
  return value;
}

export function pick<T>(s: GameState, list: readonly T[]): T {
  return list[Math.floor(random(s) * list.length)];
}
