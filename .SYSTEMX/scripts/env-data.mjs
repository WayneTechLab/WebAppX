import { readFileSync, realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const deploymentKeys = new Set([
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'EMAIL_API_KEY',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM_ADDRESS',
  'ADMIN_BOOTSTRAP_TOKEN', 'FIREBASE_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_PROJECT_ID', 'GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT',
  'SYSTEMX_GOOGLE_FONTS_API_KEY',
])

// Parse environment assignments as data. Never evaluate shell expressions,
// substitute variables, or execute commands from an environment file.
export function parseEnvData(text) {
  const values = new Map()
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (!match) throw new Error(`Invalid environment assignment at line ${index + 1}`)
    let value = ''
    let quote = null
    const input = match[2].trim()
    for (let cursor = 0; cursor < input.length; cursor += 1) {
      const character = input[cursor]
      if (character === quote) { quote = null; continue }
      if (!quote && (character === "'" || character === '"')) { quote = character; continue }
      if (character === '\\' && quote !== "'") {
        const next = input[++cursor]
        if (next === undefined) throw new Error(`Incomplete escape at line ${index + 1}`)
        value += next
      } else if (!quote && character === '#' && (cursor === 0 || /\s/.test(input[cursor - 1]))) {
        value = value.trimEnd()
        break
      } else {
        value += character
      }
    }
    if (quote || value.includes('\0')) throw new Error(`Invalid environment value at line ${index + 1}`)
    values.set(match[1], value)
  }
  return values
}

export function parseDeploymentEnv(text) {
  const values = parseEnvData(text)
  for (const key of values.keys()) {
    if (!deploymentKeys.has(key)) throw new Error(`Unsupported deployment secret key: ${key}`)
  }
  return values
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const values = parseDeploymentEnv(readFileSync(process.argv[2], 'utf8'))
    for (const [key, value] of values) process.stdout.write(`${key}\0${value}\0`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
