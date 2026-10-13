import { CATEGORIES, CATEGORIES_BY_TYPE, type Budgets, type Recurring, type Transaction } from '../types'

const TRANSACTIONS_KEY = 'fts.transactions.v1'
const BUDGETS_KEY = 'fts.budgets.v1'
const RECURRING_KEY = 'fts.recurring.v1'
const CURRENCY_KEY = 'fts.currency'
const SYNCED_USER_KEY = 'fts.syncedUser'

/**
 * Checks one saved entry and returns it as a Transaction, or null if it's malformed.
 * Entries saved before income existed have no `type`; they were all spending.
 */
export function parseTransaction(value: unknown): Transaction | null {
  if (typeof value !== 'object' || value === null) return null
  const t = value as Record<string, unknown>
  const type = t.type ?? 'expense'
  if (type !== 'expense' && type !== 'income') return null
  if (
    typeof t.id !== 'string' ||
    !Number.isSafeInteger(t.amountCents) ||
    (t.amountCents as number) <= 0 ||
    !CATEGORIES_BY_TYPE[type].includes(t.category as never) ||
    typeof t.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(t.date) ||
    typeof t.note !== 'string'
  ) {
    return null
  }
  return {
    id: t.id,
    type,
    amountCents: t.amountCents as number,
    category: t.category as Transaction['category'],
    date: t.date,
    note: t.note,
  }
}

/** Reads saved transactions, skipping anything malformed rather than crashing. */
export function loadTransactions(storage: Storage = localStorage): Transaction[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(TRANSACTIONS_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => parseTransaction(entry) ?? [])
  } catch {
    return []
  }
}

export function saveTransactions(transactions: Transaction[], storage: Storage = localStorage): void {
  try {
    storage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions))
  } catch {
    // Storage can be full or disabled (e.g. private browsing); the app keeps working in memory.
  }
}

/** Checks saved budgets, keeping only valid expense categories with a positive whole-cent limit. */
export function parseBudgets(value: unknown): Budgets {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const saved = value as Record<string, unknown>
  const budgets: Budgets = {}
  for (const category of CATEGORIES) {
    const cents = saved[category]
    if (Number.isSafeInteger(cents) && (cents as number) > 0) budgets[category] = cents as number
  }
  return budgets
}

export function loadBudgets(storage: Storage = localStorage): Budgets {
  try {
    return parseBudgets(JSON.parse(storage.getItem(BUDGETS_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

export function saveBudgets(budgets: Budgets, storage: Storage = localStorage): void {
  try {
    storage.setItem(BUDGETS_KEY, JSON.stringify(budgets))
  } catch {
    // Same as transactions: keep working in memory if storage is full or disabled.
  }
}

/** Checks one saved recurring item, or returns null if it's malformed. */
export function parseRecurring(value: unknown): Recurring | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Record<string, unknown>
  if (r.type !== 'expense' && r.type !== 'income') return null
  if (
    typeof r.id !== 'string' ||
    !Number.isSafeInteger(r.amountCents) ||
    (r.amountCents as number) <= 0 ||
    !CATEGORIES_BY_TYPE[r.type].includes(r.category as never) ||
    !Number.isInteger(r.day) ||
    (r.day as number) < 1 ||
    (r.day as number) > 31 ||
    typeof r.note !== 'string' ||
    typeof r.lastMonth !== 'string' ||
    !/^\d{4}-\d{2}$/.test(r.lastMonth)
  ) {
    return null
  }
  return {
    id: r.id,
    type: r.type,
    amountCents: r.amountCents as number,
    category: r.category as Recurring['category'],
    day: r.day as number,
    note: r.note,
    lastMonth: r.lastMonth,
  }
}

/** Reads saved recurring items, skipping anything malformed. */
export function loadRecurring(storage: Storage = localStorage): Recurring[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(RECURRING_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => parseRecurring(entry) ?? [])
  } catch {
    return []
  }
}

export function saveRecurring(items: Recurring[], storage: Storage = localStorage): void {
  try {
    storage.setItem(RECURRING_KEY, JSON.stringify(items))
  } catch {
    // Same as transactions: keep working in memory if storage is full or disabled.
  }
}

export function loadCurrency(storage: Storage = localStorage): string | null {
  try {
    return storage.getItem(CURRENCY_KEY)
  } catch {
    return null
  }
}

export function saveCurrency(currency: string, storage: Storage = localStorage): void {
  try {
    storage.setItem(CURRENCY_KEY, currency)
  } catch {
    // Ignore: currency choice is a convenience, not critical data.
  }
}

/**
 * The account this device last synced with. Data on the device is only merged into an account
 * the first time; after that the account's copy wins, so something deleted on another device
 * doesn't come back from this one.
 */
export function loadSyncedUser(storage: Storage = localStorage): string | null {
  try {
    return storage.getItem(SYNCED_USER_KEY)
  } catch {
    return null
  }
}

export function saveSyncedUser(uid: string | null, storage: Storage = localStorage): void {
  try {
    if (uid === null) storage.removeItem(SYNCED_USER_KEY)
    else storage.setItem(SYNCED_USER_KEY, uid)
  } catch {
    // Without it the next sign-in merges again, which only re-adds items; nothing is lost.
  }
}
