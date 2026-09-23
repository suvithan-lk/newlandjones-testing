# Backend (.NET 10 API)

The `api` is an ASP.NET Core **.NET 10** service. It owns the content model, enquiries and the database, and it's only reachable from `web` and `admin` inside the Azure Container Apps environment (ADR-004).

---

## 1. Technology

| Concern          | Choice                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Runtime          | .NET 10 (LTS), C# 14, `Nullable` + `TreatWarningsAsErrors` enabled                                      |
| Web framework    | ASP.NET Core **Minimal APIs** with endpoint groups (`MapGroup`), typed results                          |
| Data access      | EF Core 10 + `Npgsql.EntityFrameworkCore.PostgreSQL`, `EFCore.NamingConventions` (snake_case)           |
| Validation       | FluentValidation                                                                                        |
| Errors           | RFC 9457 **ProblemDetails** (`AddProblemDetails`)                                                       |
| OpenAPI          | `Microsoft.AspNetCore.OpenApi` (built-in document generation) + Scalar UI in non-prod                   |
| Auth             | `Microsoft.Identity.Web` (Entra ID JWT bearer)                                                          |
| Resilience       | `Microsoft.Extensions.Http.Resilience` (Polly) for outbound HTTP                                        |
| Rate limiting    | Built-in `Microsoft.AspNetCore.RateLimiting`                                                            |
| Caching          | `OutputCache` for public GETs (tag-based eviction on publish)                                           |
| Email            | Azure Communication Services Email SDK (Mailpit via SMTP locally)                                       |
| Storage          | `Azure.Storage.Blobs` (Azurite locally)                                                                 |
| Image processing | SixLabors ImageSharp (resize + WebP/AVIF variants)                                                      |
| Observability    | OpenTelemetry + `Azure.Monitor.OpenTelemetry.AspNetCore`                                                |
| Testing          | xUnit v3, FluentAssertions or Shouldly, Testcontainers.PostgreSql, `WebApplicationFactory`, NetArchTest |

## 2. Solution structure (Clean Architecture)

```
backend/src/
├── NewlandJones.Domain/            ← no dependencies
│   ├── Content/   Service, Industry, TeamMember, Package, Article, Faq, LegalPage, SiteSettings
│   ├── Enquiries/ Enquiry, EnquiryStatus, BusinessStage
│   ├── Common/    Entity, AggregateRoot, ContentStatus, Slug (value object), DomainEvent
│   └── Errors/    DomainErrors
├── NewlandJones.Application/       ← depends on Domain
│   ├── Abstractions/  IAppDbContext, IClock, IEmailSender, IBlobStore, ITurnstileVerifier, ICurrentUser
│   ├── Content/       Queries (GetServiceBySlug…), Commands (UpdateService, Publish…), DTOs, Validators
│   ├── Enquiries/     SubmitEnquiry, ListEnquiries, ChangeStatus, EraseEnquiry
│   └── Common/        Result<T>, pagination, mapping
├── NewlandJones.Infrastructure/    ← depends on Application
│   ├── Persistence/   AppDbContext, configurations, migrations, interceptors (audit, timestamps)
│   ├── Outbox/        OutboxWriter, OutboxProcessor (BackgroundService), handlers
│   ├── Email/         AcsEmailSender, templates (Razor or Fluid)
│   ├── Storage/       BlobStore, ImagePipeline
│   └── Security/      TurnstileVerifier
└── NewlandJones.Api/               ← composition root
    ├── Endpoints/     Public/*.cs, Admin/*.cs (one static class per resource)
    ├── Auth/          policies, role constants
    ├── Middleware/    correlation id, forwarded headers (trusted from web/admin only)
    └── Program.cs
```

**Rules**, enforced by `NewlandJones.ArchitectureTests`:

- Domain references nothing. Application doesn't reference Infrastructure or ASP.NET Core.
- Endpoints stay thin: bind → call the use case → map `Result` to `TypedResults`.
- No `DbContext` in endpoints. Use cases talk to the database through `IAppDbContext`. The repository pattern isn't used on top of EF Core.

