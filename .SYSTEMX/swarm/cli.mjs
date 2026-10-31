#!/usr/bin/env node
import { createController, loadManifest } from './runtime.mjs'

const commands = ['plan', 'next', 'status', 'prepare', 'sync', 'run', 'verify', 'review', 'alpha', 'feedback', 'integrate', 'publish-plan', 'publish', 'ready', 'merge-plan', 'merge', 'observe-merge', 'accept', 'close', 'advance']
const usage = `SYSTEMX host swarm (selected upstream release is unchanged)
Usage: node .SYSTEMX/swarm/cli.mjs COMMAND --manifest FILE [--repo PATH] [options]
Commands: ${commands.join(', ')}
Common: --state-dir PATH --slot 1..10 --apply
prepare: --task ID --executable ABSOLUTE_PATH [--arg VALUE ...]
sync: [--sync-digest SHA256]                 Read-only IDE/Codex handoff check
run: --sync-digest SHA256                   Requires fresh slot sync observation
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
  const options = { args: [] }, keys = new Set(['manifest', 'repo', 'state-dir', 'slot', 'task', 'executable', 'arg', 'sync-digest', 'reviewer', 'evidence-digest', 'expires-minutes', 'reason', 'gh-executable', 'pr', 'plan-digest', 'base-revision'])
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index]
    if (flag === '--apply' || flag === '--delete-branch') { if (options[flag]) throw new Error('Duplicate flag.'); options[flag] = true; continue }
    if (!flag.startsWith('--') || !keys.has(flag.slice(2)) || index + 1 === rest.length) throw new Error('Unknown or missing option. Use --help.')
    const value = rest[++index]
    if (flag === '--arg') options.args.push(value)
    else { if (options[flag] !== undefined) throw new Error('Duplicate option.'); options[flag] = value }
  }
  if (!options['--manifest']) throw new Error('An explicit --manifest FILE is required.')
  return { command, options }
}

try {
  const parsed = parse(process.argv.slice(2))
  if (parsed.help) process.stdout.write(`${usage}\n`)
  else {
    const options = parsed.options
    const controller = createController({ repo: options['--repo'] ?? process.cwd(), manifest: loadManifest(options['--manifest']), stateDir: options['--state-dir'] })
    const common = { slot: options['--slot'] === undefined ? undefined : Number(options['--slot']), apply: options['--apply'] === true, ghExecutable: options['--gh-executable'] ?? 'gh' }
    const requests = {
      plan: () => controller.plan(), next: () => controller.next(common.slot), status: () => controller.status(),
      prepare: () => controller.prepare({ ...common, taskId: options['--task'], executable: options['--executable'], args: options.args }),
      sync: () => controller.sync(common.slot, options['--sync-digest']),
      run: () => controller.run({ ...common, syncDigest: options['--sync-digest'] }),
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
    process.stdout.write(`${JSON.stringify(await requests[parsed.command](), null, 2)}\n`)
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({ code: error.code ?? 'SWARM_INVALID', error: error.code ? error.message : 'Invalid local swarm input or unavailable repository state; inspect configuration separately.' })}\n`)
  process.exitCode = 1
}
