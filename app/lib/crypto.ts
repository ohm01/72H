// End-to-end encryption of family data: XSalsa20-Poly1305 (= libsodium crypto_secretbox), family key never leaves devices.
import { xsalsa20poly1305 } from '@noble/ciphers/salsa.js';
import { getRandomBytes } from 'expo-crypto';

export const KEY_BYTES = 32;
const NONCE_BYTES = 24;

export function newFamilyKey(): Uint8Array {
  return getRandomBytes(KEY_BYTES);
}

export type Sealed = { nonce: string; ciphertext: string };

export function seal(key: Uint8Array, value: unknown): Sealed {
  const nonce = getRandomBytes(NONCE_BYTES);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  return { nonce: toBase64(nonce), ciphertext: toBase64(xsalsa20poly1305(key, nonce).encrypt(plaintext)) };
}

/** Throws if the data was changed or encrypted with another key. */
export function open<T>(key: Uint8Array, sealed: Sealed): T {
  const plaintext = xsalsa20poly1305(key, fromBase64(sealed.nonce)).decrypt(fromBase64(sealed.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let j = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('invalid base64');
    value = (value << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (value >> bits) & 255;
    }
  }
  return out;
}

/** URL-safe base64 without padding, for the key in invite links. */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
