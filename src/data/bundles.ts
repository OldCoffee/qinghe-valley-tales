export interface BundleDef {
  id: string;
  name: string;
  room: string;
  needs: Record<string, number>;
  reward: { gold?: number; item?: [string, number] };
  /** 完成该收集包额外解锁的自动农具 (unlock id 与工具名称, 见自动工坊) */
  unlock?: string;
  unlockName?: string;
}

export interface RoomDef {
  id: string;
  name: string;
  unlock: string;
  unlockText: string;
}

export const ROOMS: RoomDef[] = [
  { id: 'pantry', name: '茶水间', unlock: 'greenhouse', unlockText: '农场的旧温室修好了！温室里的作物不分季节，每天自动浇水。' },
  { id: 'crafts', name: '工艺室', unlock: 'minecart', unlockText: '矿车线路修通了！各地之间的移动时间减半。' },
  { id: 'fish_tank', name: '鱼缸', unlock: 'free_rod', unlockText: '老渔夫送了你一根铱金鱼竿作为谢礼！' },
  { id: 'boiler', name: '锅炉房', unlock: 'smith_discount', unlockText: '铁匠铺的炉子修好了！在铁匠铺维修工具和武器半价。' },
  { id: 'tillage_workshop', name: '整地工坊', unlock: 'auto_clear_daily', unlockText: '自动整地机升级完成！每天开始时会自动清理杂草石块并开垦整地。' },
  { id: 'sowing_workshop', name: '播种工坊', unlock: 'auto_plant_daily', unlockText: '自动播种机升级完成！每天开始时会自动补种（用农场页设定的种子）并浇水。' },
  { id: 'harvest_workshop', name: '收获工坊', unlock: 'auto_harvest_daily', unlockText: '自动收获机升级完成！每天开始时会自动铲除枯萎、除草并收获成熟作物。' },
];

export const BUNDLES: BundleDef[] = [
  { id: 'spring_crops', name: '春季作物包', room: 'pantry', needs: { parsnip: 1, green_bean: 1, cauliflower: 1, potato: 1 }, reward: { item: ['strawberry_seed', 10] } },
  { id: 'summer_crops', name: '夏季作物包', room: 'pantry', needs: { tomato: 1, hot_pepper: 1, blueberry: 1, melon: 1 }, reward: { item: ['corn_seed', 10] } },
  { id: 'fall_crops', name: '秋季作物包', room: 'pantry', needs: { corn: 1, eggplant: 1, pumpkin: 1, yam: 1 }, reward: { gold: 1000 } },
  { id: 'spring_forage', name: '春季采集包', room: 'crafts', needs: { wild_horseradish: 1, daffodil: 1, leek: 1, dandelion: 1 }, reward: { item: ['salad', 3] } },
  { id: 'summer_forage', name: '夏季采集包', room: 'crafts', needs: { grape: 1, spice_berry: 1, sweet_pea: 1 }, reward: { item: ['pizza', 3] } },
  { id: 'fall_forage', name: '秋季采集包', room: 'crafts', needs: { common_mushroom: 1, wild_plum: 1, hazelnut: 1, blackberry: 1 }, reward: { gold: 800 } },
  { id: 'winter_forage', name: '冬季采集包', room: 'crafts', needs: { winter_root: 1, crystal_fruit: 1, snow_yam: 1, crocus: 1 }, reward: { gold: 1000 } },
  { id: 'river_fish', name: '河鱼包', room: 'fish_tank', needs: { sunfish: 1, catfish: 1, salmon: 1, pike: 1 }, reward: { gold: 1000 } },
  { id: 'lake_fish', name: '湖鱼包', room: 'fish_tank', needs: { carp: 1, largemouth_bass: 1, sturgeon: 1 }, reward: { gold: 1000 } },
  { id: 'ocean_fish', name: '海鱼包', room: 'fish_tank', needs: { sardine: 1, tuna: 1, red_snapper: 1, halibut: 1 }, reward: { gold: 1000 } },
  { id: 'smith_bundle', name: '铁匠包', room: 'boiler', needs: { copper_ore: 10, iron_ore: 10, gold_ore: 10 }, reward: { gold: 1500 } },
  { id: 'geologist_bundle', name: '地质学家包', room: 'boiler', needs: { amethyst: 1, topaz: 1, aquamarine: 1, jade: 1 }, reward: { gold: 1500 } },
  { id: 'adventurer_bundle', name: '冒险家包', room: 'boiler', needs: { slime: 20, bat_wing: 10, void_essence: 1 }, reward: { item: ['pizza', 5] } },
  { id: 'tillage_base', name: '整地机包', room: 'tillage_workshop', needs: { wood: 20, scrap: 5, copper_ore: 10 }, reward: { gold: 800 }, unlock: 'auto_clear', unlockName: '自动整地机（每日自动清理 + 开垦）' },
  { id: 'tillage_pro', name: '整地机进阶包', room: 'tillage_workshop', needs: { iron_ore: 10, gold_ore: 5, scrap: 8 }, reward: { gold: 1200 } },
  { id: 'sowing_base', name: '播种机包', room: 'sowing_workshop', needs: { wood: 15, iron_ore: 10, scrap: 5 }, reward: { gold: 1000 }, unlock: 'auto_plant', unlockName: '自动播种机（每日自动补种 + 浇水）' },
  { id: 'sowing_pro', name: '播种机进阶包', room: 'sowing_workshop', needs: { gold_ore: 8, iron_ore: 10, scrap: 8 }, reward: { gold: 1500 } },
  { id: 'harvest_base', name: '收获机包', room: 'harvest_workshop', needs: { iron_ore: 10, gold_ore: 5, scrap: 8 }, reward: { gold: 1200 }, unlock: 'auto_harvest', unlockName: '自动收获机（每日自动除草 + 收获）' },
  { id: 'harvest_pro', name: '收获机进阶包', room: 'harvest_workshop', needs: { gold_ore: 10, iron_ore: 15, scrap: 10 }, reward: { gold: 1800 } },
];
