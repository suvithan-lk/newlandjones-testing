# Development Workflow

> **Owner:** Tech Lead (TBC) · **Status:** Approved baseline · **Last reviewed:** 2026-09-23

How work moves from an idea to production across the monorepo (`apps/web`, `apps/admin`, `packages/*`, `backend/`, `infra/`), and what "done" means.

---

## 1. Getting started (new engineer)

**Prerequisites:** Git, Node 24 LTS + pnpm (via `corepack enable`), .NET 10 SDK, Docker Desktop, Azure CLI, and optionally the Bicep CLI.

```bash
git clone git@github.com:<org>/newland-jones.git && cd newland-jones
pnpm install
docker compose up -d                       # postgres, azurite, mailpit
dotnet tool restore
dotnet ef database update -p backend/src/NewlandJones.Infrastructure -s backend/src/NewlandJones.Api
dotnet run --project backend/src/NewlandJones.Api -- --seed   # api on :7080
pnpm dev                                   # web :3000, admin :3001
```

Then:
1. Read [README.md](README.md) → [architecture.md](architecture.md) → [design-system.md](design-system.md) → your area's doc.
2. Ask for access: GitHub org (2FA), Azure staging resource group (Reader), and the Entra **dev** tenant app roles.
3. Ship a small first PR (a docs fix, a test, or a copy tweak) to walk through the pipeline end to end.

## 2. Branching: trunk-based

```
main ──●──────●──────────●────────●──▶  always releasable → auto-deploys to STAGING
        \    /  \        /          \
         ●──●    ●──●──●             tag v1.4.0 → approved → PRODUCTION
      feature/…   fix/…
```

