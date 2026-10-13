import { useEffect } from 'react'

export interface UndoAction {
  /** Shown in the bar, e.g. "Deleted Lunch". */
  message: string
  undo: () => void
  /** How long the bar stays up, if not the usual 7 seconds. */
  showForMs?: number
}

interface Props {
  action: UndoAction
  onDone: () => void
}

/** How long the Undo bar usually stays up. */
const SHOW_FOR_MS = 7000

/**
 * A small bar at the bottom of the screen after something is deleted or changed, with an
 * Undo button. It's used instead of "Are you sure?" pop-ups: the action happens straight
 * away and can be taken back for a few seconds.
 */
export function UndoToast({ action, onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, action.showForMs ?? SHOW_FOR_MS)
    return () => clearTimeout(timer)
  }, [action, onDone])

  return (
    <div className="toast" role="status">
      <span>{action.message}</span>
      <button
        type="button"
        onClick={() => {
          action.undo()
          onDone()
        }}
      >
        Undo
      </button>
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDone}>
        ×
      </button>
    </div>
  )
}
