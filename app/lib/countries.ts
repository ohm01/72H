import type { CountryRecommendation } from './checklist';

import cz from '../../data/countries/cz.json';
import fi from '../../data/countries/fi.json';
import pl from '../../data/countries/pl.json';
import sk from '../../data/countries/sk.json';

// Country recommendation files live in /data/countries (shared with docs and the server).
export const COUNTRIES: Record<string, CountryRecommendation> = {
  CZ: cz as CountryRecommendation,
  SK: sk as CountryRecommendation,
  PL: pl as CountryRecommendation,
  FI: fi as CountryRecommendation,
};
