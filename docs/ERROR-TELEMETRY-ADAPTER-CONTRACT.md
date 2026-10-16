# Design optional application error telemetry adapter

**V2 artifact design reviewed; runtime unadopted — 2026-10-15.** Agent 0 reviewed the amended policy after independent source/artifact recheck. Original WX-0760 catalog acceptance remains separate. Historical source context `42818dd7baf3d335f27c401c37d048bd842617fa` was supplied by Agent 0 during the original drafting period; it does not establish a CI, adapter, runner or provider result. The original draft and v2 source observations are preserved separately in the [source-review record](evidence/adoption-contract-source-review.json). No external setup or execution is performed by this guide. A later source re-review after the CRM integration freeze is pending. See the [adoption index](ADOPTION-CONTRACTS.md).

- Original source: `docs/MONITORING.md`.
- Original gate: `operator`; priority `P1`; declared dependencies: `[]`.
- **Original acceptance:** For optional operator-approved adoption: An opt-in adapter contract lists approved redacted fields, event volume limits and transport failure behavior before any external telemetry is configured.

All policy numbers below are proposed finite defaults for review, not current implemented controls or owner-approved production policy. Fictional examples are design cases, not observed events or actual approvals.


**Version 2 documentary amendment:** supersedes only the reviewed telemetry draft, whose original SHA-256 is `603d1c8edbaaa5c7701bcc5690062463218deaf1825d393deb596ea71e800a24`; that original remains preserved. This amendment resolves the independent review's asynchronous outcome, cancellation, late completion and physical-concurrency questions. It creates no adapter, endpoint or runtime observation.

## 1. Current foundation and proposed boundary

`docs/MONITORING.md` describes health evidence and future response ownership; it does not configure an error collector. Native workspace errors can contain useful operational facts but also private fictional drafts or user-supplied text. The proposal below is a **strict opt-in DTO/adapter contract**, not an installed transport, endpoint, provider configuration or browser credential path.

Default construction is `mode: disabled`. In disabled mode `emit` returns a promise resolved with `{kind:'disabled', sent:false, reason:'not-enabled'}` without reading event payload properties, opening a socket, writing storage or scheduling retries. A caller-selected URL, environment truthiness, account tier or demo role never enables the adapter.

## 2. Explicit adoption configuration

An adopted operator must review a fixed configuration containing: environment, accountable owner, approved event catalog version, fixed destination reference, field/volume policy, redaction reviewer, retention reference and transport-failure procedure. All current values are **unassigned/unconfigured**. Secrets and actual endpoints remain in protected downstream configuration.

`destinationRef` selects one reviewed transport binding; event callers supply neither URLs nor headers. Production destinations require the adopter's approved transport and TLS policy; a deliberate owned loopback test sink is a separate nonproduction binding. No connection, token refresh, automatic opt-in or endpoint fallback is part of this contract.

## 3. Proposed event field allowlist — version 1

Unknown keys or malformed values refuse the **whole event** with a fixed code. Do not silently drop an unknown secret field and still report successful submission. Canonicalization/validation reads data properties only; reject accessors, custom prototypes, functions, symbols, cycles and undefined. The transport receives a copied immutable validated DTO, never the original Error, Request, Response, workspace or arbitrary context object.

| Required field | Allowed values / proposed bound |
| --- | --- |
| `schemaVersion` | Literal `1`. |
| `eventId` | Nonpersistent event-local random identifier, exactly 32 lowercase hex characters; no UID/tenant/device/session identity encoded. |
| `buildRevision` | Reviewed 40- or 64-character lowercase source SHA; configured by the adopted build, not an arbitrary caller claim. Unknown build binding refuses enabled transport. |
| `occurredAt` | Valid explicit UTC ISO timestamp with milliseconds; no inferred workflow timestamps. |
| `scope` | `native-demo` or `adopted-app`; configured environment controls which is permitted. No event claims provider/deployed acceptance. |
| `module` | `hr`, `cms`, `crm` or `shell`. |
| `code` | Exactly one catalog code below; no free text or external error code. |
| `severity` | Fixed catalog value `warning` or `error`, not caller-selected escalation. |
| `result` | Fixed catalog value `refused` or `unavailable`. |
| `durationMs` | Integer 0–60,000 or `null` when not measured. |

