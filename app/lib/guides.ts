// Practical guides from official sources (data/guides.json): what food to keep at home, emergency bag.
import type { Localized } from './checklist';
import type { Household } from './repo';

import guides from '../../data/guides.json';

export type GuideItem = { id: string; label: Localized; note?: Localized };
export type GuideGroup = { id: string; label: Localized; pets?: boolean; items: GuideItem[] };
export type Guide = {
  source: { publisher: string; url: string; verifiedAt: string };
  intro: Localized;
  groups: GuideGroup[];
  tips: Localized[];
};

export const GUIDES = guides as Record<'food' | 'gobag', Guide>;
export type GuideId = keyof typeof GUIDES;

/** Pet groups only for households with pets. */
export function visibleGroups(guide: Guide, household: Household): GuideGroup[] {
  return guide.groups.filter((g) => !g.pets || household.pets > 0);
}

/** Checks are stored per guide in checklist_checks, keyed like a country code. */
export const guideCheckKey = (id: GuideId) => `GUIDE:${id}`;
