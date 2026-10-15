import type { HrLifecycleAction } from './lifecycle-types'
import type { MockHrEvent } from './mock-workflows'
import type { PeopleOperationsEvent } from './people-operations'
import type { PerformanceEvent } from './performance'
import type { RecruitingCommand } from './recruiting-lifecycle-types'
import type { RecruitingEvent } from './recruiting'
import type { HrServiceDeskEvent } from './service-desk'
import type { SurveysEvent } from './surveys'

/** Native commands retain their existing reducer validation and authority.
 * This envelope does not map local identities or commands to provider calls. */
export type HrNativeCommand =
  | Readonly<{ domain: 'workflow'; command: MockHrEvent }>
  | Readonly<{ domain: 'people-operations'; command: PeopleOperationsEvent }>
  | Readonly<{ domain: 'service-desk'; command: HrServiceDeskEvent }>
  | Readonly<{ domain: 'recruiting'; command: RecruitingEvent }>
  | Readonly<{ domain: 'recruiting-lifecycle'; command: RecruitingCommand }>
  | Readonly<{ domain: 'performance'; command: PerformanceEvent }>
  | Readonly<{ domain: 'surveys'; command: SurveysEvent }>
  | Readonly<{ domain: 'lifecycle'; command: HrLifecycleAction }>

export type HrProviderAdapterMode = 'mock' | 'disabled' | 'demo' | 'production'

/** App-owned recovery vocabulary, not a provider error-code or timing policy.
 * A retry result schedules nothing and grants no permission to replay a write. */
export type HrProviderRetryState = 'manual-retry' | 'review-before-retry'

export type HrProviderUnsupported = Readonly<{
  kind: 'unsupported'
  reason: 'adapter-unconfigured' | 'unmapped-command'
}>

/** A provider result is neither a native command nor accepted native state.
 * An adopter supplies its reviewed result projection and validates it before
 * use; these types do not authenticate an actor or accept a provider operation. */
export type HrProviderOutcome<TProviderValue = never> =
  | Readonly<{ kind: 'provider-result'; value: TProviderValue }>
  | Readonly<{ kind: 'refused'; reason: 'invalid-input' | 'not-authorized' | 'not-ready' }>
  | Readonly<{ kind: 'retry'; state: HrProviderRetryState }>
  | HrProviderUnsupported

/** Future implementations belong behind the adopter's trusted actor/resource
 * mapping. Declaring a mode or implementing this interface enables no transport. */
export interface OptionalHrProviderAdapter<TProviderValue = never> {
  readonly mode: HrProviderAdapterMode
  execute(command: HrNativeCommand): Promise<HrProviderOutcome<TProviderValue>>
}

export interface UnconfiguredHrProviderAdapter extends OptionalHrProviderAdapter<never> {
  readonly mode: 'mock'
  readonly providerConnected: false
  readonly payrollExecutionEnabled: false
  execute(command: HrNativeCommand): Promise<HrProviderUnsupported>
}

const unsupported: HrProviderUnsupported = Object.freeze({
  kind: 'unsupported',
  reason: 'adapter-unconfigured',
})

/** The supplied implementation has no configuration or transport arguments.
 * It reads no payload, changes no native state and starts no retry work. Native
 * workflows keep using their existing reducers; the server keeps its disabled
 * default and the separate SDK mock keeps its own session. */
export function createUnconfiguredHrProviderAdapter(): Readonly<UnconfiguredHrProviderAdapter> {
  return Object.freeze({
    mode: 'mock',
    providerConnected: false,
    payrollExecutionEnabled: false,
    execute: () => Promise.resolve(unsupported),
  })
}
