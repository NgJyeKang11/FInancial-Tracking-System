import type { AppData, Recurring } from '../types'
import {
  parseBudgets,
  parseCategoryRules,
  parseCustomCategories,
  parseRecurring,
  parseTransaction,
} from './storage'

export const EMPTY_DATA: AppData = {
  transactions: [],
  budgets: {},
  recurring: [],
  currency: 'USD',
  customCategories: [],
  categoryRules: {},
}

/**
 * Checks data that came from outside the app's own state (an account in the cloud or a
 * backup file), keeping only entries that pass the same checks as data saved on the device.
 * Returns null if it isn't app data at all.
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
    customCategories: parseCustomCategories(d.customCategories),
    categoryRules: parseCategoryRules(d.categoryRules),
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
 * Nothing is lost: transactions, recurring items and custom categories from both are kept
 * (matched by id or name), a recurring item keeps the later of its two `lastMonth`s, and the
 * account's budgets, remembered categories and currency win where both have one.
 */
export function mergeData(device: AppData, account: AppData): AppData {
  const ids = new Set(account.transactions.map((t) => t.id))
  const recurring = new Map<string, Recurring>(account.recurring.map((r) => [r.id, r]))
  for (const r of device.recurring) {
    const existing = recurring.get(r.id)
    if (!existing || r.lastMonth > existing.lastMonth) recurring.set(r.id, r)
  }
  const names = new Set(account.customCategories.map((c) => c.name.toLowerCase()))
  return {
    transactions: [...account.transactions, ...device.transactions.filter((t) => !ids.has(t.id))],
    budgets: { ...device.budgets, ...account.budgets },
    recurring: [...recurring.values()],
    // An account with nothing in it yet hasn't really chosen a currency.
    currency: isEmpty(account) ? device.currency : account.currency,
    customCategories: [
      ...account.customCategories,
      ...device.customCategories.filter((c) => !names.has(c.name.toLowerCase())),
    ],
    categoryRules: { ...device.categoryRules, ...account.categoryRules },
  }
}

/** True when there's nothing worth keeping (the currency alone doesn't count). */
export function isEmpty(data: AppData): boolean {
  return (
    data.transactions.length === 0 &&
    data.recurring.length === 0 &&
    Object.keys(data.budgets).length === 0 &&
    data.customCategories.length === 0 &&
    Object.keys(data.categoryRules).length === 0
  )
}
