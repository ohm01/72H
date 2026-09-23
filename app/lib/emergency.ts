// Emergency numbers and helplines for the home country (data/emergency.json, official sources).
import type { Localized } from './checklist';

import data from '../../data/emergency.json';

export type PhoneEntry = { number: string; label: Localized; note?: Localized };
export type Emergency = {
  source?: { publisher: string; url: string; verifiedAt: string };
  numbers: PhoneEntry[];
  helplines: PhoneEntry[];
};

const EU_112: PhoneEntry = {
  number: '112',
  label: { cs: 'Tísňové volání (EU)', en: 'Emergency (EU)', sk: 'Tiesňové volanie (EÚ)', pl: 'Numer alarmowy (UE)', fi: 'Hätänumero (EU)' },
};

/** Verified national list, or just 112 (valid in the whole EU) until a source is added. */
export function emergencyFor(country: string): Emergency {
  const entry = (data as Record<string, unknown>)[country] as Emergency | undefined;
  return entry?.numbers ? entry : { numbers: [EU_112], helplines: [] };
}
