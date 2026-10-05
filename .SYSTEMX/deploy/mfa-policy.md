# MFA Policy

This template does not force one authentication provider or tenant policy, but
production projects should decide on MFA before launch.

## Baseline

- Require MFA for repository admins and deploy operators.
- Require MFA for Firebase and Google Cloud project owners.
- Require MFA for payment provider dashboards.
- Document whether app users need MFA in the project security plan.

## App Guidance

If the downstream app adds privileged user roles, require MFA for those roles
before allowing administrative actions.
