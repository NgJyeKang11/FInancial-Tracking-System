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

export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investments', 'Gift', 'Other income'] as const

/**
 * Used by "Adjust balance" for money in or out that the app didn't see (for example, paying
 * through another app). It has no budget.
 */
export const ADJUSTMENT = 'Adjustment'

export type ExpenseCategory = (typeof CATEGORIES)[number]
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]
export type Category = ExpenseCategory | IncomeCategory | typeof ADJUSTMENT

export type TransactionType = 'expense' | 'income'

/** The category choices for each kind of transaction. */
export const CATEGORIES_BY_TYPE: Record<TransactionType, readonly Category[]> = {
  expense: [...CATEGORIES, ADJUSTMENT],
  income: [...INCOME_CATEGORIES, ADJUSTMENT],
}

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
 * Monthly spending limits in cents, one per expense category. A category with no entry has
 * no budget. The same limits apply to every month.
 */
export type Budgets = Partial<Record<ExpenseCategory, number>>
