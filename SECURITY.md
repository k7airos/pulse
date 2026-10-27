# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private reporting:
**Security → Report a vulnerability** on this repository. Include the affected version, steps to reproduce and the impact you see.

You can expect an acknowledgement within a few days. Fixes are released as patch versions and noted in the [changelog](./CHANGELOG.md).

## Supported versions

Only the latest release receives fixes.

## Hardening checklist for operators

- Run behind HTTPS and set `PULSE_TRUST_PROXY=1` only when the proxy overwrites `X-Forwarded-For`.
- Keep the admin key out of version control; prefer per-site keys with the smallest scope that works.
- Register each website's domain so browser collection is checked against its `Origin`.
- Back up the data directory (the SQLite file and its `-wal` / `-shm` companions) before upgrading.
