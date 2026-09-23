import { GUIDES, visibleGroups } from '@/lib/guides';
import { LANGUAGES } from '@/i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'cs' }] }));

describe('guides data', () => {
  for (const [id, guide] of Object.entries(GUIDES)) {
    it(`${id} is well-formed and translated`, () => {
      expect(guide.source.url).toMatch(/^https:\/\/72h\.gov\.cz\//);
      const ids = guide.groups.flatMap((g) => g.items.map((i) => i.id));
      expect(new Set(ids).size).toBe(ids.length);
      const texts = [guide.intro, ...guide.tips, ...guide.groups.flatMap((g) => [g.label, ...g.items.flatMap((i) => [i.label, i.note].filter(Boolean))])];
      for (const text of texts) for (const lang of LANGUAGES) expect(text![lang]).toBeTruthy();
    });
  }

  it('shows the pets group only with pets', () => {
    const ids = (pets: number) => visibleGroups(GUIDES.gobag, { persons: 2, pets }).map((g) => g.id);
    expect(ids(0)).not.toContain('pets');
    expect(ids(1)).toContain('pets');
  });
});
