#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const packetDir = process.argv[2]

if (!packetDir) {
  console.error('Usage: node .SYSTEMX/scripts/validate-setup-packet.mjs <packet-dir>')
  process.exit(1)
}

const resolvedPacketDir = path.resolve(root, packetDir)
const manifestPath = path.join(resolvedPacketDir, 'manifest.json')

if (!existsSync(resolvedPacketDir) || !statSync(resolvedPacketDir).isDirectory()) {
  console.error(`FAIL: packet directory not found: ${resolvedPacketDir}`)
  process.exit(1)
}

if (!existsSync(manifestPath)) {
  console.error(`FAIL: manifest.json missing in ${resolvedPacketDir}`)
  process.exit(1)
}

let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (error) {
  console.error(`FAIL: invalid manifest.json: ${error.message}`)
  process.exit(1)
}

const requiredFields = [
  'packetVersion',
  'packetType',
  'packetShape',
  'projectName',
  'generatedAt',
  'stackMode',
  'edition',
  'osTarget',
  'includedFiles',
  'requiredDocs',
  'optionalAssets',
  'importTargetFolderName',
]

let failed = false
for (const field of requiredFields) {
  if (!(field in manifest)) {
    console.error(`FAIL: manifest missing required field: ${field}`)
    failed = true
  }
}

if (!Array.isArray(manifest.includedFiles)) {
  console.error('FAIL: manifest.includedFiles must be an array')
  failed = true
}

if (!Array.isArray(manifest.requiredDocs)) {
  console.error('FAIL: manifest.requiredDocs must be an array')
  failed = true
}

if (!Array.isArray(manifest.optionalAssets)) {
  console.error('FAIL: manifest.optionalAssets must be an array')
  failed = true
}

const allListed = [...(manifest.includedFiles ?? []), ...(manifest.requiredDocs ?? [])]
const missingFiles = allListed.filter((relativePath) => !existsSync(path.join(resolvedPacketDir, relativePath)))

if (missingFiles.length > 0) {
  for (const file of missingFiles) {
    console.error(`FAIL: packet missing listed file: ${file}`)
  }
  failed = true
}

const shape = manifest.packetShape
if (shape !== 'bundle' && shape !== 'flat') {
  console.error(`FAIL: unsupported packetShape: ${shape}`)
  failed = true
}

if (failed) {
  process.exit(1)
}

console.log(`[WSG] Setup packet valid: ${manifest.projectName} (${manifest.packetType}/${manifest.packetShape})`)
