import { BUNDLES, ROOMS } from '../data/bundles.js';
import { BAG_SELL_RATE, CLINIC, DURABILITY, POINTS_PER_HEART, SAVE_VERSION, TOOL_POWER } from '../data/config.js';
import { CROPS } from '../data/crops.js';
import { FISH, ROD_NAMES } from '../data/fish.js';
import { ITEMS, itemName, rarityOf } from '../data/items.js';
import { GROVES } from '../data/forest.js';
import { MONSTERS, WEAPONS, ORES, GEMS, MINE_CHESTS } from '../data/mine.js';
import { NPC_BY_ID, NPCS } from '../data/npcs.js';
import { SKILL_NAMES, SKILL_ORDER, TOOL_LEVEL_NAMES, TOOL_NAMES } from '../data/skills.js';
import { LOCATIONS, SEASON_NAMES, TRAVEL_DESTINATIONS, WEATHER_NAMES } from '../data/world.js';
import { applyAction, travelTime } from '../engine/actions.js';
import { activityView } from '../engine/activity.js';
import { formatDate, formatTime, shopClosedReason, todayFestival } from '../engine/calendar.js';
import { cellName } from '../engine/farm.js';
import { createNewGame } from '../engine/state.js';
import { ensureCollection } from '../engine/util.js';
import { ensureEquipment, repairCost, toolMaxDurability, weaponMaxDurability } from '../engine/systems/equipment.js';
import { maxHp, sellPrice, skillLevel, skillProgressOf, type SkillProgress } from '../engine/skills.js';
import { bundleDone, donatedCount, neededItems } from '../engine/systems/bundles.js';
import { shopsAt } from '../engine/systems/economy.js';
import { availableFish, FISHING_SPOTS } from '../engine/systems/fishing.js';
import { clinicCost, clinicOpen } from '../engine/systems/clinic.js';
import { elevatorFloors } from '../engine/systems/mine.js';
import { canRomance, giftEvaluation, heartsOf, isBirthday, npcLocation, npcsHere, playerGenderOf, shopUnavailableReason, type GiftTier } from '../engine/systems/social.js';
import { upgradeCost } from '../engine/systems/tools.js';
import type { Action, GameEvent, GameState, GroveId, LocationId, SkillId, Tile, ToolId } from '../engine/types.js';
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
  | { kind: 'create' }
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
/** 一键播种选中的作物 id；为空时默认背包第一种种子 */
let bulkSeedCropId: string | null = null;
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
    syncForestUiState();
    const chopEv = events.find((e) => e.text.includes('木材'));
    const m = chopEv?.text.match(/木材\s*×(\d+)/);
    const woodText = m ? `+木材 ×${m[1]}` : '+木材';
    let idx = activeChopIdx;
    if (idx === null || !forestTreeSlots[idx] || forestTreeSlots[idx].stump) {
      idx = forestTreeSlots.findIndex((t) => !t.stump);
    }
    if (idx !== null && idx >= 0 && forestTreeSlots[idx]) {
      forestTreeSlots[idx].stump = true;
      forestTreeSlots[idx].hits = 3;
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
  if (beforeDay !== afterDay) nightFlash = true;
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
  const debuffCls = `${tile.crop?.wilted ? ' debuff-wilted' : ''}${stage && !stage.ready && !tile.crop?.wilted && !tile.watered ? ' debuff-thirsty' : ''}${tile.weeds && tile.ground === 'tilled' ? ' debuff-weeds' : ''}`;
  if (tile.ground === 'locked') return { cls: 'locked', glyph: tileGroundSvg('locked'), sub: '', badges: '' };
  if (tile.ground === 'weed') return { cls: 'weed', glyph: tileGroundSvg('weed'), sub: '', badges: '' };
  if (tile.ground === 'stone') return { cls: 'stone', glyph: tileGroundSvg('stone'), sub: '', badges: '' };
  if (tile.ground === 'grass') return { cls: 'grass', glyph: tileGroundSvg('grass'), sub: '', badges: '' };
  if (tile.crop?.wilted && stage) return { cls: `wilted${debuffCls}`, glyph: cropGrowthSvg(tile.crop.cropId, stage.pct, { wilted: true, weeds: tile.weeds }), sub: stage.label, badges };
  if (stage?.ready) return { cls: `ready${debuffCls}`, glyph: cropGrowthSvg(tile.crop!.cropId, 100, { watered: tile.watered, weeds: tile.weeds }), sub: stage.label, badges };
  if (stage) return { cls: `${tile.watered ? 'wet' : 'dry'}${debuffCls}`, glyph: cropGrowthSvg(tile.crop!.cropId, stage.pct, { watered: tile.watered, weeds: tile.weeds }), sub: stage.label, badges };
  return { cls: `dry${debuffCls}`, glyph: tileGroundSvg(tile.watered ? 'soil_wet' : 'soil'), sub: '', badges };
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

  // 一键播种：背包种子芯片选择，默认第一种
  const seedIds = Object.keys(state.inventory).filter((id) => ITEMS[id]?.category === 'seed' && (state.inventory[id] ?? 0) > 0);
  if (!bulkSeedCropId || !seedIds.some((id) => ITEMS[id].cropId === bulkSeedCropId)) {
    bulkSeedCropId = seedIds.length ? (ITEMS[seedIds[0]].cropId ?? null) : null;
  }
  const bulkSeedName = bulkSeedCropId ? CROPS[bulkSeedCropId]?.name : null;
  const seedChips = seedIds
    .map((id) => {
      const cropId = ITEMS[id].cropId!;
      return `<button class="chip ${bulkSeedCropId === cropId ? 'on' : ''}" data-act="bulk-seed" data-crop="${cropId}">${ITEMS[id].name} ×${state.inventory[id]}</button>`;
    })
    .join('');

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
      <button class="pix-btn gold" data-act="bulk-harvest">全部收获</button>
      <button class="pix-btn" data-act="ship-all">出货全部</button>
    </div>
  </div>
  <div class="farm-bulk-bar">
    <span class="dim">一键播种种子：</span>
    ${seedChips || '<span class="dim">背包里没有种子</span>'}
    <button class="pix-btn gold" data-act="bulk-plant" ${bulkSeedCropId ? '' : 'disabled'}>一键播种${bulkSeedName ? `（${bulkSeedName}）` : ''}</button>
    <button class="pix-btn" data-act="bulk-deweed">全部除草</button>
    <button class="pix-btn danger" data-act="bulk-uproot-wilted" ${fieldStat.wiltedCount + ghStat.wiltedCount ? '' : 'disabled'}>一键铲除枯萎株${fieldStat.wiltedCount + ghStat.wiltedCount ? `（${fieldStat.wiltedCount + ghStat.wiltedCount} 株）` : ''}</button>
  </div>
  <div class="farm-bulk-bar">
    <span class="dim">${uiIconSvg('wrench')} 自动农具：</span>
    <button class="pix-btn" data-act="auto-farm" data-job="clear" ${state.unlocks.includes('auto_clear') ? '' : 'disabled'}>${uiIconSvg('auto-clear')} 自动整地机${state.unlocks.includes('auto_clear') ? (state.unlocks.includes('auto_clear_daily') ? ' · 每日自动' : '') : '（整地工坊解锁）'}</button>
    <button class="pix-btn" data-act="auto-farm" data-job="plant" ${state.unlocks.includes('auto_plant') && bulkSeedCropId ? '' : 'disabled'}>${uiIconSvg('auto-plant')} 自动播种机${state.unlocks.includes('auto_plant') ? (bulkSeedCropId ? `（${bulkSeedName}）` : '（先选种子）') : '（播种工坊解锁）'}${state.unlocks.includes('auto_plant_daily') ? ' · 每日自动' : ''}</button>
    <button class="pix-btn" data-act="auto-farm" data-job="harvest" ${state.unlocks.includes('auto_harvest') ? '' : 'disabled'}>${uiIconSvg('auto-harvest')} 自动收获机${state.unlocks.includes('auto_harvest') ? (state.unlocks.includes('auto_harvest_daily') ? ' · 每日自动' : '') : '（收获工坊解锁）'}</button>
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
      ? '<p class="dim">今天林间草丛已经探索完了，下面的林木砍伐、三大采集点位与深林奇遇每天都可互动。</p>'
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
  const rodName = rodBroken ? '鱼竿已报废（去海滩老渔夫处购买）' : (ROD_NAMES[rodLvl] ?? '竹制鱼竿');
  const rodMax = rodBroken ? 0 : toolMaxDurability(rodLvl);
  const rodCur = rodBroken ? 0 : state.durability.rod;
  const fishList = availableFish(state);
  const canCast = !rodBroken && rodEquipped;

  const fishChips = fishList.length
    ? fishList
        .map((f) => {
          const caught = state.stats.fishSpecies.includes(f.id);
          const stars = starRow(f.difficulty);
          return `<span class="chip ${caught ? 'ok' : ''}">${caught ? f.name : `未知鱼影（${f.name}）`} <small>${stars}</small></span>`;
        })
        .join('')
    : '<span class="dim">当前时段或天气下水面很安静，换个时段或雨天来看看吧。</span>';

  return `<h3>水域钓鱼台（点击水面浮漂或按钮抛竿）</h3>
    <div class="fishing-dock">
      <button class="water-pond" data-act="fish" ${canCast ? '' : 'disabled'}>
        <div class="water-waves">〰 〰 〰 〰 〰 〰</div>
        <div class="pond-bobber">
          <span>${uiIconSvg('skill_fishing')}</span>
          <span>${canCast ? '点击水面抛竿下钩' : rodBroken ? '鱼竿已报废' : '请先在背包装备鱼竿'}</span>
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
        <div style="display:flex;gap:8px;align-items:center;margin-top:auto;">
          <button class="pix-btn gold" data-act="fish" ${canCast ? '' : 'disabled'}>${uiIconSvg('skill_fishing')} 抛竿钓鱼</button>
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
  return t === 'rod' ? ['竹制', '玻璃纤维', '铱金'][level] : TOOL_LEVEL_NAMES[level];
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
      const upgrading = state.toolUpgrade?.tool === t;
      const equipped = state.equippedTools[t] && !broken;
      const cur = state.durability[t] ?? 0;
      const max = toolMaxDurability(state.tools[t]);
      const low = !broken && max > 0 && cur / max <= 0.3;
      return `<article class="equip-card ${equipped ? 'on' : ''} ${broken ? 'broken' : ''} ${low ? 'low-dur' : ''} ${wearFlash ? 'fx-wear' : ''}" data-act="view-tool" data-tool="${t}" title="点击查看${TOOL_NAMES[t]}详情">
        <div class="equip-head"><span class="equip-title-row"><span class="equip-icon">${toolIconSvg(t, Math.max(0, state.tools[t]))}</span><b>${TOOL_NAMES[t]}</b></span>${broken ? '<span class="badge bad">已报废</span>' : upgrading ? '<span class="badge">升级中</span>' : equipped ? '<span class="badge ok">已装备</span>' : '<span class="badge">未装备</span>'}</div>
        <span class="equip-meta">${broken ? '需要买新的' : toolLabel(t)}</span>
        ${broken ? `<p class="equip-note">去${t === 'rod' ? '海滩渔具店' : '小镇铁匠铺'}买新的（300 金）。</p>` : durBar(cur, max)}
        ${low ? `<p class="equip-note warn-text">耐久偏低，及时修理。</p>` : ''}
        ${broken ? '' : `<p class="equip-note">效果：${toolPowerText(t)}</p>`}
        <div class="equip-actions">
          <button class="chip" data-act="view-tool" data-tool="${t}">查看</button>
          ${!broken && !upgrading ? (equipped ? `<button class="chip" data-act="unequip-tool" data-tool="${t}">卸下</button>` : `<button class="chip" data-act="equip-tool" data-tool="${t}">装备</button>`) : ''}
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
                  ${RELATION_BADGE[st.status] ?? ''}
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
              ${npc.marriageable ? (canRomance(state, npc) ? '<span class="chip ok">可恋爱</span>' : '<span class="chip">同性 · 仅好友</span>') : ''}
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
  { key: 'fish', label: '鱼类', match: (id) => ITEMS[id].category === 'fish' },
  { key: 'oregem', label: '矿石宝石', match: (id) => ITEMS[id].category === 'ore' || ITEMS[id].category === 'gem' },
  { key: 'food', label: '食物', match: (id) => ITEMS[id].category === 'food' },
  { key: 'other', label: '其他', match: (id) => !['weapon', 'tool', 'crop', 'seed', 'forage', 'fish', 'ore', 'gem', 'food'].includes(ITEMS[id].category) },
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
        return `<div class="codex-card ${owned ? '' : 'uncollected'}">
          <span class="bag-item-icon">${itemIconSvg(id)}</span>
          <b>${ITEMS[id].name}</b>
          ${rarityBadgeHtml(id, true)}
          <small>${owned ? (qty > 0 ? `持有 ×${qty}` : '已收集') : '尚未获得'}</small>
        </div>`;
      })
      .join('');
    return `<h3>${cat.label} <small class="dim">${got}/${ids.length}</small></h3><div class="codex-grid">${cards}</div>`;
  }).join('');
  return `<h3>物品图鉴 <small class="dim">已收集 ${totalGot}/${allIds.length}（${pct}%）</small></h3>
    <div class="codex-progress">${bar(totalGot, allIds.length, 'xp')}</div>
    ${cats}`;
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
            ? `<p><b>${uiIconSvg('candle')} 爷爷的评分：点亮了 ${state.evaluation.candles} 根蜡烛（总分 ${state.evaluation.score} 分）</b></p>`
            : '<p><b>' + uiIconSvg('candle') + ' 爷爷的约定：</b>第 3 年春天第 1 天，爷爷会回来看看你把青禾谷农场打理得怎么样。</p>'
        }
        ${
          state.wedding
            ? `<p>${uiIconSvg('bell')} <b>婚礼预告：</b>你与 ${NPC_BY_ID[state.wedding.npcId].name} 的婚礼定于第 ${state.wedding.day} 日举行。</p>`
            : '<p class="dim">与心仪的异性单身居民好感达到 8 心可赠送花束交往，10 心可赠送美人鱼吊坠求婚；同性居民只能成为好友。</p>'
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
    return `<button class="card place ${here ? 'on' : ''}" data-act="move" data-to="${id}" ${here ? 'disabled' : ''}>
      <div>
        <b>${LOCATIONS[id].name}</b>
        <div class="dim" style="font-size:17px;">
          ${npcsAtLoc.length ? `在场居民：${npcsAtLoc.map((n) => n.name).join('、')}` : '当前无居民在场'}
        </div>
      </div>
      <span>${here ? uiIconSvg('pin') + ' 当前所在' : `前往 · 耗时 ${mins} 分钟${state.unlocks.includes('minecart') ? '（矿车加速）' : ''}`}</span>
    </button>`;
  }).join('');

  return `
    <div class="modal-head">
      <h2>${uiIconSvg('map')} 青禾谷世界地图（点击目的地立即出发）</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="cards">${cards}</div>
    <p class="hint" style="margin-top:12px;">提示：前往山区后即可乘电梯下矿洞；修好社区中心「工艺室」可开通矿车令全图移动耗时减半。</p>`;
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
  const upgrading = state.toolUpgrade?.tool === tool;
  const equipped = state.equippedTools[tool] && !broken;
  const cur = broken ? 0 : (state.durability[tool] ?? 0);
  const max = toolMaxDurability(state.tools[tool]);
  const cost = broken ? null : repairCost(state, tool);
  const nextUpgrade = !broken && tool !== 'rod' ? upgradeCost(state, tool) : null;
  const repairShop = tool === 'rod' ? '海滩 · 老渔夫的小屋' : '小镇 · 阿铁铁匠铺';
  const status = broken ? '已报废' : upgrading ? '正在铁匠铺升级' : equipped ? '已装备，可以使用' : '未装备，暂时不能使用';

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
      ${!broken && !upgrading ? (equipped ? `<button class="pix-btn" data-act="unequip-tool" data-tool="${tool}">卸下工具</button>` : `<button class="pix-btn gold" data-act="equip-tool" data-tool="${tool}">装备工具</button>`) : ''}
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
          性别：<b>${npc.gender === 'female' ? '女' : '男'}</b>${npc.marriageable ? (canRomance(state, npc) ? ' · 可恋爱' : ' · 与主角同性，只能成为好友') : ''} ·
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
                  .join('')}</div>
          <p class="dim">提示：越合口味、越贵重的礼物加的亲密度越多；太廉价（≤5 金）或不合口味的礼物反而会掉亲密度。</p>`
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
          const stage = state.unlocks.includes(daily) ? '每日自动' : state.unlocks.includes(unlock) ? '一键可用' : '未解锁';
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

function uiModalContent(): string {
  if (!uiModal) return '';
  switch (uiModal.kind) {
    case 'map':
      return mapModalHtml();
    case 'tool':
      return toolModalHtml(uiModal.tool);
    case 'item':
      return itemModalHtml(uiModal.itemId);
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

  const bagIds = Object.keys(state.inventory);
  const bag = bagIds.length
    ? `<div class="bag-grid">${bagIds
        .map((id) => {
          const equippedWeapon = ITEMS[id].category === 'weapon' && state.weapon === id;
          const sellable = !closed && !equippedWeapon && shop.buys.includes(ITEMS[id].category) && sellPrice(state, id) > 0;
          const label = `${ITEMS[id].name} ×${state.inventory[id]}`;
          return sellable
            ? `<button class="item" data-act="sell" data-item="${id}"><b>${itemIconSvg(id)}</b><span>${ITEMS[id].name}</span>${rarityBadgeHtml(id)}<small>×${state.inventory[id]} · 卖 ${sellPrice(state, id)} 金</small></button>`
            : `<div class="item off" title="${label}"><b>${itemIconSvg(id)}</b><span>${ITEMS[id].name}</span>${rarityBadgeHtml(id)}<small>×${state.inventory[id]}${closed ? '' : equippedWeapon ? ' · 已装备，先卸下' : ' · 本店不收'}</small></div>`;
        })
        .join('')}</div>`
    : '<p class="dim">背包是空的。</p>';

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
  const tension = Math.max(0, Math.min(100, Math.round(act.tension)));
  const danger = tension >= 70;
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

  return `
    <div class="modal-head">
      <h2>${uiIconSvg('skill_fishing')} 水域拉锯战 · 第 ${act.round + 1}/12 回合</h2>
      <span class="badge ${danger ? 'bad' : 'ok'}">${danger ? uiIconSvg('warning') + ' 张力过高预警' : `难度 ${starRow(fish?.difficulty ?? 1)}`}</span>
    </div>
    <div class="fish-duel-pond ${act.hint}">
      <div class="duel-state-banner">
        <b>${stateBadge}</b>
        <small>鱼竿耐久 ${state.durability.rod}/${toolMaxDurability(state.tools.rod)}</small>
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
          <b>鱼线张力（满 100% 鱼线崩断，额外 -${DURABILITY.lineBreakWear} 耐久）</b>
          <span>${tension}% ${danger ? '· 危险！快放线' : ''}</span>
        </div>
        ${bar(tension, 100, danger ? 'hp' : tension >= 45 ? 'warnbar' : 'xp')}
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
    case 'bulk-seed':
      bulkSeedCropId = el.dataset.crop!;
      state.autoPlantCropId = bulkSeedCropId; // 同步为每日自动播种的种子
      save();
      render();
      break;
    case 'auto-farm': {
      const job = el.dataset.job as 'clear' | 'plant' | 'harvest';
      doAction({ type: 'autoFarm', job, cropId: bulkSeedCropId ?? undefined });
      break;
    }
    case 'bulk-plant':
      if (bulkSeedCropId) doAction({ type: 'plant', cropId: bulkSeedCropId, target: 'all' });
      break;
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
    case 'move':
      openShopId = null;
      uiModal = null;
      page = 'scene';
      doAction({ type: 'move', to: el.dataset.to as LocationId });
      break;
    case 'go-general-store':
      selectedCell = null;
      openShopId = null;
      uiModal = null;
      page = 'scene';
      doAction({ type: 'move', to: 'town' });
      if (state.location === 'town') {
        openShopId = 'general';
        render();
      }
      break;
    case 'go-repair-shop': {
      const to = el.dataset.to as LocationId;
      const shopId = el.dataset.shop!;
      selectedCell = null;
      openShopId = null;
      uiModal = null;
      page = 'scene';
      if (state.location !== to) doAction({ type: 'move', to });
      if (state.location === to) {
        openShopId = shopId;
        render();
      }
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
    case 'festival':
      doAction({ type: 'festival' });
      break;
    case 'buy':
      doAction({ type: 'buy', itemId: el.dataset.item!, qty: qty === 'all' ? 1 : qty });
      break;
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
    case 'donate':
      doAction({ type: 'donate', itemId: 'all' });
      break;
    case 'enter-mine':
      doAction({ type: 'enterMine', floor: Number(el.dataset.floor) });
      break;
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
      doAction({ type: 'leaveMine' });
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
if (needsCharacterSetup) setTimeout(() => document.getElementById('create-name')?.focus(), 0);
