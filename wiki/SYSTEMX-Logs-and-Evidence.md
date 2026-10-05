# SYSTEMX Logs and Evidence

SYSTEMX keeps public docs, local runtime evidence, and release history in
different places on purpose. The template is now an advanced local builder and
co-management system, so operators need to know which record answers which
question.

## Evidence map

| Question | Source |
| --- | --- |
| What changed in the public template release? | `wiki/Update-Log.md` and `.SYSTEMX/webapp-version/CHANGELOG.md` |
| What work is next, active, or done? | `.SYSTEMX/status/TODO.md`, `.SYSTEMX/status/IN_PROGRESS.md`, `.SYSTEMX/status/DONE.md` |
| What did the LAN builder write locally? | `.SYSTEMX/LAN/Temp/operations.jsonl` |
| Where are pre-write snapshots? | `.SYSTEMX/LAN/Backup/<timestamp>/` |
| Where are local component/data fixtures? | `.SYSTEMX/LAN/Files/` |
| Where are inventory-only ingest findings? | `.SYSTEMX/LAN/Temp/ingest/<run-id>/manifest.json` |
| What local app/LAN ports are active? | `npm run systemx:session:status` |
| What build/type evidence was just verified? | Current terminal output and follow-up status entry |

## Local-only rules

`.SYSTEMX/LAN/Temp`, `.SYSTEMX/LAN/Backup`, and `.SYSTEMX/LAN/Files` are local
operator evidence areas. They are not public routes, not Firebase Hosting
content, and not production CMS records. They must not contain secrets,
service-account JSON, access tokens, private keys, passwords, or live customer
data.

The LAN builder writes evidence before and after local mutations:

- page model updates;
- allowlisted source saves;
- reusable component registry updates;
- inventory-only existing-project scans;
- backup paths tied to the operation;
- session id and UTC timestamp.

The evidence is review material, not deploy authorization. A saved LAN model
or source file still needs the normal SYSTEMX gates: typecheck, lint, build,
security review, provider preflight, and explicit deploy authority.

## Reading the current local log

Use these commands from the repository root:

```bash
tail -n 40 .SYSTEMX/LAN/Temp/operations.jsonl
npm run systemx:session:status
git status --short
npm run typecheck
npm run build
```

The local log is intentionally JSONL so tools can summarize it without loading
long conversations or exposing unrelated state. If an AI agent needs context,
feed it the last relevant log entries plus the matching backup path, not the
entire repository.

## Public update policy

README is the product landing page. It should describe the current template
and link to the wiki.

The wiki update log is the public release history. Keep it concise and safe for
public readers.

`.SYSTEMX/webapp-version/CHANGELOG.md` is the operational release log. It can include
more implementation detail, but it must still exclude secrets and private
customer/vendor workflows.

`.SYSTEMX/status/` is the work log for the template itself. Use it to show what
is done, what is active, and what remains blocked or planned.

## Standalone integration in this unified template

The current universal tools, docs, examples and MEDIA library are retained in
`.SYSTEMX/.systemx/releases/<selected-version>/`. `INSTALLATION.json` selects and
pins that release; `SYSTEMX.sh` routes to it. Outer `GLOBAL`, `PLAN`, `WORK`,
`MEMORY` and `AGENTS` ship reusable records; `project.json` supplies host
commands and checks to configure for the adopted project. Import receipts
live in `.SYSTEMX/imports/`; manager runtime receipts remain ignored under
`.SYSTEMX/.systemx/operations/`. Historical LAN status and feature evidence retain
their original scope. See [Standalone SYSTEMX Integration](SYSTEMX-Standalone-Integration).
