# Database (PostgreSQL)

> **Owner:** Backend Lead (TBC) · **Status:** Approved baseline · **Last reviewed:** 2026-09-23

**PostgreSQL 17** on Azure Database for PostgreSQL Flexible Server (UK South), accessed **only** by the api through EF Core 10 + Npgsql.

---

## 1. Conventions

| Rule | Detail |
|---|---|
| Naming | `snake_case` tables (plural) and columns, via `EFCore.NamingConventions` |
| Primary keys | `uuid`, generated in the app as **UUIDv7** (`Guid.CreateVersion7()`), which is time-ordered and index-friendly |
| Timestamps | `timestamptz` only, stored in UTC: `created_at`, `updated_at` (set by an EF interceptor) |
| Soft delete | Content isn't hard-deleted; it moves to `status = 'archived'` + `archived_at`. **Enquiries are hard-deleted** (erasure/retention) |
| Concurrency | Postgres system column `xmin`, mapped as the EF concurrency token → HTTP `ETag` |
| Enums | Stored as `text` with a `CHECK` constraint (readable and easy to migrate), mapped to C# enums |
| Text | `text` + `CHECK (char_length(...) <= n)` rather than `varchar(n)` |
| Case-insensitive fields | Emails normalised to lowercase in the app; slugs lowercase by rule |
| JSON | `jsonb` for structured rich text and flexible blocks only, never for data we query relationally |
| Money | `numeric(10,2)` + `currency char(3)` (always `GBP` for now) |

## 2. Entity relationship overview

```
admin_users 1───* audit_log
media_assets 1───* (referenced by services, industries, team_members, articles, home_blocks, site_settings)

services    1───* faqs (owner_type='service')        services *───* industries  (service_industries)
industries  1───* faqs (owner_type='industry')
packages    1───* package_features
article_categories 1───* articles ───* team_members (author)
legal_pages · home_blocks · site_settings (singleton) · navigation_items (self-referencing tree)

enquiries 1───* enquiry_notes
outbox_messages · processed_messages
```

## 3. Tables

### 3.1 Shared content columns

Every content table (`services`, `industries`, `team_members`, `packages`, `articles`, `legal_pages`, `home_blocks`) has these columns:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | UUIDv7 |
| `status` | text | `draft \| in_review \| approved \| published \| archived` |
| `client_required` | boolean, default `false` | Content still needs client-supplied facts. **Blocks publishing** |
| `sort_order` | integer | Manual ordering |
| `published_at` | timestamptz null | Set on first publish |
| `archived_at` | timestamptz null | |
| `created_at` / `updated_at` | timestamptz | |
| `created_by` / `updated_by` | uuid → `admin_users.id` | |

SEO columns on routable types (`services`, `industries`, `articles`, `legal_pages`): `slug`, `meta_title` (≤ 60), `meta_description` (≤ 160), `og_image_id` → `media_assets`, `canonical_url` null, `noindex` bool.

### 3.2 Content

| Table | Key columns |
|---|---|
| `services` | `slug` UNIQUE, `name`, `summary` (≤ 300), `body` jsonb, `hero_image_id`, `banner_eyebrow`, `banner_title`, `banner_text` |
| `industries` | Same shape as `services` |
| `service_industries` | (`service_id`, `industry_id`) PK: related links |
| `faqs` | `owner_type` (`service\|industry\|page`), `owner_id` uuid, `question` (≤ 200), `answer` jsonb, `sort_order` |
| `team_members` | `full_name`, `role_title`, `qualifications` text[], `bio` jsonb, `photo_id`, `email` null, `linkedin_url` null |
| `packages` | `name`, `audience`, `price_monthly` numeric(10,2), `currency`, `vat_note`, `is_popular` bool, `cta_label` |
| `package_features` | `package_id`, `label` (≤ 120), `sort_order` |
| `article_categories` | `slug` UNIQUE, `name` |
| `articles` | `slug` UNIQUE, `title`, `excerpt`, `body` jsonb, `category_id`, `author_id` → `team_members`, `featured_image_id`, `reviewed_at` timestamptz, `reviewed_by` text, `reading_minutes` int |
| `legal_pages` | `key` UNIQUE (`privacy\|cookies\|terms\|accessibility`), `title`, `body` jsonb |
| `home_blocks` | `block_key` UNIQUE (`hero\|stats\|why\|services_intro\|quote\|audiences\|cta`), `data` jsonb (validated per block schema in the app) |
| `site_settings` | Singleton row (`id = 1` CHECK): `phone`, `email`, `address` jsonb, `opening_hours` jsonb, `company_number`, `ico_number`, `regulator`, `social` jsonb, `trust_stats` jsonb |
| `navigation_items` | `parent_id` self-FK, `location` (`header_left\|header_right\|footer_services\|footer_company\|legal`), `label`, `href`, `menu_type` (`link\|dropdown\|mega`), `sort_order` |
| `media_assets` | `blob_path`, `content_type`, `width`, `height`, `bytes`, `alt_text` (**NOT NULL**), `variants` jsonb (paths per width/format), `sha256` UNIQUE (dedupe) |

