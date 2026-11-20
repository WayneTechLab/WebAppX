import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { inspectBuildConfig, validBuildConfig } from '../Builder/importer/inventory-build-config.mjs'

const ts = createRequire(import.meta.url)('typescript')
const configPath = 'vite.config.ts'
const inspect = source => {
  const findings = []
  const evidence = { path: configPath, sha256: createHash('sha256').update(source).digest('hex') }
  const result = inspectBuildConfig({ ts, source, evidence, path: configPath, issue: (...args) => findings.push(args) })
  const validEvidence = ref => ref?.path === configPath && ref.sha256 === evidence.sha256 && Object.keys(ref).length === 2
  assert.ok(validBuildConfig(result.buildTargets, result.bridges, validEvidence))
  return { ...result, findings, validEvidence }
}

test('the template declares a loopback listener and a variable-port proxy; preview has no separate proxy declaration', () => {
  const source = readFileSync(new URL('../../../vite.config.ts', import.meta.url), 'utf8')
  const { bridges, buildTargets, findings } = inspect(source)
  assert.deepEqual(findings, [])
  assert.deepEqual(buildTargets.map(row => [row.field, row.state, row.directory]), [
    ['build.outDir', 'inferred', 'dist'], ['build.assetsDir', 'inferred', 'assets'], ['publicDir', 'inferred', 'public'],
  ])
  assert.equal(bridges.length, 1)
  const { line, evidence, ...bridge } = bridges[0]
  assert.equal(evidence.path, configPath)
  assert.match(source.split('\n')[line - 1], /__systemx/)
  assert.deepEqual(bridge, { field: 'server.proxy', route: '/__systemx', state: 'declared', listener: 'loopback-literal',
    target: 'loopback-prefix', portSource: 'environment-fallback', rewrite: 'strip-prefix', preview: 'inherits-server-proxy' })
  assert.doesNotMatch(JSON.stringify(bridges), /SYSTEMX_LAN_PORT|7331|127\.0\.0\.1/)
})

test('declared conventional relative directories, disabled public assets and explicit empty preview proxy', () => {
  const { bridges, buildTargets, findings } = inspect("export default { publicDir:false, build:{outDir:'./build/client',assetsDir:'static/media'}, server:{host:'127.0.0.1',proxy:{'/__systemx':'http://localhost:1234'}},preview:{proxy:{}} }")
  assert.deepEqual(buildTargets.map(row => [row.field, row.state, row.directory]), [
    ['build.outDir', 'declared', 'build/client'], ['build.assetsDir', 'declared', 'static/media'], ['publicDir', 'disabled', undefined],
  ])
  assert.deepEqual(findings, [])
  assert.equal(bridges[0].target, 'loopback-literal')
  assert.equal(bridges[0].preview, 'explicit-empty-proxy')
})

test('private paths, external targets, executable code and unknown proxy hooks stay outside portable metadata', () => {
  const cases = [
    "export default { publicDir:'/Users/SECRET_CANARY',build:{outDir:'../SECRET_CANARY'},server:{host:true,proxy:{'/__systemx':'https://SECRET_CANARY.example'}} }",
    "export default { publicDir:'src/SECRET_CANARY', build:{assetsDir:readSecret()},server:{proxy:{'/__systemx':{target:'http://localhost:1234',configure:readSecret}}} }",
    "export default { ...readSecret(), build:{outDir:'dist'} }",
    "export default { server:{ proxy:{ [readSecret()]: '/SECRET_CANARY' } } }",
    "export default { server:{ proxy:{ '/__systemx':{target:'http://localhost:1234'}, '/SECRET_CANARY':'ignored' } } }",
    "import {defineConfig} from 'vite'; export default defineConfig(() => { throw new Error('SECRET_CANARY') })",
    "export default { publicDir:'public', publicDir:'SECRET_CANARY' }",
    "export default { build:{rollupOptions:{output:[{dir:'SECRET_CANARY'}]}} }",
  ]
  for (const source of cases) {
    const { findings, buildTargets, bridges } = inspect(source)
    assert.ok(findings.length > 0)
    assert.ok(bridges.every(bridge => bridge.state === 'unresolved'))
    assert.doesNotMatch(JSON.stringify({ findings, buildTargets, bridges }), /SECRET_CANARY|readSecret|https:\/\//)
  }
})

test('computed or misqualified variable targets carry no loopback guarantee, preview setting or environment data', () => {
  const source = "const port=process.env.OTHER_PRIVATE ?? '1000'; export default {server:{host:pick(),proxy:{'/__systemx':{target:\u0060http://127.0.0.1:\u0024{port}\u0060}}},preview:pick()}"
  const { bridges, findings } = inspect(source)
  assert.ok(findings.length)
  assert.equal(bridges[0].target, 'unresolved')
  assert.equal(bridges[0].portSource, 'unresolved')
  assert.equal(bridges[0].preview, 'unresolved')
  assert.doesNotMatch(JSON.stringify(bridges), /OTHER_PRIVATE|1000|127\.0\.0\.1/)
})

test('retained metadata rejects extra fields, new paths, contradictory roles and altered evidence', () => {
  const { bridges, buildTargets, validEvidence } = inspect("export default {server:{proxy:{'/__systemx':'http://127.0.0.1:1000'}}}")
  for (const patch of [{raw:'PRIVATE'}, {target:'external'}, {portSource:'environment-fallback'},
    {evidence: {path:'/private',sha256:'0'.repeat(64)}}, {route:'/other'}]) {
    assert.equal(validBuildConfig(buildTargets, [{ ...bridges[0], ...patch }], validEvidence), false)
  }
  for (const patch of [{directory:'private/project'}, {field:'__proto__'}, {directory:'release'}, {state:'disabled'}, {line:-1}]) {
    assert.equal(validBuildConfig([{ ...buildTargets[0], ...patch }], [], validEvidence), false)
  }
  assert.equal(validBuildConfig([buildTargets[0], buildTargets[0]], [], validEvidence), false)
  assert.equal(validBuildConfig([], [bridges[0], bridges[0]], validEvidence), false)
})

test('a URL without a literal port retains the protocol default; private input evidence cannot enter a result', () => {
  const source = "export default {server:{proxy:{'/__systemx':'http://localhost/'}}}"
  const safe = inspect(source)
  assert.equal(safe.bridges[0].portSource, 'http-default')
  const findings = []
  const result = inspectBuildConfig({ ts, path: configPath, source, evidence: { path: '/private/secret', sha256: '0'.repeat(64) }, issue: (...args) => findings.push(args) })
  assert.deepEqual(result, {buildTargets: [], bridges: []})
  assert.deepEqual(findings, [['invalid-vite-config-evidence', configPath, 1]])
})
