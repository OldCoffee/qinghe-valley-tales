import {
  BIRTHDAY_MULTIPLIER,
  DAILY_DECAY,
  DATING_HEARTS,
  DAY_START_MINUTES,
  FRIENDSHIP_CAP,
  GIFT_POINTS,
  GIFTS_PER_WEEK,
  NPC_BEDTIME_MINUTES,
  POINTS_PER_HEART,
  PROPOSAL_HEARTS,
  TALK_POINTS,
  WEDDING_DELAY_DAYS,
} from '../../data/config.js';
import { EVENT_BY_ID, HEART_EVENTS } from '../../data/events.js';
import { ITEMS } from '../../data/items.js';
import { NPC_BY_ID, NPCS, type NpcDef, type Taste } from '../../data/npcs.js';
import { absoluteDay, isRaining, todayFestival, weekday } from '../calendar.js';
import { allTiles } from '../farm.js';
import { pick, random } from '../rng.js';
import type { Activity, GameEvent, GameState, LocationId } from '../types.js';
import { addItem, info, love, removeItem, warn } from '../util.js';
import type { ActivityView } from './activityView.js';

const TALK_MINUTES = 10;

export function heartsOf(s: GameState, npcId: string): number {
  return Math.floor(s.npcs[npcId].friendship / POINTS_PER_HEART);
}

export function isBirthday(s: GameState, npc: NpcDef): boolean {
  return npc.birthday.season === s.season && npc.birthday.day === s.day;
}

export function spouseId(s: GameState): string | null {
  return Object.keys(s.npcs).find((id) => s.npcs[id].status === 'married') ?? null;
}

export function npcLocation(s: GameState, npc: NpcDef): LocationId | null {
  if (s.minutes < DAY_START_MINUTES || s.minutes >= NPC_BEDTIME_MINUTES) return null;
  if (s.npcs[npc.id].status === 'married') return 'farm';
  const festival = todayFestival(s);
  if (festival) return festival.location;
  const schedule = isRaining(s) ? npc.rainSchedule : npc.schedule;
  let here: LocationId | null = null;
  for (const [hour, loc] of schedule) if (s.minutes >= hour * 60) here = loc;
  return here;
}

export function npcsHere(s: GameState): NpcDef[] {
  return NPCS.filter((npc) => npcLocation(s, npc) === s.location);
}

function capFor(s: GameState, npc: NpcDef): number {
  return npc.marriageable && s.npcs[npc.id].status === 'friend' ? FRIENDSHIP_CAP.friendMarriageable : FRIENDSHIP_CAP.max;
}

export function addFriendship(s: GameState, npcId: string, delta: number): void {
  const npc = NPC_BY_ID[npcId];
  const state = s.npcs[npcId];
  state.friendship = Math.max(0, Math.min(capFor(s, npc), state.friendship + delta));
}

export function tasteOf(npc: NpcDef, itemId: string): Taste {
  const item = ITEMS[itemId];
  const order: Taste[] = ['loved', 'hated', 'liked', 'disliked'];
  for (const taste of order) {
    if (npc.tastes[taste]?.includes(itemId)) return taste;
  }
  for (const taste of order) {
    if (npc.tastes[taste]?.includes(`category:${item.category}`)) return taste;
  }
  return item.category === 'trash' || item.category === 'monster' ? 'disliked' : 'neutral';
}

const REACTIONS: Record<Taste, string> = {
  loved: '眼睛一下子亮了："这是我最喜欢的东西！你怎么知道的？"',
  liked: '开心地收下了："谢谢你，我很喜欢。"',
  neutral: '礼貌地收下了："谢谢。"',
  disliked: '皱了皱眉："呃……谢谢。"',
  hated: '脸色一沉："你是故意的吗？"',
};

function requirePresent(s: GameState, npc: NpcDef | undefined, events: GameEvent[]): npc is NpcDef {
  if (!npc) {
    events.push(warn('没有这个人。'));
    return false;
  }
  if (npcLocation(s, npc) !== s.location) {
    events.push(warn(`${npc.name}不在这里。`));
    return false;
  }
  return true;
}

