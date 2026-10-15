import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
const modulePath = resolve(root, 'src/hr/provider-adapter.ts')
const source = await readFile(modulePath, 'utf8')
const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile)
const diagnosticHost = { getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n' }
const format = diagnostics => ts.formatDiagnostics(diagnostics, diagnosticHost)
assert.equal(config.error, undefined, config.error && format([config.error]))
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
assert.deepEqual(parsed.errors, [], format(parsed.errors))
assert.equal(parsed.options.strict, true)
assert.equal(parsed.options.noEmit, true)

/** Check actual source dependencies under the project's strict options. The
 * only virtual file is the handwritten consumer, never a replacement model. */
function semanticProgram(consumer) {
  const fixture = resolve(root, 'tests/hr/provider-adapter.consumer.ts')
  const host = ts.createCompilerHost(parsed.options)
  const originalRead = host.readFile.bind(host)
  const originalExists = host.fileExists.bind(host)
  const originalSource = host.getSourceFile.bind(host)
  const isFixture = file => resolve(file) === fixture
  host.readFile = file => isFixture(file) ? consumer : originalRead(file)
  host.fileExists = file => isFixture(file) || originalExists(file)
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => isFixture(file)
    ? ts.createSourceFile(file, consumer, languageVersion, true)
    : originalSource(file, languageVersion, onError, shouldCreateNewSourceFile)
  const program = ts.createProgram({ rootNames: [fixture], options: parsed.options, host })
  assert.ok(program.getSourceFile(modulePath), 'the real adapter module must be checked')
  return { fixture, diagnostics: ts.getPreEmitDiagnostics(program), semantic: program.getSemanticDiagnostics() }
}

const validConsumer = [
  'import { createUnconfiguredHrProviderAdapter, type HrNativeCommand, type HrProviderOutcome, type HrProviderRetryState, type HrProviderUnsupported, type OptionalHrProviderAdapter } from "../../src/hr/provider-adapter";',
  'import type { MockHrEvent } from "../../src/hr/mock-workflows";',
  'import type { PeopleOperationsEvent } from "../../src/hr/people-operations";',
  'import type { HrServiceDeskEvent } from "../../src/hr/service-desk";',
  'import type { RecruitingEvent } from "../../src/hr/recruiting";',
  'import type { RecruitingCommand } from "../../src/hr/recruiting-lifecycle-types";',
  'import type { PerformanceEvent } from "../../src/hr/performance";',
  'import type { SurveysEvent } from "../../src/hr/surveys";',
  'import type { HrLifecycleAction } from "../../src/hr/lifecycle-types";',
  'type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;',
  'type Must<T extends true> = T;',
  'export type Domains = Must<Exact<HrNativeCommand["domain"], "workflow" | "people-operations" | "service-desk" | "recruiting" | "recruiting-lifecycle" | "performance" | "surveys" | "lifecycle">>;',
  'export type Bindings = [',
  '  Must<Exact<Extract<HrNativeCommand, { domain: "workflow" }>["command"], MockHrEvent>>,',
  '  Must<Exact<Extract<HrNativeCommand, { domain: "people-operations" }>["command"], PeopleOperationsEvent>>,',
  '  Must<Exact<Extract<HrNativeCommand, { domain: "service-desk" }>["command"], HrServiceDeskEvent>>,',
  '  Must<Exact<Extract<HrNativeCommand, { domain: "recruiting" }>["command"], RecruitingEvent>>,',
  '  Must<Exact<Extract<HrNativeCommand, { domain: "recruiting-lifecycle" }>["command"], RecruitingCommand>>,',
  '  Must<Exact<Extract<HrNativeCommand, { domain: "performance" }>["command"], PerformanceEvent>>,',
  '  Must<Exact<Extract<HrNativeCommand, { domain: "surveys" }>["command"], SurveysEvent>>,',
  '  Must<Exact<Extract<HrNativeCommand, { domain: "lifecycle" }>["command"], HrLifecycleAction>>',
  '];',
  'export const commands: HrNativeCommand[] = [',
  '  { domain: "workflow", command: { type: "add-time", date: "2026-10-15", hours: 1.25, source: "manual" } },',
  '  { domain: "people-operations", command: { type: "request-pto", startDate: "2026-10-19", endDate: "2026-10-20", leaveType: "vacation" } },',
  '  { domain: "service-desk", command: { type: "create-request", category: "equipment", title: "Fictional equipment", details: "Sample request details." } },',
  '  { domain: "recruiting", command: { type: "create-job", title: "Fictional role", department: "Sample team", managerId: "employee-001" } },',
  '  { domain: "recruiting-lifecycle", command: { kind: "adopt", recordedAt: "2026-10-15T12:00:00.000Z" } },',
  '  { domain: "performance", command: { type: "create-goal", employeeId: "employee-002", title: "Fictional goal" } },',
  '  { domain: "surveys", command: { type: "publish-survey", surveyId: "survey-sample" } },',
  '  { domain: "lifecycle", command: { type: "set-simulation-date", simulationDate: "2026-10-15" } }',
  '];',
  'export const adapter = createUnconfiguredHrProviderAdapter();',
  'export const defaultMode: "mock" = adapter.mode;',
  'export const noConnection: false = adapter.providerConnected;',
  'export const noPayroll: false = adapter.payrollExecutionEnabled;',
  'export function unsupportedOnly(): Promise<HrProviderUnsupported> { return adapter.execute(commands[0]); }',
  'export const fixtureAdapter: OptionalHrProviderAdapter<{ reference: string }> = {',
  '  mode: "demo",',
  '  async execute(command) { void command; return { kind: "provider-result", value: { reference: "fictional-contract-result" } }; }',
  '};',
  'export const retryState: HrProviderRetryState = "review-before-retry";',
  'export const outcomes: HrProviderOutcome<{ reference: string }>[] = [',
  '  { kind: "provider-result", value: { reference: "fictional-contract-result" } },',
  '  { kind: "refused", reason: "not-authorized" },',
  '  { kind: "retry", state: "manual-retry" },',
  '  { kind: "retry", state: retryState },',
  '  { kind: "unsupported", reason: "unmapped-command" }',
  '];',
  'export function describe(outcome: HrProviderOutcome<{ reference: string }>): string {',
  '  switch (outcome.kind) {',
  '    case "provider-result": return outcome.value.reference;',
  '    case "refused": return outcome.reason;',
  '    case "retry": return outcome.state;',
  '    case "unsupported": return outcome.reason;',
  '    default: { const exhaustive: never = outcome; return exhaustive; }',
  '  }',
  '}',
].join('\n')

const invalidConsumer = [
  'import { createUnconfiguredHrProviderAdapter, type HrNativeCommand, type HrProviderOutcome } from "../../src/hr/provider-adapter";',
  'import type { MockHrEvent } from "../../src/hr/mock-workflows";',
  '// @ts-expect-error a workflow envelope cannot contain a recruiting command',
  'export const mixed: HrNativeCommand = { domain: "workflow", command: { type: "create-job", title: "Fictional role", department: "Sample team", managerId: "employee-001" } };',
  '// @ts-expect-error native time requires hours',
  'export const incomplete: HrNativeCommand = { domain: "workflow", command: { type: "add-time", date: "2026-10-15", source: "manual" } };',
  '// @ts-expect-error legacy recruiting cannot stand in for the separate lifecycle command',
  'export const oldAsNew: HrNativeCommand = { domain: "recruiting-lifecycle", command: { type: "create-job", title: "Fictional role", department: "Sample team", managerId: "employee-001" } };',
  '// @ts-expect-error lifecycle recruiting commands require an explicit recorded time',
  'export const missingTime: HrNativeCommand = { domain: "recruiting-lifecycle", command: { kind: "adopt" } };',
  '// @ts-expect-error provider values are explicitly typed projections',
  'export const wrongValue: HrProviderOutcome<{ reference: string }> = { kind: "provider-result", value: { reference: 3 } };',
  '// @ts-expect-error an unsupported result cannot carry a provider completion',
  'export const unsupportedValue: HrProviderOutcome<{ reference: string }> = { kind: "unsupported", reason: "adapter-unconfigured", value: { reference: "fictional" } };',
  '// @ts-expect-error refusal does not grant retry policy',
  'export const retryRefusal: HrProviderOutcome = { kind: "refused", reason: "not-authorized", state: "manual-retry" };',
  '// @ts-expect-error retry states do not promise automatic replay',
  'export const automatic: HrProviderOutcome = { kind: "retry", state: "automatic-retry" };',
  'export const providerValue: HrProviderOutcome<{ reference: string }> = { kind: "provider-result", value: { reference: "fictional" } };',
  '// @ts-expect-error provider outcomes are not native reducer events',
  'export const nativeEvent: MockHrEvent = providerValue;',
  'export function unsafeRead(outcome: HrProviderOutcome<{ reference: string }>) {',
  '  // @ts-expect-error callers must narrow the outcome before reading its provider value',
  '  return outcome.value.reference;',
  '}',
  'export function incompleteSwitch(outcome: HrProviderOutcome<{ reference: string }>) {',
  '  if (outcome.kind === "provider-result") return outcome.value.reference;',
  '  if (outcome.kind === "refused" || outcome.kind === "unsupported") return outcome.reason;',
  '  // @ts-expect-error omitting the retry branch prevents exhaustive handling',
  '  const incomplete: never = outcome;',
  '  return incomplete;',
  '}',
  'export const adapter = createUnconfiguredHrProviderAdapter();',
  '// @ts-expect-error the supplied factory has no connection configuration',
  'export const configured = createUnconfiguredHrProviderAdapter({ mode: "production", providerApproved: true });',
  '// @ts-expect-error mock mode is readonly and literal',
  'adapter.mode = "production";',
  '// @ts-expect-error connection is readonly and false',
  'adapter.providerConnected = true;',
  '// @ts-expect-error payroll execution is readonly and false',
  'adapter.payrollExecutionEnabled = true;',
  '// @ts-expect-error the executable property is readonly',
  'adapter.execute = async () => ({ kind: "unsupported", reason: "adapter-unconfigured" });',
  'export async function impossibleCompletion(command: HrNativeCommand) {',
  '  // @ts-expect-error the supplied implementation only returns unsupported',
  '  const completed: { kind: "provider-result"; value: { reference: string } } = await adapter.execute(command);',
  '  return completed;',
  '}',
].join('\n')

test('strict semantic program preserves all eight actual native command bindings and narrows provider outcomes', () => {
  const checked = semanticProgram(validConsumer)
  assert.deepEqual(checked.diagnostics, [], format(checked.diagnostics))
})

test('strict semantic program rejects mixed commands, unsafe results, implicit retry and activation attempts', () => {
  const checked = semanticProgram(invalidConsumer)
  assert.deepEqual(checked.diagnostics, [], format(checked.diagnostics))
})

test('semantic proof observes an actual incompatible command diagnostic without expected-error directives', () => {
  const checked = semanticProgram([
    'import type { HrNativeCommand } from "../../src/hr/provider-adapter";',
    'export const bad: HrNativeCommand = { domain: "workflow", command: { type: "add-time", date: "2026-10-15", hours: "1.25", source: "manual" } };',
  ].join('\n'))
  assert.ok(checked.semantic.some(diagnostic => diagnostic.code === 2322), format(checked.diagnostics))
  assert.ok(checked.diagnostics.length > 0)
  assert.ok(checked.diagnostics.every(diagnostic => diagnostic.file?.fileName === checked.fixture && diagnostic.code === 2322), format(checked.diagnostics))
})

/** Runtime evaluation has poisoned I/O globals. Transpilation is used only to
 * execute this pure module; the tests above use real semantic programs. */
function isolatedRuntime() {
  const forbidden = []
  const globals = { exports: {} }
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'setTimeout', 'setInterval', 'queueMicrotask', 'requestAnimationFrame', 'localStorage', 'sessionStorage', 'window', 'document', 'navigator', 'process', 'require', 'Date']) {
    Object.defineProperty(globals, name, { get() { forbidden.push(name); throw new Error('Unexpected runtime access: ' + name) } })
  }
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true })
  assert.deepEqual(compiled.diagnostics, [], format(compiled.diagnostics))
  runInNewContext(compiled.outputText, globals, { filename: 'provider-adapter.js', timeout: 1000 })
  return { create: globals.exports.createUnconfiguredHrProviderAdapter, forbidden }
}

