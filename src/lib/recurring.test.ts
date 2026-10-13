import { describe, expect, it } from 'vitest'
import type { Recurring } from '../types'
import { applyDueRecurring, catchUp, dueTransactions, occurrenceDate } from './recurring'
import { loadRecurring, loadTransactions, saveRecurring } from './storage'

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

const allowance: Recurring = {
  id: 'r1',
  type: 'income',
  amountCents: 50000,
  category: 'Gift',
  day: 1,
  note: 'Allowance',
  lastMonth: '2026-09',
}

describe('occurrenceDate', () => {
  it('uses the last day of shorter months', () => {
    expect(occurrenceDate(31, '2026-02')).toBe('2026-02-28')
    expect(occurrenceDate(31, '2028-02')).toBe('2028-02-29')
    expect(occurrenceDate(5, '2026-10')).toBe('2026-10-05')
  })
})

describe('dueTransactions', () => {
  it('adds the month once its day has come', () => {
    const { inputs, item } = dueTransactions(allowance, '2026-10-01')
    expect(inputs).toEqual([
      { type: 'income', amountCents: 50000, category: 'Gift', date: '2026-10-01', note: 'Allowance' },
    ])
    expect(item.lastMonth).toBe('2026-10')
  })

  it('waits until the day comes', () => {
    const { inputs, item } = dueTransactions({ ...allowance, day: 15 }, '2026-10-14')
    expect(inputs).toEqual([])
    expect(item.lastMonth).toBe('2026-09')
  })

  it('catches up on several missed months, across a new year', () => {
    const { inputs, item } = dueTransactions({ ...allowance, lastMonth: '2026-10', day: 20 }, '2027-02-10')
    expect(inputs.map((i) => i.date)).toEqual(['2026-11-20', '2026-12-20', '2027-01-20'])
    expect(item.lastMonth).toBe('2027-01')
  })

  it('adds nothing twice', () => {
    const first = dueTransactions(allowance, '2026-10-05')
    expect(dueTransactions(first.item, '2026-10-05').inputs).toEqual([])
  })
})

describe('catchUp', () => {
  it('handles every item', () => {
    const rent: Recurring = { ...allowance, id: 'r2', type: 'expense', category: 'Bills & Utilities', day: 3, note: 'Rent' }
    const { inputs, items } = catchUp([allowance, rent], '2026-10-02')
    expect(inputs.map((i) => i.note)).toEqual(['Allowance'])
    expect(items.map((i) => i.lastMonth)).toEqual(['2026-10', '2026-09'])
  })
})

describe('applyDueRecurring', () => {
  it('saves due transactions once, even when run again', () => {
    const storage = memoryStorage()
    saveRecurring([allowance], storage)
    applyDueRecurring('2026-11-03', storage)
    applyDueRecurring('2026-11-03', storage)
    expect(loadTransactions(storage).map((t) => t.date)).toEqual(['2026-10-01', '2026-11-01'])
    expect(loadRecurring(storage)[0].lastMonth).toBe('2026-11')
  })
})
