# Alinho Rebrand — Design

## Context

The app is currently branded "padel.app" / "Os Padeleiros" with a court-blue +
volt-green palette and Manrope typography. A new brand style guide
(`alinho-brand-style-guide.png`, provided by the user) and a set of logo SVGs
(`src/logo/`) define a new identity: **alinho**, built on near-black, a lime
accent (the padel ball), and a neutral gray scale, with Outfit + Geist
typography. This spec covers migrating the whole web app (this repo's
`src/`, `public/`, `index.html`, `vite.config.js`) to that identity.

Out of scope: `whatsapp-bot/` (separate service, no branding surface),
Supabase schema/backend, and a real dark-mode toggle (app stays
light-themed; near-black is used as an accent the way it already is today
on the header/nav bar, not as a page-wide theme).

## Naming

Full rename, everywhere the old name appears:
- `index.html`: `<title>`, meta description
- `vite.config.js`: PWA manifest `name`, `short_name`, `theme_color`,
  `background_color`
- `src/components/Layout.jsx`: the `Wordmark` component (see Logo section)
- `src/components/ui.jsx`: incidental "Os Padeleiros" comment/label

## Color tokens

Keep the existing architecture unchanged: CSS custom properties in
`src/index.css` `:root`, mapped into Tailwind utilities via
`tailwind.config.js`. Only the token *values* and *family names* change.
Because the app already routes all color through these tokens, updating
`index.css` + `tailwind.config.js` cascades automatically — the ~261
Tailwind-class usages across 10 files (`court-*`, `volt-*`, `sand`,
`muted`, `apple.*` aliases) get a mechanical rename, not a redesign.

Rename token families: `court` → `ink`, `volt` → `lime`. Drop the
`apple.*` legacy alias block (`tailwind.config.js`) — it exists to keep old
pages compatible with an even-older palette; not needed once the rename is
complete everywhere.

The style guide captions each swatch with its intended use, so this
mapping is largely literal rather than inferred:

| Current token | New value | Role |
|---|---|---|
| `court-900` (`#0B2545`) | `ink-900` — Near Black `#040404` | headings, header/nav bg |
| `court-700` / `court-600` | `ink-700` — Charcoal `#1F2937` | high-hierarchy text, links, secondary btn border |
| `court-500` | `ink-500` — Dark Gray `#4B5563` | supporting body copy, secondary labels |
| `court-200` | `ink-200` — Medium Gray `#9CA3AF` | muted text, placeholders, icon borders |
| `court-100` / `court-50` | `ink-50` — Light Gray `#F3F4F6` | **card background** (was: page background) |
| `sand` (page bg) | `canvas` — Pure White `#FFFFFF` | **page background** (was: card background) |
| `surface` (card bg) | `surface` — Light Gray `#F3F4F6` | card background (same token name, new value — see below) |
| `volt-400` (CTA bg) | `lime-400` — Alinho Lime `#C5DD01` | primary CTA, brand accent |
| `volt-300` (CTA hover, lighter) | `lime-600` — Hover Lime `#99B200` (**darker** — guide flips hover direction vs. today) | CTA hover/active, accessible interactive text |
| *(new)* | `lime-100` — Lime Tint `#F8FCD4` | soft badge backgrounds (LevelBadge/GuestBadge-style pills) |
| `ok` | `ok` — Success Green `#10B981` | confirmed bookings, valid inputs |
| `danger` | `danger` — Error Red `#EF4444` | errors, invalid entries |
| *(new)* | `warning` — Warning Yellow `#F59E0B` | pending states, temporary notices |
| `line` (borders) | `line` — `#E5E7EB` (judgment call: sits between Light/Medium Gray; guide doesn't define a border shade) | hairline borders on the new light-gray cards |

**Card/canvas relationship flips**: the style guide captions Pure White as
the "base canvas color" and Light Gray as "base card background" — the
opposite of today's app (off-white canvas, white cards floating on top via
shadow). The new app uses a white page background with light-gray
recessed cards and a hairline border, de-emphasizing shadow.

