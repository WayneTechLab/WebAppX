import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { confinedDirectory, confinedFile } from '../../.SYSTEMX/LAN/Builder/runtime/file-boundary.mjs'
import { parseDeploymentEnv, parseEnvData } from '../../.SYSTEMX/scripts/env-data.mjs'

test('file policy permits regular files and refuses links in files or parents', () => {
  const base = mkdtempSync(join(tmpdir(), 'systemx-boundary-'))
  try {
    const root = join(base, 'repo')
    const outside = join(base, 'outside')
    mkdirSync(root); mkdirSync(outside)
    writeFileSync(join(root, 'regular.css'), 'body {}')
    writeFileSync(join(outside, 'data.css'), 'private fixture')
    symlinkSync(join(outside, 'data.css'), join(root, 'linked.css'))
    symlinkSync(outside, join(root, 'linked-directory'), 'dir')
    assert.equal(confinedFile(root, join(root, 'regular.css')), join(root, 'regular.css'))
    assert.equal(confinedFile(root, join(root, 'linked.css')), null)
    assert.equal(confinedFile(root, join(root, 'linked-directory/data.css')), null)
    assert.equal(confinedFile(root, join(outside, 'data.css')), null)
    assert.equal(confinedFile(root, join(root, 'missing.css')), null)
    assert.throws(() => confinedDirectory(root, join(root, 'linked-directory/backup')), /Linked/)
    assert.equal(confinedDirectory(root, join(root, 'new/backup')), join(root, 'new/backup'))
    assert.equal(readFileSync(join(outside, 'data.css'), 'utf8'), 'private fixture')
  } finally { rmSync(base, { recursive: true, force: true }) }
})

test('environment values stay literal and quoted values round-trip', () => {
  const values = parseEnvData("# fixture\nSMTP_PASSWORD='spaces & dollar $ and ` chars'\nEMAIL_FROM_ADDRESS='Wayne'\\''s Lab'\nEMPTY=\nexport SMTP_PORT=587 # local\n")
  assert.equal(values.get('SMTP_PASSWORD'), 'spaces & dollar $ and ` chars')
  assert.equal(values.get('EMAIL_FROM_ADDRESS'), "Wayne's Lab")
  assert.equal(values.get('EMPTY'), '')
  assert.equal(values.get('SMTP_PORT'), '587')
  assert.throws(() => parseEnvData('NOT_AN_ASSIGNMENT'), /Invalid environment assignment/)
  assert.throws(() => parseEnvData("KEY='unfinished"), /Invalid environment value/)
  for (const key of ['NODE_OPTIONS', 'BASH_ENV', 'PATH', 'SCRIPTS_DIR', 'DO_DEPLOY', 'npm_config_script_shell']) {
    assert.throws(() => parseDeploymentEnv(`${key}=fixture`), /Unsupported deployment secret key/)
  }
  assert.equal(parseDeploymentEnv('SMTP_PASSWORD=literal value').get('SMTP_PASSWORD'), 'literal value')
})
