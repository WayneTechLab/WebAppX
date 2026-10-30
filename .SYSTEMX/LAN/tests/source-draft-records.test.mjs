import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { compareSourceText } from '../Website/source-comparison.js'
import {
  sourceRecordLimits, validRecordRevision, isRecoverySourcePath, containsSourceSecrets,
  normalizeSourceDisplay, createRecoveryRecord, parseRecoveryRecord, createComparisonExport,
} from '../Website/source-draft-records.js'

const workspaceId = 'a'.repeat(64)
const baseRevision = 'b'.repeat(64)
const draftDigest = 'c'.repeat(64)
const otherRevision = 'd'.repeat(64)
const storedAt = '2026-10-29T12:34:56.789Z'
const invalid = error => error instanceof TypeError && error.code === 'SOURCE_RECORD_INVALID'
const tooLarge = error => error instanceof TypeError && error.code === 'SOURCE_RECORD_TOO_LARGE'
const privateContent = error => error instanceof TypeError && error.code === 'SOURCE_RECORD_PRIVATE'

function recovery(overrides = {}) {
  return { schemaVersion: 1, workspaceId, path: 'src/pages/Home.tsx', baseRevision, baselineContent: 'baseline\r\n', draftDisplay: 'draft\n', draftDigest, storedAt, ...overrides }
}

function exported(draftContent = 'draft\n', currentContent = 'current\n', overrides = {}) {
  return {
    schemaVersion: 1, path: 'src/pages/Home.tsx', loadedRevision: baseRevision,
    currentRevision: otherRevision, draftRevision: draftDigest,
    draftContent, currentContent, comparison: compareSourceText(draftContent, currentContent), ...overrides,
  }
}

test('fixed record limits and revision syntax do not confer hash verification', () => {
  assert.deepEqual(sourceRecordLimits, { characters: 500000, pathCharacters: 512, serializedRecovery: 2100000, serializedExport: 2500000, historyEntries: 30 })
  assert.equal(Object.isFrozen(sourceRecordLimits), true)
  for (const value of [workspaceId, 'ABCDEF0123456789'.repeat(4)]) assert.equal(validRecordRevision(value), true)
  for (const value of ['', null, 64, 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), workspaceId + '\n', ' ' + workspaceId]) assert.equal(validRecordRevision(value), false)
  // Deliberately unrelated content and syntax-valid hashes: the UI must hash it.
  assert.equal(createRecoveryRecord(recovery({ baselineContent: 'not hashed here' })).baseRevision, baseRevision)
})

test('canonical server path shapes accept dotted filenames and reject aliases and controls', () => {
  for (const path of ['src/pages/Home.tsx', 'src/pages/.Hidden.tsx', 'src/pages/Version.1-page.tsx', 'src/pages/foo..bar.tsx',
    'src/components/layout/Header.tsx', 'src/components/navigation/Main_Nav.tsx', 'src/components/shell/App-2.tsx',
    'src/config/siteControls.ts', 'src/index.css', 'src/router.tsx']) {
    assert.equal(isRecoverySourcePath(path), true, path)
    assert.equal(createRecoveryRecord(recovery({ path })).path, path)
  }
  for (const path of [null, '', './src/pages/Home.tsx', '/src/pages/Home.tsx', 'src//pages/Home.tsx', 'src/pages/../Home.tsx',
    'src/./pages/Home.tsx', 'src/pages/nested/Home.tsx', 'src\\pages\\Home.tsx', 'src/pages/%48ome.tsx', 'src/pages/Home.tsx\n',
    'src/pages/Home.tsx\0', 'src/pages/Home.tsx\u2028', 'src/pages/Home.tsx\u2029', 'src/pages/Home.tsx?x=1', 'src/pages/Home.tsx#x', 'src/pages/Home.jsx', 'src/pages/Höme.tsx',
    'src/components/forms/Input.tsx', 'src/config/sitecontrols.ts', 'src/Index.css', 'src/router.ts']) {
    assert.equal(isRecoverySourcePath(path), false)
    assert.throws(() => createRecoveryRecord(recovery({ path })), invalid)
  }
})

test('all backend secret markers and quoted JSON keys are screened without error echoes', () => {
  const markers = ['-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN EC PRIVATE KEY-----',
    '-----BEGIN OPENSSH PRIVATE KEY-----', 'AIza' + 'a'.repeat(20), 'sk_live_1234', 'sk_test_abcd',
    'password = "12345678"', 'token: \'12345678\'', 'privateKey = "12345678"', 'secret: "12345678"',
    '{"token":"12345678"}', '{"PASSWORD" : "12345678"}', '{"privateKey": "12345678"}', '{"secret":"12345678"}']
  for (const marker of markers) {
    assert.equal(containsSourceSecrets(marker), true)
    for (const field of ['baselineContent', 'draftDisplay']) {
      assert.throws(() => createRecoveryRecord(recovery({ [field]: marker })), error => privateContent(error) && !error.message.includes(marker))
      assert.throws(() => parseRecoveryRecord(JSON.stringify(recovery({ [field]: marker })), workspaceId), privateContent)
    }
    assert.throws(() => createComparisonExport(exported(marker, 'current')), privateContent)
    assert.throws(() => createComparisonExport(exported('draft', marker)), privateContent)
  }
  for (const text of ['', 'password = "1234567"', '{"token":"1234567"}', 'const tokenCount = 8', 'a harmless secret word', null]) assert.equal(containsSourceSecrets(text), false)
})

