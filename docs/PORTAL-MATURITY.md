# Account-free portal maturity workflows

Use fictional data in a fresh evaluation browser context. Start with
`npm run dev:mock`, open the exact loopback origin it prints and choose
`/portals`. Workspace saves belong to that scheme, hostname, port and profile.
No Gusto, Firebase or other account is required for these native journeys.

## Payroll, compensation and time corrections

1. Finish employee onboarding and submit time. A different scoped manager must
   approve it. A manager may instead return submitted time with a visible reason;
   it becomes an unpaid draft and is excluded until corrected/resubmitted/approved.
2. The owner edits only their unpaid drafts. Date/hours and the employee/day
   24-hour aggregate are rechecked. Delete requires **Confirm delete draft**;
   **Keep draft** cancels. Approved/consumed time and submitted payroll history
   remain immutable under these actions.
3. Open **Management → Payroll workspace**. Choose **Sample period start/end**;
   valid periods contain 1–366 calendar days. The initial seed has no configured
   hourly rates. Fixture compensation amounts have no inferred hourly cadence.
4. In **Configure fictional hourly rates**, select **Rate employee**, enter
   **Fictional hourly rate (dollars)** and **Rate effective date**, then **Add
   sample rate**. Configure each otherwise-eligible employee/work date. Later
   changes need later effective dates; rates are selected by the time-entry date.
5. Read **Time-entry eligibility** for every included/excluded row. Prepare,
   calculate, review and simulate submission. A prepared run freezes period,
   dates, hours, rates and confirmed benefit inputs. Later approved-input/rate/
   benefit changes make it stale and block next stages until **Reprepare sample
   payroll**. No real wage, tax, overtime or benefit engine is implemented.
6. Read the submitted receipt and **Employee → My pay** under the correct
   employee identity. Frozen rates/periods remain after later timeline changes.
   Legacy submitted receipts retain their historical fields; legacy unfinished
   preparations require deliberate new setup.

The [paced HR demo](demos/HR-FIVE-MINUTE.md) explicitly configures Avery/Jordan
at fictional $30/hour for October 1–15, preserving its independently calculated
$401 net. The [new browser evidence](PORTAL-MATURITY-QA-2026-10-15.md) uses a
separate $25/$40 scenario and a $239 net. Do not mix their starting records.

## CMS validation and unsaved edits

Both create/edit forms report every invalid field and focus the first invalid
control. Summary links and inline errors identify the affected controls. Existing
title/body/slug limits and draft/published slug reservations still apply.

Switching entries with meaningful unsaved changes presents **Keep editing** or
**Discard changes and switch**. Keep preserves the buffer and entry. Discard
changes temporary UI only. Saving establishes a clean baseline. Normalization
of surrounding whitespace and slug case alone is not a dirty change. Author
buffers survive preview identity changes; review/publication remain separately
scoped actions and published content stays frozen beside later drafts.

## CRM import validation

Import accepts only supported string enum values, complete record shapes and
valid owner/company/contact/opportunity/task relationships. Arrays cannot become
strings through coercion. Unsupported notes, oversized fields and broken edges
refuse before replacing in-memory records or browser saves, including invalid
CRM inside a combined backup whose CRM module was not selected.

## Named history, inspection and differences

In **Restore points & Undo**, enter a **Restore point name**, select **Capture
HR/CMS/CRM**, inspect the storage/retention preview and choose **Create named
restore point**. This writes only history. It does not import, apply a restore,
change workspace saves or clear unsaved forms. Labels are trimmed single-line
text of 1–100 characters. **Point label → Save point label** renames an existing
point without altering its ID, capture time, scope or payload.

History keeps at most five points within two million serialized characters.
Oldest points can be removed to fit a manual/automatic capture; an oversized
newest point refuses. Growing a label cannot silently prune other points. Normal
workspace exports exclude history and remain a separate portable backup.

**Inspect captured records** shows every captured collection with complete
counts and at most eight identifiers per row, plus exact omissions. Primary
records, nested records and metadata are distinguished to avoid double counting.
Free text, names, email values, amounts, comments and survey answers stay hidden.

Combined restore and Undo show current-to-target **added/removed/changed** counts
for the selected modules, using stable IDs. A changed hidden field affects its
record's count without being displayed. Preview/detail actions do not write
saves, history or activity. Undo confirms the exact previewed point; changed or
missing history requires refresh and review before any replacement.

## Session navigation and verification

Directory cards and shared portal links return to the last supported subsection
in the mounted session. Unsupported URLs cannot replace it. There is no new
localStorage/sessionStorage preference. A fresh document starts at defaults;
selected restores remount only their portal's temporary UI. The subsequent
[safety extension](PORTAL-SAFETY-QA-2026-10-15.md) adds shared dirty-navigation
decisions, explicit comparison of a dirty CMS editor retained across replacement
and independently enabled pre-import/Reset points. Accepted Reset still clears
the editor. The current [state contract](PORTAL-STATE-CONTRACT.md) defines those
boundaries; the original maturity receipt keeps its original observations.

```bash
npm run maturity:test
npm run browser:maturity
npm run ci:plan
```

The first checks independent model contracts; the second runs real controls,
downloads and complete saved-state comparisons in four owned Chromium contexts.
Neither needs keys/accounts or uses an existing browser profile. Required full
CI and Hosting preflight remain separate publishing gates. Read the
[state contract](PORTAL-STATE-CONTRACT.md), [role examples](HR-ROLE-EXAMPLES.md),
[capability gap map](GUSTO-CAPABILITY-GAPS.md) and
[QA receipt](PORTAL-MATURITY-QA-2026-10-15.md) for scope and actual results.
