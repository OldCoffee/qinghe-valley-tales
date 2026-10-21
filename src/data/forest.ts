import type { GroveId, Season } from '../engine/types.js';

export interface GroveDef {
  id: GroveId;
  name: string;
  icon: string;
  desc: string;
  /** 各季节一次可采到的东西；没列出的季节表示这个季节没有产出 */
  yields: Partial<Record<Season, [string, number][]>>;
  /** 没有产出的季节走到点位时看到的说明 */
  offSeasonText: string;
}

export const GROVES: GroveDef[] = [
  {
    id: 'mushroom',
    name: '蘑菇圈',
    icon: '菇',
    desc: '大橡树根旁的一圈蘑菇，雨后长得最快。',
    yields: {
      spring: [['common_mushroom', 1]],
      summer: [['common_mushroom', 2]],
      fall: [['common_mushroom', 3]],
    },
    offSeasonText: '冬天蘑菇圈冻住了，等开春再来。',
  },
  {
    id: 'flowers',
    name: '野花丛',
    icon: '花',
    desc: '林间空地上的一片野花，蜜蜂嗡嗡地忙着。',
    yields: {
      spring: [['daffodil', 2]],
      summer: [['sweet_pea', 2]],
    },
    offSeasonText: '花丛已经凋谢了，春夏再来看花。',
  },
  {
    id: 'fruit',
    name: '野果树',
    icon: '果',
    desc: '一棵没人打理的老果树，枝头总挂着野果。',
    yields: {
      summer: [['grape', 2]],
      fall: [
        ['wild_plum', 2],
        ['hazelnut', 1],
      ],
    },
    offSeasonText: '果树还没结果，夏秋再来摘果子。',
  },
];

export const groveById = (id: GroveId): GroveDef => GROVES.find((g) => g.id === id)!;
