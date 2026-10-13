import { useState } from 'react'
import { describeSignInError, type CloudUser } from '../lib/cloud'
import type { SyncStatus } from '../hooks/useCloudSync'

interface Props {
  user: CloudUser | null
  status: SyncStatus
  onSignIn: () => Promise<void>
  onSignOut: () => Promise<void>
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  'signed-out': '',
  loading: 'Loading your data…',
  saving: 'Saving…',
  saved: 'Saved to your account',
  error: "Couldn't sync. Changes are kept on this device for now.",
}

/** "Sign in with Google", or the signed-in person's picture with a small menu. */
export function AccountMenu({ user, status, onSignIn, onSignOut }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!user) {
    return (
      <div className="account">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError('')
            setBusy(true)
            onSignIn()
              .catch((e: unknown) => setError(describeSignInError(e) ?? ''))
              .finally(() => setBusy(false))
          }}
        >
          Sign in with Google
        </button>
        {error && (
          <p className="error account-error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  const initial = (user.name || user.email || '?').charAt(0).toUpperCase()

  return (
    <details className="account">
      <summary aria-label={`Account: ${user.email}`} className={status === 'error' ? 'sync-error' : undefined}>
        {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span>{initial}</span>}
      </summary>
      <div className="account-menu">
        {user.name && <strong>{user.name}</strong>}
        <span className="muted">{user.email}</span>
        <span className={status === 'error' ? 'error' : 'muted'} role="status">
          {STATUS_TEXT[status]}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const unsaved = status === 'saving' || status === 'error'
            const message = unsaved
              ? "Some changes haven't reached your account yet and will be lost if you sign out now. Sign out anyway?"
              : 'Sign out? Your data stays in your Google account and is removed from this device.'
            if (!window.confirm(message)) return
            setBusy(true)
            onSignOut().finally(() => setBusy(false))
          }}
        >
          Sign out
        </button>
      </div>
    </details>
  )
}
