import type { Recurring, Transaction } from '../types'
import { addMonths, daysInMonth, monthOf } from './dates'
import { loadRecurring, loadTransactions, saveRecurring, saveTransactions } from './storage'

/** The date a recurring item lands on in `month`: its day, or the month's last day if shorter. */
export function occurrenceDate(day: number, month: string): string {
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`
}

/**
 * The transactions a recurring item still owes, from the month after its `lastMonth` up to
 * `today` (a month whose day hasn't come yet waits), and the item with `lastMonth` moved on.
 * Each one's id is made from the item and the month, so two devices adding the same month
 * produce the same transaction rather than a duplicate.
 */
export function dueTransactions(item: Recurring, today: string): { transactions: Transaction[]; item: Recurring } {
  const transactions: Transaction[] = []
  let lastMonth = item.lastMonth
  for (let month = addMonths(lastMonth, 1); month <= monthOf(today); month = addMonths(month, 1)) {
    const date = occurrenceDate(item.day, month)
    if (date > today) break
    transactions.push({
      id: `${item.id}:${month}`,
      type: item.type,
      amountCents: item.amountCents,
      category: item.category,
      date,
      note: item.note,
    })
    lastMonth = month
  }
  return { transactions, item: { ...item, lastMonth } }
}

/**
 * Adds every recurring item's due transactions to `transactions` (skipping any already there)
 * and moves each item's `lastMonth` on. `changed` is false when nothing was due.
 */
export function catchUp(
  transactions: Transaction[],
  recurring: Recurring[],
  today: string,
): { transactions: Transaction[]; recurring: Recurring[]; changed: boolean } {
  const results = recurring.map((item) => dueTransactions(item, today))
  const ids = new Set(transactions.map((t) => t.id))
  const due = results.flatMap((r) => r.transactions).filter((t) => !ids.has(t.id))
  const changed = results.some((r, i) => r.item.lastMonth !== recurring[i].lastMonth)
  return { transactions: [...transactions, ...due], recurring: results.map((r) => r.item), changed }
}

/**
 * Adds any recurring transactions that have come due to the saved data. Called once when the
 * app starts, before anything is shown, so each month is added exactly once.
 */
export function applyDueRecurring(today: string, storage: Storage = localStorage): void {
  const result = catchUp(loadTransactions(storage), loadRecurring(storage), today)
  if (!result.changed) return
  saveTransactions(result.transactions, storage)
  saveRecurring(result.recurring, storage)
}
