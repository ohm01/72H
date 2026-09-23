// Pure rules for choosing and downloading offline map areas (tested without native modules).
import type { Limits } from './config';
import { bboxAreaKm2 } from './geo';
import { type BBox, bboxAround } from './mapStyle';

/** Half-side of the square the user can pick, km. 11 km ≈ 484 km² fits the free 500 km² limit. */
export const RADIUS_OPTIONS_KM = [3, 5, 8, 11, 20, 35] as const;

export const areaOf = (b: BBox) => bboxAreaKm2(b.west, b.south, b.east, b.north);

export type RadiusOption = { radiusKm: number; bbox: BBox; areaKm2: number; allowed: boolean };

/** All radius choices around a point, with their real area and whether the tier allows them. */
export function radiusOptions(lat: number, lon: number, maxKm2: number): RadiusOption[] {
  return RADIUS_OPTIONS_KM.map((radiusKm) => {
    const bbox = bboxAround(lat, lon, radiusKm);
    const areaKm2 = areaOf(bbox);
    return { radiusKm, bbox, areaKm2, allowed: areaKm2 <= maxKm2 };
  });
}

export type DownloadBlock = 'areas' | 'downloads' | null;

/** Why a new download is not possible right now (null = allowed). */
export function downloadBlock(limits: Limits, areaCount: number, downloadsThisMonth: number): DownloadBlock {
  if (areaCount >= limits.mapAreas) return 'areas';
  if (downloadsThisMonth >= limits.mapDownloadsPerMonth) return 'downloads';
  return null;
}

/** First day of next month: when the monthly download counter resets. */
export function downloadsResetDate(today = new Date()): Date {
  return new Date(today.getFullYear(), today.getMonth() + 1, 1);
}
