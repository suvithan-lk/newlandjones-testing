# Architecture

## 1. Context

Newland Jones needs:
- a **fast, trustworthy public website** that turns visitors into consultation enquiries
- a way for **staff to edit content** (services, industries, team, packages, insights, legal pages) without a developer
- **enquiries captured reliably** and handled under UK GDPR

The system is **read-heavy**: public pages are served from cache and rebuilt only when content is published. The write paths are enquiries (public) and content editing (staff).

## 2. System context (C4 level 1)

```
                 ┌─────────────────────────────┐
  Prospect ────▶ │  Newland Jones Platform     │ ───▶ Firm inbox (email)
  (browser)      │  web · admin · api · db     │ ───▶ CRM (later, webhook)
  Staff ───────▶ │                             │ ◀─── Microsoft Entra ID (staff SSO)
  (browser)      └─────────────────────────────┘ ───▶ Search engines (sitemap, SSR HTML)
```

## 3. Containers (C4 level 2)

```
                               Azure Front Door (Premium) — TLS, CDN cache, WAF, rate rules
                         ┌──────────────────────┴───────────────────────┐
             www.newlandjones.co.uk                           admin.newlandjones.co.uk
                         │                                              │
┌────────────────────────▼──────────────┐        ┌──────────────────────▼───────────────┐
│ web  (Next.js 16, Container App)      │        │ admin (Next.js 16, Container App)    │
│ • RSC pages, ISR + tag revalidation   │        │ • Entra ID sign-in (OIDC)            │
│ • Enquiry server action → api         │        │ • Content editor, enquiry inbox      │
│ • /api/revalidate (HMAC-signed)       │        │ • Calls api with user access token   │
└───────────────┬───────────────────────┘        └──────────────────────┬───────────────┘
                │  internal HTTPS (Container Apps environment, VNet)     │
                └──────────────────────────┬────────────────────────────┘
                           ┌───────────────▼─────────────────────────┐
                           │ api (.NET 10, Container App, internal)  │
                           │ • Public read endpoints (published only)│
                           │ • Enquiry intake + Turnstile + limits   │
                           │ • Admin endpoints (JWT, roles)          │
                           │ • Outbox worker → email, revalidation   │
                           └──┬───────────────┬──────────────┬───────┘
          private endpoint    │               │              │ managed identity
          ┌───────────────────▼──┐   ┌────────▼────────┐  ┌──▼─────────────────────┐
          │ PostgreSQL 17        │   │ Blob Storage    │  │ Communication Services │
          │ Flexible Server      │   │ (media, private │  │ Email                  │
          │ (zone-redundant HA)  │   │  + CDN origin)  │  └────────────────────────┘
          └──────────────────────┘   └─────────────────┘
          Key Vault (secrets) · Application Insights (telemetry) · Container Registry
```

**Key properties:**
- **The api has internal ingress only.** It isn't reachable from the internet; only web and admin call it, server-to-server. This shrinks the attack surface a lot.
- **The api is the single writer and reader of the database.** Next.js never holds database credentials.
- All Azure services sit in **UK South** (UK data residency), with a geo-redundant backup copy in UK West.
- Services authenticate to each other with **managed identities** wherever Azure supports it. There are no connection-string passwords.

## 4. Key flows

### 4.1 Page view (public)

```
Browser → Front Door (cache HIT → done)
        → web: RSC fetch api /v1/services/{slug}  (tag: service:{slug}, cached until revalidated)
        → HTML streamed, cached at Front Door for s-maxage, then stale-while-revalidate
```

### 4.2 Enquiry

```
Browser form → web Server Action (validate with zod, forward client IP)
  → api POST /v1/enquiries
      1. rate-limit (IP)   2. validate (FluentValidation)   3. verify Turnstile
      4. BEGIN TX: insert enquiry + outbox(EnquiryReceived) COMMIT
      5. 202 Accepted
  → Outbox worker (async, retried): email firm inbox + acknowledgement to sender, CRM webhook (later)
```