function dialogueLine(s: GameState, npc: NpcDef): string {
  const state = s.npcs[npc.id];
  const hearts = heartsOf(s, npc.id);
  if (state.status === 'married' && npc.dialogue.spouse) return pick(s, npc.dialogue.spouse);
  if (isRaining(s) && random(s) < 0.35) return pick(s, npc.dialogue.rain);
  if (hearts < 2) return pick(s, npc.dialogue.stranger);
  if (hearts < 6) return pick(s, npc.dialogue.friend);
  return pick(s, npc.dialogue.close);
}

export function talk(s: GameState, events: GameEvent[], npcId: string): boolean {
  const npc = NPC_BY_ID[npcId];
  if (!requirePresent(s, npc, events)) return false;
  const state = s.npcs[npc.id];
  s.minutes += TALK_MINUTES;
  if (!state.talkedToday) {
    state.talkedToday = true;
    addFriendship(s, npc.id, TALK_POINTS);
  }

  const hearts = heartsOf(s, npc.id);
  const heartEvent = HEART_EVENTS.find(
    (e) => e.npcId === npc.id && hearts >= e.hearts && !state.eventsSeen.includes(e.id),
  );
  if (heartEvent) {
    state.eventsSeen.push(heartEvent.id);
    s.activity = { kind: 'event', eventId: heartEvent.id };
    events.push(love(`💗 ${npc.name}的心事件：${heartEvent.title}`));
    return true;
  }

  events.push(info(`${npc.name}："${dialogueLine(s, npc)}"`));
  if (isBirthday(s, npc)) events.push(love(`${npc.name}："今天是我的生日哦！"`));
  return true;
}

export function gift(s: GameState, events: GameEvent[], npcId: string, itemId: string): boolean {
  const npc = NPC_BY_ID[npcId];
  if (!requirePresent(s, npc, events)) return false;
  const item = ITEMS[itemId];
  if (!item || !s.inventory[itemId]) {
    events.push(warn(`你没有${item?.name ?? '这个东西'}。`));
    return false;
  }
  const state = s.npcs[npc.id];
  const hearts = heartsOf(s, npc.id);

  if (itemId === 'bouquet') {
    if (!npc.marriageable) {
      events.push(warn(`${npc.name}笑着摆摆手："这个呀，还是送给你心上人吧。"`));
      return false;
    }
    if (state.status !== 'friend') {
      events.push(warn(`你们已经在交往了。`));
      return false;
    }
    if (hearts < DATING_HEARTS) {
      events.push(warn(`${npc.name}有些为难："我们……还没那么熟吧？"（需要 ${DATING_HEARTS} 心）`));
      return false;
    }
    removeItem(s, itemId, 1);
    state.status = 'dating';
    events.push(love(`${npc.name}接过花束，脸红红地点了点头："我愿意……和你交往。"💐`));
    return true;
  }

  if (itemId === 'pendant') {
    if (Object.values(s.npcs).some((n) => n.status === 'married' || n.status === 'engaged')) {
      events.push(warn('你已经有伴侣了。'));
      return false;
    }
    if (state.status !== 'dating') {
      events.push(warn(`先送花束和${npc.name}交往吧。`));
      return false;
    }
    if (hearts < PROPOSAL_HEARTS) {
      events.push(warn(`${npc.name}犹豫了："我觉得……我们还需要更多时间。"（需要 ${PROPOSAL_HEARTS} 心）`));
      return false;
    }
    removeItem(s, itemId, 1);
    state.status = 'engaged';
    s.wedding = { npcId: npc.id, day: absoluteDay(s) + WEDDING_DELAY_DAYS };
    events.push(love(`${npc.name}捂住嘴，眼泪夺眶而出："我愿意！"婚礼将在 ${WEDDING_DELAY_DAYS} 天后举行。💍`));
    return true;
  }

  if (state.giftedToday) {
    events.push(warn(`今天已经给${npc.name}送过礼物了。`));
    return false;
  }
  const birthday = isBirthday(s, npc);
  if (state.giftsThisWeek >= GIFTS_PER_WEEK && !birthday) {
    events.push(warn(`这周已经给${npc.name}送过 ${GIFTS_PER_WEEK} 次礼物了。`));
    return false;
  }
  if (item.category === 'tool' || item.category === 'weapon') {
    events.push(warn('这个不能送人。'));
    return false;
  }

  const taste = tasteOf(npc, itemId);
  const points = GIFT_POINTS[taste] * (birthday ? BIRTHDAY_MULTIPLIER : 1);
  removeItem(s, itemId, 1);
  state.giftedToday = true;
  state.giftsThisWeek += 1;
  addFriendship(s, npc.id, points);
  const birthdayText = birthday ? '（生日礼物，效果翻倍！）' : '';
  const level = points >= 0 ? 'love' : 'warn';
  events.push({ level, text: `${npc.name}${REACTIONS[taste]}${birthdayText}` });
  return true;
}

