import { formatCents } from '../lib/money'
import { daysInMonth, monthOf, todayISO } from '../lib/dates'
import { balanceAsOf, expensesOnly, incomeOnly, netCents, totalCents, totalsByCategory } from '../lib/stats'
import type { Transaction } from '../types'

interface Props {
  /** All transactions, used for "today" and the running balance. */
  all: Transaction[]
  /** Transactions in the selected month. */
  monthTransactions: Transaction[]
  month: string
  currency: string
}

type Tone = 'positive' | 'negative'

/** Colours a signed amount: green when above zero, red when below, plain at zero. */
const toneOf = (cents: number): Tone | undefined => (cents > 0 ? 'positive' : cents < 0 ? 'negative' : undefined)

export function SummaryCards({ all, monthTransactions, month, currency }: Props) {
  const today = todayISO()
  const todayTotal = totalCents(expensesOnly(all.filter((t) => t.date === today)))
  const spent = totalCents(expensesOnly(monthTransactions))
  const income = totalCents(incomeOnly(monthTransactions))
  const net = netCents(monthTransactions)

  // Balance as of the end of the selected month, or as of today for the current month.
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`
  const balance = balanceAsOf(all, monthOf(today) === month ? today : monthEnd)

  // For the current month, average over the days elapsed so far; otherwise the whole month.
  const daysCounted = monthOf(today) === month ? Number(today.slice(8, 10)) : daysInMonth(month)
  const dailyAverage = Math.round(spent / daysCounted)
  const top = totalsByCategory(monthTransactions)[0]
  const savingsRate = income > 0 ? `${Math.round((net / income) * 100)}%` : '—'

  const cards: { label: string; value: string; tone?: Tone }[] = [
    { label: 'Balance', value: formatCents(balance, currency), tone: toneOf(balance) },
    { label: 'Income this month', value: formatCents(income, currency) },
    { label: 'Spent this month', value: formatCents(spent, currency) },
    { label: 'Net this month', value: formatCents(net, currency), tone: toneOf(net) },
    { label: 'Spent today', value: formatCents(todayTotal, currency) },
    { label: 'Daily average', value: formatCents(dailyAverage, currency) },
    { label: 'Top category', value: top ? top.category : '—' },
    { label: 'Savings rate', value: savingsRate, tone: income > 0 ? toneOf(net) : undefined },
  ]

  return (
    <section className="summary" aria-label="Summary">
      {cards.map((c) => (
        <div key={c.label} className="card stat">
          <span className="stat-label">{c.label}</span>
          <span className={c.tone ? `stat-value ${c.tone}` : 'stat-value'}>{c.value}</span>
        </div>
      ))}
    </section>
  )
}