The enquiry is **never lost**, even if email is down, because it's committed to the database before the response goes back.

### 4.3 Publish content

```
Editor (admin) → api PUT /v1/admin/services/{id}  (Draft)
              → api POST /v1/admin/services/{id}/publish  (requires Approved, not ClientRequired)
                  TX: status=Published, audit_log row, outbox(ContentPublished{tags})
              → Outbox worker → web POST /api/revalidate {tags:["service:payroll","services"]} (HMAC)
              → web revalidateTag() → next request rebuilds the page → Front Door purge (path)
```

## 5. Repository layout (monorepo)

```
newland-jones/
├── apps/
│   ├── web/                     Next.js public site
│   └── admin/                   Next.js admin/CMS
├── packages/
│   ├── ui/                      Shared design system: tokens (Tailwind v4 @theme), components
│   ├── api-client/              TypeScript client generated from the api OpenAPI document
│   └── config/                  Shared ESLint, TypeScript, Prettier config
├── backend/
│   ├── NewlandJones.slnx
│   ├── src/
│   │   ├── NewlandJones.Api/            Minimal API endpoints, auth, OpenAPI, composition root
│   │   ├── NewlandJones.Application/    Use cases (commands/queries), validators, DTOs, interfaces
│   │   ├── NewlandJones.Domain/         Entities, value objects, domain rules, events
│   │   └── NewlandJones.Infrastructure/ EF Core + Npgsql, migrations, email, blob, outbox worker
│   └── tests/
│       ├── NewlandJones.UnitTests/
│       ├── NewlandJones.IntegrationTests/   (Testcontainers PostgreSQL + WebApplicationFactory)
│       └── NewlandJones.ArchitectureTests/  (layer dependency rules)
├── infra/                       Bicep modules + per-environment parameters
├── design-sample/               The current static HTML (reference only, not deployed)
├── docs/                        This knowledge base
├── docker-compose.yml           Local: postgres, azurite (blob), mailpit (email), api, web, admin
├── .github/workflows/
└── Readme.md
```

JS workspaces use **pnpm + Turborepo**. The .NET solution builds independently with `dotnet`.

**Moving the design sample:** move `index.html`, `pages/`, `assets/` and `public/` into `design-sample/` in the first commit. The approved logo files then move to `apps/web/public/brand/`.

## 6. Cross-cutting concerns

