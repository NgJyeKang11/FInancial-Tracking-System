import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { daysInMonth, todayISO } from './dates'
import {
  balanceAsOf,
  balanceByDate,
  dailyTotals,
  expensesOnly,
  groupByDay,
  incomeOnly,
  inMonth,
  netCents,
  totalCents,
  totalsByCategory,
} from './stats'

const tx = (
  id: string,
  date: string,
  amountCents: number,
  category: Transaction['category'],
  type: Transaction['type'] = 'expense',
): Transaction => ({
  id,
  type,
  date,
  amountCents,
  category,
  note: '',
})

const sample = [
  tx('1', '2026-10-01', 500, 'Food & Drink'),
  tx('2', '2026-10-01', 1500, 'Transport'),
  tx('3', '2026-10-12', 2000, 'Food & Drink'),
  tx('4', '2026-09-30', 9900, 'Shopping'),
]

describe('stats', () => {
  it('totals and filters by month', () => {
    const october = inMonth(sample, '2026-10')
    expect(october.map((t) => t.id)).toEqual(['1', '2', '3'])
    expect(totalCents(october)).toBe(4000)
  })

  it('sums per category, largest first', () => {
    expect(totalsByCategory(inMonth(sample, '2026-10'))).toEqual([
      { category: 'Food & Drink', cents: 2500 },
      { category: 'Transport', cents: 1500 },
    ])
  })

  it('returns a value for every day of the month', () => {
    const days = dailyTotals(sample, '2026-10')
    expect(days).toHaveLength(31)
    expect(days[0]).toEqual({ day: 1, cents: 2000 })
    expect(days[11]).toEqual({ day: 12, cents: 2000 })
    expect(days[1].cents).toBe(0)
  })

  it('groups by day, newest first', () => {
    expect(groupByDay(sample).map((g) => [g.date, g.items.length])).toEqual([
      ['2026-10-12', 1],
      ['2026-10-01', 2],
      ['2026-09-30', 1],
    ])
  })
})

describe('income and balance', () => {
  const mixed = [
    tx('a', '2026-10-01', 300000, 'Salary', 'income'),
    tx('b', '2026-10-01', 5000, 'Groceries'),
    tx('c', '2026-10-05', 20000, 'Bills & Utilities'),
    tx('d', '2026-10-05', 1000, 'Gift', 'income'),
    tx('e', '2026-09-20', 10000, 'Other'),
  ]

  it('splits income from spending', () => {
    expect(incomeOnly(mixed).map((t) => t.id)).toEqual(['a', 'd'])
    expect(expensesOnly(mixed).map((t) => t.id)).toEqual(['b', 'c', 'e'])
  })

  it('computes net as income minus spending, and can go negative', () => {
    expect(netCents(inMonth(mixed, '2026-10'))).toBe(300000 + 1000 - 5000 - 20000)
    expect(netCents(inMonth(mixed, '2026-09'))).toBe(-10000)
  })

  it('builds a running balance across months, in date order', () => {
    const balances = balanceByDate(mixed)
    expect([...balances.entries()]).toEqual([
      ['2026-09-20', -10000],
      ['2026-10-01', -10000 + 300000 - 5000],
      ['2026-10-05', -10000 + 300000 - 5000 - 20000 + 1000],
    ])
  })

  it('gives the balance as of a date', () => {
    expect(balanceAsOf(mixed, '2026-09-30')).toBe(-10000)
    expect(balanceAsOf(mixed, '2026-10-31')).toBe(266000)
    expect(balanceAsOf([], '2026-10-31')).toBe(0)
  })

  it('leaves income out of spending breakdowns', () => {
    expect(totalsByCategory(mixed)).toEqual([
      { category: 'Bills & Utilities', cents: 20000 },
      { category: 'Other', cents: 10000 },
      { category: 'Groceries', cents: 5000 },
    ])
    expect(dailyTotals(mixed, '2026-10').reduce((sum, d) => sum + d.cents, 0)).toBe(25000)
  })
})

describe('dates', () => {
  it('handles month lengths, including leap years', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-04')).toBe(30)
  })

  it('uses the local date', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
