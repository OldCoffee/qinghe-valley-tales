import type { Gender, ItemCategory, LocationId, Season } from '../engine/types.js';

export type Taste = 'loved' | 'liked' | 'neutral' | 'disliked' | 'hated';

export interface NpcDef {
  id: string;
  name: string;
  intro: string;
  gender: Gender;
  marriageable: boolean;
  birthday: { season: Season; day: number };
  /** [开始小时, 地点]；按时间顺序排列 */
  schedule: [number, LocationId][];
  rainSchedule: [number, LocationId][];
  tastes: Partial<Record<Taste, (string | `category:${ItemCategory}`)[]>>;
  dialogue: {
    stranger: string[];
    friend: string[];
    close: string[];
    rain: string[];
    spouse?: string[];
  };
}

export const NPCS: NpcDef[] = [
  {
    id: 'su_he',
    name: '苏禾',
    intro: '杂货铺老板的女儿，喜欢花草，梦想开一家花店。',
    gender: 'female',
    marriageable: true,
    birthday: { season: 'spring', day: 18 },
    schedule: [[6, 'town'], [13, 'forest'], [17, 'town']],
    rainSchedule: [[6, 'town']],
    tastes: {
      loved: ['strawberry', 'daffodil', 'sweet_pea', 'crocus'],
      liked: ['blueberry', 'melon', 'cauliflower', 'spice_berry', 'bouquet'],
      hated: ['category:trash', 'slime'],
    },
    dialogue: {
      stranger: ['你就是新来的农场主吧？我叫苏禾，杂货铺是我爸开的。', '买种子记得来我们店哦，周三休息。'],
      friend: ['森林里的黄水仙开了，你看到了吗？', '我在攒钱，以后想开一家小花店。', '今天店里来了好多人，忙死啦。'],
      close: ['和你聊天的时候，时间总是过得特别快。', '要是哪天你的农场开满了花，一定要叫我去看！', '嘿嘿，今天也见到你了。'],
      rain: ['下雨天店里人少，我就趴在柜台上看雨。', '雨后的森林最香了。'],
      spouse: ['早安，亲爱的。我给门口的花浇过水了。', '和你一起住在农场，比我想象的还要幸福。'],
    },
  },
  {
    id: 'lu_yuan',
    name: '陆远',
    intro: '老渔夫的孙子，话不多，在海边一坐就是一整天。',
    gender: 'male',
    marriageable: true,
    birthday: { season: 'summer', day: 9 },
    schedule: [[6, 'beach'], [16, 'mountain'], [20, 'town']],
    rainSchedule: [[6, 'beach'], [12, 'town']],
    tastes: {
      loved: ['tuna', 'catfish', 'sturgeon', 'pufferfish'],
      liked: ['category:fish', 'pizza'],
      hated: ['sweet_pea', 'daffodil'],
    },
    dialogue: {
      stranger: ['……嗯。你好。', '别说话，鱼会跑。'],
      friend: ['今天的潮水不错。', '爷爷说，钓鱼靠的不是手，是耐心。', '山上那个湖里，据说有一条鱼王。'],
      close: ['……有你在旁边，钓鱼好像也没那么无聊了。', '这条鱼送你吧。开玩笑的，自己钓去。', '你来了啊。我刚好想见你。'],
      rain: ['下雨天鱼最爱咬钩。', '雨声和海浪声，我都喜欢。'],
      spouse: ['早。今天海上风平浪静，适合出海。', '以前一个人看海，现在有你一起。'],
    },
  },
  {
    id: 'a_qing',
    name: '阿青',
    intro: '铁匠铺的学徒，嗓门大、力气大，最爱矿洞探险。',
    gender: 'male',
    marriageable: true,
    birthday: { season: 'fall', day: 5 },
    schedule: [[6, 'town'], [18, 'mountain']],
    rainSchedule: [[6, 'town']],
    tastes: {
      loved: ['diamond', 'ruby', 'emerald', 'gold_ore'],
      liked: ['category:gem', 'category:ore', 'golem_core'],
      hated: ['dandelion', 'blackberry'],
    },
    dialogue: {
      stranger: ['哟！新来的？工具钝了就来铁匠铺找我们！', '矿洞里有好东西，也有怪物，小心点。'],
      friend: ['今天打了一整天铁，胳膊都快抬不起来了！', '听说矿洞深处有钻石，我迟早要挖到！', '你的镐子该升级了吧？'],
      close: ['下次下矿带上我呗？我保护你！', '你知道吗，我第一把剑是自己打的。现在想送给你……开玩笑的，它太丑了。', '见到你就特别有干劲！'],
      rain: ['下雨天炉子不好烧，师傅让我休息。', '雨天的矿洞更阴森了，嘿嘿，我喜欢。'],
      spouse: ['早！我把你的工具都磨好了。', '等我们老了，就开一家夫妻铁匠铺吧！'],
    },
  },
  {
    id: 'bai_zhi',
    name: '白芷',
    intro: '镇上的草药医生，温柔安静，常在森林里采药。',
    gender: 'female',
    marriageable: true,
    birthday: { season: 'winter', day: 14 },
    schedule: [[6, 'forest'], [10, 'town'], [18, 'forest']],
    rainSchedule: [[6, 'town']],
    tastes: {
      loved: ['crystal_fruit', 'wild_horseradish', 'common_mushroom', 'salad'],
      liked: ['category:forage'],
      hated: ['void_essence', 'pizza'],
    },
    dialogue: {
      stranger: ['你好，我是白芷，镇上诊所是我在打理。', '干农活要注意休息，别累坏了身体。'],
      friend: ['森林里的野山葵可以入药，你见到了可以留意一下。', '今天来看病的都是扭了腰的老人家。', '你脸色不错，最近睡得好吗？'],
      close: ['你来了，我泡了茶，要不要一起喝？', '和你在一起，心里很安静。', '记得按时吃饭，我会担心的。'],
      rain: ['雨天适合整理药材。', '下雨的时候，诊所反而清闲。'],
      spouse: ['早安。我熬了一点汤，喝了再出门吧。', '有你在的地方，就是家。'],
    },
  },
  {
    id: 'zhou_bo',
    name: '周伯',
    intro: '白鹭杂货铺的老板，苏禾的父亲，精明又热心。',
    gender: 'male',
    marriageable: false,
    birthday: { season: 'spring', day: 26 },
    schedule: [[6, 'town']],
    rainSchedule: [[6, 'town']],
    tastes: {
      loved: ['cauliflower', 'pumpkin', 'melon'],
      liked: ['category:crop'],
      hated: ['category:trash'],
    },
    dialogue: {
      stranger: ['欢迎欢迎！种子、花束，杂货铺应有尽有！', '你爷爷当年可是这一带最好的农夫。'],
      friend: ['最近你的菜卖得不错嘛！', '我年轻的时候也种过地，腰就是那时候累坏的。', '苏禾那丫头又跑去森林了。'],
      close: ['你是个踏实的年轻人，我很欣赏你。', '有你在，镇上热闹多了。'],
      rain: ['下雨天生意淡，正好盘盘货。'],
    },
  },
  {
    id: 'qin_popo',
    name: '秦婆婆',
    intro: '镇上最年长的老人，喜欢织毛衣，也认识你爷爷。',
    gender: 'female',
    marriageable: false,
    birthday: { season: 'fall', day: 22 },
    schedule: [[6, 'town'], [10, 'forest'], [15, 'town']],
    rainSchedule: [[6, 'town']],
    tastes: {
      loved: ['pumpkin', 'blackberry', 'yam'],
      liked: ['category:food', 'hazelnut'],
      hated: ['category:monster'],
    },
    dialogue: {
      stranger: ['哎呀，你长得和你爷爷年轻时真像。', '孩子，有空来陪老婆子聊聊天。'],
      friend: ['今年的冬天怕是会很冷，我给你织条围巾吧。', '你爷爷以前总给我送南瓜。', '慢慢来，日子长着呢。'],
      close: ['看到你，就像看到你爷爷当年一样。', '你是个好孩子，山谷会因为你变好的。'],
      rain: ['下雨天膝盖疼，老毛病了。'],
    },
  },
];

export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

export function findNpc(query: string): NpcDef | undefined {
  const q = query.trim().toLowerCase();
  return NPC_BY_ID[q] ?? NPCS.find((n) => n.name === query.trim());
}
