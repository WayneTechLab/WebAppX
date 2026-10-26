// Bounded presentation metadata only. Callers render returned text as text.
export const sourceComparisonLimits = Object.freeze({
  characters: 500000,
  lines: 10000,
  changedRows: 200,
  text: 1000,
})

const highSurrogate = (value) => value >= 0xd800 && value <= 0xdbff
const lowSurrogate = (value) => value >= 0xdc00 && value <= 0xdfff

function inspectLines(source) {
  let end = Math.min(source.length, sourceComparisonLimits.characters)
  // A partial input must not introduce a broken surrogate pair into the view.
  if (end < source.length && highSurrogate(source.charCodeAt(end - 1))) end -= 1
  const lines = []
  let cursor = 0
  let start = 0
  while (cursor < end && lines.length < sourceComparisonLimits.lines) {
    const code = source.charCodeAt(cursor)
    if (code !== 10 && code !== 13) { cursor += 1; continue }
    const textEnd = cursor
    let ending = code === 10 ? 'LF' : 'CR'
    let partial = false
    cursor += 1
    if (code === 13 && cursor < end && source.charCodeAt(cursor) === 10) {
      ending = 'CRLF'
      cursor += 1
    } else if (code === 13 && cursor === end && end < source.length) {
      // The next uninspected character could be LF; do not call this lone CR.
      ending = 'unknown'
      partial = true
    }
    lines.push({ text: source.slice(start, textEnd), ending, partial })
    start = cursor
  }
  if (lines.length < sourceComparisonLimits.lines && start < cursor) {
    const partial = cursor < source.length
    lines.push({ text: source.slice(start, cursor), ending: partial ? 'unknown' : 'none', partial })
  }
  return {
    lines,
    inspectedCharacters: cursor,
    uninspectedCharacters: source.length - cursor,
    characterLimited: end < source.length && cursor === end,
    lineLimited: lines.length === sourceComparisonLimits.lines && cursor < end,
    complete: cursor === source.length,
  }
}

function sameLine(left, right) {
  return left.text === right.text && left.ending === right.ending && left.partial === right.partial
}

function displayText(line) {
  if (!line) return { text: '', truncated: false }
  if (line.text.length <= sourceComparisonLimits.text) return { text: line.text, truncated: false }
  let end = sourceComparisonLimits.text
  if (highSurrogate(line.text.charCodeAt(end - 1)) && lowSurrogate(line.text.charCodeAt(end))) end -= 1
  return { text: line.text.slice(0, end), truncated: true }
}

/**
 * Trim equal line prefixes/suffixes, then compare the remaining lines by
 * position. This is linear in the bounded input, not a minimal edit/LCS diff.
 * A line owns its terminator; a trailing newline adds no empty extra record.
 * Budgets count UTF-16 code units. No input normalization, DOM or I/O occurs.
 */
export function compareSourceText(draft, current) {
  if (typeof draft !== 'string' || typeof current !== 'string') {
    throw new TypeError('Source comparison requires two strings.')
  }
  const left = inspectLines(draft)
  const right = inspectLines(current)
  const reasons = []
  for (const [name, inspection] of [['Draft', left], ['Current', right]]) {
    if (inspection.characterLimited) reasons.push(name + ' inspection limited to ' + sourceComparisonLimits.characters + ' UTF-16 code units.')
    if (inspection.lineLimited) reasons.push(name + ' inspection limited to ' + sourceComparisonLimits.lines + ' lines.')
  }
  let prefix = 0
  const commonLength = Math.min(left.lines.length, right.lines.length)
  while (prefix < commonLength && sameLine(left.lines[prefix], right.lines[prefix])) prefix += 1
  let suffix = 0
  while (suffix < commonLength - prefix
    && sameLine(left.lines[left.lines.length - suffix - 1], right.lines[right.lines.length - suffix - 1])) suffix += 1
  const draftMiddle = left.lines.length - prefix - suffix
  const currentMiddle = right.lines.length - prefix - suffix
  const rows = []
  let changedRows = 0
  let changedBlockCount = 0
  let textTruncatedRows = 0
  let previousChanged = false
  for (let index = 0; index < Math.max(draftMiddle, currentMiddle); index += 1) {
    const draftLine = index < draftMiddle ? left.lines[prefix + index] : null
    const currentLine = index < currentMiddle ? right.lines[prefix + index] : null
    if (draftLine && currentLine && sameLine(draftLine, currentLine)) { previousChanged = false; continue }
    changedRows += 1
    if (!previousChanged) changedBlockCount += 1
    previousChanged = true
    if (rows.length >= sourceComparisonLimits.changedRows) continue
    const draftDisplay = displayText(draftLine)
    const currentDisplay = displayText(currentLine)
    if (draftDisplay.truncated || currentDisplay.truncated) textTruncatedRows += 1
    rows.push({
      draftLine: draftLine ? prefix + index + 1 : null,
      currentLine: currentLine ? prefix + index + 1 : null,
      draftText: draftDisplay.text,
      currentText: currentDisplay.text,
      draftEnding: draftLine?.ending ?? null,
      currentEnding: currentLine?.ending ?? null,
      kind: !draftLine ? 'current-only' : !currentLine ? 'draft-only' : 'replace',
      draftTextTruncated: draftDisplay.truncated,
      currentTextTruncated: currentDisplay.truncated,
      draftLinePartial: draftLine?.partial ?? false,
      currentLinePartial: currentLine?.partial ?? false,
    })
  }
  const omittedRows = changedRows - rows.length
  if (omittedRows) reasons.push('Showing the first ' + rows.length + ' of ' + changedRows + ' inspected changed rows; ' + omittedRows + ' rows omitted.')
  if (textTruncatedRows) reasons.push('Changed line text is limited to ' + sourceComparisonLimits.text + ' UTF-16 code units per side; ' + textTruncatedRows + ' shown rows contain clipped text.')
  const complete = left.complete && right.complete
  return {
    algorithm: 'common-prefix-suffix-positional',
    algorithmLabel: 'Positional lines after common prefix/suffix trimming; not a minimal edit diff.',
    equal: complete ? changedRows === 0 : null,
    complete,
    changedBlockCount,
    rows,
    counts: {
      changedRows,
      shownRows: rows.length,
      omittedRows,
      inspectedDraftCharacters: left.inspectedCharacters,
      inspectedCurrentCharacters: right.inspectedCharacters,
      inspectedDraftLines: left.lines.length,
      inspectedCurrentLines: right.lines.length,
      uninspectedDraftCharacters: left.uninspectedCharacters,
      uninspectedCurrentCharacters: right.uninspectedCharacters,
      textTruncatedRows,
    },
    reasons,
    truncated: !complete || omittedRows > 0 || textTruncatedRows > 0,
  }
}
