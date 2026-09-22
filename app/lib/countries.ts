import type { CountryRecommendation } from './checklist';

import cz from '../../data/countries/cz.json';

// Country recommendation files live in /data/countries (shared with docs and the server).
export const COUNTRIES: Record<string, CountryRecommendation> = {
  CZ: cz as CountryRecommendation,
};
