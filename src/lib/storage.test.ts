import { describe, expect, it } from 'vitest'
import { loadTransactions, saveTransactions } from './storage'

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
    const items = [{ id: 'a', amountCents: 450, category: 'Groceries' as const, date: '2026-10-12', note: 'Milk' }]
    saveTransactions(items, storage)
    expect(loadTransactions(storage)).toEqual(items)
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
