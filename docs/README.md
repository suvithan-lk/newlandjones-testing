# Newland Jones — Engineering Knowledge Base

The single source of truth for **building** the Newland Jones platform: a marketing website, a content admin, and the API and database behind them. It's written for the engineers and tech leads who will build and run it.

The business brief (goals, sitemap, content rules) lives in the root [`Readme.md`](../Readme.md). These documents turn it into an engineering plan.

> **Important:** the HTML/CSS/JS files currently in this folder (`index.html`, `pages/`, `assets/`) are a **design sample only**. They fix the look, layout, IA and interactions. They are **not** the product and won't be deployed. The product is built from these docs on the stack below.

---

## Stack at a glance

| Layer | Technology |
|---|---|
| Public website | **Next.js 16** (App Router, React Server Components, TypeScript), Tailwind CSS v4 |
| Admin (CMS UI) | **Next.js 16**, a separate app on `admin.` subdomain, Microsoft Entra ID sign-in |
| Backend API | **.NET 10** (ASP.NET Core Minimal APIs, C# 14), Clean Architecture |
| Database | **PostgreSQL 17** via EF Core 10 + Npgsql |
| Hosting | **Azure, UK South**: Container Apps, Database for PostgreSQL Flexible Server, Blob Storage, Front Door + WAF, Key Vault |
| Email | Azure Communication Services Email |
| Observability | OpenTelemetry → Azure Monitor / Application Insights |
| CI/CD & IaC | GitHub Actions (OIDC to Azure), Bicep |

```
Visitor ─▶ Front Door (CDN + WAF) ─▶ web (Next.js) ──┐
Staff   ─▶ Front Door ─▶ admin (Next.js, Entra) ─────┼─▶ api (.NET 10, internal) ─▶ PostgreSQL
                                                     │                          ├─▶ Blob Storage (media)
                                                     │                          └─▶ ACS Email
```

---

## Documents

| # | Document | Read it when you need to… |
|---|---|---|
| 1 | [requirements.md](requirements.md) | know *what* to build: functional and non-functional requirements, acceptance criteria, scope |
| 2 | [architecture.md](architecture.md) | understand the system, repo layout, data flows, decision records (ADRs) and delivery phases |
| 3 | [design-system.md](design-system.md) | apply the visual language (tokens, type, components, motion) taken from the design sample |
| 4 | [frontend.md](frontend.md) | build the Next.js **web** and **admin** apps: structure, data fetching, caching, forms, a11y |
| 5 | [backend.md](backend.md) | build the .NET 10 API: layers, endpoints, validation, auth, email, background jobs |
| 6 | [database.md](database.md) | work with PostgreSQL: schema, conventions, migrations, indexing, retention, backups |
| 7 | [seo.md](seo.md) | handle routes, metadata, structured data, sitemap, Core Web Vitals |
| 8 | [security.md](security.md) | handle the threat model, auth, network isolation, headers, UK GDPR/PECR, secrets |
| 9 | [workflow.md](workflow.md) | follow the branching, commits, PR review, Definition of Done and content approval |
| 10 | [ci-cd.md](ci-cd.md) | run the pipelines, quality gates, environments, migrations, deploy and rollback |

**Reading order for a new engineer:** README → architecture → design-system → then frontend, or backend + database, depending on your role.

---

## Golden rules

1. **The design sample is the visual spec, not the code base.** Match its look; don't port its code.
2. **Two brand colours only:** navy `#002C58` and blue `#0064DC`, plus white and navy tints ([design-system.md](design-system.md#colour)).
3. **The API is the only thing that touches the database.** Next.js never connects to PostgreSQL directly.
4. **Only `Published` content is publicly visible.** Placeholder statuses can never be published ([database.md](database.md#4-content-status-workflow)).
5. **Personal data is minimised, encrypted, retained for a set period, and never logged** ([security.md](security.md)).
6. **Accessibility (WCAG 2.2 AA) and SEO are acceptance criteria**, not polish.
7. **Original content only.** BBK Partnership is a UX reference, never a content source.

---

## Glossary

| Term | Meaning |
|---|---|
| **Design sample** | The static HTML in `index.html`, `pages/` and `assets/`. The visual reference, kept under `design-sample/` in the repo |
| **web** | The public Next.js site |
| **admin** | The staff-only Next.js CMS app |
| **api** | The .NET 10 backend |
| **Enquiry** | A submission from the Contact or Free Consultation form |
| **Content status** | `Draft → InReview → Approved → Published → Archived` (plus the `ClientRequired` flag) |
| **Revalidation** | The api tells web to rebuild cached pages after content is published |

## Maintaining these docs

- Update docs in the **same PR** as the change they describe.
- Record significant decisions as a new ADR in [architecture.md](architecture.md#7-decision-records). Supersede old ADRs; don't rewrite them.
- Each doc names an owner, and the owner reviews changes to it.
