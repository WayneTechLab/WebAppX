# Optional environment configuration proposal

[environment-config.schema.json](environment-config.schema.json) records the
names, intended exposure and safe example placeholders used by WebAppX. It is a
JSON Schema proposal for normalized example assignments, with reviewed
annotations for the root and starter fixtures. The maintenance checker validates
those public examples without opening actual secret files. Adding this proposal
does not load configuration, start a provider connection or change app behavior.

## Classifications

| Classification | Sensitivity | Intended consumer and examples |
| --- | --- | --- |
| `public-browser` | `public` | Browser configuration and non-secret setup metadata under `VITE_`; these values can enter the client bundle. |
| `server-only` | `private-setting` | Sender configuration and documented optional Gusto mode or webhook gates; these names have no `VITE_` prefix. |
| `server-only` | `secret` | SMTP password, Google Fonts server API key and Gusto webhook verification token; actual values belong in ignored runtime configuration or an approved server secret store. |

Firebase web app identifiers and the Firebase client API key are public browser
configuration in the existing template. That classification grants no database,
Storage or authentication permission; the adopted app must still enforce its
service rules. The sender address and DNS/provider metadata under
`VITE_WSG_*` are explicitly public setup metadata, so they must contain only data
approved for browser exposure.

`SYSTEMX_GOOGLE_FONTS_API_KEY`, sender/SMTP settings and Gusto server settings
must stay outside the browser prefix. The checker rejects browser-prefixed
versions of reserved server names such as `SMTP_PASSWORD`,
`GUSTO_CLIENT_SECRET` and `STRIPE_SECRET_KEY`, including when a schema edit tries
to classify one as public. This reviewed name policy is a template safeguard,
not a complete credential detector.

The root example contains 20 public browser assignments, eight server
assignments and 16 typed browser names. The starter contains 14 public browser
assignments, seven server assignments and ten typed browser names. The root's
six additional browser fields describe its existing emulator/local-session
controls; the extra server field is the optional Google Fonts key. These are
intentional profile differences.

## Example contract

The proposal uses JSON Schema's object, string, `properties`,
`patternProperties`, `enum` and `additionalProperties` constraints.
`x-classification`, `x-sensitivity` and `x-consumer` annotate each exact key and
the optional Stripe price family. `x-declared-in` records whether the root or
starter `ImportMetaEnv` declares a browser field. Setup metadata and optional
extension markers have no active browser declaration.

The `x-webappx` annotation identifies two fixed public fixture profiles and their
mandatory example keys. A mandatory fixture key preserves the example's
documented shape; it does not make that value mandatory in a production runtime.
The check accepts blank strings, including blank server secret placeholders.
Nonblank example values must match a reviewed placeholder or existing safe local
default in the schema. It never prints the matched or rejected values.

Both examples retain these explicit optional markers:

~~~dotenv
# @optional VITE_STRIPE_PUBLISHABLE_KEY
# @optional VITE_STRIPE_PRICE_*
~~~

They document extension points. A future public example may assign the exact
publishable key or a concrete family member such as `VITE_STRIPE_PRICE_PLAN`
using the schema's reviewed placeholder. A wildcard is permitted in the marker,
not as an assignment name. Adding browser code for an extension still requires
the corresponding `ImportMetaEnv` declaration and review under
[development contracts](DEVELOPMENT-CONTRACTS.md).

The optional [Gusto adapter](../integrations/gusto/README.md) has no tracked
Functions environment example. Its existing
[Firebase guide](GUSTO-FIREBASE.md) is the reviewed source for the five named
server settings in this proposal: `GUSTO_MODE`, `GUSTO_WEBHOOK_APPROVED`,
`GUSTO_WEBHOOK_HEX_VERIFIED`, `GUSTO_WEBHOOK_ORG_ID` and
`GUSTO_WEBHOOK_VERIFICATION_TOKEN`. They remain optional, with blank or disabled
example choices. None is added to the app's root or starter example.

## Run the read-only check

~~~bash
node scripts/check-environment-examples.mjs
node scripts/check-environment-examples.mjs --json
node --test tests/setup/environment-examples.test.mjs
~~~

The checker fails for unknown assignment names, missing mandatory fixture keys,
duplicate assignments, unreviewed optional markers or placeholders, malformed
classification annotations, reserved server/secret names under `VITE_`, and
inconsistencies between the schema and browser type declarations. It also checks
that the named Gusto server settings retain references in the reviewed guide.
The parser accepts simple `NAME=value` assignments, blank values, matching
single/double quotes, blank lines and comment lines. It does not perform shell
expansion, command substitution, imports or dotenv evaluation.

The file read allowlist is fixed in
[check-environment-examples.mjs](../scripts/check-environment-examples.mjs):

- This schema.
- Root `.env.example` and `src/vite-env.d.ts`.
- Starter `.SYSTEMX/Template/starter/.env.example` and its `src/vite-env.d.ts`.
- The public `docs/GUSTO-FIREBASE.md` guide.

Schema edits cannot redirect these reads. The checker rejects symlinks in each
relative public file path. It does not discover `.env` files, read `.env.local`,
`.env.gusto`, secret stores or shell environment values, write files, execute
child processes or contact a network. Output contains key names,
classifications, counts and sanitized results. The CLI only accepts `--json`.

Focused tests use temporary synthetic fixtures, including poison private files,
a throwing shell-environment getter, symlink escapes, inconsistent declarations
and malformed schemas. They verify the CLI's read-only behavior and compare the
checked-in examples to the reviewed inventories.

## Scope of the proposal

This check validates tracked examples and their source declarations. It does
not inspect an adopted app's runtime environment, prove that a live value is
safe, configure Vite exposure rules, protect a production secret or establish
provider acceptance. Browser bundling, server secret binding, service rules,
deployment and operator review remain separate requirements. The default app,
disabled provider adapters and blank reusable SYSTEMX records retain their
existing behavior.

When adding a public example key, update its schema descriptor, the appropriate
profile's mandatory fixture inventory and its browser type declaration when
used by app code. Keep public setup metadata explicitly classified. When adding
an optional family or changing the supported schema subset, review the checker
and its independent negative fixtures together. Keep actual secret values and
machine-specific runtime paths outside tracked examples and managed releases.
