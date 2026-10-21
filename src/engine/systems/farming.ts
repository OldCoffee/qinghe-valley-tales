import { PASS_OUT_MINUTES, TILE_COSTS } from '../../data/config.js';
import { CROPS } from '../../data/crops.js';
import { itemName, seedIdOf } from '../../data/items.js';
import { TOOL_NAMES } from '../../data/skills.js';
import { SEASON_NAMES } from '../../data/world.js';
import { allCells, cellName, tileAt } from '../farm.js';
import { addXp, hasProf, scaledCost } from '../skills.js';
import { random } from '../rng.js';
import type { GameEvent, GameState, Target, Tile, ToolId } from '../types.js';
import { addItem, good, info, removeItem, spend, warn } from '../util.js';
import { toolUsable, wearTool } from './equipment.js';

interface Cost {
  minutes: number;
  energy: number;
}

interface TileOp {
  verb: string;
  /** 返回不能操作的原因；可以操作时返回 null */
  check(tile: Tile): string | null;
  cost(tile: Tile): Cost;
  apply(tile: Tile): void;
  /** 本次操作磨损的工具；戴久了会报废 */
  toolFor?(tile: Tile): ToolId | null;
  /** 资源耗尽等需要提前停下的原因 */
  blocker?(): string | null;
  summary?(): string;
}

const MAX_SKIP_REASONS = 5;
const LOCKED_REASON = '温室还没修好';

function toolBusy(s: GameState, tool: ToolId): string | null {
  return toolUsable(s, tool);
}

function runTileOp(s: GameState, events: GameEvent[], target: Target, op: TileOp): boolean {
  if (s.location !== 'farm') {
    events.push(warn(`${op.verb}只能在农场进行。`));
    return false;
  }

  const cells = target === 'all' ? allCells().filter((c) => op.check(tileAt(s, c)) === null) : target;
  if (cells.length === 0) {
    events.push(info(`没有可以${op.verb}的格子。`));
    return false;
  }

  const skipped: string[] = [];
  let done = 0;
  let minutes = 0;
  let energy = 0;
  let stopReason: string | null = null;

  for (const cell of cells) {
    const tile = tileAt(s, cell);
    const reason = op.check(tile);
    if (reason) {
      skipped.push(`${cellName(cell)} ${reason}`);
      continue;
    }
    const blocked = op.blocker?.();
    if (blocked) {
      stopReason = blocked;
      break;
    }
    const cost = op.cost(tile);
    if (s.energy < cost.energy) {
      stopReason = '体力不足了，先吃点东西或者回家睡觉吧。';
      break;
    }
    if (s.minutes >= PASS_OUT_MINUTES) break;

    const wornTool = op.toolFor?.(tile);
    op.apply(tile);
    spend(s, cost);
    done += 1;
    minutes += cost.minutes;
    energy += cost.energy;
    if (wornTool && wearTool(s, events, wornTool)) {
      stopReason = '工具坏了，先去修或者买新的吧。';
      break;
    }
  }

  if (skipped.length > 0 && done > 0) {
    events.push(info(`另有 ${skipped.length} 格不需要${op.verb}，已跳过。`));
  } else if (skipped.length > 0) {
    const shown = skipped.slice(0, MAX_SKIP_REASONS).join('；');
    const more = skipped.length > MAX_SKIP_REASONS ? ` 等 ${skipped.length} 格` : '';
    events.push(warn(`没法${op.verb}：${shown}${more}`));
  }
  if (done > 0) {
    const energyPart = energy > 0 ? `，体力 -${Math.round(energy * 10) / 10}` : '';
    const extra = op.summary ? op.summary() : '';
    events.push(good(`${op.verb}了 ${done} 格${extra}，耗时 ${minutes} 分钟${energyPart}。`));
  }
  if (stopReason) events.push(warn(stopReason));
  return done > 0;
}

function diligent(s: GameState, cost: Cost): Cost {
  return hasProf(s, 'diligent') ? { ...cost, energy: cost.energy / 2 } : cost;
}

export function till(s: GameState, events: GameEvent[], target: Target): boolean {
  const busy = toolBusy(s, 'hoe');
  if (busy) {
    events.push(warn(`${busy}。`));
    return false;
  }
  return runTileOp(s, events, target, {
    verb: '开垦',
    check: (tile) => {
      if (tile.ground === 'locked') return LOCKED_REASON;
      if (tile.ground === 'weed') return '有杂草，先清理';
      if (tile.ground === 'stone') return '有石头，先清理';
      if (tile.ground === 'tilled') return '已经开垦过了';
      return null;
    },
    cost: () => diligent(s, scaledCost(s, TILE_COSTS.till, 'hoe', 'farming')),
    apply: (tile) => {
      tile.ground = 'tilled';
    },
    toolFor: () => 'hoe',
  });
}

export function water(s: GameState, events: GameEvent[], target: Target): boolean {
  const busy = toolBusy(s, 'can');
  if (busy) {
    events.push(warn(`${busy}。`));
    return false;
  }
  return runTileOp(s, events, target, {
    verb: '浇水',
    check: (tile) => {
      if (tile.ground === 'locked') return LOCKED_REASON;
      if (tile.ground !== 'tilled') return '还没开垦';
      if (!tile.crop) return '还没种东西，有作物了才能浇水';
      if (tile.watered) return '已经浇过水了';
      return null;
    },
    cost: () => diligent(s, scaledCost(s, TILE_COSTS.water, 'can', 'farming')),
    apply: (tile) => {
      tile.watered = true;
    },
    toolFor: () => 'can',
  });
}

