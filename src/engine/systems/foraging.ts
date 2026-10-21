import { FORAGE_MINUTES } from '../../data/config.js';
import { FORAGE, FORAGE_SPAWN } from '../../data/forage.js';
import { itemName } from '../../data/items.js';
import { pick, random } from '../rng.js';
import { addXp, hasProf } from '../skills.js';
import type { GameEvent, GameState, LocationId } from '../types.js';
import { addItem, good, info } from '../util.js';

const FORAGE_XP = 7;

export function spawnForage(s: GameState): void {
  s.forage = {};
  for (const [loc, [min, max]] of Object.entries(FORAGE_SPAWN) as [LocationId, [number, number]][]) {
    const pool = FORAGE.filter((f) => f.seasons.includes(s.season) && f.locations.includes(loc));
    if (pool.length === 0) continue;
    const count = min + Math.floor(random(s) * (max - min + 1)) + (hasProf(s, 'keen_eye') ? 1 : 0);
    s.forage[loc] = Array.from({ length: count }, () => pick(s, pool).id);
  }
}

export function forage(s: GameState, events: GameEvent[], index?: number): boolean {
  const found = s.forage[s.location] ?? [];
  if (found.length === 0) {
    events.push(info('这里今天没有可以采集的东西了。'));
    return false;
  }
  // 逐个拾取：只结算指定下标的一件，其余仍留在原地
  if (index !== undefined) {
    if (!Number.isInteger(index) || index < 0 || index >= found.length) {
      events.push(info('那处草丛里什么也没有。'));
      return false;
    }
    const [id] = found.splice(index, 1);
    s.forage[s.location] = found;
    const qty = hasProf(s, 'gatherer') && random(s) < 0.2 ? 2 : 1;
    addItem(s, id, qty);
    s.stats.itemsForaged += qty;
    const minutes = hasProf(s, 'tracker') ? 0 : FORAGE_MINUTES;
    s.minutes += minutes;
    events.push(good(`采集到：${itemName(id)} ×${qty}（耗时 ${minutes} 分钟）。`));
    addXp(s, 'foraging', FORAGE_XP, events);
    return true;
  }
  const collected: Record<string, number> = {};
  for (const id of found) {
    const qty = hasProf(s, 'gatherer') && random(s) < 0.2 ? 2 : 1;
    addItem(s, id, qty);
    collected[id] = (collected[id] ?? 0) + qty;
    s.stats.itemsForaged += qty;
  }
  const minutes = hasProf(s, 'tracker') ? 0 : FORAGE_MINUTES * found.length;
  s.minutes += minutes;
  s.forage[s.location] = [];
  const list = Object.entries(collected)
    .map(([id, n]) => `${itemName(id)} ×${n}`)
    .join('、');
  events.push(good(`采集到：${list}（耗时 ${minutes} 分钟）。`));
  addXp(s, 'foraging', FORAGE_XP * found.length, events);
  return true;
}
