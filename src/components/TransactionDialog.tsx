import { useEffect, useRef } from 'react'
import type { Transaction, TransactionInput } from '../types'
import { TransactionForm } from './TransactionForm'

interface Props {
  /** The transaction to edit, or null to add a new one. */
  editing: Transaction | null
  onSubmit: (input: TransactionInput) => void
  onClose: () => void
}

/** A pop-up holding the add / edit form. */
export function TransactionDialog({ editing, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  // Tell the parent straight away rather than waiting for the dialog's close event, which the
  // browser can hold back (for example while the tab is in the background).
  const close = () => {
    dialogRef.current?.close()
    onClose()
  }

  return (
    <dialog ref={dialogRef} className="dialog form-dialog" onClose={onClose} aria-labelledby="form-title">
      <TransactionForm
        editing={editing}
        onSubmit={(input) => {
          onSubmit(input)
          close()
        }}
        onCancel={close}
      />
    </dialog>
  )
}
