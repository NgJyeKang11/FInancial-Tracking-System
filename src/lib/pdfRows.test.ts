import { describe, expect, it } from 'vitest'
import { groupLines, parseStatementRows, splitLeadingDate, type PdfTextItem } from './pdfRows'

const CHAR = 5

/** One piece of text; `right` puts its right edge at x (like a right-aligned number column). */
const t = (str: string, x: number, y: number, page = 1, right = false): PdfTextItem => {
  const width = str.length * CHAR
  return { str, x: right ? x - width : x, y, width, height: 9, page }
}

describe('splitLeadingDate', () => {
  it('splits full and partial dates off the start of a cell', () => {
    expect(splitLeadingDate('01/10/2026 STARBUCKS')).toEqual({ raw: '01/10/2026', rest: 'STARBUCKS', partial: false })
    expect(splitLeadingDate('12 Oct 2026')).toEqual({ raw: '12 Oct 2026', rest: '', partial: false })
    expect(splitLeadingDate('01 OCT')).toEqual({ raw: '01 OCT', rest: '', partial: true })
    expect(splitLeadingDate('01/10 GRAB')).toEqual({ raw: '01/10', rest: 'GRAB', partial: true })
  })

  it('does not mistake other text for a date', () => {
    expect(splitLeadingDate('Balance')).toBeNull()
    expect(splitLeadingDate('12 Main Street')).toBeNull()
    expect(splitLeadingDate('1,234.50')).toBeNull()
    expect(splitLeadingDate('45 Oakland')).toBeNull()
  })
})

describe('groupLines', () => {
  it('puts items on the same line together and splits cells at wide gaps', () => {
    const lines = groupLines([
      t('Hello', 10, 700),
      t('world', 40, 700), // 5 apart from "Hello" (ends at 35): same cell
      t('99.00', 300, 700.5), // far away: new cell, y within tolerance
      t('Next', 10, 680),
    ])
    expect(lines.map((l) => l.cells.map((c) => c.text))).toEqual([['Hello world', '99.00'], ['Next']])
  })

  it('keeps pages apart', () => {
    const lines = groupLines([t('B', 10, 700, 2), t('A', 10, 100, 1)])
    expect(lines.map((l) => l.cells[0].text)).toEqual(['A', 'B'])
  })
})

