import type { Recurring, TransactionInput } from '../types'
import { addMonths, daysInMonth, monthOf } from './dates'
import { loadRecurring, loadTransactions, saveRecurring, saveTransactions } from './storage'

/** The date a recurring item lands on in `month`: its day, or the month's last day if shorter. */
export function occurrenceDate(day: number, month: string): string {
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`
}

/**
 * The transactions a recurring item still owes, from the month after its `lastMonth` up to
 * `today` (a month whose day hasn't come yet waits), and the item with `lastMonth` moved on.
 */
export function dueTransactions(item: Recurring, today: string): { inputs: TransactionInput[]; item: Recurring } {
  const inputs: TransactionInput[] = []
  let lastMonth = item.lastMonth
  for (let month = addMonths(lastMonth, 1); month <= monthOf(today); month = addMonths(month, 1)) {
    const date = occurrenceDate(item.day, month)
    if (date > today) break
    inputs.push({ type: item.type, amountCents: item.amountCents, category: item.category, date, note: item.note })
    lastMonth = month
  }
  return { inputs, item: { ...item, lastMonth } }
}

/** Runs `dueTransactions` for every item. */
export function catchUp(items: Recurring[], today: string): { inputs: TransactionInput[]; items: Recurring[] } {
  const results = items.map((item) => dueTransactions(item, today))
  return { inputs: results.flatMap((r) => r.inputs), items: results.map((r) => r.item) }
}

/**
 * Adds any recurring transactions that have come due to the saved data. Called once when the
 * app starts, before anything is shown, so each month is added exactly once.
 */
export function applyDueRecurring(today: string, storage: Storage = localStorage): void {
  const { inputs, items } = catchUp(loadRecurring(storage), today)
  if (inputs.length === 0) return
  saveTransactions(
    [...loadTransactions(storage), ...inputs.map((input) => ({ ...input, id: crypto.randomUUID() }))],
    storage,
  )
  saveRecurring(items, storage)
}
