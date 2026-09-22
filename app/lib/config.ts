// Single source of truth for tiers, prices and limits.
// Payments arrive in M4; until then see lib/entitlement.ts.

export const PRODUCTS = {
  plusYearly: { id: '72h.plus.yearly', priceCzk: 100, period: 'year' },
  supporterYearly: { id: '72h.supporter.yearly', priceCzk: 249, period: 'year' },
  lifetime: { id: '72h.lifetime', priceCzk: 299, period: 'lifetime' },
} as const;

// All paid products grant the same entitlement.
export const ENTITLEMENT_ID = 'plus';

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

export const LIMITS: Record<Tier, Limits> = {
  free: {
    familyMembers: 4,
    stockItems: 30,
    stockLocations: 1,
    meetingPoints: 1,
    mapAreas: 1,
    mapAreaMaxKm2: 500,
    mapDownloadsPerMonth: 2,
    expiryReminders: false,
    familyLocation: false,
  },
  plus: {
    familyMembers: 8,
    stockItems: Infinity,
    stockLocations: Infinity,
    meetingPoints: Infinity,
    mapAreas: 5,
    mapAreaMaxKm2: 5000,
    mapDownloadsPerMonth: 10,
    expiryReminders: true,
    familyLocation: true,
  },
};

// Expiry thresholds (days) for colors and reminders.
export const EXPIRY_RED_DAYS = 7;
export const EXPIRY_ORANGE_DAYS = 30;
export const REMINDER_DAYS_BEFORE = [30, 7] as const;
export const REMINDER_HOUR = 9;

// Default country standard for the checklist.
export const DEFAULT_COUNTRY = 'CZ';
