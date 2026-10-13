import { useEffect, useState } from 'react'
import { loadRecurring, saveRecurring } from '../lib/storage'
import type { Recurring } from '../types'

/** Holds the recurring items (allowance, rent, ...) in state and keeps them saved to localStorage. */
export function useRecurring() {
  const [recurring, setRecurring] = useState<Recurring[]>(() => loadRecurring())

  useEffect(() => {
    saveRecurring(recurring)
  }, [recurring])

  const add = (item: Recurring) => setRecurring((prev) => [...prev, item])

  const remove = (id: string) => setRecurring((prev) => prev.filter((r) => r.id !== id))

  return { recurring, add, remove }
}
