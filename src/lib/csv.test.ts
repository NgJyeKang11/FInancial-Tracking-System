import { describe, expect, it } from 'vitest'
import type { TransactionInput } from '../types'
import { categorize } from './categorize'
import {
  detectDateOrder,
  findDuplicates,
  guessColumns,
  looksLikeData,
  parseCsv,
  parseDateLoose,
  parseSignedAmount,
  rowsToTransactions,
} from './csv'

describe('parseCsv', () => {
  it('splits rows and cells, ignoring blank lines and CRLF', () => {
    expect(parseCsv('a,b,c\r\n1,2,3\r\n\r\n4,5,6\r\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
      ['4', '5', '6'],
    ])
  })

  it('handles quoted cells with commas, quotes and newlines', () => {
    expect(parseCsv('Date,Description\n2026-10-01,"Coffee, large ""oat"""\n2026-10-02,"two\nlines"')).toEqual([
      ['Date', 'Description'],
      ['2026-10-01', 'Coffee, large "oat"'],
      ['2026-10-02', 'two\nlines'],
    ])
  })

  it('detects semicolon and tab separators and strips a byte-order mark', () => {
    expect(parseCsv('﻿a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('parseDateLoose', () => {
  it('reads common formats', () => {
    expect(parseDateLoose('2026-10-12', 'dmy')).toBe('2026-10-12')
    expect(parseDateLoose('2026/10/12 14:30:00', 'dmy')).toBe('2026-10-12')
    expect(parseDateLoose('12 Oct 2026', 'dmy')).toBe('2026-10-12')
    expect(parseDateLoose('12-October-2026', 'dmy')).toBe('2026-10-12')
    expect(parseDateLoose('Oct 12, 2026', 'dmy')).toBe('2026-10-12')
    expect(parseDateLoose('5/1/26', 'dmy')).toBe('2026-01-05')
  })

  it('uses the chosen order for ambiguous numeric dates', () => {
    expect(parseDateLoose('03/04/2026', 'dmy')).toBe('2026-04-03')
    expect(parseDateLoose('03/04/2026', 'mdy')).toBe('2026-03-04')
  })

  it('rejects things that are not real dates', () => {
    expect(parseDateLoose('31/02/2026', 'dmy')).toBeNull()
    expect(parseDateLoose('13/13/2026', 'dmy')).toBeNull()
    expect(parseDateLoose('Balance', 'dmy')).toBeNull()
    expect(parseDateLoose('', 'dmy')).toBeNull()
    expect(parseDateLoose('12.50', 'dmy')).toBeNull()
  })

  it('works out day-first or month-first from the data', () => {
    expect(detectDateOrder(['03/04/2026', '25/04/2026'])).toBe('dmy')
    expect(detectDateOrder(['03/04/2026', '04/25/2026'])).toBe('mdy')
    expect(detectDateOrder(['03/04/2026', '2026-04-05'])).toBe('dmy')
  })
})

describe('parseSignedAmount', () => {
  it('reads plain, grouped and negative amounts into cents', () => {
    expect(parseSignedAmount('12.50')).toBe(1250)
    expect(parseSignedAmount('1,234.56')).toBe(123456)
    expect(parseSignedAmount('-12.5')).toBe(-1250)
    expect(parseSignedAmount('(45.00)')).toBe(-4500)
    expect(parseSignedAmount('45.00-')).toBe(-4500)
    expect(parseSignedAmount('RM 1,200.00')).toBe(120000)
    expect(parseSignedAmount('-$3.99')).toBe(-399)
    expect(parseSignedAmount('7')).toBe(700)
  })

  it('understands decimal commas and DR/CR markers', () => {
    expect(parseSignedAmount('12,50')).toBe(1250)
    expect(parseSignedAmount('1.234,56')).toBe(123456)
    expect(parseSignedAmount('1,234')).toBe(123400)
    expect(parseSignedAmount('1,234,567')).toBe(123456700)
    expect(parseSignedAmount('20.00 DR')).toBe(-2000)
    expect(parseSignedAmount('20.00 CR')).toBe(2000)
  })

  it('returns null when there is no number', () => {
    expect(parseSignedAmount('')).toBeNull()
    expect(parseSignedAmount('n/a')).toBeNull()
    expect(parseSignedAmount('.')).toBeNull()
  })

  it('does not lose cents to floating-point rounding', () => {
    expect(parseSignedAmount('0.29')).toBe(29)
    expect(parseSignedAmount('1.15')).toBe(115)
    expect(parseSignedAmount('19.99')).toBe(1999)
  })
})

describe('guessColumns', () => {
  it('finds a single amount column', () => {
    expect(guessColumns(['Date', 'Description', 'Amount', 'Balance'])).toEqual({
      date: 0,
      description: 1,
      amount: 2,
      debit: -1,
      credit: -1,
    })
  })

  it('finds separate debit and credit columns', () => {
    expect(guessColumns(['Transaction Date', 'Value Date', 'Details', 'Withdrawals', 'Deposits', 'Balance'])).toEqual({
      date: 0,
      description: 2,
      amount: -1,
      debit: 3,
      credit: 4,
    })
  })

  it('leaves unknown columns unset', () => {
    expect(guessColumns(['a', 'b'])).toEqual({ date: -1, description: -1, amount: -1, debit: -1, credit: -1 })
  })

  it('tells headers from data rows', () => {
    expect(looksLikeData(['Date', 'Description', 'Amount'])).toBe(false)
    expect(looksLikeData(['2026-10-01', 'Coffee', '-4.50'])).toBe(true)
  })
})

describe('rowsToTransactions', () => {
  const single = { columns: { date: 0, description: 1, amount: 2, debit: -1, credit: -1 }, dateOrder: 'dmy' as const, flipSigns: false }

  it('turns a signed amount column into expenses and income', () => {
    const rows = rowsToTransactions(
      [
        ['01/10/2026', 'SALARY OCT', '4,500.00'],
        ['02/10/2026', 'STARBUCKS KLCC', '-18.90'],
      ],
      single,
    )
    expect(rows).toEqual([
      { ok: true, line: 1, input: { type: 'income', amountCents: 450000, category: 'Salary', date: '2026-10-01', note: 'SALARY OCT' } },
      { ok: true, line: 2, input: { type: 'expense', amountCents: 1890, category: 'Food & Drink', date: '2026-10-02', note: 'STARBUCKS KLCC' } },
    ])
  })

  it('can flip signs for statements that list spending as positive', () => {
    const [row] = rowsToTransactions([['2026-10-02', 'Shell station', '60.00']], { ...single, flipSigns: true })
    expect(row).toMatchObject({ ok: true, input: { type: 'expense', amountCents: 6000, category: 'Transport' } })
  })

  it('reads separate debit and credit columns', () => {
    const options = { ...single, columns: { date: 0, description: 1, amount: -1, debit: 2, credit: 3 } }
    const rows = rowsToTransactions([['2026-10-02', 'Rent', '1,200.00', ''], ['2026-10-03', 'Refund', '', '30.00']], options)
    expect(rows.map((r) => r.ok && [r.input.type, r.input.amountCents])).toEqual([
      ['expense', 120000],
      ['income', 3000],
    ])
  })

  it('reports rows it cannot read instead of dropping them', () => {
    const rows = rowsToTransactions(
      [
        ['not a date', 'x', '5.00'],
        ['2026-10-02', 'no amount', ''],
        ['2026-10-02', 'zero', '0.00'],
      ],
      single,
      5,
    )
    expect(rows).toEqual([
      { ok: false, line: 5, reason: 'Couldn\'t read the date "not a date"' },
      { ok: false, line: 6, reason: 'No amount found' },
      { ok: false, line: 7, reason: 'No amount found' },
    ])
  })

  it('shortens long descriptions to fit the note field', () => {
    const [row] = rowsToTransactions([['2026-10-02', 'x'.repeat(250), '-1.00']], single)
    expect(row.ok && row.input.note).toHaveLength(100)
  })
})

describe('findDuplicates', () => {
  const t = (date: string, amountCents: number, note: string): TransactionInput => ({
    type: 'expense',
    amountCents,
    category: 'Other',
    date,
    note,
  })

  it('flags rows already in the tracker, ignoring case', () => {
    expect(findDuplicates([t('2026-10-01', 500, 'COFFEE'), t('2026-10-02', 700, 'Lunch')], [t('2026-10-01', 500, 'coffee')])).toEqual([
      true,
      false,
    ])
  })

  it('matches each existing entry only once', () => {
    const coffee = t('2026-10-01', 500, 'Coffee')
    expect(findDuplicates([coffee, coffee, coffee], [coffee])).toEqual([true, false, false])
    expect(findDuplicates([coffee, coffee, coffee], [coffee, coffee])).toEqual([true, true, false])
  })
})

describe('categorize', () => {
  it('picks categories from descriptions', () => {
    expect(categorize('GRABFOOD *ORDER 123', 'expense')).toBe('Food & Drink')
    expect(categorize('GRAB RIDE KL', 'expense')).toBe('Transport')
    expect(categorize('JAYA GROCER BANGSAR', 'expense')).toBe('Groceries')
    expect(categorize('NETFLIX.COM', 'expense')).toBe('Entertainment')
    expect(categorize('Guardian Pharmacy', 'expense')).toBe('Health')
    expect(categorize('TNB electric bill', 'expense')).toBe('Bills & Utilities')
    expect(categorize('SHOPEE MY', 'expense')).toBe('Shopping')
    expect(categorize('SALARY ACME SDN BHD', 'income')).toBe('Salary')
    expect(categorize('Dividend payment', 'income')).toBe('Investments')
  })

  it('only matches the start of words', () => {
    expect(categorize('Current account fee', 'expense')).toBe('Other')
    expect(categorize('Transfer to parent', 'expense')).toBe('Other')
    expect(categorize('Monthly rent', 'expense')).toBe('Bills & Utilities')
  })

  it('falls back to Other and Other income', () => {
    expect(categorize('XYZ 12345', 'expense')).toBe('Other')
    expect(categorize('XYZ 12345', 'income')).toBe('Other income')
    expect(categorize('', 'expense')).toBe('Other')
  })
})
