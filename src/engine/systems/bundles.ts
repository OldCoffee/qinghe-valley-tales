import { FARM_ROWS } from '../../data/config.js';
import { BUNDLES, ROOMS, type BundleDef, type RoomDef } from '../../data/bundles.js';
import { itemName } from '../../data/items.js';
import { NPCS } from '../../data/npcs.js';
import type { GameEvent, GameState } from '../types.js';
import { addItem, good, info, love, recordCollected, warn } from '../util.js';
import { toolMaxDurability } from './equipment.js';
import { addFriendship } from './social.js';

const CC_LOCATION = 'town';

export function donatedCount(s: GameState, bundleId: string, itemId: string): number {
  return s.bundles[bundleId]?.[itemId] ?? 0;
}

export function bundleDone(s: GameState, bundle: BundleDef): boolean {
  return Object.entries(bundle.needs).every(([id, qty]) => donatedCount(s, bundle.id, id) >= qty);
}

export function roomDone(s: GameState, room: RoomDef): boolean {
  return BUNDLES.filter((b) => b.room === room.id).every((b) => bundleDone(s, b));
}

export function communityCenterDone(s: GameState): boolean {
  return s.unlocks.includes('cc_complete');
}

/** 社区中心还需要的物品 id 列表 */
export function neededItems(s: GameState): string[] {
  const ids = new Set<string>();
  for (const b of BUNDLES) {
    for (const [id, qty] of Object.entries(b.needs)) {
      if (donatedCount(s, b.id, id) < qty) ids.add(id);
    }
  }
  return [...ids];
}

function applyUnlock(s: GameState, unlock: string): void {
  s.unlocks.push(unlock);
  if (unlock === 'greenhouse') {
    for (const row of s.farm.slice(FARM_ROWS)) {
      for (const tile of row) {
        tile.ground = 'tilled';
      }
    }
  }
  if (unlock === 'free_rod') {
    s.tools.rod = Math.max(s.tools.rod, 3);
    if (!s.ownedRods.includes('iridium')) s.ownedRods.push('iridium');
    s.equippedRodId = 'iridium';
    s.equippedTools.rod = true;
    s.durability.rod = toolMaxDurability(3);
    recordCollected(s, 'rod_iridium');
    addItem(s, 'bait_legend', 5);
    recordCollected(s, 'bait_legend');
    if (!s.unlocks.includes('deep_sea_rod_available')) s.unlocks.push('deep_sea_rod_available');
  }
}

function donateItem(s: GameState, itemId: string): number {
  let given = 0;
  for (const bundle of BUNDLES) {
    const need = bundle.needs[itemId];
    if (!need) continue;
    const have = s.inventory[itemId] ?? 0;
    const missing = need - donatedCount(s, bundle.id, itemId);
    const n = Math.min(have, missing);
    if (n <= 0) continue;
    s.bundles[bundle.id] = { ...(s.bundles[bundle.id] ?? {}), [itemId]: donatedCount(s, bundle.id, itemId) + n };
    s.inventory[itemId] = have - n;
    if (s.inventory[itemId] === 0) delete s.inventory[itemId];
    given += n;
  }
  return given;
}

function claimRewards(s: GameState, events: GameEvent[]): void {
  for (const bundle of BUNDLES) {
    if (s.rewardsClaimed.includes(bundle.id) || !bundleDone(s, bundle)) continue;
    s.rewardsClaimed.push(bundle.id);
    const parts: string[] = [];
    if (bundle.reward.gold) {
      s.gold += bundle.reward.gold;
      parts.push(`${bundle.reward.gold} 金`);
    }
    if (bundle.reward.item) {
      addItem(s, ...bundle.reward.item);
      parts.push(`${itemName(bundle.reward.item[0])} ×${bundle.reward.item[1]}`);
    }
    events.push(good(`🎉 完成了${bundle.name}！奖励：${parts.join('、')}。`));
    if (bundle.unlock && !s.unlocks.includes(bundle.unlock)) {
      applyUnlock(s, bundle.unlock);
      events.push(good(`解锁了${bundle.unlockName ?? '自动农具'}！去农场页使用自动农具按钮。`));
    }
  }
  for (const room of ROOMS) {
    if (s.rewardsClaimed.includes(room.id) || !roomDone(s, room)) continue;
    s.rewardsClaimed.push(room.id);
    applyUnlock(s, room.unlock);
    events.push(good(`🏠 社区中心的${room.name}修复了！${room.unlockText}`));
  }
  if (!communityCenterDone(s) && ROOMS.every((room) => roomDone(s, room))) {
    applyUnlock(s, 'cc_complete');
    for (const npc of NPCS) addFriendship(s, npc.id, 100);
    events.push(love('🌟 社区中心完全修复了！镇民们在这里举办了盛大的庆典，每个人都在感谢你。'));
  }
}

export function donate(s: GameState, events: GameEvent[], itemId: string | 'all'): boolean {
  if (s.location !== CC_LOCATION) {
    events.push(warn('社区中心在小镇广场旁边。'));
    return false;
  }
  if (communityCenterDone(s)) {
    events.push(info('社区中心已经完全修复了。'));
    return false;
  }
  const ids = itemId === 'all' ? Object.keys(s.inventory) : [itemId];
  const given: string[] = [];
  for (const id of ids) {
    const n = donateItem(s, id);
    if (n > 0) given.push(`${itemName(id)} ×${n}`);
  }
  if (given.length === 0) {
    events.push(info(itemId === 'all' ? '你身上没有社区中心需要的东西。' : '社区中心目前不需要这个。'));
    return false;
  }
  events.push(good(`捐献了：${given.join('、')}。`));
  claimRewards(s, events);
  return true;
}
