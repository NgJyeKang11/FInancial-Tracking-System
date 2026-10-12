import { detectDateOrder, parseDateLoose, parseSignedAmount, type DateOrder } from './csv'

/** A piece of text from a PDF page with its position (PDF units; y grows upwards). */
export interface PdfTextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
  page: number
}

interface Cell {
  text: string
  x0: number
  x1: number
}

interface Line {
  page: number
  y: number
  height: number
  cells: Cell[]
}

type ColumnKind = 'debit' | 'credit' | 'amount' | 'balance'

interface HeaderColumn extends Cell {
  kind: ColumnKind
}

interface RawRow {
  date: string
  description: string
  debit?: string
  credit?: string
  amount?: string
  balance?: string
}

const LINE_TOLERANCE = 2.5
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * Groups loose text items into lines (top to bottom, page by page) and each line into cells
 * (left to right). Words that sit close together stay in one cell; a wider gap starts a new one,
 * which is how table columns are told apart.
 */
export function groupLines(items: PdfTextItem[]): Line[] {
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b)
  const lines: Line[] = []

  for (const page of pages) {
    const onPage = items.filter((i) => i.page === page && i.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x)
    let group: PdfTextItem[] = []
    const flush = () => {
      if (group.length === 0) return
      const sorted = [...group].sort((a, b) => a.x - b.x)
      const cells: Cell[] = []
      for (const item of sorted) {
        const last = cells[cells.length - 1]
        const gap = last ? item.x - last.x1 : Infinity
        if (last && gap <= Math.max(5, item.height * 0.6)) {
          last.text += (gap > 1 ? ' ' : '') + item.str.trim()
          last.x1 = item.x + item.width
        } else {
          cells.push({ text: item.str.trim(), x0: item.x, x1: item.x + item.width })
        }
      }
      lines.push({ page, y: group[0].y, height: Math.max(...group.map((g) => g.height)), cells })
      group = []
    }
    for (const item of onPage) {
      if (group.length > 0 && Math.abs(item.y - group[0].y) > LINE_TOLERANCE) flush()
      group.push(item)
    }
    flush()
  }
  return lines
}

const CURRENCY_PREFIX = /^(?:RM|MYR|SGD|S\$|USD|US\$|\$|€|£|¥)\s*/i

/** True for a money amount with two decimals, e.g. "1,234.50", "(45.00)", "RM 12.50", "20.00 DR". */
function isAmountCell(text: string): boolean {
  return /^[-+(]?\s*\d[\d,.]*[.,]\d{2}\s*\)?\s*(?:CR|DR|-|\+)?$/i.test(text.trim().replace(CURRENCY_PREFIX, ''))
}

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1
}

interface LeadingDate {
  raw: string
  rest: string
  /** True when the date has no year ("01 Oct", "01/10"), so the statement's year is needed. */
  partial: boolean
}

const FULL_DATES = [
  /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?!\d)/,
  /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}(?!\d)/,
  /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2}(?![\d])/,
  /^\d{1,2}[\s-]+[A-Za-z]{3,9}\.?,?[\s-]+\d{4}(?!\d)/,
  /^\d{1,2}[\s-]+[A-Za-z]{3,9}\.?,?[\s-]+\d{2}(?!\d)/,
]

/** Splits a date off the start of a cell ("01/10/2026 STARBUCKS" -> date + "STARBUCKS"). */
export function splitLeadingDate(text: string): LeadingDate | null {
  const s = text.trim()
  for (const pattern of FULL_DATES) {
    const m = s.match(pattern)
    if (m && (parseDateLoose(m[0], 'dmy') ?? parseDateLoose(m[0], 'mdy')) !== null) {
      return { raw: m[0], rest: s.slice(m[0].length).trim(), partial: false }
    }
  }
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?![\d/.-])/)
  if (m && Number(m[1]) <= 31 && Number(m[2]) <= 31) {
    return { raw: m[0], rest: s.slice(m[0].length).trim(), partial: true }
  }
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?(?![A-Za-z])/)
  if (m && monthIndex(m[2]) > 0 && Number(m[1]) <= 31) {
    return { raw: m[0], rest: s.slice(m[0].length).trim(), partial: true }
  }
  return null
}

