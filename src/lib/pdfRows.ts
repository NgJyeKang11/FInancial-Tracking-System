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

interface Header {
  /** The header's first line (a header can be printed over two lines). */
  start: number
  /** Its last line; transactions come after this. */
  end: number
  columns: HeaderColumn[]
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
 * pdf.js sometimes hands back a whole row as one piece of text, with the columns separated only
 * by runs of spaces. Splitting it at those runs lets the columns be told apart like any other row.
 */
function splitSpacedItems(items: PdfTextItem[]): PdfTextItem[] {
  return items.flatMap((item) => {
    if (!/\S\s{2,}\S/.test(item.str)) return [item]
    const charWidth = item.width / item.str.length
    return [...item.str.matchAll(/\S+(?: \S+)*/g)].map((m) => ({
      ...item,
      str: m[0],
      x: item.x + m.index * charWidth,
      width: m[0].length * charWidth,
    }))
  })
}

/** Joins a lone "-", "+", "CR" or "DR" onto the amount just before it ("12.00", "CR" -> "12.00 CR"). */
function attachSignMarkers(cells: Cell[]): Cell[] {
  const out: Cell[] = []
  for (const cell of cells) {
    const last = out[out.length - 1]
    if (last && /^(?:CR|DR|-|\+)$/i.test(cell.text) && isAmountCell(last.text)) {
      out[out.length - 1] = { ...last, text: `${last.text} ${cell.text}` }
    } else {
      out.push(cell)
    }
  }
  return out
}

/**
 * Groups loose text items into lines (top to bottom, page by page) and each line into cells
 * (left to right). Words that sit close together stay in one cell; a wider gap starts a new one,
 * which is how table columns are told apart.
 */
export function groupLines(items: PdfTextItem[]): Line[] {
  const all = splitSpacedItems(items)
  const pages = [...new Set(all.map((i) => i.page))].sort((a, b) => a - b)
  const lines: Line[] = []

  for (const page of pages) {
    const onPage = all.filter((i) => i.page === page && i.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x)
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
      lines.push({ page, y: group[0].y, height: Math.max(...group.map((g) => g.height)), cells: attachSignMarkers(cells) })
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

const MONTH_WORDS = new Set([
  ...MONTHS,
  'sept',
  'january',
  'february',
  'march',
  'april',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
])

/** True only for an actual month name or abbreviation, so "Marina" or "Decimal" don't count. */
const isMonthWord = (word: string) => MONTH_WORDS.has(word.toLowerCase())

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
  /^[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}(?!\d)/,
]

/** Splits a date off the start of a cell ("01/10/2026 STARBUCKS" -> date + "STARBUCKS"). */
export function splitLeadingDate(text: string): LeadingDate | null {
  const s = text.trim()
  const found = (raw: string, partial: boolean): LeadingDate => ({ raw, rest: s.slice(raw.length).trim(), partial })

  for (const pattern of FULL_DATES) {
    const m = s.match(pattern)
    if (!m) continue
    const word = m[0].match(/[A-Za-z]+/)
    if (word && !isMonthWord(word[0])) continue
    if ((parseDateLoose(m[0], 'dmy') ?? parseDateLoose(m[0], 'mdy')) !== null) return found(m[0], false)
  }
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})(?![\d/.-])/)
  if (m && Number(m[1]) <= 31 && Number(m[2]) <= 31) return found(m[0], true)
  // Day then month name, with or without a gap: "09 Dec", "09-Dec", "09Dec".
  m = s.match(/^(\d{1,2})\s*-?\s*([A-Za-z]{3,9})\.?(?![A-Za-z])/)
  if (m && isMonthWord(m[2]) && Number(m[1]) <= 31) return found(m[0], true)
  // Month name then day: "Dec 09".
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?![\d.,:/])/)
  if (m && isMonthWord(m[1]) && Number(m[2]) <= 31) return found(m[0], true)
  return null
}

const kindOfHeader = (text: string): ColumnKind | 'date' | 'description' | null => {
  const t = text.toLowerCase()
  const out = /debit|withdraw|money out|paid out|\bout\b|\bdr\b/.test(t)
  const inn = /credit|kredit|deposit|money in|paid in|\bin\b|\bcr\b/.test(t)
  // One column for both ("Debit/Credit", "DR/CR") is a signed amount column.
  if (out && inn) return 'amount'
  if (out) return 'debit'
  if (inn) return 'credit'
  if (/balance|baki/.test(t)) return 'balance'
  if (/amount|amt|jumlah/.test(t)) return 'amount'
  if (/date|tarikh/.test(t)) return 'date'
  if (/desc|detail|particular|narrat|transaction|payee|keterangan/.test(t)) return 'description'
  return null
}

