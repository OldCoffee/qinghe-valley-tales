import { BUNDLES, ROOMS } from '../data/bundles.js';
import { DURABILITY, SAVE_VERSION } from '../data/config.js';
import { CROPS } from '../data/crops.js';
import { FISH, ROD_NAMES } from '../data/fish.js';
import { ITEMS, itemName } from '../data/items.js';
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
import { ensureEquipment, repairCost, toolMaxDurability, weaponMaxDurability } from '../engine/systems/equipment.js';
import { maxHp, sellPrice, skillLevel } from '../engine/skills.js';
import { bundleDone, donatedCount, neededItems } from '../engine/systems/bundles.js';
import { shopsAt } from '../engine/systems/economy.js';
import { availableFish, FISHING_SPOTS } from '../engine/systems/fishing.js';
import { elevatorFloors } from '../engine/systems/mine.js';
import { heartsOf, isBirthday, npcLocation, npcsHere } from '../engine/systems/social.js';
import { upgradeCost } from '../engine/systems/tools.js';
import type { Action, GameEvent, GameState, GroveId, LocationId, Tile, ToolId } from '../engine/types.js';
const SAVE_KEY = 'qinghe-valley-save';
const $ = (id: string) => document.getElementById(id)!;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** 四大主页面与二级页签定义 */
type PageId = 'scene' | 'bag' | 'social' | 'journal';
type FarmSubTab = 'field' | 'greenhouse';
type SocialSubTab = 'here' | 'all';
type JournalSubTab = 'skills' | 'bundles' | 'records';

/** 多样化交互弹窗状态（店铺弹窗使用 openShopId 独立承载，活动事件使用引擎 activity 承载） */
type UiModalState =
  | { kind: 'map' }
  | { kind: 'item'; itemId: string }
  | { kind: 'tool'; tool: ToolId }
  | { kind: 'npc'; npcId: string }
  | { kind: 'bundle'; roomId: string }
  | null;

type TileFxKind = 'till' | 'water' | 'plant' | 'harvest' | 'clear';

interface ToastFx {
  id: number;
  text: string;
  tone: 'good' | 'warn' | 'bad';
}

let state: GameState = load() ?? createNewGame(Date.now());
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
let mysteryState: { pickedIdx: number | null; resultText: string; flipFx: boolean } = {
  pickedIdx: null,
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
      pickedIdx: state.forest.exploredToday ? 0 : null,
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

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GameState;
    if (data.version !== SAVE_VERSION) return null;
    ensureEquipment(data);
    return data;
  } catch {
    return null;
  }
}

