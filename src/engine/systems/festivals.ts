import {
  EGG_ROUNDS,
  EGG_SPOTS,
  EGG_WIN,
  FAIR_MAX_ITEMS,
  FESTIVAL_FRIENDSHIP,
  FESTIVAL_HOURS,
  FESTIVALS,
  WINTER_STAR_GIFTS,
  type FestivalDef,
} from '../../data/festivals.js';
import { ITEMS, itemName } from '../../data/items.js';
import { NPC_BY_ID, NPCS } from '../../data/npcs.js';
import { GIFT_POINTS } from '../../data/config.js';
import { LOCATIONS } from '../../data/world.js';
import { formatTime, todayFestival } from '../calendar.js';
import { pick, random } from '../rng.js';
import type { Activity, GameEvent, GameState } from '../types.js';
import { addItem, bad, good, info, love, removeItem, warn } from '../util.js';
import type { ActivityView } from './activityView.js';
import { addFriendship, tasteOf } from './social.js';

type FestivalActivity = Extract<Activity, { kind: 'festival' }>;

const festivalKey = (s: GameState, f: FestivalDef) => `${f.id}@${s.year}`;
const festivalById = (id: string) => FESTIVALS.find((f) => f.id === id)!;

/** 节日里可以拿出来的物品（不含种子、工具） */
export function festivalItems(s: GameState, exclude: string[] = []): string[] {
  return Object.keys(s.inventory).filter(
    (id) => !['seed', 'tool', 'weapon'].includes(ITEMS[id]?.category) && !exclude.includes(id),
  );
}

export function joinFestival(s: GameState, events: GameEvent[]): boolean {
  const f = todayFestival(s);
  if (!f) {
    events.push(info('今天没有节日。'));
    return false;
  }
  if (s.festivalsAttended.includes(festivalKey(s, f))) {
    events.push(info(`你已经参加过今年的${f.name}了。`));
    return false;
  }
  if (s.location !== f.location) {
    events.push(warn(`${f.name}在${LOCATIONS[f.location].name}举行。`));
    return false;
  }
  if (s.minutes < FESTIVAL_HOURS.start || s.minutes >= FESTIVAL_HOURS.end) {
    events.push(warn(`${f.name}的入场时间是 ${formatTime(FESTIVAL_HOURS.start)}-${formatTime(FESTIVAL_HOURS.end)}。`));
    return false;
  }
  s.activity = {
    kind: 'festival',
    festivalId: f.id,
    round: 0,
    score: 0,
    picks: [],
    target: f.id === 'winter_star' ? pick(s, NPCS).id : undefined,
  };
  events.push(good(`🎊 ${f.name}`));
  events.push(info(f.intro));
  return true;
}

export function festivalView(s: GameState, act: FestivalActivity): ActivityView {
  const f = festivalById(act.festivalId);
  const itemOption = (id: string) => `${itemName(id)}（${s.inventory[id]}）`;
  switch (f.id) {
    case 'egg':
      return {
        title: `🥚 ${f.name} · 寻蛋比赛`,
        lines: [`第 ${act.round + 1}/${EGG_ROUNDS} 轮，你已经找到 ${act.score} 个彩蛋（${EGG_WIN} 个就能拿冠军）。`, '去哪里找？'],
        options: EGG_SPOTS,
      };
    case 'luau':
      return {
        title: `🍲 ${f.name}`,
        lines: ['往汤里放点什么？好食材能让全镇人开心，垃圾会让大家很失望。'],
        options: [...festivalItems(s).map(itemOption), '什么都不放'],
      };
    case 'fair': {
      const shown = act.picks.map(itemName).join('、') || '（空）';
      return {
        title: `🏆 ${f.name} · 布置展台`,
        lines: [`展台上已经摆了：${shown}`, `还能摆 ${FAIR_MAX_ITEMS - act.picks.length} 件。种类越多、越值钱，得分越高。`],
        options: [...festivalItems(s, act.picks).map(itemOption), '完成布置，请评委打分'],
      };
    }
    default:
      return {
        title: `⭐ ${f.name}`,
        lines: [`你抽到的秘密朋友是${NPC_BY_ID[act.target!].name}。送什么礼物？`],
        options: [...festivalItems(s).map(itemOption), '空着手去'],
      };
  }
}

