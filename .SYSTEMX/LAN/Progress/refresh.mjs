import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { runCli } from '../../../scripts/lan-backlog.mjs'

const { values: options } = parseArgs({ options: {
  check: { type: 'boolean', default: false }, repo: { type: 'string' },
  'preview-dir': { type: 'string' }, help: { type: 'boolean', default: false },
} })
if (options.help) {
  console.log('node .SYSTEMX/LAN/Progress/refresh.mjs [--check] [--repo DIRECTORY] [--preview-dir DIRECTORY]\nUses @oai/artifact-tool from the Node runtime. Refresh preserves the Owner and Next action columns by requirement ID.')
  process.exit(0)
}
const require = createRequire(import.meta.url)
const { Workbook, SpreadsheetFile, FileBlob } = await import(pathToFileURL(require.resolve('@oai/artifact-tool')))
const root = resolve(options.repo ?? fileURLToPath(new URL('../../../', import.meta.url)))
const directory = join(root, '.SYSTEMX/LAN/Progress')
const destination = join(directory, 'LAN-10000-Progress.xlsx')
const catalogPath = 'docs/backlog/lan-10000.json'
const ledgerPath = 'docs/backlog/lan-10000-progress.json'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const [catalogBytes, ledgerBytes] = await Promise.all([catalogPath, ledgerPath].map(file => readFile(join(root, file))))
const totals = await runCli(['--check'], { publicRoot: root, output: () => {} })
const { items, lanes } = JSON.parse(catalogBytes)
const catalogStamp = 'Catalog SHA-256   ' + sha(catalogBytes)
const ledgerStamp = 'Ledger SHA-256   ' + sha(ledgerBytes)
const accepts = new Set(items.filter(item => item.status === 'done').map(item => item.id))
const capabilities = new Map(), families = new Map()
const dateSerial = date => Date.parse(date + 'T00:00:00Z') / 86400000 + 25569
for (const item of items) {
  const key = item.familyId + '/' + item.capabilityKey
  capabilities.set(key, (capabilities.get(key) ?? 0) + Number(accepts.has(item.id)))
  if (!families.has(item.familyId)) families.set(item.familyId, { name: item.familyName, gate: item.gate })
}
const entries = items.map(item => {
  const unmet = item.dependsOn.filter(id => !accepts.has(id))
  const status = accepts.has(item.id) ? 'Accepted' : unmet.length ? 'Waiting' : 'Ready'
  const count = capabilities.get(item.familyId + '/' + item.capabilityKey)
  const result = item.lane !== lanes[0] ? null : count === lanes.length ? 'Complete' : count ? 'Partial' : 'Open'
  const c = item.completion
  return [item.id, item.familyId, item.capabilityTitle, item.lane, status, item.gate, item.priority,
    null, null, c ? dateSerial(c.verifiedOn) : null, c?.evidence ?? null, c?.sourceRevision ?? null,
    result, unmet.length, unmet[0] ?? null, item.phase, c?.reviewedBy ?? null]
})
const criteria = items.map(item => [item.id, item.acceptance, item.dependsOn.join(', '), item.definitionSha256])
const last = 4 + items.length, familyLast = 10 + families.size
const titleFont = { name: 'Calibri', bold: true, size: 22, color: '#12324A' }
const palette = { navy: '#163D56', teal: '#087C78', ink: '#17394C', pale: '#EDF7F5' }
const reqHeaders = ['Requirement ID', 'Family', 'Capability', 'Lane', 'Status', 'Gate', 'Priority', 'Owner', 'Next action',
  'Verified on', 'Evidence file', 'Reviewed source revision', 'Capability result', 'Unmet count', 'First unmet ID', 'Phase', 'Reviewer']
const familyHeaders = ['Family', 'Capability family', 'Gate', 'Accepted', 'Ready', 'Waiting', 'Accepted %', 'Complete capabilities']
const criteriaHeaders = ['Requirement ID', 'Original acceptance criterion', 'Direct prerequisites', 'Definition SHA-256']

