# HR, CMS and CRM workspace backups — 2026-10-14

This WebAppX 3.4.0 follow-up starts from source
`2f3fbdfd96046ff1a9c93b5df05fab317ec9c2a3`. It adds local JSON file export and
import to each native mock portal. The earlier
[browser persistence receipt](PORTAL-PERSISTENCE-QA-2026-10-14.md) remains a
historical checkpoint for the underlying save layer.

## Backup and replacement contract

Each file contains one whole portal: `format: webappx-mock-workspace`,
`schemaVersion: 1`, `module`, canonical UTC `exportedAt`, and `data`. It includes
saved records, private mock drafts and receipts, irrespective of the selected
preview role. Unsaved fields, live timers, authentication, provider credentials,
unrelated browser data and the separate SDK session are excluded.

Export validates the current serialized snapshot. File import checks size,
format, version, portal, timestamp and the full portal graph, then previews the
file, time and record counts. Nothing changes before **Replace HR/CMS/CRM
workspace**. Cancel and invalid files preserve existing records. Applying an
import repeats validation and writes successfully before replacing the current
state; a storage failure preserves the previous workspace and save. Replacement
resets transient forms/timers and affects only that portal.

Files are plaintext fictional data, read locally with no upload or account.
They replace rather than merge. Importing into another browser or origin creates
an independent save, with the existing refresh/private-browser/last-writer
limits. Receipts remain mock records, not provider or employment acceptance.

## Browser observations

Tests use the running local app at two separate origins, numeric loopback and
localhost. The target origin began with original fixtures. This exercises
file transfer between independent browser storage areas; it is not a
Safari/Firefox/Windows compatibility certification.

| Area | Observed result |
| --- | --- |
| CMS download | Saved `Portable CMS sample backup` as article revision 3 and downloaded a real JSON file through Export workspace. |
| CMS preview/Cancel | The target retained original article revision 1 until replacement. The file preview showed two content records, one publication and two actions. Cancel preserved the original workspace. |
| CMS import/refresh | Re-selected the file, explicitly replaced CMS and refreshed. Revision 3 and its title returned; an unsaved edit in the target did not survive replacement. |
| File refusals | In CMS, selected an HR backup, malformed JSON, version 999 and an 8,002,049-byte file. Each produced an error and retained the imported revision 3. No replacement controls were offered for invalid files. |
| HR linked transfer | Confirmed Avery's health election, approved eight hours as Morgan and submitted payroll. Exported/imported the full HR workspace, refreshed and opened payroll: `MOCK-PAYROLL-0002`, eight hours, $240 gross, $48 illustrative withholding, $25 benefit deduction and $167 net remained intact. |
| HR graph refusal | Changed a file's time-entry employee reference to an unknown employee. Import rejected the incompatible graph. Refresh retained the previous submitted payroll receipt. |
| CRM linked transfer | Qualified/converted Portal Reset Demo, advanced its $1,500 opportunity to won, then exported/imported/refreshed. The target retained three companies, three contacts, three leads, three opportunities, six actions, $1,500 won and $6,500 open pipeline. |
| Replace without merge | Created a target-only CRM lead, then imported the earlier backup. After replacement/refresh the extra lead was absent and the original converted lead remained. |
| Full-state round trips | Re-exported all three imported workspaces. Comparing parsed `data` against each source download showed exact equality for HR, CMS and CRM; only export timestamps differed. |
| Portal isolation | HR and CMS imports survived the later CRM import/replacement. A rejected HR import preserved the submitted payroll, CMS revision 3 and CRM's $1,500 won value after refresh/navigation. |

## Verification

- The combined portal suite passed 54 cases, including 12 new backup codec
  cases and six safe-apply cases. These cover full HR/CMS/CRM snapshots,
  metadata/schema errors, nested graph rejection, wrong portal, reserved keys,
  Unicode, exact size boundaries, serialization failures, denied storage and
  failed writes preserving earlier saved bytes.
- TypeScript, scoped ESLint and the independent bounded integration review
  passed before browser verification.

- `npm run ci:all` passed with **116 HR and 54 portal/storage/backup tests**
  (**170 total**), 235 shared SYSTEMX cases (five case-sensitive-filesystem
  cases skipped), 30 host integration cases, eight security operations cases
  and 11 app/LAN cases.
- Full lint, TypeScript, template/import/research integrity, SYSTEMX drift,
  security/auth/AI checks, documentation links, production build and LAN
  isolation passed. Root and optional HR backend audits reported zero
  vulnerabilities.

- `npm run deploy -- hosting --preflight` passed, skipped version/changelog/Git
  mutation, push and deployment, and retained version 3.4.0/deployment count zero.
- Final documentation links and SYSTEMX drift checks passed before publication.

Managed SYSTEMX releases, research fingerprints and reusable blank seeds are
preserved. This is local mock and source-publication evidence, not production
deployment or a live provider acceptance record.
