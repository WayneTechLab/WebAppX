# 00 Copy Order

Use this packet to give an LLM enough durable context to update Web Stack
Generation or to initialize a project from the template.

For a browser LLM workflow, run:

```bash
bash .SYSTEMX/scripts/build-setup-packet.sh
```

Use the generated `WSG-Setup-Packet-*.zip` from the OS Downloads folder. The
setup system imports that zip into `.SYSTEMX/Setup-Input_MD/`.

Copy in this order:

1. `01-LLM-ROLE-AND-RULES.md`
2. `02-TEMPLATE-UPDATE-REQUEST.md`
3. `03-SYSTEMX-CONTEXT.md`
4. `04-EDITION-AND-MODULES.md`
5. `05-SECURITY-LOGIN-ACCOUNT-LEVELS.md`
6. `06-SETUP-DEPLOY-QUALITY-GATES.md`
7. `07-OUTPUT-CHECKLIST.md`
8. `08-DESIGN.md`
9. `09-MEDIA-ASSETS.md`
10. `10-CONTENT-SEO.md`
11. `11-ACCESSIBILITY-UX.md`
12. `12-BRAND-TOKENS.md`

If the LLM has repo access, tell it:

```text
Read .SYSTEMX first. Preserve template scope. Implement the requested update,
run the required gates, and report files changed plus verification results.
```

If the LLM does not have repo access, paste relevant files after this packet:

- `README.md`
- `.SYSTEMX/README.md`
- `.SYSTEMX/USER-INGEST-AND-PRODUCTION-SETUP.md`
- `.SYSTEMX/Unified-Setup-Process/README.md`
- `.SYSTEMX/Unified-Setup-Process/standards/*.md`
- `.SYSTEMX/Unified-Setup-Process/intake/*.md`
- `.SYSTEMX/Standard-MD-Files/*.md`
- `package.json`
- `firebase.json`
- `firestore.rules`
- `storage.rules`
