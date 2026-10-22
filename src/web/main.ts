import { BUNDLES, ROOMS } from '../data/bundles.js';
import { BAG_SELL_RATE, CLINIC, DURABILITY, FISH_MAX_ROUNDS, POINTS_PER_HEART, SAVE_VERSION, TOOL_POWER } from '../data/config.js';
import { CROPS } from '../data/crops.js';
import { FISH, FISHING_SPOT_DEFS } from '../data/fish.js';
import { BAITS, BAIT_BY_ID, ensureFishingGear, equippedRod, RODS, ROD_BY_ID, ROD_BY_ITEM, WORKBENCHES, type WorkbenchId } from '../data/fishingGear.js';
import { ITEMS, itemName, rarityOf } from '../data/items.js';
import { GROVES } from '../data/forest.js';
import { FORAGE } from '../data/forage.js';
import { MONSTERS, WEAPONS, ORES, GEMS, MINE_CHESTS } from '../data/mine.js';
import { NPC_BY_ID, NPCS } from '../data/npcs.js';
import { SKILL_NAMES, SKILL_ORDER, TOOL_LEVEL_NAMES, TOOL_NAMES } from '../data/skills.js';
import { LOCATIONS, SEASON_NAMES, TRAVEL_DESTINATIONS, WEATHER_NAMES } from '../data/world.js';
import { applyAction, travelTime } from '../engine/actions.js';
import { activityView } from '../engine/activity.js';
import { formatDate, formatTime, shopClosedReason, todayFestival } from '../engine/calendar.js';
import { cellName } from '../engine/farm.js';
import { createNewGame } from '../engine/state.js';
import { CANDLE_TEXT } from '../engine/evaluation.js';
import { ensureCollection } from '../engine/util.js';
import { ensureEquipment, repairCost, toolMaxDurability, weaponMaxDurability } from '../engine/systems/equipment.js';
import { maxHp, sellPrice, skillLevel, skillProgressOf, type SkillProgress } from '../engine/skills.js';
import { bundleDone, donatedCount, neededItems } from '../engine/systems/bundles.js';
import { shopsAt } from '../engine/systems/economy.js';
import { availableFish, fishingSpotAccessReason, FISHING_SPOTS } from '../engine/systems/fishing.js';
import { clinicCost, clinicOpen } from '../engine/systems/clinic.js';
import { elevatorFloors } from '../engine/systems/mine.js';
import { canRomance, giftEvaluation, heartsOf, isBirthday, npcLocation, npcsHere, playerGenderOf, relationTier, shopUnavailableReason, type GiftTier } from '../engine/systems/social.js';
import { settlePendingUpgrade, upgradeCost } from '../engine/systems/tools.js';
import type { Action, Evaluation, GameEvent, GameState, GroveId, LocationId, SkillId, Tile, ToolId } from '../engine/types.js';
import { cropGrowthSvg, itemIconSvg, npcAvatarSvg, playerAvatarSvg, rarityBadgeSvg, stumpSvg, tileDebuffBadgesSvg, tileGroundSvg, tileStatusSvg, toolIconSvg, treeSvg, uiIconSvg } from './icons.js';
const SAVE_KEY = 'qinghe-valley-save';
const SAVES_KEY = 'qinghe-valley-saves-v2';
const MAX_SAVES = 5;
const $ = (id: string) => document.getElementById(id)!;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** 四大主页面与二级页签定义 */
type PageId = 'scene' | 'bag' | 'social' | 'journal';
type FarmSubTab = 'field' | 'greenhouse';
type SocialSubTab = 'here' | 'all';
type JournalSubTab = 'skills' | 'bundles' | 'records' | 'codex';

/** 多样化交互弹窗状态（店铺弹窗使用 openShopId 独立承载，活动事件使用引擎 activity 承载） */
type UiModalState =
  | { kind: 'map' }
  | { kind: 'item'; itemId: string }
  | { kind: 'tool'; tool: ToolId }
  | { kind: 'npc'; npcId: string }
  | { kind: 'bundle'; roomId: string }
  | { kind: 'clinic' }
  | { kind: 'settings' }
  | { kind: 'saves' }
  | { kind: 'profile' }
  | { kind: 'codex'; itemId: string }
  | { kind: 'craft'; bench?: WorkbenchId }
  | { kind: 'create' }
  | { kind: 'seedBag' }
  | null;

type TileFxKind = 'till' | 'water' | 'plant' | 'harvest' | 'clear' | 'deweed' | 'uproot';

interface ToastFx {
  id: number;
  text: string;
  tone: 'good' | 'warn' | 'bad';
}

interface SaveSlot {
  id: string;
  createdAt: number;
  updatedAt: number;
  state: GameState;
}
let saveSlots: SaveSlot[] = [];
let activeSaveId: string | null = null;
/** 尚无任何存档时为 true: 当前 state 只是未落盘的临时预览, 必须先完成角色创建 */
let needsCharacterSetup = false;
/** 角色创建弹窗: 目标 (首次/新档/覆盖指定槽) 与待确认的性别、姓名草稿 (姓名性别确认后不可修改) */
let createTarget: { mode: 'first' | 'new' | 'overwrite'; slotId?: string } | null = null;
let createGender: import('../engine/types.js').Gender = 'male';
let createNameDraft = '';
/** 存档弹窗的覆盖选择模式 (满 5 档开启新游戏时进入) */
let savesOverwriteMode = false;

let state: GameState = loadInitial();
let page: PageId = 'scene';
let farmSubTab: FarmSubTab = 'field';
let socialSubTab: SocialSubTab = 'here';
let journalSubTab: JournalSubTab = 'skills';

/** 当前点中的农田格子；点中后在就近浮层里展示操作 */
let selectedCell: { row: number; col: number } | null = null;
let qty: number | 'all' = 1;
let selectedItem: string | null = null;
let giftNpc: string | null = null;
let bagFilter = 'all';
let selectedEquipment: { kind: 'tool'; tool: ToolId } | { kind: 'weapon'; itemId: string } | null = null;
let openShopId: string | null = null;
let uiModal: UiModalState = null;

let log: GameEvent[] = [
  { level: 'info' as const, text: '爷爷留下的信里写着："山谷里那块地，就交给你了。"' },
  { level: 'info' as const, text: '点击农田格子弹出地块操作浮层；切换地点只用顶部「当前地点」按钮，页面用上方四个整页页签切换。' },
];

/** 页面入场动画只在切换主页面时播一次；页内点击（选地块、子页签、操作）重渲染不重播，避免闪烁 */
let pageEnterPending = true;
const pageViewCls = () => (pageEnterPending ? 'page-view enter' : 'page-view');

/** 农事与矿洞操作微动效状态 */
let tileFxMap = new Map<string, { kind: TileFxKind; floatText?: string }>();
let mineFxState: { rockHit: boolean; slash: boolean; dmgText?: string; crit?: boolean; playerHit?: boolean } = {
  rockHit: false,
  slash: false,
};
let forestChopFx = false;
let wearFlash = false;
let breakShake = false;

/** 居民互动动效（一次性）：聊天/赠礼后按亲密度变化与赠礼评价档位播放粒子、头像与气泡 */
type NpcFxTone = 'beloved' | 'loved' | 'liked' | 'neutral' | 'cheap' | 'disliked' | 'hated' | 'talk';
let npcFxState: { npcId: string; tone: NpcFxTone; delta: number; label?: string } | null = null;

const NPC_FX_PARTICLES: Record<NpcFxTone, string[]> = {
  beloved: ['heart', 'sparkle', 'heart', 'star', 'heart', 'sparkle'],
  loved: ['heart', 'heart', 'heart', 'sparkle', 'heart'],
  liked: ['heart', 'heart', 'sparkle', 'heart'],
  neutral: ['star', 'star'],
  cheap: ['drop', 'drop'],
  disliked: ['heart_broken', 'drop'],
  hated: ['heart_broken', 'heart_empty', 'warning'],
  talk: ['chat', 'heart', 'note'],
};
const fxParticle = (name: string) => uiIconSvg(name);

/** 亲密度细进度：当前心内点数进度与距下一心差值 */
function friendshipBarHtml(npcId: string): string {
  const pts = state.npcs[npcId].friendship;
  const into = pts % POINTS_PER_HEART;
  const pct = Math.round((into / POINTS_PER_HEART) * 100);
  const isMax = heartsOf(state, npcId) >= 10;
  return `<div class="friend-bar" title="亲密度 ${pts} 点">
    <div class="friend-bar-fill" style="width:${isMax ? 100 : pct}%"></div>
    <span>${pts} 点${isMax ? ' · 已满心' : ` · 距下一心还差 ${POINTS_PER_HEART - into} 点`}</span>
  </div>`;
}
let toastSeq = 1;
let toasts: ToastFx[] = [];
let nightFlash = false;
let farmEntered = false;

/** 青禾森林多段砍伐、采集点与奇遇翻牌前端状态 */
const TREE_NAMES = ['青松', '古橡', '白桦', '枫香', '冷杉', '板栗', '翠柏', '山榆'];
const MYSTERY_CARDS = [
  { title: '林间古树洞', sub: '老树根下隐约有松果与微光' },
  { title: '灌木丛深处', sub: '枝叶晃动，传来窸窣响声' },
  { title: '溪畔小空地', sub: '阳光透过树冠洒在草地上' },
];
let forestDayKey = '';
let forestTreeSlots: { hits: number; stump: boolean; floatText?: string; fx?: 'hit' | 'fall' }[] = [];
let activeChopIdx: number | null = null;
let groveFxId: GroveId | null = null;
let groveFloatMap = new Map<GroveId, string>();
let mysteryState: { spotIdx: number | null; resultText: string; flipFx: boolean } = {
  spotIdx: null,
  resultText: '',
  flipFx: false,
};

function syncForestUiState(): void {
  const key = `${state.year}-${state.season}-${state.day}`;
  if (forestDayKey !== key || forestTreeSlots.length !== 8) {
    forestDayKey = key;
    forestTreeSlots = Array.from({ length: 8 }, () => ({ hits: 0, stump: false }));
    groveFloatMap.clear();
    mysteryState = {
      spotIdx: null,
      resultText: state.forest.exploredToday ? '今天已在林间探索过，收获了一份林间奇遇。' : '',
      flipFx: false,
    };
  }
  const targetStumps = Math.max(0, Math.min(8, 8 - state.forest.trees));
  let curStumps = forestTreeSlots.filter((t) => t.stump).length;
  for (let i = 0; i < 8 && curStumps < targetStumps; i++) {
    if (!forestTreeSlots[i].stump) {
      forestTreeSlots[i].stump = true;
      forestTreeSlots[i].hits = 3;
      curStumps++;
    }
  }
  for (let i = 7; i >= 0 && curStumps > targetStumps; i--) {
    if (forestTreeSlots[i].stump) {
      forestTreeSlots[i].stump = false;
      forestTreeSlots[i].hits = 0;
      curStumps--;
    }
  }
}

function normalizeLoadedState(data: GameState): GameState | null {
  if (!data || data.version !== SAVE_VERSION) return null;
  ensureEquipment(data);
  settlePendingUpgrade(data); // 旧存档等待中的升级加载时直接完成
  ensureFishingGear(data);
  if (data.playerGender !== 'female' && data.playerGender !== 'male') data.playerGender = 'male';
  if (typeof data.playerName !== 'string' || !data.playerName.trim()) data.playerName = '农场主';
  if (typeof data.autoPlantCropId !== 'string') data.autoPlantCropId = null;
  // 旧版自动工坊总开关迁移: 已解锁 auto_daily 的存档补齐三台机器的每日自动
  if (Array.isArray(data.unlocks) && data.unlocks.includes('auto_daily')) {
    for (const u of ['auto_clear_daily', 'auto_plant_daily', 'auto_harvest_daily']) {
      if (!data.unlocks.includes(u)) data.unlocks.push(u);
    }
  }
  ensureCollection(data);
  return data;
}

function persistSaves(): void {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify({ activeId: activeSaveId, slots: saveSlots }));
  } catch {
    /* localStorage 不可用时静默 */
  }
}

/** 把当前 state 落盘到活动存档槽 (无活动槽时不落盘, 等角色创建完成) */
function save(): void {
  const slot = saveSlots.find((x) => x.id === activeSaveId);
  if (!slot) return;
  slot.state = state;
  slot.updatedAt = Date.now();
  persistSaves();
}

/** 初次加载: 多存档 -> 旧单存档迁移 -> 无存档则进入角色创建 */
function loadInitial(): GameState {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { activeId?: string; slots?: SaveSlot[] };
      const slots = (parsed.slots ?? [])
        .map((slot) => {
          const st = slot?.state ? normalizeLoadedState(slot.state) : null;
          return st ? { id: String(slot.id), createdAt: slot.createdAt || Date.now(), updatedAt: slot.updatedAt || Date.now(), state: st } : null;
        })
        .filter((x): x is SaveSlot => !!x)
        .slice(0, MAX_SAVES);
      if (slots.length) {
        saveSlots = slots;
        const active = slots.find((x) => x.id === parsed.activeId) ?? slots[0];
        activeSaveId = active.id;
        return active.state;
      }
    }
  } catch {
    /* 损坏的多存档数据按无存档处理 */
  }
  try {
    const legacy = localStorage.getItem(SAVE_KEY);
    if (legacy) {
      const st = normalizeLoadedState(JSON.parse(legacy) as GameState);
      if (st) {
        const now = Date.now();
        const slot: SaveSlot = { id: `save-${now}`, createdAt: now, updatedAt: now, state: st };
        saveSlots = [slot];
        activeSaveId = slot.id;
        persistSaves();
        localStorage.removeItem(SAVE_KEY);
        return st;
      }
    }
  } catch {
    /* 旧存档损坏时进入角色创建 */
  }
  needsCharacterSetup = true;
  createTarget = { mode: 'first' };
  return createNewGame(Date.now());
}

function pushToast(text: string, tone: 'good' | 'warn' | 'bad' = 'warn'): void {
  const id = toastSeq++;
  toasts = [...toasts.slice(-3), { id, text, tone }];
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    renderToasts();
  }, 1400);
}

function renderToasts(): void {
  const layer = document.getElementById('fx-toast-layer');
  if (!layer) return;
  layer.innerHTML = toasts.map((t) => `<div class="fx-toast ${t.tone}">${esc(t.text)}</div>`).join('');
}

let craftRevealTimer: number | null = null;
function playCraftRevealFx(itemId: string, qty: number, subtitle: string): void {
  const layer = document.getElementById('craft-reveal-layer');
  if (!layer) return;
  if (craftRevealTimer) clearTimeout(craftRevealTimer);
  const item = ITEMS[itemId];
  const r = rarityOf(itemId);
  const bagTab = document.querySelector<HTMLElement>('.nav-tab[data-page="bag"]');
  const rect = bagTab?.getBoundingClientRect();
  const dx = rect ? Math.round(rect.left + rect.width / 2 - window.innerWidth / 2) : -140;
  const dy = rect ? Math.round(rect.top + rect.height / 2 - window.innerHeight / 2) : -240;
  const highTier = r.tier >= 2;
  layer.innerHTML = `
    <div class="craft-reveal-stage rarity-tier-${r.tier} ${highTier ? 'high-tier' : ''}" style="--fly-x:${dx}px;--fly-y:${dy}px;">
      <div class="craft-reveal-backdrop"></div>
      <div class="craft-reveal-card">
        <div class="craft-reveal-rays"></div>
        <div class="craft-reveal-sparks">
          <span>✦</span><span>★</span><span>✦</span><span>★</span><span>✦</span><span>★</span>
        </div>
        <span class="craft-reveal-tier">★ ${r.name}品质 · 制作完成 ★</span>
        <div class="craft-reveal-icon">${itemIconSvg(itemId)}</div>
        <b class="craft-reveal-name">${esc(item?.name ?? itemId)}${qty > 1 ? ` ×${qty}` : ''}</b>
        <small class="craft-reveal-sub">${esc(subtitle)}</small>
        <small class="craft-reveal-dest">已收入背包与装备栏</small>
      </div>
    </div>`;
  layer.classList.add('active');
  setTimeout(() => {
    const stage = layer.querySelector('.craft-reveal-stage');
    stage?.classList.add('fly-to-bag');
    bagTab?.classList.add('bag-catch-pulse');
    setTimeout(() => bagTab?.classList.remove('bag-catch-pulse'), 520);
  }, 920);
  craftRevealTimer = window.setTimeout(() => {
    layer.classList.remove('active');
    layer.innerHTML = '';
  }, 1520);
}

/** VectorCraft 设计的《青禾谷物语》圆形山谷徽章 SVG */
function brandCrestSvg(): string {
  return `<svg class="brand-logo-crest" viewBox="0 0 116 116" aria-hidden="true">
    <circle cx="58" cy="58" r="55" fill="#3d2410" stroke="#ffd23f" stroke-width="5"/>
    <circle cx="58" cy="58" r="49" fill="#87ceeb"/>
    <circle cx="58" cy="34" r="18" fill="#ffd23f" stroke="#fff3c4" stroke-width="3"/>
    <path d="M10 74 L38 34 L66 68 L86 40 L106 74 Z" fill="#2e6f40" stroke="#1e3a24" stroke-width="2" stroke-linejoin="round"/>
    <path d="M8 72 L34 60 L68 64 L108 72 L100 98 L58 106 L18 98 Z" fill="#6abe30" stroke="#2e6f40" stroke-width="2" stroke-linejoin="round"/>
    <path d="M50 64 L64 64 L80 104 L42 104 Z" fill="#3a86ff" stroke="#fff3c4" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="22" y="56" width="22" height="18" fill="#f3e5be" stroke="#3d2410" stroke-width="2"/>
    <path d="M18 58 L33 43 L48 58 Z" fill="#e0483e" stroke="#3d2410" stroke-width="2" stroke-linejoin="round"/>
    <rect x="29" y="61" width="7" height="7" fill="#ffd23f" stroke="#3d2410" stroke-width="1.5"/>
    <path d="M81 92 L81 50 M81 74 L67 62 L73 52 L81 64 Z M81 68 L95 56 L89 46 L81 58 Z" fill="#6abe30" stroke="#ffd23f" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="81,27 83.8,33 90.2,33.8 85.4,38.2 86.7,44.6 81,41.3 75.3,44.6 76.6,38.2 71.8,33.8 78.2,33" fill="#ffd23f" stroke="#3d2410" stroke-width="1.3"/>
  </svg>`;
}

/** VectorCraft 设计的 480×160 横版木牌徽章全幅 SVG（用于开幕/刷新中心展示） */
function brandPlaqueSvg(): string {
  return `<svg class="refresh-plaque" viewBox="0 0 480 160" role="img" aria-label="青禾谷物语 QINGHE VALLEY TALES">
    <rect x="14" y="14" width="456" height="136" rx="18" fill="#3d2410"/>
    <rect x="10" y="10" width="456" height="136" rx="18" fill="#7a4a21" stroke="#3d2410" stroke-width="4"/>
    <rect x="18" y="18" width="440" height="120" rx="12" fill="#f3e5be" stroke="#ffd23f" stroke-width="3"/>
    <circle cx="82" cy="78" r="56" fill="#3d2410" stroke="#ffd23f" stroke-width="4"/>
    <circle cx="82" cy="78" r="50" fill="#87ceeb"/>
    <circle cx="82" cy="54" r="19" fill="#ffd23f" stroke="#fff3c4" stroke-width="3"/>
    <path d="M34 94 L62 54 L90 88 L110 60 L130 94 Z" fill="#2e6f40" stroke="#1e3a24" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 92 L58 80 L92 84 L132 92 L124 118 L82 128 L42 118 Z" fill="#6abe30" stroke="#2e6f40" stroke-width="2" stroke-linejoin="round"/>
    <path d="M74 84 L88 84 L104 124 L66 126 Z" fill="#3a86ff" stroke="#fff3c4" stroke-width="1.5" stroke-linejoin="round"/>
    <rect x="46" y="76" width="22" height="18" fill="#f3e5be" stroke="#3d2410" stroke-width="2"/>
    <path d="M42 78 L57 63 L72 78 Z" fill="#e0483e" stroke="#3d2410" stroke-width="2" stroke-linejoin="round"/>
    <rect x="53" y="81" width="7" height="7" fill="#ffd23f" stroke="#3d2410" stroke-width="1.5"/>
    <path d="M105 112 L105 70 M105 94 L91 82 L97 72 L105 84 Z M105 88 L119 76 L113 66 L105 78 Z" fill="#6abe30" stroke="#ffd23f" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="105,49 107.6,54.6 113.8,55.4 109.2,59.6 110.4,65.7 105,62.6 99.6,65.7 100.8,59.6 96.2,55.4 102.4,54.6" fill="#ffd23f" stroke="#3d2410" stroke-width="1.4"/>
    <rect x="158" y="96" width="276" height="28" rx="6" fill="#2b1b0e" stroke="#ffd23f" stroke-width="2"/>
    <text x="298" y="76" text-anchor="middle" font-size="38" font-weight="bold" fill="#3d2410">青禾谷物语</text>
    <text x="295" y="73" text-anchor="middle" font-size="38" font-weight="bold" fill="#7a4a21">青禾谷物语</text>
    <text x="296" y="115" text-anchor="middle" font-size="14" font-weight="bold" fill="#ffd23f">★ QINGHE VALLEY TALES ★</text>
  </svg>`;
}

let refreshFxTimer: number | null = null;
/** EffectCraft 设计的页面刷新开幕动效：上下木质帷幕开启 + 太阳光晕绽放 + 中央徽章飞入左上角 HUD */
function playPageRefreshFx(): void {
  const layer = document.getElementById('page-refresh-layer');
  const hudLogo = document.getElementById('hud-logo');
  if (!layer) return;
  if (refreshFxTimer) clearTimeout(refreshFxTimer);
  const rect = hudLogo?.getBoundingClientRect();
  const dx = rect ? Math.round(rect.left + rect.width / 2 - window.innerWidth / 2) : -320;
  const dy = rect ? Math.round(rect.top + rect.height / 2 - window.innerHeight / 2) : -220;
  layer.classList.remove('glide-to-hud');
  layer.style.setProperty('--logo-dx', `${dx}px`);
  layer.style.setProperty('--logo-dy', `${dy}px`);
  layer.innerHTML = `
    <div class="refresh-curtain top"></div>
    <div class="refresh-curtain bottom"></div>
    <div class="refresh-halo"></div>
    <div class="refresh-plaque-wrap">${brandPlaqueSvg()}</div>`;
  layer.classList.add('active');
  document.body.classList.remove('page-refresh-enter');
  void document.body.offsetWidth;
  document.body.classList.add('page-refresh-enter');
  setTimeout(() => {
    layer.classList.add('glide-to-hud');
    hudLogo?.classList.add('logo-land-pulse');
    setTimeout(() => hudLogo?.classList.remove('logo-land-pulse'), 540);
  }, 620);
  refreshFxTimer = window.setTimeout(() => {
    layer.classList.remove('active', 'glide-to-hud');
    layer.innerHTML = '';
    document.body.classList.remove('page-refresh-enter');
  }, 1320);
}

let sceneFxTimer: number | null = null;

