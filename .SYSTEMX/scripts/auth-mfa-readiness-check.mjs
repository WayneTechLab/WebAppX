#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
let failures = 0
let warnings = 0

function read(relativePath) {
  const target = path.join(root, relativePath)
  return existsSync(target) ? readFileSync(target, 'utf8') : ''
}

function pass(message) {
  console.log(`PASS: ${message}`)
}

function warn(message) {
  warnings += 1
  console.warn(`WARN: ${message}`)
}

function fail(message) {
  failures += 1
  console.error(`FAIL: ${message}`)
}

function requireFile(relativePath) {
  if (existsSync(path.join(root, relativePath))) {
    pass(`${relativePath} exists`)
    return read(relativePath)
  }

  fail(`${relativePath} is missing`)
  return ''
}

function requireText(relativePath, needles) {
  const text = requireFile(relativePath)
  if (!text) return

  for (const needle of needles) {
    if (text.includes(needle)) pass(`${relativePath} includes ${needle}`)
    else fail(`${relativePath} missing ${needle}`)
  }
}

function checkFirebaseJson() {
  const text = requireFile('firebase.json')
  if (!text) return

  let config
  try {
    config = JSON.parse(text)
    pass('firebase.json parses')
  } catch (error) {
    fail(`firebase.json is invalid JSON: ${error.message}`)
    return
  }

  const hosting = Array.isArray(config.hosting) ? config.hosting : [config.hosting].filter(Boolean)
  const headerText = JSON.stringify(hosting.flatMap((entry) => entry.headers ?? []))
  const rewriteText = JSON.stringify(hosting.flatMap((entry) => entry.rewrites ?? []))

  if (headerText.includes('Cross-Origin-Opener-Policy')) {
    pass('firebase.json defines COOP header for auth popup compatibility')
  } else {
    warn('firebase.json does not define Cross-Origin-Opener-Policy; OAuth popup flows may need it')
  }

  if (headerText.includes('Content-Security-Policy')) {
    pass('firebase.json defines Content-Security-Policy')
  } else {
    warn('firebase.json does not define Content-Security-Policy')
  }

  if (rewriteText.includes('index.html')) pass('firebase.json rewrites SPA routes to index.html')
  else warn('firebase.json does not show an SPA fallback rewrite')
}

function checkRules() {
  const firestore = requireFile('firestore.rules')
  if (firestore) {
    for (const needle of ['accountLevel()', 'hasMinLevel', 'isAdmin()', 'adminUsers']) {
      if (firestore.includes(needle)) pass(`firestore.rules includes ${needle}`)
      else fail(`firestore.rules missing ${needle}`)
    }

    const sensitiveCollections = ['emailOtpCodes', 'totp', 'totpSecrets', 'backupCodes', 'securityProfiles']
    const hasSensitiveDeny = sensitiveCollections.some((name) => firestore.includes(name))
    if (hasSensitiveDeny) {
      pass('firestore.rules documents or protects MFA-sensitive collections')
    } else {
      warn('firestore.rules has no explicit MFA-sensitive collection stubs; add deny rules when enabling MFA storage')
    }

    const blocksPrivilegedSelfEdit =
      /level|role|admin|subscriptionTier|mfaRequired|securityProfile/.test(firestore) &&
      /affectedKeys|diff|changedKeys|hasOnly|hasAny/.test(firestore)
    if (blocksPrivilegedSelfEdit) {
      pass('firestore.rules appears to guard privileged self-edit fields')
    } else {
      warn('firestore.rules should add a self-edit allowlist before production user profile writes')
    }
  }

  const storage = requireFile('storage.rules')
  if (storage) {
    if (storage.includes('accountLevel()') || storage.includes('isAdmin()')) {
      pass('storage.rules includes account/admin authorization helpers')
    } else {
      fail('storage.rules missing account/admin authorization helpers')
    }
  }
}

function checkEnv() {
  for (const file of ['.env.example', '.SYSTEMX/Template/starter/.env.example']) {
    const text = requireFile(file)
    if (!text) continue

    for (const needle of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_WSG_SENDER_PROVIDER']) {
      if (text.includes(needle)) pass(`${file} includes ${needle}`)
      else fail(`${file} missing ${needle}`)
    }

    if (text.includes('SENDER_EMAIL') || text.includes('VITE_WSG_SENDER_EMAIL')) {
      pass(`${file} includes sender email placeholder`)
    } else {
      warn(`${file} should include a sender email placeholder for setup handoff`)
    }
  }
}

function checkDocsAndAppSurfaces() {
  requireText('.SYSTEMX/Unified-Setup-Process/standards/Unified-Login.md', [
    'Five-Step Login Process',
    'sender',
    'Microsoft 365',
    'GoDaddy',
  ])
  requireText('.SYSTEMX/Unified-Setup-Process/standards/WSG-Account-Levels.md', [
    'Level 0',
    'Level 5',
    'Test-SU@',
    'Playwright',
  ])
  requireText('.SYSTEMX/Unified-Setup-Process/standards/Firebase-Sender-Auth-MFA.md', [
    'Ordered Setup',
    'auth/multi-factor-auth-required',
    'sender@',
    'Preview-first validation',
  ])

  for (const file of [
    'src/pages/LoginPage.tsx',
    'src/auth/accountLevels.ts',
    'scripts/setup/seed-test-users.mjs',
  ]) {
    requireFile(file)
  }
}

checkFirebaseJson()
checkRules()
checkEnv()
checkDocsAndAppSurfaces()

console.log(`Auth/MFA readiness check complete: ${failures} failed, ${warnings} warning(s)`)
process.exit(failures > 0 ? 1 : 0)

