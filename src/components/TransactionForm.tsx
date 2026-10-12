import { useState, type FormEvent } from 'react'
import { centsToInput, parseAmountToCents } from '../lib/money'
import { todayISO } from '../lib/dates'
import { CATEGORIES, type Category, type Transaction, type TransactionInput } from '../types'

interface Props {
  /** When set, the form edits this transaction instead of adding a new one. */
  editing: Transaction | null
  onSubmit: (input: TransactionInput) => void
  onCancelEdit: () => void
}

export function TransactionForm({ editing, onSubmit, onCancelEdit }: Props) {
  const [amount, setAmount] = useState(editing ? centsToInput(editing.amountCents) : '')
  const [category, setCategory] = useState<Category>(editing?.category ?? CATEGORIES[0])
  const [date, setDate] = useState(editing?.date ?? todayISO())
  const [note, setNote] = useState(editing?.note ?? '')
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const amountCents = parseAmountToCents(amount)
    if (amountCents === null) {
      setError('Enter an amount greater than 0, with up to 2 decimal places.')
      return
    }
    if (!date) {
      setError('Pick a date.')
      return
    }
    onSubmit({ amountCents, category, date, note: note.trim() })
    setError('')
    if (!editing) {
      // Keep category and date so logging several purchases from one day is quick.
      setAmount('')
      setNote('')
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h2>{editing ? 'Edit transaction' : 'Add transaction'}</h2>

      <label>
        Amount
        <input
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={error !== ''}
          aria-describedby={error ? 'form-error' : undefined}
          autoFocus={editing !== null}
        />
      </label>

      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {CATEGORIES.map((c) => (
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
          placeholder="e.g. Lunch with friends"
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
        <button type="submit" className="primary">
          {editing ? 'Save changes' : 'Add'}
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
