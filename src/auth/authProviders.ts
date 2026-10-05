import registry from '../../.SYSTEMX/LAN/Builder/contracts/auth-provider-registry.json'

export type AuthProviderId = 'email-password' | 'google' | 'email-link' | 'custom-token' | 'sso'

export type AuthProviderDefinition = {
  id: AuthProviderId
  label: string
  firebaseApi: string[]
  localState: 'enabled' | 'disabled' | 'planned'
  localNote: string
  productionState: 'supported' | 'planned'
  productionNote: string
}

export type AuthProviderRegistry = {
  schemaVersion: number
  title: string
  defaultLocalProvider: AuthProviderId
  localPolicy: {
    environment: 'development'
    firebaseProject: string
    authEmulator: string
    allowedProviderIds: AuthProviderId[]
    productionFallback: 'disabled'
    note: string
  }
  providers: AuthProviderDefinition[]
}

export const AUTH_PROVIDER_REGISTRY = registry as AuthProviderRegistry

export function getAuthProvider(providerId: AuthProviderId) {
  return AUTH_PROVIDER_REGISTRY.providers.find((provider) => provider.id === providerId)
}

export function isLocalAuthProviderEnabled(providerId: AuthProviderId, useEmulators: boolean) {
  return useEmulators
    ? AUTH_PROVIDER_REGISTRY.localPolicy.allowedProviderIds.includes(providerId)
    : getAuthProvider(providerId)?.productionState === 'supported'
}
