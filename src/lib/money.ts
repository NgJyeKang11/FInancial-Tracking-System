/**
 * Converts user input like "12.5" or "1,200.99" into whole cents.
 * Returns null for anything that isn't a positive amount with at most 2 decimals.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null

  const [whole, fraction = ''] = cleaned.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return cents > 0 && Number.isSafeInteger(cents) ? cents : null
}

/** Formats cents as currency text, e.g. 123456 -> "$1,234.56". */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
}

/** Turns cents back into an editable string, e.g. 1250 -> "12.50". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2)
}
