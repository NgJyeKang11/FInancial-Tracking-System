import { formatCents } from '../lib/money'
import type { BudgetStatus } from '../lib/stats'

interface Props {
  statuses: BudgetStatus[]
  currency: string
}

/** A banner naming the categories that are over, or close to, their monthly budget. */
export function BudgetAlerts({ statuses, currency }: Props) {
  const over = statuses.filter((s) => s.state === 'over')
  const near = statuses.filter((s) => s.state === 'near')
  if (over.length === 0 && near.length === 0) return null

  return (
    <div className="alerts" role="status">
      {over.length > 0 && (
        <p className="alert over">
          <strong>Over budget:</strong>{' '}
          {over.map((s) => `${s.category} by ${formatCents(-s.remainingCents, currency)}`).join(', ')}
        </p>
      )}
      {near.length > 0 && (
        <p className="alert near">
          <strong>Close to the limit:</strong>{' '}
          {near.map((s) => `${s.category} (${formatCents(s.remainingCents, currency)} left)`).join(', ')}
        </p>
      )}
    </div>
  )
}
