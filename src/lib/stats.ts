import { CATEGORIES, type Category, type Transaction } from '../types'
import { daysInMonth, monthOf } from './dates'

export function totalCents(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amountCents, 0)
}

export function inMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((t) => monthOf(t.date) === month)
}

/** Spending per category, largest first. Categories with no spending are left out. */
export function totalsByCategory(
  transactions: Transaction[],
): { category: Category; cents: number }[] {
  const totals = new Map<Category, number>()
  for (const t of transactions) {
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amountCents)
  }
  return CATEGORIES.filter((c) => totals.has(c))
    .map((category) => ({ category, cents: totals.get(category)! }))
    .sort((a, b) => b.cents - a.cents)
}

/** One entry per day of the month (including zero-spend days), for the daily chart. */
export function dailyTotals(transactions: Transaction[], month: string): { day: number; cents: number }[] {
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => ({ day: i + 1, cents: 0 }))
  for (const t of inMonth(transactions, month)) {
    days[Number(t.date.slice(8, 10)) - 1].cents += t.amountCents
  }
  return days
}

/** Groups transactions by date, newest day first, for the list view. */
export function groupByDay(transactions: Transaction[]): { date: string; items: Transaction[] }[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of transactions) {
    groups.set(t.date, [...(groups.get(t.date) ?? []), t])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))
}