function save(): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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
  if (action.type === 'clear' || action.type === 'till' || action.type === 'water' || action.type === 'plant' || action.type === 'harvest') {
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
        floatText = '已开垦';
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
      if (mysteryState.pickedIdx === null) mysteryState.pickedIdx = 0;
      pushToast(exEv.text, exEv.level === 'warn' ? 'warn' : 'good');
    }
  }
  if (action.type === 'fish' || action.type === 'choose') {
    const catchEv = events.find((e) => e.text.includes('钓到了') || e.text.includes('钓上来'));
    const failEv = events.find((e) => e.text.includes('鱼线断了') || e.text.includes('跑掉了'));
    if (catchEv) pushToast(catchEv.text, 'good');
    else if (failEv) pushToast(failEv.text, 'bad');
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

const hearts = (n: number) => '♥'.repeat(n) + '♡'.repeat(Math.max(0, 10 - n));
const bar = (value: number, max: number, cls: string) =>
  `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%"></i><span>${Math.ceil(value)}/${max}</span></div>`;

function cropStage(tile: Tile): { label: string; pct: number; ready: boolean } | null {
  if (!tile.crop) return null;
  const def = CROPS[tile.crop.cropId];
  const ready = tile.crop.age >= def.growDays;
  return { label: def.name, pct: Math.min(100, Math.round((tile.crop.age / def.growDays) * 100)), ready };
}

function tileFace(tile: Tile): { cls: string; glyph: string; sub: string } {
  const stage = cropStage(tile);
  if (tile.ground === 'locked') return { cls: 'locked', glyph: '锁', sub: '温室未修好' };
  if (tile.ground === 'weed') return { cls: 'weed', glyph: '草', sub: '杂草' };
  if (tile.ground === 'stone') return { cls: 'stone', glyph: '石', sub: '石头' };
  if (tile.ground === 'grass') return { cls: 'grass', glyph: '地', sub: '空地' };
  if (stage?.ready) return { cls: 'ready', glyph: stage.label[0], sub: `${stage.label} 可收获` };
  if (stage) return { cls: tile.watered ? 'wet' : 'dry', glyph: stage.label[0], sub: `${stage.label} ${stage.pct}%${tile.watered ? '' : ' · 缺水'}` };
  return { cls: 'dry', glyph: '土', sub: '已开垦' };
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
  } else if (stage?.ready) {
    desc = `${stage.label}已经成熟！`;
    btns = op('harvest', `收获${stage.label}`);
  } else if (stage) {
    desc = `${stage.label}生长中（${stage.pct}%）${tile.watered ? ' · 今日已浇水' : ' · 今日待浇水'}`;
    btns = tile.watered ? '<span class="dim">今天已浇过水，明天继续生长。</span>' : op('water', '给作物浇水');
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

function farmCounts(rows: number[]): { needWater: number; readyCount: number } {
  let needWater = 0;
  let readyCount = 0;
  for (const r of rows) {
    for (const tile of state.farm[r]) {
      const st = cropStage(tile);
      if (st?.ready) readyCount++;
      else if (st && !tile.watered) needWater++;
    }
  }
  return { needWater, readyCount };
}

function farmScene(): string {
  const fieldStat = farmCounts([0, 1, 2, 3, 4, 5]);
  const ghStat = farmCounts([6, 7]);
  const ghUnlocked = state.unlocks.includes('greenhouse');
  const activeRows = farmSubTab === 'greenhouse' ? [6, 7] : [0, 1, 2, 3, 4, 5];

  const fieldBadge =
    fieldStat.readyCount || fieldStat.needWater
      ? `可收 ${fieldStat.readyCount} · 待浇 ${fieldStat.needWater}`
      : '6×8 格';
  const ghBadge = ghUnlocked
    ? ghStat.readyCount
      ? `可收 ${ghStat.readyCount}`
      : '四季恒温'
    : '未解锁';

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
          <b>${f.glyph}</b><small>${f.sub}</small>
          ${tile.crop ? `<i class="grow"><em style="width:${cropStage(tile)!.pct}%"></em></i>` : ''}
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
  return `<h3>镇上店铺（点击进店交易/升级/修复）</h3><div class="cards grid-2">${shops
    .map((shop) => {
      const closed = shopClosedReason(state, shop);
      return `<button class="card place" data-act="open-shop" data-shop="${shop.id}">
        <b>${shop.name}</b>
        <span>${formatTime(shop.open)}-${formatTime(shop.close)} · ${closed ?? '营业中 · 点击打开弹窗'}</span></button>`;
    })
    .join('')}</div>`;
}

function townExtras(): string {
  if (state.location !== 'town') return '';
  const need = neededItems(state).filter((id) => (state.inventory[id] ?? 0) > 0);
  return `<h3>社区中心（点击房间打开收集包捐献弹窗）</h3>
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
    ? `🎁 本层有宝箱：${[
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
    <span>${safe ? '🛡 安全层：没有怪物' : `出没：${foes || '无'}`}</span>
    <span>${nextSafe}</span>
    ${chestText ? `<span>${chestText}</span>` : ''}
  </div>`;
}

/** 野外散落采集物舞台（点击任意野果物块直接拾取） */
function forageNodesSection(label = '草丛散落野果（点击物块直接拾取）'): string {
  const forage = state.forage[state.location] ?? [];
  if (!forage.length) {
    return state.location === 'forest'
      ? '<p class="dim">今天林间草丛没有新长的散落野果，下面的林木砍伐、三大采集点位与深林奇遇每天都可互动。</p>'
      : '';
  }
  return `<h3>${label}</h3>
    <div class="forage-stage">
      ${forage
        .map(
          (id, idx) => `<button class="forage-node" data-act="forage" title="点击拾取">
            <span class="forage-badge">${itemName(id)[0]}</span>
            <b>${itemName(id)}</b>
            <small class="dim">#${idx + 1} 点击拾取</small>
          </button>`,
        )
        .join('')}
      <button class="pix-btn gold" data-act="forage" style="margin-left:auto;">全部拾取（${forage.length} 件）</button>
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
          const stars = '★'.repeat(f.difficulty);
          return `<span class="chip ${caught ? 'ok' : ''}">${caught ? f.name : `未知鱼影（${f.name}）`} <small>${stars}</small></span>`;
        })
        .join('')
    : '<span class="dim">当前时段或天气下水面很安静，换个时段或雨天来看看吧。</span>';

  return `<h3>水域钓鱼台（点击水面浮漂或按钮抛竿）</h3>
    <div class="fishing-dock">
      <button class="water-pond" data-act="fish" ${canCast ? '' : 'disabled'}>
        <div class="water-waves">〰 〰 〰 〰 〰 〰</div>
        <div class="pond-bobber">
          <span>🎣</span>
          <span>${canCast ? '点击水面抛竿下钩' : rodBroken ? '鱼竿已报废' : '请先在背包装备鱼竿'}</span>
        </div>
        <small style="color:#d9ecff;">咬钩后进入「收线 vs 放线」可视化拉锯战 · 小心张力过高断线</small>
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
          <button class="pix-btn gold" data-act="fish" ${canCast ? '' : 'disabled'}>🎣 抛竿钓鱼</button>
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
          <span class="tree-crown">┻</span>
          <b>${name} #${idx + 1}</b>
          <small>已砍伐 · 明日复生</small>
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
        <span class="tree-crown">木</span>
        <b>${name} #${idx + 1}</b>
        <div class="tree-hp-dots" aria-label="树木耐久">${dots}</div>
        <small>${slot.hits === 0 ? '点击挥斧（需 3 击）' : `已裂开 · 再砍 ${rem} 下`}</small>
      </button>`;
    })
    .join('');

  const groveCards = GROVES.map((g) => {
    const yields = g.yields[state.season];
    const ready = f.groves[g.id] && !!yields;
    const status = !yields ? '本季休眠' : f.groves[g.id] ? '今日可采' : '今日已采';
    const fxCls = groveFxId === g.id ? ' fx-grove-pick' : '';
    const floatText = groveFloatMap.get(g.id);
    return `<article class="card grove-card${fxCls}">
      ${floatText ? `<span class="slot-float">${esc(floatText)}</span>` : ''}
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="bag-item-icon">${g.icon}</span>
        <b>${g.name}</b>
        <span class="badge ${ready ? 'ok' : ''}" style="margin-left:auto;">${status}</span>
      </div>
      <p class="dim" style="margin:6px 0;">${g.desc}</p>
      <p style="margin:4px 0;">${yields ? `本季产出：${yields.map(([id, q]) => `<span class="chip ok">${itemName(id)} ×${q}</span>`).join(' ')}` : g.offSeasonText}</p>
      <button class="pix-btn ${ready ? 'gold' : ''}" data-act="grove" data-grove="${g.id}" ${ready ? '' : 'disabled'}>${ready ? `✋ 采摘${g.name}` : status}</button>
    </article>`;
  }).join('');

  const mysteryCardsHtml = MYSTERY_CARDS.map((c, idx) => {
    const isPicked = f.exploredToday && (mysteryState.pickedIdx ?? 0) === idx;
    if (isPicked) {
      const flipCls = mysteryState.flipFx ? ' fx-card-flip' : '';
      return `<div class="mystery-card revealed${flipCls}">
        <span class="mystery-glyph">✔</span>
        <b>${c.title} · 今日奇遇已揭晓</b>
        <small>${esc(mysteryState.resultText || '你已在林间探索过，收获了一份奇遇。')}</small>
      </div>`;
    }
    if (f.exploredToday) {
      return `<button class="mystery-card" disabled>
        <span class="mystery-glyph">？</span>
        <b>${c.title}</b>
        <small>今日已探索其他秘境 · 明日重置</small>
      </button>`;
    }
    return `<button class="mystery-card" data-act="forest-explore-card" data-idx="${idx}">
      <span class="mystery-glyph">？</span>
      <b>${c.title}</b>
      <small>${c.sub}</small>
      <span class="badge ok">点击翻开奇遇（30 分钟）</span>
    </button>`;
  }).join('');

  return `
  ${forageNodesSection('今日林间散落野果（点击草丛物块直接拾取）')}
  <h3>林间伐木舞台（点击树木连续挥斧 3 下砍倒，掉落木材 ×2~4）</h3>
  <div class="forest-stage ${forestChopFx ? 'fx-chop' : ''}">
    <div class="forest-stage-head">
      <span>🌲 剩余林木 <b>${f.trees}/8</b> 棵 · ${axeDur} · 木材可出货（10 金/块）</span>
      <button class="pix-btn gold" data-act="chop" ${canChop ? '' : 'disabled'}>🪓 快速砍倒一棵</button>
    </div>
    <div class="forest-grid">${treeSlotsHtml}</div>
  </div>
  <h3>三大固定采集点位（每天各可采摘一次，产出随季节变化）</h3>
  <div class="cards grid-2">${groveCards}</div>
  <h3>深林秘境奇遇（三选一盲盒翻牌 · 每天一次）</h3>
  <div class="mystery-grid">${mysteryCardsHtml}</div>
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
        ${m.ladder ? '<div style="margin-top:8px;"><span class="chip ok">✔ 已发现通往下一层的梯子！</span></div>' : ''}
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
            (npc) => `<button class="npc-pill" data-act="open-npc" data-npc="${npc.id}">
              <span class="mini-ava">${npc.name[0]}</span>
              <b>${npc.name}</b>
              <span class="hearts">${'♥'.repeat(Math.min(5, heartsOf(state, npc.id)) || 1)}</span>
              <small>${state.npcs[npc.id].talkedToday ? '已聊' : '可聊天'}</small>
            </button>`,
          )
          .join('')}
      </div>`
    : '';

  let body = '';
  if (state.location === 'farm') body = farmScene();
  else if (state.location === 'forest') body = forestScene();
  else if (state.location === 'mine' || state.location === 'mountain') {
    body = `
      ${forageNodesSection('山间散落采集物（点击物块直接拾取）')}
      ${state.location === 'mountain' ? fishingDockSection() : ''}
      ${mineScene()}`;
  } else {
    body = `
      ${forageNodesSection('野外散落采集物（点击物块直接拾取）')}
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
          ${state.location !== 'farm' && forage.length ? '<button class="pix-btn" data-act="forage">采集野果</button>' : ''}
          ${festival && festival.location === state.location ? `<button class="pix-btn gold" data-act="festival">参加${festival.name}</button>` : ''}
          ${state.location === 'farm' ? '<button class="pix-btn ghost" data-act="wait">休息 1 小时</button>' : ''}
        </div>
      </div>
      ${npcBar}
    </div>
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
      return `<article class="equip-card ${equipped ? 'on' : ''} ${broken ? 'broken' : ''} ${low ? 'low-dur' : ''} ${wearFlash ? 'fx-wear' : ''}" data-act="view-tool" data-tool="${t}" title="点击打开${TOOL_NAMES[t]}详情弹窗">
        <div class="equip-head"><b>${TOOL_NAMES[t]}</b>${broken ? '<span class="badge bad">已报废</span>' : upgrading ? '<span class="badge">升级中</span>' : equipped ? '<span class="badge ok">已装备</span>' : '<span class="badge">未装备</span>'}</div>
        <span class="equip-meta">${broken ? '需要买新的' : toolLabel(t)}</span>
        ${broken ? `<p class="equip-note">去${t === 'rod' ? '海滩渔具店' : '小镇铁匠铺'}买新的（300 金）。</p>` : durBar(cur, max)}
        ${low ? `<p class="equip-note warn-text">耐久偏低，去${t === 'rod' ? '渔具店' : '铁匠铺'}修理。</p>` : ''}
        <div class="equip-actions">
          <button class="chip" data-act="view-tool" data-tool="${t}">详情弹窗</button>
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
      return `<article class="equip-card weapon ${equipped ? 'on' : ''} ${low ? 'low-dur' : ''} ${wearFlash ? 'fx-wear' : ''}" data-act="view-weapon" data-item="${id}" title="点击打开${def.name}详情弹窗">
        <div class="equip-head"><b>${def.name}</b>${equipped ? '<span class="badge ok">已装备</span>' : '<span class="badge">未装备</span>'}</div>
        <span class="equip-meta">伤害 ${def.damage[0]}-${def.damage[1]}</span>
        ${durBar(cur, max)}
        ${low ? '<p class="equip-note warn-text">耐久偏低，去铁匠铺修理。</p>' : ''}
        <div class="equip-actions">
          <button class="chip" data-act="view-weapon" data-item="${id}">详情弹窗</button>
          ${equipped ? `<button class="chip" data-act="unequip-weapon">卸下</button>` : `<button class="chip" data-act="equip-weapon" data-item="${id}">装备</button>`}
        </div>
      </article>`;
    })
    .join('');

  return `<section class="bag-section equipment-section" aria-labelledby="bag-equipment-title">
    <div class="bag-section-head"><h3 id="bag-equipment-title">随身工具与武器槽位（点击卡片弹出详情与修复指引）</h3><span>${warnings.length ? `待处理 ${warnings.length} 件` : '状态良好'}</span></div>
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
                (id) => `<button class="bag-item ${selectedItem === id ? 'on' : ''}" data-act="item" data-item="${id}" aria-label="打开${ITEMS[id].name}详情弹窗">
                  <span class="bag-item-icon">${ITEMS[id].name[0]}</span>
                  <span class="bag-item-main"><b>${ITEMS[id].name}</b><small>${bagItemMeta(id)}</small></span>
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

  const cardsHtml = list.length
    ? `<div class="cards grid-2">${list
        .map((npc) => {
          const st = state.npcs[npc.id];
          const locId = npcLocation(state, npc);
          const isHere = locId === state.location;
          const bday = isBirthday(state, npc);
          return `<article class="card npc">
            <div class="avatar">${npc.name[0]}</div>
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <b>${npc.name}</b>
                <span class="hearts">${hearts(heartsOf(state, npc.id))}</span>
                ${bday ? '<span class="badge ok">🎂 今日生日</span>' : ''}
              </div>
              <p>${npc.intro}</p>
              <p class="dim">
                当前位置：<b>${locId ? LOCATIONS[locId].name : '家中休息'}</b> ·
                生日：${SEASON_NAMES[npc.birthday.season]} ${npc.birthday.day} 日 ·
                ${st.talkedToday ? '今日已聊' : '今日未聊'} · 本周送礼 ${st.giftsThisWeek}/2
              </p>
            </div>
            <div class="card-btns">
              <button class="pix-btn ${isHere ? 'gold' : ''}" data-act="open-npc" data-npc="${npc.id}">
                ${isHere ? '互动 / 送礼' : '查看资料'}
              </button>
            </div>
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

