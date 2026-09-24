import { xsalsa20poly1305 } from '@noble/ciphers/salsa.js';

import { fromBase64, newFamilyKey, open, seal, toBase64, toBase64Url } from '@/lib/crypto';

jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)) }));

describe('family encryption', () => {
  it('round-trips a record and hides the plaintext', () => {
    const key = newFamilyKey();
    const sealed = seal(key, { name: 'Babička', phone: '+420 777 123 456' });
    expect(sealed.ciphertext).not.toContain('Babi');
    expect(open(key, sealed)).toEqual({ name: 'Babička', phone: '+420 777 123 456' });
  });

  it('rejects another key and tampered data', () => {
    const sealed = seal(newFamilyKey(), 'secret');
    expect(() => open(newFamilyKey(), sealed)).toThrow();
    const key = newFamilyKey();
    const good = seal(key, 'secret');
    const bytes = fromBase64(good.ciphertext);
    bytes[bytes.length - 1] ^= 1;
    expect(() => open(key, { ...good, ciphertext: toBase64(bytes) })).toThrow();
  });

  it('uses a fresh nonce every time', () => {
    const key = newFamilyKey();
    expect(seal(key, 'x').nonce).not.toBe(seal(key, 'x').nonce);
  });

  it('uses the secretbox layout: ciphertext = plaintext + 16-byte tag', () => {
    const key = new Uint8Array(32).fill(7);
    const nonce = new Uint8Array(24).fill(9);
    const direct = xsalsa20poly1305(key, nonce).encrypt(new TextEncoder().encode('"hi"'));
    expect(xsalsa20poly1305(key, nonce).decrypt(direct)).toEqual(new TextEncoder().encode('"hi"'));
    expect(direct.length).toBe(4 + 16);
  });

  it('base64 helpers match Node', () => {
    const { Buffer } = require('buffer');
    for (const len of [0, 1, 2, 3, 31, 32, 33]) {
      const bytes = new Uint8Array(require('crypto').randomBytes(len));
      expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
      expect(toBase64Url(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
      expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
      expect(Array.from(fromBase64(toBase64Url(bytes)))).toEqual(Array.from(bytes));
    }
  });
});
