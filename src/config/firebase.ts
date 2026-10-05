import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage'

const configuredFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1'
const authEmulatorPort = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || '9099'
const firestoreEmulatorPort = import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || '8080'
const storageEmulatorPort = import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_PORT || '9199'
const authEmulatorUrl = `http://${emulatorHost}:${authEmulatorPort}`
const useEmulators = import.meta.env.DEV && (
  import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true' ||
  import.meta.env.VITE_SYSTEMX_LOCAL_SESSION === 'true'
)
const isConfigured = Boolean(configuredFirebaseConfig.apiKey && configuredFirebaseConfig.projectId)
const projectId = configuredFirebaseConfig.projectId || (useEmulators ? 'demo-systemx' : '')

const firebaseConfig = {
  apiKey: configuredFirebaseConfig.apiKey || 'systemx-local-api-key',
  authDomain: configuredFirebaseConfig.authDomain || 'localhost',
  projectId,
  storageBucket: configuredFirebaseConfig.storageBucket || 'demo-systemx.appspot.com',
  messagingSenderId: configuredFirebaseConfig.messagingSenderId || '000000000000',
  appId: configuredFirebaseConfig.appId || '1:000000000000:web:systemxlocal',
  measurementId: configuredFirebaseConfig.measurementId,
}

const shouldInitialize = isConfigured || useEmulators

export const firebaseRuntime = Object.freeze({
  environment: useEmulators ? 'local-emulator' : isConfigured ? 'configured' : 'unconfigured',
  projectId: projectId || null,
  configured: isConfigured,
  useEmulators,
  authEmulatorUrl,
  firestoreEmulator: `${emulatorHost}:${firestoreEmulatorPort}`,
  storageEmulator: `${emulatorHost}:${storageEmulatorPort}`,
  authAvailable: shouldInitialize,
})

declare global {
  var __SYSTEMX_FIREBASE_EMULATORS_CONNECTED__: boolean | undefined
}

export const app: FirebaseApp | null = shouldInitialize
  ? initializeApp(firebaseConfig)
  : null
export const auth: Auth | null = app ? getAuth(app) : null
export const db: Firestore | null = app ? getFirestore(app) : null
export const storage: FirebaseStorage | null = app ? getStorage(app) : null

if (useEmulators && auth && db && storage && !globalThis.__SYSTEMX_FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true })
  connectFirestoreEmulator(db, emulatorHost, Number(firestoreEmulatorPort))
  connectStorageEmulator(storage, emulatorHost, Number(storageEmulatorPort))
  globalThis.__SYSTEMX_FIREBASE_EMULATORS_CONNECTED__ = true
}

if (!isConfigured && !useEmulators && import.meta.env.DEV) {
  console.warn(
    '[firebase] No VITE_FIREBASE_* config found. Production Firebase services remain disabled until .env.local is configured.',
  )
}
