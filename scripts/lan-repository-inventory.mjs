#!/usr/bin/env node
import { trackedInventory } from '../.SYSTEMX/LAN/Builder/importer/tracked-inventory.mjs'

const [action = 'scan', flag, root, ...extra] = process.argv.slice(2)
const usage = 'Usage: node scripts/lan-repository-inventory.mjs [scan|last-good] [--root DIR]'
if (action === '--help' && flag === undefined) {
  console.log(`${usage}

scan       Inspect tracked Vite modules and supported route declarations in the selected checkout.
last-good  Show the most recent complete inventory from this checkout’s private Git metadata.

Output is JSON. A partial or refused scan exits 1 and retains the last good revision.
Install the tool checkout’s normal development dependencies to enable the TypeScript parser.`)
} else if (!['scan', 'last-good'].includes(action) || (flag !== undefined && (flag !== '--root' || !root)) || extra.length) {
  console.error(usage)
  process.exitCode = 2
} else {
  const result = trackedInventory(root ?? process.cwd(), action)
  console.log(JSON.stringify(result, null, 2))
  if (result.status === 'incomplete' || result.status === 'refused') process.exitCode = 1
}