const isMoneyKind = (kind: ReturnType<typeof kindOfHeader>): kind is ColumnKind =>
  kind === 'debit' || kind === 'credit' || kind === 'amount' || kind === 'balance'

/**
 * The money columns of a table header line, or null if the line isn't one. It must have a Date
 * column plus a money column (or both Debit and Credit), which keeps it from latching onto other
 * boxes on the page such as an account summary with a "Balance" heading.
 */
function headerColumns(line: Line): HeaderColumn[] | null {
  if (line.cells.some((c) => isAmountCell(c.text)) || splitLeadingDate(line.cells[0].text)) return null
  const kinds = line.cells.map((c) => kindOfHeader(c.text))
  const hasDate = kinds.includes('date')
  const hasBothSides = kinds.includes('debit') && kinds.includes('credit')
  if (!((hasDate && kinds.some(isMoneyKind)) || hasBothSides)) return null
  return line.cells.flatMap((c, i) => {
    const kind = kinds[i]
    return isMoneyKind(kind) ? [{ ...c, kind }] : []
  })
}

/** Stacks two header lines into one, joining words that sit above each other ("Transaction" / "Date"). */
function stackLines(top: Line, bottom: Line): Line {
  const cells = top.cells.map((c) => ({ ...c }))
  for (const cell of bottom.cells) {
    const above = cells.find((c) => cell.x0 < c.x1 && cell.x1 > c.x0)
    if (above) {
      above.text = `${above.text} ${cell.text}`
      above.x0 = Math.min(above.x0, cell.x0)
      above.x1 = Math.max(above.x1, cell.x1)
    } else {
      cells.push({ ...cell })
    }
  }
  return { ...top, cells: cells.sort((a, b) => a.x0 - b.x0) }
}

/** Every transaction table header in the document; many statements repeat it on each page. */
function findHeaders(lines: Line[]): Header[] {
  const headers: Header[] = []
  for (let i = 0; i < lines.length; i++) {
    const next = lines[i + 1]
    const close =
      next &&
      next.page === lines[i].page &&
      lines[i].y - next.y <= lines[i].height * 1.8 &&
      !splitLeadingDate(next.cells[0].text)
    // Try the line together with the one under it first: headings are often split over two
    // lines ("Transaction" / "Date") or printed twice in two languages.
    const stacked = close ? headerColumns(stackLines(lines[i], next)) : null
    if (stacked) {
      headers.push({ start: i, end: i + 1, columns: stacked })
      i++
      continue
    }
    const single = headerColumns(lines[i])
    if (single) headers.push({ start: i, end: i, columns: single })
  }
  return headers
}

/** How far an amount is from a header column: by centre, left edge or right edge. */
function columnDistance(cell: Cell, column: Cell): number {
  return Math.min(
    Math.abs((cell.x0 + cell.x1) / 2 - (column.x0 + column.x1) / 2),
    Math.abs(cell.x0 - column.x0),
    Math.abs(cell.x1 - column.x1),
  )
}

/** The header column an amount sits under. */
function nearestColumn(cell: Cell, columns: HeaderColumn[]): HeaderColumn {
  return columns.reduce((best, c) => (columnDistance(cell, c) < columnDistance(cell, best) ? c : best))
}

/** True if every amount lines up with one of the header's money columns. */
function underColumns(amounts: Cell[], header: Header): boolean {
  return amounts.every((a) => columnDistance(a, nearestColumn(a, header.columns)) <= 30)
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
 * Cleans up a description gathered from several lines: drops long reference numbers (like
 * "QR20251209077761"), collapses runs of commas left behind, and trims stray punctuation.
 */
export function tidyDescription(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9]*\d{9,}[A-Za-z0-9]*/g, '')
    .replace(/,(\s*,)+/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/^[\s,]+|[\s,]+$/g, '')
}

interface Period {
  startYear: number
  startMonth: number
  endYear: number
  endMonth: number
}

const PERIOD_DATE = String.raw`\d{4}-\d{2}-\d{2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\.?,?\s+\d{4}`
const PERIOD = new RegExp(`(${PERIOD_DATE})\\s*(?:-|–|—|to|until|hingga)\\s*(${PERIOD_DATE})`, 'i')
const STATEMENT_DATE = new RegExp(`(?:statement date|tarikh penyata|statement as at)\\s*:?\\s*(${PERIOD_DATE})`, 'i')

