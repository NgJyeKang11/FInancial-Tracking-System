import { describe, expect, it } from 'vitest'
import { loadBudgets, loadTransactions, saveBudgets, saveTransactions } from './storage'

/** A minimal in-memory stand-in for the browser's localStorage. */
function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  }
}

describe('storage', () => {
  it('round-trips transactions', () => {
    const storage = memoryStorage()
    const items = [
      { id: 'a', type: 'expense' as const, amountCents: 450, category: 'Groceries' as const, date: '2026-10-12', note: 'Milk' },
      { id: 'b', type: 'income' as const, amountCents: 250000, category: 'Salary' as const, date: '2026-10-01', note: '' },
    ]
    saveTransactions(items, storage)
    expect(loadTransactions(storage)).toEqual(items)
  })

  it('treats entries saved before income existed as expenses', () => {
    const storage = memoryStorage()
    storage.setItem(
      'fts.transactions.v1',
      JSON.stringify([{ id: 'old', amountCents: 450, category: 'Groceries', date: '2026-10-12', note: 'Milk' }]),
    )
    expect(loadTransactions(storage)).toEqual([
      { id: 'old', type: 'expense', amountCents: 450, category: 'Groceries', date: '2026-10-12', note: 'Milk' },
    ])
  })

  it('rejects a category that does not belong to the transaction type', () => {
    const storage = memoryStorage()
    storage.setItem(
      'fts.transactions.v1',
      JSON.stringify([
        { id: 'x', type: 'income', amountCents: 100, category: 'Groceries', date: '2026-10-12', note: '' },
        { id: 'y', type: 'expense', amountCents: 100, category: 'Salary', date: '2026-10-12', note: '' },
        { id: 'z', type: 'transfer', amountCents: 100, category: 'Other', date: '2026-10-12', note: '' },
      ]),
    )
    expect(loadTransactions(storage)).toEqual([])
  })

  it('returns an empty list for missing or corrupt data', () => {
    const storage = memoryStorage()
    expect(loadTransactions(storage)).toEqual([])
    storage.setItem('fts.transactions.v1', '{not json')
    expect(loadTransactions(storage)).toEqual([])
  })

  it('drops malformed entries', () => {
    const storage = memoryStorage()
    storage.setItem(
      'fts.transactions.v1',
      JSON.stringify([
        { id: 'ok', amountCents: 100, category: 'Other', date: '2026-10-12', note: '' },
        { id: 'bad-amount', amountCents: 1.5, category: 'Other', date: '2026-10-12', note: '' },
        { id: 'bad-category', amountCents: 100, category: 'Nope', date: '2026-10-12', note: '' },
      ]),
    )
    expect(loadTransactions(storage).map((t) => t.id)).toEqual(['ok'])
  })
})

describe('budget storage', () => {
  it('round-trips budgets', () => {
    const storage = memoryStorage()
    saveBudgets({ Groceries: 40000, Transport: 15050 }, storage)
    expect(loadBudgets(storage)).toEqual({ Groceries: 40000, Transport: 15050 })
  })

  it('returns no budgets for missing or corrupt data', () => {
    const storage = memoryStorage()
    expect(loadBudgets(storage)).toEqual({})
    storage.setItem('fts.budgets.v1', '{not json')
    expect(loadBudgets(storage)).toEqual({})
    storage.setItem('fts.budgets.v1', '[1,2,3]')
    expect(loadBudgets(storage)).toEqual({})
  })

  it('drops invalid categories and amounts', () => {
    const storage = memoryStorage()
    storage.setItem(
      'fts.budgets.v1',
      JSON.stringify({ Groceries: 5000, Salary: 5000, Health: 0, Shopping: -1, Transport: 1.5, Other: '100' }),
    )
    expect(loadBudgets(storage)).toEqual({ Groceries: 5000 })
  })
})
