# CRM duplicates and merges

Use the account-free CRM preview to review possible duplicates and deliberately
merge two fictional contacts or companies. Open `/crm/demo`, then choose
**Duplicates & merges**. No account, external lookup, email or provider write is
required. Use fictional names, `.invalid` addresses and sample amounts only.

**Verification status — 2026-10-15:** the focused composed browser run passed
35 groups: 20 preserved lifecycle groups and 15 new CRM groups, with seven owned
CRM contexts and 24 literal status witnesses. That observation is bound to
[runtime freeze 2](evidence/crm-merge-runtime-freeze-2-2026-10-15.json).
The current source is freeze 3 after an EOF-only cleanup; the focused result is
not relabeled as a freeze-3 run. Independent browser review, integrated CI,
Hosting preflight and Agent 0 acceptance remain pending in the dated
[CRM adoption QA receipt](CRM-ADOPTION-QA-2026-10-15.md). The
[merge contract](CRM-MERGE-CONTRACT.md) records the reviewed source rules.

## Open the local preview

1. Run `npm run dev:mock` from the repository and open the local origin printed
   by Vite. Visit `/crm/demo` at that same origin.
2. Read the browser storage notice. Saved sample actions survive refresh only
   when the browser accepts the save; unsaved form fields are temporary.
3. Choose **CRM preview identity**, then **Duplicates & merges**.
4. If you want an earlier branch to keep, choose **Export workspace** before
   applying a merge. The export contains the complete CRM workspace.

The identity selector demonstrates native access rules. It does not sign in a
customer, authenticate a sales representative or secure browser storage.

| Preview identity | Candidate report and current records | Merge authority | Recorded merge history |
| --- | --- | --- | --- |
| Owner or sales manager | All supported CRM owners | Any compatible graph whose records share one current owner | Complete captures, labeled as captured at the receipt |
| Sales representative | Their own scope | Their own compatible graph only | Recorded-owner IDs, policy and counts; private captures and current hidden joins are excluded |
| Auditor | Read-only synthetic workspace | No merge actions | Complete captures, labeled as historical |

Changing an owner through **Ownership** remains an owner or sales manager
operation. A match or historical ID does not grant ownership or current access.

## Read candidate matches

**CRM duplicate candidates** is a read-only report. Company-name comparisons trim
and collapse whitespace and ignore case. Contact and lead email comparisons trim
outer whitespace and ignore case. These comparisons leave the original fields
unchanged. Punctuation, accents, email dots and plus tags have no special alias
rule; there is no fuzzy search or automatic merge.

| Classification shown | Meaning |
| --- | --- |
| **Candidate for deliberate review** | Accessible records share a comparison key. Review their complete fields before deciding. |
| **Expected conversion link — no merge suggested** | A converted lead and its linked contact already form the expected conversion relationship. |
| **Cross-owner match — ineligible for merge** | A visible match crosses owners. It cannot be merged as one mixed-owner operation. |

Candidate groups and their members have separate page controls. The UI shows up
to 20 entries per page within the accessible scope. A representative's report
does not add hidden owners' rows or a hidden global count.

A manual merge selection is allowed without an advisory match. The message
**No duplicate candidates are accessible in this scope** does not mean that the
whole workspace has no duplicates or that two deliberately chosen records are
necessarily compatible.

## Choose the direction deliberately

**Source** is the record to retire. **Retained** is the record to keep. Both are
explicit choices; swapping them changes which fields survive in the active
directory. The fixed `retain-target-v1` policy keeps the complete retained record
exactly. There is no field picker, automatic winner or secondary merge.

| Operation | Active result |
| --- | --- |
| Contact merge | Retire only the source contact. Keep every retained contact field. Move source-contact opportunities to the retained contact and its company. Move linked converted leads consistently, including their email. Preserve opportunity amounts, stages, IDs and other fields. |
| Company merge | Retire only the source company. Keep every retained company field. Move source-company contacts, opportunities and explicitly linked converted leads to the retained company. Preserve their other fields. |

Both operations include closed opportunities and completed tasks in their linked
review. Tasks keep their records and opportunity links. Unconverted lead company
text does not create a company edge. A company merge does not merge contacts,
leads or opportunities with one another.

