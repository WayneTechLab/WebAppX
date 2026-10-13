# Optional Gusto Firebase adapter

This is WebAppX host code. Shared portable guidance belongs in
[`.SYSTEMX/GUSTO`](../../.SYSTEMX/GUSTO/README.md). The app's credential-free HR
demo uses synthetic browser state and the development SDK mock adapter. It does
not automatically connect to this optional Firebase module.

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
