#!/usr/bin/env node

import {
  appendFileSync,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import { inspectCurrentRepository, inspectExternalProject } from './Builder/importer/current-repo.mjs'
import { clearSession, findAvailablePort, readSession, validPort, writeSession } from './Builder/runtime/port-utils.mjs'
import { confinedDirectory, confinedFile } from './Builder/runtime/file-boundary.mjs'

const lanRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(lanRoot, '..', '..')
const websiteRoot = join(lanRoot, 'Website')
const dashboardFile = join(lanRoot, 'Website_Dashboard.html')
const providerRegistryFile = join(lanRoot, 'Builder', 'contracts', 'provider-registry.json')
const authProviderRegistryFile = join(lanRoot, 'Builder', 'contracts', 'auth-provider-registry.json')
const localDataFile = join(lanRoot, 'Files', 'local-data.json')
const componentRegistryFile = join(lanRoot, 'Files', 'component-registry.json')
const fontCatalogFile = join(lanRoot, 'Builder', 'contracts', 'font-catalog.json')
const projectCssFile = join(repoRoot, 'src', 'index.css')
const ingestRoot = join(lanRoot, 'Temp', 'ingest')
const operationsLog = join(lanRoot, 'Temp', 'operations.jsonl')
const backupRoot = join(lanRoot, 'Backup')
const host = '127.0.0.1'
const preferredPort = validPort(process.env.SYSTEMX_LAN_PORT ?? '7331', 'SYSTEMX_LAN_PORT')
const port = process.env.SYSTEMX_STRICT_PORT === 'true'
  ? preferredPort
  : await findAvailablePort(preferredPort)
const appPort = validPort(process.env.SYSTEMX_APP_PORT ?? '5173', 'SYSTEMX_APP_PORT')
const firebaseAuthPort = validPort(process.env.SYSTEMX_FIREBASE_AUTH_PORT ?? '9099', 'SYSTEMX_FIREBASE_AUTH_PORT')
const firebaseFirestorePort = validPort(process.env.SYSTEMX_FIREBASE_FIRESTORE_PORT ?? '8080', 'SYSTEMX_FIREBASE_FIRESTORE_PORT')
const firebaseStoragePort = validPort(process.env.SYSTEMX_FIREBASE_STORAGE_PORT ?? '9199', 'SYSTEMX_FIREBASE_STORAGE_PORT')
const sessionId = process.env.SYSTEMX_SESSION_ID ?? `lan-${Date.now()}-${process.pid}`
const sessionToken = randomBytes(24).toString('hex')
const styleNonce = randomBytes(18).toString('base64')
const testMode = process.env.SYSTEMX_LAN_TEST_MODE === 'true'

const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`])
const allowedOrigins = new Set([
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  `http://127.0.0.1:${appPort}`,
  `http://localhost:${appPort}`,
])
const allowedExtensions = new Set([
  '.html',
  '.css',
  '.js',
  '.json',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.ico',
  '.woff2',
])
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function checkTcp(targetPort) {
  return new Promise((resolveCheck) => {
    const socket = net.createConnection({ host, port: targetPort })
    socket.setTimeout(500)
    socket.once('connect', () => {
      socket.destroy()
      resolveCheck(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolveCheck(false)
    })
    socket.once('error', () => resolveCheck(false))
  })
}

function applySecurityHeaders(response) {
  response.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      `style-src 'self' 'nonce-${styleNonce}'`,
      "img-src 'self' data:",
      `connect-src 'self' http://127.0.0.1:${appPort} http://localhost:${appPort}`,
      `frame-src http://127.0.0.1:${appPort} http://localhost:${appPort}`,
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; '),
  )
  response.setHeader('Cache-Control', 'no-store, max-age=0')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
}

function sendJson(response, statusCode, value) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(`${JSON.stringify(value)}\n`)
}

function sendText(response, statusCode, value) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.end(`${value}\n`)
}

const editableSourceRules = [
  /^src\/pages\/[A-Za-z0-9._-]+\.tsx$/,
  /^src\/components\/(layout|navigation|shell)\/[A-Za-z0-9._-]+\.tsx$/,
  /^src\/config\/siteControls\.ts$/,
  /^src\/index\.css$/,
  /^src\/router\.tsx$/,
]

const secretMarkers = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /AIza[0-9A-Za-z_-]{20,}/,
  /sk_(?:live|test)_[0-9A-Za-z]+/i,
  /(?:password|secret|token|privateKey)\s*[:=]\s*['"][^'"]{8,}/i,
]

const fontCatalogCache = {
  expiresAt: 0,
  source: null,
  warning: null,
  items: [],
}

function readCuratedFontCatalog() {
  try {
    const manifest = JSON.parse(readFileSync(fontCatalogFile, 'utf8'))
    return Array.isArray(manifest.families)
      ? manifest.families.map((item) => normalizeFontItem(item, manifest.source ?? 'curated'))
      : []
  } catch {
    return []
  }
}

function normalizeFontItem(item, source) {
  return {
    family: typeof item?.family === 'string' ? item.family.trim().slice(0, 120) : '',
    category: typeof item?.category === 'string' ? item.category : 'sans-serif',
    variants: Array.isArray(item?.variants) ? item.variants.filter((value) => typeof value === 'string').slice(0, 32) : [],
    subsets: Array.isArray(item?.subsets) ? item.subsets.filter((value) => typeof value === 'string').slice(0, 32) : [],
    axes: Array.isArray(item?.axes) ? item.axes.filter((value) => typeof value === 'object').slice(0, 12) : [],
    source,
  }
}

function encodeGoogleFamily(family) {
  return family.trim().split(/\s+/).map((part) => encodeURIComponent(part)).join('+')
}

