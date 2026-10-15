# Monitoring and health evidence

This health contract addresses WX-0751. Source review date: **2026-10-15**;
examined WebAppX revision: **`f197affabfe125321c439d8a50854abe684c2355`**
(**R1** below). It describes current implementation and adoption requirements;
it does not record a newly executed health check.

## Health vocabulary

Keep these states independently reportable. A source pass does not establish
browser execution, a running process does not establish an authenticated
workflow, and local/provider Demo results do not establish deployed production
health. Record failing, stale, unobserved or inapplicable states explicitly.

| State and scope | Evidence this state can carry | Original observation / review | Recheck trigger and adoption requirement |
| --- | --- | --- | --- |
| **Source validation** | Exact revision and completed command/result for a selected declaration, model, security, build or preservation gate. `doctor` reports tool versions; `development:check` compares declarations. Existing test code or a listed command is source capability until executed. | Source inspected 2026-10-15 / R1: [CI plan](CI-EXECUTION-PLAN.md), [dependency guide](DEPENDENCY-INSTALLATION.md), [prerequisite checker](../scripts/developer-prerequisites.mjs). Reviewed 2026-10-15. | Recheck after relevant source, lockfile, policy or runtime changes. Retain output and the executed host/runtime. Inspect the actual CI plan's stages and side effects before release gates. |
| **Browser runtime** | Observed rendered workflow at an exact origin, source revision and browser/host version, with console/network/download and cleanup evidence for the exercised journey. Browser saves have the [state contract's](PORTAL-STATE-CONTRACT.md) limits. | Historical Chromium evidence: [session receipt](SESSION-CONTRACTS-QA-2026-10-15.md), observed 2026-10-15, starting base `4ca558015a66c4f7b9f50eb085f98ab62c1c8335`, carried in R1. Source reviewed 2026-10-15. | Recheck when journey, browser, persistence or origin changes. Distinguish native mocks from the separate SDK mock. Evidence applies to its tested journey/environment; full accessibility, device and provider acceptance require their own observations. |
| **Owned local process** | Session identity and fresh process observations. Session `status` rereads the record, checks recorded PIDs for liveness and obtains command text for `belongsToRepo`. Restart preview additionally inspects process birth/parent/command/CWD and listener ownership. | Source inspected 2026-10-15 / R1: [status control](../.SYSTEMX/LAN/session-control.mjs), [restart preview](../.SYSTEMX/LAN/session-restart-preview.mjs), [session storage](../.SYSTEMX/LAN/Builder/runtime/port-utils.mjs). Reviewed 2026-10-15. | Recheck before controlling/replacing a session and after PID/listener/record changes. Preserve unrelated listeners. `status: recorded` and a live PID have narrower scope than restart/stop ownership acceptance or endpoint readiness. |
| **Local startup readiness** | Separate Vite app, LAN, Auth, Firestore and Storage results, each with endpoint, status, message and `checkedAt`. Probes run only while the component is `starting`; child failures/exits can update state. Results are saved in the session record. | Source inspected 2026-10-15 / R1: [probe/tracker](../.SYSTEMX/LAN/session-supervisor.mjs), [launcher/persistence](../.SYSTEMX/LAN/dev-session.mjs). [Session receipt](SESSION-CONTRACTS-QA-2026-10-15.md) observed synthetic-listener tests 2026-10-15, starting base `4ca558015a66c4f7b9f50eb085f98ab62c1c8335`. Reviewed 2026-10-15. | Recheck after component/session/endpoint changes or a current workflow failure. Polling stops after components settle. Later `status` combines stored readiness and fresh process metadata; it does not repeat endpoint probes or refresh readiness timestamps. Observe availability/workflows afresh when needed. |
| **Optional provider connection** | Authorized observation of the actual provider environment, tenant/company, accepted identity/resource scopes and exact operation. Retain connection acceptance without exposing credentials. Native roles and `MOCK-*` receipts do not authenticate a provider. | Source inspected 2026-10-15 / R1: [Gusto backend](../integrations/gusto/functions/src/backend.mjs), [server policy](../integrations/gusto/functions/src/security.mjs), [Firebase flags](../src/config/firebase.ts), [LAN provider indicators](../.SYSTEMX/LAN/server.mjs), [provider setup](GUSTO-SETUP.md). Reviewed 2026-10-15; no live provider observation supplied by this review. | Recheck after credential, tenant, scope, mapping, API or operation changes. Gusto's reference proxy remains unavailable and reports no connection/payroll execution. Adopt transport and accept provider workflows independently; configuration booleans and badges do not supply that acceptance. |
| **Deployed health** | Verified project/target, actual deployed revision/release, observation time, URL/service response, authenticated workflow and applicable policy/runtime/monitoring signals. Deployment success and post-deployment behavior are separate observations. | Source inspected 2026-10-15 / R1: [deploy script](../.SYSTEMX/scripts/deploy.sh), [Hosting configuration](../firebase.json). [Session receipt](SESSION-CONTRACTS-QA-2026-10-15.md) observed local preflight 2026-10-15 with deployment skipped, starting base `4ca558015a66c4f7b9f50eb085f98ab62c1c8335`. Reviewed 2026-10-15; no deployed-health observation supplied. | Recheck after deployment/configuration/policy changes, incidents and at the adopted monitoring interval. Production deployment needs explicit operator authorization. Retain live response/policy/workflow evidence and owned rollback/alert paths. Local preflight, config presence and source publication do not fill this state. |

## What the local probes observe

The [supervisor](../.SYSTEMX/LAN/session-supervisor.mjs) gives each component an
independent `starting`, `ready` or `failed` state. A successful app probe can
make Vite usable while an emulator still starts or has failed. The printed
origin includes scheme, host and port; native saves belong to that exact origin
and browser profile.

| Component | Startup probe | Limit of a successful probe |
| --- | --- | --- |
| Vite app | HTTP 200 from `/portals`, with the Vite client marker | The development app responded at this endpoint; no browser journey or emulator workflow was exercised. |
| LAN service | HTTP 200 JSON from `/api/health`, with `status: online` and `mode: local-only` | The local controller answered this request; no complete builder operation or provider workflow was exercised. |
| Auth emulator | HTTP 200 JSON with `authEmulator.ready: true` | The readiness response was received; sign-in, claims and application authorization need separate tests. |
| Firestore emulator | HTTP 200 with the exact `Ok\n` health response | The health response was received; authenticated reads/writes and rule denials need separate tests. |
| Storage emulator | TCP connection to the selected loopback port | A listener accepted the connection. The probe checks no Storage HTTP identity, upload/download or authorization workflow. |

`checkedAt` is the time of the recorded state transition. The
[launcher](../.SYSTEMX/LAN/dev-session.mjs) persists changes and stops its
readiness interval when all components leave `starting`; it also handles owned
child failures/exits. An endpoint can degrade while its process stays alive and
an earlier `ready` result remains stored. The
[status command](../.SYSTEMX/LAN/session-control.mjs) combines that stored result
with fresh PID/command observations. Restart preview supplies stronger current
ownership inspection, without starting a replacement or testing workflows.

Run these from the owning checkout to inspect an existing session:

```bash
npm run systemx:session:status
npm run systemx:session:restart:preview
```

Status can exit 0 with `offline` when no owned record exists. Preview can refuse
proposed replacement when ownership/listener evidence is insufficient. Preserve
the reported reason and investigate the owning process; exit 0 is not by itself
a health observation.

The LAN dashboard has additional indicators. Its
[`/api/status` and provider checks](../.SYSTEMX/LAN/server.mjs) combine local
TCP reachability with configuration truthiness: a Firebase project ID,
`GOOGLE_APPLICATION_CREDENTIALS` for Drive and `GCLOUD_PROJECT` for Google Cloud
Storage. Labels such as `configured`, `local emulator`, `planned`, or their `ok`
value do not validate credentials or provider permissions. Browser Firebase
[`configured` and `authAvailable`](../src/config/firebase.ts) likewise describe
configuration/initialization selection, without proving authentication or a
successful backend request.

## Deployment check boundary

`npm run deploy -- --check` enters the locally named “Health/check mode.” It
creates log/version directories and a run log, attempts `ci:security`, prints
booleans for local `firebase.json` sections (`hosting`, `firestore`, `storage`,
`functions`), and exits. Security failure is tolerated by this branch; inspect
the output even when exit status is 0. The security chain includes `npm audit`,
which can contact the configured registry. This command sends no live health
request or deployed-resource query. The script also reads any configured local
secret file through its literal parser before this branch; it is not a
credentials audit. See the [implementation](../.SYSTEMX/scripts/deploy.sh) and
[security checker](../.SYSTEMX/scripts/security-check.mjs).

`npm run deploy -- hosting --preflight` exercises local release gates and skips
publishing/deployment. Retain its exact result and revision. Production
deployment requires explicit operator authorization. After an authorized
deployment, observe the actual target and behavior to populate deployed health.
The [security assumptions register](SECURITY-ASSUMPTIONS.md) records related
trust and adoption requirements.

## Adoption and response ownership

The inherited [monitoring standard](../.SYSTEMX/docs/MONITORING.md) and
[alert recommendations](../.SYSTEMX/deploy/monitoring/alerts.md) provide setup
guidance. They do not provision monitors, dashboards, responders or alerts.
Before launch, record the adopted production project, deployed revision/URL,
dashboard and health probe, response interval, primary responder/escalation,
secret rotation owner, and rollback/mitigation reference.

Select signals for enabled services: Hosting availability, browser runtime
errors, auth failure volume, Firestore/Storage permission-denied rates,
Functions errors/latency if enabled, billing/quota thresholds, and adopted
provider workflow failures. Give alerts an owning project, severity, responder,
evidence link and action. Use synthetic checks that fit the accepted data and
authorization policy.

A health receipt includes state/scope, examined source and observed release,
original observation timestamp, host/runtime or target/provider, command or
exercised operation, result, evidence location, owner and recheck trigger.
Keep secrets, real personal data and local runtime paths outside tracked
reusable files. Retain historical receipts with their original dates; source
review can explain them without converting them into a current live pass.
