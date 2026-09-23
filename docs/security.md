# Security & Privacy

> **Owner:** Tech Lead (TBC) · **Status:** Approved baseline · **Last reviewed:** 2026-09-23

Newland Jones is a regulated professional-services firm. The platform holds **prospects' personal data** (enquiries) and gives staff **write access to the public website**. Both must be protected at a level clients would expect from their accountant.

**Target:** OWASP ASVS **Level 2** for api + admin, Mozilla Observatory **A** for web, and an **independent pen test** before launch and every year after.

---

## 1. Assets & threat model (STRIDE summary)

| Asset | Main threats | Key controls |
|---|---|---|
| Enquiry data (PII) | Leak via api/admin, logs, backups; over-retention | Internal-only api; role-based access; encryption in transit and at rest; no PII in logs; retention purge; erasure |
| Admin (content write) | Account takeover → defacement or phishing links on the site | Entra ID SSO + MFA (conditional access); app roles; publish restricted to `Admin`; full audit log |
| Public site | XSS, clickjacking, malicious third-party script | CSP with nonces; JSON rich text rendered as React (no raw HTML); `frame-ancestors 'none'`; minimal third parties |
| Enquiry endpoint | Spam, bot floods, header injection, mail relay abuse | Front Door WAF + rate rules; api rate limiter; Turnstile; honeypot; strict validation; ack email doesn't echo user input |
| Media uploads | Malware, SVG script injection, oversized files | Type sniffing (magic bytes); SVG sanitised; 10MB limit; re-encoded raster images; private container |
| Revalidation webhook | Forged calls → cache poisoning / DoS | HMAC-SHA256 signature + timestamp window; only callable inside the environment |
| Database | Direct access, SQL injection | Private endpoint, no public network; managed-identity auth; EF Core parameterisation; least-privilege roles |
| Secrets & identities | Leak in the repo or CI; over-privileged pipelines | Key Vault + managed identity; GitHub OIDC (no stored Azure credentials); secret scanning |
| Supply chain | Malicious or vulnerable packages, images | Lockfiles; Dependabot; `npm audit` / `dotnet list package --vulnerable`; image scanning; pinned Actions |

## 2. Network architecture

```
Internet ─▶ Front Door Premium (WAF: OWASP DRS + bot manager + rate rules, TLS 1.2+)
              ├─▶ web   (Container App, ingress restricted to Front Door via Private Link / X-Azure-FDID check)
              └─▶ admin (same, plus an optional IP allow-list for office/VPN)
                     ▼ internal only
                   api (Container App, internal ingress)
                     ▼ private endpoints (VNet)
         PostgreSQL · Blob Storage · Key Vault
```

- **The api has no public ingress** (ADR-004).
- Container Apps accept traffic **only from Front Door**: Private Link origin, or a check that the `X-Azure-FDID` header equals our Front Door id.
- PostgreSQL, Storage and Key Vault have **public network access disabled** and are reached over private endpoints.
- Media is served through Front Door from a private Blob container (origin authenticated with managed identity or short-lived SAS). Blobs are never public.

## 3. HTTP security headers (web and admin)