Cross-company contact merges can be valid when the two companies and every
changed or contextual record share one supported owner. A missing link,
incompatible owner or converted-lead email collision refuses the whole operation.

## Preview, inspect and apply once

1. Under **Contact merge**, choose **Source contact** and **Retained contact**.
   For a company operation, use **Source company** and **Retained company**.
   Source and retained must be distinct, current, accessible records of the
   selected kind.
2. Choose **Preview contact merge** or **Preview company merge**. Missing or
   invalid choices produce the linked **Review merge selections** summary and
   focus the first invalid control. Preview changes no records, saves or receipts.
3. In **Review merge fields**, check the source, retained ID, common current
   owner, fixed policy, proposed receipt and complete saved-envelope size.
4. Read **Duplicate-name warnings**, then inspect all three record sections:
   **Retired and retained records**, **Changed linked records**, and
   **Unchanged linked context**. Changed rows show every before/after field,
   including unchanged values. Context rows were reviewed but will stay unchanged.
5. Check **Total distinct records reviewed** and the separate changed/context
   counts. The preview must contain the complete declared linked review; a
   truncated review cannot enable Apply.
6. Choose **Apply contact merge** or **Apply company merge** only if this is the
   direction and complete effect you want. The app rechecks current identity,
   workspace contents and the one-use preview before accepting the change.
7. Read the outcome and storage notice. **Fictional CRM merge accepted in
   memory. Check the browser storage notice before refreshing.** means the
   in-memory action was accepted; it does not by itself promise a successful save.

**Cancel contact merge preview** or **Cancel company merge preview** changes no
records or saved bytes, keeps the selected IDs and returns focus to its Preview
button. Editing either selection cancels that preview. There is no automatic retry.

### Interpret warnings

A company preview may include these advisories:

| Warning | What to inspect |
| --- | --- |
| `selected-name-match` | Source and retained company names normalize equally. Retiring this source is still a deliberate decision. |
| `company-name` | The retained company and another same-owner company will still have matching normalized names. The listed company IDs are part of the preview context. |
| `contact-name` | Contact names within the two companies match after whitespace/case normalization. `pre-existing` started in one company; `new-cross-company` combines one from each; `mixed` includes both situations. Exact contact and original company IDs are shown. |

Warnings do not merge the listed records or review unrelated downstream graphs
of a third company. Matching names can be intentional.

## Changed sources and retained temporary fields

A preview lasts at most ten minutes and can be used once. Source changes, an
identity or scope change, cancellation, replacement, Reset or leaving its active
scope can invalidate it. Even a replacement with identical record values is a
new reviewed source. If you see **This CRM merge preview expired or changed.
Preview again; your selections are kept.**, inspect the current choices and make
a fresh preview.

Visited CRM tabs keep their form owners while hidden. When a dirty transition
dialog appears, **Keep editing** cancels the transition and returns to the actual
form. Where **Leave and keep draft** is offered, it retains temporary text while
you move to another view. **Discard and leave** clears the forms listed in that
dialog. These choices do not submit a merge.

A merge can retire an ID selected by another open form. That form retains its
name, email, title, amount and literal selection. It displays an unavailable-ID
option and requires a deliberate current choice; it never silently substitutes
the retained record or the first option. Successful Apply rebases its own merge
selection form only. Unrelated drafts remain dirty.

A capacity refusal similarly keeps the merge selections and explains that their
current availability cannot be determined by these controls. It clears stale
preview facts and disables Preview. Hidden or retained controls have no command
authority outside the active CRM merge view.

Deliberately accepted import, selected restore, Undo or Reset follows the
existing replacement and dirty-dialog rules. Do not expect discarded temporary
forms to survive an accepted replacement.

## Receipts and historical privacy

**Recorded CRM merge history** keeps each merge's complete retired source,
retained-before record, changed before/after rows and unchanged context. The
active retained record does not acquire the retired source's name or other
fields. Full captures are labeled **Captured at this receipt**; later current
records may differ.

A representative's merge history instead shows **Captured IDs only**, the
recorded owner, policy and counts. Historical IDs grant no current access.
Transferring an account does not give its new representative the former owner's
private merge captures. A former owner cannot use a receipt to look up today's
hidden graph. Older ordinary activity retains its established recorded-owner
descriptions; this feature does not promise to redact every legacy description.

