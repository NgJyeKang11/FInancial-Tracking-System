import { describe, expect, it } from 'vitest'
import type { AppData } from '../types'
import { convertCents, convertData, FALLBACK_RATES, parseRates, rateBetween, type Rates } from './rates'
import { EMPTY_DATA } from './sync'

const rates: Rates = { date: '2026-10-12', perEur: { EUR: 1, USD: 1.1, MYR: 4.4, JPY: 176 } }

describe('rateBetween', () => {
  it('converts through the euro', () => {
    expect(rateBetween('USD', 'MYR', rates)).toBeCloseTo(4)
    expect(rateBetween('MYR', 'USD', rates)).toBeCloseTo(0.25)
    expect(rateBetween('EUR', 'USD', rates)).toBeCloseTo(1.1)
    expect(rateBetween('USD', 'USD', rates)).toBe(1)
  })

  it('has no rate for a currency it does not know', () => {
    expect(rateBetween('USD', 'XYZ', rates)).toBeNull()
  })

  it('covers every currency offered in Settings in the built-in rates', async () => {
    const { CURRENCIES } = await import('./money')
    for (const c of CURRENCIES) expect(FALLBACK_RATES.perEur[c]).toBeGreaterThan(0)
  })
})

describe('convertCents', () => {
  it('rounds to the nearest cent and never reaches zero', () => {
    expect(convertCents(1850, 4)).toBe(7400)
    expect(convertCents(333, 1 / 3)).toBe(111)
    expect(convertCents(1, 0.01)).toBe(1)
  })
})

describe('convertData', () => {
  const data: AppData = {
    ...EMPTY_DATA,
    currency: 'USD',
    transactions: [{ id: 'a', type: 'expense', amountCents: 1800, category: 'Food & Drink', date: '2026-10-01', note: 'Lunch' }],
    recurring: [{ id: 'r', type: 'income', amountCents: 50000, category: 'Gift', day: 1, note: 'Allowance', lastMonth: '2026-10' }],
    budgets: { Groceries: 30000 },
    customCategories: [{ name: 'Pets', type: 'expense' }],
  }

  it('converts every amount and switches the currency', () => {
    const converted = convertData(data, 'MYR', rates)!
    expect(converted.currency).toBe('MYR')
    expect(converted.transactions[0].amountCents).toBe(7200)
    expect(converted.recurring[0].amountCents).toBe(200000)
    expect(converted.budgets).toEqual({ Groceries: 120000 })
    expect(converted.customCategories).toEqual(data.customCategories)
    expect(converted.transactions[0].note).toBe('Lunch')
  })

  it('gives null when there is no rate', () => {
    expect(convertData(data, 'XYZ', rates)).toBeNull()
  })
})

describe('parseRates', () => {
  it('reads the rates service and the saved copy', () => {
    expect(parseRates({ amount: 1, base: 'EUR', date: '2026-10-12', rates: { USD: 1.1181, MYR: 4.5663 } })).toEqual({
      date: '2026-10-12',
      perEur: { EUR: 1, USD: 1.1181, MYR: 4.5663 },
    })
    expect(parseRates(rates)).toEqual(rates)
  })

  it('drops bad rates and rejects nonsense', () => {
    expect(parseRates({ date: '2026-10-12', rates: { USD: 1.1, BAD: -1, x: 2, GBP: 'no' } })?.perEur).toEqual({ EUR: 1, USD: 1.1 })
    expect(parseRates({ date: 'yesterday', rates: { USD: 1.1 } })).toBeNull()
    expect(parseRates({ date: '2026-10-12', rates: {} })).toBeNull()
    expect(parseRates(null)).toBeNull()
  })
})
