# WSG Account Levels

This standard defines the reusable auth, security, Firebase emulator, and
Playwright vocabulary for every Web Stack Generation project.

## Canonical Levels

The template names are **Level 0**, **Level 1**, **Level 2**, **Level 3**,
**Level 4**, and **Level 5**.

| Level | State | Account | Billing | Access |
| --- | --- | --- | --- | --- |
| 0 | Not logged in | Guest / Public | Free | Public content only |
| 1 | Logged in | User / Member | Free | Member content and profile |
| 2 | Logged in | User / Pro | Paid | Paid-user content and commerce |
| 3 | Logged in | User / Diamond | Paid | Premium paid content and priority workflows |
| 4 | Logged in | Employee / Private | Admin | Staff/admin operations |
| 5 | Logged in | Owner / Private | Super admin | Owner-only controls and emergency access |

Rules, app code, tests, and docs should refer to these numeric levels and names.
Project-specific role names may be added, but the numeric meaning must remain
stable.

## Standard Test Identities

Use these identities in docs, local emulator seeds, Playwright fixtures, and
security-rule examples. Replace `example.test` with the project test domain when
the setup answers are archived.

| Test Identity | Level | Login State | Purpose |
| --- | --- | --- | --- |
| `Test-SU@example.test` | 5 | Logged in | Owner / super admin path |
| `Test-Admin@example.test` | 4 | Logged in | Employee / admin path |
| `Test-Pro@example.test` | 3 | Logged in | Diamond paid-user path |
| `Test-User_Paid@example.test` | 2 | Logged in | Pro paid-user path |
| `Test-User_Free@example.test` | 1 | Logged in | Free member path |
| `Test-User_Public@example.test` | 0 | Not logged in | Guest/public path; no real auth user required |

## Firebase Claims Shape

Use custom claims for privileged and paid access. The template standard name is
`level`; projects may also mirror the value into `role`.

```json
{
  "level": 4,
  "role": "admin",
  "tier": "private"
}
```

Level 0 is anonymous/public behavior and normally has no custom claim. If a
project supports Firebase anonymous auth, anonymous users still map to Level 0
until upgraded.

## Security Rule Expectations

- Default to deny-by-default.
- Use helper functions such as `signedIn()`, `accountLevel()`, `isPaid()`,
  `isAdmin()`, and `isOwner()` when authoring Firestore/Storage rules.
- Level 4 and Level 5 paths must require MFA guidance in docs and manual setup.
- Server-side checks must never trust client-visible route guards alone.
- User self-edits must not be allowed to change privileged fields such as
  `level`, `role`, `admin`, `subscriptionTier`, `mfaRequired`, or
  `securityProfile`.
- Owner bootstrap must come from verified setup input or a verified owner email,
  not a hardcoded production UID.
- Playwright tests should include at least public, free member, paid member,
  admin, and owner routes when those modules exist.

## Local Emulator Standard

Local Firebase emulator setup should seed or document these identities without
committing live passwords. Store any generated local-only passwords in ignored
files such as `.env.local`, `.secrets.env`, or emulator export fixtures that do
not contain production credentials.

## Playwright Standard

Playwright storage-state files should follow this naming convention when used:

- `.auth/level-0-public.json`
- `.auth/level-1-free.json`
- `.auth/level-2-paid.json`
- `.auth/level-3-diamond.json`
- `.auth/level-4-admin.json`
- `.auth/level-5-owner.json`

The files are generated artifacts and must stay git-ignored unless they contain
only synthetic emulator state.

## Unified Login Smoke Matrix

Before production release, verify:

- Level 0 public routes render before private auth bootstrapping finishes.
- Level 1 creates or reads its profile document after first sign-in.
- Level 2 and Level 3 routes deny lower accounts and allow matching accounts.
- Level 4 admin routes require admin authorization and MFA policy coverage.
- Level 5 owner routes use owner-only checks and emergency recovery notes.
- Provider redirect/popup recovery clears stale local session state when the user
  switches accounts.
