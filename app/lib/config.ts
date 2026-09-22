// Tiers, prices and limits come from /config/tiers.json (shared with the server).
// Payments arrive in M4; until then see lib/entitlement.ts.
import tiers from '../../config/tiers.json';

export type Tier = 'free' | 'plus';

export type Limits = {
  familyMembers: number;
  stockItems: number;
  stockLocations: number;
  meetingPoints: number;
  mapAreas: number;
  mapAreaMaxKm2: number;
  mapDownloadsPerMonth: number;
  expiryReminders: boolean;
  familyLocation: boolean;
};

type RawLimits = { [K in keyof Limits]: Limits[K] extends number ? number | null : boolean };

// JSON has no Infinity: null means unlimited.
function toLimits(raw: RawLimits): Limits {
  const out = {} as Record<string, number | boolean>;
  for (const [k, v] of Object.entries(raw)) out[k] = v === null ? Infinity : v;
  return out as Limits;
}

export const PRODUCTS = tiers.products;
export const ENTITLEMENT_ID = tiers.entitlementId;
export const LIMITS: Record<Tier, Limits> = {
  free: toLimits(tiers.limits.free),
  plus: toLimits(tiers.limits.plus),
};

// Expiry thresholds (days) for colors and reminders.
export const EXPIRY_RED_DAYS = 7;
export const EXPIRY_ORANGE_DAYS = 30;
export const REMINDER_DAYS_BEFORE = [30, 7] as const;
export const REMINDER_HOUR = 9;

// Default country standard for the checklist.
export const DEFAULT_COUNTRY = 'CZ';
