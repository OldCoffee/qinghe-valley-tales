import type { Season } from '../engine/types.js';

export interface CropDef {
  id: string;
  name: string;
  seasons: Season[];
  seedPrice: number;
  growDays: number;
  sellPrice: number;
  /** 首次收获后每隔几天可再次收获；不填表示收获后作物消失 */
  regrowDays?: number;
  /** 直接食用恢复的体力 */
  energy: number;
}

const list: CropDef[] = [
  { id: 'parsnip', name: '防风草', seasons: ['spring'], seedPrice: 20, growDays: 4, sellPrice: 35, energy: 25 },
  { id: 'potato', name: '土豆', seasons: ['spring'], seedPrice: 50, growDays: 6, sellPrice: 80, energy: 26 },
  { id: 'green_bean', name: '青豆', seasons: ['spring'], seedPrice: 60, growDays: 10, sellPrice: 40, regrowDays: 3, energy: 25 },
  { id: 'cauliflower', name: '花椰菜', seasons: ['spring'], seedPrice: 80, growDays: 12, sellPrice: 175, energy: 75 },
  { id: 'strawberry', name: '草莓', seasons: ['spring'], seedPrice: 100, growDays: 8, sellPrice: 120, regrowDays: 4, energy: 50 },
  { id: 'tomato', name: '番茄', seasons: ['summer'], seedPrice: 50, growDays: 11, sellPrice: 60, regrowDays: 4, energy: 20 },
  { id: 'hot_pepper', name: '辣椒', seasons: ['summer'], seedPrice: 40, growDays: 5, sellPrice: 40, regrowDays: 3, energy: 13 },
  { id: 'blueberry', name: '蓝莓', seasons: ['summer'], seedPrice: 80, growDays: 13, sellPrice: 80, regrowDays: 4, energy: 25 },
  { id: 'melon', name: '甜瓜', seasons: ['summer'], seedPrice: 80, growDays: 12, sellPrice: 250, energy: 113 },
  { id: 'corn', name: '玉米', seasons: ['summer', 'fall'], seedPrice: 150, growDays: 14, sellPrice: 50, regrowDays: 4, energy: 25 },
  { id: 'eggplant', name: '茄子', seasons: ['fall'], seedPrice: 20, growDays: 5, sellPrice: 60, regrowDays: 5, energy: 20 },
  { id: 'pumpkin', name: '南瓜', seasons: ['fall'], seedPrice: 100, growDays: 13, sellPrice: 320, energy: 40 },
  { id: 'yam', name: '山药', seasons: ['fall'], seedPrice: 60, growDays: 10, sellPrice: 160, energy: 45 },
  { id: 'cranberry', name: '蔓越莓', seasons: ['fall'], seedPrice: 240, growDays: 7, sellPrice: 130, regrowDays: 5, energy: 38 },
];

export const CROPS: Record<string, CropDef> = Object.fromEntries(list.map((c) => [c.id, c]));
