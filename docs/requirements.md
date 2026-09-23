# Requirements

> **Owner:** Tech Lead (TBC) · **Status:** Approved baseline, living document · **Last reviewed:** 2026-09-23

Testable requirements for the Newland Jones platform: the **web**, **admin** and **api** apps and the **database**. Each requirement has an ID, a priority and acceptance criteria. The **Sample** column shows whether the design sample already defines the UI (✅), so the build has a visual reference.

**Priority:** `P0` blocks launch · `P1` expected at launch · `P2` post-launch

---

## 1. Scope

**In scope (v1):**
- Public marketing website: 24 page types from the design sample, plus insight article pages
- Enquiry capture: database + email to the firm + acknowledgement to the sender
- Admin CMS: edit and publish all public content, manage media, handle enquiries, audit trail
- SEO, accessibility, analytics (consent-aware), security hardening, Azure hosting

**Out of scope (v1):** client portal and document exchange, online payments, booking calendar, multi-language content, public user accounts. The top-bar "Client Portal" link points to the firm's existing provider (Q5).

## 2. Actors

| Actor | Description |
|---|---|
| Visitor | An anonymous prospect using the public site |
| Editor | A firm staff member who writes and submits content |
| Admin | Publishes content and manages users/roles, settings and deletions |
| Enquiry manager | Reads and triages enquiries, and handles erasure requests |
| System | Outbox worker, scheduled jobs |

---

## 3. Functional requirements: public website (web)

| ID | Requirement | P | Acceptance criteria | Sample |
|---|---|---|---|---|
| FR-W01 | Global header: top bar, logo, split primary nav, "Enquire" CTA | P0 | Server-rendered on every route, works without JS. Active state on the current section | ✅ |
| FR-W02 | Mega menus (Services, Industries) and a dropdown (About) | P0 | Open on hover, click and ArrowDown; close on Esc and outside click; focus returns to the trigger | ✅ |
| FR-W03 | Mobile drawer (< 1024px) with accordions | P0 | Focus trapped while open; Esc closes; body scroll locked | ✅ |
| FR-W04 | Footer with services, company, contact and legal links | P0 | Links come from api site settings and navigation data | ✅ |
| FR-W05 | Home page: hero, trust stats, sections, quote band, CTA | P0 | Stats and copy are CMS-driven; the hero image loads from the media library | ✅ |
| FR-W06 | Services hub + service detail pages | P0 | One route per published service; FAQs, check-list and CTA from the CMS | ✅ |
| FR-W07 | Industries hub + industry pages | P1 | One route per published industry | ✅ |
| FR-W08 | About and Team pages | P0 | Team members from the CMS, ordered, with photo, role and qualifications | ✅ |
| FR-W09 | Packages page | P1 | Tiers, prices (with VAT note) and features from the CMS; one tier can be flagged "popular" | ✅ |
| FR-W10 | Insights index + article pages | P1 | Pagination (12 per page), category filter, author, published and reviewed dates, reading time | 🟡 index only |
| FR-W11 | Contact + Free Consultation pages with the enquiry form | P0 | See FR-E* | ✅ |
| FR-W12 | Legal pages (Privacy, Cookies, Terms, Accessibility) | P0 | CMS-managed rich text; the "last updated" date shown | ✅ |
| FR-W13 | 404 and 500 pages | P1 | Correct HTTP status; links back to key pages | ✅ 404 |
| FR-W14 | Content changes go live without a deploy | P0 | Publish in admin → visible on web within 60s | — |

## 4. Functional requirements: enquiries