/* ---------- 4. 手册与状态整页 (Journal & Status Page) ---------- */

function journalPage(): string {
  const need = neededItems(state).filter((id) => (state.inventory[id] ?? 0) > 0);
  const weapon = WEAPONS.find((w) => w.id === state.weapon);

  let content = '';
  if (journalSubTab === 'skills') {
    content = `
      <h3>五项专精技能</h3>
      <div class="skill-grid">
        ${SKILL_ORDER.map(
          (sk) => `<div class="skill"><b>${SKILL_NAMES[sk]} Lv.${skillLevel(state, sk)}</b>${bar(state.skills[sk] % 15000, 15000, 'xp')}</div>`,
        ).join('')}
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
  } else if (journalSubTab === 'bundles') {
    content = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <div>
          <h3 style="margin:0;">社区中心四大房间收集包</h3>
        </div>
        ${
          state.location === 'town'
            ? `<button class="pix-btn gold" data-act="donate" ${need.length ? '' : 'disabled'}>在小镇一键捐献（${need.length} 种可捐）</button>`
            : `<span class="dim">捐献要去白鹭镇广场：点顶部当前地点切换（背包有 ${need.length} 种可捐）</span>`
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
              ${bundles.map((b) => `<span class="chip ${bundleDone(state, b) ? 'ok' : ''}">${bundleDone(state, b) ? '✔ ' : ''}${b.name}</span>`).join('')}
            </div>
            <span style="margin-top:auto;font-weight:bold;color:var(--wood);">点击打开「${room.name}」收集弹窗 →</span>
          </button>`;
        }).join('')}
      </div>`;
  } else {
    content = `
      <h3>农场主生涯统计</h3>
      <dl class="detail-list">
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
            ? `<p><b>🕯 爷爷的评分：点亮了 ${state.evaluation.candles} 根蜡烛（总分 ${state.evaluation.score} 分）</b></p>`
            : '<p><b>🕯 爷爷的约定：</b>第 3 年春天第 1 天，爷爷会回来看看你把青禾谷农场打理得怎么样。</p>'
        }
        ${
          state.wedding
            ? `<p>💒 <b>婚礼预告：</b>你与 ${NPC_BY_ID[state.wedding.npcId].name} 的婚礼定于第 ${state.wedding.day} 日举行。</p>`
            : '<p class="dim">与心仪的单身居民好感达到 8 心可赠送花束交往，10 心可赠送美人鱼吊坠求婚。</p>'
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
      <span>${here ? '📍 当前所在' : `前往 · 耗时 ${mins} 分钟${state.unlocks.includes('minecart') ? '（矿车加速）' : ''}`}</span>
    </button>`;
  }).join('');

  return `
    <div class="modal-head">
      <h2>🗺 青禾谷世界地图（点击目的地立即出发）</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="cards">${cards}</div>
    <p class="hint" style="margin-top:12px;">提示：前往山区后即可乘电梯下矿洞；修好社区中心「工艺室」可开通矿车令全图移动耗时减半。</p>`;
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
      <h2>🛠 工具详情 · ${TOOL_NAMES[tool]}</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="detail-title">
      <span class="bag-item-icon">${TOOL_DETAILS[tool].icon}</span>
      <div><b>${TOOL_NAMES[tool]}</b><span>${broken ? '工具 · 已报废' : `工具 · ${toolLabel(tool)}`}</span></div>
    </div>
    <dl class="detail-list">
      <div><dt>状态</dt><dd>${status}</dd></div>
      <div><dt>用途</dt><dd>${TOOL_DETAILS[tool].use}</dd></div>
      <div><dt>耐久</dt><dd>${broken ? '0/0' : `${cur}/${max}`}</dd></div>
      <div><dt>磨损规则</dt><dd>${TOOL_DETAILS[tool].wear}</dd></div>
      <div><dt>${broken ? '重新购买' : '修理地点'}</dt><dd>${repairShop}${broken ? ` · ${DURABILITY.baseToolPrice} 金` : ''}</dd></div>
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
      <h2>🎒 物品与装备详情</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="detail-title">
      <span class="bag-item-icon">${detail.name[0]}</span>
      <div><b>${detail.name}</b><span>持有 ×${count} · ${category}</span></div>
    </div>
    <dl class="detail-list">
      <div><dt>单件售价</dt><dd>${sellPrice(state, detail.id)} 金</dd></div>
      ${detail.energy ? `<div><dt>食用恢复</dt><dd>+${detail.energy} 体力</dd></div>` : ''}
      ${cropDef ? `<div><dt>种植季节与周期</dt><dd>${cropDef.seasons.map((s) => SEASON_NAMES[s]).join('、')}季 · ${cropDef.growDays} 天成熟</dd></div>` : ''}
      ${weaponDef ? `<div><dt>攻击伤害</dt><dd>${weaponDef.damage[0]}-${weaponDef.damage[1]}</dd></div><div><dt>武器耐久</dt><dd>${weaponCur}/${weaponMax}</dd></div><div><dt>装备状态</dt><dd>${state.weapon === detail.id ? '已装备' : '未装备'}</dd></div><div><dt>铁匠铺修理费</dt><dd>${weaponRepair === null ? '耐久已满' : `${weaponRepair} 金`}</dd></div>` : ''}
      ${detail.id === 'scrap' ? '<div><dt>说明</dt><dd>工具或武器报废后留下的金属碎片，可卖给铁匠铺回收。</dd></div>' : ''}
    </dl>
    ${weaponDef ? durBar(weaponCur, weaponMax) : ''}
    <div class="qty-row" style="margin:10px 0;">
      <span>出货数量：</span>
      ${([1, 5, 'all'] as const).map((q) => `<button class="chip ${qty === q ? 'on' : ''}" data-act="qty" data-q="${q}">${q === 'all' ? '全部' : q}</button>`).join('')}
    </div>
    <div class="detail-actions">
      ${weaponDef ? (state.weapon === detail.id ? `<button class="pix-btn" data-act="unequip-weapon">卸下武器</button>` : `<button class="pix-btn gold" data-act="equip-weapon" data-item="${detail.id}">装备武器</button>`) : ''}
      ${detail.energy ? `<button class="pix-btn gold" data-act="eat" data-item="${detail.id}">吃掉 (+${detail.energy} 体力)</button>` : ''}
      ${state.location === 'farm' && sellPrice(state, detail.id) > 0 && !(weaponDef && state.weapon === detail.id) ? `<button class="pix-btn" data-act="ship" data-item="${detail.id}">放进出货箱</button>` : ''}
      <button class="pix-btn ghost" data-act="close-ui-modal">关闭</button>
    </div>`;
}

