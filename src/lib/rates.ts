import type { AppData } from '../types'

/**
 * Exchange rates as "how many of each currency one euro buys", from the European Central
 * Bank's daily reference rates (via frankfurter.dev, which needs no account). Converting
 * between two other currencies goes through the euro.
 */
export interface Rates {
  /** The day the ECB published these rates, YYYY-MM-DD. */
  date: string
  perEur: Record<string, number>
}

/**
 * Built-in rates, used until fresh ones arrive and whenever the rates service can't be
 * reached, so conversion always works (just less up to date).
 */
export const FALLBACK_RATES: Rates = {
  date: '2026-10-12',
  perEur: {
    EUR: 1,
    USD: 1.1181,
    GBP: 0.84478,
    MYR: 4.5663,
    SGD: 1.4314,
    AUD: 1.6032,
    CAD: 1.5946,
    JPY: 177.33,
    INR: 107.086,
    CNY: 7.4832,
  },
}

const RATES_URL = 'https://api.frankfurter.dev/v1/latest?base=EUR'
const CACHE_KEY = 'fts.rates.v1'
/** Fresh rates are fetched when the saved ones are older than this (the ECB publishes once a day). */
export const RATES_MAX_AGE_MS = 12 * 60 * 60 * 1000

/** How many `to` one `from` buys, or null if either currency has no rate. */
export function rateBetween(from: string, to: string, rates: Rates): number | null {
  const a = rates.perEur[from]
  const b = rates.perEur[to]
  return a && b ? b / a : null
}

/** Converts an amount in cents. Anything above zero stays at least 1 cent, so it stays a valid amount. */
export function convertCents(cents: number, rate: number): number {
  return Math.max(1, Math.round(cents * rate))
}

/**
 * All the data with every amount (transactions, budgets, monthly items) converted from its
 * current currency to `to`. Returns null if there's no rate for the pair.
 */
export function convertData(data: AppData, to: string, rates: Rates): AppData | null {
  const rate = rateBetween(data.currency, to, rates)
  if (rate === null) return null
  return {
    ...data,
    currency: to,
    transactions: data.transactions.map((t) => ({ ...t, amountCents: convertCents(t.amountCents, rate) })),
    recurring: data.recurring.map((r) => ({ ...r, amountCents: convertCents(r.amountCents, rate) })),
    budgets: Object.fromEntries(Object.entries(data.budgets).map(([c, cents]) => [c, convertCents(cents, rate)])),
  }
}

/** Checks rates from the service or from the saved copy; null if they aren't usable. */
export function parseRates(value: unknown): Rates | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const date = v.date
  const raw = v.perEur ?? v.rates
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (typeof raw !== 'object' || raw === null) return null
  const perEur: Record<string, number> = { EUR: 1 }
  for (const [code, rate] of Object.entries(raw)) {
    if (/^[A-Z]{3}$/.test(code) && typeof rate === 'number' && Number.isFinite(rate) && rate > 0) perEur[code] = rate
  }
  return Object.keys(perEur).length > 1 ? { date, perEur } : null
}

interface CachedRates {
  rates: Rates
  /** When this device fetched them (ms since 1970), to know when to fetch again. */
  fetchedAt: number
}

export function loadCachedRates(storage: Storage = localStorage): CachedRates | null {
  try {
    const value = JSON.parse(storage.getItem(CACHE_KEY) ?? 'null') as Record<string, unknown> | null
    const rates = parseRates(value?.rates)
    return rates && typeof value?.fetchedAt === 'number' ? { rates, fetchedAt: value.fetchedAt } : null
  } catch {
    return null
  }
}

export function saveCachedRates(cached: CachedRates, storage: Storage = localStorage): void {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(cached))
  } catch {
    // Not critical: the next visit just fetches again.
  }
}

/** Fetches today's ECB rates. Only the rates are requested; nothing about the person is sent. */
export async function fetchRates(): Promise<Rates> {
  const response = await fetch(RATES_URL)
  if (!response.ok) throw new Error(`Rates service answered ${response.status}`)
  const rates = parseRates(await response.json())
  if (!rates) throw new Error('Rates service sent something unexpected')
  return rates
}
