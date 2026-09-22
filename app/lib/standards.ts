import type { CountryItem, CountryRecommendation } from './checklist';

export type StandardMode = 'country' | 'strictest';

export type Standard = {
  mode: StandardMode;
  /** The user's own country code. */
  home: string;
  /** Merged recommendation used for the checklist and readiness target. */
  rec: CountryRecommendation;
  /** Which country each item's amount comes from (strictest mode). */
  origin: Record<string, string>;
  sources: CountryRecommendation['source'][];
};

/**
 * "country": the user's own country as-is.
 * "strictest": longest self-sufficiency period and, per item, the largest amount any country recommends.
 * Items only some countries list are included too. Labels prefer the user's country.
 */
export function buildStandard(
  mode: StandardMode,
  homeCountry: string,
  all: Record<string, CountryRecommendation>
): Standard {
  const home = all[homeCountry] ?? Object.values(all)[0];
  if (mode === 'country') {
    return {
      mode,
      home: home.country,
      rec: home,
      origin: Object.fromEntries(home.items.map((i) => [i.id, home.country])),
      sources: [home.source],
    };
  }

  const countries = [home, ...Object.values(all).filter((c) => c.country !== home.country)];
  const days = Math.max(...countries.map((c) => c.selfSufficiencyDays));
  const items = new Map<string, CountryItem>();
  const origin: Record<string, string> = {};

  for (const c of countries) {
    for (const item of c.items) {
      const current = items.get(item.id);
      if (!current) {
        items.set(item.id, item);
        origin[item.id] = c.country;
        continue;
      }
      if (isStricter(item, current)) {
        // Keep the home label, take the stricter quantity.
        items.set(item.id, { ...current, quantity: item.quantity, priority: stricterPriority(current, item) });
        origin[item.id] = c.country;
      } else if (item.priority === 'essential' && current.priority !== 'essential') {
        items.set(item.id, { ...current, priority: 'essential' });
      }
    }
  }

  return {
    mode,
    home: home.country,
    rec: {
      ...home,
      selfSufficiencyDays: days,
      items: [...items.values()],
      uncertain: countries.some((c) => (c as { uncertain?: boolean }).uncertain),
    } as CountryRecommendation,
    origin,
    sources: countries.map((c) => c.source),
  };
}

function isStricter(a: CountryItem, b: CountryItem): boolean {
  if (a.quantity.amount == null) return false;
  if (b.quantity.amount == null) return true;
  // Compare like with like; different bases/units are left as they are.
  if (a.quantity.basis !== b.quantity.basis || a.quantity.unit !== b.quantity.unit || a.quantity.perDay !== b.quantity.perDay) return false;
  return a.quantity.amount > b.quantity.amount;
}

function stricterPriority(a: CountryItem, b: CountryItem): CountryItem['priority'] {
  return a.priority === 'essential' || b.priority === 'essential' ? 'essential' : 'recommended';
}