export function clear(s: GameState, events: GameEvent[], target: Target): boolean {
  const pickaxeBusy = toolBusy(s, 'pickaxe');
  return runTileOp(s, events, target, {
    verb: '清理',
    check: (tile) => {
      if (tile.ground === 'stone' && pickaxeBusy) return pickaxeBusy;
      return tile.ground === 'weed' || tile.ground === 'stone' ? null : '没有需要清理的东西';
    },
    cost: (tile) =>
      tile.ground === 'stone'
        ? scaledCost(s, TILE_COSTS.clearStone, 'pickaxe', 'mining')
        : scaledCost(s, TILE_COSTS.clearWeed, null, 'foraging'),
    toolFor: (tile) => (tile.ground === 'stone' ? 'pickaxe' : null),
    apply: (tile) => {
      tile.ground = 'grass';
    },
  });
}

/** 除草：清掉已开垦地块上的杂草，保留作物与土地 */
export function deweed(s: GameState, events: GameEvent[], target: Target): boolean {
  return runTileOp(s, events, target, {
    verb: '除草',
    check: (tile) => {
      if (tile.ground === 'locked') return LOCKED_REASON;
      if (tile.ground !== 'tilled') return '还没开垦，没有杂草可除';
      return tile.weeds ? null : '没有杂草';
    },
    cost: () => TILE_COSTS.deweed,
    apply: (tile) => {
      tile.weeds = false;
    },
  });
}

/** 铲除：把作物整株铲掉（不返种子、不产出），土地保持已开垦，杂草一并清除；onlyWilted 时只铲枯萎株 */
export function uproot(s: GameState, events: GameEvent[], target: Target, onlyWilted = false): boolean {
  return runTileOp(s, events, target, {
    verb: '铲除',
    check: (tile) => {
      if (!tile.crop) return '没有作物可铲';
      if (onlyWilted && !tile.crop.wilted) return '还没枯萎';
      return null;
    },
    cost: () => TILE_COSTS.uproot,
    apply: (tile) => {
      tile.crop = null;
      tile.weeds = false;
    },
  });
}

export function harvest(s: GameState, events: GameEvent[], target: Target): boolean {
  const harvested: Record<string, number> = {};
  /** 带草收获减半计数：同一轮里每两株带草作物出一份产出 */
  const weedySeen: Record<string, number> = {};
  let weedyShortfall = 0;
  return runTileOp(s, events, target, {
    verb: '收获',
    check: (tile) => {
      if (!tile.crop) return '没有作物';
      if (tile.crop.wilted) return '已枯萎，没有产出，先铲除';
      const left = CROPS[tile.crop.cropId].growDays - tile.crop.age;
      return left > 0 ? `还要 ${left} 天` : null;
    },
    cost: () => TILE_COSTS.harvest,
    apply: (tile) => {
      const crop = tile.crop!;
      const def = CROPS[crop.cropId];
      let qty = hasProf(s, 'bountiful') && random(s) < 0.2 ? 2 : 1;
      if (tile.weeds) {
        // 有杂草时最终收获减半：每两株带草作物出一份
        weedySeen[def.id] = (weedySeen[def.id] ?? 0) + 1;
        qty = weedySeen[def.id] % 2 === 0 ? qty : 0;
        if (qty === 0) weedyShortfall += 1;
      }
      if (qty > 0) {
        addItem(s, def.id, qty);
        harvested[def.id] = (harvested[def.id] ?? 0) + qty;
        s.stats.cropsHarvested += qty;
      }
      addXp(s, 'farming', Math.max(2, Math.round(def.sellPrice * 0.12)), events);
      if (def.regrowDays) crop.age = def.growDays - def.regrowDays;
      else tile.crop = null;
    },
    summary: () => {
      const list = Object.entries(harvested)
        .map(([id, n]) => `${itemName(id)} ×${n}`)
        .join('、');
      const short = weedyShortfall > 0 ? `（${weedyShortfall} 株被杂草抢了养分，没有产出）` : '';
      return (list ? `：${list}` : '：没有产出') + short;
    },
  });
}

export function plant(s: GameState, events: GameEvent[], cropId: string, target: Target): boolean {
  const def = CROPS[cropId];
  if (!def) {
    events.push(warn('没有这种作物。'));
    return false;
  }
  const seedId = seedIdOf(cropId);
  const seedName = itemName(seedId);
  const inSeason = def.seasons.includes(s.season);
  if (!inSeason && !s.unlocks.includes('greenhouse')) {
    events.push(warn(`${def.name}不能在${SEASON_NAMES[s.season]}季种植。`));
    return false;
  }
  if (!s.inventory[seedId]) {
    events.push(warn(`你没有${seedName}，去杂货铺买一些吧。`));
    return false;
  }
  return runTileOp(s, events, target, {
    verb: `播种${def.name}`,
    check: (tile) => {
      if (tile.ground === 'locked') return LOCKED_REASON;
      if (tile.ground !== 'tilled') return '还没开垦';
      if (tile.crop) return '已经种了东西';
      if (tile.weeds) return '有杂草，先除草';
      if (!inSeason && !tile.greenhouse) return '不是当季，只能种在温室';
      return null;
    },
    cost: () => TILE_COSTS.plant,
    apply: (tile) => {
      removeItem(s, seedId, 1);
      tile.crop = { cropId, age: 0, dryDays: 0, wilted: false };
    },
    blocker: () => (s.inventory[seedId] ? null : `${seedName}用完了。`),
  });
}
