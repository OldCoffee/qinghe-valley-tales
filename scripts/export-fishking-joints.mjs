#!/usr/bin/env node
/**
 * 从 fishKingTheaterLayers 导出 192×88 透明底关节/环境 PNG，
 * 供 EffectCraft / VectorCraft 同源贴图使用。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// 通过 tsx 注册后动态 import TypeScript 源
const { fishKingTheaterLayers, worldMapPixelLayers, playerMapWalkerLayers } = await import(path.join(root, 'src/web/icons.ts'));

const OUT =
  process.env.FISHKING_JOINTS_OUT ||
  '/Users/huangyangfeng/craft-work-storytold/outputs/fishking-joints';

const FISH_IDS = ['legend', 'ancient_sturgeon', 'mirror_dragonfish', 'abyss_oarfish'];

const LAYER_ORDER = [
  'fk-env-bg',
  'fk-env-sky',
  'fk-env-flora-b',
  'fk-env-caustics',
  'fk-env-wave-far',
  'fk-env-wave-mid',
  'fk-env-wave-near',
  'fk-env-flora-f',
  'fk-env-wake-u',
  'fk-env-wake-d',
  'fk-part-tail',
  'fk-part-torso-r',
  'fk-part-dorsal',
  'fk-part-pelvic',
  'fk-part-torso-f',
  'fk-part-pectoral',
  'fk-part-head',
  'fk-part-barbel-u',
  'fk-part-barbel-d',
  'fk-env-splash',
];

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = crcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function parseHex(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

function gridToRgba(g, w, h) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      const i = (y * w + x) * 4;
      if (!c) {
        rgba[i] = 0;
        rgba[i + 1] = 0;
        rgba[i + 2] = 0;
        rgba[i + 3] = 0;
      } else {
        const [r, gch, b, a] = parseHex(c);
        rgba[i] = r;
        rgba[i + 1] = gch;
        rgba[i + 2] = b;
        rgba[i + 3] = a;
      }
    }
  }
  return rgba;
}

function compositeLayers(layers, keys, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (const key of keys) {
    const g = layers[key];
    if (!g) continue;
    const src = gridToRgba(g, w, h);
    for (let i = 0; i < out.length; i += 4) {
      const a = src[i + 3];
      if (a === 0) continue;
      if (a === 255 || out[i + 3] === 0) {
        out[i] = src[i];
        out[i + 1] = src[i + 1];
        out[i + 2] = src[i + 2];
        out[i + 3] = a;
      } else {
        const oa = out[i + 3] / 255;
        const sa = a / 255;
        const na = sa + oa * (1 - sa);
        out[i] = Math.round((src[i] * sa + out[i] * oa * (1 - sa)) / na);
        out[i + 1] = Math.round((src[i + 1] * sa + out[i + 1] * oa * (1 - sa)) / na);
        out[i + 2] = Math.round((src[i + 2] * sa + out[i + 2] * oa * (1 - sa)) / na);
        out[i + 3] = Math.round(na * 255);
      }
    }
  }
  return out;
}

function writePng(filePath, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, png);
}

function scaleNearest(rgba, w, h, scale) {
  const sw = w * scale;
  const sh = h * scale;
  const out = Buffer.alloc(sw * sh * 4);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const sx = Math.floor(x / scale);
      const sy = Math.floor(y / scale);
      const si = (sy * w + sx) * 4;
      const di = (y * sw + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return { w: sw, h: sh, rgba: out };
}

let written = 0;
for (const fishId of FISH_IDS) {
  const { w, h, layers } = fishKingTheaterLayers(fishId);
  const dir = path.join(OUT, fishId);
  fs.mkdirSync(dir, { recursive: true });

  for (const key of LAYER_ORDER) {
    const g = layers[key];
    if (!g) continue;
    const rgba = gridToRgba(g, w, h);
    writePng(path.join(dir, `${key}.png`), w, h, rgba);
    written++;
  }

  const full = compositeLayers(layers, LAYER_ORDER, w, h);
  writePng(path.join(dir, 'full.png'), w, h, full);
  const x3 = scaleNearest(full, w, h, 3);
  writePng(path.join(dir, 'full-3x.png'), x3.w, x3.h, x3.rgba);
  written += 2;

  // 九关节拆解条（仅鱼身关节，横向拼 3x）
  const jointKeys = LAYER_ORDER.filter((k) => k.startsWith('fk-part-'));
  const cellW = w;
  const cellH = h;
  const sheetW = cellW * jointKeys.length;
  const sheetH = cellH;
  const sheet = Buffer.alloc(sheetW * sheetH * 4);
  jointKeys.forEach((key, idx) => {
    const rgba = gridToRgba(layers[key], w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4;
        const di = (y * sheetW + idx * cellW + x) * 4;
        sheet[di] = rgba[si];
        sheet[di + 1] = rgba[si + 1];
        sheet[di + 2] = rgba[si + 2];
        sheet[di + 3] = rgba[si + 3];
      }
    }
  });
  const sheet3 = scaleNearest(sheet, sheetW, sheetH, 3);
  writePng(path.join(dir, 'joints-strip-3x.png'), sheet3.w, sheet3.h, sheet3.rgba);
  written++;
}

// 总览板：四王 3x 竖排
const boardW = 192 * 3;
const boardH = 88 * 3 * FISH_IDS.length;
const board = Buffer.alloc(boardW * boardH * 4);
FISH_IDS.forEach((fishId, fi) => {
  const { w, h, layers } = fishKingTheaterLayers(fishId);
  const full = compositeLayers(layers, LAYER_ORDER, w, h);
  const x3 = scaleNearest(full, w, h, 3);
  for (let y = 0; y < x3.h; y++) {
    for (let x = 0; x < x3.w; x++) {
      const si = (y * x3.w + x) * 4;
      const di = ((fi * x3.h + y) * boardW + x) * 4;
      board[di] = x3.rgba[si];
      board[di + 1] = x3.rgba[si + 1];
      board[di + 2] = x3.rgba[si + 2];
      board[di + 3] = x3.rgba[si + 3];
    }
  }
});
const boardPath = path.join(OUT, '..', 'qinghe-pixel-fishking-theater-v5-board.png');
writePng(boardPath, boardW, boardH, board);
written++;

// 导出 256×144《青禾谷星脉全图》像素层与 3x 全景图（768×432）
const mapOrder = [
  'wm-terrain',
  'wm-water',
  'wm-flora',
  'wm-rails',
  'wm-landmarks',
  'wm-veins',
  'wm-frame',
];
const mapData = worldMapPixelLayers({ hasMinecart: true, hasGreenhouse: true });
const mapDir = path.join(OUT, '..', 'worldmap-layers');
fs.mkdirSync(mapDir, { recursive: true });
for (const mk of mapOrder) {
  const rgba = gridToRgba(mapData.layers[mk], mapData.w, mapData.h);
  writePng(path.join(mapDir, `${mk}.png`), mapData.w, mapData.h, rgba);
  written++;
}
const mapFull = compositeLayers(mapData.layers, mapOrder, mapData.w, mapData.h);
writePng(path.join(OUT, '..', 'qinghe-pixel-world-map-1x.png'), mapData.w, mapData.h, mapFull);
const map3x = scaleNearest(mapFull, mapData.w, mapData.h, 3);
const map3xPath = path.join(OUT, '..', 'qinghe-pixel-world-map-3x.png');
writePng(map3xPath, map3x.w, map3x.h, map3x.rgba);
written += 2;

// 导出 24×24 主角全身多关节像素行者（男/女）
const walkerOrder = [
  'pw-shadow',
  'pw-dust',
  'pw-arm-b',
  'pw-leg-b',
  'pw-torso',
  'pw-head',
  'pw-leg-f',
  'pw-arm-f',
];
const walkerDir = path.join(OUT, '..', 'walker-joints');
for (const gender of ['male', 'female']) {
  const wData = playerMapWalkerLayers(gender);
  const gDir = path.join(walkerDir, gender);
  fs.mkdirSync(gDir, { recursive: true });
  for (const wk of walkerOrder) {
    const rgba = gridToRgba(wData.layers[wk], wData.w, wData.h);
    const s3 = scaleNearest(rgba, wData.w, wData.h, 3);
    writePng(path.join(gDir, `${wk}-3x.png`), s3.w, s3.h, s3.rgba);
    written++;
  }
  const wFull = compositeLayers(wData.layers, walkerOrder, wData.w, wData.h);
  const w4x = scaleNearest(wFull, wData.w, wData.h, 4);
  writePng(path.join(walkerDir, `walker-${gender}-4x.png`), w4x.w, w4x.h, w4x.rgba);
  written++;
}

console.log(`Wrote ${written} PNGs under ${OUT}`);
console.log(`Board: ${boardPath}`);
console.log(`WorldMap 3x: ${map3xPath}`);
void require;
