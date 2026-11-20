#!/usr/bin/env node
import { createController, loadManifest } from './runtime.mjs'

const commands = ['goal', 'plan', 'wave', 'next', 'status', 'prepare', 'prepare-wave', 'sync', 'run', 'run-wave', 'verify', 'review', 'alpha', 'feedback', 'integrate', 'publish-plan', 'publish', 'ready', 'merge-plan', 'merge', 'observe-merge', 'accept', 'close', 'advance']
const usage = `SYSTEMX host swarm (selected upstream release is unchanged)
Usage: node .SYSTEMX/swarm/cli.mjs COMMAND [--repo PATH] [options]
All commands except goal require --manifest FILE.
Commands: ${commands.join(', ')}
Common: --state-dir PATH --slot 1..10 --apply
goal: [--limit 1..100] [--manifest FILE [--state-dir PATH]]  Validated LAN catalog and optional wave
wave:                                        Read-only assignments across available slots
prepare: --task ID --executable ABSOLUTE_PATH [--arg VALUE ...]
prepare-wave: --wave-digest SHA256 --executable ABSOLUTE_PATH [--arg VALUE ...] --apply
sync: [--sync-digest SHA256]                 Read-only IDE/Codex handoff check
run: --sync-digest SHA256                   Requires fresh slot sync observation
run-wave:                                   Preview prepared generations and their runDigest
run-wave: --run-digest SHA256 --apply       Run that reviewed group concurrently
review: --reviewer agent.z --evidence-digest SHA256
alpha: --evidence-digest SHA256 [--expires-minutes 1..15]
feedback: --reason TEXT                     Invalidates checks/review/Alpha lease
integrate: --base-revision FULL_GIT_SHA      Merges current target into owned worker
publish: [--gh-executable PATH]             Publishes exact branch and draft PR
merge-plan/merge: --pr NUMBER [--plan-digest SHA256] [--gh-executable PATH]
accept: --reviewer agent.0 --evidence-digest SHA256
close: [--delete-branch] [--gh-executable PATH]
advance: --base-revision FULL_GIT_SHA       Requires all generations closed
Every mutation requires --apply; a plan/readiness observation grants no authority.
No provider/account is installed, authenticated or selected automatically.`

function parse(argv) {
  const [command, ...rest] = argv
  if (command === '--help' || command === 'help' || !command) return { help: true }
  if (!commands.includes(command)) throw Object.assign(new Error('Choose a supported swarm command. Use --help.'), { code: 'COMMAND_INVALID' })
  const options = { args: [] }, keys = new Set(['manifest', 'limit', 'repo', 'state-dir', 'slot', 'task', 'executable', 'arg', 'wave-digest', 'run-digest', 'sync-digest', 'reviewer', 'evidence-digest', 'expires-minutes', 'reason', 'gh-executable', 'pr', 'plan-digest', 'base-revision'])
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index]
    if (flag === '--apply' || flag === '--delete-branch') { if (options[flag]) throw new Error('Duplicate flag.'); options[flag] = true; continue }
    if (!flag.startsWith('--') || !keys.has(flag.slice(2)) || index + 1 === rest.length) throw new Error('Unknown or missing option. Use --help.')
    const value = rest[++index]
    if (flag === '--arg') options.args.push(value)
    else { if (options[flag] !== undefined) throw new Error('Duplicate option.'); options[flag] = value }
  }
  if (command === 'goal') {
    if (options.args.length || Object.keys(options).some(key => !['args', '--repo', '--manifest', '--state-dir', '--limit'].includes(key)) || (options['--state-dir'] && !options['--manifest'])) {
      throw Object.assign(new Error('Goal accepts --repo, --limit and an optional --manifest with --state-dir.'), { code: 'OPTION_INVALID' })
    }
    if (options['--limit'] !== undefined && !/^(?:[1-9][0-9]?|100)$/.test(options['--limit'])) {
      throw Object.assign(new Error('Choose a goal sample limit from 1 through 100 per gate.'), { code: 'GOAL_LIMIT_INVALID' })
    }
  } else {
    if (!options['--manifest']) throw new Error('An explicit --manifest FILE is required.')
    if (options['--limit'] !== undefined) throw Object.assign(new Error('--limit applies only to goal.'), { code: 'OPTION_INVALID' })
  }
  if (command === 'wave' && (options.args.length || Object.keys(options).some(key => !['args', '--manifest', '--repo', '--state-dir'].includes(key)))) {
    throw Object.assign(new Error('Wave accepts only --manifest, --repo and --state-dir.'), { code: 'OPTION_INVALID' })
  }
  if (command === 'prepare-wave' && Object.keys(options).some(key => !['args', '--manifest', '--repo', '--state-dir', '--wave-digest', '--executable', '--apply'].includes(key))) {
    throw Object.assign(new Error('Prepare-wave requires the reviewed wave digest and an explicit executable for all assignments.'), { code: 'OPTION_INVALID' })
  }
  if (command === 'run-wave' && (options.args.length || Object.keys(options).some(key => !['args', '--manifest', '--repo', '--state-dir', '--run-digest', '--apply'].includes(key)))) {
    throw Object.assign(new Error('Run-wave uses the providers already pinned for the reviewed slots.'), { code: 'OPTION_INVALID' })
  }
  if (command !== 'run-wave' && options['--run-digest'] !== undefined) {
    throw Object.assign(new Error('--run-digest applies only to run-wave.'), { code: 'OPTION_INVALID' })
  }
  return { command, options }
}

