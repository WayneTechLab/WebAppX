# Security review — 2026-10-05

Codex Security reviewed the template implementations and repaired eight findings.
See the [security review and compatibility guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SECURITY-REVIEW.md)
for the resulting controls, supported secret-file keys and validation commands.

- Root and starter Firestore rules protect privilege fields for every client write.
  Staff retain ordinary profile administration; owners retain registry management.
- LAN source, font, asset and backup paths reject symbolic-link escapes.
- Template and wiki synchronization reject linked entries before copying.
- Background deployment retains safety flags and the selected project.
- Secret configuration is literal data with a supported-key allowlist.
- Shell launcher paths and JavaScript version metadata remain data when quoted
  paths or branch names are used.

Run `npm run ci:all` for the template gates. The separate
`npm run security:rules:test` must run through isolated loopback Firebase emulators
for `demo-systemx`; it rejects production endpoints. The tests verify denied
privilege changes and allowed member/staff/owner workflows.

The review does not certify deployed rules, production MFA/App Check, Windows
execution or every supporting research/media file. Publishing these repairs does
not deploy Firebase services. Keep deployment and production acceptance separate
from source and local emulator validation.
