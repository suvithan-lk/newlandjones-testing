# SEO

> **Owner:** Content / SEO Lead (TBC) · **Status:** Approved baseline · **Last reviewed:** 2026-09-23

**Goal:** rank for service-in-location intent ("accountants Manchester", "small business accountant", "payroll services Manchester") and turn that traffic into consultation enquiries.

SEO is built into the architecture: server-rendered HTML (RSC), metadata stored per entry in the CMS, a sitemap generated from published content, and caching that keeps pages fast.

---

## 1. Principles

- **Every public page is server-rendered HTML.** Navigation, content and links are all present without JS.
- **Metadata is content**, edited in admin per entry (FR-A10), with safe defaults generated in code.
- **Only `Published`, non-`noindex` content** appears in the sitemap, and only published content is reachable at all.
- **Non-production is never indexable:** staging and admin return `X-Robots-Tag: noindex` and a disallow-all `robots.txt`.

## 2. Route map

The canonical host is `https://www.newlandjones.co.uk`. URLs are lowercase and hyphenated with a trailing slash (`trailingSlash: true`). The apex and `http` redirect to the canonical host with a 308.

| Route | Source (api) | Design-sample reference |
|---|---|---|
| `/` | `/v1/home` | `index.html` |
| `/about-us/` | `/v1/home` blocks + static | `pages/about-us.html` |
| `/about-us/team/` | `/v1/team` | `pages/team.html` |
| `/services/` | `/v1/services` | `pages/services.html` |
| `/services/{slug}/` | `/v1/services/{slug}` | `pages/service-*.html` |
| `/industries/` | `/v1/industries` | `pages/industries.html` |
| `/industries/{slug}/` | `/v1/industries/{slug}` | `pages/industry-*.html` |
| `/packages/` | `/v1/packages` | `pages/packages.html` |
| `/insights/` (`?page=`, `?category=`) | `/v1/articles` | `pages/insights.html` |
| `/insights/{slug}/` | `/v1/articles/{slug}` | *(new template)* |
| `/contact-us/`, `/free-consultation/` | `site-settings` + form | `pages/contact-us.html`, `pages/free-consultation.html` |
| `/privacy-policy/`, `/cookie-policy/`, `/terms/`, `/accessibility/` | `/v1/legal/{key}` | `pages/*-policy.html`, `terms.html`, `accessibility.html` |

**Initial slugs** (seeded from the brief): `accounting-bookkeeping`, `payroll`, `tax-planning-compliance`, `audit-assurance`, `business-advisory`, `company-formation-secretarial`; industries `professional-services`, `hospitality`, `ecommerce`, `property`.

**Slug changes:** when an editor changes the slug of a published entry, the api stores the old slug in a `redirects` table and web serves a **301** to the new URL. Admin warns before the change.

**Pagination:** `/insights/?page=2` is self-canonical (not canonicalised to page 1). Category-filtered lists canonicalise to the unfiltered list.

## 3. Metadata

`lib/seo.ts` → `buildMetadata(entry, defaults)` is used by every `generateMetadata`:

| Field | Rule |
|---|---|
| `title` | CMS `meta_title` (≤ 60), else `{name} | Newland Jones`. The home page uses its own title (e.g. *Accountants in Manchester for Growing Businesses | Newland Jones*, location TBC) |
| `description` | CMS `meta_description` (≤ 160), else `summary` truncated at a word boundary |
| `alternates.canonical` | `NEXT_PUBLIC_SITE_URL` + route, unless `canonical_url` overrides it |
| `openGraph` | `title`, `description`, `url`, `siteName: "Newland Jones"`, `locale: "en_GB"`, `type: website\|article`, image = CMS `og_image` else a generated branded image |
| `twitter` | `summary_large_image` |
| `robots` | `index, follow` unless `noindex`; always `noindex` on staging, draft mode and 404/500 |
| `<html lang>` | `en-GB` |

**OG images:** `app/[…]/opengraph-image.tsx` generates 1200×630 images in the brand palette (navy background, white title, blue accent) when no image is set in the CMS.

## 4. Structured data (JSON-LD)

Rendered server-side through a `<JsonLd>` component. Only mark up facts that are visible on the page and approved. Nothing is emitted while `site_settings` still holds unconfirmed data.