Proposed catalog entries, requiring review before adoption:

| Code | Severity | Result | Source meaning |
| --- | --- | --- | --- |
| `workspace-save-unavailable` | `warning` | `unavailable` | Saving was unavailable; it says nothing about loss/recovery success. |
| `workspace-import-refused` | `warning` | `refused` | Native import was refused; no imported record/body is attached. |
| `workspace-restore-refused` | `error` | `refused` | Restore refusal; checkpoint/save details remain in protected local evidence. |
| `workspace-undo-refused` | `error` | `refused` | Undo refusal; no captured state or private draft is sent. |

Events may not contain messages, stack traces, URLs/query/fragment, hostname, absolute path, UID/tenant/person/email, workspace records/IDs, financial values, form content, headers, cookies, tokens, environment values, raw request/response bodies or provider payloads. Hashing a forbidden identifier does not make it an approved field. A new event code or field requires a separately reviewed catalog version.

## 4. Exact public API and result chronology

This is a proposed interface contract, not executable implementation. The owning adapter is constructed disabled. A configuration action is an explicit downstream review boundary; an event caller cannot enable it by passing a flag, destination or token.

```ts
type TelemetryTerminalResult =
  | { kind: 'disabled'; sent: false;
      reason: 'not-enabled' | 'review-required' | 'quarantined' | 'disposed' }
  | { kind: 'refused'; sent: false;
      reason: 'invalid-event' | 'unconfigured-build' | 'clock-unavailable' }
  | { kind: 'dropped'; sent: false;
      reason: 'rate-limit' | 'capacity' | 'expired' }
  | { kind: 'sent'; sent: true }
  | { kind: 'failed'; sent: false;
      reason: 'offline' | 'timeout' | 'http-refused' |
              'unexpected-response' | 'transport-error' }
  | { kind: 'cancelled'; sent: false;
      reason: 'disabled' | 'disposed' | 'review-required' | 'transport-quarantine' }

type TransportOutcome =
  | { kind: 'accepted'; status: 200 | 201 | 202 | 204 }
  | { kind: 'http-refused'; status: number } // safe integer 400..599 only
  | { kind: 'offline' }

type TelemetryTransport = {
  send(dto: Readonly<TelemetryDto>, options: { signal: AbortSignal }):
    Promise<TransportOutcome>
}

type TelemetryAdapter = {
  emit(input: unknown): Promise<TelemetryTerminalResult>
  configure(reviewed: ReviewedTelemetryConfiguration,
    transport: TelemetryTransport):
      { kind: 'enabled' } |
      { kind: 'refused'; reason: 'invalid-config' | 'inflight-unsettled' | 'disposed' }
  disable(): void
  dispose(): void
  inspect(): Readonly<TelemetryLocalSnapshot>
}
```

`TelemetryDto` is exactly the ten-field schema in section 3. The configuration is operator-owned, copied, strictly validated and bound to one reviewed transport/destination/catalog/build/retention policy from section 2; its real values remain unselected. `configure` cannot consume an event's arbitrary object or a truthy environment variable as approval. It requires the adopter's recorded independent configuration review and valid clock/build binding. It refuses replacement while **any previous physical send for that binding remains unsettled**, even if that event's completion promise already timed out. Disposed instances cannot be enabled again.

### Chronology and independence

1. `emit` always returns a promise; it never synchronously throws and its promise always **resolves exactly once**, never rejects. This includes validation/serialization faults, synchronous `send` throws, a rejected transport promise, timer/abort cleanup faults, timeout, disable and disposal. Fixed failure labels expose no raw exception, response or input value.
2. Disabled/review-required/quarantined/disposed checks happen **before reading input properties**. Refusal/drop may resolve immediately. In enabled mode strict validation and byte/rate/capacity checks happen before admitting a copied DTO. Rate windows include every admitted event, even if later cancelled/failed; disable/reconfigure does not reset unexpired windows.
3. `queued` is **internal admission state**, never a public terminal return. An admitted call's promise stays pending until it is sent, failed, expired or cancelled. Callers must not await telemetry as a condition for committing a native save/import/restore/Undo operation. Its result cannot change those actions, their history or their status. Adapter-owned rejected promises are handled internally; a caller's unrelated throwing continuation is outside this API's authority.
4. The dispatcher takes one unexpired event only when no physical send is outstanding. It creates one owned AbortController, monotonic deadline, immutable generation/request fence and one terminal-outcome flag, then invokes `send` once. No retry, redirect-following, alternate endpoint or unload/beacon flush is allowed.
5. The first eligible completion settles the event once. At a callback, if monotonic time is at or beyond the 1,500 ms deadline, timeout wins even if the timeout callback has not run yet. Disable/dispose first invalidates the generation synchronously. Late callbacks are observed for physical cleanup only, never as new terminal outcomes.

