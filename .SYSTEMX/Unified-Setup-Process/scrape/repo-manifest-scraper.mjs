#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(here, 'repo-manifest.json')
const args = new Set(process.argv.slice(2))
const shouldList = args.has('--list')
const shouldWrite = args.has('--write')
const dryRun = args.has('--dry-run') || (!shouldList && !shouldWrite)
const owner = process.env.WSG_REPO_OWNER || 'WayneTechLab'
const limit = process.env.WSG_REPO_LIMIT || '25'

function ghJson(ghArgs) {
  const out = execFileSync('gh', ghArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return JSON.parse(out)
}

function ghText(ghArgs) {
  return execFileSync('gh', ghArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function pathExists(repo, path) {
  try {
    execFileSync('gh', ['api', `repos/${repo}/contents/${path}`], {
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

function readPackageScripts(repo) {
  try {
    const raw = ghText(['api', `repos/${repo}/contents/package.json`, '--jq', '.content'])
    const decoded = Buffer.from(raw.replace(/\s/g, ''), 'base64').toString('utf8')
    const pkg = JSON.parse(decoded)
    return pkg.scripts || {}
  } catch {
    return {}
  }
}

function detect(repo) {
  const paths = [
    '.SYSTEMX',
    '.devcontainer',
    '.vscode',
    'docs',
    'wiki',
    'scripts',
    'functions',
    'firebase.json',
    'firestore.rules',
    'storage.rules',
    'package.json',
    'README.md',
    'SECURITY.md',
  ]
  const found = Object.fromEntries(paths.map((path) => [path, pathExists(repo, path)]))
  const scripts = found['package.json'] ? readPackageScripts(repo) : {}
  const scriptNames = Object.keys(scripts)

  return {
    paths: found,
    packageScripts: scriptNames,
    signals: {
      hasSystemX: found['.SYSTEMX'],
      hasFirebase: found['firebase.json'] || found['firestore.rules'] || found['storage.rules'],
      hasFunctions: found.functions,
      hasDocs: found.docs || found.wiki || found['README.md'],
      hasSecurityDocs: found['SECURITY.md'],
      hasMcpHints: scriptNames.some((name) => /mcp|playwright|e2e|test:/.test(name)),
      hasDeployScripts: scriptNames.some((name) => /deploy|firebase/.test(name)) || found.scripts,
    },
  }
}

const repos = ghJson([
  'repo',
  'list',
  owner,
  '--limit',
  limit,
  '--json',
  'nameWithOwner,description,isPrivate,updatedAt,primaryLanguage,url',
])

if (shouldList) {
  for (const repo of repos) console.log(repo.nameWithOwner)
  process.exit(0)
}

const manifest = {
  generatedAt: new Date().toISOString(),
  owner,
  count: repos.length,
  note: 'Structure inventory only. Do not copy project-specific business logic into the template.',
  repositories: repos.map((repo) => ({
    ...repo,
    primaryLanguage: repo.primaryLanguage?.name || null,
    inventory: detect(repo.nameWithOwner),
  })),
}

if (dryRun) {
  console.log(JSON.stringify({
    generatedAt: manifest.generatedAt,
    owner: manifest.owner,
    count: manifest.count,
    sample: manifest.repositories.slice(0, 10),
  }, null, 2))
  process.exit(0)
}

if (shouldWrite) {
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Wrote ${outputPath}`)
  process.exit(0)
}

console.error('Use --list, --dry-run, or --write')
process.exit(2)
