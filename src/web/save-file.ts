import { SAVE_VERSION } from '../data/config.js';
import type { GameState } from '../engine/types.js';
import {
  CURRENT_SCHEMA_ID,
  buildDecoys,
  decoysMatchState,
  type DecoyValue,
} from './save-decoy-schema.js';

/** 与 package.json version 同步；发版 bump 时一并改 */
export const APP_VERSION = '1.0.6';

const MAGIC = 'QINGHE1';
const PEPPER = 'qinghe-valley-tales::disk-save::v1::star-vein-pepper';
const PBKDF2_ITERS = 120_000;

function asBufferSource(u8: Uint8Array): BufferSource {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export type SaveUnsealFail = 'format' | 'crypto' | 'mac' | 'schema' | 'state';

export interface SaveSlotMeta {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface SaveExportPayload {
  appVersion: string;
  saveVersion: number;
  schemaId: string;
  exportedAt: number;
  slotMeta: SaveSlotMeta;
  state: GameState;
  decoys: Record<string, DecoyValue>;
}

export type UnsealResult =
  | { ok: true; payload: SaveExportPayload }
  | { ok: false; reason: SaveUnsealFail };

interface Envelope {
  magic: string;
  schemaId: string;
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
}

function bytesToB64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = sortKeysDeep(obj[k]);
    return out;
  }
  return value;
}

/** 稳定序列化 GameState，供诱饵派生与交叉校验 */
export function canonicalStateJson(state: GameState): string {
  return JSON.stringify(sortKeysDeep(state));
}

function textEncoder(): TextEncoder {
  return new TextEncoder();
}

async function deriveAesKey(salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', textEncoder().encode(PEPPER), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBufferSource(salt), iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function deriveHmacKey(salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', textEncoder().encode(`${PEPPER}::hmac`), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBufferSource(salt), iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    base,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function looksLikeGameState(data: unknown): data is GameState {
  if (!data || typeof data !== 'object') return false;
  const s = data as GameState;
  return (
    typeof s.version === 'number' &&
    typeof s.gold === 'number' &&
    typeof s.year === 'number' &&
    typeof s.day === 'number' &&
    Array.isArray(s.farm) &&
    typeof s.inventory === 'object' &&
    s.inventory !== null
  );
}

export async function sealSavePayload(
  slot: SaveSlotMeta & { state: GameState },
  appVersion: string = APP_VERSION,
): Promise<string> {
  const schemaId = CURRENT_SCHEMA_ID;
  const stateJson = canonicalStateJson(slot.state);
  const decoys = buildDecoys(schemaId, stateJson);
  if (!decoys) throw new Error('missing decoy schema');

  const payload: SaveExportPayload = {
    appVersion,
    saveVersion: SAVE_VERSION,
    schemaId,
    exportedAt: Date.now(),
    slotMeta: { id: slot.id, createdAt: slot.createdAt, updatedAt: slot.updatedAt },
    state: slot.state,
    decoys,
  };

  const plain = textEncoder().encode(JSON.stringify(payload));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKey(salt);
  const hmacKey = await deriveHmacKey(salt);

  const macBuf = await crypto.subtle.sign('HMAC', hmacKey, plain);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBufferSource(iv) }, aesKey, plain);

  const envelope: Envelope = {
    magic: MAGIC,
    schemaId,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(cipherBuf),
    mac: bytesToB64(macBuf),
  };
  return JSON.stringify(envelope, null, 0);
}

export async function unsealSaveFile(text: string): Promise<UnsealResult> {
  let envelope: Envelope;
  try {
    envelope = JSON.parse(text) as Envelope;
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (
    !envelope ||
    envelope.magic !== MAGIC ||
    typeof envelope.schemaId !== 'string' ||
    typeof envelope.salt !== 'string' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.ciphertext !== 'string' ||
    typeof envelope.mac !== 'string'
  ) {
    return { ok: false, reason: 'format' };
  }

  let plain: Uint8Array;
  try {
    const salt = b64ToBytes(envelope.salt);
    const iv = b64ToBytes(envelope.iv);
    const cipher = b64ToBytes(envelope.ciphertext);
    const mac = b64ToBytes(envelope.mac);
    const aesKey = await deriveAesKey(salt);
    const hmacKey = await deriveHmacKey(salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) },
      aesKey,
      asBufferSource(cipher),
    );
    plain = new Uint8Array(decrypted);
    const macOk = await crypto.subtle.verify('HMAC', hmacKey, asBufferSource(mac), asBufferSource(plain));
    if (!macOk) return { ok: false, reason: 'mac' };
  } catch {
    return { ok: false, reason: 'crypto' };
  }

  let payload: SaveExportPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(plain)) as SaveExportPayload;
  } catch {
    return { ok: false, reason: 'format' };
  }

  if (
    !payload ||
    payload.schemaId !== envelope.schemaId ||
    typeof payload.appVersion !== 'string' ||
    payload.saveVersion !== SAVE_VERSION ||
    !payload.slotMeta ||
    typeof payload.slotMeta.id !== 'string' ||
    !looksLikeGameState(payload.state)
  ) {
    return { ok: false, reason: 'state' };
  }

  const stateJson = canonicalStateJson(payload.state);
  if (!decoysMatchState(payload.schemaId, payload.decoys ?? {}, stateJson)) {
    return { ok: false, reason: 'schema' };
  }

  return { ok: true, payload };
}

export function downloadQingheFile(contents: string, filename: string): void {
  const blob = new Blob([contents], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.qinghe') ? filename : `${filename}.qinghe`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function suggestExportFilename(playerName: string, updatedAt: number): string {
  const safe = (playerName || '农场主').replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 24);
  const d = new Date(updatedAt);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `qinghe-${safe}-${stamp}.qinghe`;
}