### 3.3 Enquiries (personal data)

| Table | Columns |
|---|---|
| `enquiries` | `id` uuid PK · `reference` text UNIQUE (`NJ-2026-000123`, from sequence `enquiry_ref_seq`) · `name` · `email` · `phone` null · `business_stage` · `message` · `source` · `status` (`new\|contacted\|qualified\|closed\|spam`) · `ip_hash` bytea (SHA-256 + pepper, for abuse analysis only) · `user_agent` (≤ 300) · `email_delivery_status` (`pending\|sent\|failed`) · `created_at` · `updated_at` |
| `enquiry_notes` | `id`, `enquiry_id` FK **ON DELETE CASCADE**, `body` (≤ 2000), `author_id`, `created_at` |

**No raw IP address is stored.** Erasure deletes the enquiry row, and the notes cascade with it. The audit entry records only `reference` and the actor.

### 3.4 Platform

| Table | Columns |
|---|---|
| `admin_users` | `id` uuid PK · `entra_object_id` uuid UNIQUE · `display_name` · `email` · `last_seen_at` |
| `audit_log` | `id` bigint identity · `occurred_at` · `actor_id` · `action` (`create\|update\|publish\|unpublish\|archive\|delete\|erase\|export`) · `entity_type` · `entity_id` · `changes` jsonb (before/after diff, **PII fields redacted** for enquiries) · `trace_id` |
| `outbox_messages` | `id` uuid · `type` · `payload` jsonb · `occurred_at` · `processed_at` null · `attempts` int · `next_attempt_at` · `last_error` (≤ 2000) · `status` (`pending\|processed\|dead`) |
| `processed_messages` | `message_id` uuid · `handler` text · PK(`message_id`, `handler`): the idempotency record |
| `redirects` | `id` · `from_path` text UNIQUE · `to_path` text · `status_code` (301) · `created_at`. Written automatically when a published slug changes ([seo.md](seo.md#2-route-map)) |
| `__EFMigrationsHistory` | Managed by EF |

## 4. Content status workflow

```
            submit            approve             publish
  draft ──────────▶ in_review ───────▶ approved ─────────▶ published
    ▲                 │ reject              │                  │ unpublish
    └─────────────────┘◀────────────────────┘◀─────────────────┘
                                   any ──archive──▶ archived ──restore──▶ draft
```

- **Publish rule:** `status = approved AND client_required = false AND` the type's required fields are all present. It's enforced in the Domain *and* backed by a DB `CHECK (NOT (status = 'published' AND client_required))`.
- Editing a `published` item creates a working copy in the *next* revision (P2, FR-A11). Until then, edits to a published item move it back to `draft` and keep it live only if the **Admin** chooses "update live".
- The brief's content statuses map onto this: `PLACEHOLDER`/`DRAFT` → `draft`; `CLIENT_REQUIRED`/`TO_VERIFY` → `client_required = true`; `APPROVED` → `approved`; `CONFIRMED` (live) → `published`.

## 5. Rich text

Rich text (`body`, `answer`, `bio`) is stored as **structured JSON** (a TipTap/ProseMirror document), not HTML.

- The admin editor allows only: paragraphs, h2–h3, bold, italic, links, bullet/numbered lists, blockquote. There's no raw HTML, no inline styles and no images inside text.
- The api validates the JSON against an allow-list schema on save (it rejects unknown node types and `javascript:` links).
- web renders it to React elements, which escape by default. That means **no `dangerouslySetInnerHTML` anywhere**.

## 6. Indexes

| Table | Index | Why |
|---|---|---|
| routable content | `UNIQUE (slug)` | Lookup by URL |
| routable content | `(status, sort_order) WHERE status = 'published'` (partial) | Public list queries |
| `articles` | `(category_id, published_at DESC) WHERE status = 'published'` | Paged, filtered index |
| `faqs` | `(owner_type, owner_id, sort_order)` | Detail page FAQs |
| `enquiries` | `(status, created_at DESC)`, `(created_at)` | Admin inbox; retention purge |
| `outbox_messages` | `(next_attempt_at) WHERE status = 'pending'` | Worker polling |
| `audit_log` | `(entity_type, entity_id, occurred_at DESC)`, `(occurred_at)` | History views; purge |

Add indexes only with a query that needs them (check `EXPLAIN (ANALYZE, BUFFERS)` in the PR description for anything non-trivial).

## 7. Migrations

- **EF Core code-first migrations** live in `NewlandJones.Infrastructure/Persistence/Migrations`.
- Name them descriptively: `dotnet ef migrations add AddArticleReviewedAt`.
- **Review the generated SQL** in every PR: `dotnet ef migrations script <from> <to> --idempotent`. CI posts it as a PR comment.
- **Deploy:** CI builds an **EF migration bundle** (`dotnet ef migrations bundle`), which a pipeline job runs *before* rolling out the new api revision ([ci-cd.md](ci-cd.md#6-deployment)). The app **never** migrates itself on startup.
- **Expand → migrate → contract** for breaking changes. For example, to rename a column: add the new column → deploy code that writes both → backfill → deploy code that reads the new one → drop the old column in a later release. Every migration must be safe while the previous api version is still running.
- Long operations (index builds on big tables) use `CREATE INDEX CONCURRENTLY` in a raw-SQL migration with `suppressTransaction: true`.
- Seed data: reference data (legal page keys, home block keys, the site settings singleton) through migrations; demo content only through the `--seed` dev flag.

## 8. Data retention

| Data | Retention | Mechanism |
|---|---|---|
| Enquiries + notes | 24 months from `created_at` (Q4, confirm with DPO) | Nightly job `DELETE … WHERE created_at < now() - interval '24 months'` in batches of 1,000 |
| Enquiries marked `spam` | 30 days | Same job |
| Outbox (processed) | 30 days | Nightly job |
| Audit log | 2 years | Nightly job |
| Backups (PITR) | 35 days | Azure-managed; geo-redundant copy in UK West |
| Media | Until deleted in admin (blob soft delete 14 days) | Blob lifecycle policy |

## 9. Security & operations

- **Networking:** VNet integration with a **private endpoint**; public access disabled.
- **Auth:** Microsoft Entra authentication. The api connects as its **managed identity**, a Postgres role `nj_app` with `SELECT/INSERT/UPDATE/DELETE` on the app schema only. Migrations run as the pipeline identity with the `nj_migrator` role (DDL). There are no human logins in production except break-glass (PIM, time-bound).
- **Encryption:** TLS 1.2+ enforced (`require_secure_transport`); storage encrypted at rest by Azure (a customer-managed key is optional later).
- **High availability:** zone-redundant HA (standby in another zone) in production; burstable single-zone SKU in staging.
- **Sizing (start):** production General Purpose `D2ds_v5` (2 vCores, 8GB), 64GB storage with auto-grow; staging `B1ms`.
- **Connection pooling:** built-in **PgBouncer** on the Flexible Server; Npgsql `Maximum Pool Size=50` per replica.
- **Monitoring:** Query Store and `pg_stat_statements` enabled; alerts on CPU, storage > 80%, connections > 80%, replication lag.
- **Restore drill:** quarterly point-in-time restore to a scratch server, then run the integration smoke suite against it and record the RTO.

## 10. Local database

```bash
docker compose up -d postgres        # postgres:17, db=nj, user=nj, password=nj (local only)
dotnet ef database update -p backend/src/NewlandJones.Infrastructure -s backend/src/NewlandJones.Api
dotnet run --project backend/src/NewlandJones.Api -- --seed
```

Integration tests start their own disposable Postgres 17 container with Testcontainers, so they never share state with the dev database.
