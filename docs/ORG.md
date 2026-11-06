# shouldiboat.com — Agent Organization

Each "employee" is a Claude Code subagent defined in `.claude/agents/<name>.md`
(a system prompt + allowed tools + model). The main Claude session acts as the
**COO/orchestrator**: it reads `CLAUDE.md`, routes work to the right agent, runs
independent agents in parallel, and merges results. You are the **CEO** — you
approve specs, pricing, outbound communication, and anything risky.

```
                              CEO (you)
                                  │
                       COO (main Claude session)
                                  │
 ┌────────────┬───────────┬───────┴──────┬─────────────┬────────────┬───────────┐
Product     Design     Engineering   Forecast &     Go-to-market   Revenue     Trust
                                     Safety
product-    ux-        frontend-     marine-data-   seo-content-   revenue-    security-
manager     designer   engineer      scientist      strategist     analyst     engineer
                       backend-                     growth-                    legal-
                       engineer                     marketer                   compliance
                       devops-sre                   sales-                     customer-
                       qa-engineer                  sponsorships               support
```

## Roster

| Agent | Model | Can edit code? | Mandate | Output location |
|---|---|---|---|---|
| product-manager | sonnet | docs only | What to build & why; specs; roadmap | `docs/product/` |
| ux-designer | sonnet | docs/mocks | Flows, UI specs, a11y, UX review | `docs/design/` |
| frontend-engineer | sonnet | ✅ | React/Vite UI | `src/`, `public/` |
| backend-engineer | sonnet | ✅ | Worker, APIs, auth, Stripe, KV, cron | `worker.js`, `functions/` |
| devops-sre | sonnet | ✅ | Deploys, CI, monitoring, incidents | `wrangler.jsonc`, `.github/`, `docs/ops/` |
| qa-engineer | sonnet | tests | Test plans, regression, ship/block | `scripts/`, reports |
| marine-data-scientist | **opus** | ✅ | Verdict correctness & safety (veto power) | `functions/marine/`, `src/boats.js`, `docs/forecast/` |
| security-engineer | **opus** | ❌ read-only | Security reviews & audits | returns report → `docs/security/` |
| product-marketing-manager | sonnet | docs | Positioning, personas, launch messaging, competitive, sales enablement | `docs/marketing/` |
| seo-content-strategist | sonnet | content | SEO, guides, landing copy | `public/guides/`, `docs/marketing/seo/` |
| growth-marketer | sonnet | docs | Campaigns, social, email, conversion | `docs/marketing/` |
| sales-sponsorships | sonnet | docs | Sponsor pipeline, outreach, rate cards | `docs/sales/` |
| revenue-analyst | sonnet | docs | AdSense/affiliate/Stripe/GA4 KPIs | `docs/business/` |
| customer-support | haiku | docs | Replies, triage, FAQ | `docs/support/` |
| legal-compliance | sonnet | docs | Disclaimers, privacy, platform policy | `docs/legal/` |

### Why these beyond the original six
- **Marine data / safety** — the verdict *is* the product and a wrong GO is a real-world liability. It deserves its own owner with veto power.
- **QA** — separate from development so someone is paid to assume it's broken.
- **DevOps/SRE** — NOAA feeds, webcams, crons, and Stripe webhooks all fail in production in ways code review won't catch.
- **Revenue/analytics** — four revenue streams already wired (`MONETIZATION.md`) need someone watching the numbers.
- **Customer support** — wrong-verdict reports and billing issues need a fast triage path.
- **Legal/compliance** — safety disclaimers, privacy, Amazon/AdSense/Stripe policy, CAN-SPAM.
- Marketing is split into **product marketing** (what we say: positioning, launches, competitive, sales enablement), **SEO/content** (your #1 channel), and **growth** (campaigns, community, conversion).

## Workflows (slash commands in `.claude/commands/`)

| Command | Flow |
|---|---|
| `/ship-feature <idea>` | PM spec → UX → (safety pre-approval) → FE/BE build → QA + Security + Safety review → PMM launch messaging → commit |
| `/weekly-review [metrics]` | Revenue + SRE + Support + Sales in parallel → PM sets top 3 → `docs/business/weekly/` |
| `/launch-campaign <goal>` | PMM message → Growth brief → SEO + Sales + UX in parallel → Legal + Safety review |
| `/security-audit [focus]` | Security + Legal/privacy in parallel → ranked report → fixes on approval |
| `/triage <feedback>` | Support classifies → wrong verdicts to Safety, billing to Backend, requests to PM |

## How to use it
- **Just ask normally.** Claude reads `CLAUDE.md` and delegates automatically ("have the security team review the login change").
- **Name an agent explicitly:** "Use the sales-sponsorships agent to build a prospect list of Port Clinton marinas."
- **Run a workflow:** `/ship-feature add a 3-day best-window planner`.
- **Manage agents:** `/agents` in Claude Code to view/edit; or edit the `.md` files directly — they're version-controlled, so the whole "company" evolves via PRs.

## Approval gates (things agents never do alone)
- Send emails, post publicly, or contact prospects — they draft, you send.
- Change pricing, sponsor terms, or legal pages live — drafts go to `docs/` first.
- Change verdict thresholds without `marine-data-scientist` sign-off.
- Merge to `main` (which deploys) without QA and, where relevant, Security sign-off.

## Scaling up later
- **Scheduled agents:** run `/weekly-review` on a schedule (Claude Code scheduled tasks or a GitHub Action using `anthropics/claude-code-action`).
- **GitHub-triggered agents:** auto-run `security-engineer` + `qa-engineer` on every PR, and `customer-support` on new issues.
- **Connectors:** give Revenue live GA4/AdSense/Stripe data, Sales a CRM, Support the inbox — via MCP servers — so they stop relying on pasted exports.