async function currentBytes() {
  try { return await readFile(destination) } catch (error) { if (error.code !== 'ENOENT') throw error; return null }
}
const existing = await currentBytes()
const records = list => new Map(list.map(row => [row[0], row]))
const textOrBlank = value => value == null || value === '' || typeof value === 'string' && value.length <= 32767

function readPlanning(book) {
  const sheet = book.worksheets.getItem('Requirements')
  const grid = sheet.tables.getItem('LANRequirements').getDataRows(), previous = new Map()
  const headers = sheet.tables.getItem('LANRequirements').getHeaderRowRange().values[0]
  const id = headers.indexOf('Requirement ID'), owner = headers.indexOf('Owner'), action = headers.indexOf('Next action')
  assert.ok([id, owner, action].every(n => n >= 0), 'Cannot identify the original planning columns.')
  const ownerFormulas = sheet.getRangeByIndexes(4, owner, grid.length, 1).formulas
  const actionFormulas = sheet.getRangeByIndexes(4, action, grid.length, 1).formulas
  for (const [i, row] of grid.entries()) {
    assert.ok(typeof row[id] === 'string' && !previous.has(row[id]), 'Duplicate or missing requirement ID in the existing tracker.')
    assert.ok([row[owner], row[action]].every(textOrBlank) && !ownerFormulas[i][0] && !actionFormulas[i][0], 'Owner and Next action must contain plain text.')
    previous.set(row[id], [row[owner] || null, row[action] || null])
  }
  const known = new Set(items.map(row => row.id))
  for (const [id, note] of previous) {
    assert.ok(known.has(id) || !note.some(Boolean), 'An unmatched requirement has planning notes. Move those notes before refreshing.')
  }
  return previous
}

function verify(book) {
  const dashboard = book.worksheets.getItem('Progress'), sheet = book.worksheets.getItem('Requirements')
  const definitions = book.worksheets.getItem('Criteria')
  assert.equal(sheet.getRange('A3').values[0][0], ledgerStamp, 'Tracker has a different ledger SHA-256.')
  assert.equal(definitions.getRange('A3').values[0][0], catalogStamp, 'Tracker has a different catalog SHA-256.')
  const tableData = (tab, name, headers) => {
    const table = tab.tables.getItem(name)
    assert.deepEqual(table.getHeaderRowRange().values[0], headers)
    const rows = table.getDataRows()
    assert.equal(rows.length, name === 'LANFamilies' ? families.size : items.length, 'Unexpected table size in ' + name)
    return rows
  }
  const actual = records(tableData(sheet, 'LANRequirements', reqHeaders))
  const source = records(tableData(definitions, 'LANCriteria', criteriaHeaders))
  assert.equal(actual.size, items.length)
  assert.equal(source.size, items.length)
  const clean = value => value == null || value === '' ? null : value
  for (let i = 0; i < entries.length; i++) {
    const row = entries[i], found = actual.get(row[0])
    assert.ok(found, 'Missing requirement ' + row[0])
    for (let col = 0; col < row.length; col++) {
      if (col !== 7 && col !== 8) assert.equal(clean(found[col]), clean(row[col]), row[0] + ' ' + reqHeaders[col])
    }
    assert.deepEqual(source.get(row[0]).map(clean), criteria[i].map(clean), 'Original definition differs for ' + row[0])
  }
  const familyRows = tableData(dashboard, 'LANFamilies', familyHeaders)
  assert.equal(new Set(familyRows.map(row => row[0])).size, families.size)
  const counts = new Map([...families.keys()].map(id => [id, { Accepted: 0, Ready: 0, Waiting: 0, complete: 0 }]))
  for (const row of entries) { counts.get(row[1])[row[4]]++; if (row[12] === 'Complete') counts.get(row[1]).complete++ }
  for (const [id, name, gate, done, ready, waiting, percent, complete] of familyRows) {
    const expected = counts.get(id)
    assert.deepEqual([name, gate, done, ready, waiting, complete], [families.get(id).name, families.get(id).gate, expected.Accepted, expected.Ready, expected.Waiting, expected.complete])
    assert.equal(percent, done / (done + ready + waiting))
  }
  for (const [cell, value] of Object.entries({
    A5: totals.requirements.done, C5: totals.requirements.todo, E5: totals.capabilities.done, G5: totals.requirements.done / items.length,
  })) assert.equal(dashboard.getRange(cell).values[0][0], value, 'Incorrect dashboard total in ' + cell)
}

