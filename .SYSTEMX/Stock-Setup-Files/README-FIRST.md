# README FIRST - WSG LLM Standard MD Packet

This stock folder lives inside the template:

```text
.SYSTEMX/Stock-Setup-Files
```

Use these markdown files to give an LLM the standard Web Stack Generation
context needed to produce an updated template version or project setup output.

## Copy Into The LLM In This Order

1. `00-COPY-ORDER.md`
2. `01-LLM-ROLE-AND-RULES.md`
3. `02-TEMPLATE-UPDATE-REQUEST.md`
4. `03-SYSTEMX-CONTEXT.md`
5. `04-EDITION-AND-MODULES.md`
6. `05-SECURITY-LOGIN-ACCOUNT-LEVELS.md`
7. `06-SETUP-DEPLOY-QUALITY-GATES.md`
8. `07-OUTPUT-CHECKLIST.md`
9. `08-DESIGN.md`
10. `09-MEDIA-ASSETS.md`
11. `10-CONTENT-SEO.md`
12. `11-ACCESSIBILITY-UX.md`
13. `12-BRAND-TOKENS.md`

Then paste your project-specific intake files if this is for a real project.

## Save LLM Outputs Here

Save the LLM output markdown files into:

```text
.SYSTEMX/Setup-Input_MD/
```

Or create a dated subfolder under:

```text
.SYSTEMX/Setup-Input_MD/
```

The setup system treats `.SYSTEMX/Setup-Input_MD/` as the default ingest
location for these files.

## Suggested Output Filenames

- `PROJECT-BRIEF.output.md`
- `EDITION-MODULES.output.md`
- `PAGES-ROUTES.output.md`
- `DATA-AUTH-SECURITY.output.md`
- `INTEGRATIONS-DEPLOY.output.md`
- `DESIGN.output.md`
- `MEDIA-ASSETS.output.md`
- `CONTENT-SEO.output.md`
- `ACCESSIBILITY-UX.output.md`
- `BRAND-TOKENS.output.md`
- `AI-REINJECTION-PROMPT.output.md`

## Safety

Do not paste or save live secrets. Use placeholders for API keys, service
accounts, Stripe secrets, mailbox credentials, and deploy tokens.