test('both records cap canonical source paths at 512 units before further work', () => {
  const path = 'src/pages/' + 'x'.repeat(sourceRecordLimits.pathCharacters - 'src/pages/.tsx'.length) + '.tsx'
  assert.equal(path.length, 512)
  assert.equal(isRecoverySourcePath(path), true)
  assert.equal(createRecoveryRecord(recovery({ path })).path, path)
  assert.equal(createComparisonExport(exported('draft', 'current', { path })).payload.path, path)
  const oversized = path.replace('.tsx', 'x.tsx')
  assert.equal(oversized.length, 513)
  assert.equal(isRecoverySourcePath(oversized), false)
  assert.throws(() => createRecoveryRecord(recovery({ path: oversized })), tooLarge)
  assert.throws(() => parseRecoveryRecord(JSON.stringify(recovery({ path: oversized })), workspaceId), tooLarge)
  assert.throws(() => createComparisonExport(exported('draft', 'current', { path: oversized })), tooLarge)
})

test('display normalization changes only CRLF and lone CR, and recovery preserves raw text exactly', () => {
  const baselineContent = '\ufeffé\r\ne\u0301\r😀\nlast'
  const draftDisplay = '\ufeffé\ne\u0301\n😀\nlast'
  assert.equal(normalizeSourceDisplay(baselineContent), draftDisplay)
  assert.equal(normalizeSourceDisplay(draftDisplay), draftDisplay)
  assert.throws(() => normalizeSourceDisplay(null), invalid)
  const input = recovery({ baselineContent, draftDisplay })
  const record = createRecoveryRecord(input)
  assert.notEqual(record, input)
  assert.deepEqual(record, input)
  assert.deepEqual(parseRecoveryRecord(JSON.stringify(record), workspaceId), input)
  for (const value of ['one\r\ntwo', 'one\rtwo', '\r']) assert.throws(() => createRecoveryRecord(recovery({ draftDisplay: value })), invalid)
  assert.equal(record.baselineContent, baselineContent)
})

test('recovery rejects malformed schema, timestamps, missing/extra/private fields and workspace mismatches', () => {
  for (const input of [null, [], 'record', recovery({ schemaVersion: '1' }), recovery({ schemaVersion: 2 }), recovery({ workspaceId: 'local-path' }),
    recovery({ baseRevision: baseRevision + '\n' }), recovery({ draftDigest: 'not a hash' }), recovery({ baselineContent: null }),
    recovery({ draftDisplay: 42 }), recovery({ storedAt: '2026-02-30T12:34:56.789Z' }), recovery({ storedAt: '2026-10-29T12:34:56Z' }),
    recovery({ storedAt: '2026-10-29T12:34:56.789+00:00' }), recovery({ storedAt: storedAt + '\n' }), recovery({ extra: true }),
    recovery({ token: 'fixture-private-extra' })]) assert.throws(() => createRecoveryRecord(input), invalid)
  const missing = recovery()
  delete missing.draftDigest
  assert.throws(() => createRecoveryRecord(missing), invalid)
  const poisoned = JSON.parse(JSON.stringify(recovery()).replace('{', '{"__proto__":{"polluted":true},'))
  assert.throws(() => createRecoveryRecord(poisoned), invalid)
  assert.equal({}.polluted, undefined)
  for (const serialized of ['', '{', 'null', '[]', 'true', '{}']) assert.throws(() => parseRecoveryRecord(serialized, workspaceId), invalid)
  assert.throws(() => parseRecoveryRecord(JSON.stringify(recovery()), otherRevision), error => error.code === 'SOURCE_RECORD_WORKSPACE')
  assert.throws(() => parseRecoveryRecord(JSON.stringify(recovery()), 'invalid expected workspace'), invalid)
})

test('individual content limits accept the boundary and reject overflow without truncation', () => {
  const maximum = 'x'.repeat(sourceRecordLimits.characters)
  const input = recovery({ baselineContent: maximum, draftDisplay: maximum })
  assert.deepEqual(createRecoveryRecord(input), input)
  assert.deepEqual(parseRecoveryRecord(JSON.stringify(input), workspaceId), input)
  for (const field of ['baselineContent', 'draftDisplay']) assert.throws(() => createRecoveryRecord(recovery({ [field]: maximum + 'x' })), tooLarge)
  for (const field of ['draftContent', 'currentContent']) assert.throws(() => createComparisonExport(exported('', '', { [field]: maximum + 'x' })), tooLarge)
})