test('module evaluation erases every domain import and touches no I/O, clock or scheduler', () => {
  const tree = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const imports = tree.statements.filter(ts.isImportDeclaration)
  assert.equal(imports.length, 8)
  assert.ok(imports.every(statement => statement.importClause?.isTypeOnly), 'native domains are imported only as types')
  const runtime = isolatedRuntime()
  assert.equal(typeof runtime.create, 'function')
  assert.deepEqual(runtime.forbidden, [])
})

test('unconfigured defaults and result flags are frozen at runtime as well as readonly in types', async () => {
  const runtime = isolatedRuntime()
  const adapter = runtime.create()
  assert.deepEqual(Object.keys(adapter).sort(), ['execute', 'mode', 'payrollExecutionEnabled', 'providerConnected'])
  assert.equal(adapter.mode, 'mock')
  assert.equal(adapter.providerConnected, false)
  assert.equal(adapter.payrollExecutionEnabled, false)
  assert.equal(Object.isFrozen(adapter), true)
  for (const [key, value] of [['mode', 'production'], ['providerConnected', true], ['payrollExecutionEnabled', true], ['execute', () => { throw new Error('Replacement must be refused') }]]) assert.equal(Reflect.set(adapter, key, value), false, key)
  const outcome = await adapter.execute({ domain: 'workflow', command: { type: 'submit-payroll' } })
  assert.equal(Object.isFrozen(outcome), true)
  assert.equal(Reflect.set(outcome, 'kind', 'provider-result'), false)
  assert.equal(Reflect.set(outcome, 'value', { reference: 'fictional' }), false)
  assert.equal(JSON.stringify(outcome), '{"kind":"unsupported","reason":"adapter-unconfigured"}')
  assert.deepEqual(runtime.forbidden, [])
})

