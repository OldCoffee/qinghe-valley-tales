import type { ToolId } from '../engine/types.js';
import { FISH } from '../data/fish.js';

/* ============================================================
 * 像素风渲染引擎
 * 全部图标由整数像素网格 (16x16 / 24x24) 的 <rect> 行程压缩(RLE)构成,
 * shape-rendering="crispEdges", 无 circle/ellipse/圆角/贝塞尔曲线。
 * ============================================================ */

type Grid = (string | null)[][];

function grid(w: number, h: number, bg: string | null = null): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(bg));
}
function px(g: Grid, x: number, y: number, c: string): void {
  if (y >= 0 && y < g.length && x >= 0 && x < g[y].length) g[y][x] = c;
}
function rect(g: Grid, x: number, y: number, w: number, h: number, c: string): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(g, i, j, c);
}
function render(g: Grid, cls: string): string {
  const h = g.length; const w = g[0]?.length ?? 16;
  let out = '';
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const c = g[y][x];
      if (!c) { x++; continue; }
      let len = 1;
      while (x + len < w && g[y][x + len] === c) len++;
      out += `<rect x="${x}" y="${y}" width="${len}" height="1" fill="${c}"/>`;
      x += len;
    }
  }
  return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
}
const D = '#2B1B0E'; // 深褐像素描边
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const gg = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `#${((r << 16) | (gg << 8) | b).toString(16).padStart(6, '0')}`;
}
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function hashColor(s: string): string {
  const h = hash(s);
  return `#${[80 + (h % 150), 80 + ((h >> 8) % 150), 80 + ((h >> 16) % 150)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/* ---------------- 24x24 居民像素肖像 ---------------- */
interface NpcStyle { bg: string; bg2: string; hair: string; skin: string; cloth: string; style: string }
const NPC_STYLE: Record<string, NpcStyle> = {
  su_he: { bg: '#F7C6D4', bg2: '#EF9FB8', hair: '#6B3E26', skin: '#FFE2C4', cloth: '#E75480', style: 'braids' },
  lu_yuan: { bg: '#A8D5E5', bg2: '#7FB8D4', hair: '#1F3A52', skin: '#F5D2B0', cloth: '#2B5B84', style: 'hat' },
  a_qing: { bg: '#E8B49A', bg2: '#D98F6A', hair: '#2A1810', skin: '#F2C29B', cloth: '#7A3E2E', style: 'goggles' },
  bai_zhi: { bg: '#B8E0B8', bg2: '#8CCB8C', hair: '#22332B', skin: '#FFE8D1', cloth: '#2E7D32', style: 'bun_jade' },
  zhou_bo: { bg: '#F5D598', bg2: '#E8BC6A', hair: '#4E342E', skin: '#F5D0A9', cloth: '#8D5524', style: 'cap_glasses' },
  qin_popo: { bg: '#D7C2E8', bg2: '#B79BD8', hair: '#ECEFF1', skin: '#F5D6B8', cloth: '#7E57C2', style: 'silver_bun' },
};

function paintPortrait(g: Grid, s: NpcStyle): void {
  // 背景棋盘 + 木框
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) px(g, x, y, (x + y) % 2 ? s.bg : s.bg2);
  rect(g, 0, 0, 24, 1, '#3A2010'); rect(g, 0, 23, 24, 1, '#3A2010'); rect(g, 0, 0, 1, 24, '#3A2010'); rect(g, 23, 0, 1, 24, '#3A2010');
  px(g, 1, 1, '#D9A441'); px(g, 22, 1, '#D9A441'); px(g, 1, 22, '#D9A441'); px(g, 22, 22, '#D9A441');
  // 肩膀/衣服
  rect(g, 6, 20, 12, 3, s.cloth); rect(g, 7, 19, 10, 1, s.cloth); px(g, 11, 20, '#FFFFFF'); px(g, 12, 20, '#FFFFFF'); px(g, 11, 21, shade(s.cloth, 0.7)); px(g, 12, 21, shade(s.cloth, 0.7));
  // 脸
  rect(g, 8, 9, 8, 9, s.skin); rect(g, 9, 8, 6, 1, s.skin); rect(g, 9, 18, 6, 1, s.skin);
  px(g, 8, 9, D); px(g, 15, 9, D); rect(g, 8, 10, 1, 7, shade(s.skin, 0.92)); rect(g, 15, 10, 1, 7, shade(s.skin, 0.92));
  // 眼睛(高光)/腮红/嘴
  px(g, 10, 13, D); px(g, 10, 12, D); px(g, 13, 13, D); px(g, 13, 12, D);
  px(g, 9, 15, '#FF9EB0'); px(g, 14, 15, '#FF9EB0'); rect(g, 11, 16, 2, 1, '#B4552D');
  const hair = s.hair; const hairL = shade(hair === '#ECEFF1' ? '#CFD8DC' : hair, 1.35); const hairD = shade(hair === '#ECEFF1' ? '#B0BEC5' : hair, 0.65);
  if (s.style === 'hat') {
    rect(g, 5, 6, 14, 2, '#E6B86A'); rect(g, 7, 3, 10, 3, '#F2CC85'); rect(g, 7, 5, 10, 1, '#C62828');
    rect(g, 7, 3, 10, 1, '#FFE9B0'); rect(g, 8, 8, 8, 1, hair);
    px(g, 16, 16, '#558B2F'); px(g, 17, 15, '#558B2F'); px(g, 18, 16, '#7CB342'); // 嘴角草茎
    rect(g, 6, 21, 12, 1, '#E1F5FE'); rect(g, 6, 22, 12, 1, s.cloth);
  } else if (s.style === 'goggles') {
    rect(g, 7, 7, 10, 3, hair); rect(g, 6, 9, 2, 4, hair); rect(g, 16, 9, 2, 4, hair); rect(g, 7, 7, 10, 1, hairL);
    rect(g, 7, 10, 10, 1, '#C62828'); // 红头巾带
    rect(g, 8, 8, 3, 2, '#80DEEA'); rect(g, 13, 8, 3, 2, '#80DEEA'); px(g, 11, 8, '#B8860B'); px(g, 12, 8, '#B8860B'); // 护目镜
    rect(g, 11, 16, 2, 1, '#FFFFFF'); // 笑牙
  } else if (s.style === 'bun_jade') {
    rect(g, 9, 3, 6, 3, hair); px(g, 10, 2, hair); px(g, 13, 2, hair);
    rect(g, 5, 4, 14, 1, '#26A69A'); px(g, 18, 3, '#80CBC4'); px(g, 19, 4, '#26A69A'); // 青玉簪
    rect(g, 7, 7, 10, 2, hair); rect(g, 7, 7, 10, 1, hairL); rect(g, 6, 9, 2, 5, hair); rect(g, 16, 9, 2, 5, hair);
    px(g, 7, 20, '#C8E6C9'); px(g, 16, 20, '#C8E6C9'); // 草药披肩
  } else if (s.style === 'cap_glasses') {
    rect(g, 7, 5, 10, 3, '#5D4037'); rect(g, 8, 4, 8, 1, '#5D4037'); px(g, 11, 3, '#D32F2F'); px(g, 12, 3, '#D32F2F');
    rect(g, 7, 8, 10, 1, hairD);
    rect(g, 9, 12, 3, 2, '#FFF9C4'); rect(g, 12, 12, 3, 2, '#FFF9C4'); px(g, 11, 12, '#B8860B'); // 金丝眼镜(像素框以浅色镜片示)
    px(g, 9, 12, '#B8860B'); px(g, 14, 12, '#B8860B');
    rect(g, 9, 17, 6, 1, hair); px(g, 8, 16, hair); px(g, 15, 16, hair); // 八字胡
  } else if (s.style === 'silver_bun') {
    rect(g, 9, 3, 6, 3, hair); rect(g, 7, 6, 10, 3, hair); rect(g, 7, 6, 10, 1, '#FFFFFF');
    rect(g, 6, 9, 2, 6, hair); rect(g, 16, 9, 2, 6, hair);
    // 慈祥弯眼: 眼睛改为弧形短线
    px(g, 10, 12, s.skin); px(g, 13, 12, s.skin); px(g, 9, 13, D); px(g, 14, 13, D);
    px(g, 8, 21, '#B39DDB'); px(g, 15, 21, '#B39DDB'); px(g, 10, 22, '#B39DDB'); px(g, 13, 22, '#B39DDB'); // 格纹披肩
  } else { // braids 苏禾
    rect(g, 7, 6, 10, 3, hair); rect(g, 7, 6, 10, 1, hairL); rect(g, 6, 8, 2, 6, hair); rect(g, 16, 8, 2, 6, hair);
    for (let i = 0; i < 4; i++) { rect(g, 5, 14 + i * 2, 3, 1, i % 2 ? hairD : hair); rect(g, 16, 14 + i * 2, 3, 1, i % 2 ? hair : hairD); }
    // 鬓角小黄花
    px(g, 17, 7, '#FFD54F'); px(g, 18, 7, '#FFD54F'); px(g, 17, 6, '#FFD54F'); px(g, 18, 8, '#FB8C00');
  }
}

/** 主角像素形象 (24x24): 男=短发+蓝色背带装, 女=长发麻花辫+粉色上衣+黄花发饰, 创建后不可修改 */
export function playerAvatarSvg(gender: 'male' | 'female'): string {
  const g = grid(24, 24);
  const female = gender === 'female';
  const bg = female ? '#F7C6D4' : '#A8D5E5'; const bg2 = female ? '#EF9FB8' : '#7FB8D4';
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) px(g, x, y, (x + y) % 2 ? bg : bg2);
  rect(g, 0, 0, 24, 1, '#3A2010'); rect(g, 0, 23, 24, 1, '#3A2010'); rect(g, 0, 0, 1, 24, '#3A2010'); rect(g, 23, 0, 1, 24, '#3A2010');
  px(g, 1, 1, '#D9A441'); px(g, 22, 1, '#D9A441'); px(g, 1, 22, '#D9A441'); px(g, 22, 22, '#D9A441');
  const skin = '#FFE2C4'; const hair = female ? '#8A4B23' : '#2A2018'; const hairL = shade(hair, 1.45);
  // 衣着: 男=白衫+蓝背带裤装, 女=粉上衣+白领口
  if (female) {
    rect(g, 6, 20, 12, 3, '#E75480'); rect(g, 7, 19, 10, 1, '#E75480'); px(g, 11, 20, '#FFFFFF'); px(g, 12, 20, '#FFFFFF'); px(g, 10, 19, '#F8BBD0'); px(g, 13, 19, '#F8BBD0');
  } else {
    rect(g, 6, 20, 12, 3, '#2B5B84'); rect(g, 7, 19, 10, 1, '#E8E4DA'); rect(g, 9, 20, 2, 3, '#2B5B84'); rect(g, 13, 20, 2, 3, '#2B5B84'); px(g, 10, 21, '#FFD54F'); px(g, 13, 21, '#FFD54F');
  }
  // 脸
  rect(g, 8, 9, 8, 9, skin); rect(g, 9, 8, 6, 1, skin); rect(g, 9, 18, 6, 1, skin);
  px(g, 8, 9, D); px(g, 15, 9, D);
  px(g, 10, 13, D); px(g, 10, 12, D); px(g, 13, 13, D); px(g, 13, 12, D);
  px(g, 9, 15, '#FF9EB0'); px(g, 14, 15, '#FF9EB0'); rect(g, 11, 16, 2, 1, '#B4552D');
  if (female) {
    rect(g, 7, 6, 10, 3, hair); rect(g, 7, 6, 10, 1, hairL); rect(g, 6, 8, 2, 7, hair); rect(g, 16, 8, 2, 7, hair);
    for (let i = 0; i < 3; i++) { rect(g, 5, 15 + i * 2, 3, 1, i % 2 ? shade(hair, 0.65) : hair); rect(g, 16, 15 + i * 2, 3, 1, i % 2 ? hair : shade(hair, 0.65)); }
    px(g, 17, 6, '#FFD54F'); px(g, 18, 7, '#FFD54F'); px(g, 17, 7, '#FB8C00'); // 黄花发饰
    px(g, 10, 14, '#D81B60'); px(g, 13, 14, '#D81B60'); // 女: 粉唇点
  } else {
    rect(g, 7, 5, 10, 4, hair); rect(g, 7, 5, 10, 1, hairL); rect(g, 6, 8, 2, 3, hair); rect(g, 16, 8, 2, 3, hair);
    px(g, 9, 11, D); px(g, 14, 11, D); // 男: 粗眉
    rect(g, 11, 17, 2, 1, '#8D5524');
  }
  return render(g, 'qh-svg-avatar qh-pixel qh-player-avatar');
}

export function npcAvatarSvg(npcId: string): string {
  const s = NPC_STYLE[npcId] ?? { bg: '#EAD7B7', bg2: '#D9BE8C', hair: '#6B4423', skin: '#FFE0B2', cloth: '#8D6E63', style: 'braids' };
  const g = grid(24, 24); paintPortrait(g, s); return render(g, 'qh-svg-avatar qh-pixel');
}

/* ---------------- 16x16 物品像素图 ---------------- */
export const CROP_PALETTE: Record<string, { main: string; stroke: string; leaf: string }> = {
  parsnip: { main: '#F5E6C8', stroke: '#8D6E63', leaf: '#4CAF50' }, potato: { main: '#D7A86E', stroke: '#6B4423', leaf: '#66BB6A' },
  green_bean: { main: '#66BB6A', stroke: '#2E7D32', leaf: '#388E3C' }, cauliflower: { main: '#FFFDF7', stroke: '#9E9E9E', leaf: '#43A047' },
  strawberry: { main: '#E53935', stroke: '#8E0000', leaf: '#43A047' }, tomato: { main: '#F44336', stroke: '#B71C1C', leaf: '#388E3C' },
  hot_pepper: { main: '#D32F2F', stroke: '#7F0000', leaf: '#43A047' }, blueberry: { main: '#3949AB', stroke: '#1A237E', leaf: '#4CAF50' },
  melon: { main: '#F48FB1', stroke: '#880E4F', leaf: '#66BB6A' }, corn: { main: '#FFD54F', stroke: '#F57F17', leaf: '#4CAF50' },
  eggplant: { main: '#6A1B9A', stroke: '#38006B', leaf: '#43A047' }, pumpkin: { main: '#FB8C00', stroke: '#E65100', leaf: '#388E3C' },
  yam: { main: '#AD1457', stroke: '#560027', leaf: '#66BB6A' }, cranberry: { main: '#C62828', stroke: '#6A0000', leaf: '#2E7D32' },
};

function blob(g: Grid, cx: number, cy: number, rx: number, ry: number, main: string): void {
  const dark = shade(main, 0.62); const light = shade(main, 1.3);
  for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
    const d = ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry);
    if (d <= 1) px(g, x, y, d > 0.72 ? dark : main);
  }
  px(g, cx - Math.max(1, rx - 2), cy - Math.max(1, ry - 2), light); px(g, cx - Math.max(1, rx - 2) + 1, cy - Math.max(1, ry - 2), light);
  // 像素描边: 在 blob 外圈补深色点(上下左右极值)
  px(g, cx, cy - ry - 0, dark);
}
function leafTop(g: Grid, cx: number, y: number, leaf: string): void {
  px(g, cx, y, leaf); px(g, cx - 1, y, leaf); px(g, cx - 2, y + 1, leaf); px(g, cx + 1, y, leaf); px(g, cx + 2, y + 1, leaf); px(g, cx, y - 1, shade(leaf, 1.3));
}
function paintFruit(g: Grid, main: string): void { blob(g, 8, 9, 5, 5, main); leafTop(g, 8, 3, '#43A047'); }
function paintFish(g: Grid, main: string, seed: number): void {
  const dark = shade(main, 0.6); const light = shade(main, 1.35);
  for (let y = 5; y <= 11; y++) { const wdt = y === 5 || y === 11 ? 3 : y === 6 || y === 10 ? 5 : 6; rect(g, 8 - wdt, y, wdt * 2 - 2, 1, y < 8 ? light : main); }
  rect(g, 12, 6, 3, 2, dark); rect(g, 12, 10, 3, 2, dark); px(g, 14, 7, main); px(g, 14, 9, main); // 尾鳍
  px(g, 3, 7, D); px(g, 3, 8, '#FFFFFF');
  if (seed % 3 === 0) rect(g, 7, 5, 1, 7, dark); if (seed % 3 === 1) { px(g, 6, 7, dark); px(g, 9, 9, dark); px(g, 7, 10, dark); }
  if (seed % 4 === 2) rect(g, 4, 8, 8, 1, '#F06292');
}
function paintGem(g: Grid, main: string): void {
  const dark = shade(main, 0.55); const light = shade(main, 1.45);
  const rows = [2, 4, 6, 6, 4, 2];
  rows.forEach((wdt, i) => { rect(g, 8 - wdt / 2, 3 + i * 2, wdt, 2, i < 2 ? light : main); });
  rect(g, 3, 3, 10, 1, dark); px(g, 5, 5, '#FFFFFF'); px(g, 6, 5, '#FFFFFF'); px(g, 8, 12, dark); px(g, 7, 13, dark);
}
function paintSword(g: Grid, main: string): void {
  const dark = shade(main, 0.55);
  for (let i = 0; i < 9; i++) { px(g, 5 + i, 10 - i, main); px(g, 6 + i, 10 - i, i > 6 ? dark : shade(main, 1.25)); }
  px(g, 13, 1, '#FFFFFF'); rect(g, 3, 11, 3, 2, '#FFD54F'); rect(g, 2, 12, 2, 2, '#6D4C41'); px(g, 4, 11, D);
}

const FISH_MAP = Object.fromEntries(FISH.map((f) => [f.id, f]));
const FISH_PALETTE: Record<string, string> = {
  carp: '#E67E22', largemouth_bass: '#558B2F', sturgeon: '#546E7A', legend: '#2ECC71',
  sunfish: '#FFD54F', chub: '#90A4AE', rainbow_trout: '#66BB6A', catfish: '#6D4C41',
  salmon: '#FF7043', pike: '#7CB342', anchovy: '#64B5F6', sardine: '#29B6F6',
  herring: '#90CAF9', halibut: '#A1887F', tuna: '#1E88E5', red_snapper: '#EF5350',
  eel: '#795548', pufferfish: '#FFCA28', creek_goby: '#8D6E63', stone_minnow: '#4DB6AC',
  bitterling: '#F06292', loach: '#795548', yellow_catfish: '#FFB300', topmouth_culter: '#B0BEC5',
  mandarin_fish: '#FFA726', ayu: '#81C784', taimen: '#D84315', ancient_sturgeon: '#16A085',
  silver_crucian: '#CFD8DC', brook_trout: '#EF5350', lake_trout: '#5C6BC0', freshwater_eel: '#5D4037',
  bluegill: '#42A5F5', paddlefish: '#78909C', mist_fish: '#80DEEA', mirror_dragonfish: '#9B59B6',
  mackerel: '#26A69A', horse_mackerel: '#78909C', sea_bream: '#EC407A', grouper: '#8D6E63',
  sea_bass: '#546E7A', bonito: '#1565C0', swordfish: '#0288D1', mahi_mahi: '#26C6DA',
  lobster: '#D32F2F', octopus: '#C2185B', squid: '#F48FB1', parrotfish: '#00BFA5',
  anglerfish: '#311B92', abyss_oarfish: '#1565C0', firefly_minnow: '#69F0AE', rapids_shadowfish: '#455A64',
  reef_night_snapper: '#AD1457', snow_mirror_trout: '#B3E5FC', frost_mist_perch: '#4DD0E1',
  storm_bay_marlin: '#1976D2', dawn_silver_carp: '#FFE082', dusk_river_perch: '#FF8A65',
};

/** 鱼王解剖部位标签（图标与剧场关节切片同源） */
type FishKingPart =
  | 'head' | 'barbel-u' | 'barbel-d' | 'dorsal'
  | 'pectoral' | 'pelvic' | 'torso-f' | 'torso-r' | 'tail';

type FishKingMaster = { colors: Grid; parts: (FishKingPart | null)[][] };

const FISH_KING_IDS = new Set(['legend', 'ancient_sturgeon', 'mirror_dragonfish', 'abyss_oarfish']);

function emptyParts(): (FishKingPart | null)[][] {
  return Array.from({ length: 24 }, () => Array<FishKingPart | null>(24).fill(null));
}

function setPart(parts: (FishKingPart | null)[][], x: number, y: number, part: FishKingPart): void {
  if (y >= 0 && y < 24 && x >= 0 && x < 24) parts[y][x] = part;
}

function paintPart(g: Grid, parts: (FishKingPart | null)[][], x: number, y: number, c: string, part: FishKingPart): void {
  px(g, x, y, c);
  if (g[y]?.[x]) setPart(parts, x, y, part);
}

function rectPart(
  g: Grid, parts: (FishKingPart | null)[][],
  x: number, y: number, w: number, h: number, c: string, part: FishKingPart,
): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) paintPart(g, parts, i, j, c, part);
}

/** 四大鱼王 24×24 母本：颜色网格 + 每像素解剖部位（图标与剧场唯一视觉源） */
function fishKing24Master(fishId: string): FishKingMaster | null {
  if (!FISH_KING_IDS.has(fishId)) return null;
  const g = grid(24, 24);
  const parts = emptyParts();

  if (fishId === 'legend') {
    // 山谷鱼王：五裂金冠 + 翡翠金鳞流线躯干 + 双叶金边尾
    for (const cx of [7, 9, 11, 13, 15]) {
      paintPart(g, parts, cx, 3, '#FFF9C4', 'dorsal');
      rectPart(g, parts, cx, 4, 1, 2, '#FFD23F', 'dorsal');
    }
    rectPart(g, parts, 7, 6, 9, 2, '#FFD23F', 'dorsal');
    const rows: [number, number, number][] = [
      [7, 6, 10], [8, 4, 13], [9, 3, 15], [10, 2, 16], [11, 2, 16],
      [12, 2, 16], [13, 3, 15], [14, 4, 13], [15, 6, 10], [16, 8, 6],
    ];
    for (const [y, x0, w] of rows) {
      const body = y <= 9 ? '#1E8449' : y >= 14 ? '#A3E4D7' : '#2ECC71';
      for (let i = 0; i < w; i++) {
        const x = x0 + i;
        const part: FishKingPart = x <= 7 ? 'head' : x <= 12 ? 'torso-f' : x <= 17 ? 'torso-r' : 'tail';
        paintPart(g, parts, x, y, (i === 0 || i === w - 1) ? D : body, part);
      }
    }
    for (let y = 9; y <= 13; y++) for (let x = 6; x <= 15; x++) {
      if ((x + y) % 2 === 0) {
        const part: FishKingPart = x <= 7 ? 'head' : x <= 12 ? 'torso-f' : 'torso-r';
        paintPart(g, parts, x, y, y === 11 ? '#FFF9C4' : '#F1C40F', part);
      }
    }
    paintPart(g, parts, 6, 10, '#145A32', 'head');
    paintPart(g, parts, 7, 11, '#145A32', 'head');
    paintPart(g, parts, 6, 12, '#145A32', 'head');
    rectPart(g, parts, 4, 10, 2, 2, '#FFF9C4', 'head');
    paintPart(g, parts, 4, 10, D, 'head');
    paintPart(g, parts, 1, 11, '#FFD23F', 'barbel-u');
    paintPart(g, parts, 2, 12, '#FFD23F', 'barbel-d');
    rectPart(g, parts, 7, 15, 4, 3, '#F39C12', 'pectoral');
    paintPart(g, parts, 6, 17, '#FFF9C4', 'pectoral');
    rectPart(g, parts, 18, 9, 3, 2, '#2ECC71', 'tail');
    rectPart(g, parts, 20, 7, 3, 3, '#FFD23F', 'tail');
    rectPart(g, parts, 18, 12, 3, 2, '#2ECC71', 'tail');
    rectPart(g, parts, 20, 13, 3, 3, '#FFD23F', 'tail');
  } else if (fishId === 'ancient_sturgeon') {
    for (const bx of [7, 10, 13, 16]) {
      rectPart(g, parts, bx, 6, 2, 2, '#D4AC0D', bx <= 10 ? 'torso-f' : 'torso-r');
      paintPart(g, parts, bx, 5, '#FFF9C4', 'dorsal');
    }
    const rows: [number, number, number][] = [
      [8, 6, 11], [9, 4, 14], [10, 2, 16], [11, 1, 17], [12, 2, 16], [13, 4, 14], [14, 6, 10],
    ];
    for (const [y, x0, w] of rows) {
      const body = y <= 9 ? '#117864' : y >= 13 ? '#A3E4D7' : '#16A085';
      for (let i = 0; i < w; i++) {
        const x = x0 + i;
        const part: FishKingPart = x <= 6 ? 'head' : x <= 12 ? 'torso-f' : x <= 17 ? 'torso-r' : 'tail';
        paintPart(g, parts, x, y, i === 0 ? D : body, part);
      }
    }
    for (let x = 7; x <= 16; x += 3) {
      const part: FishKingPart = x <= 12 ? 'torso-f' : 'torso-r';
      paintPart(g, parts, x, 10, '#69F0AE', part);
      paintPart(g, parts, x + 1, 11, '#FFD23F', part);
    }
    rectPart(g, parts, 4, 9, 2, 2, '#FFD23F', 'head');
    paintPart(g, parts, 4, 9, D, 'head');
    paintPart(g, parts, 2, 12, '#69F0AE', 'barbel-u');
    paintPart(g, parts, 2, 13, '#A3E4D7', 'barbel-u');
    paintPart(g, parts, 4, 13, '#69F0AE', 'barbel-d');
    paintPart(g, parts, 4, 14, '#FFD23F', 'barbel-d');
    rectPart(g, parts, 7, 14, 4, 3, '#0E6251', 'pectoral');
    paintPart(g, parts, 7, 16, '#FFD23F', 'pectoral');
    rectPart(g, parts, 18, 8, 3, 3, '#16A085', 'tail');
    rectPart(g, parts, 20, 5, 3, 4, '#69F0AE', 'tail');
    rectPart(g, parts, 18, 12, 3, 3, '#117864', 'tail');
    paintPart(g, parts, 20, 14, '#FFD23F', 'tail');
  } else if (fishId === 'mirror_dragonfish') {
    rectPart(g, parts, 7, 4, 10, 3, '#FFD23F', 'dorsal');
    rectPart(g, parts, 8, 3, 7, 1, '#00E5FF', 'dorsal');
    const rows: [number, number, number][] = [
      [7, 6, 11], [8, 4, 13], [9, 3, 15], [10, 3, 15], [11, 3, 15], [12, 4, 14], [13, 6, 11], [14, 8, 8],
    ];
    for (const [y, x0, w] of rows) {
      const body = y <= 8 ? '#8E44AD' : y >= 13 ? '#CE93D8' : '#F3E5F5';
      for (let i = 0; i < w; i++) {
        const x = x0 + i;
        const part: FishKingPart = x <= 7 ? 'head' : x <= 12 ? 'torso-f' : x <= 17 ? 'torso-r' : 'tail';
        paintPart(g, parts, x, y, i === 0 ? '#4A148C' : body, part);
      }
    }
    for (let x = 6; x <= 15; x += 2) {
      const part: FishKingPart = x <= 7 ? 'head' : x <= 12 ? 'torso-f' : 'torso-r';
      paintPart(g, parts, x, 9, '#AB47BC', part);
      paintPart(g, parts, x + 1, 10, '#FFD23F', part);
      paintPart(g, parts, x, 11, '#00E5FF', part);
    }
    rectPart(g, parts, 4, 9, 2, 2, '#00E5FF', 'head');
    paintPart(g, parts, 4, 9, '#FFFFFF', 'head');
    rectPart(g, parts, 1, 8, 3, 1, '#00E5FF', 'barbel-u');
    paintPart(g, parts, 0, 7, '#FFD23F', 'barbel-u');
    rectPart(g, parts, 1, 12, 3, 1, '#E1BEE7', 'barbel-d');
    paintPart(g, parts, 0, 13, '#00E5FF', 'barbel-d');
    rectPart(g, parts, 6, 14, 4, 4, '#AB47BC', 'pectoral');
    rectPart(g, parts, 5, 17, 3, 2, '#FFD23F', 'pelvic');
    rectPart(g, parts, 18, 7, 4, 4, '#E1BEE7', 'tail');
    rectPart(g, parts, 20, 5, 3, 3, '#FFD23F', 'tail');
    rectPart(g, parts, 18, 11, 4, 4, '#9B59B6', 'tail');
    rectPart(g, parts, 20, 14, 3, 3, '#00E5FF', 'tail');
  } else {
    // abyss_oarfish
    rectPart(g, parts, 3, 2, 1, 5, '#FF1744', 'dorsal');
    paintPart(g, parts, 2, 1, '#FFD23F', 'dorsal');
    rectPart(g, parts, 5, 3, 1, 4, '#FF5252', 'dorsal');
    paintPart(g, parts, 5, 2, '#FFD23F', 'dorsal');
    rectPart(g, parts, 7, 4, 1, 3, '#FF1744', 'dorsal');
    for (let x = 2; x <= 21; x++) {
      const cy = 11 + Math.round(Math.sin((x / 19) * Math.PI * 2) * 2.4);
      const part: FishKingPart = x <= 5 ? 'head' : x <= 12 ? 'torso-f' : x <= 18 ? 'torso-r' : 'tail';
      paintPart(g, parts, x, cy - 3, '#FF1744', 'dorsal');
      paintPart(g, parts, x, cy - 2, '#1565C0', part);
      paintPart(g, parts, x, cy - 1, (x % 2 === 0) ? '#E1F5FE' : '#80D8FF', part);
      paintPart(g, parts, x, cy, '#B3E5FC', part);
      paintPart(g, parts, x, cy + 1, '#0D47A1', part);
    }
    rectPart(g, parts, 3, 9, 2, 2, '#FFD23F', 'head');
    paintPart(g, parts, 3, 9, '#FF1744', 'head');
    rectPart(g, parts, 4, 13, 1, 5, '#FF1744', 'pectoral');
    paintPart(g, parts, 4, 18, '#00E5FF', 'pelvic');
    rectPart(g, parts, 20, 9, 3, 4, '#00E5FF', 'tail');
    paintPart(g, parts, 22, 8, '#FFD23F', 'tail');
    paintPart(g, parts, 22, 13, '#FF1744', 'tail');
  }

  return { colors: g, parts };
}

/** 24x24 高密差异化鱼类像素图标（按四大鱼王、奇鱼甲壳、比目、鳗鳅、宽体鲤鲷、纺锤掠食六大形态逐像素精绘） */
function fishIcon24Svg(fishId: string): string {
  const king = fishKing24Master(fishId);
  if (king) return render(king.colors, 'qh-svg-icon qh-pixel');

  const g = grid(24, 24);
  const main = FISH_PALETTE[fishId] ?? hashColor(fishId);
  const dark = shade(main, 0.58);
  const mid = shade(main, 0.82);
  const light = shade(main, 1.32);
  const belly = shade(main, 1.55);

  // 2) 奇形海产与甲壳型（章鱼、乌贼、龙虾、河豚、鮟鱇鱼、剑鱼/枪鱼）
  if (fishId === 'octopus') {
    blob(g, 12, 8, 6, 5, main);
    px(g, 9, 6, light); px(g, 10, 6, light);
    rect(g, 9, 9, 2, 2, '#FFF9C4'); px(g, 9, 9, D);
    rect(g, 14, 9, 2, 2, '#FFF9C4'); px(g, 14, 9, D);
    for (const tx of [5, 8, 11, 14, 17]) {
      rect(g, tx, 13, 2, 6, main);
      px(g, tx - 1, 18, dark); px(g, tx + 1, 16, '#F8BBD0'); px(g, tx + 1, 19, '#F8BBD0');
    }
    return render(g, 'qh-svg-icon qh-pixel');
  }
  if (fishId === 'squid') {
    // 菱形尾翼外套膜 + 触腕群
    for (let i = 0; i < 6; i++) rect(g, 12 - i, 2 + i, i * 2, 1, i < 2 ? dark : main);
    rect(g, 8, 8, 8, 7, main); rect(g, 9, 8, 2, 6, light);
    rect(g, 8, 13, 2, 2, '#FFFFFF'); px(g, 8, 14, D);
    rect(g, 14, 13, 2, 2, '#FFFFFF'); px(g, 14, 14, D);
    for (const tx of [7, 9, 11, 13, 15]) { rect(g, tx, 15, 1, 6, dark); px(g, tx, 21, light); }
    return render(g, 'qh-svg-icon qh-pixel');
  }
  if (fishId === 'lobster') {
    // 双巨螯 + 分节虾身 + 尾扇
    rect(g, 3, 5, 5, 3, main); rect(g, 2, 7, 3, 2, dark);
    rect(g, 3, 15, 5, 3, main); rect(g, 2, 14, 3, 2, dark);
    rect(g, 7, 9, 11, 6, main);
    for (let x = 9; x <= 16; x += 2) rect(g, x, 9, 1, 6, dark);
    rect(g, 10, 10, 6, 1, light);
    px(g, 7, 10, D); px(g, 7, 13, D);
    rect(g, 18, 8, 4, 8, dark); rect(g, 19, 9, 2, 6, main);
    return render(g, 'qh-svg-icon qh-pixel');
  }
  if (fishId === 'pufferfish') {
    // 鼓腹棘刺河豚
    blob(g, 11, 12, 7, 6, '#FFD54F');
    rect(g, 6, 13, 10, 4, '#FFF9C4');
    for (const [sx, sy] of [[7, 5], [11, 4], [15, 5], [4, 9], [4, 14], [7, 18], [11, 19], [15, 18]]) {
      px(g, sx, sy, '#8D6E63');
    }
    rect(g, 7, 9, 2, 2, '#FFFFFF'); px(g, 7, 9, D);
    rect(g, 18, 10, 3, 4, '#FFB300');
    return render(g, 'qh-svg-icon qh-pixel');
  }
  if (fishId === 'anglerfish') {
    // 头顶发光灯笼 + 巨口利齿深海鮟鱇
    rect(g, 6, 3, 6, 1, '#7E57C2'); rect(g, 4, 4, 2, 2, '#00E5FF'); px(g, 4, 4, '#FFFFFF');
    blob(g, 12, 13, 7, 6, '#311B92');
    rect(g, 5, 12, 6, 4, '#12002B');
    for (const tx of [5, 7, 9]) { px(g, tx, 12, '#FFF9C4'); px(g, tx + 1, 15, '#FFF9C4'); }
    rect(g, 8, 9, 2, 2, '#FFD23F');
    rect(g, 19, 11, 3, 4, '#512DA8');
    return render(g, 'qh-svg-icon qh-pixel');
  }
  if (fishId === 'swordfish' || fishId === 'storm_bay_marlin') {
    // 超长吻剑 + 高耸背帆 + 新月尾
    rect(g, 1, 11, 6, 1, D); rect(g, 2, 12, 5, 1, light);
    rect(g, 8, 5, 7, 4, dark); rect(g, 9, 6, 5, 2, main);
    const rows: [number, number, number][] = [
      [9, 7, 10], [10, 6, 12], [11, 5, 13], [12, 6, 12], [13, 7, 10], [14, 9, 7],
    ];
    for (const [y, x0, w] of rows) rect(g, x0, y, w, 1, y <= 11 ? main : belly);
    rect(g, 7, 10, 2, 2, '#FFF9C4'); px(g, 7, 10, D);
    rect(g, 18, 8, 3, 3, dark); rect(g, 20, 6, 2, 3, main);
    rect(g, 18, 12, 3, 3, dark); rect(g, 20, 14, 2, 3, main);
    return render(g, 'qh-svg-icon qh-pixel');
  }
  if (fishId === 'halibut') {
    // 宽菱扁平大比目鱼（双目同侧）
    const rows: [number, number, number][] = [
      [5, 10, 4], [6, 8, 8], [7, 6, 11], [8, 5, 13], [9, 4, 14], [10, 3, 15],
      [11, 3, 15], [12, 3, 15], [13, 4, 14], [14, 5, 13], [15, 6, 11], [16, 8, 8], [17, 10, 4],
    ];
    for (const [y, x0, w] of rows) {
      rect(g, x0, y, w, 1, (y === 5 || y === 17) ? dark : main);
      if (y >= 8 && y <= 14) for (let x = x0 + 2; x < x0 + w - 2; x += 3) px(g, x, y, (x + y) % 2 ? light : dark);
    }
    px(g, 6, 9, '#FFFFFF'); px(g, 6, 10, D);
    px(g, 6, 12, '#FFFFFF'); px(g, 6, 13, D);
    rect(g, 18, 9, 4, 5, dark);
    return render(g, 'qh-svg-icon qh-pixel');
  }
  if (fishId === 'eel' || fishId === 'freshwater_eel' || fishId === 'loach') {
    // 蜿蜒 S 型鳗鳅
    for (let x = 3; x <= 20; x++) {
      const cy = 12 + Math.round(Math.sin((x / 16) * Math.PI * 2) * 2.5);
      px(g, x, cy - 2, dark);
      px(g, x, cy - 1, main);
      px(g, x, cy, (x % 2 === 0) ? light : main);
      px(g, x, cy + 1, belly);
    }
    px(g, 4, 11, '#FFF9C4'); px(g, 4, 12, D);
    if (fishId === 'loach') { px(g, 2, 12, dark); px(g, 2, 14, dark); }
    return render(g, 'qh-svg-icon qh-pixel');
  }

  // 3) 宽体高背鲤鲫/太阳鱼/海鲷型 vs 流线纺锤掠食/鲑鳟型
  const isDeepBody = ['carp', 'silver_crucian', 'dawn_silver_carp', 'sunfish', 'bluegill', 'bitterling', 'sea_bream', 'red_snapper', 'reef_night_snapper', 'parrotfish', 'grouper', 'mahi_mahi'].includes(fishId);
  const bodyRows: [number, number, number][] = isDeepBody
    ? [
        [6, 8, 8], [7, 6, 11], [8, 5, 13], [9, 4, 14], [10, 3, 15],
        [11, 3, 15], [12, 3, 15], [13, 4, 14], [14, 5, 13], [15, 6, 11], [16, 8, 8],
      ]
    : [
        [8, 7, 9], [9, 5, 12], [10, 3, 15], [11, 2, 16],
        [12, 3, 15], [13, 5, 12], [14, 7, 9],
      ];

  // 背鳍与臀鳍
  if (isDeepBody) {
    rect(g, 9, 4, 6, 2, dark); rect(g, 10, 5, 4, 1, light);
    rect(g, 12, 17, 4, 2, dark);
  } else {
    rect(g, 9, 6, 5, 2, dark); rect(g, 10, 7, 3, 1, light);
    rect(g, 15, 7, 2, 1, mid); // 脂鳍
    rect(g, 13, 15, 3, 2, dark);
  }

  // 鱼身逐行像素阶梯 + 交错鱼鳞 + 肚白
  for (const [y, x0, w] of bodyRows) {
    const isTop = y <= (isDeepBody ? 7 : 9);
    const isBot = y >= (isDeepBody ? 15 : 13);
    rect(g, x0, y, w, 1, isTop ? dark : isBot ? belly : main);
    px(g, x0, y, D); px(g, x0 + w - 1, y, D);
    if (!isTop && !isBot) {
      for (let x = x0 + 4; x < x0 + w - 2; x += 2) {
        if ((x + y) % 2 === 0) px(g, x, y, light);
        else if ((x + y) % 3 === 0) px(g, x, y, mid);
      }
    }
  }

  // 鳃盖弧线 + 亮眼 + 胸鳍 + 分叉尾鳍
  const eyeY = isDeepBody ? 10 : 10;
  rect(g, 5, eyeY, 2, 2, '#FFFFFF'); px(g, 5, eyeY, D);
  px(g, 8, eyeY, dark); px(g, 8, eyeY + 1, dark); px(g, 7, eyeY + 2, dark);
  rect(g, 8, isDeepBody ? 14 : 13, 4, 2, dark); px(g, 9, isDeepBody ? 15 : 14, light);
  if (['catfish', 'yellow_catfish', 'carp', 'dawn_silver_carp', 'sturgeon'].includes(fishId)) {
    px(g, 2, 12, dark); px(g, 1, 13, dark); px(g, 2, 14, dark);
  }
  rect(g, 18, 8, 3, 3, dark); rect(g, 20, 6, 2, 3, main); px(g, 21, 6, light);
  rect(g, 18, 12, 3, 3, dark); rect(g, 20, 14, 2, 3, main); px(g, 21, 16, light);

  return render(g, 'qh-svg-icon qh-pixel');
}

const ITEM_PAINT: Record<string, (g: Grid) => void> = {};
function defItem(id: string, main: string, kind: 'fruit' | 'fish' | 'gem' | 'sword'): void {
  ITEM_PAINT[id] = (g) => kind === 'fruit' ? paintFruit(g, main) : kind === 'fish' ? paintFish(g, main, hash(id)) : kind === 'gem' ? paintGem(g, main) : paintSword(g, main);
}
Object.entries(CROP_PALETTE).forEach(([id, p]) => defItem(id, p.main, 'fruit'));
[['amethyst', '#AB47BC'], ['topaz', '#FFCA28'], ['aquamarine', '#26C6DA'], ['jade', '#66BB6A'], ['ruby', '#E53935'], ['emerald', '#2ECC71'], ['diamond', '#80DEEA'], ['crystal_fruit', '#4FC3F7']].forEach(([id, c]) => defItem(id, c, 'gem'));
[['wild_horseradish', '#D7CCC8'], ['leek', '#A5D6A7'], ['spice_berry', '#FF7043'], ['grape', '#8E24AA'], ['wild_plum', '#7B1FA2'], ['hazelnut', '#A1662F'], ['blackberry', '#37474F'], ['winter_root', '#D7B889'], ['snow_yam', '#E1F5FE']].forEach(([id, c]) => defItem(id, c, 'fruit'));
[['rusty_sword', '#A1887F'], ['steel_sword', '#B0BEC5'], ['silver_blade', '#E1F5FE'], ['obsidian_sword', '#7E57C2'], ['galaxy_sword', '#CE93D8']].forEach(([id, c]) => defItem(id, c, 'sword'));

function paintSpecial(g: Grid, id: string): boolean {
  const pal = (CROP_PALETTE[id.replace(/_seed$/, '')]);
  if (id.endsWith('_seed') && pal) { // 牛皮纸种子袋 + 作物色像素图案
    rect(g, 4, 3, 8, 11, '#DFC396'); rect(g, 4, 3, 8, 2, '#B08954'); rect(g, 4, 13, 8, 1, '#8D6E63');
    blob(g, 8, 9, 3, 3, pal.main); px(g, 7, 5, pal.leaf); px(g, 9, 5, pal.leaf); return true;
  }
  switch (id) {
    case 'wood': rect(g, 2, 6, 11, 5, '#8D5524'); rect(g, 11, 6, 3, 5, '#D7A86E'); px(g, 12, 8, '#8D5524'); rect(g, 3, 8, 6, 1, '#5D341E'); return true;
    case 'common_mushroom': case 'mushroom': rect(g, 6, 8, 4, 6, '#F5E6C8'); rect(g, 3, 4, 10, 4, '#A15C38'); px(g, 5, 5, '#D7A86E'); px(g, 10, 6, '#D7A86E'); return true;
    case 'daffodil': case 'dandelion': case 'sweet_pea': case 'crocus': {
      const c = id === 'daffodil' ? '#FFEE58' : id === 'crocus' ? '#9575CD' : id === 'sweet_pea' ? '#F48FB1' : '#FFD54F';
      rect(g, 7, 8, 2, 6, '#43A047'); blob(g, 8, 5, 4, 4, c); px(g, 8, 5, '#FB8C00'); return true;
    }
    case 'clam': case 'cockle': case 'mussel': rect(g, 4, 5, 8, 8, id === 'mussel' ? '#455A64' : '#FFE0B2'); rect(g, 5, 4, 6, 2, id === 'mussel' ? '#607D8B' : '#FFCCBC'); px(g, 7, 7, D); px(g, 9, 9, D); return true;
    case 'coral': rect(g, 7, 4, 2, 10, '#FF5252'); rect(g, 4, 6, 2, 4, '#FF8A80'); rect(g, 11, 5, 2, 5, '#FF8A80'); px(g, 7, 3, '#FFCDD2'); return true;
    case 'copper_ore': case 'iron_ore': case 'gold_ore': case 'scrap': {
      const c = id === 'gold_ore' ? '#FFD700' : id === 'iron_ore' ? '#CFD8DC' : id === 'copper_ore' ? '#E67E22' : '#90A4AE';
      rect(g, 3, 4, 10, 9, '#757575'); rect(g, 4, 3, 8, 1, '#9E9E9E'); blob(g, 6, 7, 2, 2, c); blob(g, 10, 10, 2, 2, c); return true;
    }
    case 'slime': blob(g, 8, 9, 5, 5, '#76FF03'); px(g, 6, 8, D); px(g, 10, 8, D); return true;
    case 'bat_wing': rect(g, 2, 6, 5, 3, '#455A64'); rect(g, 9, 6, 5, 3, '#455A64'); px(g, 7, 8, '#263238'); px(g, 4, 9, '#263238'); px(g, 11, 9, '#263238'); return true;
    case 'bone_fragment': for (let i = 0; i < 8; i++) px(g, 4 + i, 11 - i, '#FFFDF7'); blob(g, 4, 12, 2, 2, '#FFFDF7'); blob(g, 12, 4, 2, 2, '#FFFDF7'); return true;
    case 'golem_core': blob(g, 8, 8, 6, 6, '#546E7A'); blob(g, 8, 8, 3, 3, '#00E5FF'); return true;
    case 'void_essence': blob(g, 8, 8, 6, 6, '#311B92'); blob(g, 8, 8, 2, 2, '#E040FB'); px(g, 5, 5, '#B388FF'); return true;
    case 'bread': blob(g, 8, 9, 6, 4, '#D7A86E'); px(g, 6, 7, '#8D5524'); px(g, 9, 7, '#8D5524'); return true;
    case 'salad': rect(g, 3, 8, 10, 4, '#FFFDF7'); blob(g, 6, 7, 3, 3, '#66BB6A'); blob(g, 10, 7, 3, 3, '#81C784'); px(g, 8, 6, '#E53935'); return true;
    case 'pizza': for (let i = 0; i < 10; i++) rect(g, 3 + Math.max(0, 5 - i), 3 + i, Math.max(1, i * 1), 1, '#FFCA28'); px(g, 7, 6, '#D32F2F'); px(g, 8, 9, '#D32F2F'); return true;
    case 'breakfast': blob(g, 8, 8, 6, 5, '#FFFFFF'); blob(g, 7, 8, 3, 3, '#FFB300'); rect(g, 11, 6, 2, 5, '#C62828'); return true;
    case 'bouquet': rect(g, 5, 8, 6, 6, '#F8BBD0'); blob(g, 5, 5, 3, 3, '#EC407A'); blob(g, 11, 5, 3, 3, '#AB47BC'); blob(g, 8, 3, 3, 3, '#FFD54F'); return true;
    case 'pendant': px(g, 5, 2, '#FFD54F'); px(g, 11, 2, '#FFD54F'); rect(g, 6, 3, 4, 1, '#B8860B'); blob(g, 8, 9, 4, 5, '#00BCD4'); px(g, 7, 7, '#E0F7FA'); return true;
    case 'bait_worm': case 'bait_grub': case 'bait_shrimp': case 'bait_minnow': case 'bait_squid': case 'bait_krill': {
      const c = id === 'bait_shrimp' ? '#FF8A80' : id === 'bait_krill' ? '#CE93D8' : '#A1887F';
      for (let i = 0; i < 9; i++) { px(g, 3 + i, 5 + (i % 3), c); if (i % 2 === 0) px(g, 3 + i, 8 + (i % 2), shade(c, 0.7)); }
      return true;
    }
    case 'bait_basic': case 'bait_dough': case 'bait_universal': case 'bait_corn': case 'bait_shellfish': case 'bait_glow': case 'bait_legend':
    case 'bait_amber': case 'bait_jade': case 'bait_frost': case 'bait_void': case 'bait_dragon':
      blob(
        g,
        8,
        8,
        5,
        5,
        id === 'bait_legend' || id === 'bait_dragon'
          ? '#FFD54F'
          : id === 'bait_glow' || id === 'bait_frost'
            ? '#80DEEA'
            : id === 'bait_void'
              ? '#AB47BC'
              : id === 'bait_jade'
                ? '#2ECC71'
                : id === 'bait_amber'
                  ? '#FFB300'
                  : id === 'bait_corn'
                    ? '#FFCA28'
                    : id === 'bait_basic'
                      ? '#FFAB91'
                      : '#D7CCC8',
      );
      px(g, 6, 6, '#FFFFFF'); px(g, 10, 9, '#6D4C41'); return true;
    case 'fists': rect(g, 4, 5, 8, 8, '#FFCC80'); rect(g, 5, 3, 2, 3, '#FFCC80'); rect(g, 8, 3, 2, 3, '#FFCC80'); rect(g, 11, 4, 1, 2, '#FFCC80'); return true;
    case 'driftwood': for (let i = 0; i < 10; i++) px(g, 3 + i, 10 - Math.floor(i / 2), '#8D6E63'); return true;
    case 'old_boot': rect(g, 5, 3, 5, 8, '#6D4C41'); rect(g, 5, 10, 9, 4, '#6D4C41'); rect(g, 5, 13, 9, 1, '#3E2723'); return true;
    case 'soggy_newspaper': rect(g, 3, 3, 10, 10, '#CFD8DC'); rect(g, 5, 5, 6, 1, '#546E7A'); rect(g, 5, 8, 6, 1, '#78909C'); rect(g, 5, 10, 4, 1, '#78909C'); return true;
    default: return false;
  }
}

export function itemIconSvg(itemId: string): string {
  if (FISH_MAP[itemId]) return fishIcon24Svg(itemId);
  const g = grid(16, 16);
  if (itemId === 'tool_hoe') return toolIconSvg('hoe', 0);
  if (itemId === 'tool_can') return toolIconSvg('can', 0);
  if (itemId === 'tool_pickaxe') return toolIconSvg('pickaxe', 0);
  if (itemId === 'tool_axe') return toolIconSvg('axe', 0);
  if (itemId === 'rod_bamboo') return toolIconSvg('rod', 0);
  if (itemId === 'rod_fiberglass') return toolIconSvg('rod', 1);
  if (itemId === 'rod_iridium') return toolIconSvg('rod', 2);
  if (itemId.startsWith('rod_')) return toolIconSvg('rod', 2 + (hash(itemId) % 3));
  if (!paintSpecial(g, itemId)) {
    if (ITEM_PAINT[itemId]) ITEM_PAINT[itemId](g);
    else { // 未知物品: 像素木箱问号纹样 (与任何真实物品都不同), 保证不回退到汉字/圆滑占位
      rect(g, 3, 4, 10, 9, '#B08954'); rect(g, 3, 4, 10, 2, '#8D6E63'); rect(g, 3, 11, 10, 2, '#8D6E63');
      px(g, 7, 7, '#FFF3E0'); px(g, 8, 7, '#FFF3E0'); px(g, 9, 8, '#FFF3E0'); px(g, 8, 9, '#FFF3E0'); px(g, 8, 11, '#FFF3E0');
      void hash(itemId);
    }
  }
  return render(g, 'qh-svg-icon qh-pixel');
}

/* ---------------- 工具 (分等级换色) ---------------- */
const TOOL_HEAD = ['#90A4AE', '#E67E22', '#CFD8DC', '#FFD54F', '#AB47BC'];
export function toolIconSvg(tool: ToolId, level = 0): string {
  const g = grid(16, 16); const head = TOOL_HEAD[Math.min(4, Math.max(0, level))]; const dark = shade(head, 0.55);
  const handle = '#8D5524';
  if (tool === 'hoe' || tool === 'pickaxe' || tool === 'axe') {
    for (let i = 0; i < 10; i++) { px(g, 3 + i, 13 - i, handle); px(g, 4 + i, 13 - i, shade(handle, 0.7)); }
    if (tool === 'hoe') { rect(g, 10, 2, 5, 3, head); rect(g, 13, 5, 2, 3, dark); }
    if (tool === 'pickaxe') { rect(g, 7, 2, 7, 2, head); px(g, 14, 4, dark); px(g, 6, 4, dark); rect(g, 9, 4, 3, 1, dark); }
    if (tool === 'axe') { rect(g, 10, 2, 5, 5, head); px(g, 14, 3, shade(head, 1.35)); px(g, 10, 7, dark); }
  } else if (tool === 'can') {
    rect(g, 4, 6, 8, 7, level === 0 ? '#42A5F5' : head); rect(g, 4, 6, 8, 1, dark); rect(g, 12, 7, 3, 2, head); px(g, 15, 6, dark);
    rect(g, 2, 7, 2, 4, dark); px(g, 7, 9, '#E1F5FE'); px(g, 8, 9, '#E1F5FE');
  } else { // rod
    for (let i = 0; i < 12; i++) px(g, 2 + i, 13 - i, level >= 2 ? '#7B1FA2' : level === 1 ? '#00838F' : handle);
    rect(g, 13, 2, 1, 7, '#B0BEC5'); blob(g, 13, 11, 2, 2, '#FF5252');
  }
  return render(g, 'qh-svg-icon qh-pixel');
}

/* ---------------- 作物 4 阶段 + 状态姿态 (24x24 满画幅 16-bit 有机像素植株版) ---------------- */
type CropShapeKind = 'root' | 'bush' | 'head' | 'tall';
function cropShapeOf(cropId: string): CropShapeKind {
  if (cropId === 'parsnip' || cropId === 'potato' || cropId === 'yam') return 'root';
  if (cropId === 'cauliflower' || cropId === 'melon' || cropId === 'pumpkin') return 'head';
  if (cropId === 'corn' || cropId === 'green_bean') return 'tall';
  return 'bush';
}

/** 16-bit 柔和同色系描边像素大叶片 (占满左右画幅, droop=true 时叶片明显下垂卷曲) */
function paintFoliageLeaf(
  g: Grid,
  cx: number,
  cy: number,
  dir: -1 | 1,
  len: number,
  droop: boolean,
  out: string,
  dark: string,
  mid: string,
  hi: string,
): void {
  for (let i = 0; i < len; i++) {
    const x = cx + dir * (i + 1);
    const arc = droop
      ? Math.floor((i * i) / (len * 0.65))
      : Math.round(-Math.sin((i / Math.max(1, len - 1)) * Math.PI) * 3.4);
    const y = cy + arc;
    px(g, x, y - 1, out);
    px(g, x, y, i < len * 0.6 ? hi : mid);
    px(g, x, y + 1, mid);
    px(g, x, y + 2, dark);
    px(g, x, y + 3, out);
  }
  const tipX = cx + dir * (len + 1);
  const tipY = cy + (droop ? Math.floor((len * len) / (len * 0.65)) : 0);
  px(g, tipX, tipY, out);
  px(g, tipX, tipY + 1, mid);
  px(g, tipX, tipY + 2, out);
}

/** 植株入土根窝与地面状态纹理 (y=19..23): 湿润深色水沁泥窝 / 缺水干裂闪电纹 / 枯萎灰土 */
function paintGroundSocket24(g: Grid, mode: 'wet' | 'dry' | 'normal' | 'wilted'): void {
  // 24x24 全宽像素耕土垄沟 (x=0..23, y=14..23): 让植株真正长在像素土垄里, 而不是浮在圆圈上
  const cfg =
    mode === 'wet'
      ? { base: '#341B0C', ridge: '#4A2813', groove: '#200F05', hi: '#5E361B' }
      : mode === 'wilted'
        ? { base: '#5E5042', ridge: '#736252', groove: '#3E352B', hi: '#8C7A68' }
        : { base: '#BD824A', ridge: '#D69C63', groove: '#8C5626', hi: '#ECC090' };
  rect(g, 0, 14, 24, 10, cfg.base);
  for (const ry of [15, 18, 21]) {
    rect(g, 1, ry, 22, 2, cfg.ridge);
    rect(g, 1, ry + 2, 22, 1, cfg.groove);
  }
  for (const [x, y] of [[3, 15], [8, 16], [16, 15], [20, 16], [5, 18], [13, 18], [19, 19], [7, 21], [15, 21]]) {
    px(g, x, y, cfg.hi);
  }
  if (mode === 'dry') {
    // 缺水干裂闪电纹横贯土面
    for (const [x, y] of [
      [2, 16], [3, 17], [4, 17], [5, 18], [4, 19], [3, 20], [2, 21],
      [21, 16], [20, 17], [19, 17], [18, 18], [19, 19], [20, 20], [21, 21],
      [10, 20], [11, 21], [14, 20], [13, 21],
    ]) {
      px(g, x, y, '#4A260C');
    }
  }
}

export function cropGrowthSvg(cropId: string, pct: number, opts?: { watered?: boolean; wilted?: boolean; weeds?: boolean }): string {
  const g = grid(24, 24);
  const pal = CROP_PALETTE[cropId] ?? { main: '#8BC34A', stroke: '#33691E', leaf: '#4CAF50' };
  const wet = Boolean(opts?.watered);
  const dry = opts?.watered === false;
  const shape = cropShapeOf(cropId);

  if (opts?.wilted) {
    paintGroundSocket24(g, 'wilted');
    // 24x24 枯萎焦褐残株: 歪斜干瘪主茎 + 四片垂落枯叶 (占满 x=2..21, y=4..21)
    const wo = '#3E2723'; const wd = '#5D4037'; const wm = '#795548'; const wl = '#A1887F';
    rect(g, 10, 6, 4, 15, wo); rect(g, 11, 7, 2, 14, wd);
    paintFoliageLeaf(g, 10, 8, -1, 7, true, wo, wd, wm, wl);
    paintFoliageLeaf(g, 13, 9, 1, 7, true, wo, wd, wm, wl);
    paintFoliageLeaf(g, 10, 13, -1, 8, true, wo, wd, wm, wl);
    paintFoliageLeaf(g, 13, 13, 1, 8, true, wo, wd, wm, wl);
    rect(g, 9, 4, 5, 3, wo); rect(g, 10, 5, 3, 2, wl);
    if (opts.weeds) paintWeeds(g);
    return render(g, 'qh-tile-svg qh-pixel');
  }

  paintGroundSocket24(g, wet ? 'wet' : dry ? 'dry' : 'normal');

  // 16-bit 同色系柔和深色描边 (不用死黑): 湿润为浓郁森林绿, 缺水为焦黄橄榄褐
  const out = dry ? '#5C4D14' : '#1B4D18';
  const leaf = dry ? '#B8B038' : pal.leaf;
  const leafD = dry ? '#8C8220' : shade(leaf, 0.72);
  const leafHi = dry ? '#E6EE9C' : shade(leaf, 1.35);
  const fOut = shade(pal.stroke, 0.58);
  const fDark = shade(pal.main, 0.74);
  const fHi = shade(pal.main, 1.35);

  if (pct >= 100) {
    // ========= 阶段 4 (成熟丰收): 占满 24x24 画幅, 按作物形态差异化绘制 =========
    if (shape === 'root') {
      // 根茎类 (防风草/土豆/山药): 上方炸开茂密羽状冠叶 (y=1..11) + 下方肥硕根块破土而出 (y=9..21)
      paintFoliageLeaf(g, 10, 5, -1, 8, false, out, leafD, leaf, leafHi);
      paintFoliageLeaf(g, 13, 5, 1, 8, false, out, leafD, leaf, leafHi);
      paintFoliageLeaf(g, 10, 8, -1, 9, false, out, leafD, leaf, leafHi);
      paintFoliageLeaf(g, 13, 8, 1, 9, false, out, leafD, leaf, leafHi);
      rect(g, 9, 1, 6, 8, out); rect(g, 10, 2, 4, 6, leaf); rect(g, 11, 2, 2, 4, leafHi);
      // 肥大锥形/块状根茎 (x=5..18, y=9..21)
      blob(g, 12, 15, 7, 6, fOut);
      blob(g, 12, 15, 6, 5, pal.main);
      rect(g, 8, 11, 3, 2, '#FFFFFF'); px(g, 11, 11, fHi);
      rect(g, 8, 16, 8, 1, fDark); rect(g, 9, 18, 6, 1, fDark);
    } else if (shape === 'head') {
      // 座果类 (花椰菜/南瓜/甜瓜): 外圈宽大托叶环抱 (x=1..22, y=6..21) + 中央硕大圆润果实/花球 (y=3..20)
      paintFoliageLeaf(g, 9, 10, -1, 8, false, out, leafD, leaf, leafHi);
      paintFoliageLeaf(g, 14, 10, 1, 8, false, out, leafD, leaf, leafHi);
      paintFoliageLeaf(g, 9, 15, -1, 9, false, out, leafD, leaf, leafHi);
      paintFoliageLeaf(g, 14, 15, 1, 9, false, out, leafD, leaf, leafHi);
      blob(g, 12, 12, 8, 8, fOut);
      blob(g, 12, 12, 7, 7, pal.main);
      // 棱纹/花球立体纹理与高光
      for (let y = 6; y <= 18; y++) { px(g, 9, y, fDark); px(g, 15, y, fDark); }
      rect(g, 7, 7, 3, 3, '#FFFFFF'); px(g, 11, 7, fHi); px(g, 12, 8, fHi);
      rect(g, 10, 3, 4, 3, out); rect(g, 11, 4, 2, 2, leafHi);
    } else if (shape === 'tall') {
      // 高秆类 (玉米/青豆): 挺拔主秆直达画布顶端 (y=1..21) + 四片修长阔叶 + 两侧饱满金穗/豆荚
      rect(g, 10, 1, 4, 20, out); rect(g, 11, 2, 2, 18, leaf); px(g, 11, 2, '#FFD54F'); px(g, 12, 1, '#FFD54F');
      paintFoliageLeaf(g, 10, 6, -1, 8, false, out, leafD, leaf, leafHi);
      paintFoliageLeaf(g, 13, 6, 1, 8, false, out, leafD, leaf, leafHi);
      paintFoliageLeaf(g, 10, 13, -1, 9, false, out, leafD, leaf, leafHi);
      paintFoliageLeaf(g, 13, 13, 1, 9, false, out, leafD, leaf, leafHi);
      // 左右两穗饱满果实
      blob(g, 7, 10, 4, 5, fOut); blob(g, 7, 10, 3, 4, pal.main); px(g, 6, 8, '#FFFFFF');
      blob(g, 17, 11, 4, 5, fOut); blob(g, 17, 11, 3, 4, pal.main); px(g, 16, 9, '#FFFFFF');
    } else {
      // 浆果/茄果灌木类 (草莓/蓝莓/番茄/辣椒/茄子/蔓越莓): 占满 x=1..22, y=2..21 的繁茂灌木丛 + 3 颗硕大果实
      blob(g, 12, 11, 10, 8, out);
      blob(g, 12, 11, 9, 7, leafD);
      blob(g, 8, 8, 5, 4, leaf); blob(g, 16, 8, 5, 4, leaf); blob(g, 12, 6, 5, 4, leafHi);
      paintFoliageLeaf(g, 9, 13, -1, 8, false, out, leafD, leaf, leafHi);
      paintFoliageLeaf(g, 14, 13, 1, 8, false, out, leafD, leaf, leafHi);
      // 3 颗大果实挂满枝头 (中上、左下、右下)
      for (const [fx, fy, r] of [[12, 9, 4], [6, 14, 4], [18, 14, 4]] as const) {
        blob(g, fx, fy, r + 1, r + 1, fOut);
        blob(g, fx, fy, r, r, pal.main);
        rect(g, fx - 2, fy - 2, 2, 2, '#FFFFFF');
        px(g, fx + 1, fy + 1, fDark);
        rect(g, fx - 1, fy - r, 3, 1, leafHi);
      }
    }
    // 顶部丰收金色星芒
    px(g, 2, 2, '#FFF9C4'); px(g, 1, 3, '#FFD54F'); px(g, 3, 3, '#FFD54F'); px(g, 2, 4, '#FFD54F'); px(g, 2, 1, '#FFD54F');
    px(g, 21, 2, '#FFF9C4'); px(g, 20, 3, '#FFD54F'); px(g, 22, 3, '#FFD54F'); px(g, 21, 4, '#FFD54F'); px(g, 21, 1, '#FFD54F');
  } else if (pct >= 55) {
    // ========= 阶段 3 (结蕾繁茂大株): 占满 x=1..22, y=2..21 的丰满树冠 + 3 颗花苞幼果 =========
    const yOff = dry ? 2 : 0;
    rect(g, 10, 3 + yOff, 4, 18 - yOff, out);
    rect(g, 11, 4 + yOff, 2, 16 - yOff, leafD); px(g, 11, 5 + yOff, leaf);
    if (!dry) {
      blob(g, 12, 9, 8, 6, out);
      blob(g, 12, 9, 7, 5, leaf);
      blob(g, 10, 7, 4, 3, leafHi);
    }
    paintFoliageLeaf(g, 10, 7 + yOff, -1, 8, dry, out, leafD, leaf, leafHi);
    paintFoliageLeaf(g, 13, 7 + yOff, 1, 8, dry, out, leafD, leaf, leafHi);
    paintFoliageLeaf(g, 10, 13 + yOff, -1, 9, dry, out, leafD, leaf, leafHi);
    paintFoliageLeaf(g, 13, 13 + yOff, 1, 9, dry, out, leafD, leaf, leafHi);
    blob(g, 12, 4 + yOff, 5, 3, out); blob(g, 12, 4 + yOff, 4, 2, leafHi);
    // 3 颗饱满幼果/花苞
    for (const [bx, by] of [[12, 9 + yOff], [6, 12 + yOff], [18, 12 + yOff]]) {
      blob(g, bx, by, 3, 3, fOut);
      blob(g, bx, by, 2, 2, pal.main);
      px(g, bx - 1, by - 1, '#FFF9C4');
    }
  } else if (pct >= 25) {
    // ========= 阶段 2 (四叶饱满幼苗): 占满 x=1..22, y=2..21 =========
    const yOff = dry ? 2 : 0;
    rect(g, 10, 3 + yOff, 4, 18 - yOff, out);
    rect(g, 11, 4 + yOff, 2, 16 - yOff, leafD); px(g, 11, 5 + yOff, leaf);
    if (!dry) {
      blob(g, 12, 10, 7, 6, out);
      blob(g, 12, 10, 6, 5, leaf);
      blob(g, 10, 8, 4, 3, leafHi);
    }
    paintFoliageLeaf(g, 10, 7 + yOff, -1, 9, dry, out, leafD, leaf, leafHi);
    paintFoliageLeaf(g, 13, 7 + yOff, 1, 9, dry, out, leafD, leaf, leafHi);
    paintFoliageLeaf(g, 10, 13 + yOff, -1, 9, dry, out, leafD, leaf, leafHi);
    paintFoliageLeaf(g, 13, 13 + yOff, 1, 9, dry, out, leafD, leaf, leafHi);
    blob(g, 12, 4 + yOff, 5, 3, out); blob(g, 12, 4 + yOff, 4, 2, leafHi);
  } else {
    // ========= 阶段 1 (破土肥厚大嫩芽): 占满 x=1..22, y=5..21 =========
    const yOff = dry ? 2 : 0;
    rect(g, 10, 6 + yOff, 4, 15 - yOff, out);
    rect(g, 11, 7 + yOff, 2, 13 - yOff, leafD); px(g, 11, 7 + yOff, leafHi);
    paintFoliageLeaf(g, 10, 10 + yOff, -1, 8, dry, out, leafD, leaf, leafHi);
    paintFoliageLeaf(g, 13, 10 + yOff, 1, 8, dry, out, leafD, leaf, leafHi);
    paintFoliageLeaf(g, 10, 15 + yOff, -1, 7, dry, out, leafD, leaf, leafHi);
    paintFoliageLeaf(g, 13, 15 + yOff, 1, 7, dry, out, leafD, leaf, leafHi);
    blob(g, 12, 6 + yOff, 4, 3, out); blob(g, 12, 6 + yOff, 3, 2, leafHi);
  }
  if (opts?.weeds) paintWeeds(g);
  return render(g, 'qh-tile-svg qh-pixel');
}
function paintWeeds(g: Grid): void {
  // 24x24 经典像素杂草丛: 环绕植株根部与两侧的锯齿宽叶草簇 + 黄色野花点缀
  const o = '#14330A'; const d = '#265C18'; const m = '#438A2B'; const hi = '#9CCC65';
  const tufts: [number, number, number][] = [[1, 21, 9], [4, 22, 11], [8, 22, 7], [15, 22, 7], [19, 22, 11], [21, 21, 9]];
  for (const [bx, by, h] of tufts) {
    for (let i = 0; i < h; i++) {
      const y = by - i;
      px(g, bx - 1, y, o); px(g, bx + 2, y, o);
      px(g, bx, y, i >= h - 3 ? hi : m);
      px(g, bx + 1, y, d);
    }
    px(g, bx, by - h, o); px(g, bx + 1, by - h, o);
  }
  rect(g, 3, 10, 2, 2, '#FFF59D'); px(g, 4, 11, '#FBC02D');
  rect(g, 19, 10, 2, 2, '#FFF59D'); px(g, 19, 11, '#FBC02D');
}

/** 独立像素野草簇 SVG (24x8, 仅在点击/摇晃时作为根部两侧草叶层) */
export function weedTuftSvg(): string {
  const g = grid(24, 8);
  const o = '#0F2607'; const d = '#1E5210'; const m = '#388E3C'; const hi = '#8BC34A';
  for (const bx of [1, 4, 18, 21]) {
    for (let i = 0; i < 6; i++) {
      const y = 7 - i;
      px(g, bx, y, o); px(g, bx + 1, y, i >= 4 ? hi : m); px(g, bx + 2, y, i >= 3 ? d : o);
    }
  }
  return render(g, 'qh-weed-tuft-svg qh-pixel');
}

/* ---------------- 农田地块底图 (24x24 透明底大像素图 · 无内嵌小方框) / Debuff 角标 ---------------- */
export function tileGroundSvg(kind: 'locked' | 'weed' | 'stone' | 'grass' | 'soil' | 'soil_wet' | 'soil_dry_cracked'): string {
  const g = grid(24, 24);
  if (kind === 'locked') {
    // 24x24 像素大铜锁与铁链
    rect(g, 8, 3, 8, 2, '#CFD8DC'); rect(g, 7, 5, 2, 5, '#CFD8DC'); rect(g, 15, 5, 2, 5, '#90A4AE');
    rect(g, 4, 9, 16, 12, '#3E2723'); rect(g, 5, 10, 14, 10, '#8D6E63');
    rect(g, 5, 10, 14, 2, '#BCAAA4'); rect(g, 5, 18, 14, 2, '#5D4037');
    rect(g, 10, 13, 4, 3, '#FFD54F'); rect(g, 11, 16, 2, 3, '#2B1B0E');
  } else if (kind === 'weed') {
    // 24x24 茂密像素荒草丛 + 野花 (占满画幅, 无外框)
    const o = '#112908'; const d = '#265C18'; const m = '#438A2B'; const hi = '#8BC34A';
    const tufts: [number, number, number][] = [[3, 19, 9], [8, 21, 13], [14, 20, 12], [19, 18, 8], [6, 11, 7], [16, 11, 7]];
    for (const [bx, by, h] of tufts) {
      for (let i = 0; i < h; i++) {
        const y = by - i;
        px(g, bx - 1, y, o); px(g, bx + 2, y, o);
        px(g, bx, y, i > h * 0.55 ? hi : m);
        px(g, bx + 1, y, d);
      }
      px(g, bx, by - h, o); px(g, bx + 1, by - h, o);
    }
    rect(g, 7, 6, 2, 2, '#FFF59D'); px(g, 8, 7, '#FBC02D');
    rect(g, 16, 7, 2, 2, '#F48FB1'); px(g, 16, 7, '#FFF9C4');
  } else if (kind === 'stone') {
    // 24x24 立体像素巨石 + 青苔 + 阴影 (占满 x=2..21, y=4..21)
    rect(g, 3, 18, 18, 3, '#263238');
    blob(g, 12, 13, 9, 7, '#263238');
    blob(g, 12, 13, 8, 6, '#78909C');
    blob(g, 11, 11, 6, 4, '#B0BEC5');
    rect(g, 7, 7, 6, 2, '#ECEFF1'); px(g, 6, 8, '#FFFFFF');
    // 岩石裂面与底部青苔
    px(g, 9, 12, '#455A64'); px(g, 10, 13, '#455A64'); px(g, 11, 14, '#37474F'); px(g, 15, 13, '#455A64');
    rect(g, 5, 16, 4, 2, '#558B2F'); px(g, 6, 15, '#8BC34A');
    rect(g, 15, 17, 3, 2, '#33691E');
  } else if (kind === 'grass') {
    // 24x24 丰茂像素草甸 (多簇双色像素草叶 + 三叶草 + 小白花)
    const tufts: [number, number][] = [[3, 6], [15, 5], [9, 10], [4, 16], [16, 15], [10, 19]];
    for (const [bx, by] of tufts) {
      rect(g, bx, by + 2, 5, 1, '#1E460E');
      px(g, bx, by + 1, '#2E6816'); px(g, bx + 2, by + 1, '#2E6816'); px(g, bx + 4, by + 1, '#2E6816');
      px(g, bx, by, '#9AE05E'); px(g, bx + 2, by - 1, '#B4F078'); px(g, bx + 2, by, '#55A030'); px(g, bx + 4, by, '#9AE05E');
    }
    rect(g, 12, 6, 2, 2, '#FFF9C4'); px(g, 13, 7, '#FFB300');
    rect(g, 6, 13, 2, 2, '#FFF9C4'); px(g, 6, 13, '#FFB300');
  } else {
    // 24x24 立体像素耕土垄沟 (透明底, 四道深浅土垄与像素土块)
    const wet = kind === 'soil_wet';
    const ridge = wet ? '#59351C' : '#DDA672';
    const groove = wet ? '#221006' : '#7D4B20';
    const speck = wet ? '#6E4427' : '#F0C699';
    for (const y of [4, 9, 14, 19]) {
      rect(g, 2, y, 20, 2, ridge);
      rect(g, 3, y + 2, 18, 2, groove);
      px(g, 4 + (y % 5), y, speck);
      px(g, 15 - (y % 4), y + 1, speck);
    }
    if (kind === 'soil_dry_cracked') {
      px(g, 6, 7, '#3E2009'); px(g, 7, 8, '#3E2009'); px(g, 8, 9, '#3E2009');
      px(g, 15, 13, '#3E2009'); px(g, 16, 14, '#3E2009'); px(g, 14, 15, '#3E2009');
    }
  }
  return render(g, 'qh-tile-svg qh-pixel');
}

export function tileDebuffBadgesSvg(opts: { thirsty?: boolean; weeds?: boolean; wilted?: boolean; fertile?: boolean }): string {
  const badges: string[] = [];
  if (opts.wilted) badges.push(uiIconSvg('debuff_wilted'));
  if (opts.thirsty) badges.push(uiIconSvg('debuff_thirsty'));
  if (opts.weeds) badges.push(uiIconSvg('debuff_weeds'));
  if (opts.fertile) badges.push(uiIconSvg('buff_fertile'));
  return badges.length ? `<span class="tile-debuffs">${badges.join('')}</span>` : '';
}

export function tileStatusSvg(kind: 'weed' | 'stone' | 'withered' | 'sprout'): string {
  if (kind === 'weed') return tileGroundSvg('weed');
  if (kind === 'stone') return tileGroundSvg('stone');
  if (kind === 'withered') return cropGrowthSvg('parsnip', 60, { wilted: true });
  return cropGrowthSvg('parsnip', 30, { watered: true });
}

/* ---------------- 林间伐木: 8 种像素树 + 像素树桩 (24x24) ---------------- */
type TreeShape = 'pine' | 'round' | 'oval' | 'column' | 'vase';
const TREE_SPECIES: { crown: string; trunk: string; shape: TreeShape }[] = [
  { crown: '#2E7D32', trunk: '#6D4C41', shape: 'pine' },   // 青松
  { crown: '#43A047', trunk: '#5D4037', shape: 'round' },  // 古橡
  { crown: '#9CCC65', trunk: '#ECEFF1', shape: 'oval' },   // 白桦
  { crown: '#E64A19', trunk: '#6D4C41', shape: 'round' },  // 枫香
  { crown: '#00695C', trunk: '#4E342E', shape: 'pine' },   // 冷杉
  { crown: '#33691E', trunk: '#6D4C41', shape: 'round' },  // 板栗
  { crown: '#00897B', trunk: '#5D4037', shape: 'column' }, // 翠柏
  { crown: '#AED581', trunk: '#795548', shape: 'vase' },   // 山榆
];

/** 像素树: speciesIdx 对应 TREE_NAMES 顺序; hits=已挨斧数 (树干斧痕裂纹 + 泛黄落叶, 越砍越明显) */
export function treeSvg(speciesIdx: number, hits = 0): string {
  const sp = TREE_SPECIES[speciesIdx % TREE_SPECIES.length];
  const g = grid(24, 24);
  const light = shade(sp.crown, 1.4); const dark = shade(sp.crown, 0.6);
  // 地面草丛与投影
  rect(g, 4, 22, 16, 1, '#689F38'); px(g, 3, 21, '#558B2F'); px(g, 20, 21, '#558B2F'); px(g, 6, 21, '#7CB342'); px(g, 17, 21, '#7CB342');
  // 树干 (白桦为白干黑斑)
  rect(g, 11, 15, 3, 7, sp.trunk); rect(g, 13, 15, 1, 7, shade(sp.trunk === '#ECEFF1' ? '#B0BEC5' : sp.trunk, 0.65));
  px(g, 10, 21, sp.trunk); px(g, 14, 21, sp.trunk); // 根脚
  if (sp.trunk === '#ECEFF1') { px(g, 11, 17, D); px(g, 13, 19, D); px(g, 11, 20, D); }
  // 树冠 (按树形)
  if (sp.shape === 'pine') {
    const tiers: [number, number, number][] = [[11, 2, 2], [9, 6, 6], [7, 10, 10], [5, 13, 14]];
    for (const [x, y, w] of tiers) { rect(g, x, y, w, 3, sp.crown); rect(g, x, y, w, 1, light); rect(g, x, y + 2, w, 1, dark); }
    px(g, 11, 1, light); px(g, 12, 1, sp.crown);
  } else if (sp.shape === 'column') {
    rect(g, 9, 3, 6, 14, sp.crown); rect(g, 10, 2, 4, 2, sp.crown); rect(g, 9, 3, 2, 14, light); rect(g, 13, 5, 2, 12, dark); px(g, 11, 1, light);
  } else if (sp.shape === 'oval') {
    blob(g, 12, 8, 6, 7, sp.crown);
  } else if (sp.shape === 'vase') {
    blob(g, 8, 7, 4, 5, sp.crown); blob(g, 16, 7, 4, 5, sp.crown); blob(g, 12, 5, 4, 4, light);
  } else { // round
    blob(g, 12, 8, 8, 6, sp.crown); px(g, 7, 5, light); px(g, 16, 11, dark);
    if (speciesIdx === 5) { px(g, 8, 9, '#D7A86E'); px(g, 15, 7, '#D7A86E'); px(g, 12, 11, '#D7A86E'); } // 板栗果点
    if (speciesIdx === 3) { px(g, 8, 10, '#FFAB91'); px(g, 17, 8, '#FF7043'); } // 枫香亮叶
  }
  // 受损: 斧痕裂纹 + 泛黄叶 + 落叶 (hits 1~2)
  if (hits >= 1) {
    px(g, 10, 18, '#EFEBE9'); px(g, 11, 19, '#D7CCC8'); px(g, 10, 19, '#8D6E63'); // 斧口白茬
    px(g, 8, 6, '#FFD54F'); px(g, 15, 9, '#FFCA28'); px(g, 5, 19, '#FFD54F');
  }
  if (hits >= 2) {
    px(g, 10, 17, '#EFEBE9'); px(g, 12, 20, '#D7CCC8'); px(g, 11, 18, D);
    px(g, 7, 10, '#FFB300'); px(g, 16, 6, '#FFB300'); px(g, 13, 12, '#FFCA28'); px(g, 18, 18, '#FFD54F'); px(g, 4, 20, '#FFCA28');
  }
  return render(g, 'qh-tree-svg qh-pixel');
}

/** 像素树桩: 年轮切面 + 根脚 + 旁生新芽 */
export function stumpSvg(): string {
  const g = grid(24, 24);
  rect(g, 4, 22, 16, 1, '#689F38'); px(g, 3, 21, '#558B2F'); px(g, 20, 21, '#558B2F'); px(g, 6, 21, '#7CB342'); px(g, 17, 21, '#7CB342');
  rect(g, 8, 13, 8, 8, '#8D5524'); rect(g, 8, 13, 8, 2, '#A1662F'); rect(g, 14, 15, 2, 6, '#6D3410');
  rect(g, 7, 20, 3, 2, '#8D5524'); rect(g, 14, 20, 3, 2, '#8D5524'); // 根脚
  // 年轮切面
  rect(g, 8, 10, 8, 3, '#E8C88F'); rect(g, 9, 9, 6, 1, '#E8C88F'); rect(g, 10, 10, 4, 2, '#D7A86E'); px(g, 11, 10, '#8D5524'); px(g, 12, 11, '#B08954');
  // 旁生新芽
  px(g, 17, 18, '#558B2F'); px(g, 18, 17, '#7CB342'); px(g, 17, 19, '#33691E'); rect(g, 17, 19, 1, 3, '#558B2F');
  return render(g, 'qh-tree-svg qh-pixel');
}

/* ---------------- 稀有度像素徽章 (5 档: 普通/优良/稀有/史诗/传说) ---------------- */
const RARITY_PIXEL = ['#A1887F', '#66BB6A', '#42A5F5', '#AB47BC', '#FFB300'];
/** 稀有度像素奖章: 档位越高宝石越大、两侧羽翼与顶部王冠逐级增加; 下方双色绶带 */
export function rarityBadgeSvg(tier: number): string {
  const t = Math.min(4, Math.max(0, tier));
  const g = grid(16, 16); const c = RARITY_PIXEL[t]; const dark = shade(c, 0.55); const light = shade(c, 1.45);
  // 绶带
  rect(g, 5, 11, 2, 4, t >= 2 ? '#5C6BC0' : '#8D6E63'); rect(g, 9, 11, 2, 4, t >= 2 ? '#EF5350' : '#A1887F');
  // 奖章主体 (随档位增大)
  const r = 2 + Math.ceil(t / 2);
  blob(g, 8, 7, r, r, c);
  px(g, 7, 5, '#FFFFFF'); if (t >= 1) px(g, 8, 5, light);
  if (t >= 2) { px(g, 3, 6, dark); px(g, 12, 6, dark); px(g, 3, 7, c); px(g, 12, 7, c); } // 羽翼
  if (t >= 3) { px(g, 2, 5, light); px(g, 13, 5, light); px(g, 8, 2, light); }
  if (t >= 4) { rect(g, 6, 0, 1, 2, '#FFD54F'); rect(g, 9, 0, 1, 2, '#FFD54F'); rect(g, 7, 1, 2, 1, '#FFD54F'); px(g, 8, 0, '#FFF9C4'); } // 王冠
  return render(g, 'qh-rarity-icon qh-pixel');
}

/* ---------------- UI 像素图标 (替代 Emoji) ---------------- */
export type UiIconName = string;
export function uiIconSvg(name: UiIconName): string {
  const g = grid(16, 16);
  const heart = (fill: string) => { rect(g, 3, 4, 4, 3, fill); rect(g, 9, 4, 4, 3, fill); rect(g, 3, 7, 10, 2, fill); rect(g, 4, 9, 8, 2, fill); rect(g, 6, 11, 4, 2, fill); px(g, 8, 13, fill); px(g, 4, 5, '#FFFFFF'); };
  switch (name) {
    case 'heart': heart('#E53935'); break;
    case 'heart_empty': heart('#5A4632'); rect(g, 4, 5, 8, 6, '#2E2118'); rect(g, 6, 11, 4, 1, '#2E2118'); break;
    case 'heart_broken': heart('#B71C1C'); px(g, 8, 5, '#2B1B0E'); px(g, 7, 7, '#2B1B0E'); px(g, 8, 9, '#2B1B0E'); px(g, 7, 11, '#2B1B0E'); break;
    case 'star': case 'buff_fertile': rect(g, 7, 2, 2, 12, '#FFD54F'); rect(g, 3, 6, 10, 2, '#FFD54F'); px(g, 4, 4, '#FFD54F'); px(g, 11, 4, '#FFD54F'); px(g, 5, 11, '#FFD54F'); px(g, 10, 11, '#FFD54F'); px(g, 7, 6, '#FFF9C4'); break;
    case 'sparkle': px(g, 8, 2, '#FFD54F'); rect(g, 7, 4, 2, 8, '#FFD54F'); rect(g, 4, 7, 8, 2, '#FFE082'); px(g, 3, 3, '#FFF59D'); px(g, 12, 11, '#FFF59D'); break;
    case 'pin': blob(g, 8, 7, 4, 5, '#E53935'); px(g, 8, 13, '#B71C1C'); px(g, 8, 14, '#B71C1C'); blob(g, 8, 6, 2, 2, '#FFFFFF'); break;
    case 'sun': blob(g, 8, 8, 4, 4, '#FFD54F'); [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]].forEach(([x, y]) => px(g, x, y, '#FB8C00')); break;
    case 'rain': blob(g, 7, 6, 5, 3, '#90CAF9'); px(g, 4, 11, '#42A5F5'); px(g, 7, 13, '#42A5F5'); px(g, 10, 11, '#42A5F5'); px(g, 12, 13, '#42A5F5'); break;
    case 'storm': blob(g, 7, 5, 5, 3, '#78909C'); rect(g, 8, 8, 2, 3, '#FFD54F'); px(g, 7, 11, '#FFD54F'); px(g, 8, 11, '#FFD54F'); px(g, 6, 13, '#FFD54F'); break;
    case 'snow': blob(g, 7, 6, 5, 3, '#ECEFF1'); px(g, 4, 11, '#FFFFFF'); px(g, 8, 13, '#FFFFFF'); px(g, 11, 11, '#FFFFFF'); break;
    case 'clinic': rect(g, 3, 3, 10, 10, '#FFFFFF'); rect(g, 7, 5, 2, 6, '#E53935'); rect(g, 6, 7, 4, 2, '#E53935'); break;
    case 'chest': case 'gift': rect(g, 3, 6, 10, 7, '#8D5524'); rect(g, 3, 5, 10, 2, '#A1662F'); rect(g, 7, 5, 2, 8, '#FFD54F'); px(g, 8, 9, D); if (name === 'gift') { px(g, 8, 2, '#E53935'); px(g, 6, 3, '#E53935'); px(g, 10, 3, '#E53935'); } break;
    case 'shield': rect(g, 4, 2, 8, 8, '#90A4AE'); rect(g, 5, 10, 6, 2, '#90A4AE'); px(g, 8, 13, '#607D8B'); px(g, 6, 5, '#E1F5FE'); px(g, 7, 6, '#E1F5FE'); break;
    case 'wave': rect(g, 1, 7, 3, 2, '#42A5F5'); rect(g, 5, 5, 3, 2, '#42A5F5'); rect(g, 9, 7, 3, 2, '#42A5F5'); rect(g, 3, 10, 3, 2, '#90CAF9'); rect(g, 10, 12, 3, 2, '#90CAF9'); break;
    case 'bubble': blob(g, 6, 7, 3, 3, '#B3E5FC'); blob(g, 11, 10, 2, 2, '#B3E5FC'); px(g, 5, 5, '#FFFFFF'); break;
    case 'question': rect(g, 6, 3, 4, 2, '#FFD54F'); px(g, 10, 5, '#FFD54F'); rect(g, 7, 7, 2, 3, '#FFD54F'); px(g, 7, 12, '#FFD54F'); px(g, 8, 12, '#FFD54F'); break;
    case 'fish': paintFish(g, '#42A5F5', 1); break;
    case 'tree': rect(g, 7, 9, 2, 5, '#6D4C41'); blob(g, 8, 6, 5, 4, '#43A047'); px(g, 5, 4, '#A5D6A7'); break;
    case 'check': px(g, 3, 8, '#66BB6A'); px(g, 4, 9, '#66BB6A'); px(g, 5, 10, '#66BB6A'); px(g, 6, 11, '#66BB6A'); px(g, 7, 10, '#66BB6A'); px(g, 9, 8, '#66BB6A'); px(g, 11, 6, '#66BB6A'); px(g, 12, 4, '#66BB6A'); px(g, 12, 5, '#A5D6A7'); break;
    case 'bouquet': return itemIconSvg('bouquet');
    case 'ring': blob(g, 8, 9, 4, 4, '#FFD54F'); rect(g, 5, 6, 6, 6, ''); blob(g, 8, 4, 2, 2, '#80DEEA'); break;
    case 'bell': rect(g, 6, 4, 4, 6, '#FFD54F'); rect(g, 4, 10, 8, 2, '#FFB300'); px(g, 8, 13, '#8D6E63'); px(g, 8, 2, '#B8860B'); break;
    case 'cake': rect(g, 3, 9, 10, 5, '#F8BBD0'); rect(g, 3, 9, 10, 1, '#FFFFFF'); px(g, 8, 5, '#FF5252'); rect(g, 7, 6, 2, 3, '#FFF9C4'); break;
    case 'fire': blob(g, 8, 9, 4, 5, '#FF7043'); blob(g, 8, 11, 2, 3, '#FFD54F'); px(g, 8, 3, '#FF3D00'); break;
    case 'candle': rect(g, 7, 9, 2, 5, '#558B2F'); blob(g, 8, 6, 4, 4, '#FFD54F'); blob(g, 8, 6, 2, 2, '#6D4C41'); break;
    case 'map': rect(g, 3, 4, 10, 9, '#EFEBE9'); rect(g, 5, 6, 3, 2, '#A5D6A7'); px(g, 10, 8, '#E53935'); px(g, 11, 10, '#8D6E63'); px(g, 9, 11, '#8D6E63'); break;
    case 'wrench': rect(g, 4, 11, 7, 3, '#90A4AE'); px(g, 11, 10, '#90A4AE'); blob(g, 12, 6, 3, 3, '#B0BEC5'); px(g, 12, 4, '#37474F'); break;
    case 'bag': rect(g, 4, 6, 8, 8, '#8D5524'); rect(g, 6, 3, 4, 3, '#6D4C41'); rect(g, 4, 9, 8, 1, '#FFD54F'); break;
    case 'chat': rect(g, 3, 3, 10, 7, '#FFFFFF'); px(g, 5, 12, '#FFFFFF'); px(g, 4, 11, '#FFFFFF'); rect(g, 5, 6, 6, 1, '#90A4AE'); break;
    case 'building': rect(g, 4, 5, 8, 9, '#BCAAA4'); rect(g, 3, 4, 10, 2, '#8D6E63'); rect(g, 7, 10, 2, 4, '#5D4037'); px(g, 6, 8, '#FFF59D'); px(g, 10, 8, '#FFF59D'); break;
    case 'warning': for (let i = 0; i < 7; i++) rect(g, 8 - i, 3 + i, i * 2 + 1, 1, '#FFD54F'); rect(g, 7, 7, 2, 4, D); px(g, 7, 12, D); px(g, 8, 12, D); break;
    case 'scissors': px(g, 4, 4, '#B0BEC5'); px(g, 5, 5, '#B0BEC5'); px(g, 11, 11, '#B0BEC5'); px(g, 10, 10, '#B0BEC5'); px(g, 11, 4, '#B0BEC5'); px(g, 10, 5, '#B0BEC5'); px(g, 4, 11, '#B0BEC5'); px(g, 5, 10, '#B0BEC5'); blob(g, 4, 12, 1, 1, '#E53935'); blob(g, 4, 3, 1, 1, '#E53935'); break;
    case 'axe': return toolIconSvg('axe', 0);
    case 'hand': rect(g, 5, 6, 6, 7, '#FFCC80'); rect(g, 5, 3, 1, 4, '#FFCC80'); rect(g, 7, 2, 1, 4, '#FFCC80'); rect(g, 9, 3, 1, 4, '#FFCC80'); break;
    case 'note': rect(g, 10, 3, 2, 8, '#FFD54F'); blob(g, 8, 11, 3, 2, '#FFD54F'); break;
    case 'drop': blob(g, 8, 9, 4, 5, '#42A5F5'); px(g, 8, 3, '#42A5F5'); px(g, 6, 8, '#BBDEFB'); break;
    case 'debuff_thirsty':
      // 干渴警告角标: 橙红镂空干瘪水滴 + 叹号 (避免与已浇水蓝水滴混淆)
      blob(g, 8, 9, 5, 5, '#BF360C'); blob(g, 8, 9, 3, 3, '#FFF3C4');
      px(g, 8, 2, '#BF360C'); px(g, 8, 3, '#FF7043');
      rect(g, 7, 6, 2, 4, '#D32F2F'); px(g, 7, 11, '#D32F2F'); px(g, 8, 11, '#D32F2F');
      break;
    case 'debuff_weeds': px(g, 4, 13, '#33691E'); px(g, 5, 10, '#558B2F'); px(g, 6, 13, '#33691E'); px(g, 9, 11, '#558B2F'); px(g, 11, 13, '#33691E'); px(g, 12, 9, '#7CB342'); rect(g, 3, 14, 10, 1, '#33691E'); break;
    case 'debuff_wilted': blob(g, 8, 7, 4, 4, '#8D6E63'); px(g, 8, 11, '#6D4C41'); px(g, 6, 13, '#795548'); px(g, 10, 13, '#795548'); px(g, 6, 6, D); px(g, 10, 6, D); break;
    case 'auto-clear': rect(g, 9, 2, 2, 8, '#8D6E63'); rect(g, 4, 10, 6, 4, '#B0BEC5'); rect(g, 4, 10, 6, 1, '#ECEFF1'); px(g, 3, 14, '#6D4C41'); px(g, 12, 13, '#6D4C41'); px(g, 10, 14, '#8D5524'); break;
    case 'auto-plant': rect(g, 7, 8, 2, 6, '#43A047'); px(g, 6, 6, '#66BB6A'); px(g, 9, 5, '#66BB6A'); px(g, 5, 5, '#81C784'); px(g, 10, 8, '#81C784'); rect(g, 5, 14, 6, 1, '#6D4C41'); px(g, 2, 10, '#42A5F5'); px(g, 13, 11, '#42A5F5'); break;
    case 'auto-harvest': rect(g, 7, 5, 2, 9, '#FB8C00'); px(g, 5, 3, '#FFD54F'); px(g, 10, 3, '#FFD54F'); px(g, 4, 6, '#FFD54F'); px(g, 11, 6, '#FFD54F'); px(g, 6, 9, '#FFE082'); px(g, 9, 9, '#FFE082'); rect(g, 4, 14, 8, 1, '#8D6E63'); break;
    case 'skill_farming': return cropGrowthSvg('parsnip', 30, { watered: true });
    case 'skill_foraging': return uiIconSvg('tree');
    case 'skill_fishing': return uiIconSvg('fish');
    case 'skill_mining': return toolIconSvg('pickaxe', 1);
    case 'skill_combat': return itemIconSvg('steel_sword');
    case 'lock': return tileGroundSvg('locked');
    default: blob(g, 8, 8, 5, 5, '#FFCA28'); px(g, 6, 6, '#FFFFFF'); break;
  }
  return render(g, 'qh-ui-icon qh-pixel');
}

/** 将任意像素网格压缩为 <g class="..."> 内的整数 <rect> 序列（用于多图层像素动画） */
function renderGroup(g: Grid, cls: string): string {
  const h = g.length;
  const w = g[0]?.length ?? 16;
  let out = '';
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const c = g[y][x];
      if (!c) {
        x++;
        continue;
      }
      let len = 1;
      while (x + len < w && g[y][x + len] === c) len++;
      out += `<rect x="${x}" y="${y}" width="${len}" height="1" fill="${c}"/>`;
      x += len;
    }
  }
  return `<g class="${cls}">${out}</g>`;
}

/** 八大「水脉与山谷试炼」24x24 高密像素勋章图标（绶带褶皱 + 双层阶梯金属斜切高光） */
export function medalIconSvg(medalId: string): string {
  const g = grid(24, 24);
  const paintMedalFrame = (ribbon: string, rim: string, core: string) => {
    // 顶部像素绶带褶皱
    rect(g, 7, 0, 10, 1, D);
    rect(g, 8, 1, 8, 4, ribbon);
    px(g, 7, 1, D); px(g, 16, 1, D);
    px(g, 8, 2, shade(ribbon, 1.3)); px(g, 9, 2, shade(ribbon, 1.15));
    px(g, 14, 2, shade(ribbon, 0.78)); px(g, 15, 2, shade(ribbon, 0.65));
    px(g, 8, 3, shade(ribbon, 0.85)); px(g, 15, 3, shade(ribbon, 1.2));
    rect(g, 10, 5, 4, 1, '#FFD54F'); px(g, 9, 5, '#FFF9C4'); px(g, 14, 5, '#C9A227');
    // 八角像素章体双层描边
    rect(g, 8, 6, 8, 1, D);
    rect(g, 5, 7, 14, 1, rim); px(g, 4, 7, D); px(g, 19, 7, D);
    rect(g, 4, 8, 16, 1, rim); px(g, 3, 8, D); px(g, 20, 8, D);
    rect(g, 3, 9, 18, 8, rim);
    rect(g, 2, 10, 1, 6, D); rect(g, 21, 10, 1, 6, D);
    rect(g, 4, 17, 16, 1, rim); px(g, 3, 17, D); px(g, 20, 17, D);
    rect(g, 5, 18, 14, 1, rim); px(g, 4, 18, D); px(g, 19, 18, D);
    rect(g, 8, 19, 8, 1, D);
    // 内盘 + 左上双层斜切高光
    rect(g, 6, 9, 12, 8, core);
    rect(g, 5, 10, 14, 6, core);
    px(g, 5, 8, '#FFFDE7'); px(g, 6, 8, '#FFF9C4'); px(g, 7, 8, '#FFF59D');
    px(g, 4, 9, '#FFFDE7'); px(g, 5, 9, '#FFF9C4');
    px(g, 4, 10, '#FFF59D');
    // 右下暗角
    px(g, 18, 15, shade(rim, 0.55)); px(g, 19, 14, shade(rim, 0.55));
    px(g, 17, 16, shade(core, 0.7));
  };

  switch (medalId) {
    case 'medal_creek':
      paintMedalFrame('#2E7D32', '#CD7F32', '#3E2723');
      rect(g, 8, 12, 7, 3, '#80DEEA');
      px(g, 7, 12, '#FFF9C4'); px(g, 15, 11, '#4DD0E1'); px(g, 15, 15, '#4DD0E1');
      px(g, 16, 12, '#80DEEA'); px(g, 16, 13, '#80DEEA'); px(g, 16, 14, '#80DEEA');
      px(g, 9, 12, D); px(g, 11, 10, '#69F0AE'); px(g, 12, 11, '#A5D6A7');
      break;
    case 'medal_river':
      paintMedalFrame('#1B5E20', '#2ECC71', '#0D3B26');
      rect(g, 7, 12, 8, 3, '#16A085');
      px(g, 8, 11, '#FFD23F'); px(g, 10, 11, '#FFD23F'); px(g, 12, 11, '#FFD23F');
      px(g, 15, 12, '#A3E4D7'); px(g, 16, 11, '#A3E4D7'); px(g, 16, 15, '#A3E4D7');
      rect(g, 7, 16, 4, 1, '#69F0AE'); rect(g, 13, 16, 4, 1, '#69F0AE');
      break;
    case 'medal_lake':
      paintMedalFrame('#4A148C', '#AB47BC', '#1A0933');
      rect(g, 8, 11, 3, 5, '#FFF59D'); px(g, 9, 10, '#FFF59D'); px(g, 9, 16, '#FFF59D');
      px(g, 14, 11, '#FFD23F'); rect(g, 13, 12, 4, 1, '#FFD23F'); px(g, 14, 13, '#FFD23F');
      px(g, 12, 14, '#00E5FF'); px(g, 15, 14, '#E1BEE7'); px(g, 11, 15, '#CE93D8');
      break;
    case 'medal_abyss':
      paintMedalFrame('#B71C1C', '#C0392B', '#1A0505');
      rect(g, 10, 10, 3, 7, '#E74C3C');
      px(g, 9, 11, '#FF8A80'); px(g, 13, 11, '#FF8A80');
      px(g, 8, 13, '#FF5252'); px(g, 14, 13, '#FF5252');
      px(g, 9, 15, '#FF8A80'); px(g, 13, 15, '#FF8A80');
      px(g, 11, 12, '#FFF9C4'); px(g, 11, 14, '#FFD23F');
      break;
    case 'medal_valley':
      paintMedalFrame('#F9A825', '#FFD54F', '#3E2723');
      rect(g, 10, 10, 4, 1, '#FFF9C4');
      px(g, 9, 11, '#FFD23F'); px(g, 14, 11, '#FFD23F');
      rect(g, 8, 12, 8, 1, '#FFC107');
      px(g, 9, 13, '#FFD23F'); px(g, 14, 13, '#FFD23F');
      rect(g, 10, 14, 4, 1, '#FFF9C4');
      px(g, 11, 15, '#69F0AE'); px(g, 12, 16, '#80DEEA');
      break;
    case 'medal_allkings':
      paintMedalFrame('#6A1B9A', '#FFD54F', '#1A0933');
      px(g, 8, 12, '#2ECC71'); px(g, 10, 11, '#16A085');
      px(g, 12, 12, '#AB47BC'); px(g, 14, 11, '#E74C3C');
      px(g, 9, 14, '#FFD23F'); px(g, 11, 15, '#FFF9C4'); px(g, 13, 14, '#FFD23F');
      px(g, 11, 13, '#00E5FF');
      break;
    case 'medal_season':
      paintMedalFrame('#1565C0', '#42A5F5', '#0D2137');
      rect(g, 8, 11, 2, 2, '#81C784');
      rect(g, 14, 11, 2, 2, '#FF8A65');
      rect(g, 8, 15, 2, 2, '#FFF176');
      rect(g, 14, 15, 2, 2, '#80DEEA');
      px(g, 11, 13, '#FFD23F'); px(g, 12, 14, '#FFF9C4');
      break;
    case 'medal_starvein':
      paintMedalFrame('#0D47A1', '#00BCD4', '#011018');
      px(g, 11, 10, '#FFF9C4');
      rect(g, 10, 12, 4, 1, '#00E5FF');
      px(g, 9, 13, '#4DD0E1'); px(g, 14, 13, '#4DD0E1');
      px(g, 8, 14, '#26C6DA'); px(g, 15, 14, '#26C6DA');
      px(g, 11, 15, '#80DEEA'); px(g, 12, 16, '#B2EBF2');
      break;
    default:
      paintMedalFrame('#607D8B', '#90A4AE', '#263238');
      rect(g, 10, 12, 4, 3, '#CFD8DC');
  }

  return render(g, 'qh-medal-svg');
}

/** 192x88 鱼王剧场分层像素网格（关节/环境），供 SVG 渲染与关节 PNG 导出同源使用 */
export function fishKingTheaterLayers(fishId: string): { w: number; h: number; layers: Record<string, Grid> } {
  const W = 192;
  const H = 88;
  const gBg = grid(W, H);
  const gSky = grid(W, H);
  const gFloraB = grid(W, H);
  const gFloraF = grid(W, H);
  const gCaustics = grid(W, H);
  const gWaveFar = grid(W, H);
  const gWaveMid = grid(W, H);
  const gWaveNear = grid(W, H);
  const gWakeU = grid(W, H);
  const gWakeD = grid(W, H);
  const gSplash = grid(W, H);
  // 9 joints
  const gHead = grid(W, H);
  const gBarbelU = grid(W, H);
  const gBarbelD = grid(W, H);
  const gTorsoF = grid(W, H);
  const gTorsoR = grid(W, H);
  const gDorsal = grid(W, H);
  const gPectoral = grid(W, H);
  const gPelvic = grid(W, H);
  const gTail = grid(W, H);

  const jointOf = (part: FishKingPart): Grid => {
    switch (part) {
      case 'head': return gHead;
      case 'barbel-u': return gBarbelU;
      case 'barbel-d': return gBarbelD;
      case 'torso-f': return gTorsoF;
      case 'torso-r': return gTorsoR;
      case 'dorsal': return gDorsal;
      case 'pectoral': return gPectoral;
      case 'pelvic': return gPelvic;
      case 'tail': return gTail;
    }
  };

  /** 将 24×24 鱼王母本 4×3 放大写入剧场关节层（接缝重叠 2px，阶梯补角） */
  const paintFishFromMaster = (master: FishKingMaster) => {
    const SX = 4;
    const SY = 3;
    const ox = 48;
    const oy = 14;
    const { colors, parts } = master;

    const solid = (x: number, y: number) => !!(y >= 0 && y < 24 && x >= 0 && x < 24 && colors[y][x]);

    for (let my = 0; my < 24; my++) {
      for (let mx = 0; mx < 24; mx++) {
        const c = colors[my][mx];
        const part = parts[my][mx];
        if (!c || !part) continue;
        const tx0 = ox + mx * SX;
        const ty0 = oy + my * SY;
        const primary = jointOf(part);
        // 主体块
        for (let dy = 0; dy < SY; dy++) for (let dx = 0; dx < SX; dx++) {
          px(primary, tx0 + dx, ty0 + dy, c);
        }
        // 躯干接缝重叠：torso-f 右缘写入 torso-r，head 右缘写入 torso-f，torso-r 右缘写入 tail
        if (part === 'torso-f') {
          for (let dy = 0; dy < SY; dy++) for (let dx = SX - 2; dx < SX; dx++) {
            px(gTorsoR, tx0 + dx, ty0 + dy, c);
          }
        } else if (part === 'head' && mx >= 6) {
          for (let dy = 0; dy < SY; dy++) for (let dx = SX - 2; dx < SX; dx++) {
            px(gTorsoF, tx0 + dx, ty0 + dy, c);
          }
        } else if (part === 'torso-r' && mx >= 15) {
          for (let dy = 0; dy < SY; dy++) for (let dx = SX - 2; dx < SX; dx++) {
            px(gTail, tx0 + dx, ty0 + dy, c);
          }
        }
        // 1px 阶梯补角：邻空对角时在放大块外侧补描边阶梯
        const outline = c === D ? c : shade(c, 0.72);
        if (!solid(mx - 1, my) && solid(mx, my - 1)) {
          px(primary, tx0 - 1, ty0, outline);
        }
        if (!solid(mx + 1, my) && solid(mx, my - 1)) {
          px(primary, tx0 + SX, ty0, outline);
        }
        if (!solid(mx - 1, my) && solid(mx, my + 1)) {
          px(primary, tx0 - 1, ty0 + SY - 1, outline);
        }
        if (!solid(mx + 1, my) && solid(mx, my + 1)) {
          px(primary, tx0 + SX, ty0 + SY - 1, outline);
        }
      }
    }
  };

  // —— 环境层：远景水底 ——
  rect(gBg, 0, 0, W, H, '#021018');
  rect(gBg, 0, 48, W, 40, '#031A22');
  for (let x = 0; x < W; x += 8) {
    px(gBg, x + 2, 72, '#0A2A32');
    px(gBg, x + 5, 78, '#0D3340');
    px(gBg, x + 1, 84, '#082028');
  }

  // 天空/水面上方微光
  for (let i = 0; i < 12; i++) {
    px(gSky, 16 + i * 14, 4 + (i % 3), i % 2 ? '#1A3A4A' : '#0E2836');
  }
  px(gSky, 40, 8, '#FFF9C4'); px(gSky, 88, 6, '#80DEEA'); px(gSky, 140, 9, '#CE93D8');

  // 远近三层水面波浪
  for (let x = 0; x < W; x++) {
    const yFar = 18 + ((x >> 3) % 2);
    px(gWaveFar, x, yFar, '#0E4A5A');
    if (x % 5 === 0) px(gWaveFar, x, yFar - 1, '#1A6A7A');
  }
  for (let x = 0; x < W; x++) {
    const yMid = 22 + ((x >> 2) % 3 === 0 ? 1 : 0);
    px(gWaveMid, x, yMid, '#1488A0');
    if (x % 4 === 0) px(gWaveMid, x, yMid - 1, '#E0F7FA');
  }
  for (let x = 0; x < W; x++) {
    const yNear = 26 + ((x >> 1) % 2);
    px(gWaveNear, x, yNear, '#26C6DA');
    if (x % 3 === 0) px(gWaveNear, x, yNear - 1, '#FFFFFF');
    if (x % 7 === 0) px(gWaveNear, x, yNear + 1, '#B2EBF2');
  }

  // 水下焦散光斑
  for (let i = 0; i < 18; i++) {
    const cx = 10 + i * 10;
    const cy = 52 + (i % 4) * 6;
    px(gCaustics, cx, cy, '#1DE9B6');
    px(gCaustics, cx + 1, cy, '#64FFDA');
    px(gCaustics, cx + 2, cy + 1, '#A7FFEB');
    if (i % 3 === 0) px(gCaustics, cx + 1, cy - 1, '#E0F2F1');
  }

  // 分层水草 / 气根 / 珊瑚
  for (let i = 0; i < 8; i++) {
    const bx = 8 + i * 24;
    rect(gFloraB, bx, 60, 1, 20, '#1B5E20');
    px(gFloraB, bx - 1, 62, '#2E7D32'); px(gFloraB, bx + 1, 66, '#388E3C');
    px(gFloraB, bx - 1, 70, '#43A047'); px(gFloraB, bx + 1, 74, '#66BB6A');
  }
  for (let i = 0; i < 6; i++) {
    const fx = 20 + i * 28;
    rect(gFloraF, fx, 55, 1, 24, '#00695C');
    px(gFloraF, fx + 1, 58, '#00897B'); px(gFloraF, fx - 1, 64, '#26A69A');
    px(gFloraF, fx + 1, 70, '#4DB6AC'); px(gFloraF, fx - 1, 76, '#80CBC4');
  }

  // 尾流双排涡街气泡（跟在尾后）
  for (let i = 0; i < 12; i++) {
    const wx = 148 + i * 3;
    px(gWakeU, wx, 34 + (i % 3), '#B2EBF2');
    px(gWakeU, wx + 1, 33 + (i % 3), '#E0F7FA');
    px(gWakeD, wx + 2, 52 - (i % 3), '#4DD0E1');
    px(gWakeD, wx + 3, 53 - (i % 3), '#80DEEA');
  }

  // 破水卷浪与飞溅水珠
  rect(gSplash, 70, 20, 20, 2, '#E0F7FA');
  rect(gSplash, 72, 18, 16, 1, '#FFFFFF');
  for (let i = 0; i < 16; i++) {
    const dx = 60 + (i * 5) % 50;
    const dy = 12 + (i * 3) % 14;
    px(gSplash, dx, dy, i % 2 ? '#FFFFFF' : '#B2EBF2');
  }
  rect(gSplash, 55, 24, 8, 2, '#4DD0E1');
  rect(gSplash, 100, 24, 8, 2, '#4DD0E1');
  px(gSplash, 54, 23, '#FFFFFF'); px(gSplash, 108, 23, '#FFFFFF');

  // 剧场鱼 = 24×24 图标母本放大（与下方详情图标同一条鱼）
  const master = fishKing24Master(fishId) ?? fishKing24Master('legend');
  if (master) paintFishFromMaster(master);

  return {
    w: W,
    h: H,
    layers: {
      'fk-env-bg': gBg,
      'fk-env-sky': gSky,
      'fk-env-flora-b': gFloraB,
      'fk-env-caustics': gCaustics,
      'fk-env-wave-far': gWaveFar,
      'fk-env-wave-mid': gWaveMid,
      'fk-env-wave-near': gWaveNear,
      'fk-env-flora-f': gFloraF,
      'fk-env-wake-u': gWakeU,
      'fk-env-wake-d': gWakeD,
      'fk-part-tail': gTail,
      'fk-part-torso-r': gTorsoR,
      'fk-part-dorsal': gDorsal,
      'fk-part-pelvic': gPelvic,
      'fk-part-torso-f': gTorsoF,
      'fk-part-pectoral': gPectoral,
      'fk-part-head': gHead,
      'fk-part-barbel-u': gBarbelU,
      'fk-part-barbel-d': gBarbelD,
      'fk-env-splash': gSplash,
    },
  };
}

/** 192x88 超高密鱼王剧场：9 关节像素骨骼链 + 四层水动力学环境（与 fishKingTheaterLayers 同源） */
export function fishKingTheaterSvg(fishId: string): string {
  const { w: W, h: H, layers } = fishKingTheaterLayers(fishId);
  return `<svg class="fishking-stage-svg qh-pixel" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
    ${renderGroup(layers['fk-env-bg'], 'fk-env-bg')}
    ${renderGroup(layers['fk-env-sky'], 'fk-env-sky')}
    ${renderGroup(layers['fk-env-flora-b'], 'fk-env-flora-b')}
    ${renderGroup(layers['fk-env-caustics'], 'fk-env-caustics')}
    ${renderGroup(layers['fk-env-wave-far'], 'fk-env-wave-far')}
    ${renderGroup(layers['fk-env-wave-mid'], 'fk-env-wave-mid')}
    ${renderGroup(layers['fk-env-wave-near'], 'fk-env-wave-near')}
    ${renderGroup(layers['fk-env-flora-f'], 'fk-env-flora-f')}
    ${renderGroup(layers['fk-env-wake-u'], 'fk-env-wake-u')}
    ${renderGroup(layers['fk-env-wake-d'], 'fk-env-wake-d')}
    <g class="fk-fish-group">
      ${renderGroup(layers['fk-part-tail'], 'fk-part-tail')}
      ${renderGroup(layers['fk-part-torso-r'], 'fk-part-torso-r')}
      ${renderGroup(layers['fk-part-dorsal'], 'fk-part-dorsal')}
      ${renderGroup(layers['fk-part-pelvic'], 'fk-part-pelvic')}
      ${renderGroup(layers['fk-part-torso-f'], 'fk-part-torso-f')}
      ${renderGroup(layers['fk-part-pectoral'], 'fk-part-pectoral')}
      ${renderGroup(layers['fk-part-head'], 'fk-part-head')}
      ${renderGroup(layers['fk-part-barbel-u'], 'fk-part-barbel-u')}
      ${renderGroup(layers['fk-part-barbel-d'], 'fk-part-barbel-d')}
    </g>
    ${renderGroup(layers['fk-env-splash'], 'fk-env-splash')}
  </svg>`;
}


/** 世界地图 14 地点在 256×144 像素画布上的坐标（百分比用于 HTML 交互锚点） */
export const WORLD_MAP_PINS: Record<string, { x: number; y: number; vein: 'core' | 'river' | 'lake' | 'ocean'; tier?: number }> = {
  // 山谷核心圈
  farm: { x: 46, y: 60, vein: 'core' },
  town: { x: 118, y: 66, vein: 'core' },
  mountain: { x: 118, y: 38, vein: 'lake', tier: 1 },
  forest: { x: 48, y: 92, vein: 'river', tier: 1 },
  beach: { x: 118, y: 100, vein: 'ocean', tier: 1 },
  // 森林河脉 T2-T4
  egret_river: { x: 82, y: 92, vein: 'river', tier: 2 },
  emerald_rapids: { x: 46, y: 118, vein: 'river', tier: 3 },
  ancient_river: { x: 18, y: 124, vein: 'river', tier: 4 },
  // 高山湖脉 T2-T4
  mirror_lake: { x: 158, y: 36, vein: 'lake', tier: 2 },
  mist_lake: { x: 194, y: 28, vein: 'lake', tier: 3 },
  starfall_lake: { x: 228, y: 20, vein: 'lake', tier: 4 },
  // 南洋海脉 T2-T4
  crescent_bay: { x: 156, y: 108, vein: 'ocean', tier: 2 },
  coral_reef: { x: 196, y: 118, vein: 'ocean', tier: 3 },
  abyssal_sea: { x: 234, y: 128, vein: 'ocean', tier: 4 },
};

/** 256×144《青禾谷星脉全图》精细像素底图分层（供游戏内 SVG 与 Craft 导出同源使用） */
export function worldMapPixelLayers(opts?: { hasMinecart?: boolean; hasGreenhouse?: boolean }): {
  w: number;
  h: number;
  layers: Record<string, Grid>;
} {
  const W = 256;
  const H = 144;
  const gTerrain = grid(W, H);
  const gWater = grid(W, H);
  const gFlora = grid(W, H);
  const gRails = grid(W, H);
  const gLandmarks = grid(W, H);
  const gVeins = grid(W, H);
  const gFrame = grid(W, H);

  const hasMinecart = !!opts?.hasMinecart;
  const hasGreenhouse = opts?.hasGreenhouse ?? true;

  const pLine = (g: Grid, x0: number, y0: number, x1: number, y1: number, c: string, thick = 1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      rect(g, x, y, thick, thick, c);
    }
  };

  const pDisc = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: string, edge?: string) => {
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        const d = (dx * dx) / Math.max(1, rx * rx) + (dy * dy) / Math.max(1, ry * ry);
        if (d <= 1) {
          px(g, cx + dx, cy + dy, edge && d > 0.72 ? edge : c);
        }
      }
    }
  };

  // 1) 地形基底：北山岩脉 → 中部青禾草甸 → 西南深林 → 南岸沙滩 → 南洋三阶海域
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const coastY = 96 + Math.round(Math.sin(x * 0.045) * 4) + (x > 165 ? Math.round((x - 165) * 0.12) : 0);
      const mtnY = 44 - (x > 140 ? Math.round((x - 140) * 0.08) : 0) + Math.round(Math.cos(x * 0.07) * 3);
      if (y < mtnY) {
        // 北山高地与玄武岩阶梯
        const dither = (x + y) % 2 === 0;
        const c = y < 16 ? (dither ? '#37474F' : '#455A64') : y < 30 ? (dither ? '#4E342E' : '#5D4037') : (dither ? '#6D4C41' : '#795548');
        px(gTerrain, x, y, c);
      } else if (y < coastY) {
        // 陆地草甸：西林偏深翠，中谷偏嫩绿，农庄周边暖土
        const inWestWoods = x < 78 && y > 74;
        const dither = (x * 3 + y * 5) % 7 === 0;
        if (inWestWoods) {
          px(gTerrain, x, y, dither ? '#1B5E20' : '#2E7D32');
        } else {
          px(gTerrain, x, y, dither ? '#558B2F' : '#689F38');
        }
      } else if (y < coastY + 7) {
        // 金色潮间带沙滩 + 像素贝壳点缀
        px(gTerrain, x, y, (x + y) % 3 === 0 ? '#FFE082' : '#FFD54F');
      } else {
        // 南洋浅海 → 外礁 → 无光深海海沟
        const depth = y - (coastY + 7) + (x > 170 ? (x - 170) >> 2 : 0);
        const c = depth < 10 ? '#26C6DA' : depth < 22 ? '#0288D1' : depth < 34 ? '#1565C0' : '#0A192F';
        px(gTerrain, x, y, c);
      }
    }
  }

  // 北山立体山峰群与雪顶/星陨紫晶山脊
  const peaks: [number, number, number, boolean][] = [
    [28, 34, 18, false], [62, 32, 20, false], [98, 30, 22, false],
    [134, 28, 20, false], [172, 24, 22, true], [206, 20, 24, true], [236, 18, 20, true],
  ];
  for (const [px0, baseY, h, starTint] of peaks) {
    for (let row = 0; row < h; row++) {
      const y = baseY - row;
      const half = Math.max(1, h - row);
      for (let dx = -half; dx <= half; dx++) {
        const isEdge = Math.abs(dx) === half;
        const isSnow = row > h * 0.68;
        const c = isEdge
          ? D
          : isSnow
            ? (starTint ? '#E1BEE7' : '#ECEFF1')
            : dx < 0
              ? (starTint ? '#5E35B1' : '#78909C')
              : (starTint ? '#4527A0' : '#546E7A');
        px(gTerrain, px0 + dx, y, c);
      }
    }
  }

  // 2) 水系层：星陨天池 → 寒雾深湖 → 镜月湖 → 山麓湖岸 → 白鹭河 → 青禾溪 → 翠谷急流 → 古木秘河
  // 高山湖脉四湖
  pDisc(gWater, 228, 20, 14, 7, '#7B1FA2', '#CE93D8'); // 星陨湖（紫金陨星坑）
  pDisc(gWater, 228, 20, 9, 4, '#AB47BC');
  px(gWater, 225, 19, '#FFD23F'); px(gWater, 231, 21, '#00E5FF');
  pDisc(gWater, 194, 28, 12, 6, '#1565C0', '#80DEEA'); // 寒雾深湖
  pDisc(gWater, 158, 36, 11, 5, '#0288D1', '#B3E5FC'); // 镜月湖
  pDisc(gWater, 118, 38, 10, 5, '#26C6DA', '#E0F7FA'); // 山麓湖岸
  // 高山湖脉溪流连线
  pLine(gWater, 216, 22, 204, 27, '#80DEEA', 2);
  pLine(gWater, 182, 30, 168, 35, '#4FC3F7', 2);
  pLine(gWater, 147, 37, 128, 38, '#29B6F6', 2);

  // 森林河脉主河道（自山麓湖岸南下经白鹭河、青禾溪、翠谷急流至古木秘河）
  const riverPts: [number, number][] = [
    [114, 42], [102, 58], [92, 76], [82, 92], [48, 92], [46, 118], [18, 124],
  ];
  for (let i = 0; i < riverPts.length - 1; i++) {
    const [x0, y0] = riverPts[i];
    const [x1, y1] = riverPts[i + 1];
    pLine(gWater, x0, y0, x1, y1, '#00ACC1', 4);
    pLine(gWater, x0, y0, x1, y1, '#4DD0E1', 2);
  }
  // 翠谷急流白沫 & 古木秘河幽绿秘潭
  for (let i = 0; i < 6; i++) px(gWater, 44 + i * 2, 114 + (i % 2), '#FFFFFF');
  pDisc(gWater, 18, 124, 11, 6, '#004D40', '#2ECC71');
  pDisc(gWater, 18, 124, 7, 3, '#00695C');
  px(gWater, 16, 123, '#69F0AE'); px(gWater, 20, 125, '#FFD23F');

  // 南洋海脉：月牙海湾、珊瑚外礁、无光深海海沟漩涡 + 白色浪花线
  for (let x = 8; x < W - 8; x += 6) {
    const wy = 104 + Math.round(Math.sin(x * 0.045) * 4) + (x > 165 ? Math.round((x - 165) * 0.12) : 0);
    rect(gWater, x, wy, 3, 1, '#E0F7FA');
  }
  // 珊瑚外礁彩簇
  for (const [cx, cy, col] of [[190, 116, '#FF7043'], [198, 120, '#EC407A'], [204, 117, '#AB47BC'], [194, 122, '#26A69A']] as [number, number, string][]) {
    rect(gWater, cx, cy, 3, 2, col); px(gWater, cx + 1, cy - 1, '#FFF9C4');
  }
  // 无光深海暗渊漩涡
  pDisc(gWater, 234, 128, 14, 7, '#040C18', '#1565C0');
  pDisc(gWater, 234, 128, 8, 4, '#1A0933');
  px(gWater, 231, 127, '#FF1744'); px(gWater, 237, 129, '#00E5FF');

  // 农庄至小镇、森林、山区、海滩的乡间石板与木桥路径
  pLine(gTerrain, 46, 60, 118, 66, '#D7CCC8', 3); // 农场 ↔ 小镇
  pLine(gTerrain, 118, 66, 118, 38, '#BCAAA4', 2); // 小镇 ↔ 山区
  pLine(gTerrain, 118, 66, 118, 100, '#D7CCC8', 2); // 小镇 ↔ 海滩
  pLine(gTerrain, 46, 60, 48, 92, '#A1887F', 2); // 农场 ↔ 森林
  // 跨河小木桥
  rect(gLandmarks, 90, 62, 6, 4, '#8D6E63');
  rect(gLandmarks, 90, 61, 6, 1, D); rect(gLandmarks, 90, 66, 6, 1, D);

  // 3) 森林植被层：西南八株古树、古木秘河盘根巨木、各处像素松林
  const paintPine = (tx: number, ty: number, crown: string, hi: string) => {
    rect(gFlora, tx, ty + 4, 2, 3, '#5D4037');
    rect(gFlora, tx - 3, ty + 2, 8, 2, crown);
    rect(gFlora, tx - 2, ty, 6, 2, crown);
    rect(gFlora, tx - 1, ty - 2, 4, 2, hi);
    px(gFlora, tx, ty - 3, hi);
  };
  for (const [tx, ty] of [
    [16, 78], [26, 82], [34, 76], [60, 82], [68, 88],
    [14, 98], [28, 102], [62, 102], [30, 110], [60, 114],
  ]) {
    paintPine(tx, ty, '#1B5E20', '#43A047');
  }
  // 古木秘河千年巨树王
  rect(gFlora, 12, 112, 4, 7, '#4E342E');
  pDisc(gFlora, 14, 109, 7, 5, '#004D40', '#69F0AE');
  // 山林松树
  for (const [tx, ty] of [[84, 44], [142, 46], [174, 44], [208, 40]]) {
    paintPine(tx, ty, '#2E7D32', '#81C784');
  }

  // 4) 蒸汽矿车铁轨层（农场 ↔ 小镇 ↔ 山区 ↔ 海滩）
  const railColor = hasMinecart ? '#FFD23F' : '#6D4C41';
  const railTie = hasMinecart ? '#FFF9C4' : '#3E2723';
  const railPairs: [[number, number], [number, number]][] = [
    [[54, 54], [112, 42]],
    [[112, 42], [114, 64]],
    [[114, 64], [114, 96]],
  ];
  for (const [[x0, y0], [x1, y1]] of railPairs) {
    pLine(gRails, x0, y0, x1, y1, railColor, 1);
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s += 4) {
      const rx = Math.round(x0 + ((x1 - x0) * s) / steps);
      const ry = Math.round(y0 + ((y1 - y0) * s) / steps);
      px(gRails, rx, ry, railTie);
    }
  }

  // 5) 五大核心地标像素建筑
  // ① 西麓 · 你的农场（红顶木屋 + 6×4 像素农田畦 + 四季温室 + 荣誉架）
  rect(gLandmarks, 32, 50, 10, 7, '#D7CCC8'); // 木屋墙
  rect(gLandmarks, 30, 47, 14, 4, '#C62828'); // 红屋顶
  rect(gLandmarks, 31, 46, 12, 1, '#E53935');
  rect(gLandmarks, 36, 53, 3, 4, '#5D4037'); // 门
  rect(gLandmarks, 39, 44, 2, 3, '#78909C'); // 烟囱 + 炊烟
  px(gLandmarks, 40, 42, '#ECEFF1'); px(gLandmarks, 41, 40, '#FFFFFF');
  // 耕地与金色向日葵点缀
  rect(gLandmarks, 44, 54, 14, 9, '#6D4C41');
  for (let fy = 55; fy <= 61; fy += 2) {
    for (let fx = 45; fx <= 56; fx += 2) {
      px(gLandmarks, fx, fy, (fx + fy) % 4 === 0 ? '#FFD23F' : '#66BB6A');
    }
  }
  // 温室（已修亮蓝玻璃，未修暗木框）
  rect(gLandmarks, 20, 52, 9, 6, hasGreenhouse ? '#80DEEA' : '#5D4037');
  rect(gLandmarks, 20, 50, 9, 2, hasGreenhouse ? '#E0F7FA' : '#3E2723');

  // ② 中枢 · 白鹭镇广场（老井、钟楼社区中心、铁匠铺、杂货铺、白芷诊所）
  pDisc(gLandmarks, 118, 66, 14, 9, '#BCAAA4', '#8D6E63'); // 石板广场
  // 社区中心（北侧金顶钟楼）
  rect(gLandmarks, 113, 52, 10, 7, '#FFE082');
  rect(gLandmarks, 112, 49, 12, 3, '#1565C0');
  rect(gLandmarks, 117, 46, 2, 3, '#FFD23F');
  // 杂货铺（西侧绿檐）
  rect(gLandmarks, 102, 62, 8, 6, '#FFF8E1');
  rect(gLandmarks, 101, 60, 10, 2, '#2E7D32');
  // 铁匠铺（东侧暗红炉火）
  rect(gLandmarks, 126, 62, 8, 6, '#546E7A');
  rect(gLandmarks, 125, 60, 10, 2, '#BF360C');
  px(gLandmarks, 132, 58, '#FF6D00');
  // 白芷诊所（南侧青白十字）
  rect(gLandmarks, 104, 71, 7, 5, '#ECEFF1');
  rect(gLandmarks, 103, 69, 9, 2, '#26A69A');
  // 中心老井
  rect(gLandmarks, 117, 65, 3, 3, '#607D8B'); px(gLandmarks, 118, 66, '#29B6F6');

  // ③ 北山矿洞升降梯入口
  rect(gLandmarks, 104, 30, 8, 7, '#263238');
  rect(gLandmarks, 103, 29, 10, 2, '#8D6E63');
  rect(gLandmarks, 106, 32, 4, 5, '#091016');
  px(gLandmarks, 103, 32, '#FFD23F'); // 矿灯

  // ④ 南岸 · 白鹭海滩（老渔夫木屋、长栈桥码头、白色灯塔）
  rect(gLandmarks, 104, 94, 8, 5, '#8D6E63');
  rect(gLandmarks, 103, 92, 10, 2, '#0277BD'); // 老渔夫小屋
  rect(gLandmarks, 117, 98, 4, 12, '#A1887F'); // 栈桥码头
  for (let py = 99; py <= 109; py += 2) px(gLandmarks, 116, py, '#5D4037');
  // 灯塔
  rect(gLandmarks, 132, 90, 4, 10, '#ECEFF1');
  rect(gLandmarks, 132, 93, 4, 2, '#E53935');
  rect(gLandmarks, 132, 97, 4, 2, '#E53935');
  rect(gLandmarks, 131, 88, 6, 2, '#FFD23F');

  // 6) 三大星脉航路流光像素轨迹 & 14 节点底座像素环
  const veinPaths: { pts: [number, number][]; c: string; hi: string }[] = [
    { pts: [[48, 92], [82, 92], [46, 118], [18, 124]], c: '#2ECC71', hi: '#A5D6A7' },
    { pts: [[118, 38], [158, 36], [194, 28], [228, 20]], c: '#AB47BC', hi: '#FFD23F' },
    { pts: [[118, 100], [156, 108], [196, 118], [234, 128]], c: '#29B6F6', hi: '#80DEEA' },
  ];
  for (const vp of veinPaths) {
    for (let i = 0; i < vp.pts.length - 1; i++) {
      const [x0, y0] = vp.pts[i];
      const [x1, y1] = vp.pts[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let s = 0; s <= steps; s += 2) {
        const vx = Math.round(x0 + ((x1 - x0) * s) / steps);
        const vy = Math.round(y0 + ((y1 - y0) * s) / steps);
        px(gVeins, vx, vy, s % 4 === 0 ? vp.hi : vp.c);
      }
    }
  }
  for (const pin of Object.values(WORLD_MAP_PINS)) {
    const col =
      pin.vein === 'core' ? '#FFD23F' : pin.vein === 'river' ? '#2ECC71' : pin.vein === 'lake' ? '#CE93D8' : '#4FC3F7';
    rect(gVeins, pin.x - 2, pin.y - 2, 5, 5, D);
    rect(gVeins, pin.x - 1, pin.y - 1, 3, 3, col);
    px(gVeins, pin.x, pin.y, '#FFF9C4');
  }

  // 7) 羊皮卷金木像素边框 + 右上角像素罗盘星芒
  rect(gFrame, 0, 0, W, 2, D); rect(gFrame, 0, H - 2, W, 2, D);
  rect(gFrame, 0, 0, 2, H, D); rect(gFrame, W - 2, 0, 2, H, D);
  rect(gFrame, 2, 2, W - 4, 1, '#C9A227'); rect(gFrame, 2, H - 3, W - 4, 1, '#C9A227');
  rect(gFrame, 2, 2, 1, H - 4, '#C9A227'); rect(gFrame, W - 3, 2, 1, H - 4, '#C9A227');
  // 四角铆钉
  for (const [cx, cy] of [[4, 4], [W - 6, 4], [4, H - 6], [W - 6, H - 6]]) {
    rect(gFrame, cx, cy, 2, 2, '#FFD23F');
  }
  // 左上像素罗盘
  const rcx = 16; const rcy = 16;
  pDisc(gFrame, rcx, rcy, 7, 7, '#2B1B0E', '#C9A227');
  rect(gFrame, rcx, rcy - 5, 1, 11, '#FFD23F');
  rect(gFrame, rcx - 5, rcy, 11, 1, '#FFD23F');
  px(gFrame, rcx, rcy - 5, '#FF5252'); // 北针
  px(gFrame, rcx, rcy, '#FFF9C4');

  return {
    w: W,
    h: H,
    layers: {
      'wm-terrain': gTerrain,
      'wm-water': gWater,
      'wm-flora': gFlora,
      'wm-rails': gRails,
      'wm-landmarks': gLandmarks,
      'wm-veins': gVeins,
      'wm-frame': gFrame,
    },
  };
}

/** 渲染 256×144《青禾谷星脉全图》纯像素 SVG */
export function worldMapPixelSvg(opts?: { hasMinecart?: boolean; hasGreenhouse?: boolean }): string {
  const { w: W, h: H, layers } = worldMapPixelLayers(opts);
  return `<svg class="world-map-pixel-svg qh-pixel" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
    ${renderGroup(layers['wm-terrain'], 'wm-layer-terrain')}
    ${renderGroup(layers['wm-water'], 'wm-layer-water')}
    ${renderGroup(layers['wm-flora'], 'wm-layer-flora')}
    ${renderGroup(layers['wm-rails'], 'wm-layer-rails')}
    ${renderGroup(layers['wm-landmarks'], 'wm-layer-landmarks')}
    ${renderGroup(layers['wm-veins'], 'wm-layer-veins')}
    ${renderGroup(layers['wm-frame'], 'wm-layer-frame')}
  </svg>`;
}

/**
 * 24×24 主角全身多关节像素行者（与 playerAvatarSvg 形象完全一致）：
 * - 男：黑褐短发 + 白衬衫 + 蓝色背带工装裤 + 金铜背带扣 + 农夫皮靴
 * - 女：栗色双麻花辫 + 鬓角小黄花发饰 + 粉色上衣白领口 + 玫瑰裙裤 + 红色小皮靴
 * 拆分为 7 个独立像素图层：脚底阴影、后手、后腿、躯干、头部（含发辫摆动）、前腿、前手、尘土粒子
 */
export function playerMapWalkerLayers(gender: 'male' | 'female'): { w: number; h: number; layers: Record<string, Grid> } {
  const W = 24;
  const H = 24;
  const female = gender === 'female';
  const gShadow = grid(W, H);
  const gArmB = grid(W, H);
  const gLegB = grid(W, H);
  const gTorso = grid(W, H);
  const gHead = grid(W, H);
  const gLegF = grid(W, H);
  const gArmF = grid(W, H);
  const gDust = grid(W, H);

  const skin = '#FFE2C4';
  const hair = female ? '#8A4B23' : '#2A2018';
  const hairL = shade(hair, 1.45);
  const hairD = shade(hair, 0.72);

  // 1) 脚底像素地面阴影
  rect(gShadow, 7, 22, 10, 1, '#1A0F07');
  rect(gShadow, 6, 23, 12, 1, '#2B1B0E');

  // 2) 头部 + 发型（与头像同款，朝右行走侧三分之二视角）
  rect(gHead, 8, 4, 8, 7, skin);
  rect(gHead, 9, 3, 6, 1, skin);
  px(gHead, 8, 4, D); px(gHead, 15, 4, D);
  // 双眼与腮红、嘴巴
  px(gHead, 11, 7, D); px(gHead, 14, 7, D);
  px(gHead, 10, 8, '#FF9EB0'); px(gHead, 15, 8, '#FF9EB0');
  px(gHead, 12, 9, female ? '#D81B60' : '#8D5524');
  if (female) {
    // 栗色长发 + 麻花辫 + 鬓角黄花发饰
    rect(gHead, 7, 2, 10, 3, hair);
    rect(gHead, 8, 2, 8, 1, hairL);
    rect(gHead, 7, 5, 2, 6, hair);
    rect(gHead, 6, 9, 2, 4, hairD); // 脑后飘动麻花辫
    px(gHead, 5, 11, hair); px(gHead, 5, 12, '#FFD54F'); // 发绳
    // 黄花发饰
    px(gHead, 9, 3, '#FFD54F'); px(gHead, 10, 3, '#FB8C00'); px(gHead, 9, 4, '#FFF9C4');
  } else {
    // 利落黑褐短发 + 粗眉
    rect(gHead, 7, 2, 10, 3, hair);
    rect(gHead, 8, 2, 8, 1, hairL);
    rect(gHead, 7, 5, 2, 3, hair);
    px(gHead, 11, 6, D); px(gHead, 14, 6, D);
  }

  // 3) 躯干与服装（y = 11..16）
  if (female) {
    // 粉色上衣 + 白领口 + 束腰裙摆
    rect(gTorso, 8, 11, 8, 6, '#E75480');
    px(gTorso, 11, 11, '#FFFFFF'); px(gTorso, 12, 11, '#FFFFFF');
    px(gTorso, 10, 11, '#F8BBD0'); px(gTorso, 13, 11, '#F8BBD0');
    rect(gTorso, 8, 15, 8, 1, '#AD1457'); // 腰带
    px(gTorso, 12, 15, '#FFD54F');
    rect(gTorso, 7, 16, 10, 1, '#C2185B');
  } else {
    // 白衬衫 + 蓝色背带工装裤 + 金扣
    rect(gTorso, 8, 11, 8, 2, '#E8E4DA');
    rect(gTorso, 8, 13, 8, 4, '#2B5B84');
    rect(gTorso, 9, 11, 2, 3, '#2B5B84');
    rect(gTorso, 13, 11, 2, 3, '#2B5B84');
    px(gTorso, 10, 13, '#FFD54F'); px(gTorso, 13, 13, '#FFD54F'); // 背带金扣
    rect(gTorso, 8, 16, 8, 1, '#1B3B58');
  }
  // 背包侧影（身后小行囊）
  rect(gTorso, 6, 12, 2, 4, '#8D6E63');
  px(gTorso, 6, 12, '#FFD54F');

  // 4) 后手臂（gArmB）与前手臂（gArmF）—— 摆臂自然弯曲
  const sleeve = female ? '#F06292' : '#E8E4DA';
  const sleeveD = shade(sleeve, 0.8);
  // 后臂（偏右前伸）
  rect(gArmB, 14, 11, 2, 3, sleeveD);
  rect(gArmB, 15, 14, 2, 2, skin);
  // 前臂（偏左后摆）
  rect(gArmF, 7, 11, 2, 3, sleeve);
  rect(gArmF, 7, 14, 2, 2, skin);

  // 5) 后腿（gLegB）与前腿（gLegF）—— 膝踝分层 + 皮靴
  const pants = female ? '#5D4037' : '#1F4568';
  const pantsD = shade(pants, 0.78);
  const boot = female ? '#8E24AA' : '#4E342E';
  // 后腿（跨步在后）
  rect(gLegB, 9, 17, 3, 3, pantsD);
  rect(gLegB, 8, 20, 4, 2, shade(boot, 0.85));
  // 前腿（迈步在前）
  rect(gLegF, 12, 17, 3, 3, pants);
  rect(gLegF, 12, 20, 4, 2, boot);
  px(gLegF, 15, 21, '#FFD54F'); // 靴尖高光

  // 6) 脚后跟扬起的像素尘土与星尘颗粒
  rect(gDust, 3, 20, 2, 2, '#FFF3C4');
  px(gDust, 1, 19, '#FFE082');
  px(gDust, 4, 18, '#FFD23F');

  return {
    w: W,
    h: H,
    layers: {
      'pw-shadow': gShadow,
      'pw-arm-b': gArmB,
      'pw-leg-b': gLegB,
      'pw-torso': gTorso,
      'pw-head': gHead,
      'pw-leg-f': gLegF,
      'pw-arm-f': gArmF,
      'pw-dust': gDust,
    },
  };
}

export function playerMapWalkerSvg(gender: 'male' | 'female'): string {
  const { w: W, h: H, layers } = playerMapWalkerLayers(gender);
  return `<svg class="wm-walker-svg qh-pixel" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
    ${renderGroup(layers['pw-shadow'], 'pw-part-shadow')}
    ${renderGroup(layers['pw-dust'], 'pw-part-dust')}
    <g class="pw-body-core">
      ${renderGroup(layers['pw-arm-b'], 'pw-part-arm-b')}
      ${renderGroup(layers['pw-leg-b'], 'pw-part-leg-b')}
      ${renderGroup(layers['pw-torso'], 'pw-part-torso')}
      ${renderGroup(layers['pw-head'], 'pw-part-head')}
      ${renderGroup(layers['pw-leg-f'], 'pw-part-leg-f')}
      ${renderGroup(layers['pw-arm-f'], 'pw-part-arm-f')}
    </g>
  </svg>`;
}
