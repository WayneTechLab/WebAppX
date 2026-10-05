#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const standard = '.SYSTEMX/Unified-Setup-Process/standards/WSG-Account-Levels.md'
const filesToScan = [
  standard,
  '.SYSTEMX/Unified-Setup-Process/standards/Unified-Login.md',
  '.SYSTEMX/Unified-Setup-Process/steps/10-security-governance.md',
  '.SYSTEMX/Unified-Setup-Process/steps/12-ci-mcp-qa-automation.md',
  'src/auth/accountLevels.ts',
  'src/auth/useAccountLevel.ts',
  'src/pages/LoginPage.tsx',
  'firestore.rules',
  'storage.rules',
  'scripts/setup/seed-test-users.mjs',
]

const requiredIdentities = [
  'Test-SU@',
  'Test-Admin@',
  'Test-Pro@',
  'Test-User_Paid@',
  'Test-User_Free@',
  'Test-User_Public@',
]

const requiredLevels = ['Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5']

function read(relativePath) {
  const target = path.join(root, relativePath)
  return existsSync(target) ? readFileSync(target, 'utf8') : ''
}

let failed = false
const standardText = read(standard)

if (!standardText) {
  console.error(`[WSG] Missing account-level standard: ${standard}`)
  process.exit(1)
}

for (const level of requiredLevels) {
  if (!standardText.includes(level)) {
    console.error(`[WSG] Missing account level in standard: ${level}`)
    failed = true
  }
}

for (const identity of requiredIdentities) {
  if (!standardText.includes(identity)) {
    console.error(`[WSG] Missing test identity in standard: ${identity}`)
    failed = true
  }
}

const combined = filesToScan.map(read).join('\n')
for (const phrase of ['Firebase', 'Playwright', 'Unified Login', 'custom claims']) {
  if (!combined.includes(phrase)) {
    console.error(`[WSG] Account/login standard missing expected phrase: ${phrase}`)
    failed = true
  }
}

for (const file of filesToScan.slice(4)) {
  if (!read(file)) {
    console.error(`[WSG] Missing working account-level surface: ${file}`)
    failed = true
  }
}

const rules = read('firestore.rules')
for (const phrase of ['accountLevel()', 'hasMinLevel', 'adminUsers']) {
  if (!rules.includes(phrase)) {
    console.error(`[WSG] Firestore rules missing account-level helper: ${phrase}`)
    failed = true
  }
}

if (failed) process.exit(1)

console.log('[WSG] Account-level standard check passed')