let applying = false
process.stdout.on('error', error => {
  if (error.code === 'EPIPE' && !applying) return
  process.exitCode = 1
  const message = applying ? 'Could not deliver the operation receipt. Inspect status before retrying.' : 'Could not write the swarm report.'
  process.stderr.write(message + '\n')
})

try {
  const parsed = parse(process.argv.slice(2))
  applying = parsed.options?.['--apply'] === true
  if (parsed.help) process.stdout.write(`${usage}\n`)
  else {
    const options = parsed.options
    const repo = options['--repo'] ?? process.cwd()
    const controller = options['--manifest'] ? createController({ repo, manifest: loadManifest(options['--manifest']), stateDir: options['--state-dir'] }) : undefined
    const common = { slot: options['--slot'] === undefined ? undefined : Number(options['--slot']), apply: options['--apply'] === true, ghExecutable: options['--gh-executable'] ?? 'gh' }
    const requests = {
      goal: async () => {
        const { readLanGoal } = await import('./lan-goal.mjs')
        return readLanGoal({ publicRoot: repo, limit: options['--limit'] === undefined ? undefined : Number(options['--limit']), controller })
      },
      plan: () => controller.plan(), wave: () => controller.wave(), next: () => controller.next(common.slot), status: () => controller.status(),
      prepare: () => controller.prepare({ ...common, taskId: options['--task'], executable: options['--executable'], args: options.args }),
      'prepare-wave': () => controller.prepareWave({ waveDigest: options['--wave-digest'], executable: options['--executable'], args: options.args, apply: common.apply }),
      sync: () => controller.sync(common.slot, options['--sync-digest']),
      run: () => controller.run({ ...common, syncDigest: options['--sync-digest'] }),
      'run-wave': () => controller.runWave({ runDigest: options['--run-digest'], apply: common.apply }),
      verify: () => controller.verify(common),
      review: () => controller.review({ ...common, reviewer: options['--reviewer'], evidenceDigest: options['--evidence-digest'] }),
      alpha: () => controller.alpha({ ...common, evidenceDigest: options['--evidence-digest'], expiresMinutes: options['--expires-minutes'] === undefined ? 10 : Number(options['--expires-minutes']) }),
      feedback: () => controller.feedback({ ...common, reason: options['--reason'] }),
      integrate: () => controller.integrate({ ...common, baseRevision: options['--base-revision'] }),
      'publish-plan': () => controller.publishPlan(common), publish: () => controller.publish(common), ready: () => controller.ready(common),
      'merge-plan': () => controller.mergePlan({ ...common, prNumber: Number(options['--pr']) }),
      merge: () => controller.merge({ ...common, prNumber: Number(options['--pr']), planDigest: options['--plan-digest'] }),
      'observe-merge': () => controller.observeMerge(common),
      accept: () => controller.accept({ ...common, reviewer: options['--reviewer'], evidenceDigest: options['--evidence-digest'] }),
      close: () => controller.close({ ...common, deleteBranch: options['--delete-branch'] === true }),
      advance: () => controller.advance({ ...common, baseRevision: options['--base-revision'] }),
    }
    const result = await requests[parsed.command]()
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (['prepare-wave', 'run-wave'].includes(parsed.command) && result.status === 'partial') process.exitCode = 1
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({ code: error.code ?? 'SWARM_INVALID', error: error.code ? error.message : 'Invalid local swarm input or unavailable repository state; inspect configuration separately.' })}\n`)
  process.exitCode = 1
}
