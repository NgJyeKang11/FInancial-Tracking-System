import type { TransactionInput } from '../types'
import { categorize } from './categorize'
import { daysInMonth } from './dates'

export type DateOrder = 'dmy' | 'mdy'

/** Which CSV column holds each field; -1 means "not in this file". */
export interface ColumnMap {
  date: number
  description: number
  /** One signed amount column (negative = money out)... */
  amount: number
  /** ...or separate money-out / money-in columns. */
  debit: number
  credit: number
}

export interface ImportOptions {
  columns: ColumnMap
  dateOrder: DateOrder
  /** For banks (often credit cards) that list spending as positive numbers. */
  flipSigns: boolean
}

export type ImportRow =
  | { ok: true; line: number; input: TransactionInput }
  | { ok: false; line: number; reason: string }

const MAX_NOTE_LENGTH = 100

/**
 * Splits CSV text into rows of cells. Handles quoted cells (with commas, newlines and `""`
 * escapes), a leading byte-order mark, and comma, semicolon or tab separators.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '')
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [',', ';', '\t'].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  )

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  const endCell = () => {
    row.push(cell.trim())
    cell = ''
  }
  const endRow = () => {
    endCell()
    if (row.some((c) => c !== '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (inQuotes) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      endCell()
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++
      endRow()
    } else {
      cell += ch
    }
  }
  endRow()
  return rows
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')

function toISO(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2200) return null
  if (day > daysInMonth(`${year}-${pad(month)}`)) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y))

/**
 * Reads a date like "2026-10-12", "12/10/2026", "12 Oct 2026" or "Oct 12, 2026" (any time of
 * day after it is ignored) and returns YYYY-MM-DD, or null if it isn't a real date.
 * `order` decides what "03/04/2026" means: day first or month first.
 */
export function parseDateLoose(value: string, order: DateOrder): string | null {
  const s = value.trim()

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/)
  if (m) return toISO(Number(m[1]), Number(m[2]), Number(m[3]))

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/)
  if (m) {
    const [first, second] = [Number(m[1]), Number(m[2])]
    return order === 'dmy' ? toISO(fullYear(m[3]), second, first) : toISO(fullYear(m[3]), first, second)
  }

  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4}|\d{2})(?!\d)/)
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1
    return month > 0 ? toISO(fullYear(m[3]), month, Number(m[1])) : null
  }

  m = s.match(/^([A-Za-z]{3,9})\.?[\s-]+(\d{1,2}),?[\s-]+(\d{4})(?!\d)/)
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1
    return month > 0 ? toISO(Number(m[3]), month, Number(m[2])) : null
  }

  return null
}

/**
 * Looks at the numeric dates in a column to guess whether they are day-first or month-first.
 * If a value like 25/03/2026 settles it, that wins; otherwise day-first (the more common order).
 */
export function detectDateOrder(samples: string[]): DateOrder {
  for (const s of samples) {
    const m = s.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/)
    if (!m) continue
    if (Number(m[1]) > 12) return 'dmy'
    if (Number(m[2]) > 12) return 'mdy'
  }
  return 'dmy'
}

/**
 * Reads a money amount into signed cents: "1,234.56", "-12.50", "(12.50)", "RM 12,50",
 * "12.50 DR" (negative) and "12.50 CR" (positive). Returns null if there is no number in it.
 */
export function parseSignedAmount(value: string): number | null {
  const s = value.trim()
  if (s === '') return null

  const negative = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s) || /\bDR\b/i.test(s) || /^[^\d]*-/.test(s)
  let digits = s.replace(/[^\d.,]/g, '')
  if (!/\d/.test(digits)) return null

  const lastDot = digits.lastIndexOf('.')
  const lastComma = digits.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: whichever comes last is the decimal mark, the other groups thousands.
    const decimal = lastDot > lastComma ? '.' : ','
    const grouping = decimal === '.' ? ',' : '.'
    digits = digits.split(grouping).join('').replace(decimal, '.')
  } else if (lastComma >= 0) {
    // Only commas: "12,50" is a decimal comma, "1,234" or "1,234,567" are thousands.
    const afterLast = digits.length - lastComma - 1
    const single = digits.indexOf(',') === lastComma
    digits = single && afterLast !== 3 ? digits.replace(',', '.') : digits.split(',').join('')
  }

  if (!/^\d*\.?\d*$/.test(digits) || digits === '.') return null
  const [whole = '0', fraction = ''] = digits.split('.')
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0').slice(0, 2))
  if (!Number.isSafeInteger(cents)) return null
  return negative ? -cents : cents
}

