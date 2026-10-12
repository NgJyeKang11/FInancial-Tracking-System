import { useEffect, useState } from 'react'
import { loadTransactions, saveTransactions } from '../lib/storage'
import type { Transaction, TransactionInput } from '../types'

/** Holds all transactions in state and keeps them saved to localStorage. */
export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions())

  useEffect(() => {
    saveTransactions(transactions)
  }, [transactions])

  const add = (input: TransactionInput) =>
    setTransactions((prev) => [...prev, { ...input, id: crypto.randomUUID() }])

  const addMany = (inputs: TransactionInput[]) =>
    setTransactions((prev) => [...prev, ...inputs.map((input) => ({ ...input, id: crypto.randomUUID() }))])

  const update = (id: string, input: TransactionInput) =>
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...input, id } : t)))

  const remove = (id: string) => setTransactions((prev) => prev.filter((t) => t.id !== id))

  return { transactions, add, addMany, update, remove }
}