`PrimaryButton`'s `variant = 'volt'` default prop (`src/components/ui.jsx`)
renames to `variant = 'lime'` along with its internal class mapping.

## Typography

Replace the Manrope Google Fonts `<link>` (`index.html`) with self-hosted
npm packages: `geist` (Geist Sans + Geist Mono) and `@fontsource/outfit`
(Outfit), imported in `src/index.css` or `src/main.jsx`.

- H1/H2/H3 (`font-extrabold`/headings today) → Outfit, weights
  bold/semibold/medium per level
- Body/UI text (currently Manrope) → Geist Sans
- Small uppercase labels (section eyebrows, pill badges) → Geist Mono,
  tracked-wide — a new pattern, not used today; apply where the guide's
  reference screenshots show it (e.g. status/level badges, section
  headers like "01", "02")

`tailwind.config.js` gains `fontFamily.display` (Outfit), `fontFamily.sans`
(Geist Sans, replacing Manrope), and `fontFamily.mono` (Geist Mono).

## Logo integration

- Header `Wordmark` component (`src/components/Layout.jsx:88`, currently
  hand-drawn `padel` + dot + `app` text) is replaced with the actual SVG
  logo, imported as a component. The header/nav bar background is dark
  (`bg-ink-900/95`), so it uses `src/logo/primary-dark-card.svg` (white
  wordmark, lime ball ring) rather than the fully-white
  `Monochrome Logo (White on Dark).svg` — keeping the lime ring preserves
  the brand's ball accent instead of flattening it to white-on-white.
- **Favicon + PWA icons**: none of the actual icon files exist yet in
  `public/` — `vite.config.js` and `index.html` reference
  `favicon.ico`, `apple-touch-icon.png`, `pwa-192x192.png`,
  `pwa-512x512.png`, but only placeholder `favicon.svg`/`vite.svg` are
  present. The padel-ball ring glyph is a self-contained path group inside
  the logo SVGs (the `#C5DD01` paths, distinct from the wordmark letter
  paths) — isolate it into a standalone square icon SVG
  (`src/logo/icon-mark.svg`), then generate the full PNG set with
  `@vite-pwa/assets-generator` (official companion to the already-installed
  `vite-plugin-pwa`).
- `public/ICONS_README.md` is stale (describes a manual placeholder
  workflow that predates the real logo) — delete it once real icons exist.

## Icon restyle (lucide-react)

No library swap. Retune to a consistent standard across all 9 files that
import `lucide-react`: fixed `strokeWidth` (e.g. `2`), sizes driven off the
type scale instead of varying ad hoc, and colors mapped onto the new
`ink`/`lime` tokens instead of the old `court`/`volt` ones.

## File-by-file touch list

- `src/index.css` — token values, font-face imports, base layer font
  assignments
- `tailwind.config.js` — token family rename + font families, drop
  `apple.*` alias
- `index.html` — title, meta description, remove Manrope `<link>`
- `vite.config.js` — PWA manifest name/short_name/theme_color/background_color,
  icon asset list
- `public/` — new `favicon.ico`, `apple-touch-icon.png`,
  `pwa-192x192.png`, `pwa-512x512.png`; delete `ICONS_README.md`,
  `vite.svg`
- `src/logo/icon-mark.svg` — new, extracted from existing logo SVGs
- `src/components/Layout.jsx` — `Wordmark` → real SVG logo, `court-*`/`volt-*`
  → `ink-*`/`lime-*` classes, icon restyle
- `src/components/ui.jsx` — `PrimaryButton` variant rename, token classes,
  icon restyle, badge components using new lime-tint
- `src/pages/*.jsx` (all 8 pages) — token class rename, icon restyle
- `package.json` — add `geist`, `@fontsource/outfit`,
  `@vite-pwa/assets-generator` (dev)

## Testing

No automated test suite exists in this repo (visual/styling change).
Verification is manual: run the dev server, walk every page (Home,
Rankings, GameDetails, PlayerDetails, Profile, Admin, Instructions, Login)
and confirm token rename didn't leave any stale `court-*`/`volt-*`/`apple.*`
classes (grep sweep), confirm favicon/PWA icons render, confirm fonts load.
