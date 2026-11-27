import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'
import { workerCsp } from '@waynetechlab/webappxai/vite'

const root = new URL('../../../', import.meta.url)
const vendor = new URL('vendor/webappxai/', root)
const readJson = async url => JSON.parse(await readFile(url, 'utf8'))

test('the installed local runtime matches the reviewed WebAppXai tag, including license notices', async () => {
  const [source, pkg, lock] = await Promise.all([
    readJson(new URL('SOURCE.json', vendor)),
    readJson(new URL('package.json', vendor)),
    readJson(new URL('package-lock.json', root)),
  ])
  assert.equal(source.tag, 'v' + pkg.version)
  assert.equal(source.repository, 'WayneTechLab/WebAppXai')
  assert.match(source.commit, /^[0-9a-f]{40}$/)
  assert.equal(lock.packages[''].dependencies[pkg.name], 'file:vendor/webappxai')
  const installed = new URL('../', import.meta.resolve(pkg.name))
  const files = []
  async function verify(directory) {
    for (const entry of await readdir(new URL(directory, vendor), { withFileTypes: true })) {
      const path = directory + entry.name
      if (entry.isDirectory()) {
        await verify(path + '/')
        continue
      }
      assert.ok(entry.isFile(), path)
      const bytes = await readFile(new URL(path, vendor))
      assert.equal(createHash('sha256').update(bytes).digest('hex'), source.files[path], path)
      assert.deepEqual(await readFile(new URL(path, installed)), bytes, path)
      files.push(path)
    }
  }
  await verify('runtime/')
  assert.deepEqual(files.sort(), Object.keys(source.files).sort())
})

test('Firebase Hosting applies the tagged runtime policy to the worker', async () => {
  const { hosting } = await readJson(new URL('firebase.json', root))
  const headers = hosting.headers.find(rule => rule.source === '/webappxai/worker.js')?.headers
  assert.equal(headers?.find(header => header.key === 'Content-Security-Policy')?.value, workerCsp)
})
