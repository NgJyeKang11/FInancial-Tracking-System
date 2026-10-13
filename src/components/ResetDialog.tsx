import { useEffect, useRef, useState, type FormEvent } from 'react'
import { downloadBackup } from '../lib/backup'
import type { AppData } from '../types'

interface Props {
  data: AppData
  /** True when signed in, so the account's copy is wiped too. */
  signedIn: boolean
  onConfirm: () => void
  onClose: () => void
}

/** What has to be typed to unlock the Delete button. */
const CONFIRM_WORD = 'RESET'

/** How long Undo is offered after a reset. */
export const RESET_UNDO_SECONDS = 10

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The "Reset everything" warning. It lists what will be deleted, offers a backup first, and
 * only deletes once RESET is typed, so it can't happen by a stray click. Undo is offered for
 * a few seconds afterwards.
 */
export function ResetDialog({ data, signedIn, onConfirm, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')
  const [backedUp, setBackedUp] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // Tell the parent straight away rather than waiting for the dialog's close event, which the
  // browser can hold back (for example while the tab is in the background).
  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  const unlocked = typed.trim().toUpperCase() === CONFIRM_WORD
  const budgets = Object.keys(data.budgets).length
  const remembered = Object.keys(data.categoryRules).length
  const losses = [
    count(data.transactions.length, 'transaction', 'transactions'),
    count(data.recurring.length, 'monthly item (allowance, rent…)', 'monthly items (allowance, rent…)'),
    count(budgets, 'budget', 'budgets'),
    count(data.customCategories.length, 'category you added', 'categories you added'),
    count(remembered, 'remembered import category', 'remembered import categories'),
    `your currency setting (${data.currency}, back to USD)`,
  ]

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!unlocked) return
    onConfirm()
    close()
  }

  return (
    <dialog ref={dialogRef} className="dialog form-dialog reset-dialog" onClose={onClose} aria-labelledby="reset-title">
      <form className="form" onSubmit={handleSubmit} noValidate>
        <h2 id="reset-title">Reset everything?</h2>

        <div className="reset-warning" role="alert">
          <strong>Caution: this deletes everything.</strong> It removes:
          <ul>
            {losses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            You'll have {RESET_UNDO_SECONDS} seconds to undo it. After that it's <strong>permanent</strong>.
          </p>
          {signedIn && (
            <p>
              You're signed in, so this also wipes the copy in your Google account, on <strong>every device</strong>.
            </p>
          )}
        </div>

        <div className="reset-backup">
          <span className="muted">Want a way back? Save a backup first; you can restore it any time.</span>
          <button
            type="button"
            onClick={() => {
              downloadBackup(data)
              setBackedUp(true)
            }}
          >
            {backedUp ? 'Backup downloaded ✓' : 'Download a backup first'}
          </button>
        </div>

        <label>
          <span>
            Type <strong>{CONFIRM_WORD}</strong> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
          />
        </label>

        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="danger-solid" disabled={!unlocked}>
            Delete everything
          </button>
        </div>
      </form>
    </dialog>
  )
}
