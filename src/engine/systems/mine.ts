import {
  BASE_CRIT_CHANCE,
  MINE_COSTS,
  MINE_FLOORS,
  MONSTER_HIT_CHANCE,
  MONSTERS_ATTACKING,
  PASS_OUT_MINUTES,
} from '../../data/config.js';
import { itemName } from '../../data/items.js';
import { ELEVATOR_STEP, GEMS, MINE_CHESTS, MONSTERS, ORES, WEAPONS, type MonsterDef } from '../../data/mine.js';
import { TOOL_NAMES } from '../../data/skills.js';
import { pick, random } from '../rng.js';
import { addXp, hasProf, maxHp, scaledCost, skillLevel } from '../skills.js';
import type { GameEvent, GameState, Quantity } from '../types.js';
import { addItem, bad, good, info, passOutFee, spend, warn } from '../util.js';
import { toolUsable, weaponMaxDurability, wearTool, wearWeapon } from './equipment.js';

const monsterDef = (id: string): MonsterDef => MONSTERS.find((m) => m.id === id)!;
const inRange = (floor: number, [lo, hi]: [number, number]) => floor >= lo && floor <= hi;
const randInt = (s: GameState, lo: number, hi: number) => lo + Math.floor(random(s) * (hi - lo + 1));

export function elevatorFloors(s: GameState): number[] {
  const floors: number[] = [];
  for (let f = ELEVATOR_STEP; f <= s.mine.deepest; f += ELEVATOR_STEP) floors.push(f);
  return floors;
}

export function weaponDamage(s: GameState): [number, number] {
  return WEAPONS.find((w) => w.id === s.weapon)!.damage;
}

function requireMine(s: GameState, events: GameEvent[]): boolean {
  if (s.location !== 'mine' || s.mine.floor === 0) {
    events.push(warn('你不在矿洞里。'));
    return false;
  }
  return true;
}

function generateFloor(s: GameState, floor: number, events: GameEvent[]): void {
  const mine = s.mine;
  const firstVisit = floor > mine.deepest;
  mine.floor = floor;
  mine.deepest = Math.max(mine.deepest, floor);
  const safe = floor % ELEVATOR_STEP === 0;
  mine.rocks = safe ? 3 : randInt(s, 6, 12);
  mine.ladder = safe && floor < MINE_FLOORS;
  mine.monsters = [];
  if (!safe) {
    const pool = MONSTERS.filter((m) => inRange(floor, m.floors));
    const count = randInt(s, 0, floor > 30 ? 4 : 3);
    for (let i = 0; i < count && pool.length > 0; i++) {
      const def = pick(s, pool);
      mine.monsters.push({ id: def.id, hp: Math.round(def.hp * (1 + floor / 100)) });
    }
  }

  events.push(info(`—— 矿洞第 ${floor} 层 ——`));
  if (safe) events.push(info('这是一层安全的休息区，以后可以坐电梯直达。'));

  const chest = MINE_CHESTS[floor];
  if (chest && !mine.chestsOpened.includes(floor)) {
    mine.chestsOpened.push(floor);
    const parts: string[] = [];
    if (chest.gold) {
      s.gold += chest.gold;
      parts.push(`${chest.gold} 金`);
    }
    if (chest.item) {
      addItem(s, chest.item[0], chest.item[1]);
      parts.push(`${itemName(chest.item[0])} ×${chest.item[1]}`);
    }
    if (chest.weapon) {
      const weapon = WEAPONS.find((w) => w.id === chest.weapon)!;
      addItem(s, weapon.id, 1);
      s.weaponDurability[weapon.id] = weaponMaxDurability(weapon.id);
      if (weapon.damage[1] > weaponDamage(s)[1]) {
        s.weapon = weapon.id;
        parts.push(`${weapon.name}（已装备）`);
      } else {
        parts.push(`${weapon.name}（收进了背包）`);
      }
    }
    events.push(good(`🎁 你发现了一个宝箱：${parts.join('、')}！`));
  }
  if (floor === MINE_FLOORS && firstVisit) {
    events.push(good('⛏ 你到达了矿洞的最底层！'));
  }
}