test('recovery serialization cap includes escaped text and is enforced exactly', () => {
  const empty = recovery({ baselineContent: '', draftDisplay: '' })
  const room = sourceRecordLimits.serializedRecovery - JSON.stringify(empty).length
  const prefix = '\b\t\n\f\r\0\u001f"\\😀\ud800x\udc00'
  const remaining = room - (JSON.stringify(prefix).length - 2)
  const baselineContent = prefix + '\0'.repeat(Math.floor(remaining / 6)) + 'x'.repeat(remaining % 6)
  const atLimit = recovery({ baselineContent, draftDisplay: '' })
  assert.ok(baselineContent.length < sourceRecordLimits.characters)
  const json = JSON.stringify(createRecoveryRecord(atLimit))
  assert.equal(json.length, sourceRecordLimits.serializedRecovery)
  assert.equal(parseRecoveryRecord(json, workspaceId).baselineContent, baselineContent)
  assert.throws(() => createRecoveryRecord({ ...atLimit, baselineContent: baselineContent + 'x' }), tooLarge)
  assert.throws(() => parseRecoveryRecord(json + ' ', workspaceId), tooLarge)
})

test('oversized serialized input is refused before parsing', () => {
  const parse = JSON.parse
  JSON.parse = () => { throw new Error('parse must not run for an oversized record') }
  try {
    assert.throws(() => parseRecoveryRecord(' '.repeat(sourceRecordLimits.serializedRecovery + 1), workspaceId), tooLarge)
  } finally { JSON.parse = parse }
})

test('comparison export clones literal source, exact endings, BOM and Unicode without normalization', () => {
  const draftContent = '\ufeffé\r\nsecond\r😀'
  const currentContent = 'e\u0301\nsecond\n😀\n'
  const input = exported(draftContent, currentContent)
  const { payload, json } = createComparisonExport(input)
  assert.deepEqual(payload, input)
  assert.deepEqual(JSON.parse(json), input)
  assert.notEqual(payload, input)
  assert.notEqual(payload.comparison, input.comparison)
  assert.notEqual(payload.comparison.counts, input.comparison.counts)
  assert.notEqual(payload.comparison.rows[0], input.comparison.rows[0])
  assert.equal(payload.draftContent, draftContent)
  assert.equal(payload.currentContent, currentContent)
  assert.equal(payload.comparison.rows[0].draftEnding, 'CRLF')
  input.comparison.rows[0].draftText = 'mutated input'
  assert.equal(payload.comparison.rows[0].draftText, '\ufeffé')
  assert.deepEqual(createComparisonExport(exported('', '')).payload.comparison.rows, [])
})

test('export preserves row, text and input truncation flags from the actual bounded comparison', () => {
  const cases = [
    exported('draft\n'.repeat(300), 'current\n'.repeat(300)),
    exported('x'.repeat(1001), 'y'.repeat(1001)),
    exported('same\n'.repeat(10000) + 'draft tail', 'same\n'.repeat(10000) + 'current tail'),
  ]
  for (const input of cases) {
    const result = createComparisonExport(input)
    assert.deepEqual(result.payload.comparison, input.comparison)
    assert.equal(result.payload.comparison.truncated, true)
  }
  assert.equal(cases[0].comparison.counts.shownRows, 200)
  assert.equal(cases[0].comparison.counts.omittedRows, 100)
  assert.equal(cases[1].comparison.counts.textTruncatedRows, 1)
  assert.equal(cases[2].comparison.complete, false)
  assert.equal(cases[2].comparison.equal, null)
})

