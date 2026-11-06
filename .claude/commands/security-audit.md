---
description: Full security + privacy audit of the app
argument-hint: [focus area, optional]
---

Run a security and privacy audit of shouldiboat.com. Focus (optional): $ARGUMENTS

1. In parallel:
   - **security-engineer** — full audit (auth, sessions, admin routes, Stripe webhook, SSRF in fetch endpoints, stored XSS via admin/sponsor content, CSP, dependencies via `npm audit`).
   - **legal-compliance** — does `public/privacy.html` match what the code actually collects and shares? Consent, email, affiliate disclosures.
2. Save the combined report to `docs/security/audit-<today's date>.md`, ranked by severity.
3. For each Critical/High finding, propose the fix and ask me before implementing it with **backend-engineer** / **frontend-engineer**.