describe('parseStatementRows', () => {
  it('reads a statement with separate money out / money in columns', () => {
    const items = [
      t('Statement period 01 Oct 2026 to 31 Oct 2026', 40, 780),
      t('Date', 40, 740),
      t('Description', 110, 740),
      t('Money out', 420, 740, 1, true),
      t('Money in', 490, 740, 1, true),
      t('Balance', 560, 740, 1, true),
      t('01 Oct', 40, 720),
      t('SALARY ACME SDN BHD', 110, 720),
      t('4,500.00', 490, 720, 1, true),
      t('5,500.00', 560, 720, 1, true),
      t('02 Oct', 40, 705),
      t('RENT OCTOBER', 110, 705),
      t('1,200.00', 420, 705, 1, true),
      t('4,300.00', 560, 705, 1, true),
      t('Page 1 of 1', 280, 40),
    ]
    expect(parseStatementRows(items)).toEqual([
      ['Date', 'Description', 'Money out', 'Money in', 'Balance'],
      ['2026-10-01', 'SALARY ACME SDN BHD', '', '4,500.00', '5,500.00'],
      ['2026-10-02', 'RENT OCTOBER', '1,200.00', '', '4,300.00'],
    ])
  })

  it('works out money in/out from the balance when there is one amount column', () => {
    const items = [
      t('Date', 40, 740),
      t('Details', 110, 740),
      t('Amount', 450, 740, 1, true),
      t('Balance', 540, 740, 1, true),
      t('Balance b/f', 110, 720),
      t('1,000.00', 540, 720, 1, true),
      t('03/10/2026', 40, 700),
      t('COFFEE SHOP', 110, 700),
      t('12.50', 450, 700, 1, true),
      t('987.50', 540, 700, 1, true),
      t('04/10/2026', 40, 685),
      t('REFUND', 110, 685),
      t('7.50', 450, 685, 1, true),
      t('995.00', 540, 685, 1, true),
      t('05/10/2026', 40, 670),
      t('CARD PAYMENT', 110, 670),
      t('100.00', 450, 670, 1, true),
      t('895.00', 540, 670, 1, true),
      t('Closing balance', 110, 650),
      t('895.00', 540, 650, 1, true),
    ]
    expect(parseStatementRows(items)).toEqual([
      ['Date', 'Description', 'Amount', 'Balance'],
      ['2026-10-03', 'COFFEE SHOP', '-12.50', '987.50'],
      ['2026-10-04', 'REFUND', '7.50', '995.00'],
      ['2026-10-05', 'CARD PAYMENT', '-100.00', '895.00'],
    ])
  })

  it('respects explicit signs, brackets and DR/CR over the balance', () => {
    const items = [
      t('Date', 40, 740),
      t('Description', 110, 740),
      t('Amount', 500, 740, 1, true),
      t('2026-10-01', 40, 720),
      t('SHOP', 110, 720),
      t('(20.00)', 500, 720, 1, true),
      t('2026-10-02', 40, 705),
      t('PAYMENT', 110, 705),
      t('50.00 CR', 500, 705, 1, true),
      t('2026-10-03', 40, 690),
      t('FEE', 110, 690),
      t('3.00 DR', 500, 690, 1, true),
    ]
    expect(parseStatementRows(items).slice(1)).toEqual([
      ['2026-10-01', 'SHOP', '(20.00)'],
      ['2026-10-02', 'PAYMENT', '50.00 CR'],
      ['2026-10-03', 'FEE', '3.00 DR'],
    ])
  })

  it('joins a wrapped description and ignores footers and other pages\' headers', () => {
    const items = [
      t('Date', 40, 740),
      t('Description', 110, 740),
      t('Debit', 420, 740, 1, true),
      t('Credit', 490, 740, 1, true),
      t('01/10/2026', 40, 720),
      t('TRANSFER TO JOHN', 110, 720),
      t('50.00', 420, 720, 1, true),
      t('RENT SHARE OCTOBER', 110, 709), // wrapped line, no date, no amount
      t('Page 1 of 2', 280, 40),
      t('Date', 40, 740, 2),
      t('Description', 110, 740, 2),
      t('02/10/2026', 40, 720, 2),
      t('LUNCH', 110, 720, 2),
      t('9.00', 420, 720, 2, true),
    ]
    expect(parseStatementRows(items)).toEqual([
      ['Date', 'Description', 'Money out', 'Money in'],
      ['2026-10-01', 'TRANSFER TO JOHN RENT SHARE OCTOBER', '50.00', ''],
      ['2026-10-02', 'LUNCH', '9.00', ''],
    ])
  })

  it('fills in the year from the statement and handles December into January', () => {
    const items = [
      t('Statement 01 Dec 2025 to 31 Jan 2026', 40, 780),
      t('Date', 40, 740),
      t('Description', 110, 740),
      t('Debit', 420, 740, 1, true),
      t('Credit', 490, 740, 1, true),
      t('30 Dec', 40, 720),
      t('GROCERIES', 110, 720),
      t('40.00', 420, 720, 1, true),
      t('02 Jan', 40, 705),
      t('SALARY', 110, 705),
      t('900.00', 490, 705, 1, true),
    ]
    expect(parseStatementRows(items).slice(1).map((r) => r[0])).toEqual(['2025-12-30', '2026-01-02'])
  })

  it('reads day-first and month-first numeric dates using the data', () => {
    const rows = (a: string, b: string) =>
      parseStatementRows([
        t('Date', 40, 740),
        t('Description', 110, 740),
        t('Debit', 420, 740, 1, true),
        t('Credit', 490, 740, 1, true),
        t(a, 40, 720),
        t('X', 110, 720),
        t('1.00', 420, 720, 1, true),
        t(b, 40, 705),
        t('Y', 110, 705),
        t('2.00', 420, 705, 1, true),
      ]).slice(1)
    expect(rows('03/04/2026', '25/04/2026').map((r) => r[0])).toEqual(['2026-04-03', '2026-04-25'])
    expect(rows('03/04/2026', '04/25/2026').map((r) => r[0])).toEqual(['2026-03-04', '2026-04-25'])
  })

  it('returns nothing when no transactions can be found', () => {
    expect(parseStatementRows([])).toEqual([])
    expect(parseStatementRows([t('Hello there', 40, 700), t('Nothing useful', 40, 680)])).toEqual([])
  })
})
