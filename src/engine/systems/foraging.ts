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

export function forage(s: GameState, events: GameEvent[]): boolean {
  const found = s.forage[s.location] ?? [];
  if (found.length === 0) {
    events.push(info('这里今天没有可以采集的东西了。'));
    return false;
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
