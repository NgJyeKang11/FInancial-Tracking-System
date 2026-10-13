import { useEffect, useRef, useState } from 'react'
import {
  cloudEnabled,
  readUserData,
  signInWithGoogle,
  signOutUser,
  watchUser,
  watchUserData,
  writeUserData,
  type CloudUser,
} from '../lib/cloud'
import { todayISO } from '../lib/dates'
import { catchUp } from '../lib/recurring'
import { loadSyncedUser, saveSyncedUser } from '../lib/storage'
import { EMPTY_DATA, mergeData, parseAppData, serialize } from '../lib/sync'
import type { AppData } from '../types'

export type SyncStatus = 'signed-out' | 'loading' | 'saved' | 'saving' | 'error'

/** How long to wait after a change before saving it, so a burst of edits is one save. */
const SAVE_DELAY_MS = 800

/**
 * Keeps the app's data in step with the signed-in Google account:
 * - The first time a device signs in, its data is merged into the account (nothing is lost).
 * - After that, the account's copy wins when the app opens, and changes made on another
 *   device appear here as they're saved.
 * - Changes made here are saved to the account shortly after they happen.
 * - Signing out clears the data from this device; it stays in the account.
 */
export function useCloudSync(data: AppData, replace: (data: AppData) => void) {
  const [user, setUser] = useState<CloudUser | null>(null)
  const [status, setStatus] = useState<SyncStatus>('signed-out')
  /** The data as the account has it (serialized), or null until the first load finishes. */
  const synced = useRef<string | null>(null)
  // The latest data and `replace`, for use inside async code without restarting effects.
  const latest = useRef({ data, replace })
  useEffect(() => {
    latest.current = { data, replace }
  })

  useEffect(() => {
    if (!cloudEnabled) return
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    const onUser = (next: CloudUser | null) => {
      setUser(next)
      if (next) setStatus('loading')
    }
    void watchUser(onUser).then((stop) => {
      if (cancelled) stop()
      else unsubscribe = stop
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  // When someone signs in: load (or create) their data, then listen for changes elsewhere.
  useEffect(() => {
    synced.current = null
    if (!user) return
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    void (async () => {
      const raw = await readUserData(user.uid)
      const account = raw === undefined ? null : parseAppData(raw)
      const device = latest.current.data
      // Merge this device in only the first time it signs in to this account.
      let next = account === null ? device : loadSyncedUser() === user.uid ? account : mergeData(device, account)
      // Add any monthly items that came due while no device was open.
      const due = catchUp(next.transactions, next.recurring, todayISO())
      next = { ...next, transactions: due.transactions, recurring: due.recurring }

      const text = serialize(next)
      if (account === null || text !== serialize(account)) await writeUserData(user.uid, next)
      if (cancelled) return
      synced.current = text
      saveSyncedUser(user.uid)
      latest.current.replace(next)
      setStatus('saved')

      const stop = await watchUserData(user.uid, (value) => {
        const incoming = parseAppData(value)
        if (!incoming || serialize(incoming) === synced.current) return
        synced.current = serialize(incoming)
        latest.current.replace(incoming)
      })
      if (cancelled) stop()
      else unsubscribe = stop
    })().catch(() => {
      if (!cancelled) setStatus('error')
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [user])

  // Save changes made on this device, shortly after they happen.
  useEffect(() => {
    if (!user || synced.current === null) return
    const text = serialize(data)
    if (text === synced.current) return
    setStatus('saving')
    const timer = setTimeout(() => {
      writeUserData(user.uid, data)
        .then(() => {
          synced.current = text
          setStatus('saved')
        })
        .catch(() => setStatus('error'))
    }, SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [data, user])

  const signIn = () => signInWithGoogle()

  const signOut = async () => {
    // Stop syncing first, so clearing this device can never be saved over the account.
    synced.current = null
    await signOutUser()
    saveSyncedUser(null)
    // The data is safe in the account; don't leave it on a device that may be shared.
    replace(EMPTY_DATA)
  }

  return { enabled: cloudEnabled, user, status: user ? status : ('signed-out' as const), signIn, signOut }
}
