import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithEmailLink as firebaseSignInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  type ActionCodeSettings,
  type User,
} from 'firebase/auth'
import { AUTH_PROVIDER_REGISTRY, getAuthProvider } from '@/auth/authProviders'
import { auth, firebaseRuntime } from '@/config/firebase'

function requireAuth() {
  if (!auth) {
    throw new Error('Firebase Auth is not available. Configure .env.local for a project or use the local development lane.')
  }
  return auth
}

function requireProductionProvider(providerId: 'google' | 'email-link' | 'custom-token' | 'sso') {
  const definition = getAuthProvider(providerId)
  if (!definition || definition.productionState !== 'supported') {
    throw new Error(`The ${providerId} provider is not enabled in the SYSTEMX provider registry.`)
  }
  if (firebaseRuntime.useEmulators) {
    throw new Error(`${definition.label} is intentionally disabled in the local Firebase emulator lane. Use Email + password.`)
  }
  return definition
}

function requireNonEmpty(value: string, label: string) {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${label} is required.`)
  return normalized
}

export function formatFirebaseAuthError(error: unknown) {
  if (error instanceof Error && error.message) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'The email or password is not valid for this local Firebase Auth project.'
    }
    if (code === 'auth/email-already-in-use') return 'That email already has a local account. Sign in instead.'
    if (code === 'auth/weak-password') return 'Use a stronger password with at least six characters.'
    if (code === 'auth/network-request-failed') return 'Firebase Auth could not be reached. Start the local Auth emulator and try again.'
    return error.message
  }
  return 'Firebase Auth returned an unknown error.'
}

export async function signInWithEmailPassword(email: string, password: string) {
  return signInWithEmailAndPassword(requireAuth(), requireNonEmpty(email, 'Email'), password)
}

export async function createLocalEmailPasswordAccount(email: string, password: string) {
  if (!firebaseRuntime.useEmulators) {
    throw new Error('The template only creates accounts automatically in the local Firebase emulator lane.')
  }
  return createUserWithEmailAndPassword(requireAuth(), requireNonEmpty(email, 'Email'), password)
}

export async function signInWithGoogle() {
  requireProductionProvider('google')
  return signInWithPopup(requireAuth(), new GoogleAuthProvider())
}

export async function sendEmailLink(email: string) {
  requireProductionProvider('email-link')
  const settings: ActionCodeSettings = {
    url: `${window.location.origin}/login`,
    handleCodeInApp: true,
  }
  await sendSignInLinkToEmail(requireAuth(), requireNonEmpty(email, 'Email'), settings)
}

export async function finishEmailLinkSignIn(email: string, url = window.location.href) {
  requireProductionProvider('email-link')
  if (!isSignInWithEmailLink(requireAuth(), url)) throw new Error('The current URL is not a valid Firebase email sign-in link.')
  return firebaseSignInWithEmailLink(requireAuth(), requireNonEmpty(email, 'Email'), url)
}

export async function signInWithCustomToken(token: string) {
  requireProductionProvider('custom-token')
  return firebaseSignInWithCustomToken(requireAuth(), requireNonEmpty(token, 'Custom token'))
}

export async function signInWithSso(providerId: string) {
  requireProductionProvider('sso')
  const normalized = requireNonEmpty(providerId, 'SSO provider ID')
  if (!/^(oidc|saml)\.[a-z0-9][a-z0-9._-]{1,127}$/i.test(normalized)) {
    throw new Error('SSO provider IDs must use an approved oidc.* or saml.* Firebase provider ID.')
  }
  return signInWithPopup(requireAuth(), new OAuthProvider(normalized))
}

export function signOutCurrentUser() {
  return auth ? firebaseSignOut(auth) : Promise.resolve()
}

export type FirebaseAuthUser = User

export const localAuthPolicy = AUTH_PROVIDER_REGISTRY.localPolicy
