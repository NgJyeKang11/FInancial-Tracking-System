import { formatDayHeading } from '../lib/dates'
import { formatCents } from '../lib/money'
import type { Transaction } from '../types'

interface Props {
  /** Already sorted newest first. */
  transactions: Transaction[]
  currency: string
  onSeeAll: () => void
}

const SHOWN = 5

/** The last few transactions of the month, as a short read-only list. */
export function RecentTransactions({ transactions, currency, onSeeAll }: Props) {
  return (
    <section className="card recent" aria-labelledby="recent-title">
      <header className="card-head">
        <h2 id="recent-title">Recent</h2>
        {transactions.length > 0 && (
          <button type="button" className="link" onClick={onSeeAll}>
            See all
          </button>
        )}
      </header>
      {transactions.length === 0 ? (
        <p className="muted">Nothing this month yet.</p>
      ) : (
        <ul>
          {transactions.slice(0, SHOWN).map((t) => (
            <li key={t.id}>
              <span className="recent-main">
                <span className="recent-title">{t.note || t.category}</span>
                <span className="muted">
                  {formatDayHeading(t.date)}
                  {t.note && ` · ${t.category}`}
                </span>
              </span>
              <span className={t.type === 'income' ? 'amount positive' : 'amount'}>
                {t.type === 'income' ? '+' : '−'}
                {formatCents(t.amountCents, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
