import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { formatCents } from '../lib/money'
import { formatDayHeading } from '../lib/dates'
import { dailyTotals, totalsByCategory } from '../lib/stats'
import type { Transaction } from '../types'

interface Props {
  monthTransactions: Transaction[]
  month: string
  currency: string
}

function ChartTooltip({ active, payload, label, currency, labelFor }: TooltipContentProps & {
  currency: string
  labelFor: (label: string | number) => string
}) {
  if (!active || !payload?.length || label === undefined) return null
  return (
    <div className="chart-tooltip">
      <span className="muted">{labelFor(label)}</span>
      <strong>{formatCents(Number(payload[0].value), currency)}</strong>
    </div>
  )
}

export function SpendingCharts({ monthTransactions, month, currency }: Props) {
  if (monthTransactions.length === 0) return null

  const byCategory = totalsByCategory(monthTransactions)
  const byDay = dailyTotals(monthTransactions, month)
  const compact = (cents: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact' }).format(cents / 100)

  return (
    <section className="charts">
      <div className="card chart">
        <h2>Spending per day</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byDay} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={56} />
            <Tooltip
              cursor={{ className: 'chart-cursor' }}
              content={(props) => (
                <ChartTooltip
                  {...props}
                  currency={currency}
                  labelFor={(day) => formatDayHeading(`${month}-${String(day).padStart(2, '0')}`)}
                />
              )}
            />
            <Bar dataKey="cents" name="Spent" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card chart">
        <h2>Spending by category</h2>
        <ResponsiveContainer width="100%" height={Math.max(120, byCategory.length * 36 + 16)}>
          <BarChart data={byCategory} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} width={120} />
            <Tooltip
              cursor={{ className: 'chart-cursor' }}
              content={(props) => <ChartTooltip {...props} currency={currency} labelFor={String} />}
            />
            <Bar dataKey="cents" name="Spent" fill="currentColor" radius={[0, 4, 4, 0]} barSize={20}>
              <LabelList
                dataKey="cents"
                position="right"
                className="bar-label"
                formatter={(v) => formatCents(Number(v), currency)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
