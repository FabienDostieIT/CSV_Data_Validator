# Security Policy

## Supported Versions

We are committed to ensuring the security of the CSV Data Validator. Security updates are applied to the **latest released version** on the `main` branch.

| Version                  | Supported          |
| ------------------------ | ------------------ |
| >= 1.0.0 (Latest `main`) | :white_check_mark: |
| < 1.0.0                  | :x:                |

> **Note:** Only the latest code on `main` is actively supported. Older versions do not receive security patches unless otherwise stated.

## Security Features & Practices

- **Automated Dependency Checks:** All dependencies are regularly updated and checked for vulnerabilities via GitHub Actions.
- **CI/CD Security:** All code changes are tested (unit, integration, E2E) and statically analyzed before deployment.
- **E2E Security Testing:** Playwright E2E tests help ensure that critical user flows are protected against regressions and common web vulnerabilities.
- **Static Export:** The app is deployed as a static site (Next.js `output: 'export'`), minimizing server-side attack surface.

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly. **Do not report security vulnerabilities through public GitHub issues.**

Instead, please report vulnerabilities using one of the following methods:

1.  **(Recommended) GitHub Security Advisories:** Privately report a vulnerability via the "Security" tab of the repository ([link](https://github.com/FabienDostieIT/CSV_Data_Validator/security/advisories/new)).
2.  **(Alternative) Email:** Email the report to `security@yourdomain.com` (replace with your actual contact email). Use a clear subject like "Security Vulnerability Report: CSV Data Validator".

### What to Include in Your Report

- Type of vulnerability (e.g., XSS, dependency, improper validation)
- Steps to reproduce
- Proof-of-concept code or examples
- Potential impact
- Suggested mitigation (if known)

### Our Process

1.  **Acknowledgement:** We aim to acknowledge your report within 2-3 business days.
2.  **Assessment:** We investigate and assess severity/impact.
3.  **Communication:** We keep you updated on status and findings.
4.  **Resolution:** If confirmed, we work on a fix and apply patches to `main`.
5.  **Disclosure:** We may coordinate disclosure and credit you unless you prefer anonymity.

We appreciate your efforts in responsibly disclosing vulnerabilities and helping us keep the CSV Data Validator secure.