export function describeFloor(s: GameState): string[] {
  const mine = s.mine;
  const lines = [`石头 ${mine.rocks} 块`];
  if (mine.monsters.length > 0) {
    lines.push('怪物：' + mine.monsters.map((m) => `${monsterDef(m.id).name}(${m.hp})`).join('、'));
  }
  if (mine.ladder) lines.push('梯子：已找到');
  else if (mine.floor >= MINE_FLOORS) lines.push('这里是最底层');
  return lines;
}

export function enterMine(s: GameState, events: GameEvent[], floor?: number): boolean {
  if (s.location !== 'mountain') {
    events.push(warn('矿洞入口在山区。'));
    return false;
  }
  const elevator = elevatorFloors(s);
  const target = floor ?? (elevator.length > 0 ? elevator[elevator.length - 1] : 1);
  if (target !== 1 && !elevator.includes(target)) {
    const options = [1, ...elevator].join('、');
    events.push(warn(`电梯只能到这些楼层：${options}。`));
    return false;
  }
  s.location = 'mine';
  s.minutes += 10;
  generateFloor(s, target, events);
  return true;
}

export function leaveMine(s: GameState, events: GameEvent[]): boolean {
  if (!requireMine(s, events)) return false;
  s.mine.floor = 0;
  s.location = 'mountain';
  s.minutes += 10;
  events.push(info('你坐电梯回到了地面，山风吹在脸上很舒服。'));
  return true;
}

function knockOut(s: GameState, events: GameEvent[]): void {
  const lost = passOutFee(s.gold);
  s.gold -= lost;
  s.hp = Math.floor(maxHp(s) / 2);
  s.mine.floor = 0;
  s.location = 'town';
  s.minutes = Math.min(PASS_OUT_MINUTES - 10, s.minutes + 120);
  events.push(bad(`你眼前一黑，倒在了矿洞里……醒来时已经躺在镇上的诊所。白芷帮你包扎好了伤口，诊费 ${lost} 金。`));
}

/** 怪物反击；返回 false 表示玩家被打倒 */
function monstersAttack(s: GameState, events: GameEvent[], factor: number): boolean {
  const hits: string[] = [];
  for (const m of s.mine.monsters.slice(0, MONSTERS_ATTACKING)) {
    if (random(s) >= MONSTER_HIT_CHANCE * factor) continue;
    const def = monsterDef(m.id);
    const damage = Math.max(1, Math.round(def.damage * (1 + s.mine.floor / 100) * (hasProf(s, 'defender') ? 0.8 : 1)));
    s.hp -= damage;
    hits.push(`${def.name}攻击了你（-${damage} 生命）`);
  }
  if (hits.length > 0) events.push(warn(hits.join('；') + '。'));
  if (s.hp <= 0) {
    knockOut(s, events);
    return false;
  }
  return true;
}

