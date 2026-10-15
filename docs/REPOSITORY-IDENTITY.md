# Repository identity receipt

WX-0835 adds a read-only receipt before an already authorized source publication.
Run it from the repository root after preparing and reviewing the intended
commit, and immediately before the publication step:

```bash
npm run repository:identity
npm run repository:identity -- --json
```

The default expected repository is `WayneTechLab/WebAppX`. An adopted app must
name its intended GitHub repository explicitly:

```bash
npm run repository:identity -- --expected-repository Example/adopted-app --json
```

Only the exact `--expected-repository OWNER/REPO` spelling is accepted. URLs,
duplicate flags and unknown arguments are usage errors. `--help` performs no
Git probes. The report writes to stdout; it creates no receipt file. If retaining
JSON as local evidence, choose a path outside tracked template records.

The receipt does not grant permission to publish or deploy. Existing operator
authorization and the release instructions in [template maintenance](TEMPLATE-MAINTENANCE.md)
continue to apply. Required local checks, Hosting preflight, provider acceptance
and production deployment remain separate evidence. A successful receipt does
not run those checks or establish a GitHub repository's visibility, ownership
settings, template settings, Actions status or current Hosting content.

## Recorded observations

The text and schema version 1 JSON reports contain:

- Expected GitHub identity and effective origin fetch/push identities, normalized
  to `OWNER/REPO`; both destinations must match the expected repository.
- Current branch, HEAD, local `main`, configured upstream, its local revision,
  and HEAD's ahead/behind counts against that local upstream.
- A fresh `ls-remote` observation of the exact `refs/heads/main` SHA from the
  approved GitHub repository, plus a separate comparison with captured HEAD.
- Whether local `origin/main` equals that directly observed remote revision.
- Independent tracked, staged, unstaged, untracked and conflict counts, plus
  bounded repository-relative path samples and rename source paths.
- Observation time, complete/incomplete state, assessment, review reasons and
  stable error labels. Ref and worktree rechecks flag changes during the report.

Local tracking refs are cached evidence. A local `0 ahead / 0 behind` does not
establish direct remote parity, and matching commit pointers do not establish a
clean worktree. Direct revision comparisons use captured commit SHAs, ignore Git
replacement objects and grafts, and do not fetch missing commit objects. If the
direct revision is absent locally, its SHA is still reported, while ancestry
remains unknown and the receipt is unverified.

The receipt is a bounded observation without a repository lock. Re-run it when
the checkout, branch, index, origin, upstream or remote revision changes before
the authorized publication. It does not claim an atomic snapshot or reserve the
remote revision against concurrent changes.

## Assessments and exit status

| Assessment | Meaning | Exit |
| --- | --- | --- |
| `clean-parity` | Complete observations; clean `main`; upstream is `origin/main`; local tracking and HEAD equal direct remote `main`. | `0` |
| `clean-ahead` | Complete observations; clean `main`; upstream and local tracking match direct remote `main`; captured HEAD contains that exact remote revision and has local commits awaiting publication review. | `0` |
| `needs-review` | Observations identify local changes, another branch, detached HEAD, a missing/wrong upstream, stale tracking refs, or behind/diverged history. | `1` |
| `unverified` | Repository identity is refused, a required query fails, output is malformed or too large, ancestry cannot be established, or the checkout changes during observation. | `1` |
| Usage error | Invalid arguments; no Git commands run. | `2` |

`--help` exits `0`. Exit `1` is an evidence result; the command performs no repair
and introduces no additional authorization flow. Clean local commits ahead of a
verified remote ancestor are the normal source publication case and exit `0`.

A failed direct query is reported as unavailable; parity and direct ahead/behind
remain unknown. This may reflect network, access or service failure, or a missing
remote `main`. The command does not infer which from potentially sensitive Git
stderr. Matching local tracking refs cannot turn this result into a pass.

## Read-only and disclosure bounds

Every Git invocation uses an argument array with no shell, a 10 second timeout
and a 1 MiB output limit. No fetch, pull, push, staging, commit, checkout, cleanup,
index write, configuration edit or provider activation is performed. Git optional
locks and fsmonitor are disabled; inherited Git environment overrides are removed.
The tests compare all temporary checkout and Git metadata bytes before and after
the receipt, including staged changes, blank seeds and a release fixture.

Configured clean/process filters may execute during Git status. The command
checks effective configuration **key names** and refuses that status query if an
executable content filter is configured. It also refuses status for indexed
submodules, whose nested configuration could execute a filter. These cases report
an unknown worktree and an unverified receipt; the command never runs, disables
or repairs the configured filter or submodule. Output overflow similarly remains
unknown, with no partial clean-state conclusion.

Only credential-free standard GitHub HTTPS and Git SSH origin forms are accepted.
The direct query always uses canonical HTTPS with repository/global/system Git
configuration isolated, URL rewrites excluded, interactive prompts and credential
helpers disabled, redirects disabled, and other transport protocols refused.
It performs an anonymous read of the approved GitHub repository; a private app
requiring credentials may therefore report unavailable. No origin URL, password,
token, raw stderr, environment value, absolute machine path or file content is
included in the report. Effective alternate or multiple fetch/push destinations
fail closed before a direct remote query.

Up to 50 change records are displayed, with a maximum of 240 characters per path
before an explicit abbreviation. Total counts still cover all parsed records;
omitted records and path truncation are explicit. Unexpected absolute or
traversing path forms are omitted. Text paths are JSON escaped to keep control
characters from changing terminal output. Ignored files are excluded by Git and
their contents are never inspected.

## Focused verification

```bash
npm run repository:identity:test
```

The suite uses injected command results and disposable repositories. It covers
dirty index/worktree combinations, untracked paths, renames, diverged or stale
refs, clean local commits ahead of direct main, missing upstream, unreachable
remote results, hostile origins, explicit adoption, command limits, credential
redaction, unsafe filters, ancestry substitution and preservation of local bytes.
Tests do not contact or modify a real remote. Local macOS verification does not
establish Windows x64 or ARM64 runtime acceptance; platform-specific null-device
arguments are covered through injected observations.
