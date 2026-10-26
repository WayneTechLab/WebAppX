import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { compareSourceText, sourceComparisonLimits } from '../Website/source-comparison.js'

test('equal strings, empty input and unchanged large lines emit no content rows', () => {
  for (const text of ['', 'single line', 'first\r\nsecond\nthird\rlast', 'x'.repeat(500000)]) {
    const result = compareSourceText(text, text)
    assert.equal(result.equal, true)
    assert.equal(result.complete, true)
    assert.equal(result.truncated, false)
    assert.deepEqual(result.rows, [])
    assert.equal(result.changedBlockCount, 0)
    assert.equal(result.counts.changedRows, 0)
  }
  assert.equal(compareSourceText('', '').counts.inspectedDraftLines, 0)
  assert.equal(compareSourceText('a\n', 'a\n').counts.inspectedDraftLines, 1)
})

test('prefix and suffix trimming exposes inserted and removed lines with original line numbers', () => {
  const added = compareSourceText('first\nlast\n', 'first\ninserted\nlast\n')
  assert.equal(added.rows.length, 1)
  assert.deepEqual(added.rows[0], {
    draftLine: null, currentLine: 2, draftText: '', currentText: 'inserted',
    draftEnding: null, currentEnding: 'LF', kind: 'current-only',
    draftTextTruncated: false, currentTextTruncated: false, draftLinePartial: false, currentLinePartial: false,
  })
  const removed = compareSourceText('first\nremoved\nlast\n', 'first\nlast\n')
  assert.equal(removed.rows[0].kind, 'draft-only')
  assert.equal(removed.rows[0].draftLine, 2)
  assert.equal(removed.rows[0].currentLine, null)
  assert.equal(removed.rows[0].draftText, 'removed')
  assert.equal(removed.changedBlockCount, 1)
})

test('positional replacements skip equal middle lines and count each changed block', () => {
  const result = compareSourceText('prefix\nold one\nsame\nold two\nsuffix\n', 'prefix\nnew one\nsame\nnew two\nsuffix\n')
  assert.equal(result.algorithm, 'common-prefix-suffix-positional')
  assert.match(result.algorithmLabel, /not a minimal edit diff/)
  assert.equal(result.equal, false)
  assert.equal(result.changedBlockCount, 2)
  assert.deepEqual(result.rows.map(row => [row.draftLine, row.currentLine, row.draftText, row.currentText, row.kind]),
    [[2, 2, 'old one', 'new one', 'replace'], [4, 4, 'old two', 'new two', 'replace']])
})

test('CRLF, LF, lone CR and missing final terminators remain distinct', () => {
  const result = compareSourceText('a\r\nb\r\nc\rd', 'a\nb\nc\nd\n')
  assert.equal(result.rows.length, 4)
  assert.deepEqual(result.rows.map(row => [row.draftText, row.currentText, row.draftEnding, row.currentEnding]),
    [['a', 'a', 'CRLF', 'LF'], ['b', 'b', 'CRLF', 'LF'], ['c', 'c', 'CR', 'LF'], ['d', 'd', 'none', 'LF']])
  assert.equal(result.changedBlockCount, 1)
  assert.equal(compareSourceText('\r', '\r').equal, true)
  assert.equal(compareSourceText('\r\n', '\n').rows[0].draftEnding, 'CRLF')
})

test('BOM, Unicode forms and malicious markup stay literal and are never normalized', () => {
  const malicious = '<script>alert("fixture")</script><img src=x onerror=evil()> & ' + '$' + '{secret}'
  const result = compareSourceText(malicious, '\ufeff' + malicious)
  assert.equal(result.rows[0].draftText, malicious)
  assert.equal(result.rows[0].currentText, '\ufeff' + malicious)
  assert.equal(compareSourceText('é', 'e\u0301').equal, false)
  assert.equal(compareSourceText('😀', '😀').equal, true)
  assert.throws(() => compareSourceText({}, ''), TypeError)
  assert.throws(() => compareSourceText('', null), TypeError)
})

