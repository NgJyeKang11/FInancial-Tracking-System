import { formatCents } from '../lib/money'
import { formatDayHeading } from '../lib/dates'
import { groupByDay, netCents } from '../lib/stats'
import type { Transaction } from '../types'

interface Props {
  transactions: Transaction[]
  /** Running balance at the end of each day, keyed by date. */
  balances: Map<string, number>
  currency: string
  onEdit: (t: Transaction) => void
  onDelete: (t: Transaction) => void
  /** When set, the list is in "select" mode: rows get tick boxes instead of Edit / Delete. */
  selected?: Set<string>
  onToggle?: (t: Transaction) => void
}

export function TransactionList({ transactions, balances, currency, onEdit, onDelete, selected, onToggle }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="card empty">
        <p>No transactions to show.</p>
        <p className="muted">Try another month or search, or use + Add to log one.</p>
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
                <li
                  key={t.id}
                  className={selected ? `row selectable${selected.has(t.id) ? ' is-selected' : ''}` : 'row'}
                >
                  {selected && (
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => onToggle?.(t)}
                      aria-label={`Select ${t.category} ${t.note} ${formatCents(t.amountCents, currency)}`}
                    />
                  )}
                  <div className="row-main">
                    <span className={t.type === 'income' ? 'chip income' : 'chip'}>{t.category}</span>
                    {t.note && <span className="note">{t.note}</span>}
                  </div>
                  <span className={t.type === 'income' ? 'amount positive' : 'amount'}>
                    {t.type === 'income' ? '+' : '−'}
                    {formatCents(t.amountCents, currency)}
                  </span>
                  {!selected && (
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
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
