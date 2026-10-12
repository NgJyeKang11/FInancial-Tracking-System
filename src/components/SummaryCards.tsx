import { formatCents } from '../lib/money'
import { daysInMonth, monthOf, todayISO } from '../lib/dates'
import { totalCents, totalsByCategory } from '../lib/stats'
import type { Transaction } from '../types'

interface Props {
  /** All transactions, used for "today". */
  all: Transaction[]
  /** Transactions in the selected month. */
  monthTransactions: Transaction[]
  month: string
  currency: string
}

export function SummaryCards({ all, monthTransactions, month, currency }: Props) {
  const today = todayISO()
  const todayTotal = totalCents(all.filter((t) => t.date === today))
  const monthTotal = totalCents(monthTransactions)

  // For the current month, average over the days elapsed so far; otherwise the whole month.
  const daysCounted = monthOf(today) === month ? Number(today.slice(8, 10)) : daysInMonth(month)
  const dailyAverage = Math.round(monthTotal / daysCounted)
  const top = totalsByCategory(monthTransactions)[0]

  const cards = [
    { label: 'Spent today', value: formatCents(todayTotal, currency) },
    { label: 'Spent this month', value: formatCents(monthTotal, currency) },
    { label: 'Daily average', value: formatCents(dailyAverage, currency) },
    { label: 'Top category', value: top ? top.category : '—' },
  ]

  return (
    <section className="summary" aria-label="Summary">
      {cards.map((c) => (
        <div key={c.label} className="card stat">
          <span className="stat-label">{c.label}</span>
          <span className="stat-value">{c.value}</span>
        </div>
      ))}
    </section>
  )
}