const nativeCommands = [
  { domain: 'workflow', command: { type: 'submit-payroll' } },
  { domain: 'people-operations', command: { type: 'request-pto', startDate: '2026-10-19', endDate: '2026-10-20', leaveType: 'vacation' } },
  { domain: 'service-desk', command: { type: 'create-request', category: 'equipment', title: 'Fictional equipment', details: 'Sample request details.' } },
  { domain: 'recruiting', command: { type: 'create-job', title: 'Fictional role', department: 'Sample team', managerId: 'employee-001' } },
  { domain: 'recruiting-lifecycle', command: { kind: 'adopt', recordedAt: '2026-10-15T12:00:00.000Z' } },
  { domain: 'performance', command: { type: 'create-goal', employeeId: 'employee-002', title: 'Fictional goal' } },
  { domain: 'surveys', command: { type: 'publish-survey', surveyId: 'survey-sample' } },
  { domain: 'lifecycle', command: { type: 'set-simulation-date', simulationDate: '2026-10-15' } },
]
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

test('every native domain remains unsupported without changing its command or creating provider results', async () => {
  const runtime = isolatedRuntime()
  const commands = freeze(structuredClone(nativeCommands))
  const before = JSON.stringify(commands)
  const adapter = runtime.create()
  for (const command of commands) {
    const outcome = await adapter.execute(command)
    assert.equal(JSON.stringify(outcome), '{"kind":"unsupported","reason":"adapter-unconfigured"}', command.domain)
    assert.deepEqual(Object.keys(outcome).sort(), ['kind', 'reason'])
  }
  assert.equal(JSON.stringify(commands), before)
  assert.deepEqual(runtime.forbidden, [])
})

