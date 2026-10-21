export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Weather = 'sunny' | 'rain' | 'storm' | 'snow';
export type LocationId = 'farm' | 'town' | 'beach' | 'forest' | 'mountain' | 'mine';
export type Ground = 'grass' | 'weed' | 'stone' | 'tilled' | 'locked';
export type SkillId = 'farming' | 'foraging' | 'fishing' | 'mining' | 'combat';
export type ToolId = 'hoe' | 'can' | 'pickaxe' | 'rod' | 'axe';
export type ItemCategory =
  | 'seed'
  | 'crop'
  | 'forage'
  | 'fish'
  | 'ore'
  | 'gem'
  | 'monster'
  | 'food'
  | 'trash'
  | 'special'
  | 'weapon'
  | 'tool';

export interface CropInstance {
  cropId: string;
  /** 已生长天数；达到作物的 growDays 即可收获 */
  age: number;
  /** 连续未浇水天数（老存档可缺失，按 0 处理） */
  dryDays?: number;
  /** 是否已因长期缺水枯萎：不再生长、收获无产出，需铲除 */
  wilted?: boolean;
}

export interface Tile {
  ground: Ground;
  watered: boolean;
  crop: CropInstance | null;
  greenhouse?: boolean;
  /** 已开垦地块上滋生的杂草（与地面 ground:'weed' 区分）；有杂草时作物暂停生长、成熟收获减半 */
  weeds?: boolean;
  /** 肥沃土地（高级锄头开垦时概率产生）：作物首次正常生长额外 +1 天，触发后消耗 */
  fertile?: boolean;
}

export type RelationStatus = 'friend' | 'dating' | 'engaged' | 'married';

export interface NpcState {
  friendship: number;
  talkedToday: boolean;
  giftedToday: boolean;
  giftsThisWeek: number;
  eventsSeen: string[];
  status: RelationStatus;
}

export interface MonsterInstance {
  id: string;
  hp: number;
}

export interface MineState {
  /** 0 表示不在矿洞里 */
  floor: number;
  deepest: number;
  rocks: number;
  ladder: boolean;
  monsters: MonsterInstance[];
  chestsOpened: number[];
}

export type FishMove = 'struggle' | 'rest';

export type Activity =
  | {
      kind: 'fishing';
      fishId: string;
      progress: number;
      tension: number;
      round: number;
      hint: FishMove | 'unclear';
      actual: FishMove;
    }
  | { kind: 'event'; eventId: string }
  | { kind: 'profession'; skill: SkillId; level: number }
  | {
      kind: 'festival';
      festivalId: string;
      round: number;
      score: number;
      picks: string[];
      target?: string;
    };

export type GroveId = 'mushroom' | 'flowers' | 'fruit';

export interface ForestState {
  /** 今天还能砍的树（每天清晨恢复） */
  trees: number;
  /** 三个固定采集点今天是否还没采过 */
  groves: Record<GroveId, boolean>;
  /** 今天是否已经探索过林间奇遇 */
  exploredToday: boolean;
}

export interface GameStats {
  totalEarned: number;
  cropsHarvested: number;
  timesPassedOut: number;
  fishCaught: number;
  itemsForaged: number;
  monstersKilled: number;
  fishSpecies: string[];
}

export interface Evaluation {
  score: number;
  candles: number;
  notes: string[];
}

export interface GameState {
  version: number;
  year: number;
  season: Season;
  day: number;
  /** 从当天 0:00 起算的分钟数，可超过 24*60 表示凌晨 */
  minutes: number;
  energy: number;
  maxEnergy: number;
  hp: number;
  gold: number;
  location: LocationId;
  weather: Weather;
  tomorrowWeather: Weather;
  /** farm[row][col]，最后两行是温室 */
  farm: Tile[][];
  inventory: Record<string, number>;
  shippingBin: Record<string, number>;
  skills: Record<SkillId, number>;
  professions: string[];
  pendingProfessions: { skill: SkillId; level: number }[];
  tools: Record<ToolId, number>;
  toolUpgrade: { tool: ToolId; readyDay: number } | null;
  weapon: string;
  /** 各工具当前耐久；工具等级为 -1 表示已报废/没有 */
  durability: Record<ToolId, number>;
  /** 各已拥有武器当前耐久（按武器 id） */
  weaponDurability: Record<string, number>;
  /** 工具是否装备着；没装备的工具不能用 */
  equippedTools: Record<ToolId, boolean>;
  npcs: Record<string, NpcState>;
  forage: Partial<Record<LocationId, string[]>>;
  forest: ForestState;
  mine: MineState;
  bundles: Record<string, Record<string, number>>;
  rewardsClaimed: string[];
  unlocks: string[];
  activity: Activity | null;
  wedding: { npcId: string; day: number } | null;
  festivalsAttended: string[];
  evaluation: Evaluation | null;
  stats: GameStats;
  rngState: number;
}

export interface Cell {
  row: number;
  col: number;
}

export type Target = 'all' | Cell[];
export type Quantity = number | 'all';

export type Action =
  | { type: 'till'; target: Target }
  | { type: 'water'; target: Target }
  | { type: 'clear'; target: Target }
  | { type: 'harvest'; target: Target }
  | { type: 'plant'; cropId: string; target: Target }
  | { type: 'deweed'; target: Target }
  | { type: 'uproot'; target: Target; onlyWilted?: boolean }
  | { type: 'move'; to: LocationId }
  | { type: 'buy'; itemId: string; qty: number }
  | { type: 'sell'; itemId: string; qty: Quantity }
  | { type: 'ship'; itemId: string | 'all'; qty: Quantity }
  | { type: 'eat'; itemId: string }
  | { type: 'wait'; minutes: number }
  | { type: 'sleep' }
  | { type: 'fish' }
  | { type: 'forage'; index?: number }
  | { type: 'chop' }
  | { type: 'grove'; grove: GroveId }
  | { type: 'forestExplore' }
  | { type: 'talk'; npcId: string }
  | { type: 'gift'; npcId: string; itemId: string }
  | { type: 'enterMine'; floor?: number }
  | { type: 'mineRock'; count: Quantity }
  | { type: 'attack' }
  | { type: 'descend' }
  | { type: 'leaveMine' }
  | { type: 'upgrade'; tool: ToolId }
  | { type: 'equipWeapon'; itemId: string }
  | { type: 'unequipWeapon' }
  | { type: 'equipTool'; tool: ToolId }
  | { type: 'unequipTool'; tool: ToolId }
  | { type: 'repair'; target: string }
  | { type: 'donate'; itemId: string | 'all' }
  | { type: 'festival' }
  | { type: 'choose'; index: number };

export type EventLevel = 'info' | 'good' | 'warn' | 'bad' | 'love';

export interface GameEvent {
  level: EventLevel;
  text: string;
}

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
  ok: boolean;
}
