import type { AppData } from '../types'
import { firebaseConfig } from './firebaseConfig'

/** Whether Google sign-in is set up for this copy of the app. */
export const cloudEnabled = firebaseConfig !== null

export interface CloudUser {
  uid: string
  name: string
  email: string
  photoURL: string | null
}

/** The person's first initial, for when there's no profile picture. */
export const initialOf = (user: CloudUser) => (user.name || user.email || '?').charAt(0).toUpperCase()

/**
 * Loads Firebase the first time it's needed, so it doesn't slow down the app for anyone
 * who never signs in.
 */
let servicesPromise: ReturnType<typeof loadServices> | null = null
async function loadServices() {
  if (!firebaseConfig) throw new Error('Google sign-in is not set up.')
  const [{ initializeApp }, auth, firestore] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])
  const app = initializeApp(firebaseConfig)
  return { auth, firestore, authInstance: auth.getAuth(app), db: firestore.getFirestore(app) }
}
const services = () => (servicesPromise ??= loadServices())

/** Calls `onChange` with the signed-in person (or null) now and whenever it changes. */
export async function watchUser(onChange: (user: CloudUser | null) => void): Promise<() => void> {
  const { auth, authInstance } = await services()
  return auth.onAuthStateChanged(authInstance, (user) =>
    onChange(
      user && {
        uid: user.uid,
        name: user.displayName ?? '',
        email: user.email ?? '',
        photoURL: user.photoURL,
      },
    ),
  )
}

export async function signInWithGoogle(): Promise<void> {
  const { auth, authInstance } = await services()
  await auth.signInWithPopup(authInstance, new auth.GoogleAuthProvider())
}

export async function signOutUser(): Promise<void> {
  const { auth, authInstance } = await services()
  await auth.signOut(authInstance)
}

/** A friendly message for a sign-in error, or null when the person just closed the pop-up. */
export function describeSignInError(error: unknown): string | null {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'
    case 'auth/unauthorized-domain':
      return "This website isn't allowed to use Google sign-in yet. Add it under Authentication → Settings → Authorized domains in Firebase."
    case 'auth/network-request-failed':
      return "Couldn't reach Google. Check your internet connection and try again."
    default:
      return "Sign-in didn't work. Please try again."
  }
}

// Each person's data is one document, users/{uid}, holding it all as JSON text. One read or
// write moves everything, and the text keeps Firestore from changing how values are stored.
const userDoc = async (uid: string) => {
  const { firestore, db } = await services()
  return { firestore, ref: firestore.doc(db, 'users', uid) }
}

const decode = (json: unknown): unknown => {
  try {
    return typeof json === 'string' ? JSON.parse(json) : undefined
  } catch {
    return undefined
  }
}

/** The account's saved data (unchecked), or undefined if it has none yet. */
export async function readUserData(uid: string): Promise<unknown> {
  const { firestore, ref } = await userDoc(uid)
  const snapshot = await firestore.getDoc(ref)
  return snapshot.exists() ? decode(snapshot.get('json')) : undefined
}

export async function writeUserData(uid: string, data: AppData): Promise<void> {
  const { firestore, ref } = await userDoc(uid)
  await firestore.setDoc(ref, { json: JSON.stringify(data), updatedAt: firestore.serverTimestamp() })
}

/**
 * Calls `onChange` with the account's data (unchecked) whenever another device saves it.
 * This device's own saves are skipped.
 */
export async function watchUserData(uid: string, onChange: (data: unknown) => void): Promise<() => void> {
  const { firestore, ref } = await userDoc(uid)
  return firestore.onSnapshot(ref, (snapshot) => {
    if (snapshot.metadata.hasPendingWrites || !snapshot.exists()) return
    onChange(decode(snapshot.get('json')))
  })
}