test('export rejects malformed roots and comparison fields rather than exporting private extras', () => {
  for (const input of [exported('a', 'b', { schemaVersion: 0 }), exported('a', 'b', { path: '../src/index.css' }),
    exported('a', 'b', { currentRevision: null }), exported('a', 'b', { loadedRevision: baseRevision + '\n' }),
    exported('a', 'b', { draftRevision: 'not hashed' }), exported('a', 'b', { privateToken: 'private fixture extra' })]) assert.throws(() => createComparisonExport(input), invalid)
  const mutators = [
    result => { result.comparison.extra = 'unsupported' },
    result => { result.comparison.algorithm = 'a different algorithm' },
    result => { result.comparison.algorithmLabel = 'a different label' },
    result => { result.comparison.counts.extra = true },
    result => { result.comparison.rows[0].extra = true },
    result => { result.comparison.rows[0].draftLine = 0 },
    result => { result.comparison.rows[0].draftEnding = 'HTML' },
    result => { result.comparison.rows[0].kind = 'current-only' },
    result => { result.comparison.rows[0].draftText = 'wrong content' },
    result => { result.comparison.rows[0].draftText = 'x'.repeat(1001) },
    result => { result.comparison.rows[0].draftLinePartial = true },
    result => { result.comparison.counts.shownRows = 0 },
    result => { result.comparison.counts.changedRows = -1 },
    result => { result.comparison.counts.inspectedDraftCharacters += 1 },
    result => { result.comparison.changedBlockCount = 0 },
    result => { result.comparison.complete = false },
    result => { result.comparison.equal = true },
    result => { result.comparison.truncated = true },
    result => { result.comparison.reasons = ['invented summary'] },
    result => { result.comparison.reasons = Array(7).fill('reason') },
    result => { result.comparison.reasons = ['x'.repeat(401)] },
  ]
  for (const mutate of mutators) {
    const input = exported('draft', 'current')
    mutate(input)
    assert.throws(() => createComparisonExport(input), error => error instanceof TypeError)
  }
  const tooMany = exported('d\n'.repeat(201), 'c\n'.repeat(201))
  tooMany.comparison.rows.push({ ...tooMany.comparison.rows[0] })
  assert.throws(() => createComparisonExport(tooMany), invalid)
  for (const field of ['draftText', 'currentText']) {
    const input = exported('draft', 'current')
    input.comparison.rows[0][field] = '{"token":"12345678"}'
    assert.throws(() => createComparisonExport(input), privateContent)
  }
  const privateReason = exported()
  privateReason.comparison.reasons = ['password = "12345678"']
  assert.throws(() => createComparisonExport(privateReason), privateContent)
})

test('escaped export overflow is refused before stringify even within content budgets', () => {
  const input = exported('\0'.repeat(sourceRecordLimits.characters), '')
  const stringify = JSON.stringify
  JSON.stringify = () => { throw new Error('stringify must not run for an oversized export') }
  try { assert.throws(() => createComparisonExport(input), tooLarge) }
  finally { JSON.stringify = stringify }
})

test('serialized-size estimation handles JSON escapes, surrogate pairs and lone surrogates exactly', () => {
  const text = '\b\t\n\f\r\0\u001f"\\😀\ud800\udc00\ud800x\udc00'
  const input = exported(text, '\ufeffdifferent')
  const result = createComparisonExport(input)
  assert.deepEqual(JSON.parse(result.json), input)
  const value = recovery({ baselineContent: text, draftDisplay: normalizeSourceDisplay(text) })
  assert.deepEqual(parseRecoveryRecord(JSON.stringify(createRecoveryRecord(value)), workspaceId), value)
})

test('DTO validation never invokes accessors, custom toJSON or source markup', () => {
  let sideEffects = 0
  const accessor = recovery()
  Object.defineProperty(accessor, 'baselineContent', { enumerable: true, get() { sideEffects += 1; return 'bad' } })
  assert.throws(() => createRecoveryRecord(accessor), invalid)
  assert.throws(() => createRecoveryRecord({ ...recovery(), toJSON() { sideEffects += 1; return recovery() } }), invalid)
  const arrayAccessor = exported()
  Object.defineProperty(arrayAccessor.comparison.rows, '0', { enumerable: true, get() { sideEffects += 1; return {} } })
  assert.throws(() => createComparisonExport(arrayAccessor), invalid)
  const extraArrayProperty = exported()
  extraArrayProperty.comparison.reasons.toJSON = () => { sideEffects += 1; return [] }
  assert.throws(() => createComparisonExport(extraArrayProperty), invalid)
  const malicious = '<script>sideEffects += 1</script><img src=x onerror="sideEffects++"> & ${literal}'
  assert.equal(createRecoveryRecord(recovery({ draftDisplay: malicious })).draftDisplay, malicious)
  const result = createComparisonExport(exported(malicious, 'current'))
  assert.equal(JSON.parse(result.json).draftContent, malicious)
  assert.equal(sideEffects, 0)
  const nullPrototype = Object.assign(Object.create(null), recovery())
  assert.deepEqual(createRecoveryRecord(nullPrototype), recovery())
  assert.throws(() => createRecoveryRecord(Object.assign(Object.create({ inherited: true }), recovery())), invalid)
  const symbol = recovery()
  symbol[Symbol('extra')] = true
  assert.throws(() => createRecoveryRecord(symbol), invalid)
})

test('module has no storage, transport, DOM, hashing or ambient clock operations', () => {
  const source = readFileSync(new URL('../Website/source-draft-records.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\b(?:fetch|document|window|localStorage|sessionStorage|writeFile|createHash|eval)\s*(?:\(|\.)/)
  assert.doesNotMatch(source, /Date\.now\s*\(|new Date\s*\(\s*\)|from ['"](?:node:|https?:)/)
})
