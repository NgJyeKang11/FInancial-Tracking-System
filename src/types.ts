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

export type Category = (typeof CATEGORIES)[number]

export interface Transaction {
  id: string
  /** Stored in cents (an integer) to avoid floating-point rounding errors. */
  amountCents: number
  category: Category
  /** Local calendar date in YYYY-MM-DD format. */
  date: string
  note: string
}

/** The fields a user fills in; `id` is generated when the transaction is saved. */
export type TransactionInput = Omit<Transaction, 'id'>
