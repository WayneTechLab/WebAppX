#!/usr/bin/env node
import { trackedInventory } from '../.SYSTEMX/LAN/Builder/importer/tracked-inventory.mjs'

const [action = 'scan', ...args] = process.argv.slice(2)
const usage = 'Usage: node scripts/lan-repository-inventory.mjs [scan|compare|last-good] [--root DIR] [--budget-ms N]'
function run() {
  if (action === '--help' && !args.length) {
    console.log(`${usage}

scan       Compare with the retained inventory and accept a complete validated result.
compare    Compare eligible resources and report staged, unstaged and untracked source effects without accepting.
last-good  Read this checkout's most recent complete inventory from private Git metadata.

The scan covers Vite entries, routes, component exports, shared shells and declared package, runtime, build, bridge and Firebase configuration.
A partial or refused scan exits 1 and retains the last accepted revision. Work budgets are included in the JSON output.
Install the tool checkout's normal development dependencies to enable the TypeScript parser.`)
    return
  }
  let root, elapsedMs
  function invalid() { console.error(usage); process.exitCode = 2 }
  if (!['scan','compare','last-good'].includes(action) || args.length % 2) return invalid()
  for (let i=0; i<args.length; i+=2) {
    const key = args[i], value = args[i+1]
    if (key === '--root' && root === undefined && value && !value.startsWith('--')) root = value
    else if (key === '--budget-ms' && action !== 'last-good' && elapsedMs === undefined && /^(?:[1-9][0-9]{0,4})$/.test(value) && Number(value) <= 15000) elapsedMs = Number(value)
    else return invalid()
  }
  const result = trackedInventory(root ?? process.cwd(), action, {elapsedMs})
  console.log(JSON.stringify(result, null, 2))
  if (result.status === 'incomplete' || result.status === 'refused') process.exitCode = 1
}
run()
