# WebAppX 3.3.0 validation — 2026-10-13

This receipt covers the reusable WebAppX source template on macOS Apple Silicon.
Managed defaults are dotSYSTEMX **1.9.0-alpha.6**, imported from public main
**7f0d82b7ba8531ac04d897209d8c1ed263ee29cb**. The manifest SHA-256 is
**009e6b6c2f1359fa4c88e3961164d28cc89f65cea2a6682200fb2953caf326e3**.
The [import receipt](../.SYSTEMX/imports/1.9.0-alpha.6.json) and selected snapshot
retain their exact upstream fingerprints. Earlier alpha.5 and 1.8.6 snapshots
remain immutable; coordination and project creation seeds stay blank.

## Delivered boundaries

- Portable `.SYSTEMX/GUSTO/`: 64 routes, 33 capabilities, seven roles, schemas,
  synthetic fixtures and exact vendor inventory/license provenance.
- Host HR workspaces: management, employee, manager and contractor previews;
  employee search/profile, checklists, time/PTO, policy/training actions and
  payroll/payment previews. Live routes are guarded and unconfigured.
- Actual SDK 0.56.6 / API 2026-06-15: development-only employee directory with
  Active, Onboarding and Dismissed reads. The adapter rejects writes,
  credentials, foreign companies, incompatible versions and unknown endpoints.
- Optional Firebase foundation: organization membership/resource policy,
  safe projections, validated native requests, raw-body HMAC/deduplication and
  restricted rules. Real provider forwarding is disabled in every mode.

## Observed checks

The upstream release gate passed 235 tests with five case-sensitive filesystem
skips. Its wheel and folder archive contained all 188 reviewed files, including
the 30 Gusto files, with bytes matching source and retained licenses.

Host HR tests passed 24 cases across the UI model, published API-client wire
contract and optional backend. Four actual Auth/Firestore emulator tests passed
on a separate Standard-edition demo instance with dynamically selected ports.
They include cross-tenant/identity denials and valid own request creation.
The backend helpers and five Function exports were also checked under Node
22.23.3; the root host uses Node 25.8.1. Root and optional backend dependency
audits reported zero vulnerabilities.

The final `npm run ci:all` publication gate passed: blank-template and managed
status validation, no host drift, both research checksum checks, 235 shared
tooling tests (five filesystem skips), 30 import integration tests, eight
operational security tests, 11 app/LAN tests, all 24 HR tests, lint, type checking,
730 Markdown link checks, security/AI checks, dependency audits and the production
build with LAN isolation. `npm run deploy -- hosting --preflight` also passed;
it skipped changelog/commit, push and deployment, leaving deployment count zero.

Browser readback verified employee directory filtering, an employee's synthetic
time-off submission, and a scoped manager approval. The genuine SDK rendered
fictional employees in each Active, Onboarding and Dismissed tab. SDK 0.56.6
required an absolute same-origin mock base URL; the corrected configuration was
verified in the browser before the final publication gate. These actions used
local synthetic data and did not contact Gusto. The published dotSYSTEMX native
wiki was also read back with the alpha.6 Gusto guide and current release footer.

## Evidence limits

Mock data does not establish payroll/tax/benefits correctness. The genuine SDK
proof covers the employee directory only; other provider workflows need their
own adapters and Demo acceptance. OAuth/token rotation, live transport and
reconciliation are explicit remaining implementation gates. Webhook signature
wire encoding requires actual Demo verification before ingestion is enabled.
No Gusto account, credentials, real employee data, payroll execution or cloud
deployment was used. Windows x64/ARM64 and native Linux runtime were not tested.
Historical [3.2.0](VALIDATION-3.2.0.md) and [3.1.0](VALIDATION-3.1.0.md) receipts
retain their original scopes.
