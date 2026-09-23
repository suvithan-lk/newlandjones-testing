# Frontend (Next.js: web + admin)

> **Owner:** Frontend Lead (TBC) · **Status:** Approved baseline · **Last reviewed:** 2026-09-23

There are two Next.js 16 apps in the monorepo, sharing one design system:

| App | Domain | Purpose | Rendering |
|---|---|---|---|
| `apps/web` | `www.newlandjones.co.uk` | Public marketing site | Static/ISR React Server Components, revalidated by tag on publish |
| `apps/admin` | `admin.newlandjones.co.uk` | Staff CMS + enquiry inbox | Dynamic, authenticated (Entra ID), `noindex` |

**Visual spec:** the design sample (`design-sample/`) and [design-system.md](design-system.md). Reproduce its look faithfully, but don't copy its code. The sample's JS-injected header, runtime Tailwind and hot-linked images are exactly what this build replaces.

---

## 1. Technology

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, RSC, Server Actions), React 19, TypeScript `strict` |
| Styling | Tailwind CSS v4 (CSS-first `@theme` tokens in `packages/ui`) |
| Components | `packages/ui`: design-system primitives, plus Radix UI primitives for complex a11y widgets (dialog, dropdown, accordion) |
| Icons | `lucide-react` (tree-shaken), plus inline SVG for LinkedIn and YouTube |
| Fonts | `next/font/google` → self-hosted Cormorant Garamond + Manrope (no runtime request to Google) |
| Images | `next/image` with `remotePatterns` for the media CDN host; AVIF/WebP |
| Forms | React Hook Form + zod (web: enquiry; admin: all editors) |
| Rich text (admin) | TipTap editor → ProseMirror JSON ([database.md](database.md#5-rich-text)) |
| Rich text (web) | JSON → React renderer (allow-listed nodes), no `dangerouslySetInnerHTML` |
| Data tables (admin) | TanStack Table |
| Auth (admin) | Auth.js (NextAuth v5) with the Microsoft Entra ID provider |
| API client | `packages/api-client`: types generated from the api OpenAPI (`openapi-typescript`) + a thin `openapi-fetch` wrapper |
| Testing | Vitest + Testing Library (units), Playwright + `@axe-core/playwright` (e2e/a11y) |
| Tooling | pnpm workspaces, Turborepo, ESLint (`next/core-web-vitals`, `jsx-a11y`), Prettier |

## 2. Repository structure

```
apps/web/
├── app/
│   ├── layout.tsx                  <html lang="en-GB">, fonts, Header, Footer, analytics consent
│   ├── page.tsx                    Home
│   ├── about-us/page.tsx
│   ├── about-us/team/page.tsx
│   ├── services/page.tsx
│   ├── services/[slug]/page.tsx    generateStaticParams from api /v1/services
│   ├── industries/page.tsx
│   ├── industries/[slug]/page.tsx
│   ├── packages/page.tsx
│   ├── insights/page.tsx           ?page=&category=
│   ├── insights/[slug]/page.tsx
│   ├── contact-us/page.tsx
│   ├── free-consultation/page.tsx
│   ├── (legal)/[key]/page.tsx      privacy-policy, cookie-policy, terms, accessibility
│   ├── api/revalidate/route.ts     HMAC-verified tag revalidation (called by the api outbox)
│   ├── api/draft/route.ts          Enables draft mode from a signed preview token
│   ├── sitemap.ts · robots.ts · not-found.tsx · error.tsx
│   └── actions/submit-enquiry.ts   Server Action → api POST /v1/enquiries
├── components/                     Page-level compositions (HomeHero, ServiceBody…)
├── lib/api.ts                      Server-only api client (import "server-only")
├── lib/seo.ts                      buildMetadata(), JSON-LD helpers
└── next.config.ts                  output: "standalone", headers(), images

apps/admin/
├── app/(auth)/sign-in/page.tsx
├── app/(dashboard)/layout.tsx      Sidebar, role-aware nav
├── app/(dashboard)/content/[type]/page.tsx        List
├── app/(dashboard)/content/[type]/[id]/page.tsx   Editor
├── app/(dashboard)/media/page.tsx
├── app/(dashboard)/enquiries/page.tsx · [id]/page.tsx
├── app/(dashboard)/audit/page.tsx
├── auth.ts                         Auth.js config (Entra ID, token refresh, roles claim)
└── middleware.ts                   Redirect unauthenticated users; noindex header

packages/ui/
├── src/tokens.css                  @theme: colours, fonts, spacing, motion (from design sample §1)
├── src/components/                 Button, TextLink, Eyebrow, Section, SectionHeading, Card, CardGrid,
│                                   PageBanner, CheckList, FAQ, CTABand, QuoteBand, PackageCard,
│                                   FormField, Header/NavMenu/MobileNav, Footer, TopBar, Logo
└── src/index.ts
```

## 3. From the design sample to components

| Sample (HTML/CSS/JS) | Component (`packages/ui`) | Notes |
|---|---|---|
| `njTopBar()` / `.top-bar` | `TopBar` (RSC) | Data from `site-settings` |
| `njNavbar()` + `NAV_CONFIG` + `renderMega` | `Header` (RSC) + `NavMenu` (client) | Nav tree from `/v1/navigation`; keep the sample's keyboard model: hover intent 120/150ms, ArrowDown, Esc returns focus |
| `initMobileDrawer()` | `MobileNav` (client, Radix Dialog) | Adds the focus trap the sample lacks |
| `njFooter()` | `Footer` (RSC) | |
| `.primary-pill` / `.outline-pill` / `.story-link` | `Button variant="primary\|outline"`, `TextLink` | Rendered as `<a>` or `<button>` depending on `href` |
| `.page-banner[style=--banner-img]` | `PageBanner image?={Media}` | `next/image` with `priority` on banners |
| `.card-grid > .card` | `CardGrid` + `Card` | Auto-numerals stay a CSS counter |
| `.faq-*` + `initFaqs()` | `FAQ` (Radix Accordion) | |
| `.cta-band`, `.quote-band` | `CTABand`, `QuoteBand` | |
| `.package-card(.popular)` | `PackageCard highlighted` | |
| `initForms()` | `EnquiryForm` (client) + `submitEnquiry` Server Action | |
| `initReveal()` | `Reveal` (client, IntersectionObserver) | Respects `prefers-reduced-motion` |

The sample's `style.css` sections 1–17 are the reference for each component's visuals. Port values through tokens, never as raw hex.

## 4. Data fetching & caching

- **All api calls happen on the server** (RSC, Server Actions, route handlers). The api is internal-only, so the browser never calls it.
- `lib/api.ts` wraps `fetch` with the internal base URL (`API_BASE_URL`), a timeout, and trace-header propagation:

```ts
// apps/web/lib/api.ts
import "server-only";
export async function getService(slug: string) {
  const res = await apiFetch(`/v1/services/${slug}`, {
    next: { tags: ["services", `service:${slug}`] },   // cached until revalidated
  });
  if (res.status === 404) notFound();
  return res.json() as Promise<ServiceDto>;
}
```

- **Revalidation:** when content is published, the api outbox calls `POST /api/revalidate` with `{ tags }`, signed `X-Signature: sha256=<HMAC(body, REVALIDATE_SECRET)>`. The route verifies the signature (constant-time compare, 5-minute timestamp window), then calls `revalidateTag` for each tag.
- **Build:** `generateStaticParams` pre-renders all published slugs, and new slugs render on demand (`dynamicParams = true`).
- **Edge:** web sends `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` for pages, and Front Door caches them. The api outbox purges changed paths after revalidating.
- **Draft mode:** admin "Preview" → `/api/draft?token=…` → validated with the api → `draftMode().enable()` → pages fetch `/v1/preview/...` with `cache: "no-store"`.
- **Admin:** always dynamic (`cache: "no-store"`), using the user's access token from the Auth.js session.

## 5. Enquiry form (web)

1. `EnquiryForm` is a client component: React Hook Form + the zod schema `enquirySchema`, which mirrors the api rules in [backend.md](backend.md#7-validation).
2. The Turnstile widget (`@marsidev/react-turnstile`) adds a token. The hidden honeypot `website` field has `tabIndex={-1}`, `aria-hidden` and `autoComplete="off"`.
3. On submit it calls the **Server Action** `submitEnquiry(formData)`, which revalidates with zod and POSTs to the api, forwarding `X-Forwarded-For` (the client IP from Front Door's `X-Azure-ClientIP`) and `traceparent`.
4. **Result handling:**
   - `202`: show a success panel with the reference, move focus to it, and fire the analytics event.
   - `400`: map field errors from ProblemDetails to fields (`aria-invalid`, `aria-describedby`).
   - `429` or `5xx`: keep the input and show phone and email alternatives (FR-E06).
5. **Progressive enhancement:** the `<form action={submitEnquiry}>` still posts without client JS. Turnstile needs JS, so non-JS users see the direct contact details.

## 6. Admin UX rules

- The layout is role-aware: `Editor` sees content and media; `EnquiryManager` sees enquiries; `Admin` sees everything, including publish, audit and settings.
- **Editors:** autosave the draft every 10s (PUT with `If-Match`). On `412`, show "Someone else changed this" with a *Reload / Compare* choice.
- **Workflow buttons** show the allowed transitions only. The publish button is disabled while `clientRequired` is set, with a tooltip explaining why.
- **Media picker** requires alt text before an image can be inserted.
- **Enquiry detail:** status control, notes, "Erase permanently" (confirmation dialog: type the reference). Personal data is never put into the URL or the page `<title>`.
- The admin app uses the same design tokens, laid out denser: body 14–15px, tables and forms.

## 7. Conventions

- **Server by default.** Add `"use client"` only for interactivity (menus, forms, editors).
- **Imports:** `@nj/ui`, `@nj/api-client`, `@/…` inside each app. No deep relative imports across packages.
- **Naming:** components in `PascalCase.tsx`, hooks `useX.ts`, server actions `verbNoun.ts`.
- **Environment variables:** validated at boot with `@t3-oss/env-nextjs` (zod). Only `NEXT_PUBLIC_*` values reach the browser (Turnstile site key, analytics domain).
- **Accessibility:**
  - one `<h1>` per page
  - landmarks
  - a skip link (`Skip to content`) as the first focusable element
  - visible `:focus-visible`
  - every icon-only button has an `aria-label`
  - colour never carries meaning alone
- **Images:** every `next/image` has `alt` (empty only if decorative), `sizes`, and `priority` for the LCP image only.
- **No layout shift:** fonts via `next/font`, fixed image dimensions, and a server-rendered header.

## 8. Environment variables

| Variable | App | Example |
|---|---|---|
| `API_BASE_URL` | web, admin | `https://api.internal.<env>.azurecontainerapps.io` |
| `REVALIDATE_SECRET` | web | Key Vault |
| `NEXT_PUBLIC_SITE_URL` | web | `https://www.newlandjones.co.uk` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | web | Cloudflare site key |
| `NEXT_PUBLIC_ANALYTICS_DOMAIN` | web | Set once Q3 is decided |
| `AUTH_SECRET` | admin | Key Vault |
| `AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_ISSUER` | admin | Entra app registration (the secret lives in Key Vault; prefer a federated credential if available) |
| `API_SCOPE` | admin | `api://newland-jones-api/.default` |

## 9. Local development

```bash
pnpm install
docker compose up -d postgres azurite mailpit api    # backend dependencies (see backend.md)
pnpm dev --filter web      # http://localhost:3000
pnpm dev --filter admin    # http://localhost:3001  (Entra dev app registration)
```

## 10. Testing

| Level | Scope | Tool |
|---|---|---|
| Unit | UI components (states, a11y roles), zod schemas, rich-text renderer (rejects unknown nodes) | Vitest + Testing Library |
| E2E: web | Every route renders; nav keyboard model; mobile drawer focus trap; enquiry happy and error paths (api mocked in CI, real on staging) | Playwright |
| E2E: admin | Sign-in (test tenant), edit → submit → approve → publish → visible on web | Playwright (staging) |
| Accessibility | axe on every route, both apps; 0 serious/critical | `@axe-core/playwright` |
| Visual | Screenshots at 390 / 1024 / 1440 compared to the approved baseline (initially the design sample) | Playwright snapshots |
| Performance | Lighthouse CI budgets ([seo.md](seo.md#7-performance)) | `@lhci/cli` |
