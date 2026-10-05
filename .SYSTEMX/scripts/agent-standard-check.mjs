#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()

const requiredFiles = [
  '.SYSTEMX/AI/README.md',
  '.SYSTEMX/AI/AGENT-MESH-STANDARD.md',
  '.SYSTEMX/AI/TOOLCALLING-AND-BROWSER-AUTOMATION.md',
  '.SYSTEMX/AI/EXTERNAL-SERVICE-CONNECTOR-STANDARD.md',
  '.SYSTEMX/AI/RECOVERY-PLAYBOOK.md',
  '.SYSTEMX/AI/agent-mesh.schema.json',
]

for (const relativeFile of requiredFiles) {
  const file = path.join(rootDir, relativeFile)
  if (!existsSync(file)) {
    throw new Error(`Missing SYSTEMX AI standard file: ${relativeFile}`)
  }
}

JSON.parse(readFileSync(path.join(rootDir, '.SYSTEMX/AI/agent-mesh.schema.json'), 'utf8'))

console.log('[SYSTEMX] AI standard file/schema check passed; managed integrity is checked by systemx:status')