function fontCssUrl(family, variants = []) {
  const weights = [...new Set(variants
    .filter((variant) => /^\d+$/.test(variant))
    .map((variant) => Number.parseInt(variant, 10))
    .filter((weight) => weight >= 100 && weight <= 900))]
    .sort((left, right) => left - right)
    .slice(0, 8)
  const spec = weights.length ? `${encodeGoogleFamily(family)}:wght@${weights.join(';')}` : encodeGoogleFamily(family)
  return `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
}

async function getFontCatalog() {
  if (fontCatalogCache.expiresAt > Date.now() && fontCatalogCache.items.length) {
    return fontCatalogCache
  }

  const curated = readCuratedFontCatalog()
  const apiKey = process.env.SYSTEMX_GOOGLE_FONTS_API_KEY?.trim()
  if (!apiKey || typeof globalThis.fetch !== 'function') {
    fontCatalogCache.expiresAt = Date.now() + 10 * 60 * 1000
    fontCatalogCache.source = 'curated-google-fonts-fallback'
    fontCatalogCache.warning = apiKey ? 'The local Node runtime does not expose fetch; using the checked-in catalog.' : 'A server-side Google Fonts metadata key is not configured; using the checked-in catalog.'
    fontCatalogCache.items = curated
    return fontCatalogCache
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  try {
    const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(apiKey)}&capability=WOFF2&sort=popularity`
    const response = await globalThis.fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Google Fonts metadata request returned HTTP ${response.status}`)
    const payload = await response.json()
    const remote = Array.isArray(payload.items)
      ? payload.items.map((item) => normalizeFontItem(item, 'google-developer-api')).filter((item) => item.family)
      : []
    fontCatalogCache.expiresAt = Date.now() + 10 * 60 * 1000
    fontCatalogCache.source = 'google-developer-api'
    fontCatalogCache.warning = null
    fontCatalogCache.items = remote.length ? remote : curated
  } catch (error) {
    fontCatalogCache.expiresAt = Date.now() + 60 * 1000
    fontCatalogCache.source = 'curated-google-fonts-fallback'
    fontCatalogCache.warning = `Live Google Fonts metadata unavailable; using the checked-in catalog (${error.message}).`
    fontCatalogCache.items = curated
  } finally {
    clearTimeout(timeout)
  }
  return fontCatalogCache
}

function findFontFamily(items, family) {
  const normalized = typeof family === 'string' ? family.trim().toLocaleLowerCase() : ''
  return items.find((item) => item.family.toLocaleLowerCase() === normalized) ?? null
}

function projectFontState() {
  if (!confinedFile(repoRoot, projectCssFile)) {
    return { path: 'src/index.css', configured: false, family: null, cssUrl: null, fallback: true }
  }
  const content = readFileSync(projectCssFile, 'utf8')
  const familyMatch = content.match(/--wtl-font-family:\s*["']([^"']+)["']/)
  const importMatch = content.match(/\/\* SYSTEMX FONT IMPORT START \*\/[\s\S]*?@import url\("([^"]+)"\);/)
  return {
    path: 'src/index.css',
    configured: Boolean(importMatch && familyMatch),
    family: familyMatch?.[1] ?? null,
    cssUrl: importMatch?.[1] ?? null,
    fallback: !importMatch,
  }
}

function cssFontStack(family) {
  const escaped = family.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  return `"${escaped}", system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
}

