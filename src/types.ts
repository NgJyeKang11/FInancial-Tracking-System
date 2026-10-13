/** The built-in spending categories. People can add their own as well (see `CustomCategory`). */
export const CATEGORIES = [
  'Food & Drink',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills & Utilities',
  'Entertainment',
  'Health',
  'Other',
] as const

/** The built-in income categories. */
export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investments', 'Gift', 'Other income'] as const

/**
 * Used by "Adjust balance" for money in or out that the app didn't see (for example, paying
 * through another app). It has no budget.
 */
export const ADJUSTMENT = 'Adjustment'

/** A category name: a built-in one, "Adjustment", or one the person added. */
export type Category = string

export type TransactionType = 'expense' | 'income'

/** A category the person added, for spending or for income. */
export interface CustomCategory {
  name: string
  type: TransactionType
}

/** Longest category name allowed, so names fit in chips and menus. */
export const MAX_CATEGORY_LENGTH = 30

/** The category choices for a type: built-in ones, then the person's own, then Adjustment. */
export function categoriesFor(type: TransactionType, custom: CustomCategory[]): Category[] {
  const builtIn: readonly string[] = type === 'expense' ? CATEGORIES : INCOME_CATEGORIES
  return [...builtIn, ...custom.filter((c) => c.type === type).map((c) => c.name), ADJUSTMENT]
}

/** The spending categories that can have a budget (everything except Adjustment). */
export function budgetCategories(custom: CustomCategory[]): Category[] {
  return categoriesFor('expense', custom).filter((c) => c !== ADJUSTMENT)
}

/** The category a type falls back to when nothing else fits. */
export const fallbackCategory = (type: TransactionType): Category => (type === 'expense' ? 'Other' : 'Other income')

export interface Transaction {
  id: string
  /** Money out (`expense`) or money in (`income`). */
  type: TransactionType
  /** Always positive, in cents (an integer) to avoid floating-point rounding errors. */
  amountCents: number
  category: Category
  /** Local calendar date in YYYY-MM-DD format. */
  date: string
  note: string
}

/** The fields a user fills in; `id` is generated when the transaction is saved. */
export type TransactionInput = Omit<Transaction, 'id'>

/** Money that comes in or goes out every month, like an allowance or rent. */
export interface Recurring {
  id: string
  type: TransactionType
  amountCents: number
  category: Category
  /** Day of the month (1–31). Shorter months use their last day instead. */
  day: number
  note: string
  /** The last month ("YYYY-MM") it was added for. The next one is added the month after. */
  lastMonth: string
}

/**
 * Monthly spending limits in cents, keyed by spending category. A category with no entry has
 * no budget. The same limits apply to every month.
 */
export type Budgets = Record<Category, number>

/**
 * Categories the person picked for statement descriptions during an import, so the same
 * merchant or person gets that category next time. Keyed by `categoryRuleKey`.
 */
export type CategoryRules = Record<string, Category>

/** Everything the app saves, as one bundle (what's stored in a signed-in account). */
export interface AppData {
  transactions: Transaction[]
  budgets: Budgets
  recurring: Recurring[]
  currency: string
  customCategories: CustomCategory[]
  categoryRules: CategoryRules
}
