import { FOREST } from '../../data/config.js';
import { GROVES, groveById } from '../../data/forest.js';
import { FORAGE } from '../../data/forage.js';
import { itemName } from '../../data/items.js';
import { pick, random } from '../rng.js';
import { addXp, scaledCost } from '../skills.js';
import type { ForestState, GameEvent, GameState, GroveId } from '../types.js';
import { addItem, good, info, spend, warn } from '../util.js';
import { toolUsable, wearTool } from './equipment.js';

export function freshForest(): ForestState {
  return {
    trees: FOREST.treesPerDay,
    groves: { mushroom: true, flowers: true, fruit: true },
    exploredToday: false,
  };
}

/** 给老存档补齐森林状态字段 */
export function ensureForest(s: GameState): void {
  if (!s.forest) {
    s.forest = freshForest();
    return;
  }
  if (typeof s.forest.trees !== 'number') s.forest.trees = FOREST.treesPerDay;
  if (!s.forest.groves) s.forest.groves = { mushroom: true, flowers: true, fruit: true };
  for (const g of GROVES) {
    if (typeof s.forest.groves[g.id] !== 'boolean') s.forest.groves[g.id] = true;
  }
  if (typeof s.forest.exploredToday !== 'boolean') s.forest.exploredToday = false;
}

/** 每天清晨：树木重新长起来，固定采集点刷新，奇遇次数重置 */
export function resetForestDaily(s: GameState): void {
  s.forest = freshForest();
}

function requireForest(s: GameState, events: GameEvent[]): boolean {
  if (s.location !== 'forest') {
    events.push(warn('这里不是青禾森林。'));
    return false;
  }
  ensureForest(s);
  return true;
}

/** 砍一棵树：消耗斧头耐久，得木材（斧头越高级多得 1 块） */
export function chopTree(s: GameState, events: GameEvent[]): boolean {
  if (!requireForest(s, events)) return false;
  const axeProblem = toolUsable(s, 'axe');
  if (axeProblem) {
    events.push(warn(`${axeProblem}。`));
    return false;
  }
  if (s.forest.trees <= 0) {
    events.push(info('今天能砍的树都砍完了，明天再来吧。'));
    return false;
  }
  const cost = scaledCost(s, FOREST.chop, 'axe', 'foraging');
  if (s.energy < cost.energy) {
    events.push(warn('体力不足，抡不动斧头了。'));
    return false;
  }
  spend(s, cost);
  s.forest.trees -= 1;
  const qty = 2 + (random(s) < 0.5 ? 1 : 0) + (s.tools.axe >= 2 ? 1 : 0);
  addItem(s, 'wood', qty);
  events.push(good(`🪓 砍倒一棵树，得到木材 ×${qty}（今天还能砍 ${s.forest.trees} 棵）。`));
  addXp(s, 'foraging', 3, events);
  wearTool(s, events, 'axe');
  return true;
}

/** 固定采集点：蘑菇圈 / 野花丛 / 野果树，每天各能采一次，产出随季节变 */
export function harvestGrove(s: GameState, events: GameEvent[], groveId: GroveId): boolean {
  if (!requireForest(s, events)) return false;
  const def = groveById(groveId);
  if (!s.forest.groves[groveId]) {
    events.push(info(`${def.name}今天已经被采过了，明天再来。`));
    return false;
  }
  const yields = def.yields[s.season];
  if (!yields) {
    events.push(info(def.offSeasonText));
    return false;
  }
  const cost = scaledCost(s, FOREST.grove, null, 'foraging');
  if (s.energy < cost.energy) {
    events.push(warn('体力不足，蹲不下去了。'));
    return false;
  }
  spend(s, cost);
  s.forest.groves[groveId] = false;
  let total = 0;
  const parts: string[] = [];
  for (const [itemId, qty] of yields) {
    addItem(s, itemId, qty);
    total += qty;
    parts.push(`${itemName(itemId)} ×${qty}`);
  }
  s.stats.itemsForaged += total;
  events.push(good(`在${def.name}采到了：${parts.join('、')}。`));
  addXp(s, 'foraging', 5, events);
  return true;
}

/** 林间奇遇：每天可探索一次，随机遇见一件小事 */
export function exploreForest(s: GameState, events: GameEvent[]): boolean {
  if (!requireForest(s, events)) return false;
  if (s.forest.exploredToday) {
    events.push(info('今天已经在林子里逛过了，明天再来探索吧。'));
    return false;
  }
  const cost = scaledCost(s, FOREST.explore, null, 'foraging');
  if (s.energy < cost.energy) {
    events.push(warn('体力不足，没力气往林子深处走了。'));
    return false;
  }
  spend(s, cost);
  s.forest.exploredToday = true;

  const roll = random(s);
  if (roll < 0.25) {
    addItem(s, 'hazelnut', 2);
    events.push(good('🐿 你发现了一个松鼠的储藏洞，里面攒着榛子 ×2，拿走一半，留了一半给它过冬。'));
  } else if (roll < 0.45) {
    const gold = 40 + Math.floor(random(s) * 50);
    s.gold += gold;
    events.push(good(`🪙 老树洞里藏着不知谁放的 ${gold} 金，你收进口袋，替它找了个新主人。`));
  } else if (roll < 0.65) {
    const pool = FORAGE.filter((f) => f.seasons.includes(s.season) && f.locations.includes('forest'));
    const found = pool.length ? pick(s, pool) : null;
    if (found) {
      addItem(s, found.id, 1);
      s.stats.itemsForaged += 1;
      events.push(good(`🐦 你帮一只翅膀受伤的小鸟包扎好，它衔来一个${found.name}放在你手边，像是谢礼。`));
    } else {
      events.push(good('🐦 你帮一只翅膀受伤的小鸟包扎好，它扑棱着翅膀飞回了树梢。'));
    }
  } else if (roll < 0.85) {
    const loss = Math.min(8, Math.max(0, s.hp - 1));
    s.hp -= loss;
    events.push(warn(`🐝 你不小心碰翻了一个蜂巢，被蛰了好几下，生命 -${loss}。`));
  } else {
    const before = s.energy;
    s.energy = Math.min(s.maxEnergy, s.energy + 15);
    events.push(good(`🌿 你在林间空地躺了一会儿，听着鸟叫，体力恢复了 ${Math.round(s.energy - before)} 点。`));
  }
  addXp(s, 'foraging', 5, events);
  return true;
}