function updateProjectFontSource(content, family, cssUrl) {
  const importBlock = `/* SYSTEMX FONT IMPORT START */\n@import url("${cssUrl}");\n/* SYSTEMX FONT IMPORT END */`
  const importMarker = /\/\* SYSTEMX FONT IMPORT START \*\/[\s\S]*?\/\* SYSTEMX FONT IMPORT END \*\//
  let updated = importMarker.test(content)
    ? content.replace(importMarker, () => importBlock)
    : content.replace(/((?:^|\n)@import[^;]+;\s*)+/, (imports) => `${imports}${importBlock}\n`)
  const stack = cssFontStack(family)
  if (/--wtl-font-family:\s*[^;]+;/.test(updated)) {
    updated = updated.replace(/--wtl-font-family:\s*[^;]+;/, () => `--wtl-font-family: ${stack};`)
  } else {
    updated = updated.replace(/:root\s*\{/, (rootStart) => `${rootStart}\n  --wtl-font-family: ${stack};`)
  }
  if (/body\s*\{[\s\S]*?font-family:\s*[^;]+;/.test(updated)) {
    updated = updated.replace(/(body\s*\{[\s\S]*?font-family:\s*)[^;]+;/, '$1var(--wtl-font-family);')
  }
  return updated
}

async function saveProjectFont(body) {
  if (body.confirmation !== 'SAVE FONT CHANGE') throw new Error('Type SAVE FONT CHANGE to approve this local font write')
  const catalog = await getFontCatalog()
  const font = findFontFamily(catalog.items, body.family)
  if (!font) throw new Error('Choose a font from the verified local or Google Fonts catalog')
  const sourcePath = editableSourcePath('src/index.css')
  if (!sourcePath) throw new Error('src/index.css is not available through the editable source policy')
  const previous = readFileSync(sourcePath.target, 'utf8')
  const cssUrl = fontCssUrl(font.family, font.variants)
  const next = updateProjectFontSource(previous, font.family, cssUrl)
  if (previous === next) return { status: 'unchanged', path: sourcePath.normalized, family: font.family, cssUrl }
  const backup = backupSource(sourcePath)
  const temporary = `${sourcePath.target}.${randomUUID()}.tmp`
  writeFileSync(temporary, next, { flag: 'wx', mode: 0o600 })
  renameSync(temporary, sourcePath.target)
  recordOperation('font_saved', {
    path: sourcePath.normalized,
    family: font.family,
    cssUrl,
    backup,
    previousLines: lineCount(previous),
    nextLines: lineCount(next),
  })
  return {
    status: 'saved',
    path: sourcePath.normalized,
    family: font.family,
    cssUrl,
    backup,
    qualityNext: ['npm run typecheck', 'npm run lint', 'npm run build'],
  }
}

function defaultNodeTree(pageId) {
  const rootId = `${pageId}-root`
  const heroId = `${pageId}-hero`
  const bodyId = `${pageId}-body`
  return {
    rootNodeId: rootId,
    nodes: {
      [rootId]: { id: rootId, type: 'container', label: 'Page root', children: [heroId, bodyId], props: { layout: 'stack' } },
      [heroId]: { id: heroId, type: 'text', label: 'Hero content', children: [], props: { element: 'h1', text: pageId === 'home' ? 'Web Stack Generation' : 'Editable page heading' } },
      [bodyId]: { id: bodyId, type: 'container', label: 'Content section', children: [], props: { layout: 'grid' } },
    },
  }
}

function createLocalData() {
  const workspace = inspectCurrentRepository(repoRoot, runGit(['branch', '--show-current']) || 'unknown')
  return {
    schemaVersion: 1,
    environment: 'local-fixture',
    updatedAt: new Date().toISOString(),
    pages: workspace.pages.map((page) => ({
      id: page.id,
      name: page.name.replace(/Page$/, ''),
      route: page.route,
      source: page.source,
      status: 'draft',
      nodeTree: defaultNodeTree(page.id),
    })),
    collections: [
      {
        id: 'contact-submissions',
        name: 'Contact submissions',
        provider: 'firestore',
        status: 'local fixture',
        fields: ['name', 'email', 'message', 'createdAt'],
        rows: [],
      },
      {
        id: 'crm-contacts',
        name: 'CRM contacts',
        provider: 'firebase-sql-connect',
        status: 'local fixture',
        fields: ['name', 'email', 'stage', 'owner'],
        rows: [],
      },
    ],
    users: [
      { id: 'local-admin', email: 'admin@example.com', role: 'Level 4 Operator', status: 'local demo', provider: 'firebase-auth' },
      { id: 'local-builder', email: 'builder@example.com', role: 'Level 3 Builder', status: 'local demo', provider: 'firebase-auth' },
    ],
  }
}

function readLocalData() {
  mkdirSync(dirname(localDataFile), { recursive: true })
  if (!existsSync(localDataFile)) {
    const seed = createLocalData()
    writeFileSync(localDataFile, `${JSON.stringify(seed, null, 2)}\n`, { mode: 0o600 })
    return seed
  }
  try {
    return JSON.parse(readFileSync(localDataFile, 'utf8'))
  } catch {
    return createLocalData()
  }
}

function componentRegistrySeed() {
  const workspace = inspectCurrentRepository(repoRoot, runGit(['branch', '--show-current']) || 'unknown')
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    components: workspace.components.map((component) => ({
      ...component,
      status: 'detected',
      tags: component.tags ?? ['template', component.role ?? 'component', 'local-source'],
      slots: component.slots ?? [],
      responsive: component.responsive ?? { width: 'fluid', behavior: 'inherit-from-source' },
      export: { format: 'systemx-component', version: 1 },
    })),
  }
}

function readComponentRegistry() {
  mkdirSync(dirname(componentRegistryFile), { recursive: true })
  if (!existsSync(componentRegistryFile)) {
    const seed = componentRegistrySeed()
    writeFileSync(componentRegistryFile, `${JSON.stringify(seed, null, 2)}\n`, { mode: 0o600 })
    return seed
  }
  try {
    const value = JSON.parse(readFileSync(componentRegistryFile, 'utf8'))
    return value?.schemaVersion === 1 && Array.isArray(value.components) ? value : componentRegistrySeed()
  } catch {
    return componentRegistrySeed()
  }
}

function writeComponentRegistry(registry) {
  registry.updatedAt = new Date().toISOString()
  const temporary = `${componentRegistryFile}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporary, componentRegistryFile)
  return registry
}

function componentId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function normalizeList(value, limit = 20) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit)
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, limit)
}

function saveComponent(body) {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const id = componentId(body.id || name)
  if (!name || !id) throw new Error('A reusable module name is required')
  const registry = readComponentRegistry()
  const component = {
    id,
    name,
    kind: body.kind === 'react-component' ? 'react-component' : 'module',
    role: typeof body.role === 'string' ? body.role.trim().slice(0, 50) : 'component',
    source: typeof body.source === 'string' && body.source.trim() ? body.source.trim().slice(0, 500) : `local-model:${body.pageId ?? 'workspace'}/${body.nodeId ?? id}`,
    tags: normalizeList(body.tags),
    slots: normalizeList(body.slots),
    responsive: {
      width: ['fluid', 'contained', 'fixed'].includes(body.width) ? body.width : 'fluid',
      behavior: typeof body.behavior === 'string' ? body.behavior.trim().slice(0, 120) : 'responsive-by-container',
    },
    status: 'local-draft',
    export: { format: 'systemx-component', version: 1 },
    updatedAt: new Date().toISOString(),
  }
  const existingIndex = registry.components.findIndex((item) => item.id === id)
  if (existingIndex >= 0) registry.components[existingIndex] = { ...registry.components[existingIndex], ...component }
  else registry.components.push(component)
  const backup = existsSync(componentRegistryFile) ? backupSource({ normalized: '.SYSTEMX/LAN/Files/component-registry.json', target: componentRegistryFile }) : null
  writeComponentRegistry(registry)
  let linkedNode = null
  if (body.pageId && body.nodeId) {
    const data = readLocalData()
    const page = data.pages.find((item) => item.id === body.pageId)
    const node = page?.nodeTree?.nodes?.[body.nodeId]
    if (node) {
      const localDataBackup = join(backupRoot, new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-'), '.SYSTEMX/LAN/Files/local-data.json')
      mkdirSync(dirname(localDataBackup), { recursive: true, mode: 0o700 })
      copyFileSync(localDataFile, localDataBackup)
      node.props = {
        ...(node.props ?? {}),
        moduleId: id,
        moduleName: name,
        moduleTags: component.tags,
        moduleSlots: component.slots,
        width: component.responsive.width,
      }
      writeLocalData(data)
      linkedNode = { pageId: body.pageId, nodeId: body.nodeId, backup: relative(repoRoot, localDataBackup).replaceAll('\\', '/') }
    }
  }
  recordOperation('component_registry_updated', { componentId: id, backup, linkedNode })
  return { component, registry, backup, linkedNode }
}

function writeIngestManifest(manifest) {
  const runId = `ingest-${Date.now()}-${randomUUID().slice(0, 8)}`
  const target = join(ingestRoot, runId, 'manifest.json')
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
  writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  return relative(repoRoot, target).replaceAll('\\', '/')
}

function writeLocalData(data) {
  data.updatedAt = new Date().toISOString()
  const temporary = `${localDataFile}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
  renameSync(temporary, localDataFile)
  return data
}

function recordOperation(event, detail = {}) {
  mkdirSync(dirname(operationsLog), { recursive: true })
  appendFileSync(operationsLog, `${JSON.stringify({
    event,
    sessionId,
    timestamp: new Date().toISOString(),
    ...detail,
  })}\n`)
}

function editableSourcePath(value) {
  if (typeof value !== 'string') return null
  const normalized = posix.normalize(value.replaceAll('\\', '/')).replace(/^\.\//, '')
  if (normalized.startsWith('../') || normalized.includes('/../') || !editableSourceRules.some((rule) => rule.test(normalized))) return null
  const target = resolve(repoRoot, normalized)
  const relativeTarget = relative(repoRoot, target).replaceAll('\\', '/')
  if (relativeTarget !== normalized || !confinedFile(repoRoot, target)) return null
  return { normalized, target }
}

function containsSecretMarker(value) {
  return secretMarkers.some((marker) => marker.test(value))
}

function backupSource(sourcePath) {
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const target = join(backupRoot, stamp, sourcePath.normalized)
  confinedDirectory(lanRoot, dirname(target))
  copyFileSync(sourcePath.target, target, 1)
  return relative(repoRoot, target).replaceAll('\\', '/')
}

function lineCount(value) {
  return value.length === 0 ? 0 : value.split(/\r?\n/).length
}

function toolStatus(command, args = ['--version']) {
  const locator = process.platform === 'win32' ? 'where.exe' : 'which'
  try {
    const executable = execFileSync(locator, [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/)[0]
    let version = ''
    try {
      version = execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/)[0]
    } catch {
      version = 'installed; version unavailable'
    }
    return { command, installed: true, executable, version }
  } catch {
    return { command, installed: false, executable: null, version: 'not installed' }
  }
}

function toolingStatus() {
  return [
    toolStatus('node'),
    toolStatus('npm'),
    toolStatus('python3'),
    toolStatus('git'),
    toolStatus('gh'),
    toolStatus('vite'),
    toolStatus('firebase'),
    toolStatus('gcloud'),
    toolStatus('stripe'),
    toolStatus('playwright'),
  ]
}

function operatingStatus() {
  const readRecord = (name, fallback) => {
    try {
      return JSON.parse(readFileSync(join(repoRoot, '.SYSTEMX', name), 'utf8'))
    } catch {
      return fallback
    }
  }
  const installation = readRecord('INSTALLATION.json', null)
  const tasks = readRecord('WORK/TASKS.json', { tasks: [] }).tasks ?? []
  const agents = readRecord('AGENTS/REGISTRY.json', { agents: [] }).agents ?? []
  const projects = readRecord('Projects/REGISTRY.json', { projects: [] }).projects ?? []
  return {
    installed: Boolean(installation),
    selectedVersion: installation?.activeVersion ?? null,
    pinnedVersion: installation?.pinnedVersion ?? null,
    updatePolicy: installation?.autoUpdate ?? null,
    taskCount: tasks.length,
    tasksByStatus: Object.fromEntries(['todo', 'in_progress', 'blocked', 'needs_review', 'done', 'cancelled']
      .map((status) => [status, tasks.filter((task) => task.status === status).length])),
    agentRoles: agents.map((agent) => ({ id: agent.id, role: agent.role })),
    childProjectCount: projects.length,
    authority: 'records-only',
  }
}

function requireSessionToken(request, response) {
  if (request.headers['x-systemx-session'] !== sessionToken) {
    sendJson(response, 403, { error: 'SYSTEMX session token required' })
    return false
  }
  return true
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        rejectBody(new Error('Request body exceeds local builder limit'))
        request.destroy()
      }
    })
    request.on('end', () => {
      try {
        resolveBody(body ? JSON.parse(body) : {})
      } catch {
        rejectBody(new Error('Request body must be valid JSON'))
      }
    })
    request.on('error', rejectBody)
  })
}

