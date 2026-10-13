import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { formatCents } from '../lib/money'
import { formatDayHeading } from '../lib/dates'
import { dailyTotals, pieSlices, totalsByCategory } from '../lib/stats'
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

  const slices = pieSlices(totalsByCategory(monthTransactions))
  const spentTotal = slices.reduce((sum, s) => sum + s.cents, 0)
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

      {slices.length > 0 && (
        <div className="card chart">
          <h2>Spending by category</h2>
          <div className="pie-layout">
            <div className="pie">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="cents"
                    nameKey="category"
                    innerRadius="58%"
                    outerRadius="100%"
                    startAngle={90}
                    endAngle={-270}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {slices.map((s, i) => (
                      <Cell key={s.category} fill={`var(--pie-${i + 1})`} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={(props) => (
                      <ChartTooltip
                        {...props}
                        label={props.payload?.[0]?.name}
                        currency={currency}
                        labelFor={String}
                      />
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* The legend doubles as the table: every slice's name, amount and share in text. */}
            <ul className="pie-legend">
              {slices.map((s, i) => (
                <li key={s.category}>
                  <span className="swatch" style={{ background: `var(--pie-${i + 1})` }} aria-hidden="true" />
                  <span className="pie-name">{s.category}</span>
                  <span className="pie-amount">{formatCents(s.cents, currency)}</span>
                  <span className="pie-share">{Math.round((s.cents / spentTotal) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
