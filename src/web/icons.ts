import type { ToolId } from '../engine/types.js';

function svgWrap(inner: string, viewBox = '0 0 64 64', cls = 'qh-svg-icon'): string {
  return `<svg class="${cls}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

/** 6 位居民独立胸像矢量图 */
export function npcAvatarSvg(npcId: string): string {
  switch (npcId) {
    case 'su_he':
      return svgWrap(`
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#F7C6D4" stroke="#4A3220" stroke-width="3"/>
        <ellipse cx="32" cy="27" rx="21" ry="18" fill="#6B3E26" stroke="#3A2010" stroke-width="2"/>
        <rect x="13" y="45" width="38" height="15" rx="6" fill="#E75480" stroke="#3A2010" stroke-width="2"/>
        <path d="M25 45 L32 53 L39 45" fill="#FFF5F8" stroke="#3A2010" stroke-width="1.6"/>
        <ellipse cx="14" cy="40" rx="5.5" ry="12" fill="#6B3E26" stroke="#3A2010" stroke-width="2"/>
        <ellipse cx="50" cy="40" rx="5.5" ry="12" fill="#6B3E26" stroke="#3A2010" stroke-width="2"/>
        <ellipse cx="32" cy="31" rx="15" ry="15.5" fill="#FFE2C4" stroke="#3A2010" stroke-width="2.2"/>
        <path d="M16 27 Q32 12 48 27 Q40 20 32 23 Q24 20 16 27 Z" fill="#6B3E26" stroke="#3A2010" stroke-width="2"/>
        <circle cx="46" cy="19" r="5.5" fill="#FFD54F" stroke="#B26A00" stroke-width="1.6"/>
        <circle cx="46" cy="19" r="2" fill="#FB8C00"/>
        <ellipse cx="23" cy="34" rx="3" ry="1.8" fill="#FF8FAB"/>
        <ellipse cx="41" cy="34" rx="3" ry="1.8" fill="#FF8FAB"/>
        <path d="M23 30 Q26 26.5 29 30 M35 30 Q38 26.5 41 30 M28 38 Q32 42 36 38" fill="none" stroke="#3A2010" stroke-width="2.2" stroke-linecap="round"/>
      `, '0 0 64 64', 'qh-svg-avatar');
    case 'lu_yuan':
      return svgWrap(`
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#A8D5E5" stroke="#4A3220" stroke-width="3"/>
        <rect x="13" y="45" width="38" height="15" rx="6" fill="#2B5B84" stroke="#1B364F" stroke-width="2"/>
        <line x1="16" y1="51" x2="48" y2="51" stroke="#E1F5FE" stroke-width="2.2"/>
        <line x1="16" y1="56" x2="48" y2="56" stroke="#E1F5FE" stroke-width="2.2"/>
        <ellipse cx="32" cy="18" rx="25" ry="6.5" fill="#E6B86A" stroke="#6B4423" stroke-width="2"/>
        <rect x="18" y="8" width="28" height="12" rx="5" fill="#F2CC85" stroke="#6B4423" stroke-width="2"/>
        <line x1="19" y1="16" x2="45" y2="16" stroke="#C62828" stroke-width="2.2"/>
        <ellipse cx="32" cy="32" rx="14.5" ry="14.5" fill="#F5D2B0" stroke="#3A2010" stroke-width="2.2"/>
        <path d="M17 26 L24 19 L31 26 L38 19 L47 26 L45 18 L19 18 Z" fill="#1F3A52" stroke="#142536" stroke-width="1.8"/>
        <path d="M23 31 L28 31 M36 31 L41 31 M28 39 L36 38.5" fill="none" stroke="#1F2A36" stroke-width="2.3" stroke-linecap="round"/>
        <path d="M35 39 L49 44 M45 42 L51 41" fill="none" stroke="#558B2F" stroke-width="2" stroke-linecap="round"/>
      `, '0 0 64 64', 'qh-svg-avatar');
    case 'a_qing':
      return svgWrap(`
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#E8B49A" stroke="#4A3220" stroke-width="3"/>
        <rect x="13" y="45" width="38" height="15" rx="6" fill="#7A3E2E" stroke="#3A2010" stroke-width="2"/>
        <path d="M14 26 L19 10 L27 16 L32 8 L38 16 L46 10 L50 26 Z" fill="#3B2219" stroke="#24130D" stroke-width="2"/>
        <ellipse cx="32" cy="32" rx="15" ry="14.5" fill="#F2C29B" stroke="#3A2010" stroke-width="2.2"/>
        <rect x="16" y="18" width="32" height="7" rx="3" fill="#C62828" stroke="#3A2010" stroke-width="1.8"/>
        <ellipse cx="25" cy="18" rx="6" ry="4.8" fill="#80DEEA" stroke="#B8860B" stroke-width="2.2"/>
        <ellipse cx="39" cy="18" rx="6" ry="4.8" fill="#80DEEA" stroke="#B8860B" stroke-width="2.2"/>
        <circle cx="26" cy="31" r="2.2" fill="#3A2010"/>
        <circle cx="38" cy="31" r="2.2" fill="#3A2010"/>
        <path d="M26 37 Q32 44 38 37 Z" fill="#FFFFFF" stroke="#3A2010" stroke-width="1.8"/>
      `, '0 0 64 64', 'qh-svg-avatar');
    case 'bai_zhi':
      return svgWrap(`
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#B8E0B8" stroke="#4A3220" stroke-width="3"/>
        <rect x="13" y="45" width="38" height="15" rx="6" fill="#2E7D32" stroke="#1B4D20" stroke-width="2"/>
        <path d="M24 45 L32 55 L40 45" fill="#C8E6C9" stroke="#1B4D20" stroke-width="1.8"/>
        <ellipse cx="32" cy="13" rx="10" ry="8" fill="#22332B" stroke="#111A15" stroke-width="2"/>
        <line x1="16" y1="14" x2="49" y2="11" stroke="#26A69A" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="49" cy="11" r="3" fill="#80CBC4" stroke="#00695C" stroke-width="1.2"/>
        <ellipse cx="32" cy="32" rx="14.5" ry="15" fill="#FFE8D1" stroke="#3A2010" stroke-width="2.2"/>
        <path d="M17 27 Q25 15 32 22 Q39 15 47 27 Q43 16 32 16 Q21 16 17 27 Z" fill="#22332B" stroke="#111A15" stroke-width="1.8"/>
        <path d="M23 31 Q26 28.5 29 31 M35 31 Q38 28.5 41 31 M29 39 Q32 41.5 35 39" fill="none" stroke="#3A2010" stroke-width="2" stroke-linecap="round"/>
      `, '0 0 64 64', 'qh-svg-avatar');
    case 'zhou_bo':
      return svgWrap(`
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#F5D598" stroke="#4A3220" stroke-width="3"/>
        <rect x="13" y="45" width="38" height="15" rx="6" fill="#8D5524" stroke="#4A2C11" stroke-width="2"/>
        <rect x="17" y="11" width="30" height="13" rx="6" fill="#5D4037" stroke="#3E2723" stroke-width="2"/>
        <circle cx="32" cy="9" r="3" fill="#D32F2F" stroke="#8E0000" stroke-width="1.4"/>
        <ellipse cx="32" cy="32" rx="15" ry="14.5" fill="#F5D0A9" stroke="#3A2010" stroke-width="2.2"/>
        <circle cx="26" cy="30" r="4.8" fill="#FFF9C4" stroke="#B8860B" stroke-width="2"/>
        <circle cx="38" cy="30" r="4.8" fill="#FFF9C4" stroke="#B8860B" stroke-width="2"/>
        <line x1="30.8" y1="30" x2="33.2" y2="30" stroke="#B8860B" stroke-width="2"/>
        <path d="M32 36.5 Q25 35.5 21 40 M32 36.5 Q39 35.5 43 40 M28 41 Q32 44 36 41" fill="none" stroke="#4E342E" stroke-width="2.3" stroke-linecap="round"/>
      `, '0 0 64 64', 'qh-svg-avatar');
    case 'qin_popo':
      return svgWrap(`
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#D7C2E8" stroke="#4A3220" stroke-width="3"/>
        <rect x="13" y="45" width="38" height="15" rx="6" fill="#7E57C2" stroke="#4527A0" stroke-width="2"/>
        <ellipse cx="32" cy="12" rx="10" ry="8" fill="#ECEFF1" stroke="#78909C" stroke-width="2"/>
        <ellipse cx="32" cy="29" rx="18" ry="14" fill="#ECEFF1" stroke="#78909C" stroke-width="2"/>
        <ellipse cx="32" cy="32" rx="14.5" ry="14" fill="#F5D6B8" stroke="#3A2010" stroke-width="2.2"/>
        <ellipse cx="23" cy="35" rx="2.8" ry="1.6" fill="#F48FB1"/>
        <ellipse cx="41" cy="35" rx="2.8" ry="1.6" fill="#F48FB1"/>
        <path d="M23 31 Q26 28 29 31 M35 31 Q38 28 41 31 M27 38.5 Q32 42 37 38.5" fill="none" stroke="#4E342E" stroke-width="2.1" stroke-linecap="round"/>
      `, '0 0 64 64', 'qh-svg-avatar');
    default:
      return svgWrap(`
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#EAD7B7" stroke="#4A3220" stroke-width="3"/>
        <circle cx="32" cy="26" r="11" fill="#FFE0B2" stroke="#4A3220" stroke-width="2"/>
        <rect x="16" y="42" width="32" height="16" rx="6" fill="#8D6E63" stroke="#4A3220" stroke-width="2"/>
      `, '0 0 64 64', 'qh-svg-avatar');
  }
}

const CROP_PALETTE: Record<string, { main: string; stroke: string; leaf: string }> = {
  parsnip: { main: '#F5E6C8', stroke: '#8D6E63', leaf: '#4CAF50' },
  potato: { main: '#D7A86E', stroke: '#6B4423', leaf: '#66BB6A' },
  green_bean: { main: '#66BB6A', stroke: '#2E7D32', leaf: '#388E3C' },
  cauliflower: { main: '#FFFDF7', stroke: '#9E9E9E', leaf: '#43A047' },
  strawberry: { main: '#E53935', stroke: '#8E0000', leaf: '#43A047' },
  tomato: { main: '#F44336', stroke: '#B71C1C', leaf: '#388E3C' },
  hot_pepper: { main: '#D32F2F', stroke: '#7F0000', leaf: '#43A047' },
  blueberry: { main: '#3949AB', stroke: '#1A237E', leaf: '#4CAF50' },
  melon: { main: '#F48FB1', stroke: '#880E4F', leaf: '#66BB6A' },
  corn: { main: '#FFD54F', stroke: '#F57F17', leaf: '#4CAF50' },
  eggplant: { main: '#6A1B9A', stroke: '#38006B', leaf: '#43A047' },
  pumpkin: { main: '#FB8C00', stroke: '#E65100', leaf: '#388E3C' },
  yam: { main: '#AD1457', stroke: '#560027', leaf: '#66BB6A' },
  cranberry: { main: '#C62828', stroke: '#6A0000', leaf: '#2E7D32' },
};

function seedBagSvg(cropId: string): string {
  const pal = CROP_PALETTE[cropId] ?? { main: '#8BC34A', stroke: '#33691E', leaf: '#4CAF50' };
  return svgWrap(`
    <rect x="13" y="10" width="38" height="45" rx="6" fill="#DFC396" stroke="#6B4423" stroke-width="2.5"/>
    <path d="M13 18 L51 18" stroke="#8D5524" stroke-width="2" stroke-dasharray="3 2"/>
    <circle cx="32" cy="35" r="12" fill="#FFF9EE" stroke="#8D6E63" stroke-width="1.8"/>
    <circle cx="32" cy="37" r="6.5" fill="${pal.main}" stroke="${pal.stroke}" stroke-width="1.8"/>
    <path d="M32 30 Q28 25 35 26" fill="none" stroke="${pal.leaf}" stroke-width="2.4" stroke-linecap="round"/>
  `);
}

function fishSvg(body: string, stroke: string, detail = '', shape: 'normal' | 'eel' | 'flat' | 'puffer' | 'legend' = 'normal'): string {
  if (shape === 'puffer') {
    return svgWrap(`
      <circle cx="32" cy="32" r="16" fill="${body}" stroke="${stroke}" stroke-width="2.5"/>
      <path d="M32 11 L32 15 M32 49 L32 53 M11 32 L15 32 M49 32 L53 32 M17 17 L20 20 M44 44 L47 47 M47 17 L44 20 M20 44 L17 47" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="25" cy="28" r="2.4" fill="#212121"/>
      ${detail}
    `);
  }
  if (shape === 'eel') {
    return svgWrap(`
      <path d="M10 44 Q18 22 32 32 T54 20" fill="none" stroke="${stroke}" stroke-width="11" stroke-linecap="round"/>
      <path d="M10 44 Q18 22 32 32 T54 20" fill="none" stroke="${body}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="13" cy="40" r="1.8" fill="#FFFFFF"/>
      ${detail}
    `);
  }
  if (shape === 'flat') {
    return svgWrap(`
      <ellipse cx="30" cy="32" rx="18" ry="14" fill="${body}" stroke="${stroke}" stroke-width="2.5"/>
      <polygon points="46,32 56,22 55,42" fill="${body}" stroke="${stroke}" stroke-width="2.2"/>
      <circle cx="21" cy="27" r="2" fill="#212121"/>
      <circle cx="21" cy="34" r="2" fill="#212121"/>
      ${detail}
    `);
  }
  const crown = shape === 'legend'
    ? `<polygon points="22,19 26,10 31,17 36,9 40,19" fill="#FFD700" stroke="#B8860B" stroke-width="1.8"/>`
    : '';
  return svgWrap(`
    ${crown}
    <path d="M10 33 Q27 17 44 33 L55 22 L53 44 L44 33 Q27 49 10 33 Z" fill="${body}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="19" cy="30" r="2.3" fill="#212121"/>
    ${detail}
  `);
}

/** 分等级工具矢量图标（level: 0普通/竹, 1铜/玻纤, 2钢/铱金, 3金, 4铱） */
export function toolIconSvg(tool: ToolId, level = 0): string {
  const headColors = [
    { fill: '#90A4AE', stroke: '#37474F' }, // 0 普通铁
    { fill: '#E67E22', stroke: '#873600' }, // 1 铜
    { fill: '#B0BEC5', stroke: '#455A64' }, // 2 钢
    { fill: '#FFD54F', stroke: '#B26A00' }, // 3 金
    { fill: '#AB47BC', stroke: '#4A148C' }, // 4 铱
  ];
  const hc = headColors[Math.min(Math.max(level, 0), 4)];
  switch (tool) {
    case 'hoe':
      return svgWrap(`
        <line x1="14" y1="50" x2="44" y2="18" stroke="#8D5524" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M34 12 L52 26 L46 33 L30 18 Z" fill="${hc.fill}" stroke="${hc.stroke}" stroke-width="2.4" stroke-linejoin="round"/>
      `);
    case 'can':
      return svgWrap(`
        <path d="M16 28 Q10 28 10 36 Q10 44 16 44" fill="none" stroke="${hc.stroke}" stroke-width="3.5"/>
        <rect x="16" y="24" width="26" height="24" rx="5" fill="${level === 0 ? '#42A5F5' : hc.fill}" stroke="${hc.stroke}" stroke-width="2.5"/>
        <path d="M42 32 L54 22 L56 26 L42 40 Z" fill="${hc.fill}" stroke="${hc.stroke}" stroke-width="2.2"/>
        <circle cx="29" cy="36" r="5" fill="#E1F5FE"/>
      `);
    case 'pickaxe':
      return svgWrap(`
        <line x1="14" y1="50" x2="46" y2="18" stroke="#8D5524" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M27 12 Q45 13 52 31 Q42 23 35 20 Q29 17 27 12 Z" fill="${hc.fill}" stroke="${hc.stroke}" stroke-width="2.4" stroke-linejoin="round"/>
      `);
    case 'axe':
      return svgWrap(`
        <line x1="14" y1="50" x2="46" y2="16" stroke="#8D5524" stroke-width="5.5" stroke-linecap="round"/>
        <path d="M35 14 Q52 18 50 34 Q38 32 32 23 Z" fill="${hc.fill}" stroke="${hc.stroke}" stroke-width="2.4" stroke-linejoin="round"/>
      `);
    case 'rod': {
      const rodStroke = level >= 2 ? '#AB47BC' : level === 1 ? '#26C6DA' : '#8D6E63';
      return svgWrap(`
        <path d="M12 52 Q28 20 50 12" fill="none" stroke="${rodStroke}" stroke-width="4.5" stroke-linecap="round"/>
        <line x1="50" y1="12" x2="50" y2="42" stroke="#78909C" stroke-width="1.8" stroke-dasharray="3 2"/>
        <circle cx="50" cy="44" r="4.5" fill="#FF5252" stroke="#B71C1C" stroke-width="1.8"/>
      `);
    }
  }
}

/** 全品类 80 种物品独立矢量图标 */
export function itemIconSvg(itemId: string): string {
  if (itemId.endsWith('_seed')) {
    return seedBagSvg(itemId.replace(/_seed$/, ''));
  }
  switch (itemId) {
    // === 14 种农作物 ===
    case 'parsnip':
      return svgWrap(`
        <path d="M23 24 L41 24 L35 53 Q32 57 29 53 Z" fill="#F5E6C8" stroke="#6B4423" stroke-width="2.4"/>
        <path d="M32 24 C22 10 18 18 28 24 M32 24 C32 8 38 8 34 24 M32 24 C42 12 46 18 36 24" fill="#4CAF50" stroke="#2E7D32" stroke-width="2.2"/>
      `);
    case 'potato':
      return svgWrap(`
        <ellipse cx="32" cy="34" rx="20" ry="15" fill="#D7A86E" stroke="#6B4423" stroke-width="2.5"/>
        <circle cx="24" cy="30" r="1.8" fill="#6B4423"/>
        <circle cx="38" cy="36" r="1.8" fill="#6B4423"/>
        <circle cx="30" cy="40" r="1.5" fill="#6B4423"/>
      `);
    case 'green_bean':
      return svgWrap(`
        <path d="M18 16 Q44 18 46 46 Q24 44 18 16 Z" fill="#66BB6A" stroke="#2E7D32" stroke-width="2.5"/>
        <circle cx="27" cy="27" r="3.5" fill="#A5D6A7"/>
        <circle cx="34" cy="34" r="3.5" fill="#A5D6A7"/>
      `);
    case 'cauliflower':
      return svgWrap(`
        <circle cx="22" cy="36" r="11" fill="#66BB6A" stroke="#2E7D32" stroke-width="2.2"/>
        <circle cx="42" cy="36" r="11" fill="#66BB6A" stroke="#2E7D32" stroke-width="2.2"/>
        <circle cx="32" cy="32" r="14" fill="#FFFDF7" stroke="#8D6E63" stroke-width="2.4"/>
        <circle cx="27" cy="28" r="5" fill="#F5F5F5" stroke="#BDBDBD" stroke-width="1.5"/>
        <circle cx="37" cy="29" r="5" fill="#F5F5F5" stroke="#BDBDBD" stroke-width="1.5"/>
      `);
    case 'strawberry':
      return svgWrap(`
        <path d="M18 22 Q32 16 46 22 Q48 44 32 54 Q16 44 18 22 Z" fill="#E53935" stroke="#8E0000" stroke-width="2.4"/>
        <path d="M20 20 L32 11 L44 20 L32 26 Z" fill="#43A047" stroke="#1B5E20" stroke-width="2"/>
        <circle cx="27" cy="32" r="1.5" fill="#FFF59D"/>
        <circle cx="37" cy="32" r="1.5" fill="#FFF59D"/>
        <circle cx="32" cy="41" r="1.5" fill="#FFF59D"/>
      `);
    case 'tomato':
      return svgWrap(`
        <ellipse cx="32" cy="35" rx="18" ry="16" fill="#F44336" stroke="#B71C1C" stroke-width="2.5"/>
        <polygon points="32,14 27,22 20,19 26,25 32,23 38,25 44,19 37,22" fill="#388E3C" stroke="#1B5E20" stroke-width="1.6"/>
      `);
    case 'hot_pepper':
      return svgWrap(`
        <path d="M22 20 Q46 20 46 50 Q24 46 22 20 Z" fill="#D32F2F" stroke="#7F0000" stroke-width="2.5"/>
        <path d="M24 20 Q20 12 28 11" fill="none" stroke="#388E3C" stroke-width="3.5" stroke-linecap="round"/>
      `);
    case 'blueberry':
      return svgWrap(`
        <path d="M24 18 Q32 10 40 18" fill="#4CAF50" stroke="#1B5E20" stroke-width="2.2"/>
        <circle cx="24" cy="35" r="11" fill="#3949AB" stroke="#1A237E" stroke-width="2.2"/>
        <circle cx="39" cy="37" r="11" fill="#5C6BC0" stroke="#1A237E" stroke-width="2.2"/>
        <circle cx="21" cy="32" r="2.2" fill="#9FA8DA"/>
      `);
    case 'melon':
      return svgWrap(`
        <circle cx="32" cy="35" r="17" fill="#F48FB1" stroke="#880E4F" stroke-width="2.5"/>
        <path d="M22 23 Q32 35 22 47 M42 23 Q32 35 42 47" fill="none" stroke="#F8BBD0" stroke-width="2"/>
        <path d="M32 18 L32 11 L38 13" fill="none" stroke="#388E3C" stroke-width="2.8" stroke-linecap="round"/>
      `);
    case 'corn':
      return svgWrap(`
        <ellipse cx="32" cy="30" rx="10" ry="18" fill="#FFD54F" stroke="#F57F17" stroke-width="2.3"/>
        <path d="M20 50 Q12 32 23 26 L32 50 L41 26 Q52 32 44 50 Z" fill="#66BB6A" stroke="#2E7D32" stroke-width="2.2"/>
      `);
    case 'eggplant':
      return svgWrap(`
        <ellipse cx="32" cy="36" rx="12" ry="17" fill="#6A1B9A" stroke="#38006B" stroke-width="2.5"/>
        <path d="M23 22 L32 13 L41 22 L32 26 Z" fill="#43A047" stroke="#1B5E20" stroke-width="2"/>
      `);
    case 'pumpkin':
      return svgWrap(`
        <ellipse cx="32" cy="36" rx="20" ry="15" fill="#FB8C00" stroke="#E65100" stroke-width="2.5"/>
        <ellipse cx="32" cy="36" rx="10" ry="15" fill="#FFA726" stroke="#E65100" stroke-width="2"/>
        <path d="M32 21 L32 13 L37 15" fill="none" stroke="#388E3C" stroke-width="3" stroke-linecap="round"/>
      `);
    case 'yam':
      return svgWrap(`
        <path d="M18 44 Q16 24 42 16 Q48 34 24 48 Z" fill="#AD1457" stroke="#560027" stroke-width="2.4"/>
      `);
    case 'cranberry':
      return svgWrap(`
        <circle cx="23" cy="36" r="8" fill="#C62828" stroke="#6A0000" stroke-width="2"/>
        <circle cx="38" cy="38" r="8" fill="#E53935" stroke="#6A0000" stroke-width="2"/>
        <circle cx="31" cy="26" r="8" fill="#D32F2F" stroke="#6A0000" stroke-width="2"/>
        <path d="M22 18 L40 18" stroke="#2E7D32" stroke-width="3" stroke-linecap="round"/>
      `);

    // === 16 种采集物 + 木材 ===
    case 'wood':
      return svgWrap(`
        <rect x="10" y="22" width="40" height="22" rx="6" fill="#8D5524" stroke="#4A2C11" stroke-width="2.5"/>
        <ellipse cx="48" cy="33" rx="6" ry="11" fill="#D7A86E" stroke="#4A2C11" stroke-width="2.2"/>
        <line x1="18" y1="29" x2="36" y2="29" stroke="#5D341E" stroke-width="2" stroke-linecap="round"/>
      `);
    case 'wild_horseradish':
      return svgWrap(`
        <path d="M25 28 L39 28 L34 52 L30 52 Z" fill="#D7CCC8" stroke="#5D4037" stroke-width="2.2"/>
        <path d="M32 28 L20 14 M32 28 L32 11 M32 28 L44 14" stroke="#43A047" stroke-width="4" stroke-linecap="round"/>
      `);
    case 'daffodil':
      return svgWrap(`
        <line x1="32" y1="34" x2="32" y2="54" stroke="#43A047" stroke-width="3.5" stroke-linecap="round"/>
        <polygon points="32,10 37,20 48,18 41,27 48,36 37,34 32,44 27,34 16,36 23,27 16,18 27,20" fill="#FFEE58" stroke="#F9A825" stroke-width="2"/>
        <circle cx="32" cy="27" r="6.5" fill="#FB8C00" stroke="#E65100" stroke-width="2"/>
      `);
    case 'leek':
      return svgWrap(`
        <rect x="26" y="30" width="12" height="22" rx="4" fill="#FFFDF7" stroke="#8D6E63" stroke-width="2.2"/>
        <path d="M27 30 L20 12 L28 12 L32 26 L36 12 L44 12 L37 30 Z" fill="#4CAF50" stroke="#1B5E20" stroke-width="2"/>
      `);
    case 'dandelion':
      return svgWrap(`
        <line x1="32" y1="34" x2="32" y2="54" stroke="#558B2F" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="32" cy="26" r="14" fill="#FFD54F" stroke="#F57F17" stroke-width="2.4"/>
        <circle cx="32" cy="26" r="7" fill="#FFEE58"/>
      `);
    case 'spice_berry':
      return svgWrap(`
        <circle cx="32" cy="35" r="15" fill="#FF7043" stroke="#BF360C" stroke-width="2.4"/>
        <circle cx="27" cy="31" r="2" fill="#FFF3E0"/>
        <circle cx="36" cy="37" r="2" fill="#FFF3E0"/>
        <path d="M24 20 L32 13 L40 20" fill="#43A047" stroke="#1B5E20" stroke-width="2"/>
      `);
    case 'grape':
      return svgWrap(`
        <path d="M26 15 L38 15" stroke="#388E3C" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="25" cy="25" r="7.5" fill="#8E24AA" stroke="#4A148C" stroke-width="2"/>
        <circle cx="39" cy="25" r="7.5" fill="#8E24AA" stroke="#4A148C" stroke-width="2"/>
        <circle cx="32" cy="34" r="7.5" fill="#AB47BC" stroke="#4A148C" stroke-width="2"/>
        <circle cx="32" cy="45" r="7" fill="#7B1FA2" stroke="#4A148C" stroke-width="2"/>
      `);
    case 'sweet_pea':
      return svgWrap(`
        <line x1="32" y1="32" x2="32" y2="54" stroke="#66BB6A" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="25" cy="26" r="10" fill="#F48FB1" stroke="#AD1457" stroke-width="2.2"/>
        <circle cx="39" cy="26" r="10" fill="#CE93D8" stroke="#6A1B9A" stroke-width="2.2"/>
      `);
    case 'common_mushroom':
      return svgWrap(`
        <rect x="25" y="32" width="14" height="20" rx="5" fill="#F5E6C8" stroke="#6B4423" stroke-width="2.2"/>
        <path d="M12 34 Q32 10 52 34 Z" fill="#A15C38" stroke="#5D341E" stroke-width="2.4"/>
      `);
    case 'wild_plum':
      return svgWrap(`
        <circle cx="32" cy="35" r="15" fill="#7B1FA2" stroke="#38006B" stroke-width="2.4"/>
        <path d="M32 20 Q38 12 44 16" fill="#66BB6A" stroke="#1B5E20" stroke-width="2.2"/>
      `);
    case 'hazelnut':
      return svgWrap(`
        <circle cx="32" cy="36" r="14" fill="#A1662F" stroke="#4A2C11" stroke-width="2.4"/>
        <path d="M18 31 Q32 18 46 31 Z" fill="#6D4C41" stroke="#3E2723" stroke-width="2.2"/>
      `);
    case 'blackberry':
      return svgWrap(`
        <circle cx="26" cy="28" r="7.5" fill="#37474F" stroke="#102027" stroke-width="2"/>
        <circle cx="38" cy="28" r="7.5" fill="#37474F" stroke="#102027" stroke-width="2"/>
        <circle cx="32" cy="39" r="8" fill="#263238" stroke="#102027" stroke-width="2"/>
      `);
    case 'winter_root':
      return svgWrap(`
        <path d="M22 20 L42 20 L34 52 Z" fill="#D7B889" stroke="#6D4C41" stroke-width="2.4"/>
        <path d="M26 20 L32 11 L38 20" fill="#81D4FA" stroke="#0277BD" stroke-width="2.2"/>
      `);
    case 'crystal_fruit':
      return svgWrap(`
        <polygon points="32,12 48,22 48,42 32,52 16,42 16,22" fill="#4FC3F7" stroke="#01579B" stroke-width="2.4"/>
        <polygon points="32,18 41,25 32,44 23,25" fill="#E1F5FE"/>
      `);
    case 'snow_yam':
      return svgWrap(`
        <ellipse cx="32" cy="35" rx="17" ry="13" fill="#E1F5FE" stroke="#0288D1" stroke-width="2.4"/>
        <circle cx="26" cy="32" r="2" fill="#81D4FA"/>
        <circle cx="38" cy="37" r="2" fill="#81D4FA"/>
      `);
    case 'crocus':
      return svgWrap(`
        <path d="M22 46 Q18 22 32 14 Q46 22 42 46 Z" fill="#9575CD" stroke="#4527A0" stroke-width="2.4"/>
        <line x1="32" y1="26" x2="32" y2="38" stroke="#FFD54F" stroke-width="3" stroke-linecap="round"/>
      `);
    case 'clam':
    case 'cockle':
      return svgWrap(`
        <path d="M12 38 Q32 12 52 38 L42 48 L22 48 Z" fill="${itemId === 'clam' ? '#FFE0B2' : '#FFCCBC'}" stroke="#8D6E63" stroke-width="2.4"/>
        <line x1="32" y1="22" x2="32" y2="48" stroke="#A1887F" stroke-width="1.8"/>
      `);
    case 'mussel':
      return svgWrap(`
        <ellipse cx="32" cy="34" rx="13" ry="18" fill="#455A64" stroke="#1C313A" stroke-width="2.4"/>
        <path d="M26 22 Q32 34 26 46" fill="none" stroke="#90A4AE" stroke-width="2"/>
      `);
    case 'coral':
      return svgWrap(`
        <path d="M32 52 L32 18 M32 38 L18 24 M32 32 L46 20 M23 29 L21 16" fill="none" stroke="#FF5252" stroke-width="5.5" stroke-linecap="round"/>
      `);

    // === 18 种鱼类 ===
    case 'carp':
      return fishSvg('#E67E22', '#6E2C00');
    case 'largemouth_bass':
      return fishSvg('#558B2F', '#1B5E20', `<line x1="18" y1="33" x2="40" y2="33" stroke="#2E7D32" stroke-width="3"/>`);
    case 'sturgeon':
      return fishSvg('#607D8B', '#263238', `<circle cx="27" cy="33" r="1.8" fill="#CFD8DC"/><circle cx="35" cy="33" r="1.8" fill="#CFD8DC"/>`);
    case 'legend':
      return fishSvg('#26A69A', '#004D40', `<line x1="18" y1="33" x2="40" y2="33" stroke="#FFD700" stroke-width="2.5"/>`, 'legend');
    case 'sunfish':
      return fishSvg('#FFD54F', '#E65100', `<circle cx="31" cy="33" r="4" fill="#FF7043"/>`);
    case 'chub':
      return fishSvg('#B0BEC5', '#37474F');
    case 'rainbow_trout':
      return fishSvg('#81C784', '#1B5E20', `<line x1="16" y1="33" x2="42" y2="33" stroke="#F06292" stroke-width="3.5" stroke-linecap="round"/>`);
    case 'catfish':
      return fishSvg('#5D4037', '#271914', `<path d="M11 34 Q6 40 12 45 M12 31 Q6 26 12 22" fill="none" stroke="#271914" stroke-width="2.2" stroke-linecap="round"/>`);
    case 'salmon':
      return fishSvg('#FF8A65', '#BF360C');
    case 'pike':
      return fishSvg('#9CCC65', '#33691E');
    case 'anchovy':
      return fishSvg('#64B5F6', '#0D47A1');
    case 'sardine':
      return fishSvg('#4FC3F7', '#01579B');
    case 'herring':
      return fishSvg('#90CAF9', '#1565C0');
    case 'halibut':
      return fishSvg('#A1887F', '#4E342E', '', 'flat');
    case 'tuna':
      return fishSvg('#1E88E5', '#0D47A1', `<line x1="18" y1="33" x2="42" y2="33" stroke="#BBDEFB" stroke-width="2.8"/>`);
    case 'red_snapper':
      return fishSvg('#EF5350', '#8E0000');
    case 'eel':
      return fishSvg('#795548', '#3E2723', '', 'eel');
    case 'pufferfish':
      return fishSvg('#FFD54F', '#B26A00', '', 'puffer');

    // === 3 种垂钓杂物 ===
    case 'driftwood':
      return svgWrap(`
        <path d="M12 42 L48 20 M34 29 L46 34" stroke="#8D6E63" stroke-width="6" stroke-linecap="round"/>
      `);
    case 'old_boot':
      return svgWrap(`
        <path d="M20 16 L34 16 L34 36 L48 36 L48 48 L20 48 Z" fill="#6D4C41" stroke="#3E2723" stroke-width="2.5" stroke-linejoin="round"/>
      `);
    case 'soggy_newspaper':
      return svgWrap(`
        <rect x="14" y="16" width="36" height="32" rx="3" fill="#CFD8DC" stroke="#546E7A" stroke-width="2.4"/>
        <line x1="20" y1="24" x2="44" y2="24" stroke="#607D8B" stroke-width="2.5"/>
        <line x1="20" y1="32" x2="44" y2="32" stroke="#78909C" stroke-width="2"/>
        <line x1="20" y1="39" x2="36" y2="39" stroke="#78909C" stroke-width="2"/>
      `);

    // === 矿石与废料 ===
    case 'copper_ore':
    case 'iron_ore':
    case 'gold_ore': {
      const oreColor = itemId === 'gold_ore' ? '#FFD700' : itemId === 'iron_ore' ? '#CFD8DC' : '#E67E22';
      return svgWrap(`
        <polygon points="32,12 50,22 48,46 18,48 14,24" fill="#757575" stroke="#373737" stroke-width="2.5"/>
        <circle cx="27" cy="28" r="5.5" fill="${oreColor}" stroke="#373737" stroke-width="1.6"/>
        <circle cx="38" cy="36" r="5" fill="${oreColor}" stroke="#373737" stroke-width="1.6"/>
      `);
    }
    case 'scrap':
      return svgWrap(`
        <polygon points="32,14 48,24 42,46 20,44 16,24" fill="#90A4AE" stroke="#37474F" stroke-width="2.4"/>
        <circle cx="32" cy="31" r="5" fill="#CFD8DC" stroke="#37474F" stroke-width="2"/>
      `);

    // === 6 种宝石 ===
    case 'amethyst':
      return svgWrap(`<polygon points="32,10 48,22 48,42 32,54 16,42 16,22" fill="#AB47BC" stroke="#4A148C" stroke-width="2.5"/>`);
    case 'topaz':
      return svgWrap(`<polygon points="32,10 48,24 42,50 22,50 16,24" fill="#FFCA28" stroke="#E65100" stroke-width="2.5"/>`);
    case 'aquamarine':
      return svgWrap(`<polygon points="22,12 42,12 50,32 42,52 22,52 14,32" fill="#26C6DA" stroke="#006064" stroke-width="2.5"/>`);
    case 'jade':
      return svgWrap(`<ellipse cx="32" cy="32" rx="16" ry="19" fill="#66BB6A" stroke="#1B5E20" stroke-width="2.5"/>`);
    case 'ruby':
      return svgWrap(`<polygon points="32,10 50,24 44,50 20,50 14,24" fill="#E53935" stroke="#7F0000" stroke-width="2.5"/>`);
    case 'emerald':
      return svgWrap(`<rect x="16" y="12" width="32" height="40" rx="6" fill="#2ECC71" stroke="#145A32" stroke-width="2.5"/>`);
    case 'diamond':
      return svgWrap(`
        <polygon points="20,16 44,16 52,28 32,52 12,28" fill="#80DEEA" stroke="#006064" stroke-width="2.5"/>
        <polyline points="12,28 52,28" stroke="#E0F7FA" stroke-width="2"/>
      `);

    // === 5 种怪物战利品 ===
    case 'slime':
      return svgWrap(`
        <path d="M32 12 C48 28 50 48 32 48 C14 48 16 28 32 12 Z" fill="#76FF03" stroke="#33691E" stroke-width="2.4"/>
      `);
    case 'bat_wing':
      return svgWrap(`
        <path d="M12 40 Q20 16 32 28 Q44 16 52 40 Q42 34 32 42 Q22 34 12 40 Z" fill="#455A64" stroke="#1C313A" stroke-width="2.4"/>
      `);
    case 'bone_fragment':
      return svgWrap(`
        <path d="M18 46 L46 18" stroke="#FFFDF7" stroke-width="9" stroke-linecap="round"/>
        <path d="M18 46 L46 18" stroke="#8D6E63" stroke-width="2" stroke-linecap="round"/>
      `);
    case 'golem_core':
      return svgWrap(`
        <circle cx="32" cy="32" r="17" fill="#546E7A" stroke="#263238" stroke-width="2.5"/>
        <circle cx="32" cy="32" r="8" fill="#00E5FF" stroke="#006064" stroke-width="2"/>
      `);
    case 'void_essence':
      return svgWrap(`
        <circle cx="32" cy="32" r="17" fill="#311B92" stroke="#B388FF" stroke-width="2.5"/>
        <circle cx="32" cy="32" r="7" fill="#E040FB"/>
      `);

    // === 4 种料理 ===
    case 'bread':
      return svgWrap(`
        <ellipse cx="32" cy="34" rx="20" ry="13" fill="#D7A86E" stroke="#6B4423" stroke-width="2.5"/>
        <path d="M22 28 L26 36 M32 27 L36 35 M40 29 L43 36" stroke="#8D5524" stroke-width="2.2" stroke-linecap="round"/>
      `);
    case 'salad':
      return svgWrap(`
        <path d="M12 32 L52 32 Q48 50 32 50 Q16 50 12 32 Z" fill="#FFFDF7" stroke="#8D6E63" stroke-width="2.4"/>
        <circle cx="25" cy="27" r="8" fill="#66BB6A" stroke="#2E7D32" stroke-width="2"/>
        <circle cx="38" cy="27" r="8" fill="#81C784" stroke="#2E7D32" stroke-width="2"/>
        <circle cx="32" cy="25" r="4.5" fill="#E53935"/>
      `);
    case 'pizza':
      return svgWrap(`
        <path d="M14 18 Q32 10 50 18 L32 52 Z" fill="#FFCA28" stroke="#BF360C" stroke-width="2.5"/>
        <circle cx="29" cy="26" r="4" fill="#D32F2F"/>
        <circle cx="36" cy="34" r="3.5" fill="#D32F2F"/>
      `);
    case 'breakfast':
      return svgWrap(`
        <ellipse cx="32" cy="34" rx="19" ry="15" fill="#FFFFFF" stroke="#B08D57" stroke-width="2.4"/>
        <circle cx="29" cy="34" r="7.5" fill="#FFB300" stroke="#E65100" stroke-width="2"/>
        <path d="M40 26 L46 40" stroke="#C62828" stroke-width="4" stroke-linecap="round"/>
      `);

    // === 2 种信物 ===
    case 'bouquet':
      return svgWrap(`
        <path d="M18 28 L46 28 L36 52 L28 52 Z" fill="#F8BBD0" stroke="#AD1457" stroke-width="2.4"/>
        <circle cx="25" cy="22" r="7" fill="#EC407A" stroke="#880E4F" stroke-width="2"/>
        <circle cx="39" cy="22" r="7" fill="#AB47BC" stroke="#4A148C" stroke-width="2"/>
        <circle cx="32" cy="17" r="7.5" fill="#FFD54F" stroke="#B26A00" stroke-width="2"/>
      `);
    case 'pendant':
      return svgWrap(`
        <path d="M22 14 Q32 28 42 14" fill="none" stroke="#B8860B" stroke-width="2.2"/>
        <ellipse cx="32" cy="36" rx="12" ry="15" fill="#00BCD4" stroke="#006064" stroke-width="2.5"/>
        <path d="M28 30 Q36 36 28 42" fill="none" stroke="#E0F7FA" stroke-width="2.2" stroke-linecap="round"/>
      `);

    // === 工具物品 ===
    case 'tool_hoe':
      return toolIconSvg('hoe', 0);
    case 'tool_can':
      return toolIconSvg('can', 0);
    case 'tool_pickaxe':
      return toolIconSvg('pickaxe', 0);
    case 'tool_axe':
      return toolIconSvg('axe', 0);
    case 'rod_bamboo':
      return toolIconSvg('rod', 0);
    case 'rod_fiberglass':
      return toolIconSvg('rod', 1);
    case 'rod_iridium':
      return toolIconSvg('rod', 2);

    // === 6 种武器 ===
    case 'fists':
      return svgWrap(`
        <rect x="18" y="20" width="28" height="26" rx="9" fill="#FFCC80" stroke="#6B4423" stroke-width="2.5"/>
        <line x1="25" y1="20" x2="25" y2="28" stroke="#6B4423" stroke-width="2"/>
        <line x1="32" y1="20" x2="32" y2="28" stroke="#6B4423" stroke-width="2"/>
        <line x1="39" y1="20" x2="39" y2="28" stroke="#6B4423" stroke-width="2"/>
      `);
    case 'rusty_sword':
    case 'steel_sword':
    case 'silver_blade':
    case 'obsidian_sword':
    case 'galaxy_sword': {
      const bladeMap: Record<string, { fill: string; stroke: string }> = {
        rusty_sword: { fill: '#A1887F', stroke: '#4E342E' },
        steel_sword: { fill: '#B0BEC5', stroke: '#37474F' },
        silver_blade: { fill: '#E1F5FE', stroke: '#0277BD' },
        obsidian_sword: { fill: '#4527A0', stroke: '#1A0033' },
        galaxy_sword: { fill: '#CE93D8', stroke: '#4A148C' },
      };
      const b = bladeMap[itemId] ?? bladeMap.steel_sword;
      return svgWrap(`
        <line x1="14" y1="50" x2="24" y2="40" stroke="#6D4C41" stroke-width="5" stroke-linecap="round"/>
        <line x1="18" y1="34" x2="30" y2="46" stroke="#FFD54F" stroke-width="4" stroke-linecap="round"/>
        <polygon points="23,37 48,12 52,16 27,41" fill="${b.fill}" stroke="${b.stroke}" stroke-width="2.2"/>
      `);
    }

    default:
      return svgWrap(`
        <rect x="14" y="14" width="36" height="36" rx="8" fill="#E6D5B8" stroke="#6B4423" stroke-width="2.4"/>
        <circle cx="32" cy="32" r="8" fill="#8D6E63"/>
      `);
  }
}

/** 农田格子辅助状态矢量图标 */
export function tileStatusSvg(kind: 'weed' | 'stone' | 'withered' | 'sprout'): string {
  switch (kind) {
    case 'weed':
      return svgWrap(`
        <path d="M18 48 L24 20 L30 48 M30 48 L38 18 L44 48" fill="none" stroke="#558B2F" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      `, '0 0 64 64', 'qh-tile-svg');
    case 'stone':
      return svgWrap(`
        <polygon points="32,16 50,28 44,48 20,48 14,28" fill="#9E9E9E" stroke="#424242" stroke-width="2.5"/>
      `, '0 0 64 64', 'qh-tile-svg');
    case 'withered':
      return svgWrap(`
        <path d="M32 50 L32 26 Q32 18 42 22 M32 34 Q22 28 20 36" fill="none" stroke="#8D6E63" stroke-width="4" stroke-linecap="round"/>
      `, '0 0 64 64', 'qh-tile-svg');
    case 'sprout':
      return svgWrap(`
        <path d="M32 50 L32 26 M32 34 Q20 24 22 16 Q32 18 32 30 M32 32 Q44 22 42 14 Q32 16 32 28" fill="#66BB6A" stroke="#2E7D32" stroke-width="3" stroke-linecap="round"/>
      `, '0 0 64 64', 'qh-tile-svg');
  }
}