/**
 * Looks for the statement's date range ("09/12/2025 - 08/01/2026", "1 Oct 2026 to 31 Oct 2026").
 * Statements that print dates without a year rely on it to say which year each transaction is in.
 * Without a range, a "Statement date" works too: transactions are in the year up to that date.
 */
function findStatementPeriod(lines: Line[]): Period | null {
  const texts = lines.map((line) => line.cells.map((c) => c.text).join(' '))
  for (const text of texts) {
    const m = text.match(PERIOD)
    if (!m) continue
    const order = detectDateOrder([m[1], m[2]])
    const start = parseDateLoose(m[1], order)
    const end = parseDateLoose(m[2], order)
    if (!start || !end || start > end) continue
    const [startYear, startMonth] = start.split('-').map(Number)
    const [endYear, endMonth] = end.split('-').map(Number)
    // A statement covers up to a year or so; anything longer isn't a statement period.
    if ((endYear - startYear) * 12 + endMonth - startMonth > 13) continue
    return { startYear, startMonth, endYear, endMonth }
  }
  for (const text of texts) {
    const m = text.match(STATEMENT_DATE)
    const end = m && parseDateLoose(m[1], detectDateOrder([m[1]]))
    if (!end) continue
    const [endYear, endMonth] = end.split('-').map(Number)
    const start = endYear * 12 + endMonth - 1 - 11
    return { startYear: Math.floor(start / 12), startMonth: (start % 12) + 1, endYear, endMonth }
  }
  return null
}

/**
 * Rebuilds a statement's transaction table from the text of a PDF. The result looks like a CSV
 * (a header row plus one row per transaction) so it can use the same import preview. Returns an
 * empty list when no transactions could be found.
 *
 * It looks for lines that start with a date and end with money amounts. Also handled: the
 * amounts landing on a later line than the date, several transactions listed under one date,
 * a transaction date followed by a posting date (card statements), and a row number before the
 * date. If the statement has separate money-out / money-in columns they are kept apart; if it has
 * a single amount column, the sign comes from the amount itself (-, brackets, DR/CR) or from how
 * the balance changed.
 */
