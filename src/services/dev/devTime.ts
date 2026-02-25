/**
 * Dev Time Utilities
 *
 * Provides a time-shifted `devNow()` that respects `simulateTimeShiftDays`.
 * All compliance-related date logic should call `devNow()` instead of `new Date()`.
 *
 * In production builds or when DevMode is disabled, `devNow()` === `new Date()`.
 */

import { addDays } from "date-fns";

let _timeShiftDays = 0;

export function setTimeShiftDays(days: number): void {
  _timeShiftDays = days;
}

export function getTimeShiftDays(): number {
  return _timeShiftDays;
}

export function devNow(): Date {
  return _timeShiftDays !== 0 ? addDays(new Date(), _timeShiftDays) : new Date();
}
