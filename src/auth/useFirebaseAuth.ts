import { onAuthStateChanged, type User } from 'firebase/auth'
import { useEffect, useMemo, useState } from 'react'
import {
  getAccountCapabilities,
  getAccountLevelDefinition,
  normalizeAccountLevel,
  TEST_ACCOUNTS,
  type AccountLevel,
} from '@/auth/accountLevels'
import { signOutCurrentUser } from '@/auth/firebaseAuth'
import { auth, firebaseRuntime } from '@/config/firebase'

function fixtureLevel(email: string | null | undefined): AccountLevel {
  if (!firebaseRuntime.useEmulators || !email) return 1
  const fixture = TEST_ACCOUNTS.find((account) => account.email.toLowerCase() === email.toLowerCase())
  return fixture?.level ?? 1
}

async function resolveLevel(user: User) {
  try {
    const token = await user.getIdTokenResult()
    const claimLevel = normalizeAccountLevel(token.claims.accountLevel ?? token.claims.level)
    const localLevel = fixtureLevel(user.email)
    return firebaseRuntime.useEmulators ? Math.max(claimLevel, localLevel) as AccountLevel : claimLevel || 1
  } catch {
    return fixtureLevel(user.email)
  }
}

export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [level, setLevel] = useState<AccountLevel>(0)
  const [loading, setLoading] = useState(Boolean(auth))

  useEffect(() => {
    if (!auth) {
      return undefined
    }

    let cancelled = false
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!nextUser) {
        if (!cancelled) {
          setUser(null)
          setLevel(0)
          setLoading(false)
        }
        return
      }

      setUser(nextUser)
      void resolveLevel(nextUser).then((nextLevel) => {
        if (cancelled) return
        setLevel(nextLevel)
        setLoading(false)
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const definition = useMemo(() => getAccountLevelDefinition(level), [level])
  const capabilities = useMemo(() => getAccountCapabilities(level), [level])

  return {
    user,
    loading,
    level,
    definition,
    capabilities,
    firebaseRuntime,
    signOut: signOutCurrentUser,
    isAuthenticated: Boolean(user),
    isAdmin: capabilities.canAccessAdmin,
    authUnavailable: !firebaseRuntime.authAvailable,
  }
}

export type FirebaseAuthState = ReturnType<typeof useFirebaseAuth>

// Keep the direct helper available to code that needs the definition without
// subscribing to auth state, while the hook remains the UI authority.
export { getAccountLevelDefinition }