Set in `next.config.ts` `headers()` + middleware (for the per-request CSP nonce):

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (preload after one stable week) |
| `Content-Security-Policy` | see below |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `X-Frame-Options` | `DENY` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Robots-Tag` | `noindex, nofollow` on admin and all non-production web |

**CSP (web):**

```
default-src 'self';
script-src 'self' 'nonce-{n}' 'strict-dynamic' https://challenges.cloudflare.com;
style-src 'self' 'nonce-{n}';
img-src 'self' data: https://media.newlandjones.co.uk;
font-src 'self';
connect-src 'self' https://challenges.cloudflare.com;
frame-src https://challenges.cloudflare.com;
frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';
upgrade-insecure-requests;
```

Admin uses the same policy plus the Entra login origins in `form-action` and `connect-src`. Roll it out as `Report-Only` on staging, fix every violation, then enforce.

The api sets `X-Content-Type-Options: nosniff` and `Cache-Control: no-store` on admin endpoints, and returns ProblemDetails without stack traces outside Development.

## 4. Authentication & authorisation

| Principal | Mechanism |
|---|---|
| Staff → admin | Entra ID OIDC (authorisation code + PKCE) through Auth.js. **MFA enforced by conditional access**. Session cookie `HttpOnly; Secure; SameSite=Lax`, 8h absolute lifetime |
| admin → api | User **access token** (JWT) for the api scope, validated by `Microsoft.Identity.Web` (issuer, audience, signature, lifetime) |
| Roles | Entra **app roles** `Admin`, `Editor`, `EnquiryManager`, assigned to security groups, not individuals. Access reviews every quarter |
| web → api (public reads, enquiries) | Internal network only. Phase 5: web's managed-identity token as well (defence in depth) |
| api → Postgres / Blob / Key Vault / ACS | **Managed identity**, no passwords |
| api → web revalidate | HMAC-SHA256 over `timestamp.body`, a secret from Key Vault, a 5-minute window, and a constant-time compare |
| CI → Azure | GitHub **OIDC federated credentials**, scoped per environment |

Authorisation is enforced **in the api on every admin endpoint** (policies in [backend.md](backend.md#6-authentication--authorisation)). The admin UI hiding buttons is only a convenience. Integration tests assert `401`/`403` for every admin route with every wrong role.

## 5. Application security controls

- **Input validation:** FluentValidation on every command, and zod in Next.js. Reject unknown JSON properties (`JsonUnmappedMemberHandling.Disallow`).
- **Injection:** EF Core LINQ/parameterised SQL only. Raw SQL is allowed only as `FromSql` with interpolation parameters, and is reviewed.
- **Rich text:** a JSON allow-list schema, validated on save. Rendered as React elements; `dangerouslySetInnerHTML` is **banned** by an ESLint rule. Links allow only `http(s):`, `mailto:` and `tel:`.
- **Uploads:** check magic bytes; allow JPEG/PNG/WebP/SVG only; sanitise SVGs (strip scripts, event handlers, `foreignObject`, external refs); re-encode rasters with ImageSharp (drops EXIF, including GPS); random blob names; 10MB max.
- **CSRF:** Server Actions verify the Origin header (built into Next.js); admin mutations use the bearer token, not a cookie, to reach the api.
- **Rate limits:** Front Door WAF rule (e.g. 100 req/min/IP on `/contact-us` POST paths); api fixed window on enquiries (5 per 10 min per IP hash); admin endpoints 300 req/min per user.
- **Enquiry email safety:** only a validated email in `Reply-To`; all values HTML-encoded; the acknowledgement never includes user-supplied text.
- **Concurrency:** ETags prevent lost updates in admin.
- **Errors:** generic messages to clients; details go to logs with a `traceId`.

## 6. Privacy: UK GDPR, DPA 2018 & PECR

| Topic | Implementation |
|---|---|
| Controller | Newland Jones. The ICO registration number is in the privacy policy and `site_settings` |
| Lawful basis | Legitimate interests / pre-contract steps for enquiries. Documented in the privacy policy and the ROPA |
| Minimisation | Five form fields only. The IP is stored as a **salted hash**, never raw. No tracking IDs stored with enquiries |
| Residency | All data in **Azure UK South**, backups geo-replicated to UK West |
| Processors | Microsoft Azure (hosting, email), Cloudflare (Turnstile), analytics provider. DPAs in place and listed in the privacy policy |
| Retention | Enquiries 24 months (default, Q4), spam 30 days, audit 2 years, backups 35 days. Enforced by nightly jobs ([database.md](database.md#8-data-retention)) |
| Data subject rights | Access: admin export of one enquiry. Erasure: `DELETE` with audit (FR-A08). Rectification: admin edit |
| DPIA | A lightweight DPIA before launch (low risk, but it documents the decisions) |
| Cookies (PECR) | Strictly necessary only by default (admin session, Turnstile). Analytics only after opt-in, or a cookieless provider. The consent banner makes rejecting as easy as accepting |
| Breach | See §10. Notify the ICO within **72 hours** where required |

## 7. Secrets & configuration

- **Key Vault** per environment; Container Apps use **Key Vault references** with managed identity.
- The repo holds `.env.example` (web/admin) and `appsettings.json` (api) with **no secret values**. `.gitignore` covers `.env*`, `appsettings.*.local.json` and `*.pfx`.
- Locally: `dotnet user-secrets` (api) and `.env.local` (Next.js). Dev-tenant values only.
- GitHub: secret scanning + **push protection** on; gitleaks in CI.
- Rotation:
  - HMAC and Auth.js secrets every 12 months
  - Turnstile when staff change
  - immediately on suspected exposure
- Only `NEXT_PUBLIC_*` values reach browsers; PR review checks nothing sensitive is prefixed.

## 8. Supply chain

- Lockfiles committed (`pnpm-lock.yaml`, `packages.lock.json` with `RestorePackagesWithLockFile`); CI uses frozen installs.
- **Dependabot** weekly (npm, NuGet, GitHub Actions, Docker base images), with minor/patch updates grouped.
- CI fails on high or critical advisories: `pnpm audit --audit-level high`, `dotnet list package --vulnerable --include-transitive`.
- **Container images:** minimal bases (`mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled`, `node:24-alpine` for Next.js standalone), run as non-root, read-only filesystem, scanned with Trivy in CI and Microsoft Defender for Containers in ACR.
- GitHub Actions pinned to commit SHAs; `permissions:` set to least privilege per job.

## 9. Monitoring & detection

- Microsoft Defender for Cloud (Containers, Storage, Key Vault, open-source relational databases) is enabled on production.
- **Alerts:**
  - WAF block spikes
  - admin sign-ins from new countries (Entra ID Protection)
  - role assignment changes
  - Key Vault access failures
  - `outbox_dead_total > 0`
  - api 5xx > 1%
- The audit log is reviewed monthly by an `Admin` (publish actions, erasures, exports).

## 10. Incident response

1. **Detect & triage:** alert → on-call engineer → severity (S1: data exposure or defacement; S2: outage; S3: degraded).
2. **Contain:**
   - roll back the Container App revision or disable the admin app
   - revoke the Entra sessions of affected users
   - rotate exposed secrets
3. **Assess personal-data impact** with the firm's DPO. ICO notification within 72 hours if the breach is reportable; tell affected individuals if the risk is high.
4. **Eradicate & recover:** fix, redeploy through the pipeline, and verify from logs and audit.
5. **Post-incident review** within 5 working days: `docs/incidents/YYYY-MM-DD-title.md` covering timeline, root cause, actions and owners.

## 11. Pre-launch checklist

- [ ] Pen test completed; high and critical findings fixed and retested
- [ ] Front Door WAF in **Prevention** mode; rate rules tuned against load-test results
- [ ] api, Postgres, Storage and Key Vault not publicly reachable (verified from outside)
- [ ] CSP enforced (no report-only); Observatory A; HSTS on
- [ ] MFA conditional access applied to the admin app; role groups populated; break-glass account documented
- [ ] Authorisation matrix tests green (every admin route × role)
- [ ] Upload tests: SVG with a script rejected or sanitised; polyglot files rejected
- [ ] No secrets in the repo (gitleaks clean across history)
- [ ] SPF, DKIM and DMARC pass on real emails
- [ ] Retention jobs verified on staging with backdated data
- [ ] Backup restore drill completed; RTO recorded
- [ ] Privacy policy, cookie policy, ROPA and DPIA approved by the firm
