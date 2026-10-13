import { CATEGORIES, type Budgets, type Category, type Transaction } from '../types'
import { daysInMonth, monthOf } from './dates'

/** Plain sum of the amounts. Filter to one type first (see `expensesOnly` / `incomeOnly`). */
export function totalCents(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amountCents, 0)
}

export function expensesOnly(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.type === 'expense')
}

export function incomeOnly(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.type === 'income')
}

/** Income minus spending. Negative when more went out than came in. */
export function netCents(transactions: Transaction[]): number {
  return totalCents(incomeOnly(transactions)) - totalCents(expensesOnly(transactions))
}

export function inMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((t) => monthOf(t.date) === month)
}

/**
 * The running balance at the end of each day that has transactions, counting everything
 * on or before that day (not just the transactions passed to the list view).
 */
export function balanceByDate(transactions: Transaction[]): Map<string, number> {
  const netPerDay = new Map<string, number>()
  for (const t of transactions) {
    const signed = t.type === 'income' ? t.amountCents : -t.amountCents
    netPerDay.set(t.date, (netPerDay.get(t.date) ?? 0) + signed)
  }
  const balances = new Map<string, number>()
  let running = 0
  for (const date of [...netPerDay.keys()].sort()) {
    running += netPerDay.get(date)!
    balances.set(date, running)
  }
  return balances
}

/** The balance after every transaction dated on or before `date`. */
export function balanceAsOf(transactions: Transaction[], date: string): number {
  return netCents(transactions.filter((t) => t.date <= date))
}

/** Spending per category, largest first. Categories with no spending are left out. */
export function totalsByCategory(
  transactions: Transaction[],
): { category: Category; cents: number }[] {
  const totals = new Map<Category, number>()
  for (const t of expensesOnly(transactions)) {
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amountCents)
  }
  return [...totals]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents)
}

/** Spending at or above this share of a budget counts as "close to the limit". */
export const NEAR_BUDGET_RATIO = 0.8

export type BudgetState = 'ok' | 'near' | 'over'

export interface BudgetStatus {
  category: Category
  budgetCents: number
  spentCents: number
  /** Budget minus spending; negative once the budget is exceeded. */
  remainingCents: number
  /** Spending as a share of the budget (1 = exactly at the limit; can be above 1). */
  ratio: number
  state: BudgetState
}

/**
 * How each budgeted category is doing, for the transactions passed in (normally one month).
 * Categories without a budget are left out. The result follows `order` (normally the category
 * list), with any budgeted category not in it at the end.
 */
export function budgetStatuses(
  transactions: Transaction[],
  budgets: Budgets,
  order: readonly Category[] = CATEGORIES,
): BudgetStatus[] {
  const spent = spentByCategory(transactions)
  const position = (c: Category) => (order.includes(c) ? order.indexOf(c) : order.length)
  return Object.keys(budgets)
    .sort((a, b) => position(a) - position(b))
    .map((category) => {
    const budgetCents = budgets[category]
    const spentCents = spent.get(category) ?? 0
    return {
      category,
      budgetCents,
      spentCents,
      remainingCents: budgetCents - spentCents,
      ratio: spentCents / budgetCents,
      state: budgetState(spentCents, budgetCents),
    }
  })
}

export interface CategoryChange {
  category: Category
  thisCents: number
  lastCents: number
  /** This month minus last month; positive means more was spent. */
  changeCents: number
}

/**
 * Spending per category in two months side by side, for every category with spending in
 * either. Biggest spending this month first; categories only spent on last month come last.
 */
export function compareMonths(thisMonth: Transaction[], lastMonth: Transaction[]): CategoryChange[] {
  const now = spentByCategory(thisMonth)
  const before = spentByCategory(lastMonth)
  return [...new Set([...now.keys(), ...before.keys()])]
    .map((category) => {
      const thisCents = now.get(category) ?? 0
      const lastCents = before.get(category) ?? 0
      return { category, thisCents, lastCents, changeCents: thisCents - lastCents }
    })
    .sort((a, b) => b.thisCents - a.thisCents || b.lastCents - a.lastCents)
}

/** Total spending per category (expenses only). Categories with no spending have no entry. */
export function spentByCategory(transactions: Transaction[]): Map<Category, number> {
  const spent = new Map<Category, number>()
  for (const t of expensesOnly(transactions)) {
    spent.set(t.category, (spent.get(t.category) ?? 0) + t.amountCents)
  }
  return spent
}

/** `over` only once spending exceeds the budget; exactly at the limit is still `near`. */
export function budgetState(spentCents: number, budgetCents: number): BudgetState {
  if (spentCents > budgetCents) return 'over'
  return spentCents / budgetCents >= NEAR_BUDGET_RATIO ? 'near' : 'ok'
}

/** One entry per day of the month (including zero-spend days), for the daily chart. */
export function dailyTotals(transactions: Transaction[], month: string): { day: number; cents: number }[] {
  const days = Array.from({ length: daysInMonth(month) }, (_, i) => ({ day: i + 1, cents: 0 }))
  for (const t of expensesOnly(inMonth(transactions, month))) {
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