| Concern | Approach | Doc |
|---|---|---|
| Authentication | Staff: Entra ID (OIDC) in admin; api validates JWT (`Microsoft.Identity.Web`). Public: anonymous | [security.md](security.md#4-authentication--authorisation) |
| Authorisation | Roles from Entra app roles: `Admin`, `Editor`, `EnquiryManager` | [backend.md](backend.md#6-authentication--authorisation) |
| Caching | Next.js data cache with tags + Front Door edge cache; api `OutputCache` for public GETs | [frontend.md](frontend.md#4-data-fetching--caching) |
| Reliability | Transactional outbox, retries with Polly, idempotent consumers | [backend.md](backend.md#8-background-processing-outbox) |
| Observability | OpenTelemetry traces/metrics/logs across web → api → db; W3C trace context | [backend.md](backend.md#10-observability) |
| Config & secrets | Key Vault references + managed identity; no secrets in the repo | [security.md](security.md#7-secrets--configuration) |
| API contract | OpenAPI generated by the api → `packages/api-client` (openapi-typescript) | [backend.md](backend.md#5-api-surface) |
| Environments | local (docker compose) · staging · production | [ci-cd.md](ci-cd.md#5-environments) |

## 7. Decision records

### ADR-001: Next.js front end, .NET 10 API, PostgreSQL
- **Status:** Accepted (client direction, 2026-09-23)
- **Context:** The site needs top-tier SEO and performance, a staff-editable CMS, and reliable enquiry handling. The team's backend expertise is .NET.
- **Decision:** Next.js 16 (App Router, RSC) for web and admin; .NET 10 LTS (ASP.NET Core Minimal APIs) for the API; PostgreSQL 17 through EF Core 10.
- **Consequences:** Two language ecosystems, so the API contract must be explicit (OpenAPI + generated client). .NET 10 is LTS, supported to November 2028. The static design sample is a reference only.

### ADR-002: Host on Azure, UK South
- **Status:** Accepted
- **Decision:** Azure Container Apps (web, admin, api), Azure Database for PostgreSQL Flexible Server, Blob Storage, Front Door Premium (CDN + WAF), Key Vault, Communication Services Email, Application Insights. Infrastructure is written in Bicep.
- **Alternatives:** Vercel for web (best Next.js DX, but splits the estate and data residency across two vendors); AWS (equivalent, but less native for .NET and Entra).
- **Consequences:** One cloud, one identity plane (Entra + managed identity), UK residency. We run Next.js ourselves (standalone output in a container), so ISR/revalidation behaviour must be tested in our own container.

### ADR-003: Headless CMS built into our own API (no third-party CMS)
- **Status:** Accepted
- **Context:** The content model is small and well defined (about 10 types), and the firm wants content inside its own Azure tenant.
- **Decision:** Content types live in PostgreSQL, are managed through admin, and are served by the api.
- **Alternatives:** Sanity or Contentful (faster to start; extra vendor, cost and data outside the tenant); Strapi or Payload (another runtime to operate).
- **Consequences:** We build and maintain editor UIs. Keep the model deliberately small; rich text is stored as sanitised structured JSON (see [database.md](database.md#5-rich-text)).

### ADR-004: The API isn't publicly exposed
- **Status:** Accepted
- **Decision:** api ingress is internal to the Container Apps environment. The browser talks only to web and admin, which call the api server-side.
- **Consequences:** No CORS surface and a smaller attack surface. web must forward the client IP (a trusted header from inside the environment) so the api can rate-limit.

### ADR-005: Transactional outbox for side effects
- **Status:** Accepted
- **Decision:** Every side effect (emails, revalidation, CRM) is written as an `outbox_messages` row in the same transaction as the state change, and processed by a hosted worker with retries.
- **Consequences:** No lost enquiries or missed revalidations when a dependency fails. Handlers must be idempotent.

### ADR-006: Brand palette limited to two colours
- **Status:** Accepted (client instruction, 2026-09-23)
- **Decision:** UI uses only navy `#002C58` and blue `#0064DC` (from the logo), plus white and navy tints. Photography is the only exception.

*New ADRs go below with the next number. Never edit an accepted ADR; supersede it.*

## 8. Delivery phases

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Foundations** | Repo, monorepo tooling, docker compose, CI skeleton, Bicep for staging, Entra app registrations | `docker compose up` runs all 3 apps locally; CI green; staging deploys hello-world |
| **1. Design system** | `packages/ui` tokens + core components, matched to the design sample | Visual parity at 390, 1024 and 1440px with the sample (screenshot review) |
| **2. API & DB core** | Schema v1, public content endpoints, enquiry intake + outbox + email | Integration tests green against Testcontainers Postgres |
| **3. Public site** | All routes in [seo.md](seo.md#2-route-map), enquiry form, metadata, sitemap | Every design-sample page reproduced on its final URL; Lighthouse budgets pass |
| **4. Admin** | Sign-in, content editors, publish workflow, enquiry inbox, media library, audit log | An editor publishes a change and sees it live within 60s without a developer |
| **5. Hardening** | WAF rules, CSP, pen test, load test, backup/restore drill, a11y audit | Checklists in [security.md](security.md#11-pre-launch-checklist) and [workflow.md](workflow.md#5-definition-of-done) |
| **6. Content & launch** | Client content entered and approved, legal sign-off, DNS cut-over | No `ClientRequired` content published; client sign-off |

Phases 1 and 2 run in parallel after Phase 0.