export function parseStatementRows(items: PdfTextItem[]): string[][] {
  const lines = groupLines(items)
  const headers = findHeaders(lines)
  const headerAt = new Map(headers.map((h) => [h.start, h]))
  const year = statementYear(lines)

  const raws: { row: RawRow; leading: LeadingDate; descX: number }[] = []
  let openingBalance: number | null = null
  let lastLine: Line | null = null
  /** The header for the lines being read, and the last one that actually produced a row. */
  let current: Header | null = null
  let used: Header | null = null
  /** A date line whose amounts haven't appeared yet. */
  let pending: { leading: LeadingDate; description: string; descX: number } | null = null
  let page = 0

  const addRow = (leading: LeadingDate, description: string, amounts: Cell[], descX: number) => {
    const row: RawRow = { date: leading.raw, description }
    if (current) {
      for (const cell of amounts) {
        const kind = nearestColumn(cell, current.columns).kind
        if (row[kind] === undefined) row[kind] = cell.text
      }
      used = current
    } else if (amounts.length === 1) {
      row.amount = amounts[0].text
    } else {
      row.amount = amounts[amounts.length - 2].text
      row.balance = amounts[amounts.length - 1].text
    }
    raws.push({ row, leading, descX })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.page !== page) {
      // A page without its own header keeps using the table header from earlier pages.
      page = line.page
      current = used ?? current
      lastLine = null
      pending = null
    }

    const header = headerAt.get(i)
    if (header) {
      current = header
      lastLine = null
      pending = null
      i = header.end
      continue
    }
    if (headers.length > 0 && !current) continue

    const text = line.cells.map((c) => c.text).join(' ')

    // "Balance b/f", "Closing balance" and similar lines are not transactions. The opening
    // balance is remembered because it lets the first amount's sign be worked out.
    if (BALANCE_LINE.test(text)) {
      const amount = [...line.cells].reverse().find((c) => isAmountCell(c.text))
      if (amount && raws.length === 0 && openingBalance === null) openingBalance = parseSignedAmount(amount.text)
      pending = null
      continue
    }

    const cells = [...line.cells]
    // A row number in its own column before the date.
    if (cells.length > 1 && /^\d{1,3}$/.test(cells[0].text) && splitLeadingDate(cells[1].text)) cells.shift()

    const first = splitLeadingDate(cells[0].text)
    if (first) {
      if (first.rest) cells[0] = { ...cells[0], text: first.rest, x0: cells[0].x0 + 1 }
      else cells.shift()
      // Card statements often show the transaction date then the posting date: keep the first.
      const second = cells.length > 0 ? splitLeadingDate(cells[0].text) : null
      if (second) {
        if (second.rest) cells[0] = { ...cells[0], text: second.rest }
        else cells.shift()
      }
    }

    const amounts: Cell[] = []
    while (cells.length > 0 && isAmountCell(cells[cells.length - 1].text)) amounts.unshift(cells.pop()!)
    const description = cells.map((c) => c.text).join(' ').trim()
    const descX = cells[0]?.x0 ?? line.cells[0].x1

    if (first) {
      if (amounts.length > 0) {
        addRow(first, description, amounts, descX)
        pending = null
      } else {
        pending = { leading: first, description, descX }
      }
      lastLine = line
      continue
    }

    // A line without a date: more of the transaction above it, or nothing to do with the table.
    const sameBlock = lastLine && lastLine.page === line.page && lastLine.y - line.y <= lastLine.height * 2.2
    if (!sameBlock || FOOTER.test(text)) {
      pending = null
      continue
    }
    const midAmount = amounts.length === 0 && line.cells.some((c) => isAmountCell(c.text))
    if (midAmount) continue

    if (pending) {
      if (amounts.length === 0) {
        pending.description = `${pending.description} ${text}`.trim()
        lastLine = line
      } else if (!current || underColumns(amounts, current)) {
        const x = pending.description ? pending.descX : descX
        addRow(pending.leading, `${pending.description} ${description}`.trim(), amounts, x)
        pending = null
        lastLine = line
      }
      continue
    }

    const previous = raws[raws.length - 1]
    if (!previous || line.cells[0].x0 < previous.descX - 3) continue
    if (amounts.length === 0) {
      // A wrapped description.
      previous.row.description = `${previous.row.description} ${text}`.trim()
      lastLine = line
    } else if (current && description && underColumns(amounts, current)) {
      // Another transaction listed under the same date.
      addRow(previous.leading, description, amounts, descX)
      lastLine = line
    }
  }

  if (raws.length === 0) return []

  const dates = resolveDates(
    raws.map((r) => r.leading),
    year,
    findStatementPeriod(lines),
  )
  const rows = raws.map((r) => ({ ...r.row, description: tidyDescription(r.row.description) }))
  const signed = signAmounts(rows, openingBalance)
  const withBalance = rows.some((r) => r.balance !== undefined)
  const balance = (r: RawRow) => (withBalance ? [r.balance ?? ''] : [])

  if (rows.some((r) => r.debit !== undefined || r.credit !== undefined)) {
    return [
      ['Date', 'Description', 'Money out', 'Money in', ...(withBalance ? ['Balance'] : [])],
      ...rows.map((r, i) => {
        // A row read from a single amount column goes on the side its sign says.
        const out = r.debit ?? (r.amount !== undefined && (parseSignedAmount(signed[i]) ?? 0) < 0 ? r.amount : '')
        const inn = r.credit ?? (r.amount !== undefined && !out ? r.amount : '')
        return [dates[i], r.description, out, inn, ...balance(r)]
      }),
    ]
  }

  return [
    ['Date', 'Description', 'Amount', ...(withBalance ? ['Balance'] : [])],
    ...rows.map((r, i) => [dates[i], r.description, signed[i], ...balance(r)]),
  ]
}

/**
 * Turns the dates found into YYYY-MM-DD, filling in missing years. The statement period decides
 * the year when there is one (including a period that crosses New Year); otherwise the most
 * common year in the document is used, with earlier Dec rows moved back a year if the dates
 * jump from Dec to Jan.
 */
function resolveDates(leading: LeadingDate[], year: number, period: Period | null): string[] {
  const full = leading.filter((l) => !l.partial).map((l) => l.raw)
  const order: DateOrder = detectDateOrder(leading.filter((l) => l.partial).map((l) => l.raw).concat(full))

  const parts = leading.map((l) => {
    if (!l.partial) return null
    const dayFirst = l.raw.match(/^(\d{1,2})\s*-?\s*([A-Za-z]+)/)
    if (dayFirst) return { day: Number(dayFirst[1]), month: monthIndex(dayFirst[2]) }
    const monthFirst = l.raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2})/)
    if (monthFirst) return { day: Number(monthFirst[2]), month: monthIndex(monthFirst[1]) }
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
    let y = rolloverAt >= 0 && seenPartial++ < rolloverAt ? year - 1 : year
    if (period) {
      y = period.startYear === period.endYear || p.month < period.startMonth ? period.endYear : period.startYear
    }
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