/** VectorCraft 设计的纯圆形无黑框清晨天象徽章（晴天朝阳 / 小雨云滴 / 暴风雨雷云 / 大雪冰晶 / 昏睡弯月） */
function sleepWeatherEmblemSvg(weather: GameState['weather'], passedOut: boolean): string {
  if (passedOut) {
    return `<svg viewBox="0 0 160 160" width="144" height="144" aria-hidden="true">
      <circle cx="80" cy="80" r="68" fill="#7986cb" fill-opacity="0.16"/>
      <circle cx="80" cy="80" r="54" fill="#7986cb" fill-opacity="0.28"/>
      <circle cx="80" cy="80" r="42" fill="#3949ab" fill-opacity="0.5" stroke="#c5cae9" stroke-width="2.5"/>
      <path d="M90 46 C70 46 54 62 54 82 C54 102 70 118 90 118 C99 118 107 114 113 108 C99 110 85 100 83 84 C81 68 91 54 105 50 C100 47 95 46 90 46 Z" fill="#ffe082" stroke="#fff8e1" stroke-width="2"/>
    </svg>`;
  }
  if (weather === 'rain') {
    return `<svg viewBox="0 0 160 160" width="144" height="144" aria-hidden="true">
      <circle cx="80" cy="80" r="68" fill="#4fc3f7" fill-opacity="0.16"/>
      <circle cx="80" cy="80" r="54" fill="#4fc3f7" fill-opacity="0.28"/>
      <circle cx="80" cy="80" r="42" fill="#1e3f5a" stroke="#81d4fa" stroke-width="2.5"/>
      <path d="M54 88 C47 88 42 82 44 74 C46 66 54 62 62 64 C66 52 80 46 94 50 C106 52 112 62 112 70 C120 70 126 76 124 84 C122 88 116 88 110 88 Z" fill="#90caf9" stroke="#e3f2fd" stroke-width="2.5"/>
      <path d="M62 96 L56 112 M82 98 L76 116 M102 96 L96 112" stroke="#29b6f6" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
  }
  if (weather === 'storm') {
    return `<svg viewBox="0 0 160 160" width="144" height="144" aria-hidden="true">
      <circle cx="80" cy="80" r="68" fill="#9575cd" fill-opacity="0.2"/>
      <circle cx="80" cy="80" r="54" fill="#9575cd" fill-opacity="0.34"/>
      <circle cx="80" cy="80" r="42" fill="#263238" stroke="#ffd54f" stroke-width="2.5"/>
      <path d="M54 84 C47 84 42 78 44 70 C46 62 54 58 62 60 C66 48 80 42 94 46 C106 48 112 58 112 66 C120 66 126 72 124 80 C122 84 116 84 110 84 Z" fill="#455a64" stroke="#90a4ae" stroke-width="2.5"/>
      <path d="M84 78 L68 100 L82 100 L72 122 L100 94 L84 94 Z" fill="#ffd54f" stroke="#fff9c4" stroke-width="1.5"/>
    </svg>`;
  }
  if (weather === 'snow') {
    return `<svg viewBox="0 0 160 160" width="144" height="144" aria-hidden="true">
      <circle cx="80" cy="80" r="68" fill="#b3e5fc" fill-opacity="0.18"/>
      <circle cx="80" cy="80" r="54" fill="#b3e5fc" fill-opacity="0.32"/>
      <circle cx="80" cy="80" r="40" fill="#e1f5fe" fill-opacity="0.24" stroke="#81d4fa" stroke-width="3"/>
      <path d="M80 48 L80 112 M48 80 L112 80 M57 57 L103 103 M103 57 L57 103" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
      <circle cx="80" cy="80" r="8" fill="#ffffff"/>
    </svg>`;
  }
  // sunny: 纯圆多层同心金日 + 12 芒冠 + 柔光高光，无任何 CSS filter / box-shadow 方形离屏纹理
  return `<svg viewBox="0 0 160 160" width="144" height="144" aria-hidden="true">
    <circle cx="80" cy="80" r="72" fill="#ffb300" fill-opacity="0.16"/>
    <circle cx="80" cy="80" r="58" fill="#ff9e2c" fill-opacity="0.34"/>
    <polygon points="80,26 89,42 107,33 107,53 127,53 118,71 134,80 118,89 127,107 107,107 107,127 89,118 80,134 71,118 53,127 53,107 33,107 42,89 26,80 42,71 33,53 53,53 53,33 71,42" fill="#ffb300" stroke="#fff3c4" stroke-width="1.5"/>
    <circle cx="80" cy="80" r="34" fill="#ffd54f" stroke="#fff9c4" stroke-width="3"/>
    <ellipse cx="70" cy="68" rx="12" ry="8" fill="#fffde7" fill-opacity="0.88"/>
  </svg>`;
}

/** EffectCraft + VectorCraft 设计的分天气睡觉转场动效：不同次日天气展现各自天象与粒子 */
function playSleepFx(s: GameState, passedOut = false): void {
  const layer = document.getElementById('scene-fx-layer');
  if (!layer) return;
  closeGrandpaEvalFx();
  const w = s.weather;
  const dateText = `${formatDate(s)} · ${WEATHER_NAMES[w]}`;
  const headlineByWeather: Record<GameState['weather'], string> = {
    sunny: '☀ 晨光初照 · 晴朗的一天开始了',
    rain: '🌧 细雨润泽 · 今日农田免浇水',
    storm: '⛈ 雷雨交加 · 狂风掠过青禾谷',
    snow: '❄ 瑞雪纷飞 · 银装素裹的清晨',
  };
  const headline = passedOut ? '☾ 深夜昏睡 · 被送回农舍' : headlineByWeather[w];
  const themeCls = passedOut ? 'weather-night' : `weather-${w}`;
  let ambientHtml = '';
  if (passedOut || w === 'sunny') {
    ambientHtml = `<div class="sleep-fx-stars"><span>✦</span><span>★</span><span>✦</span><span>★</span><span>✦</span></div>`;
  } else if (w === 'rain' || w === 'storm') {
    ambientHtml = `<div class="sleep-fx-rain"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>${w === 'storm' ? '<div class="sleep-fx-flash"></div>' : ''}`;
  } else if (w === 'snow') {
    ambientHtml = `<div class="sleep-fx-snow"><span>❄</span><span>❅</span><span>✦</span><span>❄</span><span>❅</span><span>❄</span></div>`;
  }
  layer.innerHTML = `
    <div class="sleep-fx-stage ${themeCls}">
      ${ambientHtml}
      <div class="sleep-fx-orb">${sleepWeatherEmblemSvg(w, passedOut)}</div>
      <div class="sleep-fx-card">
        <b>${esc(headline)}</b>
        <span>${esc(dateText)}</span>
      </div>
    </div>`;
  layer.classList.add('active');
  sceneFxTimer = window.setTimeout(() => {
    layer.classList.remove('active');
    layer.innerHTML = '';
  }, 1360);
}

/**
 * VectorCraft 设计的像素风「爷爷的午后向日葵田梦境」插画：
 * 草帽白胡子爷爷坐在田埂木凳上，4 株向日葵按前两年成绩逐株绽放（未开的保持青绿花苞/嫩芽）。
 */
function grandpaDreamFieldSvg(tier: number): string {
  const skyBg = tier === 4 ? '#fef08a' : tier === 3 ? '#fde68a' : tier === 2 ? '#7dd3fc' : '#bae6fd';
  const meadowBg = tier === 4 ? '#9ccc65' : tier === 3 ? '#8bc34a' : '#7cb342';
  const rainbow =
    tier === 4
      ? `<path d="M 16 108 Q 140 16 264 108" fill="none" stroke="#f43f5e" stroke-width="5" stroke-opacity="0.55"/>
         <path d="M 22 112 Q 140 24 258 112" fill="none" stroke="#fbbf24" stroke-width="4" stroke-opacity="0.55"/>
         <path d="M 28 116 Q 140 32 252 116" fill="none" stroke="#34d399" stroke-width="4" stroke-opacity="0.5"/>`
      : '';
  const cabin =
    tier >= 3
      ? `<g class="pixel-cabin">
          <rect x="20" y="76" width="34" height="28" fill="#d97706" stroke="#78350f" stroke-width="2"/>
          <polygon points="15,76 37,56 59,76" fill="${tier === 4 ? '#dc2626' : '#b45309'}" stroke="#78350f" stroke-width="2"/>
          <rect x="32" y="88" width="10" height="16" fill="#78350f"/>
          <rect x="24" y="82" width="6" height="6" fill="#fef08a"/>
        </g>`
      : '';
  const dog =
    tier === 4
      ? `<g class="pixel-dog">
          <rect x="56" y="96" width="16" height="10" fill="#f59e0b" stroke="#78350f" stroke-width="1.5"/>
          <rect x="68" y="90" width="9" height="9" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
          <rect x="74" y="93" width="3" height="3" fill="#451a03"/>
        </g>`
      : '';
  const flowerXs = [148, 178, 208, 238];
  const renderPlant = (cx: number, bloomed: boolean, idx: number) => {
    if (bloomed) {
      return `<g class="eval-sunflower" style="animation-delay:${0.35 + idx * 0.32}s">
        <rect x="${cx - 2}" y="70" width="4" height="36" fill="#3f6212"/>
        <polygon points="${cx - 2},88 ${cx - 11},82 ${cx - 4},93" fill="#65a30d"/>
        <polygon points="${cx + 2},84 ${cx + 11},78 ${cx + 4},89" fill="#65a30d"/>
        <circle cx="${cx}" cy="66" r="13" fill="#facc15" stroke="#d97706" stroke-width="2" stroke-dasharray="5 2"/>
        <circle cx="${cx}" cy="66" r="6.5" fill="#78350f" stroke="#451a03" stroke-width="1.5"/>
        <rect x="${cx - 3}" y="63" width="2" height="2" fill="#fde047"/>
        <rect x="${cx + 1}" y="66" width="2" height="2" fill="#fde047"/>
      </g>`;
    }
    return `<g class="eval-sprout">
      <rect x="${cx - 1.5}" y="86" width="3" height="20" fill="#4d7c0f"/>
      <polygon points="${cx - 8},92 ${cx},80 ${cx + 8},92" fill="#a3e635" stroke="#3f6212" stroke-width="1.5"/>
    </g>`;
  };
  return `<svg viewBox="0 0 280 144" width="350" height="180" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="4" y="4" width="272" height="136" rx="8" fill="${skyBg}" stroke="#8d5b2c" stroke-width="4"/>
    ${rainbow}
    <!-- 像素暖阳 -->
    <circle cx="236" cy="34" r="${14 + tier * 2}" fill="#fde047" fill-opacity="0.45"/>
    <circle cx="236" cy="34" r="${10 + tier}" fill="#facc15" stroke="#f59e0b" stroke-width="2"/>
    <!-- 远山与青草田埂 -->
    <polygon points="8,104 64,74 124,104" fill="#86efac" opacity="0.55"/>
    <polygon points="96,104 168,68 248,104" fill="#4ade80" opacity="0.45"/>
    <rect x="8" y="102" width="264" height="34" fill="${meadowBg}" stroke="#558b2f" stroke-width="2"/>
    ${cabin}
    ${dog}
    <!-- 田埂木凳与草帽白胡子爷爷（像素风） -->
    <rect x="76" y="96" width="44" height="6" fill="#92400e" stroke="#451a03" stroke-width="1.5"/>
    <rect x="82" y="102" width="5" height="10" fill="#78350f"/>
    <rect x="109" y="102" width="5" height="10" fill="#78350f"/>
    <!-- 爷爷蓝色背带裤与红格衬衣 -->
    <rect x="84" y="72" width="28" height="24" fill="#dc2626" stroke="#78350f" stroke-width="1.5"/>
    <rect x="86" y="78" width="24" height="18" fill="#2563eb" stroke="#1e3a8a" stroke-width="1.5"/>
    <rect x="89" y="72" width="4" height="8" fill="#2563eb"/>
    <rect x="103" y="72" width="4" height="8" fill="#2563eb"/>
    <!-- 爷爷像素笑脸与白胡子 -->
    <rect x="86" y="52" width="24" height="20" fill="#fed7aa" stroke="#78350f" stroke-width="1.5"/>
    <rect x="91" y="58" width="3" height="3" fill="#451a03"/>
    <rect x="102" y="58" width="3" height="3" fill="#451a03"/>
    <rect x="86" y="64" width="24" height="11" fill="#ffffff" stroke="#94a3b8" stroke-width="1"/>
    <rect x="94" y="66" width="8" height="2" fill="#d97706"/>
    <!-- 爷爷的草帽 -->
    <rect x="78" y="48" width="40" height="6" fill="#f59e0b" stroke="#78350f" stroke-width="1.5"/>
    <rect x="85" y="40" width="26" height="9" fill="#fbbf24" stroke="#78350f" stroke-width="1.5"/>
    <rect x="85" y="46" width="26" height="3" fill="#dc2626"/>
    <!-- 4 株向日葵（盛开或花苞） -->
    ${flowerXs.map((cx, i) => renderPlant(cx, i < tier, i)).join('')}
  </svg>`;
}

let evalCountdownTimer: number | null = null;

function closeGrandpaEvalFx(): void {
  const layer = document.getElementById('scene-fx-layer');
  if (sceneFxTimer) {
    clearTimeout(sceneFxTimer);
    sceneFxTimer = null;
  }
  if (evalCountdownTimer) {
    clearInterval(evalCountdownTimer);
    evalCountdownTimer = null;
  }
  if (layer) {
    layer.classList.remove('active', 'interactive');
    layer.innerHTML = '';
  }
}

/**
 * EffectCraft/FigCraft 设计的「午后的梦 · 爷爷的向日葵田」评价动效（第三年春天第 1 天清晨）：
 * 按前两年行为评价盛开 1–4 朵向日葵，支持点击「从梦中醒来」手动关闭，或 10 秒后自动关闭。
 */
function playGrandpaEvalFx(ev: Evaluation): void {
  const layer = document.getElementById('scene-fx-layer');
  if (!layer) return;
  closeGrandpaEvalFx();
  const tier = Math.min(4, Math.max(1, ev.candles));
  const tierLabel = ['嫩芽初醒', '晴空抽苞', '午后盛放', '满田金黄'][tier - 1] ?? '晴空盛放';
  const notesHtml = ev.notes.length
    ? ev.notes.map((n) => `<span>· ${esc(n)}</span>`).join('')
    : '<span>· 这两年在青禾谷悠闲度日，田野正蓄力生长</span>';
  let remainSec = 10;
  layer.innerHTML = `
    <div class="sleep-fx-stage grandpa-eval-fx eval-tier-${tier}">
      <div class="dream-sunbeams"><i></i><i></i><i></i></div>
      <div class="eval-shrine">${grandpaDreamFieldSvg(tier)}</div>
      <div class="sleep-fx-card eval-card">
        <b>🌻 午后的梦 · 爷爷身边盛开了 ${tier} 朵向日葵（${tierLabel}）</b>
        <span class="eval-score-line">📖 爷爷翻开泛黄的小本子 · 两年总评：${ev.score} 分</span>
        <span class="eval-notes">${notesHtml}</span>
        <span class="eval-quote">${esc(CANDLE_TEXT[tier] ?? '')}</span>
        <div class="eval-actions">
          <button type="button" class="eval-wake-btn" id="eval-wake-btn">☀ 从梦中醒来（${remainSec}s）</button>
        </div>
      </div>
    </div>`;
  layer.classList.add('active', 'interactive');
  const btn = document.getElementById('eval-wake-btn');
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeGrandpaEvalFx();
  });
  evalCountdownTimer = window.setInterval(() => {
    remainSec = Math.max(0, remainSec - 1);
    const b = document.getElementById('eval-wake-btn');
    if (b) b.textContent = `☀ 从梦中醒来（${remainSec}s）`;
  }, 1000);
  sceneFxTimer = window.setTimeout(() => {
    closeGrandpaEvalFx();
  }, 10000);
}

/**
 * 切换地点分阶段动效：先播路牌滑入并停在中央，此时尚未移动；
 * 停稳后才执行 apply（真正切换地点并渲染新场景），最后路牌滑出收尾揭开新场景。
 */
let travelFxBusy = false;
let travelFxTimer: number | null = null;
/** 分阶段旅行在 apply 中调用 doAction 时置位，抑制 doAction 内的事后旅行动效，避免重复播放 */
let suppressTravelFx = false;

/** 步行/矿车前往某地的路牌副文案 */
function travelSub(to: LocationId): string {
  const minecart = state.unlocks.includes('minecart');
  return `耗时 ${travelTime(state, to)} 分钟${minecart ? ' · 矿车加速' : ''}`;
}

function playTravelFxStaged(from: LocationId, to: LocationId, sub: string, apply: () => void): void {
  const layer = document.getElementById('scene-fx-layer');
  if (travelFxBusy) return;
  if (!layer || from === to) {
    apply();
    return;
  }
  travelFxBusy = true;
  if (sceneFxTimer) clearTimeout(sceneFxTimer);
  const fromName = LOCATIONS[from]?.name ?? from;
  const toName = LOCATIONS[to]?.name ?? to;
  const minecart = state.unlocks.includes('minecart');
  layer.innerHTML = `
    <div class="travel-fx-stage">
      <div class="travel-fx-board">
        <div class="travel-fx-route">
          <span>${esc(fromName)}</span>
          <span class="travel-fx-arrow">${minecart ? '🚋 ➔' : '➤'}</span>
          <span>${esc(toName)}</span>
        </div>
        <span class="travel-fx-sub">${esc(sub)}</span>
      </div>
    </div>`;
  layer.classList.add('active');
  // 阶段一：路牌滑入停稳（约 0.55s）后才真正切换地点
  travelFxTimer = window.setTimeout(() => {
    suppressTravelFx = true;
    apply();
    if (suppressTravelFx) suppressTravelFx = false;
    // 若移动耗时跨午夜，doAction 已用睡觉动效接管同一图层，旅行收尾不再介入
    const stage = layer.querySelector('.travel-fx-stage');
    if (!stage) {
      travelFxBusy = false;
      travelFxTimer = null;
      return;
    }
    // 阶段二：新场景已渲染，路牌滑出收尾
    stage.classList.add('out');
    travelFxTimer = window.setTimeout(() => {
      if (layer.querySelector('.travel-fx-stage')) {
        layer.classList.remove('active');
        layer.innerHTML = '';
      }
      travelFxBusy = false;
      travelFxTimer = null;
    }, 400);
  }, 560);
}

/** 非显式旅行入口造成的地点变化（如引擎内部附带移动）：已到达目的地，仅补一段路牌揭开动效 */
function playTravelFxReveal(from: LocationId, to: LocationId, mins: number, minecart: boolean): void {
  const sub = mins > 0 ? `耗时 ${mins} 分钟${minecart ? ' · 矿车加速' : ''}` : (LOCATIONS[to]?.arrival ?? '');
  playTravelFxStaged(from, to, sub, () => undefined);
}

function recordActionFx(action: Action, prev: GameState, next: GameState, events: GameEvent[], cells: string[]): void {
  tileFxMap.clear();
  mineFxState = { rockHit: false, slash: false };
  forestChopFx = action.type === 'chop';
  wearFlash = false;
  breakShake = false;

  // 检查工具或武器耐久是否下降/报废/断线
  const durDropped =
    (['hoe', 'can', 'pickaxe', 'rod', 'axe'] as ToolId[]).some((t) => (next.durability[t] ?? 0) < (prev.durability[t] ?? 0)) ||
    Object.keys(next.weaponDurability).some((k) => (next.weaponDurability[k] ?? 0) < (prev.weaponDurability[k] ?? 0));
  if (durDropped) wearFlash = true;

  for (const ev of events) {
    if (ev.text.includes('报废') || ev.text.includes('金属碎片') || ev.text.includes('鱼线崩断')) {
      breakShake = true;
      pushToast(ev.text, 'bad');
    } else if (ev.text.includes('耐久只剩')) {
      pushToast(ev.text, 'warn');
    }
  }

  // 农田操作微动效
  if (action.type === 'clear' || action.type === 'till' || action.type === 'water' || action.type === 'plant' || action.type === 'harvest' || action.type === 'deweed' || action.type === 'uproot') {
    const kind: TileFxKind = action.type;
    let targetCells = [...cells];
    if (!targetCells.length && action.target === 'all') {
      const rows = farmSubTab === 'greenhouse' ? [6, 7] : [0, 1, 2, 3, 4, 5];
      for (const r of rows) {
        for (let c = 0; c < 8; c++) {
          const beforeTile = prev.farm[r][c];
          const afterTile = next.farm[r][c];
          if (action.type === 'water' && !beforeTile.watered && afterTile.watered) targetCells.push(`${r}-${c}`);
          if (action.type === 'harvest' && beforeTile.crop && (!afterTile.crop || afterTile.crop.age < beforeTile.crop.age)) {
            targetCells.push(`${r}-${c}`);
          }
          if (action.type === 'deweed' && beforeTile.weeds && !afterTile.weeds) targetCells.push(`${r}-${c}`);
          if (action.type === 'uproot' && beforeTile.crop && !afterTile.crop) targetCells.push(`${r}-${c}`);
          if (action.type === 'plant' && !beforeTile.crop && afterTile.crop) targetCells.push(`${r}-${c}`);
        }
      }
    }
    for (const key of targetCells) {
      const [rStr, cStr] = key.split('-');
      const r = Number(rStr);
      const c = Number(cStr);
      const prevCrop = prev.farm[r]?.[c]?.crop;
      let floatText: string | undefined;
      if (kind === 'harvest' && prevCrop) {
        floatText = `+${CROPS[prevCrop.cropId].name}`;
      } else if (kind === 'plant' && 'cropId' in action) {
        floatText = `种下${CROPS[action.cropId]?.name ?? ''}`;
      } else if (kind === 'water') {
        floatText = '已浇水';
      } else if (kind === 'till') {
        floatText = undefined; // 开垦完成靠土地变色反馈，不再飘「已开垦」文字
      } else if (kind === 'deweed') {
        floatText = '已除草';
      } else if (kind === 'uproot') {
        floatText = '已铲除';
      }
      tileFxMap.set(key, { kind, floatText });
    }
    if (kind === 'harvest' && targetCells.length > 0) {
      const harvestEv = events.find((e) => e.text.includes('收获了'));
      if (harvestEv) pushToast(harvestEv.text, 'good');
    }
  }

  // 矿洞敲石与战斗微动效
  if (action.type === 'mineRock') {
    mineFxState.rockHit = true;
    const lootEv = events.find((e) => e.level === 'good' || e.text.includes('挖到') || e.text.includes('梯子'));
    if (lootEv) pushToast(lootEv.text, 'good');
  }
  if (action.type === 'attack') {
    mineFxState.slash = true;
    const hitEv = events.find((e) => e.text.includes('点伤害'));
    if (hitEv) {
      const m = hitEv.text.match(/(\d+)\s*点伤害/);
      const crit = hitEv.text.includes('暴击');
      if (m) {
        mineFxState.dmgText = `${crit ? '暴击 ' : ''}-${m[1]}`;
        mineFxState.crit = crit;
      }
    }
    if (next.hp < prev.hp) {
      mineFxState.playerHit = true;
    }
  }

  // 青禾森林砍树、固定采集点、野外采集与深林奇遇翻牌微动效
  groveFxId = null;
  mysteryState.flipFx = false;
  for (const s of forestTreeSlots) {
    s.fx = undefined;
    s.floatText = undefined;
  }
  if (action.type === 'chop') {
    const beforeStumps = new Set(forestTreeSlots.map((t, i) => (t.stump ? i : -1)).filter((i) => i >= 0));
    // 先把玩家实际砍的那棵定为树桩，再让 sync 按树桩数量对齐，
    // 否则 sync 会从第一棵开始补桩，把玩家砍的第三棵又恢复、第一棵却先倒了
    let idx = activeChopIdx;
    if (idx !== null && forestTreeSlots[idx] && !forestTreeSlots[idx].stump) {
      forestTreeSlots[idx].stump = true;
      forestTreeSlots[idx].hits = 3;
    }
    syncForestUiState();
    const chopEv = events.find((e) => e.text.includes('木材'));
    const m = chopEv?.text.match(/木材\s*×(\d+)/);
    const woodText = m ? `+木材 ×${m[1]}` : '+木材';
    if (idx === null || !forestTreeSlots[idx] || !forestTreeSlots[idx].stump) {
      // 通用砍树按钮（未指定具体树）：用 sync 本次新补的那棵树桩，没有则退回第一棵未倒的
      const fresh = forestTreeSlots.findIndex((t, i) => t.stump && !beforeStumps.has(i));
      idx = fresh >= 0 ? fresh : forestTreeSlots.findIndex((t) => !t.stump);
      if (idx >= 0 && forestTreeSlots[idx] && !forestTreeSlots[idx].stump) {
        forestTreeSlots[idx].stump = true;
        forestTreeSlots[idx].hits = 3;
      }
    }
    if (idx !== null && idx >= 0 && forestTreeSlots[idx]) {
      forestTreeSlots[idx].fx = 'fall';
      forestTreeSlots[idx].floatText = woodText;
    }
    if (chopEv) pushToast(chopEv.text, 'good');
    activeChopIdx = null;
  }
  if (action.type === 'grove') {
    groveFxId = action.grove;
    const gEv = events.find((e) => e.text.includes('采到了'));
    if (gEv) {
      const m = gEv.text.match(/采到了：(.+)。/);
      if (m) groveFloatMap.set(action.grove, `+${m[1]}`);
      pushToast(gEv.text, 'good');
    }
  }
  if (action.type === 'forage') {
    const fEv = events.find((e) => e.level === 'good' || e.text.includes('采集'));
    if (fEv) pushToast(fEv.text, 'good');
  }
  if (action.type === 'forestExplore') {
    const exEv = events.find((e) => e.level === 'good' || e.level === 'warn');
    if (exEv) {
      mysteryState.resultText = exEv.text;
      mysteryState.flipFx = true;
      if (mysteryState.spotIdx === null) mysteryState.spotIdx = 0;
      pushToast(exEv.text, exEv.level === 'warn' ? 'warn' : 'good');
    }
  }
  if (action.type === 'fish' || action.type === 'choose') {
    const catchEv = events.find((e) => e.text.includes('钓到了') || e.text.includes('钓上来'));
    const failEv = events.find((e) => e.text.includes('鱼线断了') || e.text.includes('跑掉了'));
    if (catchEv) pushToast(catchEv.text, 'good');
    else if (failEv) pushToast(failEv.text, 'bad');
  }

  // 居民互动动效：聊天小爱心，赠礼按评价档位决定粒子与头像反应
  npcFxState = null;
  if (action.type === 'talk') {
    const npc = NPC_BY_ID[action.npcId];
    const delta = next.npcs[action.npcId].friendship - prev.npcs[action.npcId].friendship;
    if (npc) npcFxState = { npcId: action.npcId, tone: 'talk', delta, label: delta > 0 ? `亲密度 +${delta}` : '今天已经聊过了' };
  }
  if (action.type === 'gift') {
    const npc = NPC_BY_ID[action.npcId];
    const item = ITEMS[action.itemId];
    if (npc && item && action.itemId !== 'bouquet' && action.itemId !== 'pendant') {
      const ev = giftEvaluation(npc, action.itemId, isBirthday(next, npc));
      const delta = next.npcs[action.npcId].friendship - prev.npcs[action.npcId].friendship;
      npcFxState = {
        npcId: action.npcId,
        tone: ev.tier,
        delta,
        label: `${item.name}（${ev.value} 金）· 亲密度 ${delta > 0 ? `+${delta}` : delta}`,
      };
      pushToast(`${npc.name}：${delta > 0 ? '很开心' : delta < 0 ? '不太高兴' : '收下了'}（亲密度 ${delta > 0 ? `+${delta}` : delta}）`, delta > 0 ? 'good' : delta < 0 ? 'bad' : 'warn');
    }
  }
}

function doAction(action: Action, cells: string[] = []): void {
  const prev = structuredClone(state);
  const beforeDay = `${state.year}-${state.season}-${state.day}`;
  const result = applyAction(state, action);
  log = [...result.events, ...log].slice(0, 30);
  if (!result.ok) {
    if (result.events[0]) pushToast(result.events[0].text, 'bad');
    render();
    document.getElementById('stage')?.classList.add('shake');
    setTimeout(() => document.getElementById('stage')?.classList.remove('shake'), 320);
    return;
  }
  state = result.state;
  recordActionFx(action, prev, state, result.events, cells);
  const afterDay = `${state.year}-${state.season}-${state.day}`;
  if (beforeDay !== afterDay) {
    nightFlash = true;
    // 第三年春天第 1 天：爷爷评价刚刚产生时，优先播放分档评价动效而不是普通的天气睡觉动效
    if (!prev.evaluation && state.evaluation) playGrandpaEvalFx(state.evaluation);
    else playSleepFx(state, action.type !== 'sleep');
  } else if (prev.location !== state.location) {
    if (suppressTravelFx) {
      // 已由分阶段旅行动效在移动前播放，此处不重复
      suppressTravelFx = false;
    } else {
      const mins = Math.max(0, state.minutes - prev.minutes);
      playTravelFxReveal(prev.location, state.location, mins, state.unlocks.includes('minecart'));
    }
  }
  save();
  render();
  if (breakShake) {
    document.body.classList.remove('break-shake');
    void document.body.offsetWidth;
    document.body.classList.add('break-shake');
    setTimeout(() => document.body.classList.remove('break-shake'), 460);
  }
  if (nightFlash) setTimeout(() => (nightFlash = false), 50);
}

/* ---------- 通用小组件 ---------- */

const hearts = (n: number) =>
  Array.from({ length: 10 }, (_, i) => uiIconSvg(i < n ? 'heart' : 'heart_empty')).join('');
/** 稀有度像素徽章: 奖章图标 + 档位名 (title 含完整稀有度) */
const rarityBadgeHtml = (id: string, withName = false) => {
  const r = rarityOf(id);
  return `<span class="rarity-badge rarity-${r.tier}" title="稀有度：${r.name}">${rarityBadgeSvg(r.tier)}${withName ? `<small>${r.name}</small>` : ''}</span>`;
};
const heartRow = (n: number, max = 5) =>
  Array.from({ length: max }, (_, i) => uiIconSvg(i < n ? 'heart' : 'heart_empty')).join('');
const starRow = (n: number) => Array.from({ length: Math.max(1, n) }, () => uiIconSvg('star')).join('');
const bar = (value: number, max: number, cls: string) =>
  `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%"></i><span>${Math.ceil(value)}/${max}</span></div>`;

/** 各技能在对应场景里的实际加成说明（与引擎数值一致：每级 -2% 体力、收线 +1.5、伤害 +3%、生命 +10 等） */
function skillEffectText(sk: SkillId): string {
  const lv = skillLevel(state, sk);
  const pct = lv * 2;
  switch (sk) {
    case 'farming':
      return `农事体力消耗 -${pct}%（开垦/浇水/收获）`;
    case 'foraging':
      return `砍树/采集体力消耗 -${pct}%`;
    case 'fishing':
      return `收线速度 +${(lv * 1.5).toFixed(1)}、钓到垃圾概率降低、高等级解锁稀有鱼`;
    case 'mining':
      return `敲石体力消耗 -${pct}%`;
    case 'combat':
      return `伤害 +${lv * 3}%、生命上限 +${lv * 10}`;
  }
}

function skillBadge(sk: SkillId, icon: string): string { icon = uiIconSvg(icon);
  const p: SkillProgress = skillProgressOf(state, sk);
  const next = p.isMax ? '已满级' : `还差 ${p.toNext} 经验升 Lv.${p.level + 1}`;
  return `<span class="skill-badge">${icon} ${SKILL_NAMES[sk]} Lv.${p.level} <small>${skillEffectText(sk)} · ${next}</small></span>`;
}

/** 当前场景对应的技能徽标（农场=耕种、森林=采集、水域=钓鱼、山区/矿洞=采矿+战斗） */
function sceneSkillBadges(): string {
  let badges = '';
  if (state.location === 'farm') badges = skillBadge('farming', 'skill_farming');
  else if (state.location === 'forest') badges = skillBadge('foraging', 'skill_foraging') + skillBadge('fishing', 'skill_fishing');
  else if (state.location === 'beach') badges = skillBadge('fishing', 'skill_fishing');
  else if (state.location === 'mountain' || state.location === 'mine') badges = skillBadge('mining', 'skill_mining') + skillBadge('combat', 'skill_combat');
  return badges ? `<div class="skill-badge-row">${badges}</div>` : '';
}

function cropStage(tile: Tile): { label: string; pct: number; ready: boolean } | null {
  if (!tile.crop) return null;
  const def = CROPS[tile.crop.cropId];
  const ready = tile.crop.age >= def.growDays;
  return { label: def.name, pct: Math.min(100, Math.round((tile.crop.age / def.growDays) * 100)), ready };
}

function tileFace(tile: Tile): { cls: string; glyph: string; sub: string; badges: string } {
  const stage = cropStage(tile);
  const badges = tileDebuffBadgesSvg({
    thirsty: Boolean(stage && !stage.ready && !tile.crop?.wilted && !tile.watered),
    weeds: Boolean(tile.weeds && tile.ground === 'tilled'),
    wilted: Boolean(tile.crop?.wilted),
    fertile: Boolean(tile.fertile && tile.ground === 'tilled'),
  });
  const debuffCls = `${tile.crop?.wilted ? ' debuff-wilted' : ''}${stage && !stage.ready && !tile.crop?.wilted && !tile.watered ? ' debuff-thirsty' : ''}${tile.weeds && tile.ground === 'tilled' ? ' debuff-weeds weedy' : ''}${tile.fertile && tile.ground === 'tilled' ? ' buff-fertile' : ''}`;
  if (tile.ground === 'locked') return { cls: 'locked', glyph: tileGroundSvg('locked'), sub: '', badges: '' };
  if (tile.ground === 'weed') return { cls: 'weed', glyph: tileGroundSvg('weed'), sub: '', badges: '' };
  if (tile.ground === 'stone') return { cls: 'stone', glyph: tileGroundSvg('stone'), sub: '', badges: '' };
  if (tile.ground === 'grass') return { cls: 'grass', glyph: tileGroundSvg('grass'), sub: '', badges: '' };
  if (tile.crop?.wilted && stage) return { cls: `wilted${debuffCls}`, glyph: cropGrowthSvg(tile.crop.cropId, stage.pct, { wilted: true, weeds: tile.weeds }), sub: stage.label, badges };
  if (stage?.ready) return { cls: `ready${debuffCls}`, glyph: cropGrowthSvg(tile.crop!.cropId, 100, { watered: tile.watered, weeds: tile.weeds }), sub: stage.label, badges };
  if (stage) return { cls: `${tile.watered ? 'wet' : 'dry'} crop-growing${debuffCls}`, glyph: cropGrowthSvg(tile.crop!.cropId, stage.pct, { watered: tile.watered, weeds: tile.weeds }), sub: stage.label, badges };
  return { cls: `${tile.watered ? 'wet' : 'dry'} soil-empty${debuffCls}`, glyph: tileGroundSvg(tile.watered ? 'soil_wet' : 'soil'), sub: '', badges };
}

/* ---------- 1. 场景整页 (Scene Page) ---------- */

function tilePopover(): string {
  if (!selectedCell) {
    return `<div class="tile-popover">
      <div class="tile-popover-head"><span class="tile-popover-badge">地块操作</span><span>点击下方任意农田格子，在此弹出清理、开垦、播种、浇水或收获按钮。</span></div>
    </div>`;
  }
  const { row, col } = selectedCell;
  const tile = state.farm[row][col];
  const name = cellName({ row, col });
  const stage = cropStage(tile);
  const seeds = Object.keys(state.inventory).filter((id) => ITEMS[id]?.category === 'seed' && (state.inventory[id] ?? 0) > 0);

  let desc = '';
  let btns = '';
  const op = (opName: string, label: string) =>
    `<button class="pix-btn big-op" data-act="tile-op" data-op="${opName}">${label}</button>`;

  if (tile.ground === 'locked') {
    desc = '温室还没修好，先完成社区中心茶水间的收集包。';
  } else if (tile.ground === 'weed' || tile.ground === 'stone') {
    desc = tile.ground === 'weed' ? '长满了杂草，清理后可开垦。' : '压着一块石头，用镐子清理后可开垦。';
    btns = op('clear', '清理地块');
  } else if (tile.ground === 'grass') {
    desc = '平整的空地，用锄头翻松后就能播种。';
    btns = op('till', '开垦土地');
  } else if (tile.crop?.wilted && stage) {
    desc = `${stage.label}已枯萎，没有产出，铲除后才能重新播种。${tile.weeds ? '这格还长着杂草，铲除时会一并清掉。' : ''}`;
    btns = op('uproot', '铲除枯萎株');
  } else if (stage?.ready) {
    desc = `${stage.label}已经成熟！${tile.weeds ? '但这格有杂草，现在收获产量会减半，先除草再收更好。' : ''}`;
    btns =
      op('harvest', `收获${stage.label}`) +
      (tile.weeds ? op('deweed', '除草') : '') +
      op('uproot', '铲除这株');
  } else if (stage) {
    desc = `${stage.label}生长中（${stage.pct}%）${tile.watered ? ' · 今日已浇水' : ' · 今日待浇水'}${tile.weeds ? ' · 有杂草，正在抢养分，不除草今晚不会生长' : ''}`;
    btns =
      (tile.watered ? '<span class="dim">今天已浇过水，明天继续生长。</span>' : op('water', '给作物浇水')) +
      (tile.weeds ? op('deweed', '除草') : '') +
      op('uproot', '铲除这株');
  } else if (tile.weeds) {
    desc = '土地已开垦，但长了杂草，先除草才能播种。';
    btns = op('deweed', '除草');
  } else {
    desc = '土地已开垦，选择一种当季种子播下：';
    btns = seeds.length
      ? seeds
          .map(
            (id) =>
              `<button class="pix-btn big-op" data-act="tile-plant" data-crop="${ITEMS[id].cropId}">种${ITEMS[id].name.replace('种子', '')}（×${state.inventory[id]}）</button>`,
          )
          .join('')
      : '<span class="dim">没有种子了，去白鹭镇杂货铺买。</span><button class="pix-btn gold" data-act="go-general-store">前往</button>';
  }

  return `<div class="tile-popover" role="region" aria-label="地块操作浮层">
    <div class="tile-popover-head">
      <span class="tile-popover-badge">地块 ${name}</span>
      <span>${desc}</span>
    </div>
    <div class="tile-ops">
      ${btns}
      <button class="pix-btn ghost" data-act="close-tile">收起</button>
    </div>
  </div>`;
}

function farmCounts(rows: number[]): { needWater: number; readyCount: number; weedCount: number; wiltedCount: number } {
  let needWater = 0;
  let readyCount = 0;
  let weedCount = 0;
  let wiltedCount = 0;
  for (const r of rows) {
    for (const tile of state.farm[r]) {
      const st = cropStage(tile);
      if (tile.weeds) weedCount++;
      if (tile.crop?.wilted) wiltedCount++;
      else if (st?.ready) readyCount++;
      else if (st && !tile.watered) needWater++;
    }
  }
  return { needWater, readyCount, weedCount, wiltedCount };
}

function farmScene(): string {
  const fieldStat = farmCounts([0, 1, 2, 3, 4, 5]);
  const ghStat = farmCounts([6, 7]);
  const ghUnlocked = state.unlocks.includes('greenhouse');
  const activeRows = farmSubTab === 'greenhouse' ? [6, 7] : [0, 1, 2, 3, 4, 5];

  const careBadge = (st: ReturnType<typeof farmCounts>) =>
    [st.weedCount ? `草 ${st.weedCount}` : '', st.wiltedCount ? `枯 ${st.wiltedCount}` : ''].filter(Boolean).join(' · ');
  const fieldBadge =
    fieldStat.readyCount || fieldStat.needWater || fieldStat.weedCount || fieldStat.wiltedCount
      ? [`可收 ${fieldStat.readyCount}`, `待浇 ${fieldStat.needWater}`, careBadge(fieldStat)].filter(Boolean).join(' · ')
      : '6×8 格';
  const ghBadge = ghUnlocked
    ? ghStat.readyCount || ghStat.weedCount
      ? [`可收 ${ghStat.readyCount}`, careBadge(ghStat)].filter(Boolean).join(' · ')
      : '四季恒温'
    : '未解锁';

  // 一键播种：点按钮打开背包弹窗选种子（按钮在无种子时置灰）
  const seedIds = Object.keys(state.inventory).filter((id) => ITEMS[id]?.category === 'seed' && (state.inventory[id] ?? 0) > 0);

  const gridHtml = `<div class="farm-grid${farmEntered ? '' : ' enter'}">${activeRows
    .flatMap((r) =>
      state.farm[r].map((tile, c) => {
        const f = tileFace(tile);
        const key = `${r}-${c}`;
        const selected = selectedCell?.row === r && selectedCell?.col === c;
        const fx = tileFxMap.get(key);
        const fxCls = fx ? `fx-${fx.kind}` : '';
        return `<button class="tile ${f.cls} ${fxCls} ${selected ? 'selected' : ''}" style="--d:${((r % 6) * 8 + c) * 16}ms"
          data-act="tile" data-row="${r}" data-col="${c}" aria-label="${key} ${f.sub}" aria-pressed="${selected}">
          ${fx?.floatText ? `<span class="tile-float">${esc(fx.floatText)}</span>` : ''}
          <b>${f.glyph}</b>${f.badges}<small>${f.sub}</small>
          ${tile.crop && !tile.crop.wilted ? `<i class="grow"><em style="width:${cropStage(tile)!.pct}%"></em></i>` : ''}
        </button>`;
      }),
    )
    .join('')}</div>`;

  return `
  <div class="sub-tabs" role="tablist" aria-label="农场区域切换">
    <button class="sub-tab ${farmSubTab === 'field' ? 'on' : ''}" data-act="farm-subtab" data-sub="field" role="tab" aria-selected="${farmSubTab === 'field'}">
      露天农田 <small>${fieldBadge}</small>
    </button>
    <button class="sub-tab ${farmSubTab === 'greenhouse' ? 'on' : ''}" data-act="farm-subtab" data-sub="greenhouse" role="tab" aria-selected="${farmSubTab === 'greenhouse'}">
      温室大棚 <small>${ghBadge}</small>
    </button>
    <div style="margin-left:auto;display:flex;flex-wrap:wrap;gap:8px;">
      <button class="pix-btn" data-act="bulk-water">全部浇水</button>
      <button class="pix-btn gold" data-act="bulk-plant" ${seedIds.length ? '' : 'disabled'}>一键播种</button>
      <button class="pix-btn" data-act="bulk-deweed">全部除草</button>
      <button class="pix-btn gold" data-act="bulk-harvest">全部收获</button>
      <button class="pix-btn" data-act="ship-all">出货全部</button>
      <button class="pix-btn danger" data-act="bulk-uproot-wilted" ${fieldStat.wiltedCount + ghStat.wiltedCount ? '' : 'disabled'}>一键铲除枯萎株${fieldStat.wiltedCount + ghStat.wiltedCount ? `（${fieldStat.wiltedCount + ghStat.wiltedCount} 株）` : ''}</button>
    </div>
  </div>
  ${tilePopover()}
  <div class="farm-stage">${gridHtml}</div>`;
}

function markFarmEntered(): void {
  farmEntered = true;
}

/** 场景里只列店铺卡，商品点进店后才在弹窗里展示 */
function shopCards(): string {
  const shops = shopsAt(state);
  if (!shops.length) return '';
  return `<h3>镇上店铺</h3><div class="cards grid-2">${shops
    .map((shop) => {
      const closed = shopUnavailableReason(state, shop);
      const keeper = shop.keeperName ? `${shop.keeperName}在店 · ` : '';
      return `<button class="card place" data-act="open-shop" data-shop="${shop.id}">
        <b>${shop.name}</b>
        <span>${formatTime(shop.open)}-${formatTime(shop.close)} · ${closed ?? keeper + '营业中'}</span></button>`;
    })
    .join('')}</div>`;
}

function townExtras(): string {
  if (state.location !== 'town') return '';
  const need = neededItems(state).filter((id) => (state.inventory[id] ?? 0) > 0);
  const hpMaxTown = maxHp(state);
  const missingTown = Math.max(0, hpMaxTown - state.hp);
  return `<h3>白芷诊所</h3>
    <div class="cards grid-2">
      <button class="card place" data-act="open-clinic">
        <b>${uiIconSvg('clinic')} 白芷诊所</b>
        <span>${clinicOpen(state) ? '白芷坐诊中' : '白芷去森林采药了（晴天 10 点后回镇）'} · 生命 ${state.hp}/${hpMaxTown}${missingTown ? ` · 缺 ${missingTown} 点，补满 ${missingTown * CLINIC.goldPerHp} 金` : ' · 健康'} · 点击进入诊所</span>
      </button>
    </div>
    <h3>社区中心</h3>
    <div class="room-grid">
      ${ROOMS.map((room) => {
        const bundles = BUNDLES.filter((b) => b.room === room.id);
        const done = bundles.filter((b) => bundleDone(state, b)).length;
        const unlocked = state.unlocks.includes(room.unlock);
        return `<button class="room-card ${unlocked ? 'done' : ''}" data-act="open-bundle-room" data-room="${room.id}">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
            <b>${room.name}</b>
            <span class="badge ${unlocked ? 'ok' : ''}">${done}/${bundles.length} 完成</span>
          </div>
          <span class="dim">${room.unlockText}</span>
          <span style="margin-top:auto;font-weight:bold;color:var(--wood);">点击查看房间与捐献 →</span>
        </button>`;
      }).join('')}
    </div>
    <div class="toolbar" style="margin-top:12px;">
      <button class="pix-btn gold" data-act="donate" ${need.length ? '' : 'disabled'}>一键捐献背包可捐物品（${need.length} 种）</button>
    </div>`;
}

/** 矿洞层头横幅：这一层出什么矿/宝石、有什么怪、安全层与宝箱提示 */
function mineFloorHint(floor: number): string {
  const safe = floor % 5 === 0;
  const ore = ORES.find((o) => floor >= o.floors[0] && floor <= o.floors[1]);
  const gems = GEMS.filter((g) => floor >= g.floors[0] && floor <= g.floors[1]).map((g) => g.name).join('、');
  const foes = MONSTERS.filter((mo) => floor >= mo.floors[0] && floor <= mo.floors[1]).map((mo) => mo.name).join('、');
  const chest = MINE_CHESTS[floor];
  const chestText = chest
    ? `${uiIconSvg('chest')} 本层有宝箱：${[
        chest.gold ? `${chest.gold} 金` : '',
        chest.item ? `${itemName(chest.item[0])} ×${chest.item[1]}` : '',
        chest.weapon ? (WEAPONS.find((w) => w.id === chest.weapon)?.name ?? '') : '',
      ]
        .filter(Boolean)
        .join('、')}（已开过的不再刷新）`
    : '';
  const nextSafe = safe ? '本层就是安全层，电梯已解锁可直达' : `再下 ${5 - (floor % 5)} 层到安全层（电梯点）`;
  return `<div class="mine-hint">
    <b>本层提示</b>
    <span>出产：${ore?.name ?? '矿石'}${gems ? ` · 可能有宝石：${gems}` : ''}</span>
    <span>${safe ? uiIconSvg('shield') + ' 安全层：没有怪物' : `出没：${foes || '无'}`}</span>
    <span>${nextSafe}</span>
    ${chestText ? `<span>${chestText}</span>` : ''}
  </div>`;
}

/** 野外散落采集物舞台：点击哪个只拾取哪个；森林为未知草丛探索节点，不预先展示物品 */
function forageNodesSection(label?: string): string {
  const forage = state.forage[state.location] ?? [];
  if (!forage.length) {
    return state.location === 'forest'
      ? '<p class="dim">今天林间草丛已经探索完了。</p>'
      : '';
  }
  if (state.location === 'forest') {
    return `<h3>${label ?? '林间草丛探索（点击草丛逐个寻找）'}</h3>
    <div class="forage-stage">
      ${forage
        .map(
          (_, idx) => `<button class="forage-node unexplored" data-act="forage-one" data-idx="${idx}" aria-label="未探索的草丛，点击翻开">
            <span class="forage-badge">${tileStatusSvg('weed')}</span>
            <b>草丛 #${idx + 1}</b>
          </button>`,
        )
        .join('')}
    </div>`;
  }
  return `<h3>${label ?? '草丛散落采集物（点击哪个拾取哪个）'}</h3>
    <div class="forage-stage">
      ${forage
        .map(
          (id, idx) => `<button class="forage-node" data-act="forage-one" data-idx="${idx}" title="点击拾取">
            <span class="forage-badge">${itemIconSvg(id)}</span>
            <b>${itemName(id)}</b>
            <small class="dim">#${idx + 1} 点击拾取</small>
          </button>`,
        )
        .join('')}
    </div>`;
}

/** 水域钓鱼台模块（海滩 / 青禾森林 / 山区通用） */
function fishingDockSection(): string {
  if (!FISHING_SPOTS.includes(state.location)) return '';
  const rodLvl = state.tools.rod;
  const rodBroken = rodLvl < 0;
  const rodEquipped = state.equippedTools.rod;
  const rodDef = equippedRod(state);
  const rodName = rodBroken ? '鱼竿已报废（去海滩老渔夫处购买）' : rodDef.name;
  const rodMax = rodBroken ? 0 : toolMaxDurability(rodDef.tier);
  const rodCur = rodBroken ? 0 : state.durability.rod;
  const fishList = availableFish(state);
  const equippedBaitDef = state.equippedBaitId ? BAIT_BY_ID[state.equippedBaitId] : null;
  const hasBait = !!equippedBaitDef && (state.inventory[equippedBaitDef.id] ?? 0) > 0;
  const canCast = !rodBroken && rodEquipped && hasBait;

  const fishChips = fishList.length
    ? fishList
        .map((f) => {
          const caught = state.stats.fishSpecies.includes(f.id);
          const stars = starRow(f.difficulty);
          return `<span class="chip ${caught ? 'ok' : ''}">${caught ? f.name : '未知鱼影'} <small>${stars}</small></span>`;
        })
        .join('')
    : '<span class="dim">当前时段或天气下水面很安静，换个时段或雨天来看看吧。</span>';

  const spot = FISHING_SPOT_DEFS.find((x) => x.id === state.location);
  const tagNames: Record<string, string> = { river: '河流', lake: '湖泊', ocean: '海域', deep: '深水', small: '小型鱼', large: '大型鱼', predator: '掠食鱼', carp: '鲤科', coral: '珊瑚鱼', night: '夜行鱼', rain: '雨天鱼', legendary: '传奇鱼' };
  const tagName = (tag: string) => tagNames[tag] ?? tag;
  const rodChoices = RODS.filter((r) => state.ownedRods.includes(r.id))
    .map((r) => `<button class="chip ${r.id === state.equippedRodId ? 'on' : ''}" data-act="equip-fishing-rod" data-rod="${r.id}">${r.name}${r.affinity.length ? ` · ${r.affinity.slice(0, 2).map(tagName).join('/')}` : ''}</button>`)
    .join('');
  const baitChoices = BAITS.filter((b) => (state.inventory[b.id] ?? 0) > 0)
    .map((b) => `<button class="chip ${b.id === state.equippedBaitId ? 'on' : ''}" data-act="equip-fishing-bait" data-bait="${b.id}">${b.name} ×${state.inventory[b.id]}</button>`)
    .join('');
  const bait = state.equippedBaitId ? BAIT_BY_ID[state.equippedBaitId] : null;
  const rodFishNames = (rodDef.targetFishIds ?? []).slice(0, 4).map((id) => itemName(id)).join('、');
  const baitFishNames = (bait?.targetFishIds ?? []).slice(0, 4).map((id) => itemName(id)).join('、');
  const effectBits = [
    rodDef.affinity.length ? `鱼竿专长：${rodDef.affinity.map(tagName).join('、')}${rodFishNames ? `（针对 ${rodFishNames}）` : ''}` : '',
    bait ? `鱼饵目标：${bait.tags.map(tagName).join('、')}${baitFishNames ? `（针对 ${baitFishNames}）` : ''}` : '未装鱼饵',
  ].filter(Boolean).join(' · ');

  return `<h3>${spot?.name ?? '水域'}钓鱼台（${spot?.waterType === 'river' ? '河流' : spot?.waterType === 'lake' ? '湖泊' : '海域'} ${spot?.tier ?? 1} 阶）</h3>
    <div class="fishing-dock">
      <button class="water-pond" data-act="fish" ${canCast ? '' : 'disabled'}>
        <div class="water-waves">〰 〰 〰 〰 〰 〰</div>
        <div class="pond-bobber">
          <span>${uiIconSvg('skill_fishing')}</span>
          <span>${canCast ? '点击水面抛竿下钩' : rodBroken ? '鱼竿已报废' : !rodEquipped ? '请先在背包装备鱼竿' : '先装上鱼饵才能抛竿'}</span>
        </div>
      </button>
      <div class="dock-info">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;">
            <b>当前鱼竿：${rodName}</b>
            <span class="badge ${canCast ? 'ok' : 'bad'}">${rodBroken ? '已报废' : rodEquipped ? '已装备' : '未装备'}</span>
          </div>
          ${rodBroken ? '' : bar(rodCur, rodMax, rodCur <= 8 ? 'warnbar' : 'xp')}
        </div>
        <div>
          <span class="dim" style="display:block;margin-bottom:4px;">当前水域 · 本时段可出没鱼类（${fishList.length} 种）：</span>
          <div class="chips">${fishChips}</div>
        </div>
        <div><span class="dim">选择鱼竿：</span><div class="chips">${rodChoices}</div></div>
        <div><span class="dim">选择鱼饵（必备，有效咬钩后消耗 1 个）：</span><div class="chips">${baitChoices || '<span class="dim">背包里没有鱼饵，去海滩渔具店买普通鱼饵（10 金）</span>'}</div></div>
        <small class="dim">${spot?.description ?? ''}${effectBits ? ` · ${effectBits}` : ''}</small>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:auto;">
          <button class="pix-btn gold" data-act="fish" ${canCast ? '' : 'disabled'}>${uiIconSvg('skill_fishing')} 抛竿钓鱼</button>
          <button class="pix-btn" data-act="open-craft">${uiIconSvg('wrench')} 制作渔具/鱼饵</button>
          <button class="pix-btn ghost" data-act="view-tool" data-tool="rod">查看鱼竿详情</button>
        </div>
      </div>
    </div>`;
}

function forestScene(): string {
  syncForestUiState();
  const f = state.forest;
  const axeBroken = state.tools.axe < 0;
  const axeEquipped = state.equippedTools.axe;
  const canChop = f.trees > 0 && !axeBroken && axeEquipped;
  const axeDur = axeBroken
    ? '斧头已报废（去铁匠铺买新的）'
    : !axeEquipped
      ? '斧头未装备（去背包页装备）'
      : `斧头耐久 ${state.durability.axe}/${toolMaxDurability(state.tools.axe)}`;

  const treeSlotsHtml = forestTreeSlots
    .map((slot, idx) => {
      const name = TREE_NAMES[idx] ?? '林木';
      const floatHtml = slot.floatText ? `<span class="slot-float">${esc(slot.floatText)}</span>` : '';
      if (slot.stump) {
        const fxCls = slot.fx === 'fall' ? ' fx-tree-fall' : '';
        return `<button class="tree-slot stump${fxCls}" disabled>
          ${floatHtml}
          <span class="tree-crown stump-crown">${stumpSvg()}</span>
          <b>${name} #${idx + 1}</b>
        </button>`;
      }
      const rem = 3 - slot.hits;
      const fxCls = slot.fx === 'hit' ? ' fx-tree-hit' : '';
      const dmgCls = slot.hits > 0 ? ' damaged' : '';
      const dots = [0, 1, 2]
        .map((d) => `<i class="tree-hp-dot ${d < rem ? '' : 'lost'}"></i>`)
        .join('');
      return `<button class="tree-slot${dmgCls}${fxCls}" data-act="tree-hit" data-idx="${idx}" ${canChop ? '' : 'disabled'}>
        ${floatHtml}
        <span class="tree-crown">${treeSvg(idx, slot.hits)}</span>
        <b>${name} #${idx + 1}</b>
        <div class="tree-hp-dots" aria-label="树木耐久">${dots}</div>
      </button>`;
    })
    .join('');

  const groveCards = GROVES.map((g) => {
    const yields = g.yields[state.season];
    const ready = f.groves[g.id] && !!yields;
    const status = !yields ? '本季休眠' : f.groves[g.id] ? '今日可采' : '今日已采';
    const fxCls = groveFxId === g.id ? ' fx-grove-pick' : '';
    const floatText = groveFloatMap.get(g.id);
    return `<article class="card grove-card${ready ? ' clickable' : ''}${fxCls}"${ready ? ` data-act="grove" data-grove="${g.id}" role="button" tabindex="0" title="点击采摘${g.name}"` : ''}>
      ${floatText ? `<span class="slot-float">${esc(floatText)}</span>` : ''}
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="bag-item-icon">${itemIconSvg(g.id === 'mushroom' ? 'common_mushroom' : g.id === 'flowers' ? 'daffodil' : 'wild_plum')}</span>
        <b>${g.name}</b>
        <span class="badge ${ready ? 'ok' : ''}" style="margin-left:auto;">${status}</span>
      </div>
      <p class="dim" style="margin:6px 0;">${g.desc}</p>
      <p style="margin:4px 0;">${yields ? `本季产出：${yields.map(([id, q]) => `<span class="chip ok">${itemName(id)} ×${q}</span>`).join(' ')}` : g.offSeasonText}</p>
      <button class="pix-btn ${ready ? 'gold' : ''}" data-act="grove" data-grove="${g.id}" ${ready ? '' : 'disabled'}>${ready ? uiIconSvg('hand') + ` 采摘${g.name}` : status}</button>
    </article>`;
  }).join('');

  const mysteryHtml = f.exploredToday
    ? `<div class="mystery-card revealed${mysteryState.flipFx ? ' fx-card-flip' : ''}">
        <span class="mystery-glyph">${uiIconSvg('check')}</span>
        <b>${mysteryState.spotIdx !== null ? `${MYSTERY_CARDS[mysteryState.spotIdx].title} · ` : ''}今日奇遇已揭晓</b>
        <small>${esc(mysteryState.resultText || '你已在林间探索过，收获了一份奇遇。')}</small>
      </div>`
    : `<button class="mystery-card" data-act="forest-explore">
        <span class="mystery-glyph">${uiIconSvg('question')}</span>
        <b>深林秘境</b>
        <small>林间古树洞、灌木丛深处、溪畔小空地……走进去才知道会遇见什么</small>
        <span class="badge ok">走进深林秘境（每天一次）</span>
      </button>`;

  return `
  ${forageNodesSection()}
  <h3>林间伐木舞台（点击树木连续挥斧 3 下砍倒，掉落木材 ×2~4）</h3>
  <div class="forest-stage ${forestChopFx ? 'fx-chop' : ''}">
    <div class="forest-stage-head">
      <span>${uiIconSvg('tree')} 剩余林木 <b>${f.trees}/8</b> 棵 · ${axeDur}</span>
      <button class="pix-btn gold" data-act="chop" ${canChop ? '' : 'disabled'}>${uiIconSvg('axe')} 快速砍倒一棵</button>
    </div>
    <div class="forest-grid">${treeSlotsHtml}</div>
  </div>
  <h3>三大固定采集点位（每天各可采摘一次，产出随季节变化）</h3>
  <div class="cards grid-2">${groveCards}</div>
  <h3>深林秘境奇遇（每天一次）</h3>
  <div class="mystery-single">${mysteryHtml}</div>
  ${fishingDockSection()}`;
}

function mineScene(): string {
  const m = state.mine;
  if (state.location === 'mountain') {
    const floors = [1, ...elevatorFloors(state).filter((f) => f !== 1)];
    return `<h3>矿洞电梯入口</h3><p>最深探索至第 <b>${m.deepest}</b> 层。选择电梯层数进入矿洞：</p>
      <div class="chips">${floors.map((f) => `<button class="pix-btn" data-act="enter-mine" data-floor="${f}">进入第 ${f} 层</button>`).join('')}</div>`;
  }
  if (state.location !== 'mine') return '';
  const rockCount = Math.min(m.rocks, 12);
  const rocksHtml = rockCount
    ? Array.from({ length: rockCount })
        .map(
          (_, i) =>
            `<button class="rock ${mineFxState.rockHit ? 'fx-rock-hit' : ''}" data-act="mine-rock1" title="点击敲碎岩石">石 #${i + 1}</button>`,
        )
        .join('')
    : '<span class="dim">这一层的岩石已经全部敲完！</span>';

  const monstersHtml = m.monsters.length
    ? `<div class="foe-list">${m.monsters
        .map((mo, idx) => {
          const def = MONSTERS.find((d) => d.id === mo.id);
          const isTarget = idx === 0 && mineFxState.slash;
          return `<div class="foe-card ${isTarget ? 'fx-slash' : ''}">
            <div><b>${def?.name ?? mo.id}</b> <span class="dim">· 伤害 ${def?.damage ?? '?'}</span></div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${isTarget && mineFxState.dmgText ? `<span class="dmg-badge ${mineFxState.crit ? 'crit' : ''}">${esc(mineFxState.dmgText)}</span>` : ''}
              <span class="badge bad">HP ${mo.hp}</span>
              <button class="chip foe" data-act="attack">挥剑攻击</button>
            </div>
          </div>`;
        })
        .join('')}</div>`
    : '<p class="dim">这一层已经没有怪物了。</p>';

  return `<h3>矿洞第 ${m.floor} 层（最深记录：第 ${m.deepest} 层）</h3>
    ${mineFloorHint(m.floor)}
    <div class="mine-arena">
      <div class="mine-box ${mineFxState.rockHit ? 'fx-rock-hit' : ''}">
        <h4>矿脉岩石（剩余 ${m.rocks} 块 · 点击岩石直接敲击）</h4>
        <div class="rocks">${rocksHtml}</div>
        ${m.ladder ? '<div style="margin-top:8px;"><span class="chip ok">' + uiIconSvg('check') + ' 已发现通往下一层的梯子！</span></div>' : ''}
      </div>
      <div class="mine-box">
        <h4>层内怪物（装备武器：${WEAPONS.find((w) => w.id === state.weapon)?.name ?? '拳头'}）</h4>
        ${monstersHtml}
      </div>
    </div>
    <div class="toolbar">
      <button class="pix-btn" data-act="mine-rock1" ${m.rocks ? '' : 'disabled'}>敲一块石头</button>
      <button class="pix-btn" data-act="mine-rock-all" ${m.rocks ? '' : 'disabled'}>敲全部石头</button>
      <button class="pix-btn danger" data-act="attack" ${m.monsters.length ? '' : 'disabled'}>挥剑攻击</button>
      <button class="pix-btn gold" data-act="descend" ${m.ladder ? '' : 'disabled'}>顺梯子下楼</button>
      <button class="pix-btn ghost" data-act="leave-mine">乘电梯返回地面</button>
    </div>
    <p class="hint">生命 ${state.hp}/${maxHp(state)}。生命归零会被送去诊所并扣除最高 100 金医药费。</p>`;
}

function scenePage(): string {
  const loc = LOCATIONS[state.location];
  const forage = state.forage[state.location] ?? [];
  const festival = todayFestival(state);
  const hereNpcs = npcsHere(state);

  const npcBar = hereNpcs.length
    ? `<div class="scene-npcs">
        <span>在场居民（点击互动/送礼）：</span>
        ${hereNpcs
          .map(
            (npc) => {
              const fx = npcFxState?.npcId === npc.id ? npcFxState : null;
              return `<button class="npc-pill ${fx ? `fx-${fx.tone}` : ''}" data-act="open-npc" data-npc="${npc.id}">
              <span class="mini-ava">${npcAvatarSvg(npc.id)}</span>
              <b>${npc.name}</b>
              <span class="hearts">${heartRow(Math.min(5, heartsOf(state, npc.id)))}</span>
              <small>${state.npcs[npc.id].talkedToday ? '已聊' : '可聊天'}</small>
              ${fx ? `<span class="npc-pill-fx tone-${fx.tone}">${NPC_FX_PARTICLES[fx.tone].slice(0, 3).map((p, i) => `<span style="--i:${i}">${fxParticle(p)}</span>`).join('')}</span>` : ''}
            </button>`;
            },
          )
          .join('')}
      </div>`
    : '';

  let body = '';
  if (state.location === 'farm') body = farmScene();
  else if (state.location === 'forest') body = forestScene();
  else if (state.location === 'mine' || state.location === 'mountain') {
    body = `
      ${forageNodesSection('山间散落采集物（点击哪个拾取哪个）')}
      ${state.location === 'mountain' ? fishingDockSection() : ''}
      ${mineScene()}`;
  } else {
    body = `
      ${forageNodesSection('野外散落采集物（点击哪个拾取哪个）')}
      ${fishingDockSection()}
      ${shopCards()}
      ${workbenchCards()}
      ${townExtras()}`;
  }

  return `<div class="${pageViewCls()}">
    <div class="scene-head">
      <div class="scene-head-top">
        <div><h2>${loc.name}</h2><p>${loc.arrival}</p></div>
        <div class="toolbar">
          ${FISHING_SPOTS.includes(state.location) ? '<button class="pix-btn" data-act="fish">抛竿钓鱼</button>' : ''}
          ${festival && festival.location === state.location ? `<button class="pix-btn gold" data-act="festival">参加${festival.name}</button>` : ''}
          ${state.location === 'farm' ? '<button class="pix-btn ghost" data-act="wait">休息 1 小时</button>' : ''}
        </div>
      </div>
      ${npcBar}
    </div>
    ${sceneSkillBadges()}
    ${body}
  </div>`;
}

/* ---------- 2. 背包与装备整页 (Bag & Equipment Page) ---------- */

const BAG_FILTERS: [string, string][] = [
  ['all', '全部'],
  ['equip', '装备'],
  ['seed', '种子'],
  ['crop', '作物'],
  ['forage', '采集'],
  ['fish', '鱼类'],
  ['ore', '矿石宝石'],
  ['food', '食物'],
  ['other', '其他'],
];

function bagCategory(id: string): string {
  const c = ITEMS[id]?.category;
  if (c === 'weapon' || c === 'tool') return 'equip';
  if (c === 'ore' || c === 'gem') return 'ore';
  if (c === 'seed' || c === 'crop' || c === 'forage' || c === 'fish' || c === 'food') return c;
  return 'other';
}

function toolLabel(t: ToolId): string {
  const level = state.tools[t];
  if (level < 0) return '已报废';
  return t === 'rod' ? equippedRod(state).name : TOOL_LEVEL_NAMES[level];
}

function durBar(cur: number, max: number): string {
  const pct = max > 0 ? (cur / max) * 100 : 0;
  return `<div class="bar ${pct <= 25 ? 'hp' : pct <= 60 ? 'warnbar' : 'energy'}"><i style="width:${Math.max(0, pct)}%"></i><span>耐久 ${cur}/${max}</span></div>`;
}

function repairWarnings(): string[] {
  const warnings: string[] = [];
  for (const t of ['hoe', 'can', 'pickaxe', 'rod', 'axe'] as ToolId[]) {
    if (state.tools[t] < 0) warnings.push(`${TOOL_NAMES[t]}已报废`);
    else if (state.durability[t] / toolMaxDurability(state.tools[t]) <= 0.3) warnings.push(`${TOOL_NAMES[t]} ${state.durability[t]}/${toolMaxDurability(state.tools[t])}`);
  }
  for (const id of Object.keys(state.inventory).filter((itemId) => ITEMS[itemId]?.category === 'weapon')) {
    const max = weaponMaxDurability(id);
    const cur = state.weaponDurability[id] ?? max;
    if (max > 0 && cur / max <= 0.3) warnings.push(`${itemName(id)} ${cur}/${max}`);
  }
  return warnings;
}

function bagItemMeta(id: string): string {
  const item = ITEMS[id];
  const category = BAG_FILTERS.find(([f]) => f === bagCategory(id))?.[1] ?? '其他';
  if (item.category === 'weapon') {
    const def = WEAPONS.find((w) => w.id === id)!;
    return state.weapon === id ? `${category} · 伤害 ${def.damage[0]}-${def.damage[1]} · 已装备` : `${category} · 伤害 ${def.damage[0]}-${def.damage[1]} · 耐久 ${state.weaponDurability[id] ?? weaponMaxDurability(id)}`;
  }
  if (item.cropId) {
    const crop = CROPS[item.cropId];
    return `${category} · ${crop.seasons.join('/')}季 · ${crop.growDays} 天`;
  }
  if (item.energy) return `${category} · 吃 +${item.energy} 体力`;
  if (id === 'scrap') return `${category} · 铁匠铺回收`;
  return `${category} · 卖 ${sellPrice(state, id)} 金`;
}

/** 工具越好效果越强：当前等级的专属效果（与引擎 TOOL_POWER 数值一致） */
function toolPowerText(t: ToolId): string {
  const lv = Math.max(0, state.tools[t]);
  const discount = lv * 15;
  switch (t) {
    case 'hoe':
      return lv === 0
        ? '普通锄头：升级后开垦有概率翻出肥沃土地'
        : `开垦省时省力 ${discount}%；开垦 ${Math.round(TOOL_POWER.hoeFertileChancePerLevel * lv * 100)}% 概率肥沃（作物首长 +1 天）`;
    case 'can':
      return lv === 0
        ? '普通水壶：升级后浇水有概率催长作物'
        : `浇水省时省力 ${discount}%；浇水 ${Math.round(TOOL_POWER.canSproutChancePerLevel * lv * 100)}% 概率立即催长 1 天`;
    case 'pickaxe':
      return `敲石省时省力 ${discount}%；矿石概率 ${35 + Math.round(TOOL_POWER.pickaxeOreChancePerLevel * lv * 100)}%、宝石概率 ${4 + Math.round(TOOL_POWER.pickaxeGemChancePerLevel * lv * 100)}%`;
    case 'rod':
      return `收线 +${lv * 8}；钓到垃圾概率 -${lv * 2}%、稀有鱼更容易咬钩`;
    case 'axe':
      return `砍树省时省力 ${discount}%；${Math.round(TOOL_POWER.axeExtraWoodChancePerLevel * lv * 100)}% 概率额外 +1 木材${lv >= 2 ? '、钢斧起每棵保底 +1' : ''}`;
  }
}

const TOOL_DETAILS: Record<ToolId, { icon: string; use: string; wear: string }> = {
  hoe: { icon: '锄', use: '开垦空地，把土地翻松后播种', wear: '每开垦 1 格 -1' },
  can: { icon: '壶', use: '给已经种下作物的土地浇水', wear: '每浇 1 格 -1' },
  pickaxe: { icon: '镐', use: '清理农场石头、敲碎矿洞里的石头', wear: '每清理/敲碎 1 块 -1' },
  rod: { icon: '竿', use: '在海滩、森林和山区的水边钓鱼', wear: `每次抛竿 -1；断线额外 -${DURABILITY.lineBreakWear}` },
  axe: { icon: '斧', use: '在青禾森林砍树，得到可以卖钱的木材', wear: '每砍 1 棵树 -1' },
};

function equipmentSection(warnings: string[]): string {
  const toolCards = (['hoe', 'can', 'pickaxe', 'rod', 'axe'] as ToolId[])
    .map((t) => {
      const broken = state.tools[t] < 0;
      const equipped = state.equippedTools[t] && !broken;
      const cur = state.durability[t] ?? 0;
      const max = toolMaxDurability(state.tools[t]);
      const low = !broken && max > 0 && cur / max <= 0.3;
      return `<article class="equip-card ${equipped ? 'on' : ''} ${broken ? 'broken' : ''} ${low ? 'low-dur' : ''} ${wearFlash ? 'fx-wear' : ''}" data-act="view-tool" data-tool="${t}" title="点击查看${TOOL_NAMES[t]}详情">
        <div class="equip-head"><span class="equip-title-row"><span class="equip-icon">${toolIconSvg(t, Math.max(0, state.tools[t]))}</span><b>${TOOL_NAMES[t]}</b></span>${broken ? '<span class="badge bad">已报废</span>' : equipped ? '<span class="badge ok">已装备</span>' : '<span class="badge">未装备</span>'}</div>
        <span class="equip-meta">${broken ? '需要买新的' : toolLabel(t)}</span>
        ${broken ? `<p class="equip-note">去${t === 'rod' ? '海滩渔具店' : '小镇铁匠铺'}买新的（300 金）。</p>` : durBar(cur, max)}
        ${low ? `<p class="equip-note warn-text">耐久偏低，及时修理。</p>` : ''}
        ${broken ? '' : `<p class="equip-note">效果：${toolPowerText(t)}</p>`}
        <div class="equip-actions">
          <button class="chip" data-act="view-tool" data-tool="${t}">查看</button>
          ${!broken ? (equipped ? `<button class="chip" data-act="unequip-tool" data-tool="${t}">卸下</button>` : `<button class="chip" data-act="equip-tool" data-tool="${t}">装备</button>`) : ''}
        </div>
      </article>`;
    })
    .join('');

  const weaponIds = Object.keys(state.inventory).filter((id) => ITEMS[id]?.category === 'weapon');
  const weaponCards = weaponIds
    .map((id) => {
      const def = WEAPONS.find((w) => w.id === id)!;
      const equipped = state.weapon === id;
      const max = weaponMaxDurability(id);
      const cur = state.weaponDurability[id] ?? max;
      const low = max > 0 && cur / max <= 0.3;
      return `<article class="equip-card weapon ${equipped ? 'on' : ''} ${low ? 'low-dur' : ''} ${wearFlash ? 'fx-wear' : ''}" data-act="view-weapon" data-item="${id}" title="点击查看${def.name}详情">
        <div class="equip-head"><span class="equip-title-row"><span class="equip-icon">${itemIconSvg(id)}</span><b>${def.name}</b></span>${equipped ? '<span class="badge ok">已装备</span>' : '<span class="badge">未装备</span>'}</div>
        <span class="equip-meta">伤害 ${def.damage[0]}-${def.damage[1]} · 暴击 ${5 + Math.max(0, WEAPONS.findIndex((w) => w.id === id)) * 2}%</span>
        ${rarityBadgeHtml(id, true)}
        ${durBar(cur, max)}
        ${low ? '<p class="equip-note warn-text">耐久偏低，及时修理。</p>' : ''}
        <div class="equip-actions">
          <button class="chip" data-act="view-weapon" data-item="${id}">查看</button>
          ${equipped ? `<button class="chip" data-act="unequip-weapon">卸下</button>` : `<button class="chip" data-act="equip-weapon" data-item="${id}">装备</button>`}
        </div>
      </article>`;
    })
    .join('');

  return `<section class="bag-section equipment-section" aria-labelledby="bag-equipment-title">
    <div class="bag-section-head"><h3 id="bag-equipment-title">随身工具与武器槽位（点击卡片查看详情与修复指引）</h3><span>${warnings.length ? `待处理 ${warnings.length} 件` : '状态良好'}</span></div>
    <div class="equip-grid">${toolCards}${weaponCards}</div>
  </section>`;
}

function bagPage(): string {
  const allIds = Object.keys(state.inventory);
  const ids = allIds.filter((id) => bagFilter === 'all' || bagCategory(id) === bagFilter);
  const warnings = repairWarnings();
  const totalQty = allIds.reduce((sum, id) => sum + state.inventory[id], 0);
  const currentWeapon = WEAPONS.find((w) => w.id === state.weapon);
  const filterCount = (f: string) => (f === 'all' ? allIds.length : allIds.filter((id) => bagCategory(id) === f).length);

  return `<div class="${pageViewCls()} bag-shell">
    <section class="bag-summary" aria-label="背包总览">
      <div><span>背包容量与总数</span><b>${allIds.length} 种 · 共 ${totalQty} 件</b></div>
      <div><span>当前装备武器</span><b>${currentWeapon?.name ?? state.weapon}</b></div>
      <div class="${warnings.length ? 'needs-repair' : ''}"><span>耐久与报废提醒</span><b>${warnings.length ? warnings.slice(0, 2).join('；') + (warnings.length > 2 ? ` 等 ${warnings.length} 件` : '') : '全部状态良好'}</b></div>
    </section>

    ${equipmentSection(warnings)}

    <div class="bag-controls">
      <div class="bag-filters" role="group" aria-label="物品分类">${BAG_FILTERS.map(([f, label]) => `<button class="chip ${bagFilter === f ? 'on' : ''}" data-act="bag-filter" data-f="${f}" aria-pressed="${bagFilter === f}">${label}<small>${filterCount(f)}</small></button>`).join('')}</div>
      <div class="qty-row"><span>单次操作数量：</span>
        ${([1, 5, 'all'] as const).map((q) => `<button class="chip ${qty === q ? 'on' : ''}" data-act="qty" data-q="${q}" aria-pressed="${qty === q}">${q === 'all' ? '全部' : q}</button>`).join('')}
      </div>
    </div>

    <section aria-label="物品网格">
      <div class="bag-section-head"><h3>${BAG_FILTERS.find(([f]) => f === bagFilter)?.[1] ?? '全部'}物品</h3><span>${ids.length} 种</span></div>
      ${
        ids.length
          ? `<div class="bag-items-grid">${ids
              .map(
                (id) => `<button class="bag-item ${selectedItem === id ? 'on' : ''}" data-act="item" data-item="${id}" aria-label="查看${ITEMS[id].name}详情">
                  <span class="bag-item-icon">${itemIconSvg(id)}</span>
                  <span class="bag-item-main"><b>${ITEMS[id].name}</b><small>${bagItemMeta(id)}</small></span>
                  ${rarityBadgeHtml(id)}
                  <span class="bag-item-qty">×${state.inventory[id]}</span>
                </button>`,
              )
              .join('')}</div>`
          : '<div class="bag-empty"><b>这一分类下暂时没有物品</b><span>切换上方的分类标签，或去商店购买、下地收获、去矿洞探索。</span></div>'
      }
    </section>

    ${
      Object.keys(state.shippingBin).length
        ? `<section class="shipping-strip"><b>农场出货箱待结算：</b><span>${Object.entries(state.shippingBin)
            .map(([id, n]) => `${itemName(id)} ×${n}`)
            .join('、')}</span><small>睡醒后自动结算金币</small></section>`
        : ''
    }
  </div>`;
}

/* ---------- 3. 社交与镇民整页 (Social Page) ---------- */

function socialPage(): string {
  const hereList = npcsHere(state);
  const list = socialSubTab === 'here' ? hereList : NPCS;

  const RELATION_BADGE: Record<string, string> = {
    dating: `<span class="badge ok">${uiIconSvg('bouquet')} 交往中</span>`,
    engaged: `<span class="badge ok">${uiIconSvg('ring')} 已订婚</span>`,
    married: `<span class="badge ok">${uiIconSvg('bell')} 已婚</span>`,
  };
  const tierBadge = (npcId: string, status: string): string => {
    if (status !== 'friend') return RELATION_BADGE[status] ?? '';
    const tier = relationTier(heartsOf(state, npcId));
    return `<span class="badge ${tier === '陌生人' ? '' : 'ok'}">${esc(tier)}</span>`;
  };
  const cardsHtml = list.length
    ? `<div class="cards grid-2">${list
        .map((npc) => {
          const st = state.npcs[npc.id];
          const locId = npcLocation(state, npc);
          const isHere = locId === state.location;
          const bday = isBirthday(state, npc);
          const streak = st.talkStreak ?? 0;
          return `<article class="card npc ${isHere ? 'here' : 'away'} ${bday ? 'bday' : ''}">
            <div class="npc-top">
              <div class="avatar">${npcAvatarSvg(npc.id)}</div>
              <div class="npc-name-col">
                <div class="npc-name-row">
                  <b>${npc.name}</b>
                  <span class="hearts">${hearts(heartsOf(state, npc.id))}</span>
                  ${tierBadge(npc.id, st.status)}
                  ${bday ? `<span class="badge ok">${uiIconSvg('cake')} 今日生日</span>` : ''}
                </div>
                <p class="npc-intro">${npc.intro}</p>
              </div>
              <span class="npc-loc-badge ${isHere ? 'on' : ''}">${isHere ? uiIconSvg('pin') + ' 在场' : locId ? LOCATIONS[locId].name : '家中休息'}</span>
            </div>
            ${friendshipBarHtml(npc.id)}
            <div class="npc-chips">
              <span class="chip ${st.talkedToday ? 'ok' : ''}">${st.talkedToday ? uiIconSvg('check') + ' 今日已聊' : '今日未聊'}</span>
              <span class="chip">本周送礼 ${st.giftsThisWeek}/2</span>
              ${streak > 1 ? `<span class="chip ok">${uiIconSvg('fire')} 连聊 ${streak} 天</span>` : ''}
              <span class="chip ${bday ? 'ok' : ''}">${uiIconSvg('cake')} ${SEASON_NAMES[npc.birthday.season]} ${npc.birthday.day} 日</span>
              ${npc.marriageable && canRomance(state, npc) ? '<span class="chip ok">可恋爱</span>' : ''}
              <span class="chip">${npc.gender === 'female' ? '女' : '男'}</span>
            </div>
            <button class="pix-btn ${isHere ? 'gold' : 'ghost'} npc-main-btn" data-act="open-npc" data-npc="${npc.id}">
              ${isHere ? '互动 / 送礼' : '查看资料'}
            </button>
          </article>`;
        })
        .join('')}</div>`
    : `<div class="bag-empty"><b>当前地点（${LOCATIONS[state.location].name}）暂时没有居民在场</b></div>`;

  return `<div class="${pageViewCls()}">
    <div class="sub-tabs" role="tablist" aria-label="镇民视图切换">
      <button class="sub-tab ${socialSubTab === 'here' ? 'on' : ''}" data-act="social-subtab" data-sub="here">
        当前在场居民 <small>${hereList.length} 人</small>
      </button>
      <button class="sub-tab ${socialSubTab === 'all' ? 'on' : ''}" data-act="social-subtab" data-sub="all">
        全镇居民图鉴 <small>${NPCS.length} 人</small>
      </button>
    </div>
    ${cardsHtml}
  </div>`;
}

/* ---------- 图鉴 (Codex): 按类展示已收集 / 未收集与完成度 ---------- */
const CODEX_CATEGORIES: { key: string; label: string; match: (id: string) => boolean }[] = [
  { key: 'equip', label: '装备', match: (id) => ITEMS[id].category === 'weapon' },
  { key: 'tools', label: '工具', match: (id) => ITEMS[id].category === 'tool' },
  { key: 'crops', label: '作物', match: (id) => ITEMS[id].category === 'crop' || ITEMS[id].category === 'seed' },
  { key: 'forage', label: '采集物', match: (id) => ITEMS[id].category === 'forage' },
  { key: 'river-fish', label: '河流鱼', match: (id) => FISHING_SPOT_DEFS.find((s) => s.id === FISH.find((f) => f.id === id)?.waters[0])?.waterType === 'river' },
  { key: 'lake-fish', label: '湖泊鱼', match: (id) => FISHING_SPOT_DEFS.find((s) => s.id === FISH.find((f) => f.id === id)?.waters[0])?.waterType === 'lake' },
  { key: 'ocean-fish', label: '海域鱼', match: (id) => FISHING_SPOT_DEFS.find((s) => s.id === FISH.find((f) => f.id === id)?.waters[0])?.waterType === 'ocean' },
  { key: 'bait', label: '鱼饵', match: (id) => ITEMS[id].category === 'bait' },
  { key: 'oregem', label: '矿石宝石', match: (id) => ITEMS[id].category === 'ore' || ITEMS[id].category === 'gem' },
  { key: 'food', label: '食物', match: (id) => ITEMS[id].category === 'food' },
  { key: 'other', label: '其他', match: (id) => !['weapon', 'tool', 'crop', 'seed', 'forage', 'fish', 'bait', 'ore', 'gem', 'food'].includes(ITEMS[id].category) },
];

/** 是否已入图鉴: 获得记录 / 当前持有 / 工具武器按拥有状态推导 (老存档兼容) */
function codexCollected(id: string): boolean {
  if ((state.collection ?? []).includes(id)) return true;
  if ((state.inventory[id] ?? 0) > 0) return true;
  const item = ITEMS[id];
  if (item?.toolGrant) return state.tools[item.toolGrant.tool] >= item.toolGrant.level;
  if (item?.category === 'weapon') return state.weapon === id || typeof state.weaponDurability[id] === 'number';
  return false;
}

function codexSection(): string {
  const allIds = Object.keys(ITEMS);
  const totalGot = allIds.filter(codexCollected).length;
  const pct = Math.round((totalGot / allIds.length) * 100);
  const cats = CODEX_CATEGORIES.map((cat) => {
    const ids = allIds.filter(cat.match);
    const got = ids.filter(codexCollected).length;
    const cards = ids
      .map((id) => {
        const owned = codexCollected(id);
        const qty = state.inventory[id] ?? 0;
        return `<button class="codex-card ${owned ? '' : 'uncollected'}" data-act="view-codex" data-item="${id}" aria-label="查看${ITEMS[id].name}详情">
          <span class="bag-item-icon">${itemIconSvg(id)}</span>
          <b>${ITEMS[id].name}</b>
          ${rarityBadgeHtml(id, true)}
          <small>${owned ? (qty > 0 ? `持有 ×${qty}` : '已收集') : '尚未获得'}</small>
        </button>`;
      })
      .join('');
    return `<h3>${cat.label} <small class="dim">${got}/${ids.length}</small></h3><div class="codex-grid">${cards}</div>`;
  }).join('');
  return `<h3>物品图鉴 <small class="dim">已收集 ${totalGot}/${allIds.length}（${pct}%）</small></h3>
    <div class="codex-progress">${bar(totalGot, allIds.length, 'xp')}</div>
    ${cats}`;
}

const FISH_TAG_NAMES: Record<string, string> = { river: '河流', lake: '湖泊', ocean: '海域', deep: '深水', small: '小型鱼', large: '大型鱼', predator: '掠食鱼', carp: '鲤科', coral: '珊瑚鱼', night: '夜行鱼', rain: '雨天鱼', legendary: '传奇鱼' };
const fmtFishHour = (h: number) => (h >= 24 ? `次日 ${h - 24}:00` : `${h}:00`);

function codexModalHtml(id: string): string {
  const item = ITEMS[id];
  if (!item) return `<div class="modal-head"><h2>图鉴详情</h2><button class="pix-btn" data-act="close-ui-modal">关闭</button></div><p>未找到该物品。</p>`;
  const owned = codexCollected(id);
  const qty = state.inventory[id] ?? 0;
  const catLabel = CODEX_CATEGORIES.find((c) => c.match(id))?.label ?? BAG_FILTERS.find(([f]) => f === bagCategory(id))?.[1] ?? '其他';
  const rows: [string, string][] = [
    ['分类', catLabel],
    ['收集状态', owned ? (qty > 0 ? `已收集 · 当前持有 ×${qty}` : '已收集 · 当前未持有') : '尚未获得'],
    ['稀有度', rarityOf(id).name],
  ];
  const price = sellPrice(state, id);
  rows.push(['出售价', price > 0 ? `${price} 金/件` : '不可出售']);
  if (item.energy) rows.push(['食用恢复', `+${item.energy} 体力`]);

  const fish = FISH.find((f) => f.id === id);
  const crop = item.cropId ? CROPS[item.cropId] : null;
  const weapon = WEAPONS.find((w) => w.id === id);
  const rod = ROD_BY_ITEM[id];
  const bait = BAIT_BY_ID[id];
  const forage = FORAGE.find((f) => f.id === id);
  const ore = [...ORES, ...GEMS].find((o) => o.id === id);
  const monster = MONSTERS.find((m) => m.drop.id === id);
  let source = '';

  if (fish) {
    const waters = fish.waters.map((w) => FISHING_SPOT_DEFS.find((x) => x.id === w)?.name ?? LOCATIONS[w].name).join('、');
    rows.push(['出没水域', waters]);
    rows.push(['出现季节', fish.seasons.map((x) => SEASON_NAMES[x]).join('、') + '季']);
    rows.push(['出现天气', fish.weather === 'any' ? '任意天气' : WEATHER_NAMES[fish.weather]]);
    rows.push(['活跃时段', `${fmtFishHour(fish.hours[0])} - ${fmtFishHour(fish.hours[1])}`]);
    rows.push(['捕获难度', `${starRow(fish.difficulty)}（${fish.difficulty}/6）`]);
    if (fish.minLevel) rows.push(['钓鱼等级', `Lv.${fish.minLevel}`]);
    if (fish.tags.length) rows.push(['特性', fish.tags.map((t) => FISH_TAG_NAMES[t] ?? t).join('、')]);
    if (fish.unique) rows.push(['特殊', '传奇鱼 · 每档仅可捕获一次']);
    source = `前往${waters}钓鱼`;
  } else if (rod) {
    rows.push(['鱼竿阶位', `${rod.tier} 阶`]);
    rows.push(['购买价格', rod.price > 0 && rod.id !== 'celestial' ? `${rod.price} 金` : '配方锻造专属']);
    if (rod.minLevel) rows.push(['钓鱼等级', `Lv.${rod.minLevel}`]);
    if (rod.affinity.length) rows.push(['专长标签', rod.affinity.map((t) => FISH_TAG_NAMES[t] ?? t).join('、')]);
    if (rod.targetFishIds?.length) rows.push(['针对鱼种', rod.targetFishIds.map((fid) => itemName(fid)).join('、')]);
    rows.push(['专属效果', rod.specialtyDesc]);
    if (rod.recipe) {
      rows.push([
        '制作原料',
        Object.entries(rod.recipe)
          .map(([rid, n]) => `${itemName(rid)} ×${n}（持有 ${state.inventory[rid] ?? 0}）`)
          .join('、'),
      ]);
    }
    rows.push(['鱼饵', rod.allowsBait ? (rod.allowsAdvancedBait ? '可装普通与史诗/传说鱼饵' : '可装普通/优秀/稀有鱼饵') : '不可装鱼饵']);
    source =
      rod.id === 'celestial'
        ? '在白鹭镇铁匠铺的渔具工作台锻造（需先解锁）'
        : rod.id === 'deep_sea'
          ? '渔具工作台锻造，或完成社区中心鱼缸后在渔具店购买'
          : '渔具工作台锻造，或在海滩渔具店购买';
  } else if (bait) {
    if (bait.price) rows.push(['商店售价', `${bait.price} 金`]);
    if (bait.minLevel) rows.push(['钓鱼等级', `Lv.${bait.minLevel}`]);
    rows.push(['目标鱼群', bait.tags.map((t) => FISH_TAG_NAMES[t] ?? t).join('、')]);
    if (bait.targetFishIds?.length) rows.push(['针对鱼种', bait.targetFishIds.map((fid) => itemName(fid)).join('、')]);
    rows.push(['专属效果', `${bait.specialtyDesc}（权重 +${Math.round(bait.weightBonus * 100)}%）`]);
    if (bait.recipe) {
      rows.push([
        '调配原料',
        `${Object.entries(bait.recipe)
          .map(([rid, n]) => `${itemName(rid)} ×${n}（持有 ${state.inventory[rid] ?? 0}）`)
          .join('、')} → 产出 ×${bait.craftYield ?? 4}`,
      ]);
    }
    source = bait.legendaryOnly ? '在海滩老渔夫小屋的鱼饵工作台调配，或完成社区中心鱼缸获赠' : '在海滩老渔夫小屋的鱼饵工作台调配，或在海滩渔具店购买';
  } else if (crop) {
    if (item.category === 'seed') {
      rows.push(['种子价格', `${crop.seedPrice} 金`]);
      source = '白鹭杂货铺购买种子后在农场播种';
    } else {
      source = '在农场种植收获';
    }
    rows.push(['种植季节', crop.seasons.map((x) => SEASON_NAMES[x]).join('、') + '季']);
    rows.push(['生长周期', `${crop.growDays} 天成熟${crop.regrowDays ? `，之后每 ${crop.regrowDays} 天可再收获` : ''}`]);
  } else if (weapon) {
    rows.push(['攻击伤害', `${weapon.damage[0]}-${weapon.damage[1]}`]);
    rows.push(['装备状态', state.weapon === id ? '已装备' : qty > 0 ? '背包中' : '未装备']);
    if (qty > 0 || state.weapon === id) rows.push(['武器耐久', `${state.weaponDurability[id] ?? weaponMaxDurability(id)}/${weaponMaxDurability(id)}`]);
    source = id === 'fists' ? '初始自带' : id === 'rusty_sword' ? '初始武器' : id === 'galaxy_sword' ? '矿洞 60 层宝箱' : weapon.requiresFloor ? `矿洞到达 ${weapon.requiresFloor} 层后在铁匠铺购买` : '铁匠铺购买';
  } else if (forage) {
    rows.push(['出现季节', forage.seasons.map((x) => SEASON_NAMES[x]).join('、') + '季']);
    rows.push(['出现地点', forage.locations.map((w) => LOCATIONS[w].name).join('、')]);
    source = `在${forage.locations.map((w) => LOCATIONS[w].name).join('、')}采集`;
  } else if (ore) {
    rows.push(['矿洞层数', `第 ${ore.floors[0]}-${ore.floors[1]} 层`]);
    source = '矿洞敲石获得';
  } else if (monster) {
    rows.push(['掉落怪物', `${monster.name}（第 ${monster.floors[0]}-${monster.floors[1]} 层）`]);
    rows.push(['掉落概率', `${Math.round(monster.drop.chance * 100)}%`]);
    source = `矿洞击败${monster.name}`;
  } else if (item.category === 'tool') {
    source = '初始自带，报废后在对应商店重新购买';
  } else if (id === 'wood') source = '森林砍树获得';
  else if (id === 'scrap') source = '工具或武器报废后留下';
  else if (id === 'bouquet') source = '白鹭杂货铺购买';
  else if (id === 'pendant') source = '海滩渔具店购买';
  else if (['bread', 'salad', 'pizza'].includes(id)) source = '星火酒馆购买';
  else if (item.category === 'food') source = '购买、获赠或奖励获得';
  else if (item.category === 'trash') source = '钓鱼时可能钓到';
  if (source) rows.push(['获取方式', source]);

  return `
    <div class="modal-head">
      <h2>${uiIconSvg('bag')} 图鉴详情</h2>
      <button class="pix-btn" data-act="close-ui-modal">返回图鉴</button>
    </div>
    <div class="detail-title">
      <span class="bag-item-icon">${itemIconSvg(id)}</span>
      <div><b>${item.name}</b><span>${owned ? '已收集' : '尚未获得'} · ${catLabel}</span></div>
      ${rarityBadgeHtml(id, true)}
    </div>
    <dl class="detail-list">
      ${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
    </dl>
    <div class="detail-actions">
      ${qty > 0 && item.category !== 'tool' ? `<button class="pix-btn gold" data-act="codex-open-bag" data-item="${id}">在背包中查看</button>` : ''}
      <button class="pix-btn ghost" data-act="close-ui-modal">返回图鉴</button>
    </div>`;
}

/* ---------- 4. 手册与状态整页 (Journal & Status Page) ---------- */

function journalPage(): string {
  const need = neededItems(state).filter((id) => (state.inventory[id] ?? 0) > 0);
  const weapon = WEAPONS.find((w) => w.id === state.weapon);

  let content = '';
  if (journalSubTab === 'skills') {
    content = `
      <h3>五项专精技能</h3>
      <div class="skill-grid">
        ${SKILL_ORDER.map((sk) => {
          const p = skillProgressOf(state, sk);
          return `<div class="skill"><b>${SKILL_NAMES[sk]} Lv.${p.level}</b>${
            p.isMax
              ? `${bar(1, 1, 'xp')}<small class="dim">已满级（累计 ${state.skills[sk]} 经验）</small>`
              : `${bar(p.into, p.span, 'xp')}<small class="dim">还差 ${p.toNext} 经验升 Lv.${p.level + 1}</small>`
          }<small class="skill-effect">${skillEffectText(sk)}</small></div>`;
        }).join('')}
      </div>
      <p class="dim">已选职业专精：${state.professions.length ? state.professions.join('、') : '暂无（任意技能达到 5 级、10 级时自动弹出职业选择）'}</p>
      <h3>工具与武器状态速览</h3>
      <div class="cards grid-2">
        ${(['hoe', 'can', 'pickaxe', 'rod', 'axe'] as ToolId[])
          .map(
            (t) => `<button class="card place" data-act="view-tool" data-tool="${t}">
              <b>${TOOL_NAMES[t]}（${toolLabel(t)}）</b>
              <span>耐久 ${state.tools[t] < 0 ? 0 : state.durability[t]}/${toolMaxDurability(state.tools[t])} · 点击查看详情</span>
            </button>`,
          )
          .join('')}
        <button class="card place" data-act="go-page" data-page="bag">
          <b>当前武器：${weapon?.name ?? state.weapon}</b>
          <span>伤害 ${weapon?.damage.join('-') ?? '1-2'} · 前往背包整页管理</span>
        </button>
      </div>`;
  } else if (journalSubTab === 'codex') {
    content = codexSection();
  } else if (journalSubTab === 'bundles') {
    content = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <div>
          <h3 style="margin:0;">社区中心各房间收集包</h3>
        </div>
        ${
          state.location === 'town'
            ? `<button class="pix-btn gold" data-act="donate" ${need.length ? '' : 'disabled'}>在小镇一键捐献（${need.length} 种可捐）</button>`
            : `<button class="pix-btn gold" data-act="donate" ${need.length ? '' : 'disabled'}>去白鹭镇广场捐献（${need.length} 种可捐）</button>`
        }
      </div>
      <div class="room-grid">
        ${ROOMS.map((room) => {
          const bundles = BUNDLES.filter((b) => b.room === room.id);
          const done = bundles.filter((b) => bundleDone(state, b)).length;
          const unlocked = state.unlocks.includes(room.unlock);
          return `<button class="room-card ${unlocked ? 'done' : ''}" data-act="open-bundle-room" data-room="${room.id}">
            <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
              <b>${room.name}</b>
              <span class="badge ${unlocked ? 'ok' : ''}">${done}/${bundles.length} 已完成</span>
            </div>
            <p style="margin:4px 0;" class="dim">${room.unlockText}</p>
            <div class="chips">
              ${bundles.map((b) => `<span class="chip ${bundleDone(state, b) ? 'ok' : ''}">${bundleDone(state, b) ? uiIconSvg('check') + ' ' : ''}${b.name}</span>`).join('')}
            </div>
          </button>`;
        }).join('')}
      </div>`;
  } else {
    content = `
      <h3>农场主生涯统计</h3>
      <dl class="detail-list">
        <div><dt>主角性别</dt><dd>${playerGenderOf(state) === 'female' ? '女' : '男'}</dd></div>
        <div><dt>累计总收入</dt><dd>${state.stats.totalEarned} 金</dd></div>
        <div><dt>累计收获作物</dt><dd>${state.stats.cropsHarvested} 株</dd></div>
        <div><dt>累计钓获鱼类</dt><dd>${state.stats.fishCaught} 条（解锁 ${state.stats.fishSpecies.length} 种图鉴）</dd></div>
        <div><dt>累计野外采集</dt><dd>${state.stats.itemsForaged} 次</dd></div>
        <div><dt>累计击败怪物</dt><dd>${state.stats.monstersKilled} 只</dd></div>
        <div><dt>矿洞最深层数</dt><dd>第 ${state.mine.deepest} 层</dd></div>
        <div><dt>累倒/昏迷次数</dt><dd>${state.stats.timesPassedOut} 次</dd></div>
      </dl>
      <h3>爷爷的评估与人生大事</h3>
      <div class="card">
        ${
          state.evaluation
            ? `<p><b>${uiIconSvg('candle')} 爷爷的评分：盛开了 ${state.evaluation.candles} 朵向日葵（总分 ${state.evaluation.score} 分）</b></p>`
            : '<p><b>' + uiIconSvg('candle') + ' 爷爷的约定：</b>第 3 年春天第 1 天，你会在梦里见到爷爷，听他聊聊这两年青禾谷农场的收成。</p>'
        }
        ${
          state.wedding
            ? `<p>${uiIconSvg('bell')} <b>婚礼预告：</b>你与 ${NPC_BY_ID[state.wedding.npcId].name} 的婚礼定于第 ${state.wedding.day} 日举行。</p>`
            : '<p class="dim">好感达到 2 心成为朋友、6 心成为好友、10 心成为知心好友；与心仪的异性单身居民达到 8 心可赠花束交往，10 心可赠美人鱼吊坠求婚。</p>'
        }
      </div>`;
  }

  return `<div class="${pageViewCls()}">
    <div class="sub-tabs" role="tablist" aria-label="手册子页面切换">
      <button class="sub-tab ${journalSubTab === 'skills' ? 'on' : ''}" data-act="journal-subtab" data-sub="skills">技能与工具</button>
      <button class="sub-tab ${journalSubTab === 'bundles' ? 'on' : ''}" data-act="journal-subtab" data-sub="bundles">
        社区中心收集包 <small>可捐 ${need.length}</small>
      </button>
      <button class="sub-tab ${journalSubTab === 'records' ? 'on' : ''}" data-act="journal-subtab" data-sub="records">生涯记录与荣誉</button>
      <button class="sub-tab ${journalSubTab === 'codex' ? 'on' : ''}" data-act="journal-subtab" data-sub="codex">图鉴 <small>${Object.keys(ITEMS).filter(codexCollected).length} 已收集</small></button>
    </div>
    ${content}
  </div>`;
}

/* ---------- 多样化交互弹窗 (Modals) ---------- */

function mapModalHtml(): string {
  const cards = TRAVEL_DESTINATIONS.map((id) => {
    const here = state.location === id || (id === 'mountain' && state.location === 'mine');
    const npcsAtLoc = NPCS.filter((n) => npcLocation(state, n) === id);
    const mins = here ? 0 : travelTime(state, id);
    const spot = FISHING_SPOT_DEFS.find((x) => x.id === id);
    const isDedicatedSpot = !!spot && !['forest', 'mountain', 'beach'].includes(id);
    const lockReason = isDedicatedSpot ? fishingSpotAccessReason(state, id) : null;
    return `<button class="card place ${here ? 'on' : ''} ${lockReason ? 'uncollected' : ''}" data-act="move" data-to="${id}" ${here || lockReason ? 'disabled' : ''}>
      <div>
        <b>${LOCATIONS[id].name}</b>
        <div class="dim" style="font-size:17px;">
          ${spot ? `${spot.waterType === 'river' ? '河流' : spot.waterType === 'lake' ? '湖泊' : '海域'} ${spot.tier} 阶 · 钓鱼 Lv.${spot.minLevel}` : npcsAtLoc.length ? `在场居民：${npcsAtLoc.map((n) => n.name).join('、')}` : '当前无居民在场'}
        </div>
      </div>
      <span>${here ? uiIconSvg('pin') + ' 当前所在' : lockReason ? `未开放 · ${lockReason}` : `前往 · 耗时 ${mins} 分钟${state.unlocks.includes('minecart') ? '（矿车加速）' : ''}`}</span>
    </button>`;
  }).join('');

  return `
    <div class="modal-head">
      <h2>${uiIconSvg('map')} 青禾谷世界地图（点击目的地立即出发）</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="cards">${cards}</div>`;
}

function clinicModalHtml(): string {
  const hpMax = maxHp(state);
  const { missing, cost } = clinicCost(state);
  const open = clinicOpen(state);
  return `
    <div class="modal-head">
      <h2>${uiIconSvg('clinic')} 白芷诊所</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="detail-title">
      <span class="bag-item-icon">${npcAvatarSvg('bai_zhi')}</span>
      <div><b>白芷</b><span>${open ? '坐诊中 · 镇上的草药医生' : '去森林采药了 · 晴天 10 点后回镇，雨天整天在镇上'}</span></div>
    </div>
    <dl class="detail-list">
      <div><dt>当前生命</dt><dd>${state.hp}/${hpMax}</dd></div>
      <div><dt>诊金</dt><dd>每点生命 ${CLINIC.goldPerHp} 金${missing ? ` · 补满共 ${cost} 金` : ''}</dd></div>
      <div><dt>耗时</dt><dd>${CLINIC.minutes} 分钟</dd></div>
    </dl>
    ${bar(state.hp, hpMax, 'hp')}
    <div class="detail-actions">
      <button class="pix-btn gold" data-act="heal" ${open && missing > 0 && state.gold >= CLINIC.goldPerHp ? '' : 'disabled'}>支付诊金治疗${missing ? `（补 ${missing} 点 · ${cost} 金）` : ''}</button>
      <button class="pix-btn ghost" data-act="close-ui-modal">返回</button>
    </div>
    ${missing === 0 ? '<p class="dim">你现在生命全满，不需要治疗。</p>' : !open ? '<p class="dim">白芷不在诊所，等她回镇上再来。</p>' : state.gold < CLINIC.goldPerHp ? '<p class="dim">金币不够支付诊金。</p>' : state.gold < cost ? '<p class="dim">金币不够补满，会先按能付的金额治一部分。</p>' : ''}`;
}

function toolModalHtml(tool: ToolId): string {
  const broken = state.tools[tool] < 0;
  const equipped = state.equippedTools[tool] && !broken;
  const cur = broken ? 0 : (state.durability[tool] ?? 0);
  const max = toolMaxDurability(state.tools[tool]);
  const cost = broken ? null : repairCost(state, tool);
  const nextUpgrade = !broken && tool !== 'rod' ? upgradeCost(state, tool) : null;
  const repairShop = tool === 'rod' ? '海滩 · 老渔夫的小屋' : '小镇 · 阿铁铁匠铺';
  const status = broken ? '已报废' : equipped ? '已装备，可以使用' : '未装备，暂时不能使用';

  return `
    <div class="modal-head">
      <h2>${uiIconSvg('wrench')} 工具详情 · ${TOOL_NAMES[tool]}</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="detail-title">
      <span class="bag-item-icon">${toolIconSvg(tool, Math.max(0, state.tools[tool]))}</span>
      <div><b>${TOOL_NAMES[tool]}</b><span>${broken ? '工具 · 已报废' : `工具 · ${toolLabel(tool)}`}</span></div>
    </div>
    <dl class="detail-list">
      <div><dt>状态</dt><dd>${status}</dd></div>
      <div><dt>用途</dt><dd>${TOOL_DETAILS[tool].use}</dd></div>
      <div><dt>耐久</dt><dd>${broken ? '0/0' : `${cur}/${max}`}</dd></div>
      <div><dt>磨损规则</dt><dd>${TOOL_DETAILS[tool].wear}</dd></div>
      ${broken ? '' : `<div><dt>当前效果</dt><dd>${toolPowerText(tool)}</dd></div>`}
      <div><dt>${broken ? '重新购买' : '修理地点'}</dt><dd>${repairShop}${broken ? ` · ${DURABILITY.baseToolPrice} 金` : ''} <button class="chip" data-act="go-repair-shop" data-to="${tool === 'rod' ? 'beach' : 'town'}" data-shop="${tool === 'rod' ? 'fish_shop' : 'blacksmith'}">前往</button></dd></div>
      ${!broken ? `<div><dt>修理费用</dt><dd>${cost === null ? '耐久已满' : `${cost} 金（修满）`}</dd></div>` : ''}
      ${nextUpgrade ? `<div><dt>下一次升级</dt><dd>${nextUpgrade.gold} 金 + ${itemName(nextUpgrade.ore)} ×${nextUpgrade.oreQty}</dd></div>` : ''}
    </dl>
    ${broken ? '' : durBar(cur, max)}
    <div class="detail-actions">
      ${!broken ? (equipped ? `<button class="pix-btn" data-act="unequip-tool" data-tool="${tool}">卸下工具</button>` : `<button class="pix-btn gold" data-act="equip-tool" data-tool="${tool}">装备工具</button>`) : ''}
      <button class="pix-btn ghost" data-act="close-ui-modal">返回</button>
    </div>`;
}

function itemModalHtml(id: string): string {
  const detail = ITEMS[id];
  const count = state.inventory[id] ?? 0;
  if (!detail || count <= 0) {
    return `<div class="modal-head"><h2>物品详情</h2><button class="pix-btn" data-act="close-ui-modal">关闭</button></div><p>该物品已用完或出货。</p>`;
  }
  const cropDef = detail.cropId ? CROPS[detail.cropId] : null;
  const weaponDef = WEAPONS.find((w) => w.id === detail.id);
  const category = BAG_FILTERS.find(([f]) => f === bagCategory(detail.id))?.[1] ?? '其他';
  const weaponMax = weaponDef ? weaponMaxDurability(detail.id) : 0;
  const weaponCur = weaponDef ? (state.weaponDurability[detail.id] ?? weaponMax) : 0;
  const weaponRepair = weaponDef ? repairCost(state, detail.id) : null;

  return `
    <div class="modal-head">
      <h2>${uiIconSvg('bag')} 物品与装备详情</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="detail-title">
      <span class="bag-item-icon">${itemIconSvg(detail.id)}</span>
      <div><b>${detail.name}</b><span>持有 ×${count} · ${category}</span></div>
      ${rarityBadgeHtml(detail.id, true)}
    </div>
    <dl class="detail-list">
      <div><dt>稀有度</dt><dd>${rarityOf(detail.id).name}</dd></div>
      <div><dt>单件售价</dt><dd>${sellPrice(state, detail.id)} 金</dd></div>
      ${detail.energy ? `<div><dt>食用恢复</dt><dd>+${detail.energy} 体力</dd></div>` : ''}
      ${cropDef ? `<div><dt>种植季节与周期</dt><dd>${cropDef.seasons.map((s) => SEASON_NAMES[s]).join('、')}季 · ${cropDef.growDays} 天成熟</dd></div>` : ''}
      ${weaponDef ? `<div><dt>攻击伤害</dt><dd>${weaponDef.damage[0]}-${weaponDef.damage[1]} · 暴击 ${5 + Math.max(0, WEAPONS.findIndex((w) => w.id === detail.id)) * 2}%（越好的武器暴击越高）</dd></div><div><dt>武器耐久</dt><dd>${weaponCur}/${weaponMax}</dd></div><div><dt>装备状态</dt><dd>${state.weapon === detail.id ? '已装备' : '未装备'}</dd></div><div><dt>修理地点</dt><dd>小镇 · 阿铁铁匠铺 <button class="chip" data-act="go-repair-shop" data-to="town" data-shop="blacksmith">前往</button></dd></div><div><dt>铁匠铺修理费</dt><dd>${weaponRepair === null ? '耐久已满' : `${weaponRepair} 金`}</dd></div>` : ''}
      ${detail.id === 'scrap' ? '<div><dt>说明</dt><dd>工具或武器报废后留下的金属碎片，可卖给铁匠铺回收。</dd></div>' : ''}
    </dl>
    ${weaponDef ? durBar(weaponCur, weaponMax) : ''}
    <div class="qty-row" style="margin:10px 0;">
      <span>数量：</span>
      ${([1, 5, 'all'] as const).map((q) => `<button class="chip ${qty === q ? 'on' : ''}" data-act="qty" data-q="${q}">${q === 'all' ? '全部' : q}</button>`).join('')}
    </div>
    <div class="detail-actions">
      ${weaponDef ? (state.weapon === detail.id ? `<button class="pix-btn" data-act="unequip-weapon">卸下武器</button>` : `<button class="pix-btn gold" data-act="equip-weapon" data-item="${detail.id}">装备武器</button>`) : ''}
      ${detail.energy ? `<button class="pix-btn gold" data-act="eat" data-item="${detail.id}">吃掉 (+${detail.energy} 体力)</button>` : ''}
      ${sellPrice(state, detail.id) > 0 && detail.category !== 'tool' && !(weaponDef && state.weapon === detail.id) ? `<button class="pix-btn" data-act="sell-bag" data-item="${detail.id}">直接出售（八折 ${Math.floor(sellPrice(state, detail.id) * BAG_SELL_RATE)} 金/件）</button>` : ''}
      ${state.location === 'farm' && sellPrice(state, detail.id) > 0 && !(weaponDef && state.weapon === detail.id) ? `<button class="pix-btn" data-act="ship" data-item="${detail.id}">放进出货箱</button>` : ''}
      <button class="pix-btn ghost" data-act="close-ui-modal">关闭</button>
    </div>`;
}

function npcModalHtml(npcId: string): string {
  const npc = NPC_BY_ID[npcId];
  if (!npc) return '';
  const st = state.npcs[npcId];
  const fx = npcFxState?.npcId === npcId ? npcFxState : null;
  const locId = npcLocation(state, npc);
  const isHere = locId === state.location;
  const giftableIds = Object.keys(state.inventory).filter((id) => {
    const cat = ITEMS[id]?.category;
    return cat && cat !== 'tool' && cat !== 'weapon' && state.inventory[id] > 0;
  });

  const lovedNames = (npc.tastes.loved ?? [])
    .filter((x) => !x.startsWith('category:'))
    .map((x) => itemName(x))
    .join('、');

  return `
    <div class="modal-head">
      <h2>${uiIconSvg('chat')} 居民互动 · ${npc.name}</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="card npc npc-modal-card" style="margin-bottom:12px;">
      <div class="avatar-wrap">
        <div class="avatar ${fx && fx.tone !== 'talk' ? `fx-${fx.tone}` : ''}">${npcAvatarSvg(npc.id)}</div>
        ${fx ? `<div class="npc-fx-particles tone-${fx.tone}">${NPC_FX_PARTICLES[fx.tone].map((p, i) => `<span style="--i:${i}">${fxParticle(p)}</span>`).join('')}</div>` : ''}
      </div>
      <div>
        <b>${npc.name}</b> <span class="hearts">${hearts(heartsOf(state, npc.id))}</span>
        ${friendshipBarHtml(npc.id)}
        <p>${npc.intro}</p>
        <p class="dim">
          性别：<b>${npc.gender === 'female' ? '女' : '男'}</b> · 关系：<b>${esc(relationTier(heartsOf(state, npc.id)))}</b>${npc.marriageable && canRomance(state, npc) ? ' · 可恋爱' : ''} ·
          所在位置：<b>${locId ? LOCATIONS[locId].name : '家中'}</b> ·
          生日：${SEASON_NAMES[npc.birthday.season]} ${npc.birthday.day} 日 ·
          最爱礼物：${lovedNames || '当季好物'}
        </p>
        <p class="dim">${st.talkedToday ? uiIconSvg('check') + ' 今天已经聊过天了' : '今天还没打招呼'} · 本周已送礼 ${st.giftsThisWeek}/2 次</p>
      </div>
    </div>
    ${fx ? `<div class="npc-react tone-${fx.tone}">${fx.tone === 'talk' ? uiIconSvg('chat') : uiIconSvg('gift')} ${esc(fx.label ?? '')}</div>` : ''}
    ${
      isHere
        ? `<div class="toolbar">
            <button class="pix-btn gold" data-act="talk" data-npc="${npc.id}">${uiIconSvg('chat')} 与${npc.name}聊天</button>
          </div>
          <h3>${uiIconSvg('gift')} 从背包点选一件礼物送给 ${npc.name}</h3>
          ${
            giftableIds.length
              ? `<div class="bag-grid">${giftableIds
                  .map((id) => {
                    const preview = giftEvaluation(npc, id, isBirthday(state, npc));
                    return `<button class="item" data-act="gift-direct" data-npc="${npc.id}" data-item="${id}" title="价值 ${preview.value} 金（${preview.valueLabel}）">
                      <b>${itemIconSvg(id)}</b>
                      <span>${ITEMS[id].name}</span>${rarityBadgeHtml(id)}
                      <small>×${state.inventory[id]} · 值 ${preview.value} 金 · 点击赠送</small>
                    </button>`;
                  })
                  .join('')}</div>`
              : '<p class="dim">背包里暂时没有可赠送的礼物。</p>'
          }`
        : `<div class="bag-empty">
            <b>${npc.name}现在不在当前地点（当前在：${locId ? LOCATIONS[locId].name : '休息中'}）</b>
            <span>需要与居民处于同一地点才能当面聊天或送礼，点顶部当前地点切换前往。</span>
          </div>`
    }`;
}

function bundleModalHtml(roomId: string): string {
  const room = ROOMS.find((r) => r.id === roomId) ?? ROOMS[0];
  const bundles = BUNDLES.filter((b) => b.room === room.id);
  const need = neededItems(state).filter((id) => (state.inventory[id] ?? 0) > 0);
  const unlocked = state.unlocks.includes(room.unlock);

  return `
    <div class="modal-head">
      <h2>${uiIconSvg('building')} 社区中心 · ${room.name}</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <p>${room.unlockText} ${unlocked ? '<span class="badge ok">已修好解锁！</span>' : ''}</p>
    ${bundles
      .map((b) => {
        const done = bundleDone(state, b);
        return `<div class="bundle-box ${done ? 'done' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <b>${done ? uiIconSvg('check') + ' ' : ''}${b.name}</b>
            <span class="dim">${b.reward.gold ? `奖励 ${b.reward.gold} 金` : b.reward.item ? `奖励 ${itemName(b.reward.item[0])} ×${b.reward.item[1]}` : ''}${b.unlockName ? `${b.reward.gold || b.reward.item ? ' · ' : ''}解锁 ${b.unlockName}${b.unlock && state.unlocks.includes(b.unlock) ? '（已解锁）' : ''}` : ''}</span>
          </div>
          <div class="bundle-needs">
            ${Object.entries(b.needs)
              .map(([itemId, qtyNeed]) => {
                const donated = donatedCount(state, b.id, itemId);
                const inBag = state.inventory[itemId] ?? 0;
                const ok = donated >= qtyNeed;
                return `<span class="chip ${ok ? 'ok' : inBag > 0 ? 'on' : ''}">
                  ${itemName(itemId)} ${donated}/${qtyNeed}${!ok && inBag > 0 ? `（包内有 ${inBag}）` : ''}
                </span>`;
              })
              .join('')}
          </div>
        </div>`;
      })
      .join('')}
    <div class="detail-actions">
      ${
        state.location === 'town'
          ? `<button class="pix-btn gold" data-act="donate" ${need.length ? '' : 'disabled'}>一键捐献背包中所有可捐物品（${need.length} 种）</button>`
          : `<button class="pix-btn gold" data-act="donate" ${need.length ? '' : 'disabled'}>去白鹭镇广场捐献（${need.length} 种可捐）</button>`
      }
      <button class="pix-btn ghost" data-act="close-ui-modal">关闭</button>
    </div>`;
}

function fmtSlotTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function settingsModalHtml(): string {
  return `
    <div class="modal-head">
      <h2>${uiIconSvg('wrench')} 设置</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="detail-title">
      <span class="bag-item-icon">${playerAvatarSvg(playerGenderOf(state))}</span>
      <div><b>${esc(state.playerName || '农场主')}</b><span>${playerGenderOf(state) === 'female' ? '女' : '男'} · 姓名与性别在创建存档时设定，之后不可修改</span></div>
    </div>
    <div class="detail-actions" style="flex-direction:column;align-items:stretch;">
      <button class="pix-btn gold" data-act="open-profile">我的（个人信息 · 资产 · 装备 · 工具）</button>
      <button class="pix-btn" data-act="open-saves">切换存档（当前 ${saveSlots.length}/${MAX_SAVES} 个存档）</button>
      <button class="pix-btn" data-act="create-start">开启新游戏（保留当前存档）</button>
    </div>
    <p class="dim">存档保存在本机浏览器中；开启新游戏不会覆盖当前存档，存档满 ${MAX_SAVES} 个后可选择覆盖其中一个。</p>`;
}

function savesModalHtml(): string {
  const rows = saveSlots
    .map((slot) => {
      const st = slot.state;
      const isActive = slot.id === activeSaveId;
      return `<div class="codex-card" style="align-items:flex-start;text-align:left;">
        <div style="display:flex;gap:10px;align-items:center;width:100%;">
          <span class="bag-item-icon">${playerAvatarSvg(st.playerGender === 'female' ? 'female' : 'male')}</span>
          <div><b>${esc(st.playerName || '农场主')}</b> <span class="badge ${isActive ? 'ok' : ''}">${isActive ? '当前存档' : `${st.playerGender === 'female' ? '女' : '男'}`}</span><br>
          <small class="dim">${formatDate(st)} · ${st.gold} 金 · ${LOCATIONS[st.location].name}</small><br>
          <small class="dim">更新 ${fmtSlotTime(slot.updatedAt)}</small></div>
        </div>
        ${
          savesOverwriteMode
            ? `<button class="pix-btn danger" data-act="saves-overwrite" data-id="${slot.id}">覆盖此存档（开启新游戏）</button>`
            : isActive
              ? '<span class="badge ok">正在游玩</span>'
              : `<button class="pix-btn gold" data-act="saves-switch" data-id="${slot.id}">切换到此存档</button>`
        }
      </div>`;
    })
    .join('');
  return `
    <div class="modal-head">
      <h2>${uiIconSvg('bag')} 存档（${saveSlots.length}/${MAX_SAVES}）</h2>
      <button class="pix-btn" data-act="open-settings">返回设置</button>
    </div>
    ${savesOverwriteMode ? '<p class="dim">存档已满，请选择一个要覆盖的存档；覆盖后将以新角色重新开始。</p>' : ''}
    <div class="codex-grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));">${rows || '<p class="dim">暂时没有存档。</p>'}</div>
    <div class="detail-actions">
      ${
        saveSlots.length >= MAX_SAVES
          ? savesOverwriteMode
            ? '<button class="pix-btn ghost" data-act="open-saves">取消覆盖选择</button>'
            : '<button class="pix-btn gold" data-act="create-start">开启新游戏（先选覆盖存档）</button>'
          : '<button class="pix-btn gold" data-act="create-start">开启新游戏</button>'
      }
      <button class="pix-btn ghost" data-act="close-ui-modal">关闭</button>
    </div>`;
}

function profileModalHtml(): string {
  const gender = playerGenderOf(state);
  const weapon = WEAPONS.find((w) => w.id === state.weapon);
  const weaponMax = weaponMaxDurability(state.weapon);
  const weaponCur = state.weaponDurability[state.weapon] ?? weaponMax;
  const bagIds = Object.keys(state.inventory);
  const bagQty = bagIds.reduce((n, id) => n + (state.inventory[id] ?? 0), 0);
  const bagValue = bagIds.reduce((n, id) => n + sellPrice(state, id) * (state.inventory[id] ?? 0), 0);
  const shipValue = Object.entries(state.shippingBin).reduce((n, [id, q]) => n + sellPrice(state, id) * q, 0);
  const collected = Object.keys(ITEMS).filter(codexCollected).length;
  return `
    <div class="modal-head">
      <h2>${uiIconSvg('chat')} 我的</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="detail-title">
      <span class="bag-item-icon">${playerAvatarSvg(gender)}</span>
      <div><b>${esc(state.playerName || '农场主')}</b><span>${gender === 'female' ? '女' : '男'}</span></div>
    </div>
    <h3>个人信息</h3>
    <dl class="detail-list">
      <div><dt>姓名</dt><dd>${esc(state.playerName || '农场主')}</dd></div>
      <div><dt>性别</dt><dd>${gender === 'female' ? '女' : '男'}</dd></div>
      <div><dt>当前日期</dt><dd>${formatDate(state)} ${formatTime(state.minutes)}</dd></div>
      <div><dt>所在地点</dt><dd>${LOCATIONS[state.location].name}</dd></div>
      <div><dt>生命 / 体力</dt><dd>${state.hp}/${maxHp(state)} · ${Math.ceil(state.energy)}/${state.maxEnergy}</dd></div>
    </dl>
    <h3>资产</h3>
    <dl class="detail-list">
      <div><dt>金币</dt><dd>${state.gold} 金</dd></div>
      <div><dt>累计总收入</dt><dd>${state.stats.totalEarned} 金</dd></div>
      <div><dt>背包物品</dt><dd>${bagIds.length} 种 · 共 ${bagQty} 件（估值 ${bagValue} 金）</dd></div>
      <div><dt>出货箱待结算</dt><dd>${shipValue} 金</dd></div>
      <div><dt>图鉴收集</dt><dd>${collected}/${Object.keys(ITEMS).length}</dd></div>
      <div><dt>矿洞最深</dt><dd>第 ${state.mine.deepest} 层</dd></div>
    </dl>
    <h3>装备</h3>
    <dl class="detail-list">
      <div><dt>当前武器</dt><dd>${weapon?.name ?? state.weapon}${weapon ? `（伤害 ${weapon.damage[0]}-${weapon.damage[1]}）` : ''} · 耐久 ${weaponCur}/${weaponMax}</dd></div>
    </dl>
    <h3>工具</h3>
    <div class="chips">
      ${(['hoe', 'can', 'pickaxe', 'rod', 'axe'] as ToolId[])
        .map((t) => {
          const broken = state.tools[t] < 0;
          return `<span class="chip ${state.equippedTools[t] && !broken ? 'ok' : ''}">${toolIconSvg(t, Math.max(0, state.tools[t]))} ${TOOL_NAMES[t]} · ${broken ? '已报废' : `${toolLabel(t)} · 耐久 ${state.durability[t]}/${toolMaxDurability(state.tools[t])}`} ${state.equippedTools[t] && !broken ? '· 已装备' : ''}</span>`;
        })
        .join('')}
    </div>
    <h3>自动农具（社区中心工坊）</h3>
    <div class="chips">
      ${([
        ['auto_clear', 'auto_clear_daily', 'auto-clear', '自动整地机'],
        ['auto_plant', 'auto_plant_daily', 'auto-plant', '自动播种机'],
        ['auto_harvest', 'auto_harvest_daily', 'auto-harvest', '自动收获机'],
      ] as const)
        .map(([unlock, daily, icon, name]) => {
          const stage = state.unlocks.includes(daily) || state.unlocks.includes(unlock) ? '每日自动' : '未解锁';
          return `<span class="chip ${stage !== '未解锁' ? 'ok' : ''}">${uiIconSvg(icon)} ${name} · ${stage}</span>`;
        })
        .join('')}
      ${state.autoPlantCropId && CROPS[state.autoPlantCropId] ? `<span class="chip">每日自动播种：${CROPS[state.autoPlantCropId].name}</span>` : ''}
    </div>
    <h3>技能</h3>
    <p class="dim">${SKILL_ORDER.map((sk) => `${SKILL_NAMES[sk]} Lv.${skillProgressOf(state, sk).level}`).join(' · ')}</p>
    <div class="detail-actions"><button class="pix-btn ghost" data-act="open-settings">返回设置</button></div>`;
}

function createModalHtml(): string {
  const isFirst = needsCharacterSetup || createTarget?.mode === 'first';
  const title = createTarget?.mode === 'overwrite' ? '覆盖存档 · 创建新角色' : '创建角色 · 开始游戏';
  const genderCard = (g: 'male' | 'female', label: string) => `
    <button class="codex-card ${createGender === g ? '' : 'uncollected'}" data-act="create-gender" data-g="${g}" style="align-items:center;">
      <span class="bag-item-icon">${playerAvatarSvg(g)}</span><b>${label}</b><small>${createGender === g ? '已选择' : '点击选择'}</small>
    </button>`;
  return `
    <div class="modal-head">
      <h2>${uiIconSvg('sparkle')} ${title}</h2>
      ${isFirst ? '' : '<button class="pix-btn" data-act="close-ui-modal">取消</button>'}
    </div>
    <label style="display:block;margin:10px 0;"><b>人物名称</b><br>
      <input id="create-name" type="text" maxlength="12" placeholder="请输入名称（默认：农场主）" value="${esc(createNameDraft)}" style="width:100%;box-sizing:border-box;padding:10px;font-size:18px;margin-top:6px;">
    </label>
    <h3>人物性别与形象</h3>
    <div class="codex-grid" style="grid-template-columns:repeat(2,minmax(140px,1fr));max-width:420px;">
      ${genderCard('male', '男')}
      ${genderCard('female', '女')}
    </div>
    <div class="detail-actions">
      <button class="pix-btn gold" data-act="create-confirm">${createTarget?.mode === 'overwrite' ? '确认覆盖并开始' : '确认并开始游戏'}</button>
      ${isFirst ? '' : '<button class="pix-btn ghost" data-act="close-ui-modal">取消</button>'}
    </div>`;
}

function workbenchBarHtml(benchId: WorkbenchId): string {
  const bench = WORKBENCHES[benchId];
  const unlocked = state.unlocks.includes(bench.unlockId);
  const here = state.location === bench.location;
  const costChips =
    `<span class="chip ${state.gold >= bench.unlockGold ? 'ok' : ''}">金币 ${state.gold}/${bench.unlockGold}</span>` +
    Object.entries(bench.unlockRecipe)
      .map(([id, need]) => `<span class="chip ${(state.inventory[id] ?? 0) >= need ? 'ok' : ''}">${itemName(id)} ${state.inventory[id] ?? 0}/${need}</span>`)
      .join('');
  const canUnlock = here && state.gold >= bench.unlockGold && Object.entries(bench.unlockRecipe).every(([id, need]) => (state.inventory[id] ?? 0) >= need);
  const action = unlocked
    ? here
      ? '<span class="badge ok">已解锁 · 可制作</span>'
      : `<button class="pix-btn" data-act="go-workbench" data-bench="${benchId}">前往${bench.placeName}</button>`
    : here
      ? `<button class="pix-btn gold" data-act="unlock-workbench" data-bench="${benchId}" ${canUnlock ? '' : 'disabled'}>解锁${bench.name}</button>`
      : `<button class="pix-btn" data-act="go-workbench" data-bench="${benchId}">前往${bench.placeName}解锁</button>`;
  return `<div class="mine-hint"><b>${bench.name}</b><span>${bench.placeName}</span><span>${unlocked ? '已解锁' : '未解锁'}</span><div class="chips">${unlocked ? '' : costChips}</div>${action}</div>`;
}

function workbenchCards(): string {
  const bench = state.location === 'town' ? WORKBENCHES.rod : state.location === 'beach' ? WORKBENCHES.bait : null;
  if (!bench) return '';
  const unlocked = state.unlocks.includes(bench.unlockId);
  return `<h3>工作台</h3><div class="cards grid-2"><button class="card place" data-act="open-craft" data-bench="${bench.id}">
    <b>${uiIconSvg('wrench')} ${bench.name}</b>
    <span>${unlocked ? '已解锁 · 点击制作' : `未解锁 · ${bench.unlockGold} 金 + ${Object.entries(bench.unlockRecipe).map(([id, n]) => `${itemName(id)}×${n}`).join('、')}`}</span></button></div>`;
}

function craftModalHtml(focusBench?: WorkbenchId): string {
  const fishLv = skillLevel(state, 'fishing');
  const recipeChips = (recipe: Record<string, number>) =>
    Object.entries(recipe)
      .map(([id, need]) => {
        const have = state.inventory[id] ?? 0;
        const ok = have >= need;
        return `<span class="chip ${ok ? 'ok' : ''}">${itemName(id)} ${have}/${need}</span>`;
      })
      .join('');
  const benchUsable = (benchId: WorkbenchId) => state.unlocks.includes(WORKBENCHES[benchId].unlockId) && state.location === WORKBENCHES[benchId].location;
  const benchBlock = (benchId: WorkbenchId) =>
    !state.unlocks.includes(WORKBENCHES[benchId].unlockId) ? `先解锁${WORKBENCHES[benchId].name}` : `去${WORKBENCHES[benchId].placeName}`;
  const canMake = (benchId: WorkbenchId, recipe: Record<string, number>, minLv: number) =>
    benchUsable(benchId) && fishLv >= minLv && Object.entries(recipe).every(([id, need]) => (state.inventory[id] ?? 0) >= need);

  const rodCards = RODS.filter((r) => r.recipe)
    .map((r) => {
      const owned = state.ownedRods.includes(r.id);
      const ready = !owned && canMake('rod', r.recipe!, r.minLevel);
      const targets = (r.targetFishIds ?? []).slice(0, 4).map((id) => itemName(id)).join('、');
      return `<div class="codex-card" style="align-items:flex-start;text-align:left;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:6px;">
          <span style="display:inline-flex;align-items:center;gap:6px;"><span class="bag-item-icon">${itemIconSvg(r.itemId)}</span><b>${r.name}</b></span>
          ${rarityBadgeHtml(r.itemId, true)}
        </div>
        <small>${r.specialtyDesc}</small>
        ${targets ? `<small class="dim">针对鱼类：${targets}</small>` : ''}
        <small class="dim">需要钓鱼 Lv.${r.minLevel}（当前 Lv.${fishLv}）</small>
        <div class="chips">${recipeChips(r.recipe!)}</div>
        <button class="pix-btn ${ready ? 'gold' : ''}" data-act="craft-gear" data-target="${r.id}" ${ready ? '' : 'disabled'}>
          ${owned ? '已拥有' : !benchUsable('rod') ? benchBlock('rod') : fishLv < r.minLevel ? `需钓鱼 Lv.${r.minLevel}` : ready ? '立即锻造' : '原料不足'}
        </button>
      </div>`;
    })
    .join('');

  const baitCards = BAITS.filter((b) => b.recipe)
    .map((b) => {
      const ready = canMake('bait', b.recipe!, b.minLevel);
      const have = state.inventory[b.id] ?? 0;
      const targets = (b.targetFishIds ?? []).slice(0, 4).map((id) => itemName(id)).join('、');
      return `<div class="codex-card" style="align-items:flex-start;text-align:left;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:6px;">
          <span style="display:inline-flex;align-items:center;gap:6px;"><span class="bag-item-icon">${itemIconSvg(b.id)}</span><b>${b.name} ×${b.craftYield ?? 4}</b></span>
          ${rarityBadgeHtml(b.id, true)}
        </div>
        <small>${b.specialtyDesc}</small>
        ${targets ? `<small class="dim">针对鱼类：${targets}</small>` : ''}
        <small class="dim">需要钓鱼 Lv.${b.minLevel} · 当前持有 ×${have}</small>
        <div class="chips">${recipeChips(b.recipe!)}</div>
        <button class="pix-btn ${ready ? 'gold' : ''}" data-act="craft-gear" data-target="${b.id}" ${ready ? '' : 'disabled'}>
          ${!benchUsable('bait') ? benchBlock('bait') : fishLv < b.minLevel ? `需钓鱼 Lv.${b.minLevel}` : ready ? `调配 ×${b.craftYield ?? 4}` : '原料不足'}
        </button>
      </div>`;
    })
    .join('');

  const rodSection = `<h3>渔具工作台 · 鱼竿锻造</h3>${workbenchBarHtml('rod')}<div class="codex-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));">${rodCards}</div>`;
  const baitSection = `<h3>鱼饵工作台 · 鱼饵调配</h3>${workbenchBarHtml('bait')}<div class="codex-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));">${baitCards}</div>`;
  return `
    <div class="modal-head">
      <h2>${uiIconSvg('wrench')} 渔具与鱼饵工作台</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    ${focusBench === 'bait' ? baitSection : focusBench === 'rod' ? rodSection : rodSection + baitSection}
    <div class="detail-actions">
      <button class="pix-btn ghost" data-act="close-ui-modal">关闭</button>
    </div>`;
}

/** 一键播种的背包弹窗：只列背包里的种子，点选后关弹窗并整场播种 */
function seedBagModalHtml(): string {
  const seedIds = Object.keys(state.inventory).filter((id) => (state.inventory[id] ?? 0) > 0 && ITEMS[id]?.category === 'seed' && !!ITEMS[id].cropId);
  const grid = seedIds.length
    ? `<div class="bag-grid">${seedIds
        .map((id) => `<button class="item" data-act="bulk-plant-seed" data-crop="${ITEMS[id].cropId}"><b>${itemIconSvg(id)}</b><span>${ITEMS[id].name}</span><small>×${state.inventory[id]}</small></button>`)
        .join('')}</div>`
    : '<p class="dim">背包里没有种子，先去商店买点种子吧。</p>';
  return `
    <div class="modal-head">
      <h2>${uiIconSvg('bag')} 背包 · 选择种子</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    ${grid}
    <div class="detail-actions">
      <button class="pix-btn ghost" data-act="close-ui-modal">取消</button>
    </div>`;
}

function uiModalContent(): string {
  if (!uiModal) return '';
  switch (uiModal.kind) {
    case 'seedBag':
      return seedBagModalHtml();
    case 'map':
      return mapModalHtml();
    case 'tool':
      return toolModalHtml(uiModal.tool);
    case 'item':
      return itemModalHtml(uiModal.itemId);
    case 'codex':
      return codexModalHtml(uiModal.itemId);
    case 'craft':
      return craftModalHtml(uiModal.bench);
    case 'npc':
      return npcModalHtml(uiModal.npcId);
    case 'bundle':
      return bundleModalHtml(uiModal.roomId);
    case 'clinic':
      return clinicModalHtml();
    case 'settings':
      return settingsModalHtml();
    case 'saves':
      return savesModalHtml();
    case 'profile':
      return profileModalHtml();
    case 'create':
      return createModalHtml();
  }
}

function shopModal(): string {
  if (!openShopId) return '';
  const shop = shopsAt(state).find((s) => s.id === openShopId);
  if (!shop) return '';
  const closed = shopClosedReason(state, shop);

  const goods = closed
    ? `<p class="dim">${closed}</p>`
    : shop.stock(state).length
      ? `<div class="bag-grid">${shop
          .stock(state)
          .map(
            (e) => `<button class="item buy" data-act="buy" data-item="${e.itemId}" ${state.gold < e.price ? 'disabled' : ''}>
              <b>${itemIconSvg(e.itemId)}</b><span>${itemName(e.itemId)}</span>${rarityBadgeHtml(e.itemId)}<small>${e.price} 金${ITEMS[e.itemId].energy ? ` · +${ITEMS[e.itemId].energy} 体力` : ''}</small></button>`,
          )
          .join('')}</div>`
      : '<p class="dim">暂时没货。</p>';

  const upgrades =
    shop.id === 'blacksmith' && !closed
      ? `<h3>工具升级</h3><div class="chips">${(['hoe', 'can', 'pickaxe', 'axe'] as ToolId[])
          .map((t) => {
            if (state.tools[t] < 0) return `<span class="chip off">${TOOL_NAMES[t]}已报废，先买新的</span>`;
            const cost = upgradeCost(state, t);
            return cost
              ? `<button class="chip" data-act="upgrade" data-tool="${t}">升级${TOOL_NAMES[t]}（${TOOL_LEVEL_NAMES[state.tools[t]]}→${TOOL_LEVEL_NAMES[state.tools[t] + 1]}）${cost.gold} 金 + ${itemName(cost.ore)}×${cost.oreQty}</button>`
              : `<span class="chip off">${TOOL_NAMES[t]}已满级</span>`;
          })
          .join('')}</div>`
      : '';

  const repairTargets: string[] =
    shop.id === 'blacksmith'
      ? [...(['hoe', 'can', 'pickaxe', 'axe'] as ToolId[]), ...Object.keys(state.inventory).filter((id) => ITEMS[id]?.category === 'weapon')]
      : shop.id === 'fish_shop'
        ? ['rod']
        : [];
  const repairs =
    !closed && repairTargets.some((t) => repairCost(state, t) !== null)
      ? `<h3>修复耐久</h3><div class="chips">${repairTargets
          .map((t) => {
            const cost = repairCost(state, t);
            if (cost === null) return '';
            const name = (['hoe', 'can', 'pickaxe', 'rod', 'axe'] as string[]).includes(t) ? TOOL_NAMES[t as ToolId] : itemName(t);
            return `<button class="chip" data-act="repair" data-target="${t}" ${state.gold < cost ? 'disabled' : ''}>修${name}（${cost} 金）</button>`;
          })
          .join('')}</div>`
      : '';

  // 只展示本店收的物品：不收的（类别不对/售价为 0/已装备武器）不出现在背包里
  const bagIds = Object.keys(state.inventory).filter((id) => {
    if ((state.inventory[id] ?? 0) <= 0) return false;
    const equippedWeapon = ITEMS[id].category === 'weapon' && state.weapon === id;
    return !equippedWeapon && shop.buys.includes(ITEMS[id].category) && sellPrice(state, id) > 0;
  });
  const bag = closed
    ? '<p class="dim">店铺休息中，暂时不能出售。</p>'
    : bagIds.length
      ? `<div class="bag-grid">${bagIds
          .map(
            (id) =>
              `<button class="item" data-act="sell" data-item="${id}"><b>${itemIconSvg(id)}</b><span>${ITEMS[id].name}</span>${rarityBadgeHtml(id)}<small>×${state.inventory[id]} · 卖 ${sellPrice(state, id)} 金</small></button>`,
          )
          .join('')}</div>`
      : '<p class="dim">没有本店收的物品。</p>';

  return `
  <div class="shop-head">
    <h2>${shop.name}</h2><span class="gold">${state.gold} 金</span>
    <span class="qty-row">数量 ${([1, 5, 'all'] as const)
      .map((q) => `<button class="chip ${qty === q ? 'on' : ''}" data-act="qty" data-q="${q}">${q === 'all' ? '全部' : q}</button>`)
      .join('')}</span>
    <button class="pix-btn" data-act="close-shop">关闭</button>
  </div>
  <div class="shop-grid">
    <section><h3>商品（点一下购买）</h3>${goods}${upgrades}${repairs}</section>
    <section class="shop-bag"><h3>我的背包${closed ? '' : '（点一下卖给本店）'}</h3>${bag}</section>
  </div>`;
}

/* ---------- 顶部主导航与全局渲染 ---------- */

function renderNav(): string {
  const warnings = repairWarnings();
  const hereCount = npcsHere(state).length;
  const donateCount = neededItems(state).filter((id) => (state.inventory[id] ?? 0) > 0).length;
  const bagSpecies = Object.keys(state.inventory).length;

  return `
    <button class="nav-tab ${page === 'scene' ? 'on' : ''}" data-act="go-page" data-page="scene">
      <span>1. 场景</span>
      <span class="nav-badge">${LOCATIONS[state.location].name}</span>
    </button>
    <button class="nav-tab ${page === 'bag' ? 'on' : ''}" data-act="go-page" data-page="bag">
      <span>2. 背包与装备</span>
      <span class="nav-badge ${warnings.length ? 'warn' : ''}">${warnings.length ? `待修 ${warnings.length}` : `${bagSpecies} 种`}</span>
    </button>
    <button class="nav-tab ${page === 'social' ? 'on' : ''}" data-act="go-page" data-page="social">
      <span>3. 社交与镇民</span>
      <span class="nav-badge">${hereCount ? `在场 ${hereCount}` : `共 ${NPCS.length} 人`}</span>
    </button>
    <button class="nav-tab ${page === 'journal' ? 'on' : ''}" data-act="go-page" data-page="journal">
      <span>4. 手册与收集</span>
      <span class="nav-badge">${donateCount ? `可捐 ${donateCount}` : '技能/成就'}</span>
    </button>
  `;
}

/** 可视化钓鱼拉锯战弹窗：动态水面浮漂 + 鱼影向岸边游动 + 收线进度条与鱼线张力红警条 */
function renderFishingDuelModal(): string {
  if (!state.activity || state.activity.kind !== 'fishing') return '';
  const act = state.activity;
  const fish = FISH.find((f) => f.id === act.fishId);
  const progress = Math.max(0, Math.min(100, Math.round(act.progress)));
  const tensionCap = act.tensionCap ?? 100;
  const tension = Math.max(0, Math.min(tensionCap, Math.round(act.tension)));
  const tensionPct = Math.round((tension / tensionCap) * 100);
  const danger = tensionPct >= 70;
  // 鱼从右侧 86% 随进度向左侧岸边 18% 游动
  const fishLeft = Math.round(86 - (progress / 100) * 68);

  let stateBadge = '';
  let stateDesc = '';
  if (act.hint === 'struggle') {
    stateBadge = uiIconSvg('wave') + ' 猛烈挣扎！浪花四溅';
    stateDesc = '浮漂猛地往下一沉，鱼线绷得紧紧的！建议点「2. 顺势放线」卸掉张力，硬拉容易断线。';
  } else if (act.hint === 'rest') {
    stateBadge = uiIconSvg('bubble') + ' 水面平静 · 力气耗尽';
    stateDesc = '鱼好像没什么力气了！趁现在点「1. 趁机收线」飞快拉近距离。';
  } else {
    stateBadge = uiIconSvg('question') + ' 涟漪阵阵 · 动向不明';
    stateDesc = '水面泛起一圈圈涟漪，看不清鱼在蓄力还是休息，根据当前张力谨慎试探。';
  }
  const duelRod = act.rodId ? ROD_BY_ID[act.rodId] : equippedRod(state);
  const duelBait = act.baitId ? BAIT_BY_ID[act.baitId] : null;

  return `
    <div class="modal-head">
      <h2>${uiIconSvg('skill_fishing')} 水域拉锯战 · 第 ${act.round + 1}/${FISH_MAX_ROUNDS} 回合</h2>
      <span class="badge ${danger ? 'bad' : 'ok'}">${danger ? uiIconSvg('warning') + ' 张力过高预警' : `难度 ${starRow(fish?.difficulty ?? 1)}`}</span>
    </div>
    <div class="fish-duel-pond ${act.hint}">
      <div class="duel-state-banner">
        <b>${stateBadge}</b>
        <small>${duelRod.name}${duelBait ? ` · ${duelBait.name}` : ''} · 鱼竿耐久 ${state.durability.rod}/${toolMaxDurability(duelRod.tier)}</small>
      </div>
      <p style="margin:0 0 10px;font-size:18px;">${stateDesc}</p>
      <div class="duel-water-track">
        <span class="duel-shore">${uiIconSvg('skill_fishing')} 岸边鱼钩</span>
        <span class="duel-fish-swim" style="left:${fishLeft}%;">${uiIconSvg('fish')} 鱼影 (${progress}%)</span>
      </div>
    </div>
    <div class="duel-meters">
      <div class="duel-meter-row">
        <div class="duel-meter-head">
          <b>收线进度（满 100% 钓起上岸）</b>
          <span>${progress}%</span>
        </div>
        ${bar(progress, 100, 'energy')}
      </div>
      <div class="duel-meter-row ${danger ? 'tension-danger' : ''}">
        <div class="duel-meter-head">
          <b>鱼线张力（满 ${tensionCap} 鱼线崩断，额外 -${DURABILITY.lineBreakWear} 耐久）</b>
          <span>${tension}/${tensionCap} ${danger ? '· 危险！快放线' : ''}</span>
        </div>
        ${bar(tensionPct, 100, danger ? 'hp' : tensionPct >= 45 ? 'warnbar' : 'xp')}
      </div>
    </div>
    <div class="duel-btns">
      <button class="pix-btn gold" data-act="choose" data-i="0">1. ${uiIconSvg('skill_fishing')} 趁机收线</button>
      <button class="pix-btn" data-act="choose" data-i="1">2. ${uiIconSvg('wave')} 顺势放线</button>
      <button class="pix-btn danger" data-act="choose" data-i="2">3. ${uiIconSvg('scissors')} 剪断放弃</button>
    </div>
    <p class="dim" style="margin:8px 0 0;font-size:16px;">提示：可直接按键盘数字键 1（收线）、2（放线）、3（放弃）操作。</p>
  `;
}

function render(): void {
  const hpMax = maxHp(state);
  const hudLogo = document.getElementById('hud-logo');
  if (hudLogo && !hudLogo.querySelector('.brand-logo-crest')) {
    hudLogo.innerHTML = `${brandCrestSvg()}<span class="brand-logo-text"><span class="brand-logo-title">青禾谷物语</span><small class="brand-logo-sub">★ QINGHE VALLEY ★</small></span>`;
  }
  $('hud-loc').innerHTML = `${uiIconSvg('pin')} <b>${LOCATIONS[state.location].name}</b> <small>[切换地点]</small>`;
  $('hud-date').textContent = `${formatDate(state)} ${formatTime(state.minutes)} · ${WEATHER_NAMES[state.weather]}（明日 ${WEATHER_NAMES[state.tomorrowWeather]}）`;
  $('hud-gold').textContent = `${state.gold} 金`;
  const playerChip = document.getElementById('hud-player');
  if (playerChip) {
    playerChip.innerHTML = `${playerAvatarSvg(playerGenderOf(state))}<span>${esc(state.playerName || '农场主')}</span>`;
  }
  const hpCls = `hp${mineFxState.playerHit ? ' fx-hit' : ''}`;
  $('hud-bars').innerHTML =
    bar(state.energy, state.maxEnergy, 'energy') + (state.hp < hpMax || state.location === 'mine' ? bar(state.hp, hpMax, hpCls) : '');

  $('page-nav').innerHTML = renderNav();

  if (page === 'scene') {
    $('stage').innerHTML = scenePage();
    if (state.location === 'farm') markFarmEntered();
    else farmEntered = false;
  } else if (page === 'bag') {
    $('stage').innerHTML = bagPage();
  } else if (page === 'social') {
    $('stage').innerHTML = socialPage();
  } else {
    $('stage').innerHTML = journalPage();
  }
  pageEnterPending = false;
  // 各类动效都是一次性的：本次渲染已消费，立即清空，避免后续任何重渲染（切页、失败操作等）重播旧飘字
  tileFxMap.clear();
  groveFloatMap.clear();
  groveFxId = null;
  forestChopFx = false;
  for (const slot of forestTreeSlots) {
    slot.fx = undefined;
    slot.floatText = undefined;
  }
  mysteryState.flipFx = false;
  mineFxState = { rockHit: false, slash: false };
  // npcFxState 不在此清：居民弹窗在下方 uiModalContent() 生成后才消费（见 ui-modal 渲染处）

  $('log').innerHTML = log.map((e) => `<div class="log-line ${e.level}">${esc(e.text)}</div>`).join('');
  renderToasts();

  // 1. 引擎活动弹窗（钓鱼使用可视化拉锯战弹窗；节日/心事件/职业选择使用通用弹窗）最高优先级
  const view = activityView(state);
  const modal = $('modal');
  if (view) {
    modal.style.display = 'flex';
    if (state.activity?.kind === 'fishing') {
      $('modal-card').innerHTML = renderFishingDuelModal();
    } else {
      $('modal-card').innerHTML = `<h2>${esc(view.title)}</h2>${view.lines.map((l) => `<p>${esc(l)}</p>`).join('')}
        <div class="modal-btns">${view.options.map((o, i) => `<button class="pix-btn big" data-act="choose" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
    }
  } else {
    modal.style.display = 'none';
  }

  // 2. 店铺交易修复弹窗
  const shopHtml = view ? '' : shopModal();
  if (openShopId && !shopHtml) openShopId = null;
  $('shop-modal').style.display = shopHtml ? 'flex' : 'none';
  if (shopHtml) $('shop-modal-card').innerHTML = shopHtml;

  // 3. 多功能 UI 弹窗（地图快旅 / 物品与工具详情 / 居民互动送礼 / 社区中心房间）
  const uiHtml = view || shopHtml ? '' : uiModalContent();
  $('ui-modal').style.display = uiHtml ? 'flex' : 'none';
  if (uiHtml) $('ui-modal-card').innerHTML = uiHtml;
  // 居民互动动效在弹窗 HTML 生成后才消费（stage 里的在场 pill 已在上方消费过同一状态）
  npcFxState = null;

  if (nightFlash) {
    $('night').classList.remove('show');
    void $('night').offsetWidth;
    $('night').classList.add('show');
  }
}

/* ---------- 点击与键盘事件分发 ---------- */

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || el.hasAttribute('disabled')) return;
  const act = el.dataset.act!;
  switch (act) {
    case 'go-page': {
      const next = el.dataset.page as PageId;
      if (next !== page) pageEnterPending = true;
      page = next;
      uiModal = null;
      render();
      break;
    }
    case 'farm-subtab':
      farmSubTab = el.dataset.sub as FarmSubTab;
      selectedCell = null;
      render();
      break;
    case 'social-subtab':
      socialSubTab = el.dataset.sub as SocialSubTab;
      render();
      break;
    case 'journal-subtab':
      journalSubTab = el.dataset.sub as JournalSubTab;
      render();
      break;
    case 'open-map':
      uiModal = { kind: 'map' };
      render();
      break;
    case 'open-npc':
      uiModal = { kind: 'npc', npcId: el.dataset.npc! };
      render();
      break;
    case 'open-bundle-room':
      uiModal = { kind: 'bundle', roomId: el.dataset.room! };
      render();
      break;
    case 'open-clinic':
      uiModal = { kind: 'clinic' };
      render();
      break;
    case 'heal':
      doAction({ type: 'heal' });
      break;
    case 'close-ui-modal':
      if (needsCharacterSetup) break; // 角色创建完成前不可关闭
      uiModal = null;
      render();
      break;
    case 'tile':
      selectedCell = { row: Number(el.dataset.row), col: Number(el.dataset.col) };
      tileFxMap.clear();
      render();
      break;
    case 'close-tile':
      selectedCell = null;
      render();
      break;
    case 'tile-op': {
      if (!selectedCell) break;
      const { row, col } = selectedCell;
      const op = el.dataset.op as 'clear' | 'till' | 'water' | 'harvest' | 'deweed' | 'uproot';
      doAction({ type: op, target: [{ row, col }] }, [`${row}-${col}`]);
      break;
    }
    case 'tile-plant': {
      if (!selectedCell) break;
      const { row, col } = selectedCell;
      doAction({ type: 'plant', cropId: el.dataset.crop!, target: [{ row, col }] }, [`${row}-${col}`]);
      break;
    }
    case 'bulk-water':
      doAction({ type: 'water', target: 'all' });
      break;
    case 'bulk-harvest':
      doAction({ type: 'harvest', target: 'all' });
      break;
    case 'bulk-plant':
      uiModal = { kind: 'seedBag' };
      render();
      break;
    case 'bulk-plant-seed': {
      const cropId = el.dataset.crop!;
      const def = CROPS[cropId];
      const inSeason = !!def?.seasons.includes(state.season);
      // 只种可种植的地块：已开垦、无作物、无杂草，且当季（或温室地块）；未开垦/异常/已播种的都跳过
      const hasPlantable = state.farm.flat().some((tile) => tile.ground === 'tilled' && !tile.crop && !tile.weeds && (inSeason || !!tile.greenhouse));
      if (!hasPlantable) {
        pushToast('没有可以种的农田', 'bad');
        render();
        break;
      }
      uiModal = null;
      state.autoPlantCropId = cropId; // 同步为每日自动播种的种子
      doAction({ type: 'plant', cropId, target: 'all' });
      break;
    }
    case 'bulk-deweed':
      doAction({ type: 'deweed', target: 'all' });
      break;
    case 'bulk-uproot-wilted':
      doAction({ type: 'uproot', target: 'all', onlyWilted: true });
      break;
    case 'ship-all':
      doAction({ type: 'ship', itemId: 'all', qty: 'all' });
      break;
    case 'ship':
      doAction({ type: 'ship', itemId: el.dataset.item!, qty });
      break;
    case 'eat':
      doAction({ type: 'eat', itemId: el.dataset.item! });
      break;
    case 'view-tool':
      selectedEquipment = { kind: 'tool', tool: el.dataset.tool as ToolId };
      selectedItem = null;
      uiModal = { kind: 'tool', tool: el.dataset.tool as ToolId };
      render();
      break;
    case 'view-codex':
      selectedItem = el.dataset.item!;
      uiModal = { kind: 'codex', itemId: el.dataset.item! };
      render();
      break;
    case 'codex-open-bag':
      selectedItem = el.dataset.item!;
      page = 'bag';
      uiModal = { kind: 'item', itemId: el.dataset.item! };
      render();
      break;
    case 'view-weapon':
      selectedEquipment = { kind: 'weapon', itemId: el.dataset.item! };
      selectedItem = el.dataset.item!;
      uiModal = { kind: 'item', itemId: el.dataset.item! };
      render();
      break;
    case 'item': {
      const id = el.dataset.item!;
      if (giftNpc) {
        const npc = giftNpc;
        giftNpc = null;
        doAction({ type: 'gift', npcId: npc, itemId: id });
      } else {
        selectedEquipment = null;
        selectedItem = id;
        uiModal = { kind: 'item', itemId: id };
        render();
      }
      break;
    }
    case 'gift-direct': {
      doAction({ type: 'gift', npcId: el.dataset.npc!, itemId: el.dataset.item! });
      break;
    }
    case 'talk':
      doAction({ type: 'talk', npcId: el.dataset.npc! });
      break;
    case 'open-shop':
      openShopId = el.dataset.shop!;
      uiModal = null;
      render();
      break;
    case 'close-shop':
      openShopId = null;
      render();
      break;
    case 'move': {
      const to = el.dataset.to as LocationId;
      openShopId = null;
      uiModal = null;
      page = 'scene';
      render();
      playTravelFxStaged(state.location, to, travelSub(to), () => {
        doAction({ type: 'move', to });
      });
      break;
    }
    case 'go-general-store':
      selectedCell = null;
      openShopId = null;
      uiModal = null;
      page = 'scene';
      render();
      playTravelFxStaged(state.location, 'town', travelSub('town'), () => {
        if (state.location !== 'town') doAction({ type: 'move', to: 'town' });
        if (state.location === 'town') {
          openShopId = 'general';
          render();
        }
      });
      break;
    case 'go-repair-shop': {
      const to = el.dataset.to as LocationId;
      const shopId = el.dataset.shop!;
      selectedCell = null;
      openShopId = null;
      uiModal = null;
      page = 'scene';
      render();
      playTravelFxStaged(state.location, to, travelSub(to), () => {
        if (state.location !== to) doAction({ type: 'move', to });
        if (state.location === to) {
          openShopId = shopId;
          render();
        }
      });
      break;
    }
    case 'forage':
      doAction({ type: 'forage' });
      break;
    case 'forage-one':
      doAction({ type: 'forage', index: Number(el.dataset.idx) });
      break;
    case 'tree-hit': {
      syncForestUiState();
      const idx = Number(el.dataset.idx);
      const slot = forestTreeSlots[idx];
      if (!slot || slot.stump) break;
      for (const s of forestTreeSlots) {
        s.fx = undefined;
        s.floatText = undefined;
      }
      if (slot.hits < 2) {
        slot.hits += 1;
        slot.fx = 'hit';
        slot.floatText = `再砍 ${3 - slot.hits} 下`;
        render();
      } else {
        activeChopIdx = idx;
        doAction({ type: 'chop' });
      }
      break;
    }
    case 'chop':
      activeChopIdx = null;
      doAction({ type: 'chop' });
      break;
    case 'grove':
      doAction({ type: 'grove', grove: el.dataset.grove as GroveId });
      break;
    case 'forest-explore':
      mysteryState.spotIdx = Math.floor(Math.random() * MYSTERY_CARDS.length);
      doAction({ type: 'forestExplore' });
      break;
    case 'fish':
      doAction({ type: 'fish' });
      break;
    case 'equip-fishing-rod':
      doAction({ type: 'equipRod', rodId: el.dataset.rod! });
      break;
    case 'equip-fishing-bait':
      doAction({ type: 'equipBait', baitId: el.dataset.bait || null });
      break;
    case 'open-craft':
      uiModal = { kind: 'craft', bench: (el.dataset.bench as WorkbenchId | undefined) || undefined };
      render();
      break;
    case 'unlock-workbench':
      doAction({ type: 'unlockWorkbench', bench: el.dataset.bench as WorkbenchId });
      break;
    case 'go-workbench': {
      const bench = WORKBENCHES[el.dataset.bench as WorkbenchId];
      uiModal = null;
      page = 'scene';
      render();
      playTravelFxStaged(state.location, bench.location, travelSub(bench.location), () => {
        if (state.location !== bench.location) doAction({ type: 'move', to: bench.location });
        if (state.location === bench.location) {
          uiModal = { kind: 'craft', bench: bench.id };
          render();
        }
      });
      break;
    }
    case 'craft-gear': {
      const targetId = el.dataset.target!;
      const rod = ROD_BY_ID[targetId];
      const bait = BAIT_BY_ID[targetId];
      const beforeOwned = state.ownedRods.length;
      const beforeQty = bait ? (state.inventory[bait.id] ?? 0) : 0;
      doAction({ type: 'craftGear', targetId });
      if (rod && state.ownedRods.length > beforeOwned) {
        playCraftRevealFx(rod.itemId, 1, rod.specialtyDesc);
      } else if (bait && (state.inventory[bait.id] ?? 0) > beforeQty) {
        playCraftRevealFx(bait.id, bait.craftYield ?? 4, bait.specialtyDesc);
      }
      break;
    }
    case 'festival':
      doAction({ type: 'festival' });
      break;
    case 'buy': {
      const itemId = el.dataset.item!;
      const rod = ROD_BY_ITEM[itemId];
      const bait = BAIT_BY_ID[itemId];
      const beforeOwned = state.ownedRods.length;
      const beforeQty = state.inventory[itemId] ?? 0;
      doAction({ type: 'buy', itemId, qty: qty === 'all' ? 1 : qty });
      if (rod && state.ownedRods.length > beforeOwned && rod.rarity >= 2) {
        playCraftRevealFx(rod.itemId, 1, rod.specialtyDesc);
      } else if (bait && (state.inventory[itemId] ?? 0) > beforeQty && bait.rarity >= 2) {
        playCraftRevealFx(bait.id, (state.inventory[itemId] ?? 0) - beforeQty, bait.specialtyDesc);
      }
      break;
    }
    case 'sell':
      doAction({ type: 'sell', itemId: el.dataset.item!, qty });
      break;
    case 'sell-bag': {
      const itemId = el.dataset.item!;
      doAction({ type: 'sellBag', itemId, qty });
      if (!state.inventory[itemId]) {
        uiModal = null;
        selectedItem = null;
        render();
      }
      break;
    }
    case 'upgrade':
      doAction({ type: 'upgrade', tool: el.dataset.tool as ToolId });
      break;
    case 'equip-weapon':
      selectedEquipment = { kind: 'weapon', itemId: el.dataset.item! };
      selectedItem = el.dataset.item!;
      doAction({ type: 'equipWeapon', itemId: el.dataset.item! });
      break;
    case 'unequip-weapon':
      if (state.weapon !== 'fists') {
        selectedEquipment = { kind: 'weapon', itemId: state.weapon };
        selectedItem = state.weapon;
      }
      doAction({ type: 'unequipWeapon' });
      break;
    case 'equip-tool':
      selectedEquipment = { kind: 'tool', tool: el.dataset.tool as ToolId };
      selectedItem = null;
      doAction({ type: 'equipTool', tool: el.dataset.tool as ToolId });
      break;
    case 'unequip-tool':
      selectedEquipment = { kind: 'tool', tool: el.dataset.tool as ToolId };
      selectedItem = null;
      doAction({ type: 'unequipTool', tool: el.dataset.tool as ToolId });
      break;
    case 'repair':
      doAction({ type: 'repair', target: el.dataset.target! });
      break;
    case 'bag-filter':
      bagFilter = el.dataset.f!;
      render();
      break;
    case 'donate': {
      if (state.location === 'town') {
        doAction({ type: 'donate', itemId: 'all' });
        break;
      }
      uiModal = null;
      page = 'scene';
      render();
      playTravelFxStaged(state.location, 'town', travelSub('town'), () => {
        if (state.location !== 'town') doAction({ type: 'move', to: 'town' });
        if (state.location === 'town') doAction({ type: 'donate', itemId: 'all' });
      });
      break;
    }
    case 'enter-mine': {
      const floor = Number(el.dataset.floor);
      playTravelFxStaged(state.location, 'mine', '乘电梯进入矿洞', () => {
        doAction({ type: 'enterMine', floor });
      });
      break;
    }
    case 'mine-rock-all':
      doAction({ type: 'mineRock', count: 'all' });
      break;
    case 'mine-rock1':
      doAction({ type: 'mineRock', count: 1 });
      break;
    case 'attack':
      doAction({ type: 'attack' });
      break;
    case 'descend':
      doAction({ type: 'descend' });
      break;
    case 'leave-mine':
      playTravelFxStaged(state.location, 'mountain', '乘电梯返回地面', () => {
        doAction({ type: 'leaveMine' });
      });
      break;
    case 'sleep':
      uiModal = null;
      openShopId = null;
      doAction({ type: 'sleep' });
      break;
    case 'wait':
      doAction({ type: 'wait', minutes: 60 });
      break;
    case 'qty':
      qty = el.dataset.q === 'all' ? 'all' : Number(el.dataset.q);
      render();
      break;
    case 'choose':
      doAction({ type: 'choose', index: Number(el.dataset.i) });
      break;
    case 'open-settings':
      if (needsCharacterSetup) break;
      savesOverwriteMode = false;
      uiModal = { kind: 'settings' };
      render();
      break;
    case 'open-profile':
      if (needsCharacterSetup) break;
      uiModal = { kind: 'profile' };
      render();
      break;
    case 'open-saves':
      savesOverwriteMode = false;
      uiModal = { kind: 'saves' };
      render();
      break;
    case 'create-start': {
      // 未满 5 个存档直接创建; 已满 5 个先进入覆盖选择
      if (saveSlots.length >= MAX_SAVES) {
        savesOverwriteMode = true;
        uiModal = { kind: 'saves' };
        pushToast('存档已满（5/5），请选择一个要覆盖的存档', 'warn');
      } else {
        createTarget = { mode: needsCharacterSetup ? 'first' : 'new' };
        createGender = playerGenderOf(state);
        createNameDraft = '';
        uiModal = { kind: 'create' };
      }
      render();
      break;
    }
    case 'saves-overwrite':
      createTarget = { mode: 'overwrite', slotId: el.dataset.id };
      createGender = 'male';
      createNameDraft = '';
      uiModal = { kind: 'create' };
      render();
      break;
    case 'saves-switch': {
      const target = saveSlots.find((x) => x.id === el.dataset.id);
      if (!target || target.id === activeSaveId) break;
      save(); // 先保存当前进度, 切换不会丢当前存档
      activeSaveId = target.id;
      state = target.state;
      persistSaves();
      page = 'scene';
      farmSubTab = 'field';
      selectedCell = null;
      openShopId = null;
      giftNpc = null;
      selectedItem = null;
      selectedEquipment = null;
      tileFxMap.clear();
      savesOverwriteMode = false;
      uiModal = null;
      log = [{ level: 'info' as const, text: `已切换到存档「${state.playerName || '农场主'}」，继续你的田园生活。` }];
      render();
      pushToast(`已切换到 ${state.playerName || '农场主'} 的存档`, 'good');
      break;
    }
    case 'create-gender': {
      const input = document.getElementById('create-name') as HTMLInputElement | null;
      if (input) createNameDraft = input.value;
      createGender = el.dataset.g === 'female' ? 'female' : 'male';
      uiModal = { kind: 'create' };
      render();
      setTimeout(() => document.getElementById('create-name')?.focus(), 0);
      break;
    }
    case 'create-confirm': {
      const input = document.getElementById('create-name') as HTMLInputElement | null;
      const name = (input?.value ?? createNameDraft).trim().slice(0, 12) || '农场主';
      const mode = createTarget?.mode ?? (needsCharacterSetup ? 'first' : 'new');
      const fresh = createNewGame(Date.now(), createGender, name);
      const now = Date.now();
      const overwriteSlotId = createTarget?.mode === 'overwrite' ? createTarget.slotId : undefined;
      if (mode === 'overwrite' && overwriteSlotId) {
        const slot = saveSlots.find((x) => x.id === overwriteSlotId);
        if (slot) {
          slot.state = fresh;
          slot.createdAt = now;
          slot.updatedAt = now;
          activeSaveId = slot.id;
        }
      } else {
        const slot: SaveSlot = { id: `save-${now}-${Math.floor(Math.random() * 1e6)}`, createdAt: now, updatedAt: now, state: fresh };
        saveSlots = [slot, ...saveSlots].slice(0, MAX_SAVES);
        activeSaveId = slot.id;
      }
      state = fresh;
      needsCharacterSetup = false;
      createTarget = null;
      savesOverwriteMode = false;
      page = 'scene';
      farmSubTab = 'field';
      selectedCell = null;
      openShopId = null;
      giftNpc = null;
      selectedItem = null;
      selectedEquipment = null;
      tileFxMap.clear();
      uiModal = null;
      log = [{ level: 'info' as const, text: `${name} 来到了青禾谷。先清理、开垦、播种，再记得每天浇水。` }];
      persistSaves();
      render();
      pushToast(`欢迎来到青禾谷，${name}！（姓名与性别已设定，不可修改）`, 'good');
      break;
    }
  }
});

$('shop-modal').addEventListener('click', (e) => {
  if (e.target === $('shop-modal')) {
    openShopId = null;
    render();
  }
});
$('ui-modal').addEventListener('click', (e) => {
  if (e.target === $('ui-modal')) {
    if (needsCharacterSetup) return; // 角色创建完成前不可关闭
    uiModal = null;
    render();
  }
});
document.addEventListener('keydown', (e) => {
  if (state.activity?.kind === 'fishing') {
    if (e.key === '1') {
      e.preventDefault();
      doAction({ type: 'choose', index: 0 });
      return;
    }
    if (e.key === '2') {
      e.preventDefault();
      doAction({ type: 'choose', index: 1 });
      return;
    }
    if (e.key === '3') {
      e.preventDefault();
      doAction({ type: 'choose', index: 2 });
      return;
    }
  }
  if (e.key === 'Escape') {
    if (needsCharacterSetup) return; // 角色创建完成前不可退出
    if (openShopId) {
      openShopId = null;
      render();
    } else if (uiModal) {
      uiModal = null;
      render();
    } else if (selectedCell) {
      selectedCell = null;
      render();
    }
  }
});

if (needsCharacterSetup) uiModal = { kind: 'create' };
render();
playPageRefreshFx();
if (needsCharacterSetup) setTimeout(() => document.getElementById('create-name')?.focus(), 0);
