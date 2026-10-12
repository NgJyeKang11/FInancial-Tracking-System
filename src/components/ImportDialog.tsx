import { useEffect, useMemo, useRef, useState } from 'react'
import {
  detectDateOrder,
  findDuplicates,
  guessColumns,
  looksLikeData,
  parseCsv,
  rowsToTransactions,
  type ColumnMap,
  type DateOrder,
} from '../lib/csv'
import { formatDayHeading } from '../lib/dates'
import { formatCents } from '../lib/money'
import { CATEGORIES_BY_TYPE, type Category, type Transaction, type TransactionInput } from '../types'

interface Props {
  existing: Transaction[]
  currency: string
  onImport: (inputs: TransactionInput[]) => void
  onClose: () => void
}

interface RowEdit {
  category?: Category
  /** Overrides the default: new rows are included, duplicates are skipped. */
  include?: boolean
}

const MAX_FILE_BYTES = 5 * 1024 * 1024

/** A pop-up for importing a bank statement from a CSV file, with a preview before anything is saved. */
export function ImportDialog({ existing, currency, onImport, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [table, setTable] = useState<string[][]>([])
  const [hasHeader, setHasHeader] = useState(true)
  const [columns, setColumns] = useState<ColumnMap>({ date: -1, description: -1, amount: -1, debit: -1, credit: -1 })
  const [dateOrder, setDateOrder] = useState<DateOrder>('dmy')
  const [flipSigns, setFlipSigns] = useState(false)
  const [edits, setEdits] = useState<Record<number, RowEdit>>({})

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const headers = hasHeader ? (table[0] ?? []) : (table[0] ?? []).map((_, i) => `Column ${i + 1}`)
  const dataRows = useMemo(() => (hasHeader ? table.slice(1) : table), [table, hasHeader])

  const parsed = useMemo(
    () => rowsToTransactions(dataRows, { columns, dateOrder, flipSigns }, hasHeader ? 2 : 1),
    [dataRows, columns, dateOrder, flipSigns, hasHeader],
  )

  const duplicates = useMemo(() => {
    const ok = parsed.flatMap((r) => (r.ok ? [r.input] : []))
    const flags = findDuplicates(ok, existing)
    let next = 0
    return parsed.map((r) => (r.ok ? flags[next++] : false))
  }, [parsed, existing])

  const isIncluded = (index: number) => edits[index]?.include ?? !duplicates[index]

  /** The category the user picked for a row, if it still fits the row's type; otherwise the guess. */
  const chosenCategory = (index: number, input: TransactionInput): Category => {
    const picked = edits[index]?.category
    return picked !== undefined && CATEGORIES_BY_TYPE[input.type].includes(picked) ? picked : input.category
  }

  const toImport = parsed.flatMap((r, i) => {
    if (!r.ok || !isIncluded(i)) return []
    return [{ ...r.input, category: chosenCategory(i, r.input) }]
  })
  const unreadable = parsed.filter((r) => !r.ok)
  const skippedDuplicates = duplicates.filter(Boolean).length
  const canImport = toImport.length > 0

  const loadFile = async (file: File) => {
    setError('')
    if (file.size > MAX_FILE_BYTES) {
      setError('That file is over 5 MB, which is too big for a statement. Try exporting a shorter date range.')
      return
    }
    const rows = parseCsv(await file.text())
    if (rows.length < 2) {
      setError("That doesn't look like a CSV statement. Export it from your bank as CSV, not PDF.")
      return
    }
    const header = !looksLikeData(rows[0])
    const body = header ? rows.slice(1) : rows
    const guess = guessColumns(header ? rows[0] : [])
    setFileName(file.name)
    setTable(rows)
    setHasHeader(header)
    setColumns(guess)
    setDateOrder(detectDateOrder(body.map((r) => r[guess.date] ?? '')))
    setFlipSigns(false)
    setEdits({})
  }

  const setColumn = (field: keyof ColumnMap, value: string) => {
    setColumns((prev) => ({ ...prev, [field]: Number(value) }))
    setEdits({})
  }

  const columnSelect = (field: keyof ColumnMap, label: string) => (
    <label className="inline">
      {label}
      <select value={columns[field]} onChange={(e) => setColumn(field, e.target.value)}>
        <option value={-1}>— none —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  )

  const setEdit = (index: number, edit: RowEdit) => setEdits((prev) => ({ ...prev, [index]: { ...prev[index], ...edit } }))

  return (
    <dialog ref={dialogRef} className="import-dialog" onClose={onClose} aria-labelledby="import-title">
      <header className="dialog-head">
        <h2 id="import-title">Import a bank statement</h2>
        <button type="button" onClick={() => dialogRef.current?.close()}>
          Close
        </button>
      </header>

      <p className="muted">
        Download your statement from online banking as a <strong>CSV</strong> file (PDF isn't supported) and choose it
        below. Nothing is uploaded anywhere: the file is read in your browser. You can review everything before it is
        added.{' '}
        <a href={`${import.meta.env.BASE_URL}sample-statement.csv`} download>
          Download a sample file
        </a>
        .
      </p>

      <label className="file-pick">
        <span>Statement file</span>
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void loadFile(file)
          }}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {table.length > 0 && (
        <>
          <h3>
            {fileName} · {dataRows.length} rows
          </h3>
          <div className="mapping">
            {columnSelect('date', 'Date column')}
            {columnSelect('description', 'Description column')}
            {columnSelect('amount', 'Amount column')}
            {columnSelect('debit', 'Money out column')}
            {columnSelect('credit', 'Money in column')}
            <label className="inline">
              Dates are
              <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                <option value="dmy">Day / Month / Year</option>
                <option value="mdy">Month / Day / Year</option>
              </select>
            </label>
          </div>
          <div className="mapping-checks">
            <label className="check">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => {
                  setHasHeader(e.target.checked)
                  setEdits({})
                }}
              />
              First row is a header
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={flipSigns}
                onChange={(e) => {
                  setFlipSigns(e.target.checked)
                  setEdits({})
                }}
              />
              Spending is shown as positive numbers (swap money in and out)
            </label>
          </div>
          <p className="muted">
            Use either the Amount column (negative = money out) or the Money out and Money in columns.
          </p>

          <div className="import-summary" role="status">
            <strong>{toImport.length}</strong> to import
            {skippedDuplicates > 0 && <> · {skippedDuplicates} look like duplicates and are unticked</>}
            {unreadable.length > 0 && <> · {unreadable.length} rows couldn't be read</>}
          </div>

          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th scope="col">Import</th>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Category</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((r, i) =>
                  r.ok ? (
                    <tr key={i} className={isIncluded(i) ? undefined : 'skipped'}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isIncluded(i)}
                          aria-label={`Import row ${r.line}`}
                          onChange={(e) => setEdit(i, { include: e.target.checked })}
                        />
                      </td>
                      <td>{formatDayHeading(r.input.date)}</td>
                      <td>
                        {r.input.note || <span className="muted">(no description)</span>}
                        {duplicates[i] && <span className="chip dup">Already added?</span>}
                      </td>
                      <td>
                        <select
                          aria-label={`Category for row ${r.line}`}
                          value={chosenCategory(i, r.input)}
                          onChange={(e) => setEdit(i, { category: e.target.value as Category })}
                        >
                          {CATEGORIES_BY_TYPE[r.input.type].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className={r.input.type === 'income' ? 'num positive' : 'num'}>
                        {r.input.type === 'income' ? '+' : '−'}
                        {formatCents(r.input.amountCents, currency)}
                      </td>
                    </tr>
                  ) : (
                    <tr key={i} className="unreadable">
                      <td />
                      <td colSpan={4}>
                        Row {r.line}: {r.reason}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <footer className="dialog-foot">
        <button type="button" onClick={() => dialogRef.current?.close()}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={!canImport}
          onClick={() => {
            onImport(toImport)
            dialogRef.current?.close()
          }}
        >
          {canImport ? `Import ${toImport.length} transactions` : 'Import'}
        </button>
      </footer>
    </dialog>
  )
}
