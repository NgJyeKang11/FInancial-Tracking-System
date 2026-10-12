import { CATEGORIES_BY_TYPE, type Transaction } from '../types'

const TRANSACTIONS_KEY = 'fts.transactions.v1'
const CURRENCY_KEY = 'fts.currency'

/**
 * Checks one saved entry and returns it as a Transaction, or null if it's malformed.
 * Entries saved before income existed have no `type`; they were all spending.
 */
function parseTransaction(value: unknown): Transaction | null {
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
