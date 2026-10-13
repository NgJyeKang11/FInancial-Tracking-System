import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { daysInMonth, todayISO } from './dates'
import {
  balanceAsOf,
  balanceByDate,
  budgetState,
  budgetStatuses,
  compareMonths,
  dailyTotals,
  expensesOnly,
  groupByDay,
  incomeOnly,
  inMonth,
  netCents,
  spentByCategory,
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

describe('budgets', () => {
  const october = [
    tx('a', '2026-10-01', 6000, 'Groceries'),
    tx('b', '2026-10-05', 3000, 'Groceries'),
    tx('c', '2026-10-06', 9000, 'Food & Drink'),
    tx('d', '2026-10-07', 1000, 'Transport'),
    tx('e', '2026-10-08', 500000, 'Salary', 'income'),
  ]

  it('classifies spending against a budget', () => {
    expect(budgetState(7999, 10000)).toBe('ok')
    expect(budgetState(8000, 10000)).toBe('near')
    expect(budgetState(10000, 10000)).toBe('near') // exactly at the limit is not over yet
    expect(budgetState(10001, 10000)).toBe('over')
    expect(budgetState(0, 10000)).toBe('ok')
  })

  it('sums spending per category and ignores income', () => {
    const spent = spentByCategory(october)
    expect(spent.get('Groceries')).toBe(9000)
    expect(spent.get('Transport')).toBe(1000)
    expect(spent.has('Salary')).toBe(false)
  })

  it('reports status only for budgeted categories, in category order', () => {
    const statuses = budgetStatuses(october, { Transport: 20000, Groceries: 8000, 'Food & Drink': 9000 })
    expect(statuses.map((s) => [s.category, s.state])).toEqual([
      ['Food & Drink', 'near'],
      ['Groceries', 'over'],
      ['Transport', 'ok'],
    ])
    expect(statuses[1]).toMatchObject({ spentCents: 9000, remainingCents: -1000, ratio: 9000 / 8000 })
  })

  it('shows a budget with no spending as untouched', () => {
    expect(budgetStatuses([], { Health: 5000 })).toEqual([
      { category: 'Health', budgetCents: 5000, spentCents: 0, remainingCents: 5000, ratio: 0, state: 'ok' },
    ])
  })

  it('returns nothing when there are no budgets', () => {
    expect(budgetStatuses(october, {})).toEqual([])
  })
})

describe('budgets for custom categories', () => {
  it('follows the given order and puts unknown categories last', () => {
    const statuses = budgetStatuses([tx('a', '2026-10-01', 2000, 'Pets')], { Pets: 5000, Groceries: 100, Books: 10 }, [
      'Groceries',
      'Pets',
    ])
    expect(statuses.map((s) => [s.category, s.spentCents])).toEqual([
      ['Groceries', 0],
      ['Pets', 2000],
      ['Books', 0],
    ])
  })
})

describe('compareMonths', () => {
  it('lines up each category across two months, biggest this month first', () => {
    const thisMonth = [
      tx('a', '2026-10-02', 3000, 'Food & Drink'),
      tx('b', '2026-10-03', 500, 'Transport'),
      tx('c', '2026-10-04', 900, 'Salary', 'income'),
    ]
    const lastMonth = [tx('d', '2026-09-02', 2000, 'Food & Drink'), tx('e', '2026-09-05', 1500, 'Shopping')]
    expect(compareMonths(thisMonth, lastMonth)).toEqual([
      { category: 'Food & Drink', thisCents: 3000, lastCents: 2000, changeCents: 1000 },
      { category: 'Transport', thisCents: 500, lastCents: 0, changeCents: 500 },
      { category: 'Shopping', thisCents: 0, lastCents: 1500, changeCents: -1500 },
    ])
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
