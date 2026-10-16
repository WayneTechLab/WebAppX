# Local identity adoption rehearsal

The local rehearsal previews a small, explicit identity change in a disposable
copy of a reviewed public commit. It leaves the original template, its working
files and ignored state untouched. The command implements the local preview
scope of original **WX-0021**; it does not create or configure an adopted app.

This is separate from [mirror synchronization](SYSTEMX-INTEGRATION.md#adoption-and-optional-template-mirrors) and the
[private-adoption checklist](examples/private-template-adoption.md). The mirror
command retains its existing behavior. This rehearsal has no source-apply or
existing-destination mode.

## Prepare public input

Prerequisites are Python 3 and a local Git installation with the exact reviewed
public commit available. No Node dependency installation, Firebase account,
provider credential or service is needed. Choose the public source revision
deliberately; uncommitted and ignored files are excluded even when the working
tree is dirty. A local object observation does not prove remote publication.

Create a public JSON specification in your own temporary location:

```json
{
  "schemaVersion": 1,
  "repository": { "owner": "Example-Org", "name": "sample-app" },
  "packageName": "sample-app",
  "site": {
    "title": "Sample App",
    "description": "A fictional account-free application preview.",
    "openGraphTitle": "Sample App",
    "openGraphDescription": "Public fictional preview."
  },
  "project": {
    "name": "Sample App",
    "description": "Fictional local identity rehearsal."
  },
  "projectPlaceholder": "your-sample-project-id"
}
```

This specification accepts exactly the shown fields, with `projectPlaceholder`
optional. It contains public display values only. There are no credential,
environment, URL, hook, file-map or executable-command fields. Unknown keys,
duplicate JSON keys and coercion are refused.

- Repository owner is 1–39 ASCII letters, digits or hyphens, starting and ending
  with a letter or digit. Repository name is 1–100 ASCII letters, digits, dots,
  underscores or hyphens, starts with a letter/digit, and contains no `..` or
  `.git` suffix. This is a deliberately finite input subset.
- Package name is an unscoped 1–64-character lowercase name, starting with a
  letter/digit and otherwise using letters, digits, dots, underscores or hyphens.
- Site titles and project name have at most 160 Unicode characters;
  descriptions have at most 500. Empty, surrounding-whitespace and control or
  format-character values refuse. HTML text and attributes are escaped.
- Optional project placeholder has at most 63 characters and the inert grammar
  `your-WORD[-WORD…]-project-id`, with one to five lowercase letter/digit words.
  A real service target is not an accepted input.
- The complete UTF-8 input is at most 8 KiB and must be a regular, single-link
  file. A symlink or duplicate-key input refuses.

## Run the preview

From the template root, replace both placeholders with your reviewed full commit
and public input file. A revision must be exactly 40 lowercase hexadecimal
characters; a branch name or `HEAD` is not accepted.

```bash
python3 -B scripts/adoption-dry-run.py --revision REVIEWED_40_HEX_COMMIT --identity /path/to/public-identity.json
```

An explicit local source root works from another working directory:

```bash
python3 -B /path/to/WebAppX/scripts/adoption-dry-run.py --source /path/to/WebAppX --revision REVIEWED_40_HEX_COMMIT --identity /path/to/public-identity.json
```

The command prints JSON and exits 0 for a completed rehearsal, 1 for a refused
source/specification, or the argument parser's nonzero code for unsupported
arguments. It does not accept `--apply`, `--target` or a destination path.
Argument arrays are used for every Git child process. The command reads local
objects, with no fetch, remote query, lazy object download or shell execution.

## Exact substitution map

| Identity category | Temporary effect | Preserved boundary |
| --- | --- | --- |
| Repository/destination | Report selected owner/name as **proposed only**. | No remote, folder or repository is created or changed. |
| Root package | Change `package.json.name`, lock top-level `name`, and `package-lock.json.packages[''].name` together. | Lock version 3, versions, scripts, dependencies and every other semantic field remain unchanged. Starter and Functions packages are independent. |
| Site | Replace only HTML `title`, description `content`, `og:title` content and `og:description` content. | Other HTML and rendered source branding remain unchanged; no global string replacement. Each field must exist exactly once. |
| Deployment | When selected, substitute only `.firebaserc.projects.default` from `your-firebase-project-id` to another inert placeholder. | The source must still be unconfigured. No real project, Hosting target, environment or provider is selected or contacted. Without the optional field, `.firebaserc` is byte-exact. |
| Project display | Change only `.SYSTEMX/project.json.project.name` and `.description`. | Schema version 1, checks and command argument arrays remain semantically unchanged. GLOBAL, PLAN, WORK, MEMORY and AGENTS seeds remain byte-exact. |

The three root package names must agree before substitution. Required files and
supported field shapes are checked in the committed copy. Missing or ambiguous
HTML fields, unsupported lock/schema versions, a configured deployment target,
duplicate keys or oversized source display values refuse the whole rehearsal.
JSON field files may be reformatted in the disposable copy; the report provides
their complete before/after file digests and the precise semantic field map.

## Copy, preservation and cleanup

The command validates the complete committed file list before copying any blob.
It supports at most 10,000 regular files, 256 MiB total and 32 MiB per blob, with
an 8-MiB listing ceiling. Identity field files are at most 2 MiB; parsed JSON is
bounded to depth 64 and 100,000 value/container nodes. Paths have at most 64
components, 1,024 UTF-8 bytes total and 255 bytes per component.

Traversal, symbolic links, Git submodules/special entries, file/directory and
case/Unicode-normalization collisions, nonportable Windows names, dependency
folders, Git metadata and known local state paths refuse. Live `.env*` paths
refuse; only the two existing root/starter `.env.example` paths are accepted as
public examples. Ignored/untracked files are never enumerated or copied.

The source worktree is not used to supply file bytes: the command reads only
the selected commit's blobs, verifies their Git object hashes, and writes them
under one newly owned temporary directory. It does not execute copied scripts,
hooks, package commands, filters or setup. No `.git` directory is copied. All
unmapped committed files, including managed releases, research/checksums and
blank records, are compared byte for byte in the copy. Git mode metadata is
retained; executable bits are also checked on POSIX. This is not native Windows
runtime evidence.

The JSON report contains the exact source commit, file/byte counts, before/after
manifest digests, changed-file digests, bounded public semantic values and
`appliedToSource: false`. It omits source and temporary machine paths. Its
validation scope is finite substitution/preservation, not template parity after
intentional identity divergence, dependency installation or runtime acceptance.
The owned copy is removed on success and refusal; no caller-supplied destination
is removed. The report exposes no path for keeping or applying that copy.

The command explicitly leaves rendered branding/assets, starter and optional
Functions identities, real repository/service configuration and private project
records for separate deliberate review. Follow the existing adoption checklist
for an actual new application; this rehearsal grants no authority to create,
publish or deploy one.

## Focused local verification

```bash
python3 -B -m unittest discover -s tests/systemx -p test_adoption_dry_run.py -v
```

The focused tests use disposable committed repositories in paths with spaces
and Unicode. They compare independent literal JSON/HTML results, complete source
bytes/modes including ignored and Git state, unchanged releases/research/seeds,
and cleanup after success and deliberate corruption. They also cover unsafe
paths/links/collisions, input and copy budgets, missing/unsupported schemas and
CLI execution from an unrelated working directory. No install, service, provider
or deployment is part of these tests. Agent 0 owns integrated gates and original
criterion acceptance separately.
