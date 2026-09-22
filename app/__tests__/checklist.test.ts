import cz from '../../data/countries/cz.json';
import { CountryRecommendation, loc, scaleChecklist } from '@/lib/checklist';

const rec = cz as CountryRecommendation;

describe('checklist', () => {
  it('scales per-person daily amounts by persons and days', () => {
    const list = scaleChecklist(rec, { persons: 4, pets: 0 });
    expect(list.find((e) => e.id === 'water')?.totalAmount).toBe(24); // 2 l × 4 × 3 days
    expect(list.find((e) => e.id === 'food')?.totalAmount).toBe(12);
    expect(list.find((e) => e.id === 'medicines')?.totalAmount).toBe(28); // 7 days × 4, not per day
    expect(list.find((e) => e.id === 'radio')?.totalAmount).toBe(1);
    expect(list.find((e) => e.id === 'cash')?.totalAmount).toBeNull();
  });

  it('shows pet items only with pets', () => {
    expect(scaleChecklist(rec, { persons: 1, pets: 0 }).some((e) => e.id === 'pet_food')).toBe(false);
    expect(scaleChecklist(rec, { persons: 1, pets: 2 }).find((e) => e.id === 'pet_food')?.totalAmount).toBe(6);
  });

  it('localizes with English fallback', () => {
    expect(loc({ cs: 'Voda', en: 'Water' }, 'cs')).toBe('Voda');
    expect(loc({ cs: 'Voda', en: 'Water' }, 'de')).toBe('Water');
  });
});
