import { addMonths, formatMonthName } from '../lib/dates'
import { formatCents } from '../lib/money'
import type { CategoryChange } from '../lib/stats'

interface Props {
  rows: CategoryChange[]
  month: string
  currency: string
}

/** "+15%", "−20%", or "New" when nothing was spent last month. */
function percentChange(row: CategoryChange): string {
  if (row.lastCents === 0) return 'New'
  const percent = Math.round((row.changeCents / row.lastCents) * 100)
  if (percent === 0) return 'Same'
  return `${percent > 0 ? '+' : '−'}${Math.abs(percent)}%`
}

/** Spending per category this month next to last month, with the change. */
export function MonthComparison({ rows, month, currency }: Props) {
  const lastMonth = formatMonthName(addMonths(month, -1))
  const thisTotal = rows.reduce((sum, r) => sum + r.thisCents, 0)
  const lastTotal = rows.reduce((sum, r) => sum + r.lastCents, 0)
  const total: CategoryChange = {
    category: 'Total',
    thisCents: thisTotal,
    lastCents: lastTotal,
    changeCents: thisTotal - lastTotal,
  }

  const cells = (r: CategoryChange) => (
    <>
      <td className="num">{formatCents(r.thisCents, currency)}</td>
      <td className="num muted">{formatCents(r.lastCents, currency)}</td>
      <td className={`num change ${r.changeCents > 0 ? 'up' : r.changeCents < 0 ? 'down' : ''}`}>
        {r.changeCents === 0 ? '—' : `${r.changeCents > 0 ? '+' : '−'}${formatCents(Math.abs(r.changeCents), currency)}`}
        <span className="muted"> {percentChange(r)}</span>
      </td>
    </>
  )

  return (
    <section className="card comparison" aria-labelledby="comparison-title">
      <h2 id="comparison-title">Compared with {lastMonth}</h2>
      {rows.length === 0 ? (
        <p className="muted">No spending in either month yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className="num">
                  This month
                </th>
                <th scope="col" className="num">
                  {lastMonth}
                </th>
                <th scope="col" className="num">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.category}>
                  <th scope="row">{r.category}</th>
                  {cells(r)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                {cells(total)}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="muted comparison-note">Spending only. Red means more was spent than last month.</p>
    </section>
  )
}
