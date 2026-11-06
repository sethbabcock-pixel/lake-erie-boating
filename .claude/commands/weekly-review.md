---
description: Weekly business & operations review across all teams
argument-hint: [paste metrics / exports, optional]
---

Run the shouldiboat.com weekly review. Data provided (may be empty): $ARGUMENTS

Delegate in parallel, then merge into one report at `docs/business/weekly/<today's date>.md`:

- **revenue-analyst** — KPI scorecard from the data above (traffic, signups, subscribers/MRR, ad fill & RPM, affiliate, sponsors). If data is missing, list exactly what to export.
- **devops-sre** — open `cam-health` issues, recent CI runs, deploy/cron health, anything flaky in data feeds.
- **customer-support** — themes from open GitHub issues and any feedback pasted above.
- **sales-sponsorships** — pipeline status from `docs/sales/pipeline.md` and next actions.
- **product-manager** — given the above, propose next week's top 3 priorities and update `docs/product/ROADMAP.md`.

Report format: Headline (3 bullets) · Metrics table · Wins · Problems · Decisions needed from the owner · Next week's top 3.
