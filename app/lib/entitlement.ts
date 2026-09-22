import { LIMITS, type Tier } from './config';

// Placeholder until RevenueCat (M4): development builds get Plus so every feature can be tested,
// release builds are Free.
export function useTier(): Tier {
  return __DEV__ ? 'plus' : 'free';
}

export function useLimits() {
  return LIMITS[useTier()];
}
