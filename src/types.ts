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

export type ExpenseCategory = (typeof CATEGORIES)[number]
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]
export type Category = ExpenseCategory | IncomeCategory

export type TransactionType = 'expense' | 'income'

/** The category choices for each kind of transaction. */
export const CATEGORIES_BY_TYPE: Record<TransactionType, readonly Category[]> = {
  expense: CATEGORIES,
  income: INCOME_CATEGORIES,
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
