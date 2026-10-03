/**
 * Calendar dates must follow the device's clock, not UTC: `toISOString()` rolls over
 * at 05:30 IST, so an early-morning session would be filed under the previous day.
 */
export function toLocalDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayLocalDate(): string {
  return toLocalDate(new Date());
}

/** Adds whole months without the Jan 31 -> Mar 3 overflow of setMonth(). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(targetDay, lastDayOfTargetMonth));
  return result;
}
