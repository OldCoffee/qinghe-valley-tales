import type { LocationId, Season, Weather } from '../engine/types.js';

export const GAME_TITLE = '青禾谷物语';
export const TOWN_NAME = '白鹭镇';

export interface LocationDef {
  id: LocationId;
  name: string;
  arrival: string;
  aliases: string[];
}

export const LOCATIONS: Record<LocationId, LocationDef> = {
  farm: {
    id: 'farm',
    name: '你的农场',
    arrival: '你回到了农场，木屋的烟囱静静立着。',
    aliases: ['farm', 'home', '农场', '家'],
  },
  town: {
    id: 'town',
    name: `${TOWN_NAME}广场`,
    arrival: `你走到了${TOWN_NAME}广场，杂货铺、铁匠铺和酒馆围着一口老井。`,
    aliases: ['town', '小镇', '镇', '广场', TOWN_NAME],
  },
  beach: {
    id: 'beach',
    name: '海滩',
    arrival: '海风扑面而来，老渔夫的小屋立在码头边。',
    aliases: ['beach', '海滩', '海边'],
  },
  forest: {
    id: 'forest',
    name: '青禾森林',
    arrival: '你走进森林，小河在树林间哗哗地流。',
    aliases: ['forest', '森林', '树林'],
  },
  mountain: {
    id: 'mountain',
    name: '山区',
    arrival: '山间有一汪清澈的湖，湖边的岩壁上是矿洞的入口。',
    aliases: ['mountain', '山', '山区', '湖'],
  },
  mine: {
    id: 'mine',
    name: '矿洞',
    arrival: '你走进了阴凉的矿洞。',
    aliases: ['mine', '矿洞'],
  },
};

/** 地点之间的步行时间（分钟），矿洞只能从山区进入 */
const EDGES: [LocationId, LocationId, number][] = [
  ['farm', 'town', 30],
  ['farm', 'forest', 20],
  ['forest', 'town', 25],
  ['town', 'beach', 20],
  ['town', 'mountain', 20],
];

function buildDistances(): Record<string, number> {
  const ids = (Object.keys(LOCATIONS) as LocationId[]).filter((id) => id !== 'mine');
  const dist: Record<string, number> = {};
  const key = (a: string, b: string) => `${a}>${b}`;
  for (const a of ids) for (const b of ids) dist[key(a, b)] = a === b ? 0 : Infinity;
  for (const [a, b, d] of EDGES) {
    dist[key(a, b)] = d;
    dist[key(b, a)] = d;
  }
  for (const k of ids) {
    for (const a of ids) {
      for (const b of ids) {
        const via = dist[key(a, k)] + dist[key(k, b)];
        if (via < dist[key(a, b)]) dist[key(a, b)] = via;
      }
    }
  }
  return dist;
}

const DISTANCES = buildDistances();

export function travelMinutes(from: LocationId, to: LocationId): number {
  return DISTANCES[`${from}>${to}`];
}

export const TRAVEL_DESTINATIONS: LocationId[] = ['farm', 'town', 'beach', 'forest', 'mountain'];

export function findLocation(query: string): LocationDef | undefined {
  const q = query.trim().toLowerCase();
  return Object.values(LOCATIONS).find((loc) => loc.aliases.includes(q));
}

export const SEASON_NAMES: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  fall: '秋',
  winter: '冬',
};

export const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

export const WEATHER_NAMES: Record<Weather, string> = {
  sunny: '☀ 晴',
  rain: '☂ 雨',
  storm: '⚡ 暴风雨',
  snow: '❄ 雪',
};

export const MORNING_LINES: Record<Weather, string[]> = {
  sunny: [
    '阳光从窗缝里钻进来，远处传来几声鸡鸣。',
    '空气里有青草和泥土的味道，是个干活的好天气。',
    '天很蓝，云很少，田埂上的露水还没干。',
  ],
  rain: ['雨点敲着屋顶，田里的作物今天不用你操心了。', '细雨蒙蒙，整个山谷都安静了下来。'],
  storm: ['雷声滚滚，狂风把窗户吹得咯咯作响。', '暴雨倾盆，闪电不时照亮整个山谷。'],
  snow: ['推开门，外面白茫茫一片，雪还在静静地下。', '屋檐挂着冰凌，呼出的气都变成了白雾。'],
};
