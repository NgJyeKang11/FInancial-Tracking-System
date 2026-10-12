import { useEffect, useState } from 'react'
import { loadBudgets, saveBudgets } from '../lib/storage'
import type { Budgets, ExpenseCategory } from '../types'

/** Holds the monthly budgets in state and keeps them saved to localStorage. */
export function useBudgets() {
  const [budgets, setBudgets] = useState<Budgets>(() => loadBudgets())

  useEffect(() => {
    saveBudgets(budgets)
  }, [budgets])

  /** Sets a category's monthly limit in cents, or removes it when `cents` is null. */
  const setBudget = (category: ExpenseCategory, cents: number | null) =>
    setBudgets((prev) => {
      const { [category]: _removed, ...rest } = prev
      return cents === null ? rest : { ...rest, [category]: cents }
    })

  return { budgets, setBudget }
}
