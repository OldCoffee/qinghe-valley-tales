import { CROPS } from '../../data/crops.js';
import { itemName, seedIdOf } from '../../data/items.js';
import { allCells, tileAt } from '../farm.js';
import type { GameEvent, GameState } from '../types.js';
import { addItem, good, info, removeItem, warn } from '../util.js';
import { clear, deweed, harvest, plant, till, uproot, water } from './farming.js';

export type AutoFarmJob = 'clear' | 'plant' | 'harvest';

export const AUTO_JOB_UNLOCK: Record<AutoFarmJob, string> = {
  clear: 'auto_clear',
  plant: 'auto_plant',
  harvest: 'auto_harvest',
};

export const AUTO_JOB_NAME: Record<AutoFarmJob, string> = {
  clear: '自动整地机',
  plant: '自动播种机',
  harvest: '自动收获机',
};

export const AUTO_JOB_ROOM: Record<AutoFarmJob, string> = {
  clear: '整地工坊',
  plant: '播种工坊',
  harvest: '收获工坊',
};

export const AUTO_JOB_DAILY_UNLOCK: Record<AutoFarmJob, string> = {
  clear: 'auto_clear_daily',
  plant: 'auto_plant_daily',
  harvest: 'auto_harvest_daily',
};

/** 一键自动农具: 复用现有地块操作 (按格扣体力/时间), 需要先在社区中心自动工坊解锁 */
export function runAutoFarm(s: GameState, events: GameEvent[], job: AutoFarmJob, cropId?: string): boolean {
  if (!s.unlocks.includes(AUTO_JOB_UNLOCK[job])) {
    events.push(warn(`还没有${AUTO_JOB_NAME[job]}。去社区中心${AUTO_JOB_ROOM[job]}完成收集包来解锁。`));
    return false;
  }
  if (s.location !== 'farm') {
    events.push(warn('自动农具只能在农场使用。'));
    return false;
  }
  let done = false;
  if (job === 'clear') {
    if (clear(s, events, 'all')) done = true;
    if (deweed(s, events, 'all')) done = true;
    if (uproot(s, events, 'all', true)) done = true;
    if (till(s, events, 'all')) done = true;
  } else if (job === 'plant') {
    if (!cropId || !CROPS[cropId]) {
      events.push(warn('先选择要播种的种子。'));
      return false;
    }
    if (till(s, events, 'all')) done = true;
    if (plant(s, events, cropId, 'all')) done = true;
    if (water(s, events, 'all')) done = true;
  } else {
    if (deweed(s, events, 'all')) done = true;
    if (harvest(s, events, 'all')) done = true;
  }
  return done;
}

/**
 * 每日自动 (早晨执行): 每台机器集齐自己房间的进阶包后单独生效, 依次铲枯萎→清理→除草→收获→开垦→补种→浇水。
 * 不消耗体力与时间, 只推一条汇总事件。
 */
export function runDailyAutoFarm(s: GameState, events: GameEvent[]): void {
  const has = (job: AutoFarmJob) => s.unlocks.includes(AUTO_JOB_DAILY_UNLOCK[job]);
  if (!has('clear') && !has('plant') && !has('harvest')) return;
  let uprooted = 0;
  let cleared = 0;
  let deweeded = 0;
  let harvested = 0;
  let tilled = 0;
  let planted = 0;
  let watered = 0;
  const harvestedNames: string[] = [];

  const cells = allCells();
  if (has('harvest')) {
    for (const c of cells) {
      const t = tileAt(s, c);
      if (t.crop?.wilted) {
        t.crop = null;
        t.weeds = false;
        uprooted += 1;
      }
    }
  }
  if (has('clear')) {
    for (const c of cells) {
      const t = tileAt(s, c);
      if (t.ground === 'weed' || t.ground === 'stone') {
        t.ground = 'grass';
        cleared += 1;
      }
    }
  }
  if (has('harvest')) {
    for (const c of cells) {
      const t = tileAt(s, c);
      if (t.ground === 'tilled' && t.weeds) {
        t.weeds = false;
        deweeded += 1;
      }
    }
    for (const c of cells) {
      const t = tileAt(s, c);
      if (!t.crop || t.crop.wilted) continue;
      const def = CROPS[t.crop.cropId];
      if (t.crop.age < def.growDays) continue;
      addItem(s, def.id, 1);
      s.stats.cropsHarvested += 1;
      harvested += 1;
      if (!harvestedNames.includes(def.name)) harvestedNames.push(def.name);
      if (def.regrowDays) t.crop.age = def.growDays - def.regrowDays;
      else t.crop = null;
    }
  }
  if (has('clear')) {
    for (const c of cells) {
      const t = tileAt(s, c);
      if (t.ground === 'grass') {
        t.ground = 'tilled';
        tilled += 1;
      }
    }
  }
  const plantCropId = s.autoPlantCropId;
  if (has('plant') && plantCropId && CROPS[plantCropId]) {
    const def = CROPS[plantCropId];
    const seedId = seedIdOf(plantCropId);
    for (const c of cells) {
      const t = tileAt(s, c);
      if (t.ground !== 'tilled' || t.crop || t.weeds) continue;
      if (!def.seasons.includes(s.season) && !t.greenhouse) continue;
      if (!(s.inventory[seedId] > 0)) break;
      removeItem(s, seedId, 1);
      t.crop = { cropId: plantCropId, age: 0, dryDays: 0, wilted: false };
      planted += 1;
    }
  }
  if (has('plant')) {
    for (const c of cells) {
      const t = tileAt(s, c);
      if (t.ground === 'tilled' && t.crop && !t.watered) {
        t.watered = true;
        watered += 1;
      }
    }
  }

  const parts: string[] = [];
  if (uprooted) parts.push(`铲除枯萎 ${uprooted} 株`);
  if (cleared) parts.push(`清理 ${cleared} 格`);
  if (deweeded) parts.push(`除草 ${deweeded} 格`);
  if (harvested) parts.push(`收获 ${harvested} 件（${harvestedNames.join('、')}）`);
  if (tilled) parts.push(`开垦 ${tilled} 格`);
  if (planted && plantCropId) parts.push(`播种${CROPS[plantCropId].name} ${planted} 格`);
  if (watered) parts.push(`浇水 ${watered} 格`);
  if (parts.length) events.push(good(`自动农具完成了：${parts.join('、')}。`));
  if (has('plant') && !plantCropId) {
    events.push(info('自动农具：还没有设定每日自动播种的种子（在农场页选择一键播种种子即可），今天跳过播种。'));
  } else if (has('plant') && plantCropId && CROPS[plantCropId] && planted === 0 && (s.inventory[seedIdOf(plantCropId)] ?? 0) === 0) {
    // 有空地待种但种子用完时才提示, 避免无事时刷屏: 以是否还有已开垦空地粗略判断
    const hasEmpty = cells.some((c) => {
      const t = tileAt(s, c);
      return t.ground === 'tilled' && !t.crop;
    });
    if (hasEmpty) events.push(info(`自动农具：${itemName(seedIdOf(plantCropId))}用完了，今天没有补种。`));
  }
}
