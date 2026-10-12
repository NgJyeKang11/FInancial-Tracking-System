const pad = (n: number) => String(n).padStart(2, '0')

/** Today's date in the user's local time zone, as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "2026-10-12" -> "2026-10" */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** Number of days in a "YYYY-MM" month. */
export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number)
  // Day 0 of the next month is the last day of this month.
  return new Date(year, m, 0).getDate()
}

/** Builds a Date at local midnight so formatting doesn't shift across time zones. */
function toLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "2026-10-12" -> "Mon, 12 Oct 2026" (in the user's locale). */
export function formatDayHeading(date: string): string {
  return toLocalDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "2026-10" -> "October 2026" (in the user's locale). */
export function formatMonth(month: string): string {
  return toLocalDate(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
