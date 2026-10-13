# Optional Gusto Firebase adapter

This is WebAppX host code. Shared portable guidance belongs in
[`.SYSTEMX/GUSTO`](../../.SYSTEMX/GUSTO/README.md). The app's credential-free HR
demo uses synthetic browser state and the development SDK mock adapter. It does
not automatically connect to this optional Firebase module.

## Account-free browser workflows

Start `npm run dev` from the repository root. `/hr/demo` provides native
onboarding, benefits election/waiver, timesheet submission/manager approval and
payroll preparation/calculation/review/simulated submission. Confirmed benefits
and approved eligible time feed the native payroll simulation. Reset sample
changes restores the original records; reload clears this browser memory.

`/hr/demo/sdk` runs genuine SDK **0.56.6** directory, selected administrative
onboarding and regular payroll flows against a Vite-only mock API pinned to
**2026-06-15**. The server issues isolated sessions with a one-hour inactivity
expiry and a 128-session cap. Requests omit browser credentials, and the mock
refuses cookies, authorization, credential fields, foreign resource IDs and
unsupported endpoints. No request is forwarded to Gusto. Reset SDK samples
restores this session; refresh creates a new session.

| File | Development mock purpose |
| --- | --- |
| [mock-api.mjs](mock-api.mjs) | Issued sessions, request limits and Vite development middleware |
| [sdk-onboarding.mjs](sdk-onboarding.mjs) | Saved data steps, explicit simulated form/report review and completed-status readback |
| [sdk-payroll.mjs](sdk-payroll.mjs) | Preparation, edits, calculate/poll, review, fake submission/poll and replay guards |
| [sdk-employees.fixture.json](sdk-employees.fixture.json) | Fictional employee directory seed |
| [sdk-payroll.fixture.json](sdk-payroll.fixture.json) | Separate zero-tax, Check-payment SDK payroll seed |

The SDK and native scenarios have separate state. Benefits and raw timesheets
use native WebAppX interfaces. The selected SDK sample excludes direct-deposit
setup, I-9, legal signing/filing, payroll cancellation, receipt/paystub/check PDF
downloads and other provider operations. The development API is absent from
Hosting and `npm run preview`. Run `npm run hr:test` for the native transition,
published API-client contract and backend checks. Follow
[Gusto setup](../../docs/GUSTO-SETUP.md) for the complete walkthrough.

## Optional Firebase adapter

The Functions package defaults to `disabled`. Its implemented operations are
trusted membership inspection, a synthetic employee directory and native time
off creation. Real Gusto forwarding and payroll execution return
`failed-precondition`, including when mode is `demo` or `production`.
Webhook ingestion has a separate reviewed configuration gate and only queues
authenticated event metadata; it does not reconcile payroll or submit payments.

See the complete [Firebase architecture and activation guide](../../docs/GUSTO-FIREBASE.md).

| File | Purpose |
| --- | --- |
| [schema.json](schema.json) | Organization scoped model and ownership for all HR domains |
| [firestore.rules](firestore.rules) | Optional deny by default HR rules, separate from root rules |
| [firestore.indexes.json](firestore.indexes.json) | Reviewed directory, time off and event queue indexes |
| [firebase.example.json](firebase.example.json) | Standalone local reference configuration; not active root configuration |
| [config.example.json](config.example.json) | Disabled capability and readiness contract |
| [functions/src/security.mjs](functions/src/security.mjs) | Role, tenant and provider resource authorization |
| [functions/src/projections.mjs](functions/src/projections.mjs) | Minimal safe projections and validated native requests |
| [functions/src/webhooks.mjs](functions/src/webhooks.mjs) | Raw byte HMAC, event binding and transactional deduplication |
| [functions/src/backend.mjs](functions/src/backend.mjs) | Cloud independent service boundary with synthetic records |
| [functions/src/index.mjs](functions/src/index.mjs) | Optional second generation Firebase Functions wrapper |

From the repository root, run the account-free backend checks:

```bash
node --test tests/hr/gusto-backend.test.mjs
npm --prefix integrations/gusto/functions ci --ignore-scripts
npm --prefix integrations/gusto/functions run check
npm --prefix integrations/gusto/functions audit --audit-level=high
npm --prefix integrations/gusto/functions run test:rules
```

Node 22 is the declared deployment runtime. Local test output must state the
actual runtime used. The package has its own lockfile and dependencies; do not
reuse a sibling project's `node_modules` or commit credentials and runtime files.

The optional rules test requires an installed Firebase CLI and Java supported by
the Firestore emulator. It selects unused loopback ports for its own Auth,
Firestore, hub, logging and websocket services, uses only
`demo-systemx-gusto-rules`, and stops its own emulators after the test. It refuses
live or non loopback test endpoints. On Windows, set the local environment value
`FIREBASE_CLI_JS` to the installed `firebase-tools/lib/bin/firebase.js` entry point
so the runner invokes Node with an argument array instead of a command shell.