`sent: true` means a valid allowlisted DTO received one of the exact `accepted` acknowledgements before the active deadline/fence. It is **not** proof of storage, processing, incident resolution, business success, provider acceptance or zero data loss. Every `sent: false` means no such confirmed acknowledgement was accepted. After any attempted request it does **not** guarantee no bytes reached the collector. Timeout, abort and disable can leave remote receipt unknown.

Transport outcomes are exact plain data records with only the listed keys; status must meet the union constraints. Any other shape/status, redirect/3xx, response-body demand or accessor is `failed/unexpected-response`. The adopted HTTP transport must use a fixed reviewed endpoint with redirects refused, no raw response body in the API, and map an exact 200/201/202/204 response to `accepted`. `offline` is allowed only as a fixed transport result, not inferred by reading a raw error string. A synchronous throw/rejection maps to `failed/transport-error`. HTTP 401/403 settles the attempted call `failed/http-refused`, cancels pending calls as `cancelled/review-required` and enters review-required mode. HTTP 429 is `failed/http-refused`, zero retry; other pending work may proceed only after that physical send settles.

### Timeout, disable, disposal and no-overlap invariant

- **Timeout:** settle attempted call `failed/timeout`; invalidate its fence; abort that exact owned signal; cancel all pending calls as `cancelled/transport-quarantine`; clear their DTOs. Enter quarantine while the physical promise is unsettled. Do not release its physical slot merely because its public promise resolved.
- **Disable:** synchronously enter disabled mode and invalidate the generation; settle any attempted unfinished call `cancelled/disabled`, all queued calls `cancelled/disabled`; abort the owned in-flight signal. If a physical send is still unsettled, mode is quarantined with a disabled intent. New `emit` calls resolve `disabled/quarantined` without reading payloads; no new dispatch.
- **Dispose:** the same cancellation protocol with reason `disposed`, permanently preventing configuration and new work. If a physical send remains unsettled, inspection still reports it; disposal cannot claim termination.
- **Ignored abort or abort throwing:** keep the physical slot occupied. No second send is allowed, including after a configuration request or replacement adapter for the same transport binding. The binding's owner must retain this quarantine across generations/instances and may not bypass it by discarding the old adapter reference. A never-settling transport leaves that binding unavailable indefinitely; all public event promises still resolve through timeout/cancellation.
- **Late settlement:** handle the promise's success/rejection to avoid an adapter-owned unhandled rejection, release only the physical slot, and discard its outcome without changing its already resolved result, emitting another result, rebuilding a queue or affecting workspace state. Following timeout/disable, settlement moves the binding only to disabled/review-required, never automatically enabled. A new deliberate reviewed configuration may then enable a fresh generation; old queued events are never replayed.
- **Physical bound:** at all times, `0 <= outstanding unsettled send invocations <= 1` per owned transport binding, across generations. This counts a request that ignored abort. A timer race alone cannot establish cancellation or free capacity.

There is no result observer/listener callback API. `inspect()` returns a copied, frozen local-only snapshot: mode (`disabled`, `enabled`, `review-required`, `quarantined`, `disposed`), physical-inflight `0|1`, pending event/byte counts, bounded counters and last terminal result (or null). It does not invoke transport or expose event payloads/IDs, destination, secrets, raw errors or mutable internals. The returned per-call promise provides each call's exact terminal result; the snapshot provides current local outcome visibility without another network service. No telemetry about telemetry failures is emitted.

## 5. Finite volume controls

These are **proposed defaults**, applied without persistent tracking:

| Control | Bound / deterministic outcome |
| --- | --- |
| Serialized event | Maximum **2,048 UTF-8 bytes** after strict validation; over-bound `refused/invalid-event`, no send. |
| Rolling volume | Maximum **16 admitted events per trailing 60,000 ms** and **4 per trailing 1,000 ms**; injected monotonic time, not `occurredAt`; admission at the boundary uses the exact half-open window `(now-window, now]`. |
| Capacity | Maximum **8 events / 16 KiB**, including the physical in-flight DTO even after public timeout until settlement; newest over-capacity call resolves `dropped/capacity`. No disk/localStorage/IndexedDB queue. |
| Queue lifetime | **30,000 ms** from admission. An owned expiry timer or dispatch-time check settles pending calls `dropped/expired` once, removes their DTO and never dispatches expired work. |
| Attempt | One physical send, **1,500 ms** deadline, one attempt per admitted event, **zero retries**. Timeout/disable uses section 4 quarantine/fencing. |
| Counters | Local refused/dropped/failed/cancelled counts saturate at **1,000,000**; last result and counts only, no unbounded history. |

An unavailable/rolling-back monotonic clock refuses new admission as `refused/clock-unavailable`, cancels pending work as `cancelled/review-required`, and aborts/quarantines an unsettled send through the same protocol. Prior rate budget is never reset to obtain extra sends. Validation/serialization faults resolve `refused/invalid-event`. Any unexpected adapter-owned timer or cleanup fault resolves an affected unfinished attempted call `failed/transport-error`, cancels other pending calls `cancelled/review-required`, and aborts/quarantines any unsettled send under section 4. Already terminal results are never replaced. These paths cannot throw into workspace actions or initiate fallback transport.

## 6. Literal fictional worked and denied cases

**Design cases only:** no collector, destination, request or test was configured/executed. The all-`a` build and future timestamp are illustrative. An inert fake transport and injected clock can later verify these cases without an external collector.

```json
{
  "schemaVersion": 1,
  "eventId": "00000000000000000000000000000001",
  "buildRevision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "occurredAt": "2030-01-15T10:00:00.000Z",
  "scope": "native-demo",
  "module": "cms",
  "code": "workspace-import-refused",
  "severity": "warning",
  "result": "refused",
  "durationMs": 7
}
```

Every case requires unchanged native workspace/action result, zero retry/fallback, no raw text leakage and no adapter-owned unhandled rejection. Every `emit` promise resolves exactly once; the fake recorder's physical outstanding count never exceeds one.

