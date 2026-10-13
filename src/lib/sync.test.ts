import { describe, expect, it } from 'vitest'
import type { AppData, Recurring, Transaction } from '../types'
import { EMPTY_DATA, isEmpty, mergeData, parseAppData, serialize } from './sync'

const tx = (id: string, note = id): Transaction => ({
  id,
  type: 'expense',
  amountCents: 1000,
  category: 'Food & Drink',
  date: '2026-10-01',
  note,
})

const allowance: Recurring = {
  id: 'r1',
  type: 'income',
  amountCents: 50000,
  category: 'Gift',
  day: 1,
  note: 'Allowance',
  lastMonth: '2026-09',
}

describe('parseAppData', () => {
  it('keeps valid entries and drops broken ones', () => {
    const data = parseAppData({
      transactions: [tx('a'), { id: 'bad', amountCents: -5 }],
      budgets: { Groceries: 30000, Adjustment: 5 },
      recurring: [allowance, { id: 'x' }],
      currency: 'MYR',
      customCategories: [{ name: 'Pets', type: 'expense' }, { name: '' }],
      categoryRules: { 'expense|vet': 'Pets', bad: 1 },
    })
    expect(data).toEqual({
      transactions: [tx('a')],
      budgets: { Groceries: 30000 },
      recurring: [allowance],
      currency: 'MYR',
      customCategories: [{ name: 'Pets', type: 'expense' }],
      categoryRules: { 'expense|vet': 'Pets' },
    })
  })

  it('fills in anything missing and rejects things that are not app data', () => {
    expect(parseAppData({})).toEqual(EMPTY_DATA)
    expect(parseAppData(null)).toBeNull()
    expect(parseAppData([])).toBeNull()
    expect(parseAppData({ currency: 'not a currency' })?.currency).toBe('USD')
  })
})

describe('serialize', () => {
  it('gives the same text for the same content written in a different field order', () => {
    const reordered = { lastMonth: '2026-09', note: 'Allowance', day: 1, category: 'Gift', amountCents: 50000, type: 'income', id: 'r1' } as Recurring
    const a: AppData = { ...EMPTY_DATA, recurring: [allowance] }
    const b: AppData = { ...EMPTY_DATA, recurring: [reordered] }
    expect(serialize(a)).toBe(serialize(b))
  })
})

describe('mergeData', () => {
  it('keeps transactions from both, once each', () => {
    const device: AppData = { ...EMPTY_DATA, transactions: [tx('a'), tx('b')] }
    const account: AppData = { ...EMPTY_DATA, transactions: [tx('b', 'edited elsewhere'), tx('c')] }
    expect(mergeData(device, account).transactions.map((t) => [t.id, t.note])).toEqual([
      ['b', 'edited elsewhere'],
      ['c', 'c'],
      ['a', 'a'],
    ])
  })

  it('keeps the later lastMonth for a recurring item on both', () => {
    const device: AppData = { ...EMPTY_DATA, recurring: [{ ...allowance, lastMonth: '2026-10' }] }
    const account: AppData = { ...EMPTY_DATA, recurring: [allowance] }
    expect(mergeData(device, account).recurring).toEqual([{ ...allowance, lastMonth: '2026-10' }])
  })

  it("lets the account's budgets and currency win, unless the account is empty", () => {
    const device: AppData = { ...EMPTY_DATA, budgets: { Groceries: 100, Transport: 200 }, currency: 'MYR' }
    const account: AppData = { ...EMPTY_DATA, budgets: { Groceries: 300 }, currency: 'SGD' }
    expect(mergeData(device, account)).toMatchObject({ budgets: { Groceries: 300, Transport: 200 }, currency: 'SGD' })
    expect(mergeData(device, EMPTY_DATA).currency).toBe('MYR')
  })
})

describe('mergeData with custom categories', () => {
  it('keeps categories from both, once per name, and the account wins remembered categories', () => {
    const device: AppData = {
      ...EMPTY_DATA,
      customCategories: [
        { name: 'pets', type: 'expense' },
        { name: 'Books', type: 'expense' },
      ],
      categoryRules: { 'expense|vet': 'Health', 'expense|kedai buku': 'Books' },
    }
    const account: AppData = {
      ...EMPTY_DATA,
      customCategories: [{ name: 'Pets', type: 'expense' }],
      categoryRules: { 'expense|vet': 'Pets' },
    }
    expect(mergeData(device, account)).toMatchObject({
      customCategories: [
        { name: 'Pets', type: 'expense' },
        { name: 'Books', type: 'expense' },
      ],
      categoryRules: { 'expense|vet': 'Pets', 'expense|kedai buku': 'Books' },
    })
  })
})

describe('isEmpty', () => {
  it('ignores the currency', () => {
    expect(isEmpty({ ...EMPTY_DATA, currency: 'MYR' })).toBe(true)
    expect(isEmpty({ ...EMPTY_DATA, transactions: [tx('a')] })).toBe(false)
  })
})
