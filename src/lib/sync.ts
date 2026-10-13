import type { AppData, Recurring } from '../types'
import { parseBudgets, parseRecurring, parseTransaction } from './storage'

export const EMPTY_DATA: AppData = { transactions: [], budgets: {}, recurring: [], currency: 'USD' }

/**
 * Checks data that came from outside the app's own state (an account in the cloud), keeping
 * only entries that pass the same checks as data saved on the device. Returns null if it
 * isn't app data at all.
 */
export function parseAppData(value: unknown): AppData | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const d = value as Record<string, unknown>
  const list = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    transactions: list(d.transactions).flatMap((t) => parseTransaction(t) ?? []),
    budgets: parseBudgets(d.budgets),
    recurring: list(d.recurring).flatMap((r) => parseRecurring(r) ?? []),
    currency: typeof d.currency === 'string' && /^[A-Z]{3}$/.test(d.currency) ? d.currency : 'USD',
  }
}

/**
 * The data as text in one fixed shape, so two copies with the same content always compare
 * equal (whatever order their fields were written in).
 */
export function serialize(data: AppData): string {
  return JSON.stringify(parseAppData(data))
}

/**
 * Combines this device's data with an account's, for the first time a device signs in.
 * Nothing is lost: transactions and recurring items from both are kept (matched by id), a
 * recurring item keeps the later of its two `lastMonth`s, and the account's budgets and
 * currency win where both have one.
 */
export function mergeData(device: AppData, account: AppData): AppData {
  const ids = new Set(account.transactions.map((t) => t.id))
  const recurring = new Map<string, Recurring>(account.recurring.map((r) => [r.id, r]))
  for (const r of device.recurring) {
    const existing = recurring.get(r.id)
    if (!existing || r.lastMonth > existing.lastMonth) recurring.set(r.id, r)
  }
  return {
    transactions: [...account.transactions, ...device.transactions.filter((t) => !ids.has(t.id))],
    budgets: { ...device.budgets, ...account.budgets },
    recurring: [...recurring.values()],
    // An account with nothing in it yet hasn't really chosen a currency.
    currency: isEmpty(account) ? device.currency : account.currency,
  }
}

/** True when there's nothing worth keeping: no transactions, budgets or recurring items. */
export function isEmpty(data: AppData): boolean {
  return data.transactions.length === 0 && data.recurring.length === 0 && Object.keys(data.budgets).length === 0
}
