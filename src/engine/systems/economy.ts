import { BAG_SELL_RATE } from '../../data/config.js';
import { ITEMS, itemName } from '../../data/items.js';
import { WEAPONS } from '../../data/mine.js';
import { SHOPS, type ShopDef } from '../../data/shops.js';
import { shopClosedReason } from '../calendar.js';
import { sellPrice, skillLevel } from '../skills.js';
import { shopUnavailableReason } from './social.js';
import { toolMaxDurability, weaponMaxDurability } from './equipment.js';
import type { GameEvent, GameState, ItemCategory, Quantity } from '../types.js';
import { addItem, good, info, recordCollected, removeItem, warn } from '../util.js';

/** 一键出货时包含的类别；矿石宝石留给升级和收集包，需要单独出货 */
export const SHIP_ALL_CATEGORIES: ItemCategory[] = ['crop', 'forage', 'fish'];

export function shopsAt(s: GameState): ShopDef[] {
  return SHOPS.filter((shop) => shop.location === s.location);
}

export function buy(s: GameState, events: GameEvent[], itemId: string, qty: number): boolean {
  const shops = shopsAt(s);
  if (shops.length === 0) {
    events.push(warn('这里没有商店。'));
    return false;
  }
  const shop = shops.find((sh) => sh.stock(s).some((entry) => entry.itemId === itemId));
  if (!shop) {
    events.push(warn('这里的商店不卖这个。'));
    return false;
  }
  const closed = shopUnavailableReason(s, shop);
  if (closed) {
    events.push(warn(closed));
    return false;
  }
  if (!Number.isInteger(qty) || qty < 1) {
    events.push(warn('购买数量要是正整数。'));
    return false;
  }
  const item = ITEMS[itemId];
  const price = shop.stock(s).find((entry) => entry.itemId === itemId)!.price;
  const single = item.category === 'tool' || item.category === 'weapon';
  const count = single ? 1 : qty;
  const total = price * count;

  if (item.toolGrant) {
    const { tool, level, minFishing = 0 } = item.toolGrant;
    if (s.tools[tool] >= level) {
      events.push(warn('你已经有同样好或更好的鱼竿了。'));
      return false;
    }
    if (skillLevel(s, 'fishing') < minFishing) {
      events.push(warn(`老渔夫摇摇头："钓鱼技能到 ${minFishing} 级再来吧。"`));
      return false;
    }
  }
  if (s.gold < total) {
    events.push(warn(`金币不够：需要 ${total}，你只有 ${s.gold}。`));
    return false;
  }

  s.gold -= total;
  if (item.toolGrant) {
    const tool = item.toolGrant.tool;
    recordCollected(s, item.id);
    s.tools[tool] = item.toolGrant.level;
    s.durability[tool] = toolMaxDurability(item.toolGrant.level);
    s.equippedTools[tool] = true;
    events.push(good(`买下了${item.name}，花费 ${total} 金。`));
  } else if (item.category === 'weapon') {
    addItem(s, item.id, 1);
    s.weapon = item.id;
    s.weaponDurability[item.id] = weaponMaxDurability(item.id);
    const weapon = WEAPONS.find((w) => w.id === item.id)!;
    events.push(good(`买下并装备了${item.name}（伤害 ${weapon.damage[0]}-${weapon.damage[1]}），花费 ${total} 金。旧武器还在背包里。`));
  } else {
    addItem(s, item.id, count);
    events.push(good(`买下 ${item.name} ×${count}，花费 ${total} 金。`));
  }
  return true;
}

function resolveQty(s: GameState, events: GameEvent[], itemId: string, qty: Quantity): number | null {
  const have = s.inventory[itemId] ?? 0;
  if (have === 0) {
    events.push(warn(`你没有${itemName(itemId)}。`));
    return null;
  }
  const n = qty === 'all' ? have : qty;
  if (!Number.isInteger(n) || n < 1) {
    events.push(warn('数量要是正整数。'));
    return null;
  }
  if (n > have) {
    events.push(warn(`${itemName(itemId)}只有 ${have} 个。`));
    return null;
  }
  return n;
}

export function sell(s: GameState, events: GameEvent[], itemId: string, qty: Quantity): boolean {
  const item = ITEMS[itemId];
  if (item?.category === 'weapon' && s.weapon === itemId) {
    events.push(warn('这件武器正装备着，先在背包里卸下再卖。'));
    return false;
  }
  const buyers = shopsAt(s).filter((shop) => item && shop.buys.includes(item.category));
  if (buyers.length === 0) {
    events.push(warn('这里没有商店收这个东西。'));
    return false;
  }
  const shop = buyers.find((sh) => !shopUnavailableReason(s, sh));
  if (!shop) {
    events.push(warn(shopUnavailableReason(s, buyers[0])!));
    return false;
  }
  if (sellPrice(s, itemId) <= 0) {
    events.push(warn(`${shop.name}不收这个。`));
    return false;
  }
  const n = resolveQty(s, events, itemId, qty);
  if (n === null) return false;
  const total = sellPrice(s, itemId) * n;
  removeItem(s, itemId, n);
  s.gold += total;
  s.stats.totalEarned += total;
  events.push(good(`在${shop.name}卖出 ${item.name} ×${n}，获得 ${total} 金。`));
  return true;
}

/** 背包直接出售：不限地点立即卖出，但只按售价八折结算（方便，去商店卖是全价） */
export function sellFromBag(s: GameState, events: GameEvent[], itemId: string, qty: Quantity): boolean {
  const item = ITEMS[itemId];
  if (!item) {
    events.push(warn('没有这种东西。'));
    return false;
  }
  if (item.category === 'weapon' && s.weapon === itemId) {
    events.push(warn('这件武器正装备着，先在背包里卸下再卖。'));
    return false;
  }
  if (item.category === 'tool' || sellPrice(s, itemId) <= 0) {
    events.push(warn('这个不能直接出售。'));
    return false;
  }
  const n = resolveQty(s, events, itemId, qty);
  if (n === null) return false;
  const total = Math.floor(sellPrice(s, itemId) * BAG_SELL_RATE) * n;
  removeItem(s, itemId, n);
  s.gold += total;
  s.stats.totalEarned += total;
  events.push(good(`直接出售 ${item.name} ×${n}，获得 ${total} 金（背包出售八折）。`));
  return true;
}

export function ship(s: GameState, events: GameEvent[], itemId: string | 'all', qty: Quantity): boolean {
  if (s.location !== 'farm') {
    events.push(warn('出货箱在农场里。'));
    return false;
  }
  const entries: [string, number][] = [];
  if (itemId === 'all') {
    for (const [id, have] of Object.entries(s.inventory)) {
      if (SHIP_ALL_CATEGORIES.includes(ITEMS[id]?.category)) entries.push([id, have]);
    }
    if (entries.length === 0) {
      events.push(info('背包里没有可以一键出货的农产品、采集物或鱼。'));
      return false;
    }
  } else {
    if (sellPrice(s, itemId) <= 0) {
      events.push(warn('这个不能出货。'));
      return false;
    }
    const n = resolveQty(s, events, itemId, qty);
    if (n === null) return false;
    entries.push([itemId, n]);
  }

  let value = 0;
  for (const [id, n] of entries) {
    removeItem(s, id, n);
    s.shippingBin[id] = (s.shippingBin[id] ?? 0) + n;
    value += sellPrice(s, id) * n;
  }
  const list = entries.map(([id, n]) => `${itemName(id)} ×${n}`).join('、');
  events.push(good(`放进出货箱：${list}（明早结算约 ${value} 金）。`));
  return true;
}