export function eventView(act: Extract<Activity, { kind: 'event' }>): ActivityView {
  const ev = EVENT_BY_ID[act.eventId];
  return {
    title: `💗 ${NPC_BY_ID[ev.npcId].name} · ${ev.title}`,
    lines: ev.lines,
    options: ev.choices.map((c) => c.text),
  };
}

export function chooseEvent(
  s: GameState,
  act: Extract<Activity, { kind: 'event' }>,
  index: number,
  events: GameEvent[],
): boolean {
  const ev = EVENT_BY_ID[act.eventId];
  const choice = ev.choices[index];
  if (!choice) return false;
  addFriendship(s, ev.npcId, choice.delta);
  s.activity = null;
  s.minutes += 30;
  events.push({ level: choice.delta >= 0 ? 'love' : 'warn', text: choice.reply });
  return true;
}

/** 每晚结算：没聊天的好感小幅下降，重置每日/每周计数 */
export function nightlySocial(s: GameState): void {
  for (const state of Object.values(s.npcs)) {
    if (!state.talkedToday && state.friendship > 0 && state.status !== 'married') {
      state.friendship = Math.max(0, state.friendship - DAILY_DECAY);
    }
    state.talkedToday = false;
    state.giftedToday = false;
  }
}

export function morningSocial(s: GameState, events: GameEvent[]): void {
  if (weekday(s.day) === 0) {
    for (const state of Object.values(s.npcs)) state.giftsThisWeek = 0;
  }

  if (s.wedding && absoluteDay(s) >= s.wedding.day) {
    const npc = NPC_BY_ID[s.wedding.npcId];
    s.npcs[npc.id].status = 'married';
    s.wedding = null;
    events.push(love(`💒 今天是你和${npc.name}的婚礼！全镇的人都来祝福你们。从今天起，${npc.name}搬到农场和你一起生活。`));
  }

  const spouse = spouseId(s);
  if (spouse) {
    const npc = NPC_BY_ID[spouse];
    const roll = random(s);
    const canWater = !isRaining(s) && s.season !== 'winter';
    if (roll < 0.35 && canWater) {
      let watered = 0;
      for (const tile of allTiles(s)) {
        if (tile.ground === 'tilled' && tile.crop && !tile.watered && !tile.greenhouse) {
          tile.watered = true;
          watered++;
        }
      }
      if (watered > 0) events.push(love(`${npc.name}一早起来，把田里的作物都浇好了水。`));
    } else if (roll < 0.65) {
      addItem(s, 'breakfast', 1);
      events.push(love(`${npc.name}给你做了一份爱心早餐。`));
    }
  }

  for (const npc of NPCS) {
    if (isBirthday(s, npc)) events.push(info(`🎂 今天是${npc.name}的生日。`));
  }
}
