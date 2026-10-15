# Combined mock backup and selective restore — 2026-10-14

This WebAppX 3.4.0 follow-up starts from
`955e4eda748a06810504dd4052889713ce4f2a24`. It adds one HR/CMS/CRM backup file
and selective restore in the portal directory. The earlier
[individual backup receipt](PORTAL-BACKUP-QA-2026-10-14.md) remains historical;
individual portal files and browser-save formats are unchanged.

## Contract

The combined file uses `format: webappx-mock-workspaces`, `schemaVersion: 1`,
canonical UTC `exportedAt`, and `workspaces` containing exactly `hr`, `cms`,
and `crm`. Export uses the current shared in-memory snapshots, including original
fixtures for untouched modules. All three complete graphs and their save limits
must validate before a file can be previewed, including later unselected modules.

Nothing is checked by default. The restore button requires at least one selected
portal. Confirmation replaces entire selected workspaces and their browser saves,
then remounts only those portals to clear temporary forms/timers. Unselected
records and browser keys remain untouched. Cancel clears the preview without
changing any workspace. Whole-file JSON is readable fictional data, including
private mock drafts and receipts; no account, upload, provider call, cloud write,
authentication data or independent SDK session is involved.

The helper validates and serializes before storage writes, captures selected
raw saves, and attempts rollback on any failed write. Browser storage has no
multi-key transaction: if rollback also fails, the UI keeps the old in-memory
workspaces and identifies saves that may have changed, with instructions to
export before refreshing. This is explicitly not an unconditional atomicity
guarantee across storage failures or concurrently edited browser tabs.

## Automated checks

- The portal suite passes 79 cases: 54 existing cases, 12 combined-codec cases
  and 13 selective-restore cases. New cases cover complete round trips,
  corrupt unselected modules, selections, limits, denied storage, first/second
  write failures, missing saves, rollback failures and input immutability.
- TypeScript and scoped ESLint passed. A separate bounded source review found
  no actionable integration defects.
- Storage failure/rollback paths are covered by controlled test doubles, not
  browser permission changes.

## Browser observations

The source used numeric loopback and the destination used localhost, two
independent storage origins in the same in-app browser. These checks do not
certify another browser engine or operating system. The source bundle included
HR receipt `MOCK-PAYROLL-0002` ($240 gross, $48 illustrative withholding, $25
benefits, $167 net), CMS article revision 3 and CRM's $1,500 won opportunity.

| Check | Observed result |
| --- | --- |
| Real combined export | Export all workspaces downloaded a real JSON file containing all three current portal payloads. |
| Default selection | The preview showed all three summaries with nothing checked. Restore selected workspaces was disabled until a checkbox was selected. |
| Cancel | Re-export after Cancel matched all three destination payloads exactly. |
| HR-only restore | HR matched the source; CMS and CRM retained their complete destination payloads, including a distinct saved CMS title and extra CRM lead. An unselected, unsaved CMS form field also survived. |
| HR-only refresh | The restored payroll receipt count remained one after refresh. |
| CMS and CRM restore | Selected CMS/CRM matched the source exactly; unselected HR retained its full destination state, including an intentionally changed HR-admin preview role. The selected CMS unsaved field cleared to the restored title. |
| Pair refresh | Re-export after refresh matched the entire pre-refresh pair result. |
| All-three restore | After full restore and refresh, all three re-exported workspace payloads matched the original source bundle exactly. |
| Full-file rejection | A corrupt CRM graph, version 999, malformed JSON, an individual-portal file and an oversized 24,008,193-byte file were rejected before restore controls appeared. Re-export after the refusals matched all three prior payloads exactly. |
| Individual controls | Individual CMS export retained its existing format. Reset CMS changed only CMS in the combined snapshot; HR and CRM remained exact. Reimporting that single-portal file and refreshing restored a combined snapshot equal to the source bundle. |

Payload comparisons parsed actual browser downloads and compared every value in
`workspaces`, ignoring only the envelope's changing export timestamp. File reads,
checkboxes, confirmation, Cancel, refresh and individual controls used the real
browser UI. Failure injection for quota/rollback remains automated-only.

## Final repository gates

- `npm run ci:all` passed: **116 HR + 79 portal/storage/backup tests**
  (**195 total**), 235 shared SYSTEMX cases (five case-sensitive-filesystem
  cases skipped), 30 host integration cases, eight security operations cases
  and 11 app/LAN cases.
- Lint, TypeScript, reusable-template/import/research checks, managed integrity,
  SYSTEMX drift, security/auth/AI checks, documentation links, production build
  and LAN isolation passed. Root and optional HR backend dependency audits
  reported zero vulnerabilities.

- `npm run deploy -- hosting --preflight` passed, skipped version/changelog/Git
  mutation, push and deployment, and retained version 3.4.0/deployment count zero.
- Final documentation links and SYSTEMX drift checks passed before publication.

Immutable SYSTEMX releases, research fingerprints and reusable blank seeds are
preserved. These are local mock and source-publication results, not production
deployment or live provider acceptance.
