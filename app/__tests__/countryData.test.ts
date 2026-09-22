import { COUNTRIES } from '@/lib/countries';
import { ITEM_TYPES } from '@/lib/repo';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'x' }));

describe('country data files', () => {
  for (const [code, rec] of Object.entries(COUNTRIES)) {
    it(`${code} is well-formed`, () => {
      expect(rec.country).toBe(code);
      expect(rec.selfSufficiencyDays).toBeGreaterThan(0);
      expect(rec.source.url).toMatch(/^https:\/\//);
      expect(rec.source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const ids = rec.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const item of rec.items) {
        expect(ITEM_TYPES).toContain(item.type);
        expect(item.label.cs && item.label.en).toBeTruthy();
        expect(['person', 'pet', 'household']).toContain(item.quantity.basis);
      }
      // Readiness needs water in litres and food in rations.
      expect(rec.items.find((i) => i.id === 'water')?.quantity.unit).toBe('l');
      expect(rec.items.find((i) => i.id === 'food')?.quantity.unit).toBe('ration');
    });
  }
});
