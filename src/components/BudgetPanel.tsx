import { useState, type FormEvent } from 'react'
import { amountError, centsToInput, formatCents, parseAmountToCents } from '../lib/money'
import { budgetState, spentByCategory } from '../lib/stats'
import { useCustomCategories } from '../hooks/useCategories'
import { budgetCategories, type Budgets, type Category, type Transaction } from '../types'

interface Props {
  /** Transactions in the selected month; only expenses count against budgets. */
  monthTransactions: Transaction[]
  budgets: Budgets
  currency: string
  onChange: (category: Category, cents: number | null) => void
}

interface RowProps {
  category: Category
  budgetCents: number | undefined
  spentCents: number
  currency: string
  onChange: (cents: number | null) => void
}

function BudgetRow({ category, budgetCents, spentCents, currency, onChange }: RowProps) {
  const [text, setText] = useState(budgetCents === undefined ? '' : centsToInput(budgetCents))
  const [error, setError] = useState('')

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed === '') {
      setError('')
      onChange(null)
      return
    }
    const cents = parseAmountToCents(trimmed)
    if (cents === null) {
      setError(amountError(trimmed) ?? '')
      return
    }
    setError('')
    setText(centsToInput(cents))
    onChange(cents)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    commit()
  }

  const ratio = budgetCents === undefined ? 0 : spentCents / budgetCents
  const state = budgetCents === undefined ? undefined : budgetState(spentCents, budgetCents)

  return (
    <li className="budget-row">
      <form className="budget-head" onSubmit={handleSubmit} noValidate>
        <label htmlFor={`budget-${category}`}>{category}</label>
        <input
          id={`budget-${category}`}
          inputMode="decimal"
          placeholder="No limit"
          value={text}
          aria-invalid={error !== ''}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
        />
      </form>
      {error && (
        <p className="error" role="alert">
          {error} Leave it empty for no limit.
        </p>
      )}
      {budgetCents !== undefined && (
        <>
          <div
            className={`meter ${state}`}
            role="progressbar"
            aria-label={`${category} budget used`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(ratio * 100))}
          >
            <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>
          <p className={`budget-note ${state}`}>
            {formatCents(spentCents, currency)} of {formatCents(budgetCents, currency)}
            {' · '}
            {state === 'over'
              ? `${formatCents(spentCents - budgetCents, currency)} over`
              : `${formatCents(budgetCents - spentCents, currency)} left`}
          </p>
        </>
      )}
    </li>
  )
}

export function BudgetPanel({ monthTransactions, budgets, currency, onChange }: Props) {
  const spent = spentByCategory(monthTransactions)
  const categories = budgetCategories(useCustomCategories())

  return (
    <section className="card budgets" aria-label="Monthly budgets">
      <h2>Monthly budgets</h2>
      <p className="muted">Set a limit per category. It applies to every month.</p>
      <ul>
        {categories.map((category) => (
          <BudgetRow
            key={category}
            category={category}
            budgetCents={budgets[category]}
            spentCents={spent.get(category) ?? 0}
            currency={currency}
            onChange={(cents) => onChange(category, cents)}
          />
        ))}
      </ul>
    </section>
  )
}
