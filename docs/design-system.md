# Design System (v5 · Quiet Luxury)

> **Owner:** Lead Frontend / Design (TBC) · **Status:** Living document · **Last reviewed:** 2026-09-23
> **Source of truth:** `packages/ui/src/tokens.css` (Tailwind v4 `@theme`). **Visual reference:** the design sample, `design-sample/assets/css/style.css`.

This document captures the visual language established by the design sample, so the Next.js apps can reproduce it exactly. The look is **editorial and quiet**: serif display type, white paper, hairline rules instead of shadows, square corners, generous whitespace and slow motion. The brand is carried by **two colours taken from the logo**.

---

## Colour

**Rule (ADR-006):** UI uses only **navy**, **blue**, **white** and **tints of navy**. Photography is the only exception. Don't introduce a third hue, including for errors or success states.

| Token | Value | Use |
|---|---|---|
| `--navy` | `#002C58` | Text, primary buttons, dark sections (top bar, CTA band, footer, popular package) |
| `--blue` | `#0064DC` | Accent: links, eyebrows, italic `<em>` in headings, numerals, underlines, hover state, buttons on navy |
| `--bg`, `--surface` | `#FFFFFF` | Page and cards |
| `--surface-2` | `#F3F5F8` | Tinted sections (`.page-section.tint`), contact card |
| `--ink` | navy @ 85% | Body copy |
| `--ink-muted` | navy @ 66% | Secondary copy, leads |
| `--ink-faint` | navy @ 48% | **Decorative only.** Fails text contrast (see below) |
| `--line` / `--line-strong` | navy @ 10% / 18% | Hairlines, borders |
| `--line-dark` | white @ 14% | Hairlines on navy |

In `packages/ui/src/tokens.css`:

```css
@theme {
  --color-navy: #002C58;
  --color-blue: #0064DC;
  --color-tint: #F3F5F8;
  --color-ink: rgb(0 44 88 / 0.85);
  --color-ink-muted: rgb(0 44 88 / 0.66);
  --color-line: rgb(0 44 88 / 0.10);
  --color-line-strong: rgb(0 44 88 / 0.18);
  --font-display: "Cormorant Garamond", Georgia, serif;
  --font-sans: "Manrope", system-ui, sans-serif;
}
```

This gives utilities like `text-navy`, `bg-tint`, `border-line` and `font-display`. **No other colour utilities are allowed.** An ESLint rule (`tailwindcss/no-arbitrary-value` plus a custom palette check) blocks raw hex values in class names.

### Contrast (WCAG 2.2 AA)

| Foreground / background | Ratio | Body text (4.5) | Large text / UI (3.0) |
|---|---|---|---|
| navy / white | 13.99 | ✅ | ✅ |
| blue / white | 5.45 | ✅ | ✅ |
| ink 85% / white | 8.92 | ✅ | ✅ |
| ink-muted 66% / white | 4.87 | ✅ | ✅ |
| ink-muted 66% / tint | 4.46 | ❌ (marginal) | ✅ |
| ink-faint 48% / white | 2.90 | ❌ | ❌ |
| white / navy | 13.99 | ✅ | ✅ |
| white / blue | 5.45 | ✅ | ✅ |
| white 50% / navy | 4.58 | ✅ (marginal) | ✅ |
| **blue / navy** | **2.57** | ❌ | ❌ |

**Contrast issues present in the design sample. The build must fix them:**

| # | Where | Problem | Fix |
|---|---|---|---|
| C-1 | Form notes, package price notes, the price suffix, nav chevrons | `--ink-faint` used for readable text | Use `--ink-muted` for text; keep faint for purely decorative marks |
| C-2 | "Most popular" badge on the navy package card, footer headings, footer icons | Blue on navy (2.57) | Use white @ 72% (7.9:1) for labels on navy |
| C-3 | Muted text inside the contact card (tint background) | 4.46:1 | Use `--ink` inside tinted surfaces |

---

## Typography

| Role | Family | Details |
|---|---|---|
| Display (h1–h3, numerals, quotes, FAQ questions) | **Cormorant Garamond** 400/500, italic 400/500 | Tight leading (0.98–1.12), slight negative tracking |
| Text and UI | **Manrope** 400/500/600/700 | Body 16–17.5px, line-height 1.7–1.85 |
| Eyebrows, labels, buttons, nav | Manrope 600, UPPERCASE | **12px minimum** (`--fs-label`), letter-spacing 0.16–0.3em (tighter on phones) |

**Scale (fluid):**

| Element | Size |
|---|---|
| Hero title | `clamp(52px, 6.4vw, 104px)` |
| Banner title | `clamp(46px, 5.6vw, 86px)` |
| Section title | `clamp(38px, 4.6vw, 64px)` |
| Card title | 30px (27px mobile) |
| Lead | 17.5px |
| Body | 16px |

**Signature move:** the emphasised phrase in a heading is written as `<em>` and renders as **blue italic serif**. Use it for one phrase per heading at most.

