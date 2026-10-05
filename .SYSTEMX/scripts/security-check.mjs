#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const rootDir = process.cwd()
let failures = 0
let warnings = 0

function ok(message) {
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

function readText(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8')
}

function requireFile(relativePath) {
  if (existsSync(path.join(rootDir, relativePath))) {
    ok(`${relativePath} exists`)
    return true
  }
  fail(`${relativePath} is missing`)
  return false
}

function checkRulesFile(relativePath, serviceName) {
  if (!requireFile(relativePath)) return
  const text = readText(relativePath)
  if (!text.includes('rules_version')) fail(`${relativePath} should declare rules_version`)
  else ok(`${serviceName} rules declare rules_version`)
  if (/allow\s+(write|create|update|delete)[^:]*:\s*if\s+true\s*;/.test(text)) {
    fail(`${relativePath} contains an unconditional write rule`)
  } else if (/allow\s+read[^:]*:\s*if\s+true\s*;/.test(text)) {
    warn(`${relativePath} contains an unconditional read rule; keep this limited to documented public content`)
  } else {
    ok(`${serviceName} rules do not contain unconditional public access rules`)
  }
}

function checkFirebaseJson() {
  if (!requireFile('firebase.json')) return
  try {
    const config = JSON.parse(readText('firebase.json'))
    if (config.hosting) ok('firebase.json defines hosting')
    else warn('firebase.json does not define hosting')
    if (config.firestore?.rules) ok('firebase.json points to Firestore rules')
    else warn('firebase.json does not point to Firestore rules')
    if (config.storage?.rules) ok('firebase.json points to Storage rules')
    else warn('firebase.json does not point to Storage rules')
  } catch (error) {
    fail(`firebase.json is not valid JSON: ${error.message}`)
  }
}

function checkEnvExamples() {
  const envCandidates = ['.env.example', '.SYSTEMX/Template/starter/.env.example']
  for (const file of envCandidates) {
    if (!existsSync(path.join(rootDir, file))) {
      warn(`${file} is missing`)
      continue
    }
    const text = readText(file)
    const realLookingSecret = text
      .split(/\r?\n/)
      .filter((line) => /=\s*(AIza|sk_live_|rk_live_|ghp_|xoxb-)/.test(line))
      .filter((line) => !/[xX]{6,}|0{6,}|your-project|XXXXXXXX/.test(line))
    if (realLookingSecret.length > 0) {
      fail(`${file} appears to contain a real secret`)
    } else {
      ok(`${file} does not appear to contain live secrets`)
    }
  }
}

function runAudit() {
  if (!existsSync(path.join(rootDir, 'package-lock.json'))) {
    warn('package-lock.json missing; npm audit skipped')
    return
  }

  const result = spawnSync('npm', ['audit', '--audit-level=high'], {
    cwd: rootDir,
    stdio: 'inherit',
  })

  if (result.status === 0) ok('npm audit found no high severity issues')
  else warn('npm audit reported high severity issues; run npm run ci:audit for strict audit enforcement')
}

checkFirebaseJson()
checkRulesFile('firestore.rules', 'Firestore')
checkRulesFile('storage.rules', 'Storage')
checkEnvExamples()
runAudit()

console.log(`Security check complete: ${failures} failed, ${warnings} warning(s)`)
process.exit(failures > 0 ? 1 : 0)