/** Guesses which column is which from the header names in the first row. */
export function guessColumns(headers: string[]): ColumnMap {
  const find = (test: RegExp, skip: RegExp | null = null) =>
    headers.findIndex((h) => test.test(h.toLowerCase()) && !(skip && skip.test(h.toLowerCase())))

  const debit = find(/debit|withdraw|money out|paid out|\bout\b/)
  const credit = find(/credit|deposit|money in|paid in|\bin\b/)
  // Prefer the date the transaction happened over other dates such as "value date".
  const transactionDate = find(/trans.*date|posting date|date.*trans/)
  const date = transactionDate >= 0 ? transactionDate : find(/date|tarikh/, /value date|balance/)
  const description = find(/desc|detail|narrat|particular|memo|payee|merchant|reference|keterangan/)
  const amount = find(/amount|amt|jumlah|^value$/, /balance|debit|credit/)

  return { date, description, amount, debit, credit }
}

/** True if a row looks like a transaction (a real date plus an amount) rather than a header. */
export function looksLikeData(row: string[], order: DateOrder = 'dmy'): boolean {
  return row.some((c) => parseDateLoose(c, order) !== null) && row.some((c) => /\d/.test(c) && parseSignedAmount(c) !== null)
}

const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? '') : '')

/**
 * Turns CSV rows into transactions using the chosen columns. Rows that can't be read come back
 * as `ok: false` with a reason, so nothing is silently dropped. `line` is the row's position in
 * the original file (1-based), counting a header row if the caller left it in `rows`.
 */
export function rowsToTransactions(rows: string[][], options: ImportOptions, firstLine = 1): ImportRow[] {
  const { columns, dateOrder, flipSigns } = options

  return rows.map((row, i): ImportRow => {
    const line = firstLine + i

    const date = parseDateLoose(cell(row, columns.date), dateOrder)
    if (!date) return { ok: false, line, reason: `Couldn't read the date "${cell(row, columns.date)}"` }

    let signed: number | null = null
    if (columns.debit >= 0 || columns.credit >= 0) {
      const out = parseSignedAmount(cell(row, columns.debit))
      const inn = parseSignedAmount(cell(row, columns.credit))
      if (out !== null && out !== 0) signed = -Math.abs(out)
      else if (inn !== null && inn !== 0) signed = Math.abs(inn)
    } else {
      signed = parseSignedAmount(cell(row, columns.amount))
    }
    if (signed === null || signed === 0) return { ok: false, line, reason: 'No amount found' }
    if (flipSigns) signed = -signed

    const type = signed < 0 ? 'expense' : 'income'
    const description = cell(row, columns.description).replace(/\s+/g, ' ').trim()
    return {
      ok: true,
      line,
      input: {
        type,
        amountCents: Math.abs(signed),
        category: categorize(description, type),
        date,
        note: description.slice(0, MAX_NOTE_LENGTH),
      },
    }
  })
}

/**
 * Flags rows that are already in the tracker (same date, type, amount and note). Counts matches
 * so two identical purchases on one day only match two existing ones, not every future import.
 */
export function findDuplicates(
  inputs: TransactionInput[],
  existing: TransactionInput[],
): boolean[] {
  const key = (t: TransactionInput) => `${t.date}|${t.type}|${t.amountCents}|${t.note.toLowerCase()}`
  const available = new Map<string, number>()
  for (const t of existing) available.set(key(t), (available.get(key(t)) ?? 0) + 1)

  return inputs.map((t) => {
    const left = available.get(key(t)) ?? 0
    if (left === 0) return false
    available.set(key(t), left - 1)
    return true
  })
}