The logo uses its own geometric sans (in the image). Don't recreate it with web fonts. Use the `Logo` component, which serves `apps/web/public/brand/logo.svg` (SVG requested from the client; until then the transparent PNG `design-sample/public/logo.png`, 1400×250). The footer uses a white knockout of the logo (`filter: brightness(0) invert(1)`). Favicon and touch icon are cut from the "nJ" mark (`public/favicon-32.png`, `public/apple-touch-icon.png`).

---

## Layout & spacing

| Token | Desktop | ≤1023px | ≤639px |
|---|---|---|---|
| `--wrap` (max content width) | 1280px | — | — |
| `--gutter` | 32px | 24px | 20px |
| `--section-y` (section padding) | 140px | 96px | 72px |
| `--nav-h` | 92px | 72px | — |
| `--topbar-h` | 44px | 0 (hidden) | — |

Breakpoints follow Tailwind: `sm 640`, `md 768`, **`lg 1024`** (desktop nav appears), `xl 1280`. Between 1024 and 1279px the header grid switches to content-sized columns so the logo fits.

**Touch:** every interactive element on touch screens is at least **44×44px** (`--tap`). Slim underline links get an invisible `::before` hit area, so they keep their look. Links inside a sentence are exempt (WCAG 2.5.8).

**Mobile-first order:** below 1024px the hero shows the headline and primary CTA before the photo. Below 640px, content-block buttons stretch to full width and the hero caption sits under the photo.

Corners are **square** (radius 0). The only circles are icon rings and the scroll/indicator marks.

---

## Components

Each component lives in `packages/ui` and is shared by web and admin. The "Sample class" column points to the reference implementation in the design sample.

| Component | Sample class | Notes |
|---|---|---|
| `Button variant="primary"` | `.primary-pill` | Navy, rectangular, uppercase, turns blue on hover. `tone="inverse"` on navy blocks: blue, turns white on hover |
| `Button variant="outline"` | `.outline-pill` | Hairline border, turns blue on hover |
| `TextLink` | `.story-link`, `.cta-alt`, `.card-link`, `.featured-link` | Uppercase with an underline that turns blue on hover |
| `Eyebrow numbered?` | `.eyebrow`, `.banner-eyebrow`, `.section-eyebrow` | Section eyebrows **auto-number** (01, 02…) through a CSS counter on `main` |
| `Section tone="default\|tint"` | `.page-section` (+ `.tint`) | Handles the wrap container and vertical rhythm |
| `SectionHeading` | `.section-title`, `.section-lead` | Eyebrow + title (with `<em>`) + lead |
| `CardGrid cols={2\|3}` + `Card` | `.card-grid` → `.card` | Cards inside a grid get auto numerals and hide `.card-icon`. Hover draws a blue rule |
| `Card icon` (standalone) | `.card` + `.card-icon` | Icon in a hairline circle |
| `CheckList` | `.check-list` | Hairline rows |
| `PageBanner` | `.page-banner` | Photo variant when `image` is set (media library); type-only for legal and 404 |
| `FAQ` | `.faq-list` | Radix Accordion; `aria-expanded` handled |
| `CTABand` | `.cta-band` | Navy block, centred, blue button |
| `QuoteBand` | `.quote-band` | Italic serif quote. Never attribute it to a real person without approval |
| `PackageCard highlighted?` | `.package-card(.popular)` | Popular tier is inverted to navy |
| `FormField`, `FormStatus` | `.form-field`, `.field-error`, `.form-status` | Underline inputs, uppercase labels, errors linked with `aria-describedby` |
| `ContactCard` | `.contact-card` | Data from `site-settings` |

### States

| State | Treatment |
|---|---|
| Hover (links/nav) | Colour → blue; underline scales in |
| Focus | `outline: 1px solid blue; outline-offset: 4px` on `:focus-visible`. Never remove it |
| Error | Blue 600-weight message + 2px navy underline on the field + `aria-invalid="true"` (no red, per ADR-005) |
| Form status | Blue left rule on a blue @ 8% background |
| Active nav | Blue underline under the current page link |

---

## Imagery

- Warm, calm, natural-light interiors, architecture and people at work. No stock clichés (handshakes, piles of coins).
- Photos are the only place colours beyond the palette appear.
- The design sample uses **Unsplash placeholders**. Production images are licensed or commissioned, uploaded through the admin media library (Blob Storage), and served as AVIF/WebP variants.
- Every image needs descriptive `alt` text. The media library enforces it; use `alt=""` only for purely decorative use.

## Iconography

`lucide-react`, stroke 1.5, 14–18px, coloured blue or navy. LinkedIn and YouTube are inline SVG components, because Lucide has no brand icons.

## Motion

| Pattern | Spec |
|---|---|
| Hero entrance | Children fade up 18px, 1.1s, staggered 140ms |
| Hero image | Fade + scale 1.06 → 1 over 2.4s |
| Section reveal | `Reveal` component: `IntersectionObserver`, fade up 24px, 1s, once |
| Hover | 220–420ms, `cubic-bezier(0.22, 1, 0.36, 1)` |
| Reduced motion | `prefers-reduced-motion: reduce` disables all of the above |

## Voice (UI copy)

Plain English, calm and confident, no jargon, British spelling. CTAs are verbs: *Book a Consultation*, *Explore our services*, *Enquire*.
