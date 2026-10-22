import { MAX_WAIT_MINUTES, MIDNIGHT_MINUTES, PASS_OUT_MINUTES } from '../data/config.js';
import { ITEMS } from '../data/items.js';
import { LOCATIONS, travelMinutes } from '../data/world.js';
import { chooseActivity } from './activity.js';
import { ensureEquipment, equipWeapon, repair, setToolEquipped, unequipWeapon } from './systems/equipment.js';
import { endDay } from './day.js';
import { maxHp } from './skills.js';
import { runAutoFarm } from './systems/autofarm.js';
import { donate } from './systems/bundles.js';
import { buy, sell, sellFromBag, ship } from './systems/economy.js';
import { healAtClinic } from './systems/clinic.js';
import { clear, deweed, harvest, plant, till, uproot, water } from './systems/farming.js';
import { joinFestival } from './systems/festivals.js';
import { craftFishingGear, equipFishingBait, equipFishingRod, fishingSpotAccessReason, FISHING_SPOTS, startFishing, unlockWorkbench } from './systems/fishing.js';
import { forage } from './systems/foraging.js';
import { chopTree, ensureForest, exploreForest, harvestGrove } from './systems/forest.js';
import { attack, descend, enterMine, leaveMine, mineRock } from './systems/mine.js';
import { gift, talk } from './systems/social.js';
import { settlePendingUpgrade, upgrade } from './systems/tools.js';
import type { Action, ActionResult, GameEvent, GameState, LocationId } from './types.js';
import { good, info, removeItem, round1, warn } from './util.js';

export function applyAction(prev: GameState, action: Action): ActionResult {
  const events: GameEvent[] = [];
  if (prev.activity && action.type !== 'choose') {
    return { state: prev, events: [warn('先把眼前的事情处理完吧。')], ok: false };
  }

  const s = structuredClone(prev);
  ensureEquipment(s);
  settlePendingUpgrade(s); // 旧存档等待中的升级直接完成，工具不再被卡住
  ensureForest(s);
  const ok = dispatch(s, action, events);
  if (!ok) return { state: prev, events, ok: false };

  if (prev.minutes < MIDNIGHT_MINUTES && s.minutes >= MIDNIGHT_MINUTES && s.minutes < PASS_OUT_MINUTES) {
    events.push(warn('已经过了午夜，凌晨 2 点前再不睡觉就要累倒了！'));
  }
  if (s.minutes >= PASS_OUT_MINUTES) {
    s.activity = null;
    endDay(s, events, true);
  }
  return { state: s, events, ok: true };
}

function dispatch(s: GameState, action: Action, events: GameEvent[]): boolean {
  switch (action.type) {
    case 'till':
      return till(s, events, action.target);
    case 'water':
      return water(s, events, action.target);
    case 'clear':
      return clear(s, events, action.target);
    case 'harvest':
      return harvest(s, events, action.target);
    case 'plant':
      return plant(s, events, action.cropId, action.target);
    case 'deweed':
      return deweed(s, events, action.target);
    case 'uproot':
      return uproot(s, events, action.target, action.onlyWilted ?? false);
    case 'move':
      return move(s, events, action.to);
    case 'buy':
      return buy(s, events, action.itemId, action.qty);
    case 'sell':
      return sell(s, events, action.itemId, action.qty);
    case 'sellBag':
      return sellFromBag(s, events, action.itemId, action.qty);
    case 'heal':
      return healAtClinic(s, events);
    case 'ship':
      return ship(s, events, action.itemId, action.qty);
    case 'eat':
      return eat(s, events, action.itemId);
    case 'wait':
      return wait(s, events, action.minutes);
    case 'sleep':
      return sleep(s, events);
    case 'fish':
      return startFishing(s, events);
    case 'equipRod':
      return equipFishingRod(s, events, action.rodId);
    case 'equipBait':
      return equipFishingBait(s, events, action.baitId);
    case 'craftGear':
      return craftFishingGear(s, events, action.targetId);
    case 'unlockWorkbench':
      return unlockWorkbench(s, events, action.bench);
    case 'forage':
      return forage(s, events, action.index);
    case 'chop':
      return chopTree(s, events);
    case 'grove':
      return harvestGrove(s, events, action.grove);
    case 'forestExplore':
      return exploreForest(s, events);
    case 'talk':
      return talk(s, events, action.npcId);
    case 'gift':
      return gift(s, events, action.npcId, action.itemId);
    case 'enterMine':
      return enterMine(s, events, action.floor);
    case 'mineRock':
      return mineRock(s, events, action.count);
    case 'attack':
      return attack(s, events);
    case 'descend':
      return descend(s, events);
    case 'leaveMine':
      return leaveMine(s, events);
    case 'upgrade':
      return upgrade(s, events, action.tool);
    case 'equipWeapon':
      return equipWeapon(s, events, action.itemId);
    case 'unequipWeapon':
      return unequipWeapon(s, events);
    case 'equipTool':
      return setToolEquipped(s, events, action.tool, true);
    case 'unequipTool':
      return setToolEquipped(s, events, action.tool, false);
    case 'repair':
      return repair(s, events, action.target);
    case 'autoFarm':
      return runAutoFarm(s, events, action.job, action.cropId);
    case 'donate': {
      // 不在小镇时先自动前往白鹭镇广场 (社区中心) 再捐献, 路上耗时与正常移动一致
      if (s.location !== 'town' && !move(s, events, 'town')) return false;
      return donate(s, events, action.itemId);
    }
    case 'festival':
      return joinFestival(s, events);
    case 'choose':
      return chooseActivity(s, action.index, events);
  }
}

