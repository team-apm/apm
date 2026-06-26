# Security Policy

## Supported Versions

Security updates are provided for the following versions of apm.

| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | :white_check_mark: |
| < 3.0.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Preferred:** [GitHub Security Advisories](https://github.com/team-apm/apm/security/advisories/new) (private report)

**Alternative:** Open a minimal public issue asking for a private contact channel, or contact the maintainers listed in [package.json](./package.json).

Please do **not** disclose security issues in public issues with full exploit details before a fix is available.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Impact assessment (if known)

### What to expect

- **Acknowledgement:** within 7 days
- **Status update:** within 30 days, or an explanation of delay
- **Fix:** coordinated disclosure after a patch release when possible

We appreciate responsible disclosure and will credit reporters in the release notes when appropriate.

## Custom data sources

apm allows users to configure custom package data URLs in settings. Pointing apm at an untrusted mirror can expose you to malicious package metadata or downloads. Use only sources you trust. Integrity checks (SSRI) reduce but do not eliminate this risk.

## Platform support

apm is tested primarily on **Windows**. Builds for macOS and Linux are provided without a support guarantee. Security fixes target Windows behavior first.