| Case | Literal condition | Exact expected outcome/chronology |
| --- | --- | --- |
| `fictional-disabled` | Default adapter receives event above or a throwing getter payload. | Promise immediately resolves `disabled/not-enabled`; zero input property reads, queue/network calls. |
| `fictional-accepted` | Reviewed inert fake transport; valid event; `{kind:'accepted',status:204}` at `t=100 ms`. | Admission is internal; promise resolves once `sent/true`; fake recorder gets exactly ten copied allowlisted fields; physical count returns to 0. |
| `fictional-invalid` | Event adds `authorization:'FAKE-DO-NOT-TRANSMIT'`. | `refused/invalid-event`; no diagnostic/queue/transport copy of the value. |
| `fictional-rate-second` | Four admissions at `t=0`; fifth at `t=500 ms`. | Fifth `dropped/rate-limit`; no fifth send. |
| `fictional-rate-minute` | Four admissions each at `t=0,10000,20000,30000`; seventeenth at `t=40000 ms`. | Seventeenth `dropped/rate-limit`; cancelled/failed earlier admissions still count. |
| `fictional-capacity` | Fake state has eight valid unexpired admitted DTOs within rate budget, then one more. | New call `dropped/capacity`; older calls unchanged; no extra dispatch. |
| `fictional-sync-throw` | `send` throws synchronously before returning. | Attempted call `failed/transport-error`; physical invocation is settled, no leaked rejection; next eligible event may dispatch once. |
| `fictional-rejection` | `send` returns a promise rejected with a private raw Error. | `failed/transport-error`; raw error never exposed; handle rejection, release settled slot, zero retry. |
| `fictional-timeout-cooperative` | One send outstanding at `t=0`; at `t=1500` it has not acknowledged; abort causes promise rejection. | Public result `failed/timeout` once; exact signal aborted; slot remains occupied until that rejection is handled; mode stays disabled/review-required after settlement, no automatic restart. |
| `fictional-never-settles` | Fake ignores abort and never settles; two pending calls exist. | At deadline attempted result `failed/timeout`; two pending results `cancelled/transport-quarantine`; physical count remains 1 indefinitely; new calls `disabled/quarantined` with no payload read; configure refuses `inflight-unsettled`. |
| `fictional-late-success` | Timeout at `1500`; old fake returns accepted 204 at `2000`. | Result remains `failed/timeout`; no second outcome or retry; only physical count becomes 0 and mode becomes review-required; fresh explicit configuration required before another send. |
| `fictional-disable` | One send and two queued at `t=100`; `disable()` invoked. | Three results resolve `cancelled/disabled`; exact signal aborted; queued DTOs cleared. If abort ignored, physical count 1/quarantined until settlement, no new dispatch. Later completion changes no result. |
| `fictional-dispose` | Disposal while one send remains unsettled. | Attempted/pending calls `cancelled/disposed`; signal aborted; binding quarantined until settlement; instance permanently refuses configure with `disposed`. |
| `fictional-authorization-refusal` | Fake returns 401 or 403 while two calls queued. | Attempted result `failed/http-refused`; queued results `cancelled/review-required`; physical slot settles; no dispatch until new reviewed configuration. |
| `fictional-rate-refusal` | Fake returns 429. | `failed/http-refused`; zero retry, no response body, next eligible queued call only after physical settlement and normal rate rules. |
| `fictional-unknown-response` | Fake returns 302, `{kind:'accepted',status:206}`, extra keys or response body. | `failed/unexpected-response`; no raw fields retained. |
| `fictional-queue-expiry` | A pending event reaches `t=30000` from admission before dispatch. | `dropped/expired` once and never sent. |
| `fictional-abort-fault` | Abort throws; old send remains pending, then rejects late. | Public terminal cancellation/timeout preserved; quarantine holds physical count 1 until late rejection is handled; no overlap, leaked error or second outcome. |

No listener failure case is needed because the contract exposes no listeners. Inspection is a copied local read. Future tests must assert the stated fixed result/state sequences and strict whole-event privacy, rather than merely checking that a function was called.

## 7. Acceptance mapping and review boundary

| Original requirement | Concrete v2 coverage |
| --- | --- |
| Opt-in before external configuration | Sections 1–2; disabled default, reviewed immutable binding, no caller URL/credential. |
| Approved redacted fields | Section 3; ten exact fields, four codes, whole-event refusal and private-field exclusions. |
| Event volume limits | Section 5; byte/rate/capacity/lifetime/counter bounds with finite refusal. |
| Transport failure behavior | Section 4 exact promise/transport chronology, one physical in-flight binding, abort/quarantine/fencing and local outcomes; section 6 literal cases. |

Agent 0 reviewed these explicit API/lifecycle choices and proposed bounds for this artifact design. Actual operator, destination, credentials, retention and independent redaction/configuration approval remain unassigned. A future implementation needs meaningful fake-transport/clock tests; no implementation, runtime test, provider configuration, external telemetry or acceptance was performed for this draft amendment.

## Historical public source bindings

Paths are relative to the repository root. These are historical supplied-basis drafting observations, not a new current-CRM source review. Original dated evidence retains its own revision and observation scope.

- `docs/MONITORING.md` — SHA-256 `6b654892a4cd29deceaf89ce58204162e6a99e3b8a1c8f28dc470b949c18f4dd`.
- `docs/SECRETS.md` — SHA-256 `a3060d87cb9bb85f27d0d55155816ceb582742a47f4a16149104740acd73fc23`.
- `docs/OPERATIONS-READINESS.md` — SHA-256 `49c48b9c74e5b608b5c98d17111cdd7b9b6e56ead4b998e884d9cd1dc8978bd9`.
- `src/portals/persistence.ts` — SHA-256 `81d5b2047b62212795256023b630908c29cad770c320373f53a14c14863bad6a`.
- `src/portals/replacement-recovery.ts` — SHA-256 `4d80db30057b7ddd1974400e0a8555b33158ec7b8ce55633726b2f8de839dc2c`.
