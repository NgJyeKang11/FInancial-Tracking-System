import { useState, type FormEvent } from 'react'
import { amountError, centsToInput, parseAmountToCents } from '../lib/money'
import { todayISO } from '../lib/dates'
import { useCustomCategories } from '../hooks/useCategories'
import { categoriesFor, type Category, type Transaction, type TransactionInput, type TransactionType } from '../types'

interface Props {
  /** When set, the form edits this transaction instead of adding a new one. */
  editing: Transaction | null
  onSubmit: (input: TransactionInput) => void
  onCancel: () => void
}

export function TransactionForm({ editing, onSubmit, onCancel }: Props) {
  const custom = useCustomCategories()
  const [type, setType] = useState<TransactionType>(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(editing ? centsToInput(editing.amountCents) : '')
  const [category, setCategory] = useState<Category>(editing?.category ?? categoriesFor('expense', custom)[0])
  const choices = categoriesFor(type, custom)
  // A transaction can keep a category that has since been removed; still show it.
  const options = choices.includes(category) ? choices : [category, ...choices]
  const [date, setDate] = useState(editing?.date ?? todayISO())
  const [note, setNote] = useState(editing?.note ?? '')
  const [error, setError] = useState('')

  const changeType = (next: TransactionType) => {
    if (next === type) return
    setType(next)
    // Each type has its own categories, so start from the first one.
    setCategory(categoriesFor(next, custom)[0])
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const amountCents = parseAmountToCents(amount)
    if (amountCents === null) {
      setError(amountError(amount) ?? '')
      return
    }
    if (!date) {
      setError('Pick a date.')
      return
    }
    // The balance only counts transactions up to today, so a future one would look missing.
    // (The date picker's max isn't enforced because the form uses noValidate.)
    if (date > todayISO()) {
      setError("Pick today or an earlier date. For money that comes every month, use Budgets → Every month.")
      return
    }
    onSubmit({ type, amountCents, category, date, note: note.trim() })
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <h2 id="form-title">{editing ? 'Edit transaction' : 'Add transaction'}</h2>

      <div className="segmented" role="group" aria-label="Transaction type">
        {(['expense', 'income'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={type === value ? 'selected' : undefined}
            aria-pressed={type === value}
            onClick={() => changeType(value)}
          >
            {value === 'expense' ? 'Expense' : 'Income'}
          </button>
        ))}
      </div>

      <label>
        Amount
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={error !== ''}
          aria-describedby={error ? 'form-error' : undefined}
          autoFocus
        />
      </label>

      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {options.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <label>
        Date
        <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </label>

      <label>
        <span>
          Note <span className="muted">(optional)</span>
        </span>
        <input
          placeholder={type === 'income' ? 'e.g. October paycheck' : 'e.g. Lunch with friends'}
          maxLength={100}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {error && (
        <p id="form-error" className="error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary">
          {editing ? 'Save changes' : 'Add'}
        </button>
      </div>
    </form>
  )
}
