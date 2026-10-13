import { useEffect, useRef, useState, type FormEvent } from 'react'
import { todayISO } from '../lib/dates'
import { formatCents, parseAmountToCents, parseBalanceToCents } from '../lib/money'
import { ADJUSTMENT, type TransactionInput } from '../types'

interface Props {
  /** The balance the app shows for today, in cents. */
  balanceCents: number
  currency: string
  onSave: (input: TransactionInput) => void
  onClose: () => void
}

type Mode = 'remove' | 'add' | 'set'

const MODES: { value: Mode; label: string }[] = [
  { value: 'remove', label: 'Remove' },
  { value: 'add', label: 'Add' },
  { value: 'set', label: 'Set balance' },
]

/**
 * A pop-up for correcting the balance when money moved without the app seeing it, for example
 * a payment made through another app. It's saved as an "Adjustment" dated today.
 */
export function AdjustBalanceDialog({ balanceCents, currency, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mode, setMode] = useState<Mode>('remove')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // Tell the parent straight away rather than waiting for the dialog's close event, which the
  // browser can hold back (for example while the tab is in the background).
  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  /** How much the balance changes, in cents (negative = money out), or null if not readable yet. */
  const change = (() => {
    if (mode === 'set') {
      const target = parseBalanceToCents(amount)
      return target === null ? null : target - balanceCents
    }
    const cents = parseAmountToCents(amount)
    return cents === null ? null : mode === 'remove' ? -cents : cents
  })()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (change === null) {
      setError(mode === 'set' ? 'Enter your actual balance, e.g. 1,250.00 or -20.00.' : 'Enter an amount greater than 0.')
      return
    }
    if (change === 0) {
      setError('That is already your balance, so there is nothing to adjust.')
      return
    }
    onSave({
      type: change < 0 ? 'expense' : 'income',
      amountCents: Math.abs(change),
      category: ADJUSTMENT,
      date: todayISO(),
      note: note.trim() || 'Balance adjustment',
    })
    close()
  }

  return (
    <dialog ref={dialogRef} className="dialog form-dialog" onClose={onClose} aria-labelledby="adjust-title">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <h2 id="adjust-title">Adjust balance</h2>
        <p className="muted">
          For money that moved without being logged here, like paying through another app. Your balance today is{' '}
          <strong>{formatCents(balanceCents, currency)}</strong>.
        </p>

        <div className="segmented three" role="group" aria-label="What to do">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className={mode === m.value ? 'selected' : undefined}
              aria-pressed={mode === m.value}
              onClick={() => {
                setMode(m.value)
                setError('')
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <label>
          {mode === 'set' ? 'Actual balance' : 'Amount'}
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={error !== ''}
            aria-describedby={error ? 'adjust-error' : 'adjust-result'}
            autoFocus
          />
        </label>

        <label>
          <span>
            Note <span className="muted">(optional)</span>
          </span>
          <input
            placeholder="e.g. Paid with e-wallet"
            maxLength={100}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {change !== null && change !== 0 && (
          <p id="adjust-result" className="adjust-result">
            {change < 0 ? 'Takes out' : 'Adds'} <strong>{formatCents(Math.abs(change), currency)}</strong>, so your
            balance becomes <strong>{formatCents(balanceCents + change, currency)}</strong>.
          </p>
        )}

        {error && (
          <p id="adjust-error" className="error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </dialog>
  )
}