function sourceRead(value) {
  const sourcePath = editableSourcePath(value)
  if (!sourcePath) return { error: 'Source path is outside the editable allowlist' }
  return {
    path: sourcePath.normalized,
    content: readFileSync(sourcePath.target, 'utf8'),
    writable: true,
    policy: 'backup-diff-confirm',
  }
}

function updateLocalPage(data, body) {
  const page = data.pages.find((item) => item.id === body.pageId)
  if (!page) throw new Error('Unknown local page')
  if (body.operation === 'update-meta') {
    if (typeof body.name === 'string' && body.name.trim()) page.name = body.name.trim().slice(0, 120)
    if (typeof body.route === 'string' && /^\/[a-z0-9/_-]*$/.test(body.route)) page.route = body.route
  } else if (body.operation === 'add-node') {
    const type = ['container', 'text', 'image', 'button', 'form', 'list', 'component'].includes(body.type) ? body.type : 'container'
    const nodeId = `${page.id}-${randomUUID().slice(0, 8)}`
    const node = {
      id: nodeId,
      type,
      label: type === 'component' ? 'Reusable component module' : `${type} module`,
      children: [],
      props: type === 'text'
        ? { element: 'p', text: 'New editable text module' }
        : type === 'component'
          ? { moduleId: null, width: 'fluid', slots: [] }
          : {},
    }
    page.nodeTree.nodes[nodeId] = node
    const root = page.nodeTree.nodes[page.nodeTree.rootNodeId]
    root.children.push(nodeId)
  } else if (body.operation === 'remove-node') {
    const node = page.nodeTree.nodes[body.nodeId]
    if (!node || body.nodeId === page.nodeTree.rootNodeId) throw new Error('Root node cannot be removed')
    delete page.nodeTree.nodes[body.nodeId]
    for (const candidate of Object.values(page.nodeTree.nodes)) candidate.children = candidate.children.filter((id) => id !== body.nodeId)
  } else {
    throw new Error('Unsupported page operation')
  }
  return page
}

