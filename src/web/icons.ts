import type { ToolId } from '../engine/types.js';

/* ============================================================
 * 星露谷像素风渲染引擎
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

/* ---------------- 作物 4 阶段 + 状态姿态 ---------------- */
export function cropGrowthSvg(cropId: string, pct: number, opts?: { watered?: boolean; wilted?: boolean; weeds?: boolean }): string {
  const g = grid(16, 16); const pal = CROP_PALETTE[cropId] ?? { main: '#8BC34A', stroke: '#33691E', leaf: '#4CAF50' };
  rect(g, 1, 14, 14, 2, '#6D4C41'); rect(g, 1, 14, 14, 1, '#8D6E63'); // 土壤行
  if (opts?.wilted) {
    rect(g, 7, 9, 2, 5, '#8D6E63'); px(g, 6, 8, '#A1887F'); px(g, 9, 9, '#795548'); px(g, 5, 10, '#8D6E63'); px(g, 10, 11, '#8D6E63'); px(g, 7, 7, '#6D4C41');
    if (opts.weeds) paintWeeds(g); return render(g, 'qh-tile-svg qh-pixel');
  }
  const dry = opts?.watered === false;
  const leaf = dry ? '#A9A94A' : pal.leaf; const leafD = shade(leaf, 0.65);
  if (pct >= 100) { // 成熟: 茎叶 + 饱满果实(复用物品色)
    rect(g, 7, 7, 2, 7, leafD); px(g, 5, 9, leaf); px(g, 10, 8, leaf); px(g, 4, 11, leaf); px(g, 11, 11, leaf);
    blob(g, 8, 6, 5, 5, pal.main); px(g, 6, 3, shade(pal.main, 1.4));
  } else if (pct >= 55) { // 结蕾/幼果
    rect(g, 7, 6, 2, 8, leafD); px(g, 4, 8, leaf); px(g, 5, 7, leaf); px(g, 10, 7, leaf); px(g, 11, 9, leaf); px(g, 3, 11, leaf); px(g, 12, 11, leaf);
    blob(g, 8, 5, 2, 2, pal.main); px(g, 11, 10, pal.main); if (dry) px(g, 4, 9, '#C0CA33');
  } else if (pct >= 25) { // 幼苗四叶
    rect(g, 7, 9, 2, 5, leafD); px(g, 5, 8, leaf); px(g, 6, 7, leaf); px(g, 9, 7, leaf); px(g, 10, 8, leaf); px(g, 7, 6, leaf);
    if (dry) { px(g, 5, 9, '#C0CA33'); px(g, 10, 9, '#C0CA33'); }
  } else { // 破土芽
    px(g, 7, 12, leaf); px(g, 8, 11, leaf); px(g, 6, 11, leafD); px(g, 9, 12, leafD); rect(g, 6, 13, 4, 1, '#8D6E63');
  }
  if (opts?.weeds) paintWeeds(g);
  return render(g, 'qh-tile-svg qh-pixel');
}
function paintWeeds(g: Grid): void {
  const c = '#33691E'; const l = '#558B2F';
  px(g, 1, 13, c); px(g, 2, 12, l); px(g, 13, 13, c); px(g, 14, 11, l); px(g, 3, 14, l); px(g, 12, 13, c);
}

/* ---------------- 农田地块底图 / Debuff 角标 / 旧状态兼容 ---------------- */
export function tileGroundSvg(kind: 'locked' | 'weed' | 'stone' | 'grass' | 'soil' | 'soil_wet' | 'soil_dry_cracked'): string {
  const g = grid(16, 16);
  if (kind === 'locked') { rect(g, 2, 2, 12, 12, '#4E5A52'); rect(g, 5, 6, 6, 7, '#8D6E63'); rect(g, 6, 4, 4, 3, '#B0BEC5'); px(g, 8, 9, '#FFD54F'); rect(g, 7, 8, 2, 2, '#37474F'); }
  else if (kind === 'weed') { rect(g, 0, 0, 16, 16, '#7A9A4D'); for (let i = 0; i < 12; i++) px(g, (hash('w' + i) % 14) + 1, 12 - (i % 6), i % 2 ? '#33691E' : '#558B2F'); }
  else if (kind === 'stone') { rect(g, 0, 0, 16, 16, '#8FA876'); rect(g, 4, 5, 8, 7, '#9E9E9E'); rect(g, 5, 4, 6, 2, '#BDBDBD'); px(g, 6, 7, '#616161'); px(g, 10, 9, '#616161'); }
  else if (kind === 'grass') { rect(g, 0, 0, 16, 16, '#8DB360'); for (let i = 0; i < 10; i++) px(g, (hash('g' + i) % 14) + 1, 4 + (i % 9), '#6B9A3F'); }
  else { const wet = kind === 'soil_wet'; rect(g, 0, 0, 16, 16, wet ? '#5D4037' : '#8D6E63'); for (let y = 3; y < 15; y += 3) rect(g, 1, y, 14, 1, wet ? '#4E342E' : '#6D4C41'); if (kind === 'soil_dry_cracked') { px(g, 4, 5, '#4E342E'); px(g, 5, 6, '#4E342E'); px(g, 10, 9, '#4E342E'); px(g, 11, 10, '#4E342E'); px(g, 7, 12, '#4E342E'); } }
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
    case 'candle': rect(g, 7, 7, 2, 7, '#FFF8E1'); blob(g, 8, 4, 1, 2, '#FFD54F'); px(g, 8, 2, '#FF8F00'); break;
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
    case 'drop': case 'debuff_thirsty': blob(g, 8, 9, 4, 5, '#42A5F5'); px(g, 8, 3, '#42A5F5'); px(g, 6, 8, '#BBDEFB'); if (name === 'debuff_thirsty') { rect(g, 12, 10, 2, 4, '#E53935'); px(g, 12, 15, '#E53935'); px(g, 13, 15, '#E53935'); } break;
    case 'debuff_weeds': px(g, 4, 13, '#33691E'); px(g, 5, 10, '#558B2F'); px(g, 6, 13, '#33691E'); px(g, 9, 11, '#558B2F'); px(g, 11, 13, '#33691E'); px(g, 12, 9, '#7CB342'); rect(g, 3, 14, 10, 1, '#33691E'); break;
    case 'debuff_wilted': blob(g, 8, 7, 4, 4, '#8D6E63'); px(g, 8, 11, '#6D4C41'); px(g, 6, 13, '#795548'); px(g, 10, 13, '#795548'); px(g, 6, 6, D); px(g, 10, 6, D); break;
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
