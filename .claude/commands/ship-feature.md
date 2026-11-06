---
description: Run a feature through the full org — Product → Design → Engineering → Safety/Security → QA
argument-hint: <feature idea or issue link>
---

Take this feature through the shouldiboat.com delivery pipeline: $ARGUMENTS

Work as the coordinator. Delegate each stage to the named subagent, pass the previous stage's output forward, and stop to ask me if any stage returns a BLOCK or an open question only I can answer.

1. **product-manager** — write the spec (`docs/product/specs/`), with acceptance criteria and the list of teams that must be involved.
2. **ux-designer** — only if the spec has user-facing UI: design spec in `docs/design/`.
3. **marine-data-scientist** — only if verdicts, thresholds, data sources, or forecast copy are touched: approve the approach before code is written.
4. **frontend-engineer** and/or **backend-engineer** — implement. Run them in parallel when their work is independent.
5. In parallel: **qa-engineer** (test + release readiness), **security-engineer** (if auth, payments, admin, user data, or third-party scripts changed), **marine-data-scientist** (verdict-impact review if conditions code changed).
6. Fix anything marked Blocker/Critical/BLOCK, then re-run the reviewer that raised it.
7. **product-marketing-manager** — if the feature is user-facing: launch tier, release notes, and hand-off copy in `docs/marketing/launches/`.
8. Commit on the current branch with a clear message. Finish with a short summary: what shipped, how it was verified, open risks.
