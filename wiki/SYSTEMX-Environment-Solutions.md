# SYSTEMX .ENV Solutions

Environment files solve configuration separation; they do not make sensitive
data safe by themselves. Keep local values out of source control and use the
right location for each type of configuration.

## Client configuration

The Vite values prefixed with `VITE_` are compiled into browser-delivered code.
Firebase web configuration commonly belongs there because it identifies the
public client project. It must still point to the correct environment and be
protected by Firebase Security Rules, Authentication, authorized domains, and
appropriate API restrictions where applicable.

```bash
cp .env.example .env.local
```

Never place private keys, service-account JSON, Stripe secret keys, signing
secrets, database credentials, or administrative tokens in a `VITE_*` variable.

## Server and CI secrets

Store genuine secrets in an approved secret-management system for the service
that needs them. Limit access by environment and role, rotate them, and avoid
printing them in terminal output, logs, tickets, packets, or AI conversations.
For local work, `.secrets.env` and `.SYSTEMX/secrets.env` are intended to remain
local; protect them with restrictive permissions where the operating system
supports that control.

Use separate development, staging, and production configuration. Do not copy a
production secret into a test project for convenience. See
[Environment Variables](Environment-Variables) and [Security](Security).
