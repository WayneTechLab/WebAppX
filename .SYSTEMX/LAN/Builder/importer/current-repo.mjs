import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const routeByPage = {
  HomePage: '/',
  AboutPage: '/about',
  ServicesPage: '/services',
  DocsPage: '/docs',
  LoginPage: '/login',
  ContactPage: '/contact',
  NotFoundPage: '*',
}

function filesUnder(root, directory, extensions = new Set(['.tsx', '.ts', '.css'])) {
  const target = join(root, directory)
  if (!existsSync(target)) return []
  const found = []
  const visit = (current, relativeDirectory) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relativePath = `${relativeDirectory}/${entry.name}`
      const absolutePath = join(current, entry.name)
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath)
      } else {
        const extension = entry.name.slice(entry.name.lastIndexOf('.'))
        if (extensions.has(extension)) found.push(relativePath)
      }
    }
  }
  visit(target, directory)
  return found.sort()
}

function componentRole(source) {
  const name = source.slice(source.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '').toLowerCase()
  if (/(nav|header|topbar|navbar)/.test(name)) return 'header'
  if (/(footer|bottom)/.test(name)) return 'footer'
  if (/(modal|dialog|drawer|menu)/.test(name)) return 'overlay'
  if (/(card|panel|section|container|layout)/.test(name)) return 'section'
  return 'component'
}

function componentCandidate(source) {
  const role = componentRole(source)
  const baseName = source.slice(source.lastIndexOf('/') + 1).replace(/\.tsx$/, '')
  return {
    id: source.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    name: baseName,
    kind: 'react-component',
    role,
    source,
    tags: ['template', role, 'local-source'],
    slots: [],
    responsive: { width: 'fluid', behavior: 'inherit-from-source' },
    status: 'detected',
    export: { format: 'systemx-component', version: 1 },
  }
}

function sourceFiles(root) {
  const candidates = [
    ...filesUnder(root, 'src/pages'),
    ...filesUnder(root, 'src/components/layout'),
    ...filesUnder(root, 'src/components/navigation'),
    ...filesUnder(root, 'src/components/shell'),
    ...filesUnder(root, 'src/config'),
    ...filesUnder(root, '.SYSTEMX/KIT/Brand', new Set(['.md', '.json', '.svg', '.png'])),
    ...filesUnder(root, '.SYSTEMX/KIT/Production', new Set(['.md', '.json', '.svg', '.png'])),
  ]
  return candidates.filter((file) => {
    const target = join(root, file)
    return existsSync(target) && statSync(target).isFile()
  })
}

export function inspectCurrentRepository(root, branch = 'unknown') {
  const pageFiles = filesUnder(root, 'src/pages', new Set(['.tsx']))
  const pages = pageFiles.map((file) => {
    const name = file.slice(file.lastIndexOf('/') + 1, -'.tsx'.length)
    return {
      id: name.replace(/Page$/, '').toLowerCase() || 'page',
      name,
      route: routeByPage[name] ?? null,
      source: file,
      state: routeByPage[name] ? 'mapped' : 'unmapped',
      editPolicy: 'backup-diff-confirm',
    }
  })
  const routes = pages
    .filter((page) => page.route)
    .map((page) => ({ path: page.route, source: page.source, kind: page.route === '*' ? 'fallback' : 'page' }))
  const components = filesUnder(root, 'src/components', new Set(['.tsx']))
    .map(componentCandidate)

  return {
    schemaVersion: 1,
    target: 'current-repo',
    mode: 'template-edit',
    repository: { root, branch, writePolicy: 'backup-diff-confirm' },
    pages,
    routes,
    components,
    tokens: {
      sources: ['src/index.css', 'src/config/siteControls.ts'],
      policy: 'token-first-sanitized-css',
    },
    collections: [],
    sourceFiles: sourceFiles(root),
    evidence: [],
  }
}

function readJsonFile(root, relativePath) {
  const target = join(root, relativePath)
  if (!existsSync(target) || !statSync(target).isFile()) return null
  try {
    return JSON.parse(readFileSync(target, 'utf8'))
  } catch {
    return null
  }
}

function walkProjectFiles(root, maxFiles = 1200) {
  const ignored = new Set(['.git', 'node_modules', 'dist', 'build', '.SYSTEMX'])
  const files = []
  const visit = (current, relativeDirectory) => {
    if (files.length >= maxFiles) return
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
      const absolutePath = join(current, entry.name)
      if (entry.isDirectory()) visit(absolutePath, relativePath)
      else files.push(relativePath)
      if (files.length >= maxFiles) return
    }
  }
  visit(root, '')
  return files.sort()
}