function finishFestival(s: GameState, f: FestivalDef, events: GameEvent[]): void {
  for (const npc of NPCS) addFriendship(s, npc.id, FESTIVAL_FRIENDSHIP);
  s.festivalsAttended.push(festivalKey(s, f));
  s.activity = null;
  s.minutes = Math.max(s.minutes, FESTIVAL_HOURS.over);
  s.location = 'farm';
  events.push(info(`${f.name}结束了，你和镇民们聊到很晚，心满意足地回到了家。（所有人好感 +${FESTIVAL_FRIENDSHIP}）`));
}

export function chooseFestival(s: GameState, act: FestivalActivity, index: number, events: GameEvent[]): boolean {
  const f = festivalById(act.festivalId);
  const view = festivalView(s, act);
  if (index < 0 || index >= view.options.length) return false;
  const isLast = index === view.options.length - 1;

  if (f.id === 'egg') {
    const r = random(s);
    const found = r < 0.15 ? 0 : r < 0.5 ? 1 : r < 0.85 ? 2 : 3;
    act.score += found;
    act.round += 1;
    events.push(info(found > 0 ? `你在${EGG_SPOTS[index]}找到了 ${found} 个彩蛋！` : `${EGG_SPOTS[index]}什么都没有……`));
    if (act.round >= EGG_ROUNDS) {
      if (act.score >= EGG_WIN) {
        s.gold += 1000;
        events.push(good(`你一共找到 ${act.score} 个彩蛋，拿下了冠军！奖金 1000 金。`));
      } else {
        events.push(info(`你一共找到 ${act.score} 个彩蛋，可惜没拿到冠军。`));
      }
      finishFestival(s, f, events);
    }
    return true;
  }

  if (f.id === 'luau') {
    if (isLast) {
      events.push(info('你什么也没放，大家喝着清汤寡水，有点失落。'));
    } else {
      const id = festivalItems(s)[index];
      const item = ITEMS[id];
      removeItem(s, id, 1);
      let delta: number;
      if (item.category === 'trash' || item.category === 'monster') {
        delta = -50;
        events.push(bad(`你把${item.name}丢进了锅里……全场一片寂静，有人当场吐了出来。`));
      } else if (item.sellPrice >= 150) {
        delta = 60;
        events.push(love(`你放入了${item.name}。镇长尝了一口，大声称赞："这是我喝过最好喝的汤！"`));
      } else if (item.sellPrice >= 50) {
        delta = 30;
        events.push(good(`你放入了${item.name}。大家都说汤的味道不错。`));
      } else {
        delta = 10;
        events.push(info(`你放入了${item.name}。汤的味道……还行吧。`));
      }
      for (const npc of NPCS) addFriendship(s, npc.id, delta);
    }
    finishFestival(s, f, events);
    return true;
  }

  if (f.id === 'fair') {
    if (!isLast) {
      act.picks.push(festivalItems(s, act.picks)[index]);
      if (act.picks.length < FAIR_MAX_ITEMS) return true;
    }
    const categories = new Set(act.picks.map((id) => ITEMS[id].category));
    const score =
      act.picks.reduce((sum, id) => sum + Math.min(6, 2 + Math.floor(ITEMS[id].sellPrice / 50)), 0) + categories.size * 3;
    const [place, prize] = score >= 30 ? ['第一名', 1500] : score >= 20 ? ['第二名', 800] : ['参与奖', 200];
    s.gold += prize;
    events.push(good(`评委给你的展台打了 ${score} 分，获得${place}！奖金 ${prize} 金。`));
    finishFestival(s, f, events);
    return true;
  }

  const npc = NPC_BY_ID[act.target!];
  if (isLast) {
    events.push(info(`你空着手去见${npc.name}，气氛有点尴尬。`));
  } else {
    const id = festivalItems(s)[index];
    const taste = tasteOf(npc, id);
    removeItem(s, id, 1);
    addFriendship(s, npc.id, GIFT_POINTS[taste] * 5);
    events.push(love(`你把${itemName(id)}送给了${npc.name}。${taste === 'loved' || taste === 'liked' ? '对方惊喜极了！' : '对方礼貌地道了谢。'}`));
  }
  const [giftId, qty] = pick(s, WINTER_STAR_GIFTS);
  addItem(s, giftId, qty);
  events.push(good(`你的秘密朋友也送了你一份礼物：${itemName(giftId)} ×${qty}。`));
  finishFestival(s, f, events);
  return true;
}
