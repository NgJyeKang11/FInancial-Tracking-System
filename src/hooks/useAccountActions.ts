import { useState } from 'react'
import { describeSignInError } from '../lib/cloud'
import type { SyncStatus } from './useCloudSync'

export const SYNC_STATUS_TEXT: Record<SyncStatus, string> = {
  'signed-out': '',
  loading: 'Loading your data…',
  saving: 'Saving…',
  saved: 'Saved to your account',
  error: "Couldn't sync. Changes are kept on this device for now.",
}

/**
 * Sign-in and sign-out buttons' behaviour, shared by the header menu and the Settings page:
 * a busy flag while it's happening, a friendly sign-in error, and a check before signing out.
 */
export function useAccountActions(status: SyncStatus, onSignIn: () => Promise<void>, onSignOut: () => Promise<void>) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signIn = () => {
    setError('')
    setBusy(true)
    onSignIn()
      .catch((e: unknown) => setError(describeSignInError(e) ?? ''))
      .finally(() => setBusy(false))
  }

  const signOut = () => {
    const unsaved = status === 'saving' || status === 'error'
    const message = unsaved
      ? "Some changes haven't reached your account yet and will be lost if you sign out now. Sign out anyway?"
      : 'Sign out? Your data stays in your Google account and is removed from this device.'
    if (!window.confirm(message)) return
    setBusy(true)
    onSignOut().finally(() => setBusy(false))
  }

  return { busy, error, signIn, signOut }
}
