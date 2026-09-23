import { LANGUAGES, resources } from '@/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'cs' }] }));

/** Flat list of "a.b.c" keys; plural forms (_one, _few…) count as their base key. */
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v ? keys(v, `${prefix}${k}.`) : [`${prefix}${k.replace(/_(zero|one|two|few|many|other)$/, '')}`]
  );
}

describe('translations', () => {
  const base = new Set(keys(resources.cs.translation));
  for (const lang of LANGUAGES) {
    it(`${lang} has every Czech key`, () => {
      const have = new Set(keys(resources[lang].translation));
      expect([...base].filter((k) => !have.has(k))).toEqual([]);
    });
  }
});