if (options.check) {
  assert.ok(existing, 'The progress workbook is missing.')
  const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(destination))
  verify(saved)
  console.log('Tracker verified against ' + items.length + ' original requirements and ' + families.size + ' families.')
  process.exit(0)
}
const plans = existing ? readPlanning(await SpreadsheetFile.importXlsx(await FileBlob.load(destination))) : new Map()
const book = Workbook.create()
const dashboard = book.worksheets.add('Progress'), sheet = book.worksheets.add('Requirements'), definitions = book.worksheets.add('Criteria')
for (const tab of [dashboard, sheet, definitions]) tab.showGridLines = false
dashboard.tabColor = palette.navy
sheet.tabColor = palette.teal
function label(tab, address, value, font) {
  const range = tab.getRange(address)
  range.merge()
  tab.getRange(address.split(':')[0]).values = [[value]]
  if (font) range.format.font = font
}
function widths(tab, pixels) {
  for (const [i, width] of pixels.entries()) tab.getCell(0, i).format.columnWidthPx = width
}
function makeTable(tab, row, headers, data, name) {
  tab.getRangeByIndexes(row - 1, 0, 1, headers.length).values = [headers]
  tab.getRangeByIndexes(row, 0, data.length, headers.length).values = data
  const range = tab.getRangeByIndexes(row - 1, 0, data.length + 1, headers.length)
  const table = tab.tables.add(range, true, name)
  table.style = 'TableStyleMedium2'
  table.showFilterButton = true
  const header = table.getHeaderRowRange()
  header.format.fill = palette.navy
  header.format.font = { name: 'Calibri', size: 11, bold: true, color: '#FFFFFF' }
  header.format.rowHeight = 24
}