const kindOfHeader = (text: string): ColumnKind | 'date' | 'description' | null => {
  const t = text.toLowerCase()
  if (/debit|withdraw|money out|paid out|\bout\b|\bdr\b/.test(t)) return 'debit'
  if (/credit|deposit|money in|paid in|\bin\b|\bcr\b/.test(t)) return 'credit'
  if (/balance|baki/.test(t)) return 'balance'
  if (/amount|amt|jumlah/.test(t)) return 'amount'
  if (/date|tarikh/.test(t)) return 'date'
  if (/desc|detail|particular|narrat|transaction|payee|keterangan/.test(t)) return 'description'
  return null
}

/** Finds the table's header line (the one naming the money columns) and where each column sits. */
function findHeader(lines: Line[]): { index: number; columns: HeaderColumn[] } | null {
  for (let index = 0; index < lines.length; index++) {
    const kinds = lines[index].cells.map((c) => kindOfHeader(c.text))
    const money = kinds.filter((k) => k === 'debit' || k === 'credit' || k === 'amount' || k === 'balance')
    const labels = kinds.filter((k) => k === 'date' || k === 'description')
    if (money.length >= 2 || (money.length >= 1 && labels.length >= 1)) {
      const columns = lines[index].cells.flatMap((c, i) => {
        const kind = kinds[i]
        return kind === 'debit' || kind === 'credit' || kind === 'amount' || kind === 'balance' ? [{ ...c, kind }] : []
      })
      return { index, columns }
    }
  }
  return null
}

/** The header column an amount sits under: nearest by centre, left edge or right edge. */
function nearestColumn(cell: Cell, columns: HeaderColumn[]): HeaderColumn {
  const distance = (c: HeaderColumn) =>
    Math.min(
      Math.abs((cell.x0 + cell.x1) / 2 - (c.x0 + c.x1) / 2),
      Math.abs(cell.x0 - c.x0),
      Math.abs(cell.x1 - c.x1),
    )
  return columns.reduce((best, c) => (distance(c) < distance(best) ? c : best))
}

const BALANCE_LINE =
  /b\/f|c\/f|brought forward|carried forward|opening balance|closing balance|balance forward|beginning balance|ending balance/i
const FOOTER = /page\s*\d|continued|statement of|total\b|closing balance|end of statement/i

