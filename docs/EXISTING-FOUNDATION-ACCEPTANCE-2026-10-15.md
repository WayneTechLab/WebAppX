# Existing foundation acceptance review — 2026-10-15

This bounded review examines functionality already present in the WebAppX
source base `0469e11bcb17ec67b118099a73958e039c759979`. It checks the original
acceptance text for **WX-0042, WX-0452, WX-0717, WX-0783 and WX-0932** rather
than inferring completion from similar feature names. The review creates this
receipt only; Agent 0 owns catalog acceptance and integration.

## Local acceptance decisions

| Item | Original acceptance | Review result |
| --- | --- | --- |
| WX-0042 | The first-run guide separates account-free tasks from later provider registration, secret placement and operator-approved activation. | **Accepted as existing local documentation.** Getting Started first demonstrates native account-free HR, then identifies unavailable connected routes and optional backend adoption. Its separate service/deployment section puts approved Firebase client configuration in ignored `.env.local`, keeps server secrets out of client variables and tracked files, and requires separate deployment authorization. The linked Gusto guide distinguishes application-specific Demo registration from local mocks. |
| WX-0452 | Before confirmation, the UI names how many older points would be removed to retain the new point within current limits. | **Accepted as existing local behavior.** Both combined restore and Undo render the shared budget before their confirmation controls. Its labeled output shows the exact `prunedPoints` count, including zero. The focused model checks below verify count-limit and character-limit pruning against the actual retention/write plan. Its prerequisite WX-0451 was already accepted. |
| WX-0717 | Opening and canceling an Undo preview keeps keyboard navigation predictable and returns focus to its launching control. | **Behavior verified; prerequisite acceptance remains pending.** The current implementation focuses the preview heading, provides normal page-region Tab navigation and returns to the exact opening Undo button on cancellation. Existing accepted keyboard evidence covers this behavior. The catalog also depends on WX-0708, which was still TODO at review time; this receipt does not accept that broader confirmation-pattern prerequisite or independently authorize closing WX-0717. |
| WX-0783 | The guide explains why a workspace saved at localhost differs from 127.0.0.1 and how to move it with a combined backup. | **Accepted as existing local documentation.** The portal guide names scheme, hostname and port as the storage boundary, explicitly compares `localhost` with `127.0.0.1`, and supplies the export/copy/import/select/confirm procedure for combined backups. The criterion requests a guide; a new two-origin browser demonstration belongs to the separate WX-0934 criterion. |
| WX-0932 | The guide explains that local mocks need no key and that provider-issued development access belongs to the adopter's approved environment. | **Accepted as existing local documentation.** “Is there a test key?” explains the account-free local path, distinguishes a hosted demonstration from reusable credentials, and describes each app's own Demo client ID/secret. The subsequent migration sequence requires obtaining application-specific credentials and separate provider/release acceptance. This review verifies that documentation explanation, not a newly provisioned provider environment. |

## Examined source and documentation

- **First-run boundaries:** [Getting Started](GETTING-STARTED.md#try-the-hr-workspace-without-an-account)
  and [Configure services and deployment](GETTING-STARTED.md#configure-services-and-deployment).
  At the examined base, the relevant spans are lines 124–146 and 220–233.
- **Gusto access explanation:** [Is there a test key?](GUSTO-SETUP.md#is-there-a-test-key)
  and [Migration and checks](GUSTO-SETUP.md#migration-and-checks), especially the
  application-specific Demo step and separate production acceptance. At the
  examined base, the relevant spans are lines 453–468 and 526–535.
- **Retention count:** [Shared budget presentation](../src/portals/RestoreBudgetPreview.tsx)
  exposes “Older restore points removed” from `budget.prunedPoints` before
  confirmation. [Combined restore](../src/portals/CombinedWorkspaceBackup.tsx)
  and [Undo](../src/portals/RestorePointHistory.tsx) both include this preview
  before their confirmation buttons.
- **Retention consistency:** [Focused restore-budget tests](../tests/portals/restore-budget.test.mjs)
  include five-point retention, character-budget pruning, oversized-point
  refusal and exact preview/committed-envelope comparisons.
- **Undo focus:** [History controls](../src/portals/RestorePointHistory.tsx)
  retain the exact opener, focus the preview heading, restore the opener after
  cancellation/success and fall back to the history heading when necessary.
  [Keyboard restore journey](../tests/browser/keyboard-restore.mjs) asserts
  heading focus, cancellation return, collapsed `aria-expanded`, unchanged raw
  saved bytes and complete exported records.
- **Origin troubleshooting and transfer:** [Browser-local persistence](TEMPLATE-PORTALS.md#browser-local-persistence)
  explains origin ownership; [Combined backup and selective restore](TEMPLATE-PORTALS.md#combined-backup-and-selective-restore)
  supplies the actual-file transfer procedure. At the examined base, the
  relevant spans are lines 160–176 and 249–263.

## Checks and evidence reuse

On **2026-10-15**, this review ran:

```bash
node --test tests/portals/restore-budget.test.mjs
```

**Result: 12 passed, 0 failed, 0 skipped**, exit code 0. The output included
“retention preview removes the oldest point at five and matches the next
committed envelope” and “character-budget pruning is projected from the same
retention plan as the actual restore.” No storage, account or provider setup
was required for these pure synthetic checks.

The Undo browser observations are reused from the accepted
[2026-10-15 keyboard QA receipt](KEYBOARD-PORTALS-QA-2026-10-15.md), with the
corresponding source/test assertions inspected in this review. That prior
receipt records nine Chromium checks, including keyboard Undo cancellation
return and the removed-opener fallback. This receipt does **not** claim a new
browser run or repeat the previous run's counts as fresh results. Agent 0's
integrated verification should record any subsequent browser execution under
its own source revision.

Documentation acceptance above comes from reading the current complete guide
sections against the quoted criteria. This review does not refresh public
provider documentation, obtain credentials, demonstrate two-origin portability,
change catalog statuses, modify managed releases or activate services. Its
outcomes establish the local behavior/documentation scope stated for each item;
they do not establish provider, deployed environment, Windows, screen-reader or
whole-site accessibility acceptance.