| ID | Requirement | P | Acceptance criteria |
|---|---|---|---|
| FR-E01 | Form fields: name\*, email\*, phone, business stage\*, message\*, consent notice | P0 | Client and server validation with identical rules and messages ([backend.md](backend.md#7-validation)) |
| FR-E02 | Enquiry persisted before the user sees success | P0 | Row in `enquiries` committed. `202` returned in < 800ms p95 |
| FR-E03 | Firm notified by email | P0 | Delivered to the configured inbox within 2 min; retried on failure; visible in admin if delivery fails |
| FR-E04 | Acknowledgement email to the sender | P1 | From the verified domain; SPF, DKIM and DMARC pass |
| FR-E05 | Spam protection | P0 | Turnstile + honeypot + rate limit (5 per 10 min per IP) + WAF rule |
| FR-E06 | Graceful failure | P0 | On an api error the form keeps the user's input and shows phone and email alternatives |

## 5. Functional requirements: admin (CMS)

| ID | Requirement | P | Acceptance criteria |
|---|---|---|---|
| FR-A01 | Staff sign-in with Microsoft Entra ID (the firm's M365), MFA enforced by conditional access | P0 | No local passwords. Access limited to users assigned an app role |
| FR-A02 | Roles: `Admin`, `Editor`, `EnquiryManager` | P0 | The api enforces roles on every admin endpoint; the UI hides what a role can't do |
| FR-A03 | CRUD for services, industries, team members, packages, articles, article categories, FAQs, legal pages, site settings, home page blocks | P0 | Validation errors shown inline; optimistic concurrency (no silent overwrite) |
| FR-A04 | Content workflow `Draft → InReview → Approved → Published → Archived` | P0 | Only `Admin` publishes; a `ClientRequired` item can't be published ([database.md](database.md#4-content-status-workflow)) |
| FR-A05 | Preview unpublished content on web | P1 | Signed preview link via Next.js draft mode, valid for 1 hour |
| FR-A06 | Media library | P0 | Upload JPEG, PNG, WebP or SVG (sanitised), ≤ 10MB; alt text required; images resized to AVIF/WebP variants |
| FR-A07 | Enquiry inbox | P0 | List, filter by status and date, view, set status (`New/Contacted/Qualified/Closed/Spam`), add internal note, export CSV |
| FR-A08 | Right to erasure | P0 | `EnquiryManager` can permanently delete an enquiry; the action is audited without keeping the personal data |
| FR-A09 | Audit log | P0 | Who, what, when and before/after for every admin write and publish; read-only; kept for 2 years |
| FR-A10 | SEO fields per page/entry | P1 | Meta title, description, OG image, canonical override, `noindex` toggle |
| FR-A11 | Revision history | P2 | Last 20 versions per entry; restore to draft |

## 6. Functional requirements: platform

| ID | Requirement | P | Acceptance criteria |
|---|---|---|---|
| FR-P01 | Cookie consent before non-essential cookies | P0 | No analytics requests before opt-in (PECR); reject is as easy as accept |
| FR-P02 | Conversion analytics | P1 | Events: CTA click, form submit success, `tel:`/`mailto:` click |
| FR-P03 | Enquiry retention job | P0 | Enquiries older than the retention period (default 24 months) are purged nightly |
| FR-P04 | Health endpoints | P0 | `/health/live` and `/health/ready` (DB) on the api; Container Apps probes configured |

---

## 7. Non-functional requirements

| ID | Category | Requirement / target |
|---|---|---|
| NFR-01 | Performance (web) | Core Web Vitals p75 mobile: LCP < 2.5s, INP < 200ms, CLS < 0.1. Lighthouse mobile ≥ 90 perf, ≥ 95 a11y/SEO/best practices |
| NFR-02 | Performance (api) | Public GET p95 < 150ms (cache miss), POST enquiry p95 < 800ms |
| NFR-03 | Page weight | First-load JS < 120KB gz on content pages; hero image < 200KB |
| NFR-04 | Availability | web 99.9% monthly; api 99.9%; single-region with zone redundancy |
| NFR-05 | Recovery | RPO ≤ 5 min (PITR), RTO ≤ 4h; backup restore tested quarterly |
| NFR-06 | Scalability | 50 concurrent editors is not a goal; 200 req/s at the edge with ≥ 95% cache hit |
| NFR-07 | Accessibility | WCAG 2.2 AA on web **and** admin; 0 serious or critical axe violations |
| NFR-08 | Security | OWASP ASVS L2 for the api/admin; Mozilla Observatory A for web; annual pen test |
| NFR-09 | Privacy | UK GDPR + PECR; data in UK regions; retention enforced (FR-P03) |
| NFR-10 | Browser support | Latest 2 versions of Chrome, Edge, Firefox, Safari (macOS + iOS) |
| NFR-11 | Maintainability | ≥ 80% line coverage on Application/Domain; architecture tests enforce layering |
| NFR-12 | Observability | Distributed tracing web → api → db; alerts for errors, latency and email failures |
| NFR-13 | Brand | Only `#002C58`, `#0064DC`, white and navy tints in UI chrome |

---

## 8. Content dependencies (client)

Entered through admin. Launch is blocked until approved:

- [ ] Company details: founding year, registered address, company number, regulatory body (ICAEW/ACCA), ICO number
- [ ] Contact details: phone, email, office hours
- [ ] Team: names, roles, qualifications, photos, bios
- [ ] Trust stats: client count, years of experience
- [ ] Package prices and inclusions
- [ ] Confirmed industries list
- [ ] Legal texts approved by the firm's adviser
- [ ] Testimonials (optional) with written consent
- [ ] Photography (licensed or commissioned)
- [ ] Logo in SVG

## 9. Open questions

| # | Question | Working assumption |
|---|---|---|
| Q1 | Enquiry notification inbox address? | `enquiries@newlandjones.co.uk` shared mailbox |
| Q2 | CRM integration? | None at launch; outbox-based webhook later |
| Q3 | Analytics provider? | Plausible (cookieless) or GA4 behind consent; decide before Phase 3 |
| Q4 | Enquiry retention period? | 24 months, then purge (confirm with the firm's DPO) |
| Q5 | Client portal provider for the top-bar link? | The firm's existing practice-management portal |
| Q6 | Who holds the `Admin` role? | 2 named partners + the Tech Lead |
