# CI/CD

> **Owner:** Tech Lead (TBC) · **Status:** Approved baseline · **Last reviewed:** 2026-09-23

**Principles:**
- Every change is built, tested and scanned automatically.
- Artifacts are **built once and promoted** (same image digest staging → production).
- Infrastructure is code (Bicep).
- Deploys are zero-downtime and reversible in minutes.
- Pipelines authenticate to Azure with **OIDC**; no stored credentials.

---

## 1. Pipeline overview

```
PR ──────────────────────────────────────────────────────────────────────────────┐
  changes detected (paths filter) ─┬─ js:   lint · typecheck · unit · build web/admin │  required
                                   ├─ dotnet: format · build · unit · integration     │  checks
                                   │          (Testcontainers) · arch tests · coverage│
                                   ├─ contract: OpenAPI diff · api-client up to date   │
                                   ├─ db: EF migration script → PR comment             │
                                   ├─ infra: bicep build · what-if (staging)           │
                                   └─ security: gitleaks · audits · Trivy (images)     ┘
merge to main
  build images (web, admin, api) → push to ACR (tag = git SHA) → migration bundle artifact
  → deploy STAGING: bicep → run migration bundle → new revisions → smoke → e2e + axe + Lighthouse
tag vX.Y.Z
  → manual approval (GitHub Environment "production")
  → deploy PRODUCTION: bicep → migration bundle → new revisions (same digests) → smoke → shift traffic
```

## 2. Workflows

| File | Trigger | Purpose |
|---|---|---|
| `.github/workflows/ci.yml` | `pull_request`, `push: main` | Quality gates (§3), only for the areas that changed |
| `.github/workflows/deploy-staging.yml` | `push: main` (after CI) | Build images, infra, migrate, deploy, verify |
| `.github/workflows/deploy-production.yml` | `push: tags v*` | Approval → promote the staging-verified digests |
| `.github/workflows/nightly.yml` | cron `0 2 * * *` | Full e2e on staging, dependency audit, Lighthouse trend, link check |
| `.github/workflows/codeql.yml` | PR + weekly | CodeQL for C# and TypeScript |

## 3. Quality gates (CI)

| Area | Gate | Tool | Fails when |
|---|---|---|---|
| JS | Lint | ESLint (`next/core-web-vitals`, `jsx-a11y`, no `dangerouslySetInnerHTML`, palette rule) | any error |
| JS | Format | Prettier `--check` | unformatted |
| JS | Types | `tsc --noEmit` (Turborepo) | any error |
| JS | Unit | Vitest | failing test |
| JS | Build | `next build` web + admin | build error; first-load JS budget exceeded |
| .NET | Format | `dotnet format --verify-no-changes` | diff |
| .NET | Build | `dotnet build -warnaserror` | warning or error |
| .NET | Tests | xUnit unit + integration (**Testcontainers Postgres 17**) + architecture | failing test |
| .NET | Coverage | Coverlet + ReportGenerator | < 80% on Domain + Application |
| Contract | OpenAPI | `oasdiff breaking` against `main` | breaking change without a `/v2` |
| Contract | Client | regenerate `packages/api-client`, `git diff --exit-code` | stale client |
| DB | Migrations | `dotnet ef migrations has-pending-model-changes` | model changed without a migration |
| Infra | Bicep | `az bicep build` + `what-if` (posted to the PR) | invalid template |
| Security | Secrets | gitleaks | finding |
| Security | Dependencies | `pnpm audit --audit-level high`, `dotnet list package --vulnerable --include-transitive` | high or critical |
| Security | SAST | CodeQL | high-severity alert |
| Security | Images | Trivy | high or critical, fixable |

**Required status checks on `main`:** `js`, `dotnet`, `contract`, `security` (and `infra` when `infra/**` changes).

## 4. Reference: CI job (excerpt)

```yaml
name: CI
on:
  pull_request:
  push: { branches: [main] }
permissions: { contents: read, pull-requests: write }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs: { js: ${{ steps.f.outputs.js }}, dotnet: ${{ steps.f.outputs.dotnet }} }
    steps:
      - uses: actions/checkout@<sha>
      - id: f
        uses: dorny/paths-filter@<sha>
        with:
          filters: |
            js: ['apps/**', 'packages/**', 'pnpm-lock.yaml']
            dotnet: ['backend/**']

  dotnet:
    needs: changes
    if: needs.changes.outputs.dotnet == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - uses: actions/setup-dotnet@<sha>
        with: { global-json-file: backend/global.json }
      - run: dotnet restore backend --locked-mode
      - run: dotnet format backend --verify-no-changes
      - run: dotnet build backend -c Release --no-restore -warnaserror
      - run: dotnet test backend -c Release --no-build --collect:"XPlat Code Coverage"   # Testcontainers uses the runner's Docker
      - run: dotnet tool restore && dotnet ef migrations has-pending-model-changes -p backend/src/NewlandJones.Infrastructure -s backend/src/NewlandJones.Api

  js:
    needs: changes
    if: needs.changes.outputs.js == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - uses: pnpm/action-setup@<sha>
      - uses: actions/setup-node@<sha>
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test build --filter=...[origin/main]
```

## 5. Environments

| | local | staging | production |
|---|---|---|---|
| Hosts | `localhost` | `staging.newlandjones.co.uk`, `admin-staging.…` | `www.newlandjones.co.uk`, `admin.newlandjones.co.uk` |
| Azure | — | `rg-nj-staging-uks` | `rg-nj-prod-uks` |
| Container Apps | docker compose | min 0 / max 2 replicas | web min 2 / max 6; admin min 1 / max 2; api min 2 / max 6 |
| PostgreSQL | container | Burstable B1ms, no HA | General Purpose D2ds_v5, **zone-redundant HA**, geo-backup |
| Entra | dev tenant / app regs | staging app regs | production app regs |
| Email | Mailpit | ACS → allow-listed test inboxes | ACS → real recipients |
| Turnstile | test keys | test keys | production keys |
| Indexing | — | `noindex` + disallow | allowed |
| Deploy | — | automatic on `main` | tag + approval |