function inferExternalPages(files) {
  return files
    .filter((file) => /(^|\/)(pages|app|routes)(\/|\/.*\/).*(\.(tsx|jsx|ts|js|vue|svelte|html))$/.test(file) || /(^|\/)(pages|app)\/[^/]+\.(tsx|jsx|ts|js|vue|svelte|html)$/.test(file))
    .slice(0, 240)
    .map((source) => ({ source, state: 'detected', route: null, mapping: 'needs-review' }))
}

export function inspectExternalProject(projectRoot) {
  const root = join(projectRoot)
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error('Existing project root is not a directory')
  const packageJson = readJsonFile(root, 'package.json')
  const files = walkProjectFiles(root)
  const sourceFiles = files.filter((file) => /\.(tsx|jsx|ts|js|vue|svelte|css|scss|html)$/.test(file)).slice(0, 500)
  const components = sourceFiles
    .filter((file) => /(^|\/)(components|ui|layouts|layout|shared)(\/|\/.*\/).*(\.(tsx|jsx|vue|svelte))$/.test(file))
    .slice(0, 240)
    .map((source) => ({
      id: source.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
      name: source.slice(source.lastIndexOf('/') + 1).replace(/\.[^.]+$/, ''),
      source,
      role: componentRole(source),
      state: 'detected',
      mapping: 'needs-review',
    }))
  const dependencyNames = Object.keys({ ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) })
  const framework = dependencyNames.includes('next') || dependencyNames.includes('nuxt')
    ? 'next/nuxt'
    : dependencyNames.includes('vite')
      ? 'vite'
      : dependencyNames.includes('astro')
        ? 'astro'
        : dependencyNames.includes('react')
          ? 'react'
          : dependencyNames.includes('vue') || dependencyNames.includes('nuxt')
            ? 'vue'
            : dependencyNames.includes('svelte') || dependencyNames.includes('@sveltejs/kit')
              ? 'svelte'
              : dependencyNames.includes('@angular/core')
                ? 'angular'
                : 'unknown'
  const providerFiles = files.filter((file) => /firebase|gcloud|google|stripe|supabase|prisma|drizzle|sql|storage|firestore/i.test(file) && !/(^|\/)(\.env|secrets?)/i.test(file)).slice(0, 120)
  const sensitiveFiles = files.filter((file) => /(^|\/)(\.env|\.env\.|.*\.(pem|key|p12|json\.secret))$/i.test(file)).slice(0, 80)
  return {
    schemaVersion: 1,
    status: 'needs-review',
    mode: 'inventory-only',
    projectRoot: root,
    generatedAt: new Date().toISOString(),
    project: {
      name: packageJson?.name ?? root.split('/').pop(),
      framework,
      packageManager: existsSync(join(root, 'pnpm-lock.yaml')) ? 'pnpm' : existsSync(join(root, 'yarn.lock')) ? 'yarn' : 'npm-compatible',
      scripts: Object.keys(packageJson?.scripts ?? {}).slice(0, 120),
    },
    pages: inferExternalPages(files),
    components,
    providers: providerFiles,
    styles: sourceFiles.filter((file) => /\.(css|scss)$/.test(file)).slice(0, 120),
    routes: sourceFiles.filter((file) => /router|route|routes|next\.config|vite\.config/i.test(file)).slice(0, 100),
    tooling: files.filter((file) => /(^|\/)(playwright|cypress|vitest|jest|eslint|tsconfig|firebase|\.github)/i.test(file)).slice(0, 120),
    security: {
      secretsNotRead: true,
      sensitiveFileCount: sensitiveFiles.length,
      sensitiveFiles: sensitiveFiles.map(() => '[redacted path]'),
      writeAllowed: false,
    },
    findings: [
      { state: 'detected', message: 'Inventory was read without opening secret files or installing SYSTEMX.' },
      { state: 'needs-review', message: 'Route and component mappings require operator approval before bridge installation.' },
      { state: 'blocked', message: 'No files are modified by the ingest operation.' },
    ],
    limits: { filesScanned: files.length, maxFiles: 1200, truncated: files.length >= 1200 },
  }
}
