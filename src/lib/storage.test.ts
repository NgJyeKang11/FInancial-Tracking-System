import { describe, expect, it } from 'vitest'
import {
  loadBudgets,
  loadCategoryRules,
  loadCustomCategories,
  loadTransactions,
  saveBudgets,
  saveCategoryRules,
  saveCustomCategories,
  saveTransactions,
} from './storage'

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

  it('rejects an unknown type and a blank or padded category', () => {
    const storage = memoryStorage()
    storage.setItem(
      'fts.transactions.v1',
      JSON.stringify([
        { id: 'x', type: 'income', amountCents: 100, category: '', date: '2026-10-12', note: '' },
        { id: 'y', type: 'expense', amountCents: 100, category: ' Pets ', date: '2026-10-12', note: '' },
        { id: 'z', type: 'transfer', amountCents: 100, category: 'Other', date: '2026-10-12', note: '' },
      ]),
    )
    expect(loadTransactions(storage)).toEqual([])
  })

  it("keeps the person's own category names", () => {
    const storage = memoryStorage()
    const pets = { id: 'p', type: 'expense' as const, amountCents: 100, category: 'Pets', date: '2026-10-12', note: '' }
    saveTransactions([pets], storage)
    expect(loadTransactions(storage)).toEqual([pets])
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
        { id: 'bad-category', amountCents: 100, category: 42, date: '2026-10-12', note: '' },
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
      JSON.stringify({ Groceries: 5000, Adjustment: 5000, '': 5000, Health: 0, Shopping: -1, Transport: 1.5, Other: '100' }),
    )
    expect(loadBudgets(storage)).toEqual({ Groceries: 5000 })
  })

  it("keeps budgets for the person's own categories", () => {
    const storage = memoryStorage()
    saveBudgets({ Pets: 5000 }, storage)
    expect(loadBudgets(storage)).toEqual({ Pets: 5000 })
  })
})

describe('custom category storage', () => {
  it('round-trips categories and drops broken, too long or repeated ones', () => {
    const storage = memoryStorage()
    storage.setItem(
      'fts.categories.v1',
      JSON.stringify([
        { name: 'Pets', type: 'expense' },
        { name: 'Allowance', type: 'income' },
        { name: 'pets', type: 'income' },
        { name: 'x'.repeat(31), type: 'expense' },
        { name: 'Gym', type: 'transfer' },
        'nonsense',
      ]),
    )
    expect(loadCustomCategories(storage)).toEqual([
      { name: 'Pets', type: 'expense' },
      { name: 'Allowance', type: 'income' },
    ])
    saveCustomCategories([{ name: 'Books', type: 'expense' }], storage)
    expect(loadCustomCategories(storage)).toEqual([{ name: 'Books', type: 'expense' }])
  })

  it('round-trips remembered categories and drops broken ones', () => {
    const storage = memoryStorage()
    saveCategoryRules({ 'expense|transfer to ahmad': 'Pets' }, storage)
    expect(loadCategoryRules(storage)).toEqual({ 'expense|transfer to ahmad': 'Pets' })
    storage.setItem('fts.categoryRules.v1', JSON.stringify({ good: 'Pets', bad: 5, '': 'Pets' }))
    expect(loadCategoryRules(storage)).toEqual({ good: 'Pets' })
    storage.setItem('fts.categoryRules.v1', '{not json')
    expect(loadCategoryRules(storage)).toEqual({})
  })
})
