import { COUNTRIES } from '@/lib/countries';
import { buildStandard } from '@/lib/standards';
import { scaleChecklist } from '@/lib/checklist';

describe('standards', () => {
  it('country mode returns the home country unchanged', () => {
    const s = buildStandard('country', 'CZ', COUNTRIES);
    expect(s.rec).toBe(COUNTRIES.CZ);
    expect(s.sources).toHaveLength(1);
  });

  it('strictest takes the longest period and largest amounts', () => {
    const s = buildStandard('strictest', 'CZ', COUNTRIES);
    expect(s.rec.selfSufficiencyDays).toBe(14); // SK blackout
    const water = s.rec.items.find((i) => i.id === 'water')!;
    expect(water.quantity.amount).toBe(4); // SK 4 l > PL 3 l > CZ/FI 2 l
    expect(s.origin.water).toBe('SK');
    expect(water.label.cs).toBe(COUNTRIES.CZ.items.find((i) => i.id === 'water')!.label.cs); // home label kept
    expect(s.rec.items.some((i) => i.id === 'warm_clothes')).toBe(true); // not in CZ, added
    expect(s.sources).toHaveLength(Object.keys(COUNTRIES).length);
  });

  it('keeps CZ amounts where others give none', () => {
    const s = buildStandard('strictest', 'CZ', COUNTRIES);
    expect(s.rec.items.find((i) => i.id === 'medicines')?.quantity.amount).toBe(7);
  });

  it('recalculates the checklist', () => {
    const cz = scaleChecklist(buildStandard('country', 'CZ', COUNTRIES).rec, { persons: 2, pets: 0 });
    const strict = scaleChecklist(buildStandard('strictest', 'CZ', COUNTRIES).rec, { persons: 2, pets: 0 });
    expect(cz.find((e) => e.id === 'water')?.totalAmount).toBe(12); // 2 l × 2 × 3
    expect(strict.find((e) => e.id === 'water')?.totalAmount).toBe(112); // 4 l × 2 × 14
  });
});
