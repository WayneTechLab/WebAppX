import type { HrEmployee } from './model'
import type { RecruitingActor, Id, SafeRefusal, UtcInstant } from './recruiting-lifecycle-types'

export const RECRUITING_LIMITS = Object.freeze({ jobs: 50, people: 200, applications: 400, applicationsPerPerson: 8, requisitions: 50, approvals: 500, publications: 50, interviews: 200, interviewsPerApplication: 10, scorecards: 1000, events: 6000, eventsPerApplication: 200, workspaceCharacters: 2_000_000 })
export class RecruitingFault extends Error {
  constructor(public readonly code: SafeRefusal['code'], message: string) { super(message); this.name = 'RecruitingFault' }
}
export function refuse(message = 'The fictional recruiting action is invalid. Review the current inputs.', code: SafeRefusal['code'] = 'invalid'): never { throw new RecruitingFault(code, message) }
export function assert(condition: unknown, message?: string): asserts condition { if (!condition) refuse(message) }

/** Plain JSON only: no getters, toJSON, symbols, holes, inherited data or coercion. */
export function canonicalRecruitingJson(value: unknown, maximum = 2_000_000): string {
  const ancestors = new Set<object>()
  let nodes = 0
  function walk(item: unknown, depth: number): unknown {
    assert(++nodes <= 300_000 && depth <= 100)
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return item
    if (typeof item === 'number') { assert(Number.isFinite(item)); return item }
    assert(typeof item === 'object' && item !== null && !ancestors.has(item))
    assert(Object.getOwnPropertySymbols(item).length === 0)
    ancestors.add(item)
    let result: unknown
    if (Array.isArray(item)) {
      assert(item.length <= 10000 && Object.keys(item).length === item.length && Object.getOwnPropertyNames(item).length === item.length + 1)
      result = Array.from({ length: item.length }, (_, index) => { const d = Object.getOwnPropertyDescriptor(item, String(index)); assert(d && 'value' in d && d.enumerable); return walk(d.value, depth + 1) })
    } else {
      assert(Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null)
      const record: Record<string, unknown> = Object.create(null)
      for (const key of Object.getOwnPropertyNames(item).sort()) {
        assert(!['__proto__', 'prototype', 'constructor'].includes(key))
        const d = Object.getOwnPropertyDescriptor(item, key); assert(d && 'value' in d && d.enumerable)
        record[key] = walk(d.value, depth + 1)
      }
      result = record
    }
    ancestors.delete(item)
    return result
  }
  const serialized = JSON.stringify(walk(value, 0))
  assert(serialized.length <= maximum, 'This local workspace has reached its capacity. No records were changed.')
  return serialized
}
export function sameRecruitingValue(left: unknown, right: unknown) { return canonicalRecruitingJson(left) === canonicalRecruitingJson(right) }
export function copyRecruiting<T>(value: T): T { canonicalRecruitingJson(value); return structuredClone(value) }
export function exactKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): asserts value is Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value))
  canonicalRecruitingJson(value)
  assert(required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key)))
}
export function recruitingId(value: unknown, max = 128): asserts value is Id { assert(typeof value === 'string' && new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`).test(value) && !['__proto__', 'constructor', 'prototype'].includes(value)) }
export function recruitingInteger(value: unknown, min: number, max: number): asserts value is number { assert(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max) }
export function recruitingText(value: unknown, min: number, max: number): string {
  assert(typeof value === 'string' && value.trim().length >= min && value.trim().length <= max && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))
  return value.trim()
}
export function recruitingEmail(value: unknown): string {
  const result = recruitingText(value, 5, 160).toLowerCase()
  assert(/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.invalid$/.test(result) && !result.includes('..'))
  return result
}
export function recruitingInstant(value: unknown): asserts value is UtcInstant {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))
  const time = Date.parse(value); assert(Number.isFinite(time) && new Date(time).toISOString() === value)
}
export function nextRecruitingId(prefix: string, records: readonly { id: string }[]): Id {
  const used = new Set(records.map(record => record.id)); let counter = records.length + 1
  while (used.has(`${prefix}-${String(counter).padStart(4, '0')}`)) counter++
  return `${prefix}-${String(counter).padStart(4, '0')}`
}
export function isRecruitingManager(actor: RecruitingActor): actor is Extract<RecruitingActor, { mode: 'native' }> { return actor?.mode === 'native' && ['employer-owner', 'hr-admin'].includes(actor.actor?.role) }
export function assertRecruitingActor(actor: RecruitingActor, knownEmployeeIds: ReadonlySet<string>) {
  if (actor?.mode === 'native') {
    exactKeys(actor, ['mode', 'actor']); exactKeys(actor.actor, ['role'], ['employeeId', 'contractorId'])
    if (!isRecruitingManager(actor)) refuse('This recruiting preview is unavailable.', 'unavailable')
    if (actor.actor.employeeId !== undefined) assert(knownEmployeeIds.has(actor.actor.employeeId))
    if (actor.actor.contractorId !== undefined) refuse()
  } else {
    exactKeys(actor, ['mode', 'employeeId']); assert(actor.mode === 'interviewer' && typeof actor.employeeId === 'string' && knownEmployeeIds.has(actor.employeeId), 'This recruiting preview is unavailable.')
  }
}
export function recruitingEmployees(raw: readonly HrEmployee[], hires: readonly HrEmployee[]): HrEmployee[] {
  const all = [...raw, ...hires]; assert(new Set(all.map(person => person.id)).size === all.length); return all
}
export function safeRecruitingFailure(error: unknown): SafeRefusal {
  if (error instanceof RecruitingFault) return { ok: false, code: error.code, message: error.message }
  return { ok: false, code: 'invalid', message: 'The fictional recruiting action was refused. Review the current inputs and preview again.' }
}
