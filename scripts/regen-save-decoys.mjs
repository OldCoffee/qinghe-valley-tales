#!/usr/bin/env node
/**
 * 发版时轮换磁盘存档诱饵 schema：随机增删 2–5 个无关键，生成新 CURRENT_SCHEMA_ID，
 * 旧 schema 保留在 DECOY_SCHEMAS 中以便合法旧文件仍可解封。
 *
 * 用法：node scripts/regen-save-decoys.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, '../src/web/save-decoy-schema.ts');

const POOL = [
  'moonPhaseBias',
  'barnOwlCount',
  'riverSiltIndex',
  'hayloftEcho',
  'craneFeatherDrift',
  'lanternMothTicks',
  'wellDepthFable',
  'scarecrowGrin',
  'cloudSheepCount',
  'fencePostHum',
  'dewDropLedger',
  'hasOrchardMirage',
  'kilnAshIndex',
  'tidePoolWhisper',
  'groveEchoCode',
  'millstoneLull',
  'hasStarVeinHum',
  'coopDustFlag',
  'bridgePlankBias',
  'willowShadeName',
  'pondRippleTicks',
  'chimneySootIndex',
  'hasMarketBreeze',
  'lanternOilFable',
];

const src = fs.readFileSync(target, 'utf8');
const currentMatch = src.match(/export const CURRENT_SCHEMA_ID = '([^']+)'/);
if (!currentMatch) {
  console.error('Cannot find CURRENT_SCHEMA_ID');
  process.exit(1);
}
const oldId = currentMatch[1];

const schemasMatch = src.match(/export const DECOY_SCHEMAS: Record<string, readonly string\[]> = \{([\s\S]*?)\n\};/);
if (!schemasMatch) {
  console.error('Cannot find DECOY_SCHEMAS');
  process.exit(1);
}

/** @type {Record<string, string[]>} */
const schemas = {};
const entryRe = /\[CURRENT_SCHEMA_ID\]:\s*\[([\s\S]*?)\],|'([^']+)':\s*\[([\s\S]*?)\],/g;
let m;
const block = schemasMatch[1];
while ((m = entryRe.exec(block))) {
  if (m[1] !== undefined) {
    const keys = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    schemas[oldId] = keys;
  } else {
    const keys = [...m[3].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    schemas[m[2]] = keys;
  }
}

const prevKeys = schemas[oldId] ?? POOL.slice(0, 8);
const delta = 2 + Math.floor(Math.random() * 4); // 2..5
let next = [...prevKeys];

// 删
const toRemove = Math.min(delta, Math.max(0, next.length - 5));
for (let i = 0; i < toRemove; i++) {
  const idx = Math.floor(Math.random() * next.length);
  next.splice(idx, 1);
}
// 增
const available = POOL.filter((k) => !next.includes(k));
const toAdd = Math.min(delta, available.length);
for (let i = 0; i < toAdd; i++) {
  const idx = Math.floor(Math.random() * available.length);
  next.push(available.splice(idx, 1)[0]);
}
next = [...new Set(next)].sort();

const stamp = new Date();
const y = stamp.getFullYear();
const mo = String(stamp.getMonth() + 1).padStart(2, '0');
const da = String(stamp.getDate()).padStart(2, '0');
const hex = Math.floor(Math.random() * 0xffff)
  .toString(16)
  .padStart(4, '0');
const newId = `decoy-${y}${mo}${da}-${hex}`;

schemas[oldId] = prevKeys;
schemas[newId] = next;

const schemaBody = Object.entries(schemas)
  .map(([id, keys]) => {
    const list = keys.map((k) => `    '${k}',`).join('\n');
    if (id === newId) {
      return `  [CURRENT_SCHEMA_ID]: [\n${list}\n  ],`;
    }
    return `  '${id}': [\n${list}\n  ],`;
  })
  .join('\n');

const header = `/**
 * 磁盘存档诱饵字段 schema。
 * 发版时运行 \`node scripts/regen-save-decoys.mjs\` 轮换 CURRENT_SCHEMA_ID 与诱饵键；
 * 旧 schema 保留在 DECOY_SCHEMAS 中，以便合法旧导出文件仍可解封。
 */

export const CURRENT_SCHEMA_ID = '${newId}';

/** schemaId → 诱饵键名列表（集合必须与文件内 decoys 完全一致） */
export const DECOY_SCHEMAS: Record<string, readonly string[]> = {
${schemaBody}
};
`;

const restStart = src.indexOf('export type DecoyValue');
if (restStart < 0) {
  console.error('Cannot find DecoyValue export');
  process.exit(1);
}
const out = header + '\n' + src.slice(restStart);
fs.writeFileSync(target, out);
console.log(`Rotated decoy schema: ${oldId} → ${newId}`);
console.log(`Keys (${next.length}): ${next.join(', ')}`);
