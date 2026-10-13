import { useState, type FormEvent } from 'react'
import { monthOf, todayISO } from '../lib/dates'
import { formatCents, parseAmountToCents } from '../lib/money'
import { occurrenceDate } from '../lib/recurring'
import {
  CATEGORIES_BY_TYPE,
  type Category,
  type Recurring,
  type TransactionType,
} from '../types'

/** What the form collects; `id` and `lastMonth` are filled in when it's saved. */
export type RecurringDraft = Omit<Recurring, 'id' | 'lastMonth'>

interface Props {
  recurring: Recurring[]
  currency: string
  /** `startThisMonth` also adds this month's one, if its day has already come. */
  onAdd: (draft: RecurringDraft, startThisMonth: boolean) => void
  onRemove: (item: Recurring) => void
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd" */
function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

function RecurringForm({ onAdd, onCancel }: { onAdd: Props['onAdd']; onCancel: () => void }) {
  const [type, setType] = useState<TransactionType>('income')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('Gift')
  const [day, setDay] = useState('1')
  const [note, setNote] = useState('')
  const [startThisMonth, setStartThisMonth] = useState(true)
  const [error, setError] = useState('')

  const dayNumber = Number(day)
  const validDay = Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 31
  // Starting this month only adds one now if this month's day has already come.
  const addsNow = validDay && occurrenceDate(dayNumber, monthOf(todayISO())) <= todayISO()

  const changeType = (next: TransactionType) => {
    if (next === type) return
    setType(next)
    setCategory(next === 'income' ? 'Gift' : CATEGORIES_BY_TYPE.expense[0])
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const amountCents = parseAmountToCents(amount)
    if (amountCents === null) {
      setError('Enter an amount greater than 0, with up to 2 decimal places.')
      return
    }
    if (!validDay) {
      setError('Pick a day of the month from 1 to 31.')
      return
    }
    onAdd({ type, amountCents, category, day: dayNumber, note: note.trim() }, startThisMonth)
  }

  return (
    <form className="form recurring-form" onSubmit={handleSubmit} noValidate>
      <div className="segmented" role="group" aria-label="Money in or out">
        {(['income', 'expense'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={type === value ? 'selected' : undefined}
            aria-pressed={type === value}
            onClick={() => changeType(value)}
          >
            {value === 'income' ? 'Money in' : 'Money out'}
          </button>
        ))}
      </div>

      <div className="form-row">
        <label>
          Amount
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={error !== '' && parseAmountToCents(amount) === null}
            autoFocus
          />
        </label>
        <label>
          Day of the month
          <input
            type="number"
            min={1}
            max={31}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            aria-invalid={error !== '' && !validDay}
          />
        </label>
      </div>

      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {CATEGORIES_BY_TYPE[type].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <label>
        <span>
          Note <span className="muted">(optional)</span>
        </span>
        <input
          placeholder={type === 'income' ? 'e.g. Allowance from parents' : 'e.g. Rent'}
          maxLength={100}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <label>
        Starts
        <select value={startThisMonth ? 'this' : 'next'} onChange={(e) => setStartThisMonth(e.target.value === 'this')}>
          <option value="this">{addsNow ? 'This month (adds it now)' : 'This month'}</option>
          <option value="next">Next month</option>
        </select>
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary">
          Save
        </button>
      </div>
    </form>
  )
}

/** The "Every month" card: money that comes in or goes out on the same day each month. */
export function RecurringPanel({ recurring, currency, onAdd, onRemove }: Props) {
  const [adding, setAdding] = useState(false)

  return (
    <section className="card recurring" aria-labelledby="recurring-title">
      <header className="card-head">
        <h2 id="recurring-title">Every month</h2>
        {!adding && (
          <button type="button" className="link" onClick={() => setAdding(true)}>
            + Add
          </button>
        )}
      </header>
      <p className="muted">
        An allowance, salary, rent or subscription. It's added automatically on its day each month.
      </p>

      {recurring.length > 0 && (
        <ul>
          {recurring.map((r) => (
            <li key={r.id}>
              <span className="recent-main">
                <span className="recent-title">{r.note || r.category}</span>
                <span className="muted">
                  On the {ordinal(r.day)}
                  {r.note && ` · ${r.category}`}
                </span>
              </span>
              <span className={r.type === 'income' ? 'amount positive' : 'amount'}>
                {r.type === 'income' ? '+' : '−'}
                {formatCents(r.amountCents, currency)}
              </span>
              <button
                type="button"
                className="link danger"
                onClick={() => onRemove(r)}
                aria-label={`Stop ${r.note || r.category}`}
              >
                Stop
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <RecurringForm
          onAdd={(draft, startThisMonth) => {
            onAdd(draft, startThisMonth)
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </section>
  )
}