test('character inspection stops at its fixed budget and never asserts equality for an unseen tail', () => {
  const samePrefix = 'a'.repeat(sourceComparisonLimits.characters)
  const result = compareSourceText(samePrefix + 'tail one', samePrefix + 'tail two')
  assert.equal(result.equal, null)
  assert.equal(result.complete, false)
  assert.equal(result.truncated, true)
  assert.equal(result.counts.inspectedDraftCharacters, 500000)
  assert.equal(result.counts.uninspectedDraftCharacters, 8)
  assert.deepEqual(result.rows, [])
  assert.ok(result.reasons.every(reason => /500000 UTF-16 code units/.test(reason)))
  const cutCRLF = compareSourceText('x'.repeat(499999) + '\r\n', '')
  assert.equal(cutCRLF.rows[0].draftEnding, 'unknown')
  assert.equal(cutCRLF.rows[0].draftLinePartial, true)
  assert.equal(cutCRLF.counts.inspectedDraftCharacters, 500000)
  const exactCR = compareSourceText('x'.repeat(499999) + '\r', '')
  assert.equal(exactCR.rows[0].draftEnding, 'CR')
  assert.equal(exactCR.rows[0].draftLinePartial, false)
  assert.equal(exactCR.complete, true)
})

test('line inspection completes exactly at its limit but reports any uninspected next line', () => {
  const atLimit = 'x\n'.repeat(sourceComparisonLimits.lines)
  const exact = compareSourceText(atLimit, atLimit)
  assert.equal(exact.complete, true)
  assert.equal(exact.equal, true)
  assert.equal(exact.counts.inspectedDraftLines, 10000)
  const limited = compareSourceText(atLimit + 'unseen A', atLimit + 'unseen B')
  assert.equal(limited.complete, false)
  assert.equal(limited.equal, null)
  assert.equal(limited.counts.inspectedDraftCharacters, 20000)
  assert.equal(limited.counts.uninspectedDraftCharacters, 8)
  assert.ok(limited.reasons.every(reason => /10000 lines/.test(reason)))
})

test('changed-row output is capped while full inspected change and block counts continue', () => {
  const draft = Array.from({ length: 1000 }, (_, index) => 'draft ' + index + '\n').join('')
  const current = Array.from({ length: 1000 }, (_, index) => 'current ' + index + '\n').join('')
  const result = compareSourceText(draft, current)
  assert.equal(result.complete, true)
  assert.equal(result.equal, false)
  assert.equal(result.rows.length, 200)
  assert.equal(result.counts.changedRows, 1000)
  assert.equal(result.counts.shownRows, 200)
  assert.equal(result.counts.omittedRows, 800)
  assert.equal(result.changedBlockCount, 1)
  assert.equal(result.truncated, true)
  assert.match(result.reasons.join(' '), /800 rows omitted/)
})

test('line text is compared before cropping and text caps do not split surrogate pairs', () => {
  const prefix = 'x'.repeat(sourceComparisonLimits.text)
  const result = compareSourceText(prefix + 'draft', prefix + 'current')
  assert.equal(result.equal, false)
  assert.equal(result.rows[0].draftText, prefix)
  assert.equal(result.rows[0].currentText, prefix)
  assert.equal(result.rows[0].draftTextTruncated, true)
  assert.equal(result.rows[0].currentTextTruncated, true)
  assert.equal(result.counts.textTruncatedRows, 1)
  assert.equal(result.complete, true)
  const unicode = compareSourceText('x'.repeat(999) + '😀' + 'a', '')
  assert.equal(unicode.rows[0].draftText.length, 999)
  assert.equal(unicode.rows[0].draftText.endsWith('\ud83d'), false)
  const inputCut = compareSourceText('x'.repeat(499999) + '😀' + 'tail', '')
  assert.equal(inputCut.counts.inspectedDraftCharacters, 499999)
  assert.equal(inputCut.rows[0].draftLinePartial, true)
})

test('fixed budgets and source structure exclude a quadratic alignment matrix or hidden I/O', () => {
  assert.deepEqual(sourceComparisonLimits, { characters: 500000, lines: 10000, changedRows: 200, text: 1000 })
  assert.equal(Object.isFrozen(sourceComparisonLimits), true)
  const source = readFileSync(new URL('../Website/source-comparison.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\b(?:fetch|document|window|localStorage|writeFile|createHash)\s*(?:\(|\.)/)
  assert.doesNotMatch(source, /Array\s*\([^)]*\)\s*\.fill|\.map\([^\n]*Array|new\s+(?:Uint\d*Array|Int\d*Array|Float\d*Array)/)
  const wide = 'same\n'.repeat(9999) + 'draft end'
  const compared = compareSourceText(wide, 'other\n'.repeat(9999) + 'current end')
  assert.equal(compared.counts.changedRows, 10000)
  assert.equal(compared.rows.length, 200)
})