### What the first merge records

Reading reports, exporting and ordinary legacy actions do not adopt merge
history. The first successful merge captures the complete accepted legacy CRM
state and begins a typed journal of that merge and later accepted commands,
including ordinary lead, pipeline, task and ownership actions.

This boundary means **legacy records accepted when the first merge was made**.
Earlier activity descriptions stay intact. Missing old command details, actors
or times are not invented, and descriptions are not parsed into historical
commands. Later imports validate the recorded journal against the complete final
workspace. A coherent local branch is not a signed or authenticated account of
real-world events.

## Saves, exports and recovery

A merge attempts the existing browser save once after memory acceptance. If
quota or storage access fails, current memory can contain the accepted merge
while an older browser save remains. Keep the page open, read the notice and
choose **Export workspace** to keep the current complete branch before refresh.
Applying again is not a save-retry mechanism.

Exports, browser saves and recovery points contain all CRM owners' saved
records, private historical captures, the first-merge baseline and the journal.
They are readable complete snapshots, independent of the selected identity.
Unsaved form text is excluded. A representative's safe history view does not
make an export redacted. Use fictional data only.

There is no ordinary **Unmerge** command. To return to an earlier branch, review
an earlier export through **Import workspace**, or use the portal directory's
selected restore or Undo controls under their existing confirmations. These
replace the whole selected CRM branch and can remove later work. Export the
current branch first if you want both. Other portals remain separate when only
CRM is selected.

The independent settings **Require checkpoint before individual imports** and
**Require checkpoint before Reset** start off at a known default. When enabled,
a required checkpoint must save before replacement; unavailable or unknown
settings require an explicit valid choice. Review the replacement and any
checkpoint effect before confirming. **Reset CRM demo** returns CRM to its seed
and clears its temporary UI; it is not an inverse of only the last merge. With
the known default Reset setting off, Reset keeps its existing one-click behavior.
Read the storage result if removing an older save fails.

## Finite sample-workspace limits

| Limit | Behavior at the boundary |
| --- | --- |
| 200 distinct records in one complete merge review | Includes source, retained, changed rows, unchanged tasks and warning-company context. A larger review refuses in full. |
| 100 recorded merges | A further merge refuses without pruning earlier receipts. |
| 1,000 accepted commands after the first-merge boundary | Includes ordinary CRM and ownership commands as well as merges. No old journal step is silently dropped. |
| 2,000,000 characters in the complete CRM save envelope | Includes baseline, journal, captures, escaping and envelope fields. Browser quota may be smaller. |
| 20 displayed candidate groups, members, choices or history entries per page | Use their separate page controls; selected off-page IDs remain explicit. |
| Ten-minute preview lifetime | Expiry requires a fresh preview, with selections kept. |

Additional structural bounds protect validation of this finite sample format;
the [technical contract](CRM-MERGE-CONTRACT.md) records them. A valid older
workspace can remain readable through its legacy path while new merge controls
refuse their capacity. The app does not truncate a preview, repair an import or
silently prune history to make Apply available. Export a branch you need to keep
before any deliberate replacement or Reset.

## Verification commands and related guides

```sh
npm run portals:test
npm run browser:portal-lifecycle
```

`portals:test` runs the configured native portal model, codec, controller,
integration and inspection tests. `browser:portal-lifecycle` runs the existing
composed native lifecycle browser suite, including CRM journeys, against an owned
local preview with fresh owned browser contexts and cleanup. It also covers
existing lifecycle flows; it is not a CRM-only shortcut. Neither command deploys
or activates a provider. The focused browser observation above is separate from
pending integrated CI, preflight and acceptance; authored tests and these command
examples are not additional execution receipts. Native Windows and manual screen-reader acceptance
are not established by local source review or macOS automation.

- [CRM merge contract and original criteria](CRM-MERGE-CONTRACT.md)
- [Portal state and complete workspace boundaries](PORTAL-STATE-CONTRACT.md)
- [Portal lifecycle and recovery workflows](PORTAL-LIFECYCLE.md)
- [Optional adoption contracts](ADOPTION-CONTRACTS.md)
