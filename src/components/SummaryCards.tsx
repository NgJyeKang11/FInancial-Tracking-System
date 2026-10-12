import { formatCents } from '../lib/money'
import { daysInMonth, monthOf, todayISO } from '../lib/dates'
import { balanceAsOf, expensesOnly, incomeOnly, netCents, totalCents, totalsByCategory } from '../lib/stats'
import type { Transaction } from '../types'

export type StatKey = 'balance' | 'income' | 'spent' | 'net' | 'average' | 'top' | 'savings'

interface Props {
  /** All transactions, used for the running balance. */
  all: Transaction[]
  /** Transactions in the selected month. */
  monthTransactions: Transaction[]
  month: string
  currency: string
  /** Which numbers to show, in this order. */
  show: StatKey[]
}

type Tone = 'positive' | 'negative'

/** Colours a signed amount: green when above zero, red when below, plain at zero. */
const toneOf = (cents: number): Tone | undefined => (cents > 0 ? 'positive' : cents < 0 ? 'negative' : undefined)

export function SummaryCards({ all, monthTransactions, month, currency, show }: Props) {
  const today = todayISO()
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

  const cards: Record<StatKey, { label: string; value: string; tone?: Tone }> = {
    balance: { label: 'Balance', value: formatCents(balance, currency), tone: toneOf(balance) },
    income: { label: 'Income', value: formatCents(income, currency) },
    spent: { label: 'Spent', value: formatCents(spent, currency) },
    net: { label: 'Net', value: formatCents(net, currency), tone: toneOf(net) },
    average: { label: 'Daily average', value: formatCents(dailyAverage, currency) },
    top: { label: 'Top category', value: top ? top.category : '—' },
    savings: { label: 'Savings rate', value: savingsRate, tone: income > 0 ? toneOf(net) : undefined },
  }

  return (
    <section className="summary" aria-label="Summary">
      {show.map((key) => (
        <div key={key} className="card stat">
          <span className="stat-label">{cards[key].label}</span>
          <span className={cards[key].tone ? `stat-value ${cards[key].tone}` : 'stat-value'}>{cards[key].value}</span>
        </div>
      ))}
    </section>
  )
}
