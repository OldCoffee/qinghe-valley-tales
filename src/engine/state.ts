import {
  BASE_HP,
  DAY_START_MINUTES,
  FARM_COLS,
  FARM_GEN,
  FARM_ROWS,
  MAX_ENERGY,
  SAVE_VERSION,
  START_GOLD,
  START_INVENTORY,
  START_WEAPON,
  TOTAL_ROWS,
} from '../data/config.js';
import { NPCS } from '../data/npcs.js';
import { rollWeather } from './day.js';
import { random } from './rng.js';
import { spawnForage } from './systems/foraging.js';
import { freshForest } from './systems/forest.js';
import type { GameState, Gender, Ground, NpcState, Tile } from './types.js';

export function createNewGame(seed: number, playerGender: Gender = 'male', playerName = '农场主'): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    playerGender,
    playerName: playerName.trim() || '农场主',
    autoPlantCropId: null,
    collection: [...Object.keys(START_INVENTORY), START_WEAPON],
    year: 1,
    season: 'spring',
    day: 1,
    minutes: DAY_START_MINUTES,
    energy: MAX_ENERGY,
    maxEnergy: MAX_ENERGY,
    hp: BASE_HP,
    gold: START_GOLD,
    location: 'farm',
    weather: 'sunny',
    tomorrowWeather: 'sunny',
    farm: [],
    inventory: { ...START_INVENTORY, [START_WEAPON]: 1 },
    shippingBin: {},
    skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, combat: 0 },
    professions: [],
    pendingProfessions: [],
    tools: { hoe: 0, can: 0, pickaxe: 0, rod: 0, axe: 0 },
    toolUpgrade: null,
    weapon: START_WEAPON,
    durability: { hoe: 100, can: 100, pickaxe: 100, rod: 100, axe: 100 },
    weaponDurability: { [START_WEAPON]: 90 },
    equippedTools: { hoe: true, can: true, pickaxe: true, rod: true, axe: true },
    ownedRods: ['bamboo'],
    equippedRodId: 'bamboo',
    equippedBaitId: null,
    npcs: Object.fromEntries(
      NPCS.map((npc): [string, NpcState] => [
        npc.id,
        { friendship: 0, talkedToday: false, giftedToday: false, giftsThisWeek: 0, eventsSeen: [], status: 'friend' },
      ]),
    ),
    forage: {},
    forest: freshForest(),
    mine: { floor: 0, deepest: 0, rocks: 0, ladder: false, monsters: [], chestsOpened: [] },
    bundles: {},
    rewardsClaimed: [],
    unlocks: [],
    activity: null,
    wedding: null,
    festivalsAttended: [],
    evaluation: null,
    stats: {
      totalEarned: 0,
      cropsHarvested: 0,
      timesPassedOut: 0,
      fishCaught: 0,
      itemsForaged: 0,
      monstersKilled: 0,
      fishSpecies: [],
    },
    rngState: seed >>> 0,
  };

  for (let row = 0; row < TOTAL_ROWS; row++) {
    const tiles: Tile[] = [];
    for (let col = 0; col < FARM_COLS; col++) {
      if (row >= FARM_ROWS) {
        tiles.push({ ground: 'locked', watered: false, crop: null, greenhouse: true });
        continue;
      }
      const roll = random(s);
      const ground: Ground =
        roll < FARM_GEN.weedChance
          ? 'weed'
          : roll < FARM_GEN.weedChance + FARM_GEN.stoneChance
            ? 'stone'
            : 'grass';
      tiles.push({ ground, watered: false, crop: null });
    }
    s.farm.push(tiles);
  }
  s.tomorrowWeather = rollWeather(s, s.season, 2);
  spawnForage(s);
  return s;
}
