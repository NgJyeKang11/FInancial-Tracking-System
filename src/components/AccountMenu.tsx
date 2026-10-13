import { SYNC_STATUS_TEXT, useAccountActions } from '../hooks/useAccountActions'
import type { SyncStatus } from '../hooks/useCloudSync'
import { initialOf, type CloudUser } from '../lib/cloud'

interface Props {
  user: CloudUser | null
  status: SyncStatus
  onSignIn: () => Promise<void>
  onSignOut: () => Promise<void>
}

/** "Sign in", or the signed-in person's picture with a small menu. */
export function AccountMenu({ user, status, onSignIn, onSignOut }: Props) {
  const { busy, error, signIn, signOut } = useAccountActions(status, onSignIn, onSignOut)

  if (!user) {
    return (
      <div className="account">
        <button type="button" disabled={busy} onClick={signIn} title="Sign in with Google to sync across devices">
          Sign in
        </button>
        {error && (
          <p className="error account-error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <details className="account">
      <summary aria-label={`Account: ${user.email}`} className={status === 'error' ? 'sync-error' : undefined}>
        {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" /> : <span>{initialOf(user)}</span>}
      </summary>
      <div className="account-menu">
        {user.name && <strong>{user.name}</strong>}
        <span className="muted">{user.email}</span>
        <span className={status === 'error' ? 'error' : 'muted'} role="status">
          {SYNC_STATUS_TEXT[status]}
        </span>
        <button type="button" disabled={busy} onClick={signOut}>
          Sign out
        </button>
      </div>
    </details>
  )
}