**Use-case style:** plain handler classes (`SubmitEnquiryHandler`) registered in DI. There's no MediatR: the team doesn't need its pipeline, and recent versions are commercially licensed.

## 3. Local development

```bash
docker compose up -d postgres azurite mailpit      # from repo root
cd backend
dotnet tool restore                                # dotnet-ef
dotnet ef database update -p src/NewlandJones.Infrastructure -s src/NewlandJones.Api
dotnet run --project src/NewlandJones.Api          # https://localhost:7080, docs at /scalar
```

Seed data (`--seed` flag) loads the design sample's content as `Draft` entries, so web renders realistic pages locally.

## 4. Configuration

`appsettings.json` holds no secrets. Environment-specific values come from environment variables, backed by Key Vault references in Azure.

| Key                                                           | Example / source                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ConnectionStrings__Postgres`                                 | Local: compose. Azure: `Host=…;Database=nj;Username=<managed identity>;Ssl Mode=Require` (Entra token auth, no password) |
| `Email__FirmInbox`                                            | `enquiries@newlandjones.co.uk`                                                                                           |
| `Email__From`                                                 | `no-reply@newlandjones.co.uk`                                                                                            |
| `Email__AcsEndpoint`                                          | ACS resource endpoint (managed identity)                                                                                 |
| `Turnstile__SecretKey`                                        | Key Vault                                                                                                                |
| `Storage__BlobEndpoint`                                       | `https://<acct>.blob.core.windows.net` (managed identity)                                                                |
| `Web__RevalidateUrl` / `Web__RevalidateSecret`                | `https://web.internal/api/revalidate` / Key Vault                                                                        |
| `AzureAd__TenantId`, `AzureAd__ClientId`, `AzureAd__Audience` | Entra app registration for the api                                                                                       |
| `Retention__EnquiryMonths`                                    | `24`                                                                                                                     |

Options are bound with `ValidateDataAnnotations().ValidateOnStart()`, so a misconfigured app fails fast at boot.

## 5. API surface

Base path **`/v1`**. JSON uses camelCase. Every error is ProblemDetails with a `traceId`. The OpenAPI document is at `/openapi/v1.json`, and CI generates `packages/api-client` from it.

### 5.1 Public (anonymous, called by web)

| Method & path                                                            | Returns                                                                    | Cache                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------- |
| `GET /v1/site-settings`                                                  | Contact details, hours, social links, trust stats                          | OutputCache tag `settings`        |
| `GET /v1/navigation`                                                     | Header/footer nav tree                                                     | tag `navigation`                  |
| `GET /v1/home`                                                           | Home page blocks                                                           | tag `home`                        |
| `GET /v1/services` · `GET /v1/services/{slug}`                           | Summary list · detail with FAQs                                            | tags `services`, `service:{slug}` |
| `GET /v1/industries` · `GET /v1/industries/{slug}`                       | Same shape                                                                 | `industries`, `industry:{slug}`   |
| `GET /v1/team`                                                           | Ordered team members                                                       | `team`                            |
| `GET /v1/packages`                                                       | Tiers with features                                                        | `packages`                        |
| `GET /v1/articles?category=&page=&pageSize=` · `GET /v1/articles/{slug}` | Paged list · detail                                                        | `articles`, `article:{slug}`      |
| `GET /v1/legal/{key}`                                                    | `privacy`, `cookies`, `terms`, `accessibility`                             | `legal:{key}`                     |
| `GET /v1/sitemap`                                                        | All published slugs + `updatedAt`                                          | `sitemap`                         |
| `GET /v1/redirects`                                                      | `from → to` pairs created by slug changes (web middleware serves the 301s) | `redirects`                       |
| `POST /v1/enquiries`                                                     | `202`                                                                      | not cached; rate-limited          |
| `GET /health/live` · `GET /health/ready`                                 | Liveness · readiness (DB ping)                                             | —                                 |

Public endpoints **only ever return `Published` rows**. That's a global query filter plus an explicit filter in each query.

**Preview:** `GET /v1/preview/{type}/{id}` needs a short-lived signed preview token issued to admin, and returns the draft.

### 5.2 Admin (Entra JWT, role-checked, called by admin)