function createLocalPage(data, body) {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const route = typeof body.route === 'string' ? body.route.trim() : ''
  if (!name || !/^\/[a-z0-9/_-]*$/.test(route) || route === '*') {
    throw new Error('A page name and lowercase slash route are required')
  }
  if (data.pages.some((page) => page.route === route)) throw new Error('That route already exists')
  const id = route === '/' ? 'home' : route.replace(/^\//, '').replaceAll('/', '-').replace(/[^a-z0-9-]/g, '') || `page-${randomUUID().slice(0, 8)}`
  if (data.pages.some((page) => page.id === id)) throw new Error('That page identifier already exists')
  const sourceName = name.replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join('') || 'New'
  const page = {
    id,
    name,
    route,
    source: `src/pages/${sourceName}Page.tsx`,
    status: 'planned-local',
    nodeTree: defaultNodeTree(id),
  }
  data.pages.push(page)
  return page
}

function escapeJsonScript(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function loadProviderRegistry() {
  try {
    return JSON.parse(readFileSync(providerRegistryFile, 'utf8')).providers ?? []
  } catch {
    return []
  }
}

function loadAuthProviderRegistry() {
  try {
    return JSON.parse(readFileSync(authProviderRegistryFile, 'utf8'))
  } catch {
    return {
      schemaVersion: 1,
      defaultLocalProvider: 'email-password',
      localPolicy: {
        environment: 'development',
        firebaseProject: 'demo-systemx',
        authEmulator: 'http://127.0.0.1:9099',
        allowedProviderIds: ['email-password'],
        productionFallback: 'disabled',
      },
      providers: [],
    }
  }
}

function readNonSecretEnvValue(name) {
  const allowedNames = new Set(['VITE_FIREBASE_PROJECT_ID', 'GCLOUD_PROJECT'])
  if (!allowedNames.has(name)) return ''
  if (process.env[name]) return process.env[name]
  for (const filename of ['.env.local', '.env']) {
    const file = join(repoRoot, filename)
    if (!existsSync(file)) continue
    const line = readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .find((entry) => new RegExp(`^\\s*${name}\\s*=`).test(entry))
    if (!line) continue
    return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')
  }
  return ''
}

async function getAuthStatus() {
  const authEmulatorOnline = await checkTcp(firebaseAuthPort)
  const registry = loadAuthProviderRegistry()
  const configuredProjectId = readNonSecretEnvValue('VITE_FIREBASE_PROJECT_ID')
  const providers = (registry.providers ?? []).map((provider) => {
    const enabledLocally = registry.localPolicy?.allowedProviderIds?.includes(provider.id)
    const localState = provider.id === 'email-password'
      ? authEmulatorOnline ? 'ok' : 'warn'
      : enabledLocally ? 'ok' : provider.localState === 'planned' ? 'planned' : 'muted'
    const localLabel = provider.id === 'email-password'
      ? authEmulatorOnline ? 'local ready' : 'start emulator'
      : enabledLocally ? 'local ready' : provider.localState
    return {
      id: provider.id,
      label: provider.label,
      state: localState,
      localLabel,
      localState: provider.localState,
      localNote: provider.localNote,
      productionState: provider.productionState,
      productionNote: provider.productionNote,
    }
  })
  return {
    mode: authEmulatorOnline ? 'firebase-emulator' : configuredProjectId ? 'configured-project' : 'emulator-offline',
    environment: 'local-only',
    projectId: authEmulatorOnline ? registry.localPolicy?.firebaseProject ?? 'demo-systemx' : configuredProjectId || null,
    emulatorUrl: `http://${host}:${firebaseAuthPort}`,
    ports: {
      auth: firebaseAuthPort,
      firestore: firebaseFirestorePort,
      storage: firebaseStoragePort,
    },
    emulatorOnline: authEmulatorOnline,
    defaultLocalProvider: registry.defaultLocalProvider ?? 'email-password',
    localAllowedProviders: registry.localPolicy?.allowedProviderIds ?? ['email-password'],
    productionProviderCount: providers.filter((provider) => provider.productionState === 'supported').length,
    providers,
    policy: registry.localPolicy?.productionFallback ?? 'disabled',
  }
}

async function getProviderStatuses() {
  const emulatorPorts = await Promise.all([
    checkTcp(firebaseFirestorePort),
    checkTcp(firebaseStoragePort),
    checkTcp(firebaseAuthPort),
  ])
  const [firestoreOnline, storageOnline] = emulatorPorts
  const firebaseConfigured = Boolean(readNonSecretEnvValue('VITE_FIREBASE_PROJECT_ID'))
  const registry = loadProviderRegistry()

  return registry.map((provider) => {
    const local = provider.id === 'firestore'
      ? firestoreOnline
      : provider.id === 'cloud-storage-for-firebase'
        ? storageOnline
        : false
    const isFirebaseCore = ['firestore', 'firebase-realtime-database', 'firebase-sql-connect', 'cloud-storage-for-firebase'].includes(provider.id)
    const configured = isFirebaseCore ? firebaseConfigured : Boolean(
      provider.id === 'google-drive'
        ? process.env.GOOGLE_APPLICATION_CREDENTIALS
        : provider.id === 'google-cloud-storage' && process.env.GCLOUD_PROJECT,
    )
    const label = local ? 'local emulator' : configured ? 'configured' : 'planned'
    return {
      name: provider.name,
      label,
      state: local || configured ? 'ok' : 'warn',
      detail: `${provider.artifactKinds.join(', ')} · ${provider.environmentRule}`,
      capabilities: provider.capabilities,
    }
  })
}

function renderDashboardHtml(html, status) {
  const controllerDetail = `${host}:${port} local-only`
  const viteState = status.vite.listening ? 'Online' : 'Offline'
  const viteDetail = status.vite.listening
    ? `Preview app at ${status.vite.url}`
    : 'Start Vite before editing previews'
  const repoDetail = status.repository.clean
    ? 'Working tree clean'
    : `${status.repository.changedFiles} changed paths`
  const waves = status.builder.waves
    .map(
      (wave) =>
        `<li><strong>${escapeHtml(wave.title)}</strong><small>${escapeHtml(wave.detail)}</small></li>`,
    )
    .join('')
  const routes = status.routes
    .map(
      (route) =>
        `<a class="chip" href="${escapeHtml(route.url)}" rel="noreferrer">${escapeHtml(route.path)}</a>`,
    )
    .join('')
  const providers = status.providers
    .map(
      (provider) =>
        `<article class="provider-card"><header><h3>${escapeHtml(provider.name)}</h3><span class="badge ${escapeHtml(provider.state)}">${escapeHtml(provider.label)}</span></header><p>${escapeHtml(provider.detail)}</p></article>`,
    )
    .join('')
  const files = status.files
    .map((file) => `<span class="file-chip">${escapeHtml(file)}</span>`)
    .join('')
  const pages = status.workspace.pages
    .map(
      (page) => `<article class="inventory-item"><strong>${escapeHtml(page.name)}</strong><small>${escapeHtml(`${page.route ?? 'unmapped'} · ${page.source}`)}</small></article>`,
    )
    .join('')
  const components = (status.workspace.componentRegistry ?? status.workspace.components)
    .map((component) => `<span class="file-chip">${escapeHtml(component.source)}</span>`)
    .join('')

  return html
    .replace(
      '<strong id="controller-state">Loading</strong>',
      '<strong id="controller-state">online</strong>',
    )
    .replace(
      '<small id="controller-detail">Checking loopback service</small>',
      `<small id="controller-detail">${escapeHtml(controllerDetail)}</small>`,
    )
    .replace(
      '<strong id="vite-state">Loading</strong>',
      `<strong id="vite-state">${escapeHtml(viteState)}</strong>`,
    )
    .replace(
      '<small id="vite-detail">Checking 127.0.0.1:5173</small>',
      `<small id="vite-detail">${escapeHtml(viteDetail)}</small>`,
    )
    .replace(
      '<strong id="repo-state">Loading</strong>',
      `<strong id="repo-state">${escapeHtml(status.repository.branch)}</strong>`,
    )
    .replace(
      '<small id="repo-detail">Reading local git status</small>',
      `<small id="repo-detail">${escapeHtml(repoDetail)}</small>`,
    )
    .replace(
      '<meta name="systemx-session" content="" />',
      `<meta name="systemx-session" content="${escapeHtml(sessionToken)}" />`,
    )
    .replace('href="/login"', `href="${escapeHtml(status.vite.url)}login"`)
    .replace(
      '<style id="systemx-runtime-style" nonce=""></style>',
      `<style id="systemx-runtime-style" nonce="${escapeHtml(styleNonce)}"></style>`,
    )
    .replace('href="http://127.0.0.1:5173/"', `href="${escapeHtml(status.vite.url)}"`)
    .replace(
      'src="about:blank"',
      `src="${escapeHtml(status.vite.listening ? status.vite.url : 'about:blank')}"`,
    )
    .replace(
      '<span id="builder-wave-count">0 loaded</span>',
      `<span id="builder-wave-count">${status.builder.waves.length} waves</span>`,
    )
    .replace('<ol id="builder-waves" class="timeline"></ol>', `<ol id="builder-waves" class="timeline">${waves}</ol>`)
    .replace(
      '<span id="route-count">0 routes</span>',
      `<span id="route-count">${status.routes.length} routes</span>`,
    )
    .replace('<div id="route-list" class="chip-list"></div>', `<div id="route-list" class="chip-list">${routes}</div>`)
    .replace('<span id="page-count">0 pages</span>', `<span id="page-count">${status.workspace.pages.length} pages</span>`)
    .replace('<div id="page-list" class="inventory-list"></div>', `<div id="page-list" class="inventory-list">${pages}</div>`)
    .replace('<span id="component-count">0 components</span>', `<span id="component-count">${status.workspace.components.length} components</span>`)
    .replace('<div id="component-list" class="file-list"></div>', `<div id="component-list" class="file-list">${components}</div>`)
    .replace('<div id="provider-list" class="provider-grid"></div>', `<div id="provider-list" class="provider-grid">${providers}</div>`)
    .replace(
      '<span id="file-count">0 files</span>',
      `<span id="file-count">${status.files.length} files</span>`,
    )
    .replace('<div id="file-list" class="file-list"></div>', `<div id="file-list" class="file-list">${files}</div>`)
}

function resolvePublicFile(pathname) {
  if (pathname === '/' || pathname === '/Website_Dashboard.html') {
    return confinedFile(lanRoot, dashboardFile)
  }

  if (!pathname.startsWith('/Website/')) return null

  let relativePath = ''
  try {
    relativePath = decodeURIComponent(pathname.slice('/Website/'.length))
  } catch {
    return null
  }

  if (
    !relativePath ||
    relativePath.split('/').some((segment) => segment.startsWith('.'))
  ) {
    return null
  }

  const target = resolve(websiteRoot, relativePath)
  if (target !== websiteRoot && !target.startsWith(`${websiteRoot}${sep}`)) {
    return null
  }
  if (!allowedExtensions.has(extname(target).toLowerCase())) return null
  return confinedFile(repoRoot, target)
}

async function getStatus() {
  const branch = runGit(['branch', '--show-current']) || 'unknown'
  const status = runGit(['status', '--short'])
  const changedFiles = status ? status.split('\n').filter(Boolean).length : 0
  const viteListening = await checkTcp(appPort)
  const workspace = inspectCurrentRepository(repoRoot, branch)
  const currentSession = readSession(repoRoot)
  const providers = await getProviderStatuses()
  const authStatus = await getAuthStatus()
  const localData = readLocalData()
  const componentRegistry = readComponentRegistry()

  return {
    repository: {
      branch,
      clean: changedFiles === 0,
      changedFiles,
    },
    vite: {
      listening: viteListening,
      url: `http://127.0.0.1:${appPort}/`,
    },
    session: {
      id: currentSession?.sessionId ?? sessionId,
      lanUrl: `http://127.0.0.1:${port}/`,
      appUrl: `http://127.0.0.1:${appPort}/`,
      bridgeUrl: `http://127.0.0.1:${appPort}/__systemx/`,
      ownerPid: currentSession?.ownerPid ?? null,
      portPolicy: 'loopback-v4-v6-exclusive',
      firebase: currentSession?.ports?.firebase ?? {
        auth: firebaseAuthPort,
        firestore: firebaseFirestorePort,
        storage: firebaseStoragePort,
      },
    },
    builder: {
      mode: 'template-edit',
      writable: true,
      currentTemplate: true,
      writePolicy: 'backup-diff-confirm',
      waves: [
        {
          title: 'Wave 0 - contracts and inventory',
          detail: 'Local-only shell, route inventory, provider map, and build isolation.',
        },
        {
          title: 'Wave 1 - current-template workspace',
          detail: 'Read pages, routes, tokens, source templates, KIT assets, and setup files.',
        },
        {
          title: 'Wave 2 - guarded local edits',
          detail: 'Backup, explicit confirmation, local page models, source save, preview, and operation evidence.',
        },
        {
          title: 'Wave 3 - Firebase local data plane',
          detail: 'Firestore, Storage, Auth, and emulator-first builder metadata.',
        },
        {
          title: 'Wave 4 - reusable modules and ingest',
          detail: 'Register responsive components, export stack contracts, and inventory existing projects before bridge installation.',
        },
      ],
    },
    routes: workspace.routes.map((route) => ({
      ...route,
      url: route.path === '*'
        ? `http://127.0.0.1:${appPort}/not-found`
        : `http://127.0.0.1:${appPort}${route.path}`,
    })),
    workspace: {
      pages: workspace.pages,
      components: workspace.components,
      componentRegistry: componentRegistry.components,
      tokens: workspace.tokens,
      sourceFiles: workspace.sourceFiles,
    },
    providers,
    auth: authStatus,
    data: {
      collections: localData.collections.length,
      users: localData.users.length,
      pages: localData.pages.length,
      environment: localData.environment,
    },
    tooling: toolingStatus(),
    operating: operatingStatus(),
    files: [
      'src/router.tsx',
      ...workspace.sourceFiles,
      '.SYSTEMX/LAN/BUILDER-SYSTEM-PLAN.md',
      '.SYSTEMX/LAN/Builder/contracts/builder-workspace.schema.json',
      '.SYSTEMX/LAN/Builder/contracts/provider-registry.json',
      '.SYSTEMX/LAN/Builder/contracts/auth-provider-registry.json',
      '.SYSTEMX/LAN/Builder/contracts/font-catalog.json',
      '.SYSTEMX/LAN/Builder/contracts/component-registry.schema.json',
      '.SYSTEMX/LAN/Builder/contracts/ingest-manifest.schema.json',
    ].filter((file, index, values) => values.indexOf(file) === index),
  }
}

const server = createServer(async (request, response) => {
  applySecurityHeaders(response)

  const requestHost = request.headers.host
  if (requestHost && !allowedHosts.has(requestHost)) {
    sendText(response, 403, 'Forbidden host')
    return
  }

  const origin = request.headers.origin
  if (origin && !allowedOrigins.has(origin)) {
    sendText(response, 403, 'Forbidden origin')
    return
  }

  if (!['GET', 'HEAD', 'POST'].includes(request.method)) {
    sendText(response, 405, 'Method not allowed')
    return
  }

  const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`)

  if (requestUrl.pathname === '/api/health') {
    sendJson(response, 200, {
      status: 'online',
      mode: 'local-only',
      host,
      port,
      name: 'SYSTEMX Local Control',
    })
    return
  }

  if (requestUrl.pathname === '/api/status') {
    sendJson(response, 200, await getStatus())
    return
  }

  if (requestUrl.pathname === '/api/auth/providers' && request.method === 'GET') {
    sendJson(response, 200, await getAuthStatus())
    return
  }

  if (requestUrl.pathname === '/api/fonts/catalog' && request.method === 'GET') {
    const catalog = await getFontCatalog()
    const query = requestUrl.searchParams.get('q')?.trim().toLocaleLowerCase() ?? ''
    const category = requestUrl.searchParams.get('category')?.trim().toLocaleLowerCase() ?? ''
    const items = catalog.items
      .filter((item) => !query || item.family.toLocaleLowerCase().includes(query))
      .filter((item) => !category || item.category.toLocaleLowerCase() === category)
      .slice(0, 200)
      .map((item) => ({ ...item, cssUrl: fontCssUrl(item.family, item.variants) }))
    sendJson(response, 200, {
      source: catalog.source,
      warning: catalog.warning,
      apiConfigured: Boolean(process.env.SYSTEMX_GOOGLE_FONTS_API_KEY?.trim()),
      cssApi: 'https://fonts.googleapis.com/css2',
      count: items.length,
      items,
    })
    return
  }

  if (requestUrl.pathname === '/api/fonts/project' && request.method === 'GET') {
    sendJson(response, 200, projectFontState())
    return
  }

  if (requestUrl.pathname === '/api/builder/workspace') {
    const status = await getStatus()
    sendJson(response, 200, {
      schemaVersion: 1,
      target: 'current-repo',
      mode: status.builder.mode,
      repository: status.repository,
      pages: status.workspace.pages,
      routes: status.routes,
      components: status.workspace.components,
      componentRegistry: status.workspace.componentRegistry,
      tokens: status.workspace.tokens,
      providers: status.providers,
      auth: status.auth,
      evidence: [],
    })
    return
  }

  if (requestUrl.pathname === '/api/builder/data' && request.method === 'GET') {
    sendJson(response, 200, readLocalData())
    return
  }

  if (requestUrl.pathname === '/api/builder/components' && request.method === 'GET') {
    sendJson(response, 200, readComponentRegistry())
    return
  }

  if (requestUrl.pathname === '/api/builder/components/export' && request.method === 'GET') {
    response.statusCode = 200
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Content-Disposition', 'attachment; filename="systemx-component-registry.json"')
    response.end(`${JSON.stringify(readComponentRegistry(), null, 2)}\n`)
    return
  }

  if (requestUrl.pathname === '/api/builder/source' && request.method === 'GET') {
    const result = sourceRead(requestUrl.searchParams.get('path'))
    sendJson(response, result.error ? 400 : 200, result)
    return
  }

  if (requestUrl.pathname === '/api/tools' && request.method === 'GET') {
    sendJson(response, 200, { environment: 'local-only', tools: toolingStatus() })
    return
  }

  if (request.method === 'POST' && requestUrl.pathname.startsWith('/api/')) {
    if (!requireSessionToken(request, response)) return
    let body
    try {
      body = await readRequestBody(request)
    } catch (error) {
      sendJson(response, 400, { error: error.message })
      return
    }

    try {
      if (requestUrl.pathname === '/api/builder/font') {
        sendJson(response, 200, await saveProjectFont(body))
        return
      }

      if (requestUrl.pathname === '/api/builder/source') {
        if (body.confirmation !== 'SAVE LOCAL CHANGE') throw new Error('Type SAVE LOCAL CHANGE to approve this local write')
        if (typeof body.content !== 'string' || body.content.length > 500_000) throw new Error('Source content is missing or exceeds the local limit')
        if (containsSecretMarker(body.content)) throw new Error('Secret-shaped content is rejected by SYSTEMX')
        const sourcePath = editableSourcePath(body.path)
        if (!sourcePath) throw new Error('Source path is outside the editable allowlist')
        const previous = readFileSync(sourcePath.target, 'utf8')
        if (previous === body.content) {
          sendJson(response, 200, { status: 'unchanged', path: sourcePath.normalized })
          return
        }
        const backup = backupSource(sourcePath)
        const temporary = `${sourcePath.target}.${randomUUID()}.tmp`
        writeFileSync(temporary, body.content, { flag: 'wx', mode: 0o600 })
        renameSync(temporary, sourcePath.target)
        recordOperation('source_saved', {
          path: sourcePath.normalized,
          backup,
          previousLines: lineCount(previous),
          nextLines: lineCount(body.content),
        })
        sendJson(response, 200, {
          status: 'saved',
          path: sourcePath.normalized,
          backup,
          previewUrl: `http://${host}:${appPort}/`,
          qualityNext: ['npm run typecheck', 'npm run lint', 'npm run build'],
        })
        return
      }

      if (requestUrl.pathname === '/api/builder/page') {
        const data = readLocalData()
        const backupTarget = join(backupRoot, new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-'), '.SYSTEMX/LAN/Files/local-data.json')
        mkdirSync(dirname(backupTarget), { recursive: true, mode: 0o700 })
        copyFileSync(localDataFile, backupTarget)
        const page = body.operation === 'create-page'
          ? createLocalPage(data, body)
          : updateLocalPage(data, body)
        writeLocalData(data)
        recordOperation('page_model_updated', { operation: body.operation, pageId: page.id, backup: relative(repoRoot, backupTarget).replaceAll('\\', '/') })
        sendJson(response, 200, { status: 'saved-local-model', page, backup: relative(repoRoot, backupTarget).replaceAll('\\', '/') })
        return
      }

      if (requestUrl.pathname === '/api/builder/component') {
        if (body.confirmation !== 'SAVE MODULE') throw new Error('Type SAVE MODULE to approve this local module definition')
        const result = saveComponent(body)
        sendJson(response, 200, { status: 'saved-local-component', ...result })
        return
      }

      if (requestUrl.pathname === '/api/builder/ingest') {
        if (body.confirmation !== 'SCAN EXISTING PROJECT') throw new Error('Type SCAN EXISTING PROJECT to approve an inventory scan')
        if (typeof body.projectRoot !== 'string' || !body.projectRoot.trim()) throw new Error('An existing project root is required')
        const projectRoot = resolve(body.projectRoot.trim())
        if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) throw new Error('Existing project root is not a directory')
        const manifest = inspectExternalProject(projectRoot)
        const manifestPath = writeIngestManifest(manifest)
        recordOperation('existing_project_ingest', { projectRoot, manifestPath, mode: manifest.mode })
        sendJson(response, 200, { status: 'inventory-complete', manifest, manifestPath, next: 'Review needs-review findings before installing a SYSTEMX bridge.' })
        return
      }

      if (requestUrl.pathname === '/api/builder/record') {
        const data = readLocalData()
        const resource = body.resource === 'users' ? 'users' : 'collections'
        if (!body.record || typeof body.record !== 'object') throw new Error('Record is required')
        if (resource === 'collections') {
          const collection = data.collections.find((item) => item.id === body.collectionId)
          if (!collection) throw new Error('Unknown collection')
          collection.rows.push({ id: randomUUID(), ...body.record, createdAt: new Date().toISOString() })
        } else {
          data.users.push({ id: randomUUID(), ...body.record, status: 'local fixture', provider: 'firebase-auth' })
        }
        writeLocalData(data)
        recordOperation('local_record_created', { resource, collectionId: body.collectionId ?? null })
        sendJson(response, 200, { status: 'saved-local-record', data })
        return
      }

      if (requestUrl.pathname === '/api/builder/preview') {
        sendJson(response, 200, { status: 'preview-ready', url: `http://${host}:${appPort}/`, emulatorMode: 'start Firebase emulators separately for local data services' })
        return
      }
    } catch (error) {
      sendJson(response, 400, { error: error.message })
      return
    }
  }

  const file = resolvePublicFile(requestUrl.pathname)
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    sendText(response, 404, 'Not found')
    return
  }

  response.statusCode = 200
  response.setHeader(
    'Content-Type',
    mimeTypes[extname(file).toLowerCase()] ?? 'application/octet-stream',
  )

  if (request.method === 'HEAD') {
    response.end()
    return
  }

  if (file === dashboardFile) {
    const html = readFileSync(dashboardFile, 'utf8')
    const status = await getStatus()
    response.end(
      renderDashboardHtml(html, status).replace(
          '<script type="application/json" id="systemx-status-data">{}</script>',
          `<script type="application/json" id="systemx-status-data">${escapeJsonScript(status)}</script>`,
        ),
    )
    return
  }

  createReadStream(file).pipe(response)
})

