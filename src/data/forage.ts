import type { LocationId, Season } from '../engine/types.js';

export interface ForageDef {
  id: string;
  name: string;
  sellPrice: number;
  energy?: number;
  seasons: Season[];
  locations: LocationId[];
}

const ALL: Season[] = ['spring', 'summer', 'fall', 'winter'];
const LAND: LocationId[] = ['forest', 'mountain'];

export const FORAGE: ForageDef[] = [
  { id: 'wild_horseradish', name: '野山葵', sellPrice: 50, energy: 13, seasons: ['spring'], locations: LAND },
  { id: 'daffodil', name: '黄水仙', sellPrice: 30, seasons: ['spring'], locations: LAND },
  { id: 'leek', name: '韭葱', sellPrice: 60, energy: 40, seasons: ['spring'], locations: LAND },
  { id: 'dandelion', name: '蒲公英', sellPrice: 40, energy: 25, seasons: ['spring'], locations: LAND },
  { id: 'spice_berry', name: '香味浆果', sellPrice: 80, energy: 25, seasons: ['summer'], locations: LAND },
  { id: 'grape', name: '葡萄', sellPrice: 80, energy: 38, seasons: ['summer'], locations: LAND },
  { id: 'sweet_pea', name: '甜豌豆', sellPrice: 50, seasons: ['summer'], locations: LAND },
  { id: 'common_mushroom', name: '普通蘑菇', sellPrice: 40, energy: 38, seasons: ['fall'], locations: LAND },
  { id: 'wild_plum', name: '野李子', sellPrice: 80, energy: 25, seasons: ['fall'], locations: LAND },
  { id: 'hazelnut', name: '榛子', sellPrice: 90, energy: 30, seasons: ['fall'], locations: LAND },
  { id: 'blackberry', name: '黑莓', sellPrice: 20, energy: 25, seasons: ['fall'], locations: LAND },
  { id: 'winter_root', name: '冬根', sellPrice: 70, energy: 25, seasons: ['winter'], locations: LAND },
  { id: 'crystal_fruit', name: '水晶果', sellPrice: 150, energy: 63, seasons: ['winter'], locations: LAND },
  { id: 'snow_yam', name: '雪山药', sellPrice: 100, energy: 30, seasons: ['winter'], locations: LAND },
  { id: 'crocus', name: '番红花', sellPrice: 60, seasons: ['winter'], locations: LAND },
  { id: 'clam', name: '蛤蜊', sellPrice: 50, seasons: ALL, locations: ['beach'] },
  { id: 'cockle', name: '鸟蛤', sellPrice: 50, seasons: ALL, locations: ['beach'] },
  { id: 'mussel', name: '贻贝', sellPrice: 30, seasons: ALL, locations: ['beach'] },
  { id: 'coral', name: '珊瑚', sellPrice: 80, seasons: ALL, locations: ['beach'] },
];

/** 每个地点每天刷新的采集物数量范围 [最少, 最多] */
export const FORAGE_SPAWN: Partial<Record<LocationId, [number, number]>> = {
  forest: [2, 4],
  mountain: [1, 3],
  beach: [1, 3],
};
