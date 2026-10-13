import { useState, type FormEvent } from 'react'
import {
  categoriesFor,
  MAX_CATEGORY_LENGTH,
  type CustomCategory,
  type TransactionType,
} from '../types'

interface Props {
  custom: CustomCategory[]
  /** How many transactions use a category, to say what removing it does. */
  usage: (name: string) => number
  onAdd: (category: CustomCategory) => void
  onRemove: (category: CustomCategory) => void
}

/** Why a new category name can't be used, or null if it's fine. */
function nameProblem(name: string, custom: CustomCategory[]): string | null {
  if (name === '') return 'Enter a name.'
  if (name.length > MAX_CATEGORY_LENGTH) return `Keep it to ${MAX_CATEGORY_LENGTH} characters or fewer.`
  const taken = [...categoriesFor('expense', custom), ...categoriesFor('income', custom)]
  if (taken.some((c) => c.toLowerCase() === name.toLowerCase())) return 'There is already a category with that name.'
  return null
}

/** "Your categories": add spending or income categories of your own, or remove them. */
export function CategoriesPanel({ custom, usage, onAdd, onRemove }: Props) {
  const [name, setName] = useState('')
  const [type, setType] = useState<TransactionType>('expense')
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim().replace(/\s+/g, ' ')
    const problem = nameProblem(trimmed, custom)
    if (problem) {
      setError(problem)
      return
    }
    onAdd({ name: trimmed, type })
    setName('')
    setError('')
  }

  return (
    <section className="card categories" aria-labelledby="categories-title">
      <h2 id="categories-title">Your categories</h2>
      <p className="muted">
        Add your own, like "Allowance" for money in or "Pets" for spending. They show up everywhere you pick a
        category, and spending ones can have a budget.
      </p>

      {custom.length > 0 && (
        <ul className="category-chips">
          {custom.map((c) => (
            <li key={c.name} className={c.type === 'income' ? 'chip income' : 'chip'}>
              {c.name}
              <button
                type="button"
                aria-label={`Remove ${c.name}${usage(c.name) > 0 ? ` (used by ${usage(c.name)} transactions)` : ''}`}
                title="Remove"
                onClick={() => onRemove(c)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="category-form" onSubmit={handleSubmit} noValidate>
        <input
          aria-label="New category name"
          placeholder="New category"
          maxLength={MAX_CATEGORY_LENGTH + 10}
          value={name}
          aria-invalid={error !== ''}
          onChange={(e) => setName(e.target.value)}
        />
        <select aria-label="Money in or out" value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
          <option value="expense">Spending</option>
          <option value="income">Income</option>
        </select>
        <button type="submit">Add</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
