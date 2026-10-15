# CI execution plan report

Run the informational plan before scheduling the complete local gate:

```sh
npm run ci:plan
npm run ci:plan -- --json
npm run ci:plan:test
```

The report reads the stage order from [the existing CI runner](../scripts/check-template.sh)
and resolves commands from [package scripts](../package.json). It prints the required
stages in their current sequential order, their dependent workspaces, and their
reviewed mutation characteristics. It also includes direct `npm run` delegation
and implicit npm `pre`/`post` script hooks. Changing the stage order or adding a
stage in the runner changes the report without updating a second gate inventory.

The report itself reads four source files and writes only standard output. It
does not execute gates, launch a shell, probe versions or providers, read
environment files or variables, contact a registry, create output files, install
dependencies, or change the required CI runner. JSON uses repository-relative
paths and excludes raw unreviewed command bodies and machine paths. Redirect
standard output yourself when a saved report is useful.

The current safety extension adds `safety:test`, `browser:safety`,
`browser:quality`, `browser:sdk-quality` and `browser:recovery-drill` to the maintained sequential
runner. Browser suites fork an owned preview worker with argument arrays,
verify its exact PID/parent and allocated loopback port, and close that same
child after browser cleanup. This verification worker disables filesystem
watching and HMR updates while retaining its allowed owned socket for Vite
connection/error messages. Ordinary local development retains hot updates. The preview-process tests cover real process
startup/shutdown, interruption during cleanup and preservation of an unrelated
listener. A stage count in this source report is separate from the executed
results in the [safety QA receipt](PORTAL-SAFETY-QA-2026-10-15.md).

## Dependent workspaces

| Workspace | Source of context | Role in the existing gate |
| --- | --- | --- |
| WebAppX root | Root `package.json` | React/Vite/Firebase source, portal models, browser runners, host integration, documentation and root dependency audit |
| Gusto Functions | `integrations/gusto/functions/package.json` | Account-free backend source tests and separate Functions dependency audit; its Node engine is reported independently |
| Managed SYSTEMX | `.SYSTEMX/INSTALLATION.json` | Selected immutable release and the outer host records used by validation and integration tests |

These workspace descriptions express source dependencies. They do not establish
that packages, browsers or tool versions are installed, or that a provider account
is available. Run [the developer prerequisite report](GETTING-STARTED.md#developer-check-and-browser-smoke)
for the version checks and the actual CI command for acceptance evidence.

## Mutation descriptions

| Report value | Meaning |
| --- | --- |
| `source-read-only` | Reviewed command reads source/configuration or validates output without a rewrite option |
| `local-version-probes` | Bounded local prerequisite version commands; no prerequisite installation |
| `local-read-only-child-processes` | Local report child processes read public source and print reports; tests compare preserved source bytes |
| `temporary-files-or-processes` | Test fixtures or owned browser/server resources can create temporary files, local listeners, caches, reports or screenshots |
| `possible-python-bytecode-cache` | Python is invoked without `-B`; interpreter cache writes remain possible |
| `local-build-output` | Build output, TypeScript metadata or local build caches can be written |
| `registry-network-and-npm-cache` | Dependency audit contacts the configured registry and npm may write cache/log files; no install or automatic fix |
| `unknown` | Command, shell syntax or transitive script behavior has not been reviewed |

Descriptions match reviewed command signatures. A familiar stage name with a
changed command becomes `unknown`; it does not inherit a read-only claim. Missing
required scripts and recursive script dependencies are also reported as unknown.
A changed `ci:all` entry point or runner shape fails the plan rather than silently
omitting execution outside the supported literal loop. The report is not a shell
interpreter, a sandbox or proof that referenced source has not changed. Review
command classifications when changing a gate's implementation.

## Actual acceptance command

```sh
npm run ci:all
```

The execution plan does not skip, parallelize, accept or weaken that gate. A
successful report is informational source evidence. It is separate from a passing
CI run, hosting preflight, a deployment, provider acceptance or production
readiness. Production deployment remains an explicit operator action.

The [report implementation](../scripts/ci-plan.mjs) and
[fixture tests](../tests/setup/ci-plan.test.mjs) cover current-source stage order,
changed gate fixtures, nested npm scripts and lifecycle hooks, unknown commands,
cycles, unsafe runner expansions and source-only reporting.