export function mineRock(s: GameState, events: GameEvent[], count: Quantity): boolean {
  if (!requireMine(s, events)) return false;
  const pickaxeProblem = toolUsable(s, 'pickaxe');
  if (pickaxeProblem) {
    events.push(warn(`${pickaxeProblem}。`));
    return false;
  }
  const mine = s.mine;
  if (mine.rocks === 0) {
    events.push(info('这一层的石头都敲完了。'));
    return false;
  }
  const n = count === 'all' ? mine.rocks : Math.min(count, mine.rocks);
  const loot: Record<string, number> = {};
  const floor = mine.floor;
  let broken = 0;

  for (let i = 0; i < n; i++) {
    const cost = scaledCost(s, MINE_COSTS.rock, 'pickaxe', 'mining');
    if (s.energy < cost.energy) {
      events.push(warn('体力不足，挥不动镐子了。'));
      break;
    }
    if (s.minutes >= PASS_OUT_MINUTES) break;
    spend(s, cost);
    const remainingBefore = mine.rocks;
    mine.rocks -= 1;
    broken += 1;
    let xp = 1;

    if (random(s) < 0.35) {
      const ore = ORES.find((o) => inRange(floor, o.floors))!;
      const qty = 1 + (random(s) < 0.3 ? 1 : 0) + (hasProf(s, 'miner') ? 1 : 0);
      addItem(s, ore.id, qty);
      loot[ore.id] = (loot[ore.id] ?? 0) + qty;
      xp += 3;
    }
    if (random(s) < 0.04 * (hasProf(s, 'geologist') ? 2 : 1)) {
      const pool = GEMS.filter((g) => inRange(floor, g.floors));
      let roll = random(s) * pool.reduce((sum, g) => sum + g.weight, 0);
      const gem = pool.find((g) => (roll -= g.weight) < 0) ?? pool[0];
      addItem(s, gem.id, 1);
      loot[gem.id] = (loot[gem.id] ?? 0) + 1;
      xp += 8;
    }
    addXp(s, 'mining', xp, events);

    if (!mine.ladder && floor < MINE_FLOORS) {
      const chance = Math.min(1, (hasProf(s, 'prospector') ? 2 : 1) / remainingBefore);
      if (random(s) < chance) {
        mine.ladder = true;
        events.push(good('石头下面露出了通往下一层的梯子！'));
      }
    }
    if (wearTool(s, events, 'pickaxe')) break;
    if (mine.monsters.length > 0 && !monstersAttack(s, events, 0.5)) return true;
  }

  if (broken === 0) return false;
  const lootText = Object.entries(loot)
    .map(([id, q]) => `${itemName(id)} ×${q}`)
    .join('、');
  events.push(good(`敲碎了 ${broken} 块石头${lootText ? `，获得：${lootText}` : '，什么也没找到'}。`));
  return true;
}

export function attack(s: GameState, events: GameEvent[]): boolean {
  if (!requireMine(s, events)) return false;
  const mine = s.mine;
  if (mine.monsters.length === 0) {
    events.push(info('这里没有怪物。'));
    return false;
  }
  const cost = scaledCost(s, MINE_COSTS.attack, null, 'combat');
  if (s.energy < cost.energy) {
    events.push(warn('体力不足，挥不动剑了。'));
    return false;
  }
  spend(s, cost);

  const target = mine.monsters[0];
  const def = monsterDef(target.id);
  const [lo, hi] = weaponDamage(s);
  let mult = 1 + 0.03 * skillLevel(s, 'combat');
  if (hasProf(s, 'fighter')) mult *= 1.1;
  if (hasProf(s, 'brute')) mult *= 1.15;
  const crit = random(s) < BASE_CRIT_CHANCE + (hasProf(s, 'scout') ? 0.15 : 0);
  const damage = Math.round((lo + random(s) * (hi - lo)) * mult * (crit ? 2 : 1));
  target.hp -= damage;
  events.push(info(`你砍向${def.name}，造成 ${damage} 点伤害${crit ? '（暴击！）' : ''}。`));
  wearWeapon(s, events);

  if (target.hp <= 0) {
    mine.monsters.shift();
    s.stats.monstersKilled += 1;
    const dropped = random(s) < def.drop.chance;
    if (dropped) addItem(s, def.drop.id, 1);
    events.push(good(`${def.name}被打倒了！${dropped ? `掉落了${def.drop.name}。` : ''}`));
    addXp(s, 'combat', def.xp, events);
    if (mine.monsters.length === 0 && !mine.ladder && mine.floor < MINE_FLOORS && random(s) < 0.3) {
      mine.ladder = true;
      events.push(good('怪物消失的地方出现了一架梯子！'));
    }
  }
  monstersAttack(s, events, 1);
  return true;
}

export function descend(s: GameState, events: GameEvent[]): boolean {
  if (!requireMine(s, events)) return false;
  if (s.mine.floor >= MINE_FLOORS) {
    events.push(info('这里已经是最底层了。'));
    return false;
  }
  if (!s.mine.ladder) {
    events.push(warn('还没找到梯子，继续敲石头吧。'));
    return false;
  }
  generateFloor(s, s.mine.floor + 1, events);
  return true;
}
