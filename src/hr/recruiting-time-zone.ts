/** Explicit UTC or a named zone supported by this browser's Intl runtime. */
export function supportsRecruitingTimeZone(zone: string): boolean {
  if (typeof zone !== 'string' || zone.length > 80 || !(zone === 'UTC' || /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+$/.test(zone)) || /^Etc\/GMT[+-]/.test(zone)) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0); return true } catch { return false }
}
