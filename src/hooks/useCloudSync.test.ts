// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudUser } from '../lib/cloud'
import { EMPTY_DATA } from '../lib/sync'
import type { AppData, Recurring, Transaction } from '../types'
import { useCloudSync } from './useCloudSync'

// A pretend Google account and Firestore, kept in memory.
const cloud = vi.hoisted(() => ({
  store: new Map<string, string>(),
  onUser: null as ((user: CloudUser | null) => void) | null,
  watchers: new Set<(value: unknown) => void>(),
}))

const ME: CloudUser = { uid: 'u1', name: 'JK', email: 'jk@example.com', photoURL: null }

vi.mock('../lib/cloud', () => ({
  cloudEnabled: true,
  watchUser: async (onChange: (user: CloudUser | null) => void) => {
    cloud.onUser = onChange
    onChange(null)
    return () => {}
  },
  signInWithGoogle: async () => cloud.onUser?.(ME),
  signOutUser: async () => cloud.onUser?.(null),
  readUserData: async (uid: string) => {
    const json = cloud.store.get(uid)
    return json === undefined ? undefined : JSON.parse(json)
  },
  writeUserData: async (uid: string, data: AppData) => {
    cloud.store.set(uid, JSON.stringify(data))
  },
  watchUserData: async (_uid: string, onChange: (value: unknown) => void) => {
    cloud.watchers.add(onChange)
    return () => cloud.watchers.delete(onChange)
  },
}))

/** Another device saving to the account. */
const saveFromElsewhere = (data: AppData) => {
  cloud.store.set(ME.uid, JSON.stringify(data))
  for (const watcher of cloud.watchers) watcher(data)
}
const accountData = (): AppData => JSON.parse(cloud.store.get(ME.uid) ?? 'null')

const tx = (id: string): Transaction => ({
  id,
  type: 'expense',
  amountCents: 1000,
  category: 'Food & Drink',
  date: '2026-10-01',
  note: id,
})
const ids = (data: AppData) => data.transactions.map((t) => t.id).sort()

/** The hook plus the app state it syncs, like App has. */
function setup(initial: AppData) {
  return renderHook(() => {
    const [data, setData] = useState(initial)
    return { data, setData, sync: useCloudSync(data, setData) }
  })
}

async function signIn(result: { current: ReturnType<typeof setup>['result']['current'] }) {
  await act(() => result.current.sync.signIn())
  await waitFor(() => expect(result.current.sync.status).toBe('saved'))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 13))
  cloud.store.clear()
  cloud.watchers.clear()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCloudSync', () => {
  it("uploads this device's data to a brand-new account", async () => {
    const { result } = setup({ ...EMPTY_DATA, transactions: [tx('a')], currency: 'MYR' })
    expect(result.current.sync.status).toBe('signed-out')
    await signIn(result)
    expect(ids(accountData())).toEqual(['a'])
    expect(accountData().currency).toBe('MYR')
  })

  it('merges this device into an existing account the first time', async () => {
    cloud.store.set(ME.uid, JSON.stringify({ ...EMPTY_DATA, transactions: [tx('b')] }))
    const { result } = setup({ ...EMPTY_DATA, transactions: [tx('a')] })
    await signIn(result)
    expect(ids(result.current.data)).toEqual(['a', 'b'])
    expect(ids(accountData())).toEqual(['a', 'b'])
  })

  it("lets the account win on a device that has synced before, so deletions don't come back", async () => {
    localStorage.setItem('fts.syncedUser', ME.uid)
    // "a" was deleted on another device; this device's copy is out of date.
    cloud.store.set(ME.uid, JSON.stringify({ ...EMPTY_DATA, transactions: [tx('b')] }))
    const { result } = setup({ ...EMPTY_DATA, transactions: [tx('a'), tx('b')] })
    await signIn(result)
    expect(ids(result.current.data)).toEqual(['b'])
    expect(ids(accountData())).toEqual(['b'])
  })

  it('saves changes made on this device', async () => {
    const { result } = setup(EMPTY_DATA)
    await signIn(result)
    act(() => result.current.setData((d) => ({ ...d, transactions: [tx('new')] })))
    expect(result.current.sync.status).toBe('saving')
    // The pretend account stores the data a moment before the hook hears the save finished.
    await waitFor(
      () => {
        expect(ids(accountData())).toEqual(['new'])
        expect(result.current.sync.status).toBe('saved')
      },
      { timeout: 2000 },
    )
  })

  it('empties the account too when everything is reset while signed in', async () => {
    const { result } = setup({ ...EMPTY_DATA, transactions: [tx('a'), tx('b')], budgets: { Groceries: 100 } })
    await signIn(result)
    act(() => result.current.setData({ ...EMPTY_DATA, currency: result.current.data.currency }))
    await waitFor(
      () => {
        expect(accountData()).toMatchObject({ transactions: [], budgets: {}, recurring: [] })
        expect(result.current.sync.status).toBe('saved')
      },
      { timeout: 2000 },
    )
  })

  it('shows changes saved on another device', async () => {
    const { result } = setup(EMPTY_DATA)
    await signIn(result)
    act(() => saveFromElsewhere({ ...EMPTY_DATA, transactions: [tx('from-phone')] }))
    expect(ids(result.current.data)).toEqual(['from-phone'])
  })

  it('adds monthly items that came due, once, with the same ids on every device', async () => {
    const allowance: Recurring = {
      id: 'r1',
      type: 'income',
      amountCents: 50000,
      category: 'Gift',
      day: 1,
      note: 'Allowance',
      lastMonth: '2026-08',
    }
    cloud.store.set(ME.uid, JSON.stringify({ ...EMPTY_DATA, recurring: [allowance] }))
    localStorage.setItem('fts.syncedUser', ME.uid)
    const { result } = setup(EMPTY_DATA)
    await signIn(result)
    expect(ids(accountData())).toEqual(['r1:2026-09', 'r1:2026-10'])
    expect(accountData().recurring[0].lastMonth).toBe('2026-10')
  })

  it('clears this device on sign-out without touching the account', async () => {
    const { result } = setup({ ...EMPTY_DATA, transactions: [tx('a')] })
    await signIn(result)
    await act(() => result.current.sync.signOut())
    expect(result.current.data).toEqual(EMPTY_DATA)
    expect(result.current.sync.status).toBe('signed-out')
    // Wait past the save delay: the emptied device must not be saved over the account.
    await new Promise((resolve) => setTimeout(resolve, 1000))
    expect(ids(accountData())).toEqual(['a'])
    expect(localStorage.getItem('fts.syncedUser')).toBeNull()
  })
})
