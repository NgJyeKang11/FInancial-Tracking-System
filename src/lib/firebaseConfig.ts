import type { FirebaseOptions } from 'firebase/app'

/**
 * The web app settings from the Firebase console (Project settings → Your apps). These are
 * not secrets: what protects each person's data is the sign-in and the Firestore rules in
 * `firestore.rules`. While this is null, "Sign in with Google" is hidden and the app only
 * saves on the device.
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyDwacU-g9YokL4gdl-J3Obit9Zf6jVigHQ',
  authDomain: 'telemachus-641ec.firebaseapp.com',
  projectId: 'telemachus-641ec',
  storageBucket: 'telemachus-641ec.firebasestorage.app',
  messagingSenderId: '166398782848',
  appId: '1:166398782848:web:ddccae870b47fd835be565',
}
