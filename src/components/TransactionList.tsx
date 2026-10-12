import { formatCents } from '../lib/money'
import { formatDayHeading } from '../lib/dates'
import { groupByDay, netCents } from '../lib/stats'
import type { Transaction } from '../types'

interface Props {
  transactions: Transaction[]
  /** Running balance at the end of each day, keyed by date. */
  balances: Map<string, number>
  currency: string
  editingId: string | null
  onEdit: (t: Transaction) => void
  onDelete: (t: Transaction) => void
}

export function TransactionList({ transactions, balances, currency, editingId, onEdit, onDelete }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="card empty">
        <p>No transactions here yet.</p>
        <p className="muted">Add one with the form to start tracking your money.</p>
      </div>
    )
  }

  return (
    <div className="card list">
      {groupByDay(transactions).map(({ date, items }) => {
        const dayNet = netCents(items)
        const balance = balances.get(date)
        return (
          <section key={date} className="day">
            <header className="day-header">
              <h3>{formatDayHeading(date)}</h3>
              <span className="day-totals">
                <span>
                  {dayNet > 0 ? '+' : ''}
                  {formatCents(dayNet, currency)}
                </span>
                {balance !== undefined && (
                  <span className="muted">Balance {formatCents(balance, currency)}</span>
                )}
              </span>
            </header>
            <ul>
              {items.map((t) => (
                <li key={t.id} className={t.id === editingId ? 'row editing' : 'row'}>
                  <div className="row-main">
                    <span className={t.type === 'income' ? 'chip income' : 'chip'}>{t.category}</span>
                    {t.note && <span className="note">{t.note}</span>}
                  </div>
                  <span className={t.type === 'income' ? 'amount positive' : 'amount'}>
                    {t.type === 'income' ? '+' : '−'}
                    {formatCents(t.amountCents, currency)}
                  </span>
                  <div className="row-actions">
                    <button type="button" onClick={() => onEdit(t)} aria-label={`Edit ${t.category} ${t.note}`}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => onDelete(t)}
                      aria-label={`Delete ${t.category} ${t.note}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
