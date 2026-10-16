import { createCrmMergeController } from './merge-controller'
import type { CrmMergeController, CrmMergeControllerOptions, CrmMergePort, CrmMergeView, CrmRefusal, CrmResult } from './merge-public-types'

export type CrmMergeHostInputs = Omit<CrmMergeControllerOptions, 'randomBytes' | 'monotonicNow'>
const unavailable = (): CrmRefusal => ({ ok: false, code: 'unavailable', message: 'These fictional CRM merge controls are unavailable in the current preview. No records changed.' })

/** Inputs are live trusted accessors. Each child port is permanently bound to
 * one concrete controller; disposal can never revive an old capability. */
export function createCrmMergeHost(inputs: CrmMergeHostInputs, services?: Pick<CrmMergeControllerOptions, 'randomBytes' | 'monotonicNow'> & { readPath: () => string }) {
  let controller: CrmMergeController | null = null
  let navigationGeneration = 0, lifetime = 0
  const listeners = new Set<() => void>()
  function create() {
    return createCrmMergeController({
      ...inputs,
      retainInactiveReadProjection: true,
      readModeGeneration: () => inputs.readModeGeneration() + navigationGeneration,
      readActive: () => (services?.readPath() ?? window.location.pathname).replace(/\/+$/, '') === '/crm/demo' && inputs.readActive(),
      randomBytes: services?.randomBytes ?? (length => {
        if (length !== 32) throw new Error('Secure local preview randomness is unavailable.')
        const bytes = new Uint8Array(32)
        globalThis.crypto.getRandomValues(bytes)
        return bytes
      }),
      monotonicNow: services?.monotonicNow ?? (() => globalThis.performance.now()),
    })
  }
  function bindPort(owned: CrmMergeController): CrmMergePort {
    return {
      view: () => owned.view(),
      report: request => owned.report(request),
      groupMembers: request => owned.groupMembers(request),
      choices: request => owned.choices(request),
      history: request => owned.history(request),
      preview: selection => owned.preview(selection),
      confirm(request) { const result = owned.confirm(request); if (result.ok && controller === owned) publish(); return result },
      cancel: handle => owned.cancel(handle),
    }
  }
  controller = create()
  let port = bindPort(controller)
  let snapshot: { view: CrmResult<CrmMergeView>; lifetime: number; port: CrmMergePort } = { view: unavailable(), lifetime, port }
  let snapshotKey = ''
  function getSnapshot() {
    const next = controller?.view() ?? unavailable()
    const key = JSON.stringify([lifetime, next])
    if (key !== snapshotKey) { snapshot = { view: next, lifetime, port }; snapshotKey = key }
    return snapshot
  }
  function publish() { getSnapshot(); for (const listener of listeners) listener() }
  return {
    getSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() { if (!controller) { lifetime++; controller = create(); port = bindPort(controller); publish() } },
    stop() { controller?.dispose(); controller = null },
    navigated() { navigationGeneration++; controller?.clear(); publish() },
  }
}