test('untrusted runtime configuration and payload objects are never read, coerced or mutated', async () => {
  const runtime = isolatedRuntime()
  const access = []
  const poison = operation => () => { access.push(operation); throw new Error('Payload must remain unread: ' + operation) }
  const payload = new Proxy({}, Object.fromEntries(['get', 'has', 'ownKeys', 'getOwnPropertyDescriptor', 'getPrototypeOf', 'set', 'defineProperty', 'deleteProperty', 'setPrototypeOf', 'preventExtensions', 'isExtensible'].map(operation => [operation, poison(operation)])))
  // JavaScript callers can supply extra arguments despite the typed no-argument
  // factory. They confer no mode, transport, approval or callback capability.
  const adapter = runtime.create(payload)
  const outcome = await adapter.execute(payload)
  assert.equal(adapter.mode, 'mock')
  assert.equal(adapter.providerConnected, false)
  assert.equal(adapter.payrollExecutionEnabled, false)
  assert.equal(JSON.stringify(outcome), '{"kind":"unsupported","reason":"adapter-unconfigured"}')
  assert.deepEqual(access, [])
  assert.deepEqual(runtime.forbidden, [])
})

test('repeated calls and hostile thenable payloads cannot schedule retries or access native storage', async () => {
  const runtime = isolatedRuntime()
  let payloadReads = 0
  const payload = { get then() { payloadReads++; throw new Error('Do not await the native command') } }
  const adapter = runtime.create()
  for (let index = 0; index < 16; index++) {
    const outcome = await adapter.execute(payload)
    assert.equal(outcome.kind, 'unsupported')
    assert.equal(outcome.reason, 'adapter-unconfigured')
    assert.equal(Object.isFrozen(outcome), true)
  }
  await Promise.resolve()
  assert.equal(payloadReads, 0)
  assert.deepEqual(runtime.forbidden, [])
})