GitHub **Environments** (`staging`, `production`) hold the environment variables and the OIDC federated-credential subject. `production` requires reviewers (Tech Lead + 1) and allows deployment only from `v*` tags.

## 6. Deployment

Each deployment follows the same ordered steps:

1. **Infra:** `az deployment group create -f infra/main.bicep -p infra/params/<env>.bicepparam`. It's idempotent, and **what-if** output is attached to the run.
2. **Database migration:** run the **EF migration bundle** (a self-contained executable built in CI) as a Container Apps **Job** inside the VNet, using the migrator managed identity. Migrations must be backward-compatible with the currently running api ([database.md](database.md#7-migrations)). If this step fails, the deploy stops and no app changes.
3. **api:** new Container App revision (image digest from ACR) in **multiple-revision mode**. The readiness probe (`/health/ready`) must pass, then traffic shifts 0 → 100% (production canary 10% for 10 minutes, watching the error rate).
4. **web and admin:** new revisions the same way. On first start, web warms its cache for the top routes.
5. **Post-deploy:** a smoke test (below), then an outbox message purges the Front Door cache (`/*` for major releases, tag-scoped otherwise).
6. **Record:** a GitHub deployment status + annotation in Application Insights (release marker).

### Smoke test (automated)

- [ ] `GET /` 200, `/services/` 200, `/does-not-exist/` 404 (web)
- [ ] `GET /health/ready` 200 (api, through the internal job)
- [ ] Admin sign-in page loads (200, `noindex` header)
- [ ] Enquiry POST with the Turnstile **test** token on staging → 202, and the Mailpit/test inbox receives it. Production uses a monitored synthetic address; the smoke job erases the enquiry afterwards through the admin erasure endpoint
- [ ] Security headers present; `robots.txt` correct for the environment

## 7. Rollback

| Situation | Action | Time |
|---|---|---|
| Bad app release | Shift traffic back to the previous **Container App revision** (still running in multiple-revision mode): `az containerapp ingress traffic set` | < 2 min |
| Bad migration (backward-compatible) | Leave the schema; roll back the app revision. Fix forward with a new migration | < 5 min |
| Destructive data issue | **Point-in-time restore** of PostgreSQL to a new server → verify → switch the connection → post-incident review | ≤ 4h (RTO) |
| Bad infra change | Re-deploy the previous tag's Bicep | < 15 min |
| Bad content | Admin: unpublish or restore a previous revision (FR-A11) | < 1 min |

We **never** run a down-migration in production. The expand/contract discipline is what makes app-only rollback safe.

## 8. Infrastructure as code

```
infra/
├── main.bicep                    Orchestrates modules per environment
├── modules/
│   ├── network.bicep             VNet, subnets, private DNS zones
│   ├── containerapps-env.bicep   Environment (VNet-integrated), Log Analytics
│   ├── containerapp.bicep        Reused for web/admin/api (+ migration job)
│   ├── postgres.bicep            Flexible Server, Entra admin, private endpoint, HA, backups
│   ├── storage.bicep             Blob (media), lifecycle, private endpoint
│   ├── keyvault.bicep            RBAC mode, private endpoint
│   ├── frontdoor.bicep           Profiles, routes, WAF policy, custom domains, certificates
│   ├── acs-email.bicep           Communication Services + verified domain
│   ├── monitoring.bicep          App Insights, alerts, action groups
│   └── identity.bicep            User-assigned managed identities + role assignments
└── params/ staging.bicepparam · production.bicepparam
```

- Naming: `<type>-nj-<env>-uks` (e.g. `ca-nj-prod-uks-api`, `psql-nj-prod-uks`).
- Tags on every resource: `app=newland-jones`, `env`, `owner`, `costCentre`.
- Portal changes aren't allowed in production (Azure Policy `audit`). If an emergency change is made, it's back-ported to Bicep the same day.
- Budgets and cost alerts per resource group.

## 9. Launch cut-over

1. **T-7 days:** production infra deployed; content entered and approved in production admin; pen-test fixes verified.
2. **T-2 days:** lower the DNS TTL to 300s; ACS email domain verified (SPF, DKIM, DMARC); Front Door custom domains validated (managed certificates issued).
3. **T-0:**
   - point `www` (CNAME) and the apex (ALIAS/A through Front Door) to Front Door
   - apex → `www` redirect rule active
   - run the smoke test
   - submit the sitemap to Search Console and Bing
4. **T+1 day:** monitor dashboards (errors, CWV, WAF, enquiries delivered); raise the TTL.
5. **T+7 days:** enable HSTS preload submission; retrospective.

## 10. Operations automation

| Job | Schedule | Owner |
|---|---|---|
| Dependabot (npm, NuGet, Actions, Docker) | Weekly | Rotating dev |
| Nightly e2e + Lighthouse + link check on staging | Daily 02:00 | CI |
| Retention purge jobs (in the api) | Daily 03:00 / 03:30 | api |
| Backup restore drill | Quarterly | Backend Lead |
| Access review (Entra role groups, Azure RBAC, GitHub) | Quarterly | Tech Lead |
| Secret rotation | Annually + on staff change | Tech Lead |
| Pen test | Annually + before major releases | Tech Lead / external |
