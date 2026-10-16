import { validateTimeEntry } from './model'
import type { PayrollControlRefusal } from './payroll-control-types'

export class PayrollControlFault extends Error {
  constructor(message: string, readonly code: PayrollControlRefusal['code'] = 'invalid') { super(message) }
}
export function payrollRefuse(message = 'The sample payroll control is invalid.', code: PayrollControlRefusal['code'] = 'invalid'): never { throw new PayrollControlFault(message, code) }
export function payrollAssert(value: unknown, message?: string): asserts value { if (!value) payrollRefuse(message) }
export function payrollFailure(error: unknown): PayrollControlRefusal { return error instanceof PayrollControlFault ? { ok: false, code: error.code, message: error.message } : { ok: false, code: 'invalid', message: 'The sample payroll control is invalid; no change was accepted.' } }
/** Strict descriptor walk precedes JSON serialization: getters and lossy repair never execute. */
export function canonicalPayrollJson(value: unknown): string {
  let nodes = 0
  const ancestors = new Set<object>()
  function visit(item: unknown, depth: number): unknown {
    payrollAssert(++nodes <= 300_000 && depth <= 100, 'The sample workspace exceeds its safe inspection limit.')
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return item
    if (typeof item === 'number') { payrollAssert(Number.isFinite(item) && !Object.is(item, -0)); return item }
    payrollAssert(typeof item === 'object' && item !== null)
    const object = item as object
    payrollAssert(!ancestors.has(object)); ancestors.add(object)
    let result: unknown
    if (Array.isArray(object)) {
      payrollAssert(Object.getPrototypeOf(object) === Array.prototype && object.length <= 10_000)
      const keys = Reflect.ownKeys(object)
      payrollAssert(keys.length === object.length + 1)
      result = Array.from({ length: object.length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(object, String(index))
        payrollAssert(descriptor && 'value' in descriptor && descriptor.enumerable); return visit(descriptor.value, depth + 1)
      })
    } else {
      payrollAssert(Object.getPrototypeOf(object) === Object.prototype || Object.getPrototypeOf(object) === null)
      const record: Record<string, unknown> = Object.create(null)
      payrollAssert(Object.getOwnPropertySymbols(object).length === 0)
      for (const key of Object.getOwnPropertyNames(object).sort()) {
        payrollAssert(typeof key === 'string' && !['__proto__', 'constructor', 'prototype'].includes(key))
        const descriptor = Object.getOwnPropertyDescriptor(object, key)
        payrollAssert(descriptor && 'value' in descriptor && descriptor.enumerable); record[key] = visit(descriptor.value, depth + 1)
      }
      result = record
    }
    ancestors.delete(object); return result
  }
  const text = JSON.stringify(visit(value, 0))
  payrollAssert(text.length <= 2_000_000, 'The sample workspace exceeds its saved storage limit.')
  return text
}
export function copyPayroll<T>(value: T): T { canonicalPayrollJson(value); return structuredClone(value) }
export function payrollKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): asserts value is Record<string, unknown> {
  canonicalPayrollJson(value)
  payrollAssert(value && typeof value === 'object' && !Array.isArray(value))
  payrollAssert(required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key)))
}
export function payrollId(value: unknown): asserts value is string { payrollAssert(typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value)) }
export function payrollInteger(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number { payrollAssert(typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= min && value <= max) }
export function payrollDate(value: unknown): asserts value is string { payrollAssert(typeof value === 'string' && validateTimeEntry(value, 1).valid, 'Enter a valid sample recorded date.') }
export function payrollPeriod(value: unknown): asserts value is { start: string; end: string } {
  payrollKeys(value, ['start', 'end']); payrollDate(value.start); payrollDate(value.end)
  const days = (Date.parse(value.end + 'T00:00:00Z') - Date.parse(value.start + 'T00:00:00Z')) / 86_400_000 + 1
  payrollAssert(Number.isInteger(days) && days >= 1 && days <= 366, 'Choose a valid sample period of 1–366 calendar days.')
}
export function payrollReason(value: unknown): asserts value is string { payrollAssert(typeof value === 'string' && value === value.trim() && value.length >= 2 && value.length <= 500 && !/[\p{Cc}\p{Cf}]/u.test(value), 'Enter a fictional reason of 2–500 printable characters.') }
