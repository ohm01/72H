// Country recommendations (data/countries/*.json) scaled to the household.

export type Localized = { cs: string; en: string; [lang: string]: string };

export type QuantityBasis = 'person' | 'pet' | 'household';

export type CountryItem = {
  id: string;
  type: string;
  priority: 'essential' | 'recommended';
  quantity: { basis: QuantityBasis; amount: number | null; unit: string | null; perDay: boolean };
  label: Localized;
  note?: Localized;
  uncertain?: boolean;
};

export type CountryRecommendation = {
  country: string;
  name: Localized;
  selfSufficiencyDays: number;
  source: { publisher: string; title: Localized; url: string; relatedUrls?: string[]; verifiedAt: string };
  notes?: Localized;
  items: CountryItem[];
};

export type Household = { persons: number; pets: number };

export type ChecklistEntry = CountryItem & {
  /** Total amount for the household, or null when the source gives no amount. */
  totalAmount: number | null;
};

export function scaleChecklist(rec: CountryRecommendation, household: Household): ChecklistEntry[] {
  return rec.items
    .filter((item) => item.quantity.basis !== 'pet' || household.pets > 0)
    .map((item) => {
      const { basis, amount, perDay } = item.quantity;
      if (amount == null) return { ...item, totalAmount: null };
      const count = basis === 'person' ? household.persons : basis === 'pet' ? household.pets : 1;
      const days = perDay ? rec.selfSufficiencyDays : 1;
      return { ...item, totalAmount: amount * count * days };
    });
}

/** Pick the localized string, falling back to English. */
export function loc(text: Localized | undefined, lang: string): string {
  if (!text) return '';
  return text[lang] ?? text.en;
}