export function travelTime(s: GameState, to: LocationId): number {
  const from = s.location === 'mine' ? 'mountain' : s.location;
  const base = travelMinutes(from, to) + (s.location === 'mine' ? 10 : 0);
  return s.unlocks.includes('minecart') ? Math.ceil(base / 2) : base;
}

function move(s: GameState, events: GameEvent[], to: LocationId): boolean {
  if (to === 'mine') {
    events.push(warn('先去山区，再进入矿洞。'));
    return false;
  }
  if (s.location === to) {
    events.push(info(`你已经在${LOCATIONS[to].name}了。`));
    return false;
  }
  if (FISHING_SPOTS.includes(to) && !['forest', 'mountain', 'beach'].includes(to)) {
    const reason = fishingSpotAccessReason(s, to);
    if (reason) {
      events.push(warn(`${LOCATIONS[to].name}尚未开放：${reason}。`));
      return false;
    }
  }
  const minutes = travelTime(s, to);
  s.mine.floor = 0;
  s.location = to;
  s.minutes += minutes;
  events.push(info(`${LOCATIONS[to].arrival}（路上花了 ${minutes} 分钟）`));
  return true;
}

function eat(s: GameState, events: GameEvent[], itemId: string): boolean {
  const item = ITEMS[itemId];
  if (!item?.energy) {
    events.push(warn('这个不能吃。'));
    return false;
  }
  if (!s.inventory[itemId]) {
    events.push(warn(`你没有${item.name}。`));
    return false;
  }
  const hpMax = maxHp(s);
  if (s.energy >= s.maxEnergy && s.hp >= hpMax) {
    events.push(info('你现在精神饱满，不需要吃东西。'));
    return false;
  }
  removeItem(s, itemId, 1);
  const gained = Math.min(item.energy, s.maxEnergy - s.energy);
  const healed = Math.min(Math.floor(item.energy * 0.45), hpMax - s.hp);
  s.energy = round1(s.energy + gained);
  s.hp += healed;
  const hpPart = healed > 0 ? `，生命 +${healed}` : '';
  events.push(good(`吃了一个${item.name}，体力 +${Math.round(gained)}${hpPart}。`));
  return true;
}

function wait(s: GameState, events: GameEvent[], minutes: number): boolean {
  if (!Number.isInteger(minutes) || minutes < 10 || minutes > MAX_WAIT_MINUTES || minutes % 10 !== 0) {
    events.push(warn(`等待时间要是 10 到 ${MAX_WAIT_MINUTES} 之间的整十分钟。`));
    return false;
  }
  s.minutes += minutes;
  events.push(info(`你找了个地方坐下歇了 ${minutes} 分钟。`));
  return true;
}

function sleep(s: GameState, events: GameEvent[]): boolean {
  if (s.location !== 'farm') {
    events.push(warn('先回农场的家里才能睡觉。'));
    return false;
  }
  events.push(info('你钻进被窝，很快就睡着了。'));
  endDay(s, events, false);
  return true;
}
