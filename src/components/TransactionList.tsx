import { formatCents } from '../lib/money'
import { formatDayHeading } from '../lib/dates'
import { groupByDay, totalCents } from '../lib/stats'
import type { Transaction } from '../types'

interface Props {
  transactions: Transaction[]
  currency: string
  editingId: string | null
  onEdit: (t: Transaction) => void
  onDelete: (t: Transaction) => void
}

export function TransactionList({ transactions, currency, editingId, onEdit, onDelete }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="card empty">
        <p>No transactions here yet.</p>
        <p className="muted">Add one with the form to start tracking your spending.</p>
      </div>
    )
  }

  return (
    <div className="card list">
      {groupByDay(transactions).map(({ date, items }) => (
        <section key={date} className="day">
          <header className="day-header">
            <h3>{formatDayHeading(date)}</h3>
            <span>{formatCents(totalCents(items), currency)}</span>
          </header>
          <ul>
            {items.map((t) => (
              <li key={t.id} className={t.id === editingId ? 'row editing' : 'row'}>
                <div className="row-main">
                  <span className="chip">{t.category}</span>
                  {t.note && <span className="note">{t.note}</span>}
                </div>
                <span className="amount">{formatCents(t.amountCents, currency)}</span>
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
      ))}
    </div>
  )
}