server.listen(port, host, () => {
  if (!testMode) {
    const existingSession = readSession(repoRoot)
    const session = existingSession?.sessionId === sessionId
      ? {
          ...existingSession,
          processes: { ...existingSession.processes, lan: process.pid },
          ports: { ...existingSession.ports, lan: port, app: appPort },
          urls: {
            ...existingSession.urls,
            lan: `http://${host}:${port}/`,
            app: `http://${host}:${appPort}/`,
            bridge: `http://${host}:${appPort}/__systemx/`,
          },
        }
      : {
          schemaVersion: 1,
          sessionId,
          ownerPid: Number.parseInt(process.env.SYSTEMX_SESSION_OWNER_PID ?? String(process.pid), 10),
          processes: { lan: process.pid },
          ports: { lan: port, app: appPort },
          urls: {
            lan: `http://${host}:${port}/`,
            app: `http://${host}:${appPort}/`,
            bridge: `http://${host}:${appPort}/__systemx/`,
          },
          mode: process.env.SYSTEMX_SESSION_ID ? 'combined' : 'lan-only',
          startedAt: new Date().toISOString(),
        }
    writeSession(repoRoot, session)
  }
  console.log(`[SYSTEMX LAN] http://${host}:${port}/`)
  console.log('[SYSTEMX LAN] Loopback-only local builder shell')
})

function shutdown() {
  if (!testMode) clearSession(repoRoot, sessionId)
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