/** The year to use for dates that don't show one: the one that appears most in the document. */
function statementYear(lines: Line[]): number {
  const counts = new Map<number, number>()
  for (const line of lines) {
    for (const m of line.cells.map((c) => c.text).join(' ').matchAll(/\b(19|20)\d{2}\b/g)) {
      counts.set(Number(m[0]), (counts.get(Number(m[0])) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return new Date().getFullYear()
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
}

/**
 * Rebuilds a statement's transaction table from the text of a PDF. The result looks like a CSV
 * (a header row plus one row per transaction) so it can use the same import preview. Returns an
 * empty list when no transactions could be found.
 *
 * It looks for lines that start with a date and end with money amounts. If the statement has
 * separate money-out / money-in columns they are kept apart; if it has a single amount column,
 * the sign comes from the amount itself (-, brackets, DR/CR) or from how the balance changed.
 */
export function parseStatementRows(items: PdfTextItem[]): string[][] {
  const lines = groupLines(items)
  const header = findHeader(lines)
  const year = statementYear(lines)
  const hasSplit = header?.columns.some((c) => c.kind === 'debit' || c.kind === 'credit') ?? false

  const raws: { row: RawRow; leading: LeadingDate; descX: number }[] = []
  let openingBalance: number | null = null
  let lastLine: Line | null = null

  for (let i = header ? header.index + 1 : 0; i < lines.length; i++) {
    const line = lines[i]
    const first = splitLeadingDate(line.cells[0].text)

    // "Balance b/f", "Closing balance" and similar lines are not transactions. The opening
    // balance is remembered because it lets the first amount's sign be worked out.
    if (BALANCE_LINE.test(line.cells.map((c) => c.text).join(' '))) {
      const amount = [...line.cells].reverse().find((c) => isAmountCell(c.text))
      if (amount && raws.length === 0 && openingBalance === null) openingBalance = parseSignedAmount(amount.text)
      continue
    }

    if (!first) {
      // A wrapped description: text under the previous transaction's description, no amounts.
      const previous = raws[raws.length - 1]
      const sameBlock = lastLine && lastLine.page === line.page && lastLine.y - line.y <= lastLine.height * 2.2
      const text = line.cells.map((c) => c.text).join(' ')
      if (
        previous &&
        sameBlock &&
        !FOOTER.test(text) &&
        !line.cells.some((c) => isAmountCell(c.text)) &&
        line.cells[0].x0 >= previous.descX - 3
      ) {
        previous.row.description = `${previous.row.description} ${text}`.trim()
        lastLine = line
      }
      continue
    }

    const cells = [...line.cells]
    if (first.rest) cells[0] = { ...cells[0], text: first.rest, x0: cells[0].x0 + 1 }
    else cells.shift()

    const amounts: Cell[] = []
    while (cells.length > 0 && isAmountCell(cells[cells.length - 1].text)) amounts.unshift(cells.pop()!)
    if (amounts.length === 0) continue

    const row: RawRow = { date: first.raw, description: cells.map((c) => c.text).join(' ').trim() }
    if (header) {
      for (const cell of amounts) {
        const kind = nearestColumn(cell, header.columns).kind
        if (row[kind] === undefined) row[kind] = cell.text
      }
    } else if (amounts.length === 1) {
      row.amount = amounts[0].text
    } else {
      row.amount = amounts[amounts.length - 2].text
      row.balance = amounts[amounts.length - 1].text
    }
    raws.push({ row, leading: first, descX: cells[0]?.x0 ?? line.cells[0].x1 })
    lastLine = line
  }

  if (raws.length === 0) return []

  const dates = resolveDates(raws.map((r) => r.leading), year)
  const rows = raws.map((r) => r.row)

  if (hasSplit) {
    const withBalance = rows.some((r) => r.balance !== undefined)
    return [
      ['Date', 'Description', 'Money out', 'Money in', ...(withBalance ? ['Balance'] : [])],
      ...rows.map((r, i) => [
        dates[i],
        r.description,
        r.debit ?? '',
        r.credit ?? '',
        ...(withBalance ? [r.balance ?? ''] : []),
      ]),
    ]
  }

  const signed = signAmounts(rows, openingBalance)
  const withBalance = rows.some((r) => r.balance !== undefined)
  return [
    ['Date', 'Description', 'Amount', ...(withBalance ? ['Balance'] : [])],
    ...rows.map((r, i) => [dates[i], r.description, signed[i], ...(withBalance ? [r.balance ?? ''] : [])]),
  ]
}

/** Turns the dates found into YYYY-MM-DD, filling in missing years and a year change (Dec -> Jan). */
function resolveDates(leading: LeadingDate[], year: number): string[] {
  const full = leading.filter((l) => !l.partial).map((l) => l.raw)
  const order: DateOrder = detectDateOrder(leading.filter((l) => l.partial).map((l) => l.raw).concat(full))

  const parts = leading.map((l) => {
    if (!l.partial) return null
    const named = l.raw.match(/^(\d{1,2})[\s-]+([A-Za-z]+)/)
    if (named) return { day: Number(named[1]), month: monthIndex(named[2]) }
    const [a, b] = l.raw.split(/[-/.]/).map(Number)
    return order === 'dmy' ? { day: a, month: b } : { day: b, month: a }
  })

  // If the months jump from late in the year back to early (Dec -> Jan), the earlier rows
  // belong to the previous year.
  const partialMonths = parts.flatMap((p) => (p ? [p.month] : []))
  let rolloverAt = -1
  for (let i = 1; i < partialMonths.length; i++) {
    if (partialMonths[i - 1] >= 10 && partialMonths[i] <= 3) rolloverAt = i
  }

  let seenPartial = 0
  return leading.map((l, i) => {
    const p = parts[i]
    if (!l.partial || !p) return parseDateLoose(l.raw, order) ?? l.raw
    const y = rolloverAt >= 0 && seenPartial++ < rolloverAt ? year - 1 : year
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${y}-${pad(p.month)}-${pad(p.day)}`
  })
}

/**
 * Gives each single-column amount a sign. An explicit sign (-, brackets, DR) wins; otherwise the
 * balance column decides: if the balance went up the amount is money in, if it went down it's out.
 * When nothing says, the amount is treated as money out.
 */
function signAmounts(rows: RawRow[], openingBalance: number | null): string[] {
  let previous = openingBalance
  return rows.map((r) => {
    const text = r.amount ?? ''
    const cents = parseSignedAmount(text)
    const balance = r.balance !== undefined ? parseSignedAmount(r.balance) : null
    let result = text

    if (cents !== null) {
      const explicit = cents < 0 || /\bDR\b|-\s*$/i.test(text) || /\bCR\b/i.test(text) || /^\s*\+/.test(text)
      if (!explicit) {
        let negative = true
        if (previous !== null && balance !== null && Math.abs(balance - previous) === Math.abs(cents)) {
          negative = balance < previous
        }
        result = negative ? `-${text}` : text
      }
    }
    if (balance !== null) previous = balance
    return result
  })
}
