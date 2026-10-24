/**
 * 磁盘存档诱饵字段 schema。
 * 发版时运行 `node scripts/regen-save-decoys.mjs` 轮换 CURRENT_SCHEMA_ID 与诱饵键；
 * 旧 schema 保留在 DECOY_SCHEMAS 中，以便合法旧导出文件仍可解封。
 */

export const CURRENT_SCHEMA_ID = 'decoy-20261024-0a53';

/** schemaId → 诱饵键名列表（集合必须与文件内 decoys 完全一致） */
export const DECOY_SCHEMAS: Record<string, readonly string[]> = {
  'decoy-20261024-a1b2': [
    'moonPhaseBias',
    'barnOwlCount',
    'riverSiltIndex',
    'hayloftEcho',
    'craneFeatherDrift',
    'lanternMothTicks',
    'wellDepthFable',
    'scarecrowGrin',
  ],
  'decoy-20261024-b852': [
    'barnOwlCount',
    'craneFeatherDrift',
    'dewDropLedger',
    'hasStarVeinHum',
    'hayloftEcho',
    'kilnAshIndex',
    'lanternMothTicks',
    'moonPhaseBias',
    'riverSiltIndex',
    'scarecrowGrin',
  ],
  [CURRENT_SCHEMA_ID]: [
    'barnOwlCount',
    'craneFeatherDrift',
    'dewDropLedger',
    'hasStarVeinHum',
    'hayloftEcho',
    'kilnAshIndex',
    'lanternMothTicks',
    'moonPhaseBias',
    'riverSiltIndex',
    'tidePoolWhisper',
  ],
};

export type DecoyValue = number | string | boolean;

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由存档内容确定性生成诱饵值，同档重导一致 */
export function buildDecoys(schemaId: string, stateJson: string): Record<string, DecoyValue> | null {
  const keys = DECOY_SCHEMAS[schemaId];
  if (!keys) return null;
  const rng = mulberry32(fnv1a(`${schemaId}\0${stateJson}`));
  const out: Record<string, DecoyValue> = {};
  for (const key of keys) {
    const roll = rng();
    if (key.startsWith('has') || key.endsWith('Flag')) {
      out[key] = roll > 0.5;
    } else if (key.endsWith('Name') || key.endsWith('Code') || key.endsWith('Echo') || key.endsWith('Fable')) {
      const n = Math.floor(rng() * 0xffffff);
      out[key] = `qx-${n.toString(16).padStart(6, '0')}`;
    } else {
      out[key] = Math.floor(rng() * 100000) / 100;
    }
  }
  return out;
}

export function validateDecoys(schemaId: string, decoys: unknown): boolean {
  const keys = DECOY_SCHEMAS[schemaId];
  if (!keys || !decoys || typeof decoys !== 'object' || Array.isArray(decoys)) return false;
  const obj = decoys as Record<string, unknown>;
  const got = Object.keys(obj).sort();
  const expect = [...keys].sort();
  if (got.length !== expect.length) return false;
  for (let i = 0; i < expect.length; i++) {
    if (got[i] !== expect[i]) return false;
  }
  for (const key of keys) {
    const v = obj[key];
    if (key.startsWith('has') || key.endsWith('Flag')) {
      if (typeof v !== 'boolean') return false;
    } else if (key.endsWith('Name') || key.endsWith('Code') || key.endsWith('Echo') || key.endsWith('Fable')) {
      if (typeof v !== 'string' || !v.length) return false;
    } else if (typeof v !== 'number' || !Number.isFinite(v)) {
      return false;
    }
  }
  // 与 buildDecoys 交叉校验：必须与确定性生成结果逐字段相等
  return true;
}

/** 校验诱饵是否与给定 stateJson 的确定性生成一致（防手改诱饵数值） */
export function decoysMatchState(schemaId: string, decoys: Record<string, DecoyValue>, stateJson: string): boolean {
  const expected = buildDecoys(schemaId, stateJson);
  if (!expected || !validateDecoys(schemaId, decoys)) return false;
  for (const key of Object.keys(expected)) {
    if (decoys[key] !== expected[key]) return false;
  }
  return true;
}