| Resource                                                                                                      | Endpoints                                                                                                                                        | Roles                             |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Content (services, industries, team, packages, articles, categories, faqs, legal, home, settings, navigation) | `GET list`, `GET {id}`, `POST`, `PUT {id}` (with `If-Match` ETag), `DELETE {id}` (archive)                                                       | Editor, Admin                     |
| Workflow                                                                                                      | `POST {type}/{id}/submit` (→ InReview), `/approve`, `/publish`, `/unpublish`, `/archive`                                                         | publish/unpublish: **Admin** only |
| Media                                                                                                         | `POST /v1/admin/media` (multipart), `GET`, `PATCH {id}` (alt text), `DELETE {id}`                                                                | Editor, Admin                     |
| Enquiries                                                                                                     | `GET /v1/admin/enquiries?status=&from=&to=&page=`, `GET {id}`, `PATCH {id}/status`, `POST {id}/notes`, `GET export.csv`, `DELETE {id}` (erasure) | EnquiryManager, Admin             |
| Audit                                                                                                         | `GET /v1/admin/audit?entity=&user=&from=&to=`                                                                                                    | Admin                             |
| Preview                                                                                                       | `POST /v1/admin/preview-tokens`                                                                                                                  | Editor, Admin                     |

**Concurrency:** every content row has a `xmin`-based concurrency token, exposed as an `ETag`. A `PUT` without a matching `If-Match` returns `412 Precondition Failed`, so two editors can't silently overwrite each other.

### 5.3 `POST /v1/enquiries` in detail

```json
{
  "name": "Jane Smith",
  "email": "jane@example.co.uk",
  "phone": "0161 000 0000",
  "businessStage": "LimitedCompany",
  "message": "We need help with year-end accounts.",
  "source": "ContactPage",
  "website": "",
  "turnstileToken": "0.xxxx"
}
```

| Status                                             | When                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `202 Accepted` `{ "reference": "NJ-2026-000123" }` | Persisted (or silently dropped as a honeypot hit, with a fake reference) |
| `400` ProblemDetails with an `errors` dictionary   | Validation failed                                                        |
| `403`                                              | Turnstile failed                                                         |
| `413` / `415`                                      | Body > 16KB / not JSON                                                   |
| `429` + `Retry-After`                              | Rate limit hit                                                           |
| `500`                                              | Unexpected. web shows the fallback contact details (FR-E06)              |

Flow: **rate limit → validate → honeypot → Turnstile → transaction (insert enquiry + outbox `EnquiryReceived`) → 202**. Email happens asynchronously in the outbox worker.

## 6. Authentication & authorisation

- The **admin** app signs staff in with Entra ID (authorisation code + PKCE) and calls the api with an **access token** for the `api://newland-jones-api/.default` scope.
- The **api** validates the JWT (`AddMicrosoftIdentityWebApi`): issuer, audience, lifetime, signature.
- **App roles** are defined on the api's app registration and assigned to users or groups in Entra: `Admin`, `Editor`, `EnquiryManager`. Policies:

```csharp
builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Policies.EditContent,     p => p.RequireRole(Roles.Editor, Roles.Admin))
    .AddPolicy(Policies.PublishContent,  p => p.RequireRole(Roles.Admin))
    .AddPolicy(Policies.ManageEnquiries, p => p.RequireRole(Roles.EnquiryManager, Roles.Admin))
    .AddPolicy(Policies.ViewAudit,       p => p.RequireRole(Roles.Admin));
```

- **Public endpoints from web:** no user identity. The api trusts web as a caller through the internal network, and optionally also through web's managed-identity token (defence in depth, Phase 5).
- `ICurrentUser` exposes the Entra object id and display name for auditing. The api doesn't store passwords or profiles; it keeps an `admin_users` row, upserted on first call, for audit display names.

## 7. Validation

Enquiry rules. The web app mirrors them in zod, and a shared contract test keeps the two in sync:

| Field           | Rule                                                                    | Message                               |
| --------------- | ----------------------------------------------------------------------- | ------------------------------------- |
| `name`          | required, trimmed, 2–100, no CR/LF                                      | "Please enter your name."             |
| `email`         | required, valid address, ≤ 254, lower-cased                             | "Please enter a valid email address." |
| `phone`         | optional, ≤ 30, `^[0-9 +()\-]*$`                                        | "Please enter a valid phone number."  |
| `businessStage` | required enum `SoleTrader \| LimitedCompany \| EstablishedSme \| Other` | "Please select your business stage."  |
| `message`       | required, 10–2,000                                                      | "Please enter a message."             |
| `source`        | enum `ContactPage \| ConsultationPage`                                  | —                                     |

Content validators enforce slug format (`^[a-z0-9]+(-[a-z0-9]+)*$`, unique per type), meta title ≤ 60, meta description ≤ 160, required alt text on images, and the publishing rules in [database.md](database.md#4-content-status-workflow).

## 8. Background processing (outbox)

`OutboxProcessor : BackgroundService` polls `outbox_messages` every 2s. It uses `SELECT … FOR UPDATE SKIP LOCKED LIMIT 20`, so multiple replicas never double-process a message.

| Message            | Handler                                                                                                        | Retry                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `EnquiryReceived`  | Email the firm (Reply-To: sender) + acknowledgement to the sender                                              | Exponential backoff, 8 attempts over about 6h, then `dead` + alert + banner in the admin inbox |
| `ContentPublished` | POST `{ tags: [...] }` to web `/api/revalidate` (HMAC-SHA256 signature header), then purge the Front Door path | 5 attempts                                                                                     |
| `MediaUploaded`    | Generate variants (480/960/1600/2400w, WebP + AVIF)                                                            | 3 attempts                                                                                     |

Handlers are **idempotent**: each message id is recorded as processed, and the email send carries the message id as its idempotency key.

**Scheduled jobs** (a `BackgroundService` with a cron schedule, running on one replica through a Postgres advisory lock):

- `03:00` — purge enquiries past retention and processed outbox rows older than 30 days
- `03:30` — purge audit rows older than 2 years

## 9. Email

|          | Firm notification                                       | Sender acknowledgement                                                                                  |
| -------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| From     | `Newland Jones Website <no-reply@…>`                    | `Newland Jones <hello@…>`                                                                               |
| To       | `Email__FirmInbox`                                      | sender                                                                                                  |
| Reply-To | sender                                                  | `hello@…`                                                                                               |
| Subject  | `New enquiry {reference} — {stage}`                     | `We've received your enquiry ({reference})`                                                             |
| Body     | All fields, London time, a link to the enquiry in admin | Thank you + reply time. **The user's message isn't echoed** (so the form can't be used as a spam relay) |

Templates are HTML + plain text with all values HTML-encoded. The domain has SPF, DKIM (ACS-managed) and DMARC `p=quarantine` or stricter.

## 10. Observability

- **OpenTelemetry**: ASP.NET Core, HttpClient, Npgsql and EF Core instrumentation. Exported to Application Insights, with W3C `traceparent` propagated from web and admin.
- **Structured logs** with `ILogger` message templates. **Never log** names, emails, phone numbers, message bodies or tokens. Log the enquiry `reference` instead.
- **Custom metrics:** `enquiries_received_total`, `outbox_pending`, `outbox_dead_total`, `email_send_duration`.
- **Alerts:** 5xx rate > 1% over 5 min; p95 latency > 1s; `outbox_dead_total` > 0; readiness failing; DB CPU > 80% over 15 min.

## 11. Testing strategy

| Layer        | What                                                                                                               | Tooling                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| Domain       | Status transitions, slug rules, invariants                                                                         | xUnit                   |
| Application  | Handlers with an in-memory fake clock/email; validators                                                            | xUnit                   |
| Integration  | Endpoints end-to-end against **real PostgreSQL** (Testcontainers), migrations applied, auth via a test JWT handler | `WebApplicationFactory` |
| Architecture | Layer dependencies, naming                                                                                         | NetArchTest             |
| Contract     | OpenAPI diff in PR (breaking change → fail unless the version is bumped)                                           | `oasdiff` in CI         |
| Load         | 200 req/s public GET, 5 req/s enquiries for 10 min                                                                 | k6 (Phase 5)            |

Coverage gate: ≥ 80% lines on Domain + Application.