- **`main`** is protected and always releasable. Every merge deploys to **staging**.
- **Production** deploys from **release tags** (`vMAJOR.MINOR.PATCH`) after a manual approval ([ci-cd.md](ci-cd.md#6-deployment)).
- **Work branches:** `feature/<area>-<desc>`, `fix/<area>-<desc>`, `chore/…`, `docs/…`, `infra/…`.
  - e.g. `feature/api-enquiry-outbox`, `feature/web-service-page`, `fix/admin-publish-etag`.
- Branches live **≤ 3 days**. Break large features into small PRs, and hide unfinished UI behind a feature flag (`FeatureManagement` in the api, env flags in Next.js).
- Hotfix: `fix/…` branch → PR → `main` → patch tag → production (the same gates, fast-tracked).

## 3. Commits

[Conventional Commits](https://www.conventionalcommits.org/). The squash-merge title must follow it; release notes are generated from these titles.

```
<type>(<scope>): <imperative summary, ≤ 72 chars>
```

| Type | Use |
|---|---|
| `feat` | New capability |
| `fix` | Bug fix |
| `perf`, `refactor`, `test`, `docs`, `style`, `build`, `ci`, `chore` | As named |
| `feat!` / `BREAKING CHANGE:` | Breaking api contract or DB change (needs an ADR or a migration plan) |

**Scopes:** `web`, `admin`, `ui`, `api`, `db`, `infra`, `ci`, `deps`, `docs`.

Examples:
- `feat(api): add enquiry outbox with ACS email handler`
- `feat(web): render service detail from api`
- `fix(admin): handle 412 on concurrent edit`
- `feat(db): add articles.reviewed_at`

## 4. Pull requests

- **Small:** < 400 changed lines, excluding generated code (the api client, EF migration snapshots) and lockfiles.
- **One concern per PR.** A DB migration and the code that depends on it can share a PR if the migration is backward-compatible ([database.md](database.md#7-migrations)).
- **API contract changes:** regenerate `packages/api-client` in the same PR. CI fails if the generated client is stale or the OpenAPI diff is breaking without a version bump.

**Template** (`.github/pull_request_template.md`):

```markdown
## What & why
Closes #… · Requirement: FR-…

## How to test
Steps, or which automated tests cover it.

## Screenshots (UI)
390 / 1024 / 1440, before → after

## Checklist
- [ ] Tests added/updated (unit / integration / e2e)
- [ ] Migrations backward-compatible; generated SQL reviewed
- [ ] API client regenerated (if the contract changed)
- [ ] a11y: keyboard + screen reader for new interactive UI
- [ ] No PII in logs; no secrets; new config documented
- [ ] Docs updated (which file?)
```

**Review:**
- 1 approval minimum; **2** for `backend/**/Migrations/**`, `infra/**`, auth or security code.
- CODEOWNERS:

  | Path | Owners |
  |---|---|
  | `backend/**` | backend team |
  | `apps/**`, `packages/ui/**` | frontend team |
  | `infra/**`, `.github/**` | Tech Lead |
  | `docs/**` | the doc owner |

- **Reviewers prioritise:** correctness → security & privacy → accessibility → performance → maintainability → style. Linters own style.
- The author resolves every thread, then squash-merges once the checks are green.

## 5. Definition of Done

- [ ] Acceptance criteria of the linked requirement met ([requirements.md](requirements.md))
- [ ] CI green: lint, typecheck, unit, integration (Testcontainers), build, e2e + axe, contract diff, security scans
- [ ] **UI:** matches the design sample and [design-system.md](design-system.md) at 390 / 1024 / 1440; no horizontal scroll; keyboard-operable; 0 serious or critical axe issues
- [ ] **API:** OpenAPI updated; ProblemDetails errors; authorisation tests for new admin endpoints; no PII logged
- [ ] **DB:** migration is backward-compatible, has indexes justified by queries, and the retention impact is considered
- [ ] **SEO (web routes):** metadata, canonical, sitemap inclusion, JSON-LD where relevant
- [ ] Deployed to staging and verified there (by the client too, for visible changes)
- [ ] Docs updated in the same PR

## 6. Content workflow (in admin)

```
Editor drafts ─▶ Submit for review ─▶ Admin approves ─▶ Admin publishes ─▶ live in ≤ 60s
      ▲                 │ reject                            │
      └─────────────────┘                                   └─ unpublish / archive
```

- Content that needs facts from the client is flagged **`Client required`** and **can't be published** ([database.md](database.md#4-content-status-workflow)).
- Client sign-off happens in **staging admin**, and the approver's name is recorded in the audit log. Production content is entered or published only by the named `Admin` users.
- Tax and finance articles carry `reviewed_at` / `reviewed_by`, and are re-reviewed every tax year.

## 7. Environments & data

| Environment | Purpose | Data |
|---|---|---|
| local | Development | Seeded demo content; Mailpit catches all email |
| staging | Integration, QA, client review, UAT | Synthetic content + copies of approved content. **Never production enquiries** |
| production | Live | Real content and enquiries |

**Production personal data never leaves production.** If you need to debug data, reproduce it synthetically.

## 8. Issue tracking

- **Board** (GitHub Projects): Backlog → Ready → In progress → In review → On staging → Done.
- **Labels:** `type:feat|bug|chore|content`, `area:web|admin|api|db|infra`, `priority:P0|P1|P2`, `blocked:client`, `security`.
- **"Ready" means:** acceptance criteria written, design available (sample or spec), dependencies known.
- **Bugs:** environment, URL, viewport and browser, steps, expected vs actual, screenshot or trace id.
- **Security issues:** a private GitHub Security Advisory, not a public issue.

## 9. Releases

- Release when there's value to ship, and at least every 2 weeks during active development.
- `pnpm release` (changesets or release-please) → tag `vX.Y.Z` → generated release notes → production approval by the Tech Lead.
- **Launch (v1.0.0):** the pre-launch checklists in [security.md](security.md#11-pre-launch-checklist) and [seo.md](seo.md#8-launch-checklist), the root Readme §31, and the cut-over in [ci-cd.md](ci-cd.md#9-launch-cut-over).

## 10. Working agreements

- Decisions are made in PRs, issues or ADRs, not only in chat.
- Architectural changes need an ADR ([architecture.md](architecture.md#7-decision-records)).
- Leave the code **and docs** better than you found them.
- No production deploys late on Friday or before a holiday unless it's a hotfix with the Tech Lead on hand.
- Blameless post-incident reviews.