| Page | Types |
|---|---|
| Layout (all pages) | `Organization`: name, url, logo, `sameAs` (social links) |
| Home, Contact | `AccountingService` (`LocalBusiness` subtype): address, telephone, `openingHoursSpecification`, `areaServed`, `priceRange` |
| Service pages | `Service` (`serviceType`, `provider` → Organization, `areaServed`) + `BreadcrumbList` |
| Industry pages, legal pages | `BreadcrumbList` |
| Articles | `Article` (`headline`, `author` → Person, `datePublished`, `dateModified`, `image`, `publisher`) + `BreadcrumbList` |
| Pages with FAQs | `FAQPage`: valid for semantics, but Google restricts FAQ rich results to government/health sites, so don't expect SERP features |

```json
{
  "@context": "https://schema.org",
  "@type": "AccountingService",
  "@id": "https://www.newlandjones.co.uk/#business",
  "name": "Newland Jones",
  "url": "https://www.newlandjones.co.uk/",
  "logo": "https://www.newlandjones.co.uk/brand/logo-nj.png",
  "telephone": "<site_settings.phone>",
  "address": { "@type": "PostalAddress", "streetAddress": "<…>", "addressLocality": "Manchester", "postalCode": "<…>", "addressCountry": "GB" },
  "openingHoursSpecification": [{ "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "17:30" }]
}
```

CI validates JSON-LD output against schema.org types (Playwright extracts it and runs `schema-dts` type checks). Before launch, also check with Google's Rich Results Test.

## 5. Sitemap & robots

- `app/sitemap.ts` calls api `GET /v1/sitemap` (published slugs + `updatedAt`) and adds the static routes. It's revalidated by the `sitemap` tag on every publish.
- Use one sitemap below 50,000 URLs; split with `generateSitemaps` if insights ever grows past that.
- `app/robots.ts`: Production allows all and points to `/sitemap.xml`; any other environment returns `Disallow: /`.
- At launch, submit to Google Search Console and Bing Webmaster Tools (domain properties verified through DNS TXT).

## 6. Content & on-page

- **One `<h1>` per page** containing the primary term. The auto-numbered eyebrows are visual only; semantic structure comes from h2/h3.
- **Internal linking:** each service page links to 2 related services (curated in the CMS), the relevant industries (`service_industries`) and the consultation page. Articles link to their service.
- **Insights cadence:** 2 articles a month, answering real client questions (e.g. "When is my self assessment due?"). Every article shows its author and a **last reviewed** date, and is reviewed every tax year. This is E-E-A-T for YMYL finance content.
- **Thin content guard:** an industry page needs ≥ 300 words of genuinely sector-specific copy before it can be published (admin shows a word count).
- **Local SEO:** a Google Business Profile with NAP (name, address, phone) identical to `site_settings`; ICAEW/ACCA directory listings where eligible.
- **Images:** descriptive alt text (enforced by the media library), descriptive file names, AVIF/WebP via `next/image`.

## 7. Performance

Core Web Vitals are both a ranking signal and a conversion factor.

| Metric (mobile, p75) | Budget | How |
|---|---|---|
| LCP | < 2.5s | Edge-cached HTML; `priority` + `fetchPriority="high"` on the hero/banner image; AVIF; self-hosted fonts with `display: swap` |
| INP | < 200ms | Minimal client JS (RSC by default); menus are the main client islands |
| CLS | < 0.1 | Fixed image dimensions; `next/font` size-adjust; server-rendered header |
| First-load JS | < 120KB gz | Bundle analyser in CI; no client-side data fetching on public pages |
| Lighthouse (mobile) | Perf ≥ 90, A11y/SEO/BP ≥ 95 | Lighthouse CI on staging for key templates |

Field data: Real User Monitoring through Application Insights (web vitals reported by `useReportWebVitals`) and Search Console's CWV report.

## 8. Launch checklist

- [ ] All routes render server-side with the correct status (200/404/308)
- [ ] Canonicals absolute on `www`; apex + `http` redirect; trailing-slash rule consistent
- [ ] Every published entry has an approved meta title and description; OG images render
- [ ] JSON-LD valid; NAP identical to the Google Business Profile
- [ ] `sitemap.xml` lists only published, indexable URLs; `robots.txt` correct per environment
- [ ] Staging and admin not indexable (headers checked)
- [ ] Search Console + Bing verified; sitemap submitted
- [ ] Analytics conversion events firing (after consent where required)
- [ ] Lighthouse budgets pass on home, a service, an article, and contact