function npcModalHtml(npcId: string): string {
  const npc = NPC_BY_ID[npcId];
  if (!npc) return '';
  const st = state.npcs[npcId];
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
      <h2>💬 居民互动 · ${npc.name}</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <div class="card npc" style="margin-bottom:12px;">
      <div class="avatar">${npc.name[0]}</div>
      <div>
        <b>${npc.name}</b> <span class="hearts">${hearts(heartsOf(state, npc.id))}</span>
        <p>${npc.intro}</p>
        <p class="dim">
          所在位置：<b>${locId ? LOCATIONS[locId].name : '家中'}</b> ·
          生日：${SEASON_NAMES[npc.birthday.season]} ${npc.birthday.day} 日 ·
          最爱礼物：${lovedNames || '当季好物'}
        </p>
        <p class="dim">${st.talkedToday ? '✔ 今天已经聊过天了' : '今天还没打招呼'} · 本周已送礼 ${st.giftsThisWeek}/2 次</p>
      </div>
    </div>
    ${
      isHere
        ? `<div class="toolbar">
            <button class="pix-btn gold" data-act="talk" data-npc="${npc.id}">💬 与${npc.name}聊天</button>
          </div>
          <h3>🎁 从背包点选一件礼物送给 ${npc.name}</h3>
          ${
            giftableIds.length
              ? `<div class="bag-grid">${giftableIds
                  .map(
                    (id) => `<button class="item" data-act="gift-direct" data-npc="${npc.id}" data-item="${id}">
                      <b>${ITEMS[id].name[0]}</b>
                      <span>${ITEMS[id].name}</span>
                      <small>×${state.inventory[id]} · 点击赠送</small>
                    </button>`,
                  )
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
      <h2>🏛 社区中心 · ${room.name}</h2>
      <button class="pix-btn" data-act="close-ui-modal">关闭</button>
    </div>
    <p>${room.unlockText} ${unlocked ? '<span class="badge ok">已修好解锁！</span>' : ''}</p>
    ${bundles
      .map((b) => {
        const done = bundleDone(state, b);
        return `<div class="bundle-box ${done ? 'done' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <b>${done ? '✔ ' : ''}${b.name}</b>
            <span class="dim">${b.reward.gold ? `奖励 ${b.reward.gold} 金` : b.reward.item ? `奖励 ${itemName(b.reward.item[0])} ×${b.reward.item[1]}` : ''}</span>
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
          : `<span class="dim">捐献要去白鹭镇广场，点顶部当前地点切换前往（背包有 ${need.length} 种可捐）。</span>`
      }
      <button class="pix-btn ghost" data-act="close-ui-modal">关闭</button>
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
              <b>${itemName(e.itemId)[0]}</b><span>${itemName(e.itemId)}</span><small>${e.price} 金${ITEMS[e.itemId].energy ? ` · +${ITEMS[e.itemId].energy} 体力` : ''}</small></button>`,
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
            ? `<button class="item" data-act="sell" data-item="${id}"><b>${ITEMS[id].name[0]}</b><span>${ITEMS[id].name}</span><small>×${state.inventory[id]} · 卖 ${sellPrice(state, id)} 金</small></button>`
            : `<div class="item off" title="${label}"><b>${ITEMS[id].name[0]}</b><span>${ITEMS[id].name}</span><small>×${state.inventory[id]}${closed ? '' : equippedWeapon ? ' · 已装备，先卸下' : ' · 本店不收'}</small></div>`;
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
    stateBadge = '🌊 猛烈挣扎！浪花四溅';
    stateDesc = '浮漂猛地往下一沉，鱼线绷得紧紧的！建议点「2. 顺势放线」卸掉张力，硬拉容易断线。';
  } else if (act.hint === 'rest') {
    stateBadge = '🫧 水面平静 · 力气耗尽';
    stateDesc = '鱼好像没什么力气了！趁现在点「1. 趁机收线」飞快拉近距离。';
  } else {
    stateBadge = '❓ 涟漪阵阵 · 动向不明';
    stateDesc = '水面泛起一圈圈涟漪，看不清鱼在蓄力还是休息，根据当前张力谨慎试探。';
  }

  return `
    <div class="modal-head">
      <h2>🎣 水域拉锯战 · 第 ${act.round + 1}/12 回合</h2>
      <span class="badge ${danger ? 'bad' : 'ok'}">${danger ? '⚠ 张力过高预警' : `难度 ${'★'.repeat(fish?.difficulty ?? 1)}`}</span>
    </div>
    <div class="fish-duel-pond ${act.hint}">
      <div class="duel-state-banner">
        <b>${stateBadge}</b>
        <small>鱼竿耐久 ${state.durability.rod}/${toolMaxDurability(state.tools.rod)}</small>
      </div>
      <p style="margin:0 0 10px;font-size:18px;">${stateDesc}</p>
      <div class="duel-water-track">
        <span class="duel-shore">🎣 岸边鱼钩</span>
        <span class="duel-fish-swim" style="left:${fishLeft}%;">🐟 鱼影 (${progress}%)</span>
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
      <button class="pix-btn gold" data-act="choose" data-i="0">1. 🎣 趁机收线</button>
      <button class="pix-btn" data-act="choose" data-i="1">2. 🌊 顺势放线</button>
      <button class="pix-btn danger" data-act="choose" data-i="2">3. ✂ 剪断放弃</button>
    </div>
    <p class="dim" style="margin:8px 0 0;font-size:16px;">提示：可直接按键盘数字键 1（收线）、2（放线）、3（放弃）操作。</p>
  `;
}

function render(): void {
  const hpMax = maxHp(state);
  $('hud-loc').innerHTML = `📍 <b>${LOCATIONS[state.location].name}</b> <small>[切换地点]</small>`;
  $('hud-date').textContent = `${formatDate(state)} ${formatTime(state.minutes)} · ${WEATHER_NAMES[state.weather]}（明日 ${WEATHER_NAMES[state.tomorrowWeather]}）`;
  $('hud-gold').textContent = `${state.gold} 金`;
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
    case 'close-ui-modal':
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
      const op = el.dataset.op as 'clear' | 'till' | 'water' | 'harvest';
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
    case 'forage':
      doAction({ type: 'forage' });
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
    case 'forest-explore-card':
      mysteryState.pickedIdx = Number(el.dataset.idx);
      doAction({ type: 'forestExplore' });
      break;
    case 'forest-explore':
      mysteryState.pickedIdx = 0;
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
    case 'new-game':
      if (confirm('开始新游戏？现在的存档会被覆盖。')) {
        localStorage.removeItem(SAVE_KEY);
        state = createNewGame(Date.now());
        page = 'scene';
        farmSubTab = 'field';
        selectedCell = null;
        openShopId = null;
        uiModal = null;
        giftNpc = null;
        selectedItem = null;
        selectedEquipment = null;
        tileFxMap.clear();
        log = [{ level: 'info' as const, text: '新的一天，新的农场。先清理、开垦、播种，再记得每天浇水。' }];
        save();
        render();
      }
      break;
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

render();
