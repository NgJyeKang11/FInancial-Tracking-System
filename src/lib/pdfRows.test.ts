import { describe, expect, it } from 'vitest'
import { groupLines, parseStatementRows, splitLeadingDate, tidyDescription, type PdfTextItem } from './pdfRows'

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

  it('reads dates written with no space between day and month', () => {
    expect(splitLeadingDate('09Dec')).toEqual({ raw: '09Dec', rest: '', partial: true })
    expect(splitLeadingDate('1Jan GRAB')).toEqual({ raw: '1Jan', rest: 'GRAB', partial: true })
  })

  it('only treats real month names as months', () => {
    expect(splitLeadingDate('12 Marina Bay')).toBeNull()
    expect(splitLeadingDate('3 Decimal Rd')).toBeNull()
    expect(splitLeadingDate('5 March')).toEqual({ raw: '5 March', rest: '', partial: true })
  })

  it('does not mistake other text for a date', () => {
    expect(splitLeadingDate('1. PRIVACY NOTICE')).toBeNull()
    expect(splitLeadingDate('50000 Kuala Lumpur.')).toBeNull()
    expect(splitLeadingDate('Balance')).toBeNull()
    expect(splitLeadingDate('12 Main Street')).toBeNull()
    expect(splitLeadingDate('1,234.50')).toBeNull()
    expect(splitLeadingDate('45 Oakland')).toBeNull()
  })
})

describe('tidyDescription', () => {
  it('drops reference numbers and leftover commas', () => {
    expect(tidyDescription('DuitNowQR Payment /MISC DEBIT, SOME CAFE, QR20251209077761,')).toBe(
      'DuitNowQR Payment /MISC DEBIT, SOME CAFE',
    )
    expect(tidyDescription('INT/HB/PFT, , ,')).toBe('INT/HB/PFT')
    expect(tidyDescription('FPX PAYMENT, SOME FUND 010126025602412V1001, 2601011422140832')).toBe(
      'FPX PAYMENT, SOME FUND',
    )
    expect(tidyDescription('MC Retail Off Us -Lo, SHOP, MYR9 KUALA LUMPUR MY,')).toBe(
      'MC Retail Off Us -Lo, SHOP, MYR9 KUALA LUMPUR MY',
    )
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

  it('reads a bank layout with a summary box, "09Dec" dates, wrapped lines and notices after the table', () => {
    const header = (page: number, y: number) => [
      t('DATE', 44, y, page),
      t('TRANSACTION', 146, y, page),
      t('CHEQUE NO.', 284, y, page),
      t('DEBIT', 367, y, page),
      t('CREDIT', 436, y, page),
      t('BALANCE', 508, y, page),
      t('TARIKH', 40, y - 10, page),
      t('TRANSAKSI', 153, y - 10, page),
      t('DEBIT', 367, y - 10, page),
      t('KREDIT', 436, y - 10, page),
      t('BAKI', 519, y - 10, page),
    ]
    const row = (page: number, y: number, date: string, text: string, side: 'debit' | 'credit', amount: string, balance: string) => [
      t(date, 43, y, page),
      t(text, 86, y, page),
      t(amount, side === 'debit' ? 414 : 486, y, page, true),
      t(balance, 555, y, page, true),
    ]

    const items = [
      t('STATEMENT DATE / TARIKH PENYATA : 09/12/2025 - 08/01/2026', 306, 708),
      // An account summary box whose heading also says "Balance": it is not the transaction table.
      t('CATEGORY', 154, 515),
      t('NO. OF TRANSACTION', 337, 515),
      t('BALANCE', 487, 515, 1, true),
      t('OPENING BALANCE / BAKI PEMBUKAAN', 39, 490),
      t('350.70', 555, 490, 1, true),
      t('TOTAL DEBITS / JUMLAH DEBIT', 39, 479),
      t('3', 442, 479, 1, true),
      t('1,038.44', 555, 479, 1, true),
      ...header(1, 417),
      t('Baki Bawa Ke Hadapan / Balance b/f', 86, 383),
      t('350.70', 555, 383, 1, true),
      ...row(1, 372, '09Dec', 'MC Retail Off Us -Lo, SOME SHOP,', 'debit', '9.00', '341.70'),
      t('MYR9 KUALA LUMPUR MY,', 86, 362),
      ...row(1, 350, '09Dec', 'DuitNowQR Payment /MISC DEBIT, SOME CAFE,', 'debit', '10.00', '331.70'),
      t('QR20251209077761,', 86, 340),
      ...row(1, 327, '31Dec', 'INT/HB/PFT, , ,', 'credit', '0.08', '331.78'),
      ...row(1, 314, '01Jan', 'FPX PAYMENT, SOME FUND', 'debit', '50.00', '281.78'),
      t('PEKERJA010126025602412V1001,', 86, 304),
      t('010126025602412V1001, 2601011422140832', 86, 294),
      t('AmBank (M) Berhad', 41, 68),
      t('0110_0110', 584, 38),
      // Page 2 repeats the table heading.
      ...header(2, 679),
      ...row(2, 653, '02Jan', 'MyDebit Purchase Off /MYDEBIT PURCH, SOME SHOP', 'debit', '6.00', '275.78'),
      t('1. PRIVACY NOTICE / NOTIS PRIVASI', 36, 500, 2),
      t('We may use your personal information as described in our notice.', 36, 484, 2),
    ]

    expect(parseStatementRows(items)).toEqual([
      ['Date', 'Description', 'Money out', 'Money in', 'Balance'],
      ['2025-12-09', 'MC Retail Off Us -Lo, SOME SHOP, MYR9 KUALA LUMPUR MY', '9.00', '', '341.70'],
      ['2025-12-09', 'DuitNowQR Payment /MISC DEBIT, SOME CAFE', '10.00', '', '331.70'],
      ['2025-12-31', 'INT/HB/PFT', '', '0.08', '331.78'],
      ['2026-01-01', 'FPX PAYMENT, SOME FUND', '50.00', '', '281.78'],
      ['2026-01-02', 'MyDebit Purchase Off /MYDEBIT PURCH, SOME SHOP', '6.00', '', '275.78'],
    ])
  })

  it('uses the statement period to pick the year, even when the data does not cross New Year', () => {
    const items = [
      t('Period: 01/10/2026 to 31/10/2026', 40, 780),
      t('Date', 40, 740),
      t('Description', 110, 740),
      t('Debit', 420, 740, 1, true),
      t('Credit', 490, 740, 1, true),
      t('05 Oct', 40, 720),
      t('COFFEE', 110, 720),
      t('4.50', 420, 720, 1, true),
      t('Printed 2019', 40, 40),
      t('Printed 2019', 200, 40),
    ]
    expect(parseStatementRows(items)[1][0]).toBe('2026-10-05')
  })

  it('returns nothing when no transactions can be found', () => {
    expect(parseStatementRows([])).toEqual([])
    expect(parseStatementRows([t('Hello there', 40, 700), t('Nothing useful', 40, 680)])).toEqual([])
  })
})