widths(dashboard, [100, 360, 114, 112, 105, 108, 120, 180])
widths(sheet, [141, 90, 365, 125, 118, 105, 85, 155, 325, 130, 475, 325, 165, 127, 145, 145, 125])
widths(definitions, [143, 725, 940, 510])
label(dashboard, 'A2:H2', 'WebAppX LAN delivery progress', titleFont)
dashboard.getRange('A2:H2').format.rowHeight = 34
const cards = [
  ['A', 'B', 'Accepted requirements', '=SUM(D11:D' + familyLast + ')'],
  ['C', 'D', 'Remaining requirements', '=SUM(E11:F' + familyLast + ')'],
  ['E', 'F', 'Completed capabilities', '=SUM(H11:H' + familyLast + ')'],
  ['G', 'H', 'Overall completion', '=A5/(A5+C5)'],
]
for (const [left, right, text, formula] of cards) {
  label(dashboard, left + '4:' + right + '4', text, { name: 'Calibri', color: palette.ink, bold: true, size: 11 })
  const field = dashboard.getRange(left + '5:' + right + '5')
  field.merge()
  dashboard.getRange(left + '5').formulas = [[formula]]
  field.format.font = { name: 'Calibri', bold: true, size: 24, color: palette.teal }
  field.format.numberFormat = left === 'G' ? '0.0%' : '#,##0'
}
dashboard.getRange('A4:H5').format.fill = palette.pale
dashboard.getRange('A5:H5').format.rowHeight = 37
label(dashboard, 'A7:H7', 'Ready means every direct prerequisite is accepted. Waiting means at least one prerequisite is open.')
label(dashboard, 'A8:H8', 'The goal covers 10,000 requirements and 2,000 capabilities. All five requirements must be accepted to complete a capability.')
const familyData = [...families].map(([id, family]) => [id, family.name, family.gate, null, null, null, null, null])
makeTable(dashboard, 10, familyHeaders, familyData, 'LANFamilies')
dashboard.getRange('G11:G' + familyLast).setNumberFormat('0%')
dashboard.getRange('G11:G' + familyLast).conditionalFormats.add('dataBar', {
  color: '#AFD9CF', thresholds: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }],
})
const formulas = familyData.map((_, i) => {
  const row = i + 11
  const count = (column, status) => '=COUNTIFS(Requirements!$B$5:$B$' + last + ',$A' + row + ',Requirements!$' + column + '$5:$' + column + '$' + last + ',"' + status + '")'
  return [count('E', 'Accepted'), count('E', 'Ready'), count('E', 'Waiting'), '=D' + row + '/SUM(D' + row + ':F' + row + ')', count('M', 'Complete')]
})
label(sheet, 'A1:I1', 'Requirement status and planning', titleFont)
label(sheet, 'A2:I2', 'Edit Owner and Next action. Refresh restores reviewed status and evidence and keeps planning text with its requirement ID.')
label(sheet, 'A3:I3', ledgerStamp, { name: 'Calibri', size: 9, color: '#486473' })
label(definitions, 'A1:B1', 'Original LAN acceptance criteria', titleFont)
label(definitions, 'A2:B2', 'Source files    ' + catalogPath + '    and    ' + ledgerPath)
label(definitions, 'A3:B3', catalogStamp, { name: 'Calibri', size: 9, color: '#486473' })
for (const tab of [sheet, definitions]) {
  tab.getRange('A1').format.rowHeight = 34
  tab.getRange('A2:A3').format.rowHeight = 17
  tab.freezePanes.freezeRows(4)
  tab.freezePanes.freezeColumns(1)
}
const editable = text => typeof text === 'string' && text.startsWith('=') ? "'" + text : text
for (const row of entries) {
  const plan = plans.get(row[0])
  if (plan) { row[7] = editable(plan[0]); row[8] = editable(plan[1]) }
}
makeTable(sheet, 4, reqHeaders, entries, 'LANRequirements')
makeTable(definitions, 4, criteriaHeaders, criteria, 'LANCriteria')
sheet.getRange('J5:J' + last).setNumberFormat('yyyy-mm-dd')
sheet.getRange('H5:I' + last).format.font.color = '#1355A0'
sheet.getRange('E5:E' + last).conditionalFormats.add('containsText', {
  text: 'Ready', format: { fill: '#FFF0BC', font: { bold: true, color: '#6B4300' } },
})
definitions.getRange('B5:C' + last).format.wrapText = true
definitions.getRange('A5:D' + last).format.verticalAlignment = 'top'
definitions.getRange('A5:A' + last).format.rowHeight = 96
dashboard.getRange('D11:H' + familyLast).formulas = formulas
book.recalculate()
verify(book)
if (options['preview-dir']) {
  await mkdir(options['preview-dir'], { recursive: true })
  for (const [sheetName, range] of [['Progress', 'A1:H25'], ['Requirements', 'A1:I12'], ['Criteria', 'A1:B8']]) {
    const png = await book.render({ sheetName, range, scale: 1, format: 'png' })
    await writeFile(join(options['preview-dir'], sheetName + '.png'), new Uint8Array(await png.arrayBuffer()))
  }
}
await mkdir(directory, { recursive: true })
const stage = await mkdtemp(join(dirname(destination), '.progress-'))
try {
  const tempFile = join(stage, 'workbook.xlsx')
  await (await SpreadsheetFile.exportXlsx(book)).save(tempFile)
  const fresh = await currentBytes()
  assert.ok(existing === null ? fresh === null : fresh !== null && sha(existing) === sha(fresh), 'The workbook changed during refresh. Retry against the current copy.')
  assert.equal(sha(await readFile(join(root, ledgerPath))), sha(ledgerBytes), 'The ledger changed during refresh.')
  assert.equal(sha(await readFile(join(root, catalogPath))), sha(catalogBytes), 'The catalog changed during refresh.')
  await rename(tempFile, destination)
} finally { await rm(stage, { recursive: true, force: true }) }
console.log('Saved ' + destination + ' with ' + items.length + ' requirements and ' + accepts.size + ' accepted.')
