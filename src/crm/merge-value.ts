import { crmActors, type CrmActor } from './types'
export type CrmMergeFailureCode = 'forbidden' | 'invalid' | 'unavailable' | 'conflict' | 'stale' | 'limit'
export class CrmMergeError extends Error { constructor(message: string, readonly code: CrmMergeFailureCode = 'invalid') { super(message); this.name = 'CrmMergeError' } }
export function crmMergeAssert(condition: unknown, message = 'This CRM operation is unavailable. No records changed.', code: CrmMergeFailureCode = 'invalid'): asserts condition { if (!condition) throw new CrmMergeError(message, code) }
export function crmMergeKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): asserts value is Record<string, unknown> {
  crmMergeAssert(value !== null && typeof value === 'object' && !Array.isArray(value))
  const proto = Object.getPrototypeOf(value); crmMergeAssert(proto === Object.prototype || proto === null)
  const keys = Reflect.ownKeys(value)
  crmMergeAssert(required.every(key => keys.includes(key)) && keys.every(key => typeof key === 'string' && (required.includes(key) || optional.includes(key))))
  for (const key of keys) { const d = Object.getOwnPropertyDescriptor(value, key)!; crmMergeAssert('value' in d && d.enumerable) }
}
export function assertCrmMergeActor(value: unknown): CrmActor {
  try {
    crmMergeKeys(value, ['id', 'role'], ['label'])
    const actor = crmActors.find(a => a.id === value.id && a.role === value.role)
    crmMergeAssert(actor)
    return { ...actor }
  } catch { throw new CrmMergeError('This preview identity cannot access CRM merges.', 'forbidden') }
}
export function assertCrmMergeJson(value: unknown): void {
  let nodes = 0, characters = 0; const seen = new Set<object>()
  function visit(item: unknown, depth: number) {
    crmMergeAssert(++nodes <= 300000 && depth <= 100, 'This CRM workspace exceeds its review capacity.', 'limit')
    if (typeof item === 'string') { characters += item.length; crmMergeAssert(characters <= 4000000, 'This CRM workspace exceeds its review capacity.', 'limit'); return }
    if (item === null || typeof item === 'boolean') return
    if (typeof item === 'number') { crmMergeAssert(Number.isFinite(item) && !Object.is(item, -0)); return }
    crmMergeAssert(typeof item === 'object' && item !== null && !seen.has(item))
    const proto = Object.getPrototypeOf(item); crmMergeAssert(Array.isArray(item) ? proto === Array.prototype : proto === Object.prototype || proto === null)
    seen.add(item)
    if (Array.isArray(item)) {
      crmMergeAssert(item.length <= 10000, 'This CRM workspace exceeds its review capacity.', 'limit')
      const keys = Reflect.ownKeys(item); crmMergeAssert(keys.length === item.length + 1 && keys.every(key => key === 'length' || typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < item.length))
      for (let i = 0; i < item.length; i++) { const d = Object.getOwnPropertyDescriptor(item, String(i)); crmMergeAssert(d && 'value' in d && d.enumerable); visit(d.value, depth + 1) }
    } else {
      for (const key of Reflect.ownKeys(item)) { const d = Object.getOwnPropertyDescriptor(item, key)!; crmMergeAssert(typeof key === 'string' && 'value' in d && d.enumerable); characters += key.length; crmMergeAssert(characters <= 4000000, 'This CRM workspace exceeds its review capacity.', 'limit'); visit(d.value, depth + 1) }
    }
    seen.delete(item)
  }
  visit(value, 0)
}
export function canonicalCrmMergeJson(value: unknown): string {
  assertCrmMergeJson(value)
  function order(item: unknown): unknown { if (Array.isArray(item)) return item.map(order); if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map(key => [key, order((item as Record<string, unknown>)[key])])); return item }
  return JSON.stringify(order(value))
}
export function copyCrmMerge<T>(value: T): T { assertCrmMergeJson(value); return structuredClone(value) }
export function crmMergeFailure(error: unknown) { return { ok: false as const, code: error instanceof CrmMergeError ? error.code : 'invalid' as CrmMergeFailureCode, message: error instanceof CrmMergeError ? error.message : 'This CRM operation is unavailable. No records changed.' } }
export const normalizedCrmName = (name: string) => name.trim().replace(/\s+/gu, ' ').toLowerCase()
