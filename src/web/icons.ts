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

const ITEM_PAINT: Record<string, (g: Grid) => void> = {};
function defItem(id: string, main: string, kind: 'fruit' | 'fish' | 'gem' | 'sword'): void {
  ITEM_PAINT[id] = (g) => kind === 'fruit' ? paintFruit(g, main) : kind === 'fish' ? paintFish(g, main, hash(id)) : kind === 'gem' ? paintGem(g, main) : paintSword(g, main);
}
Object.entries(CROP_PALETTE).forEach(([id, p]) => defItem(id, p.main, 'fruit'));
[['carp', '#E67E22'], ['largemouth_bass', '#558B2F'], ['sturgeon', '#607D8B'], ['legend', '#26A69A'], ['sunfish', '#FFD54F'], ['chub', '#B0BEC5'], ['rainbow_trout', '#81C784'], ['catfish', '#5D4037'], ['salmon', '#FF8A65'], ['pike', '#9CCC65'], ['anchovy', '#64B5F6'], ['sardine', '#4FC3F7'], ['herring', '#90CAF9'], ['halibut', '#A1887F'], ['tuna', '#1E88E5'], ['red_snapper', '#EF5350'], ['eel', '#795548'], ['pufferfish', '#FFD54F']].forEach(([id, c]) => defItem(id, c, 'fish'));
FISH.forEach((fish) => {
  if (!ITEM_PAINT[fish.id]) defItem(fish.id, hashColor(fish.id), 'fish');
});
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
