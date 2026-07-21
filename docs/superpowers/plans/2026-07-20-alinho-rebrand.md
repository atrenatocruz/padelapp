# Alinho Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the whole web app's visual identity from "padel.app" / "Os Padeleiros" (court-blue + volt-green, Manrope) to **alinho** (near-black + lime + neutral gray, Outfit + Geist), including real logo/favicon/PWA-icon assets, with zero behavior/logic changes.

**Architecture:** Pure visual/config rebrand. Colors stay routed through CSS custom properties (`src/index.css` `:root`) mapped into Tailwind utilities (`tailwind.config.js`) — only token *names* and *values* change, so renaming the two files at the root of the token graph cascades into ~250 mechanical Tailwind-class renames across 11 consuming files. Typography moves from a Google Fonts `<link>` to self-hosted npm font packages. The logo moves from a hand-drawn text+dot `Wordmark` to the real brand SVG, inlined as JSX (no new SVG-to-React tooling needed). Favicon/PWA icons are generated from an extracted icon-only glyph via `@vite-pwa/assets-generator`.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, react-router-dom 6, lucide-react, `@supabase/supabase-js`, `vite-plugin-pwa` (already present) + new: `@fontsource/outfit`, `@fontsource/geist-sans`, `@fontsource/geist-mono`, `@vite-pwa/assets-generator` (dev).

## Global Constraints

- Rename token families: `court` → `ink`, `volt` → `lime` (verbatim from spec).
- Drop the `apple.*` legacy alias block in `tailwind.config.js` — it exists to keep old pages compatible with an even-older palette; not needed once the rename is complete everywhere (verbatim from spec).
- **Card/canvas relationship flips**: the style guide captions Pure White as the "base canvas color" and Light Gray as "base card background" — the opposite of today's app (off-white canvas, white cards floating on top via shadow). The new app uses a white page background with light-gray recessed cards and a hairline border, de-emphasizing shadow (verbatim from spec).
- Hover-direction flip: `volt-300` (CTA hover, lighter) → `lime-600` — Hover Lime `#99B200` (**darker** — guide flips hover direction vs. today) (verbatim from spec).
- Typography: self-hosted via npm packages — `geist` (Geist Sans + Geist Mono) and `@fontsource/outfit` (Outfit) (verbatim from spec). **Verified technical correction (Task 1):** the `geist` package's only exports are `./font`, `./font/sans`, `./font/mono` etc., all resolving to `dist/font.js` — Next.js's `next/font` local-font loader API, which does not run in a plain Vite app (confirmed via `npm view geist exports`/`main`). `@fontsource/geist-sans` and `@fontsource/geist-mono` (same publisher family, same Fontsource self-hosting mechanism already used for `@fontsource/outfit`) are used instead to deliver the identical visual outcome (self-hosted Geist Sans + Geist Mono) without breaking `npm run build`.
- No real dark-mode toggle — the app stays light-themed; near-black is used as an accent the way it already is today on the header/nav bar, not as a page-wide theme (verbatim from spec).
- Out of scope: `whatsapp-bot/` (separate service, no branding surface) and the Supabase schema/backend (verbatim from spec).
- No automated test suite exists in this repo (confirmed: no Jest/Vitest/Testing-Library anywhere in the project). Every task's test cycle uses only: `npm run build`, a `grep`/`sed` sweep with an exact expected match count, and/or a manual `npm run dev` visual checklist — never an invented unit test.

---

### Task 1: Install font + PWA-icon-generator packages, rename npm package name

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: npm packages `@fontsource/outfit`, `@fontsource/geist-sans`, `@fontsource/geist-mono` available for `@import` in `src/index.css` (Task 2); dev package `@vite-pwa/assets-generator` (CLI binary `pwa-assets-generator`) available for Task 4; confirmed exact `font-family` strings that Task 3's `tailwind.config.js` must reference.

- [ ] **Step 1: Install the runtime font packages**

Run:
```bash
npm install @fontsource/outfit@^5.3.0 @fontsource/geist-sans@^5.3.0 @fontsource/geist-mono@^5.3.0
```
Expected: `package.json` `dependencies` gains all three entries; command exits 0.

- [ ] **Step 2: Install the dev-only PWA icon generator**

Run:
```bash
npm install -D @vite-pwa/assets-generator@^1.0.2
```
Expected: `package.json` `devDependencies` gains `@vite-pwa/assets-generator`; command exits 0.

- [ ] **Step 3: Rename the npm package and add the icon-generation script**

Edit `package.json` — change the `"name"` field and add a `generate-pwa-assets` script:

```json
{
  "name": "alinho",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "generate-pwa-assets": "pwa-assets-generator"
  },
  "dependencies": {
    "@fontsource/geist-mono": "^5.3.0",
    "@fontsource/geist-sans": "^5.3.0",
    "@fontsource/outfit": "^5.3.0",
    "@supabase/supabase-js": "^2.39.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vite-pwa/assets-generator": "^1.0.2",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "vite": "^5.0.8",
    "vite-plugin-pwa": "^0.17.4"
  }
}
```

- [ ] **Step 4: Verify the exact `font-family` name each package declares**

Run:
```bash
grep -m1 "font-family" node_modules/@fontsource/outfit/500.css node_modules/@fontsource/geist-sans/400.css node_modules/@fontsource/geist-mono/400.css
```
Expected: three `font-family: '<Name>';` lines. Write down the exact `<Name>` string for each — Task 3 must use these EXACT strings (verbatim, including case) as the first entry in `tailwind.config.js`'s `fontFamily.display`/`sans`/`mono` arrays. (If Outfit's declared name differs from `Outfit`, or Geist Sans's differs from `Geist Sans` — e.g. some Fontsource packages for this typeface family declare the bare name `Geist` instead of `Geist Sans` — substitute the verified string in Task 3 Step 1 instead of the literal text shown there.)

- [ ] **Step 5: Confirm the build still succeeds with no code changes yet**

Run: `npm run build`
Expected: exits 0, `dist/` is produced (nothing consumes the new packages yet, so this only proves the dependency install didn't break resolution).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add self-hosted brand fonts and PWA icon generator, rename package to alinho"
```

---

### Task 2: Rewrite `src/index.css` — new color tokens, self-hosted font imports, base layer

**Files:**
- Modify: `src/index.css` (whole file)

**Interfaces:**
- Consumes: font packages from Task 1 (`@fontsource/outfit`, `@fontsource/geist-sans`, `@fontsource/geist-mono`); the verified `font-family` name strings from Task 1 Step 4 are NOT needed here (they're consumed by Tailwind config in Task 3) — this task only imports the CSS files.
- Produces: CSS custom properties `--ink-50`, `--ink-200`, `--ink-500`, `--ink-700`, `--ink-900`, `--lime-100`, `--lime-400`, `--lime-600`, `--canvas`, `--surface`, `--line`, `--muted` (remapped to Dark Gray `#4B5563`, same value as `--ink-500` — see Step 1), `--ok`, `--danger`, `--warning`, `--shadow-card`, `--shadow-lift`, `--radius-card`, `--radius-ctrl` — Task 3 (`tailwind.config.js`) maps every one of these var names into a Tailwind utility, so the names here are load-bearing and must match exactly.

- [ ] **Step 1: Replace the entire contents of `src/index.css`**

```css
/* Self-hosted brand typography. `geist` (the official npm package) only
   ships Next.js's next/font local-loader entry points and doesn't work in
   plain Vite (see Global Constraints) — @fontsource/geist-sans and
   @fontsource/geist-mono are the self-hostable equivalent, same mechanism
   already used for @fontsource/outfit below. */
@import '@fontsource/outfit/500.css';
@import '@fontsource/outfit/600.css';
@import '@fontsource/outfit/700.css';
@import '@fontsource/geist-sans/400.css';
@import '@fontsource/geist-sans/500.css';
@import '@fontsource/geist-sans/700.css';
@import '@fontsource/geist-mono/500.css';
@import '@fontsource/geist-mono/700.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS — tweak the theme here, everything follows.
   Mapped into Tailwind utilities via tailwind.config.js.
   ════════════════════════════════════════════════════════════════════════ */
:root {
  /* Colors are RGB channel triplets so Tailwind opacity modifiers work
     (e.g. bg-danger/10). Hex equivalents in comments. */

  /* Color — ink (near-black + neutral grays). Primary family, replaces
     the old navy/blue ramp. */
  --ink-50:  243 244 246;   /* #F3F4F6 — card background */
  --ink-200: 156 163 175;   /* #9CA3AF — muted text, placeholders, icon borders */
  --ink-500: 75 85 99;      /* #4B5563 — supporting body copy, secondary labels */
  --ink-700: 31 41 55;      /* #1F2937 — high-hierarchy text, links, secondary btn border */
  --ink-900: 4 4 4;         /* #040404 — near black: headings, header/nav bg */

  /* Color — lime (the ball). ONE accent, used sparingly. */
  --lime-100: 248 252 212;  /* #F8FCD4 — soft badge tint */
  --lime-400: 197 221 1;    /* #C5DD01 — CTA / confirmed states / brand accent */
  --lime-600: 153 178 0;    /* #99B200 — CTA hover/active (darker), accessible interactive text */

  /* Color — neutrals & semantics */
  --canvas:  255 255 255;   /* #FFFFFF — app background (was: card background) */
  --surface: 243 244 246;   /* #F3F4F6 — cards (was: #FFFFFF; now the recessed light-gray card) */
  --line:    229 231 235;   /* #E5E7EB — hairline borders */
  --muted:   75 85 99;      /* #4B5563 — Dark Gray: "supporting body copy and
                                secondary label values" per the style guide.
                                Fixes a design-spec gap: the old blue ramp's
                                mid step mapped to this same value/role, but
                                the separate --muted token was never assigned
                                explicitly — left unfixed it would've been the
                                one surviving old-brand color (#5C6B7A). */
  --ok:      16 185 129;    /* #10B981 */
  --danger:  239 68 68;     /* #EF4444 */
  --warning: 245 158 11;    /* #F59E0B — pending states, temporary notices (new, not yet consumed) */

  /* Radii */
  --radius-card: 16px;
  --radius-ctrl: 12px;

  /* Elevation — soft, no heavy borders. Tint follows the new near-black ink. */
  --shadow-card: 0 1px 2px rgba(4, 4, 4, 0.05), 0 4px 16px rgba(4, 4, 4, 0.06);
  --shadow-lift: 0 2px 4px rgba(4, 4, 4, 0.07), 0 10px 28px rgba(4, 4, 4, 0.10);

  /* Spacing scale (reference — Tailwind's 4px scale is used directly):
     1=4px  2=8px  3=12px  4=16px  5=20px  6=24px  8=32px  10=40px  12=48px */

  /* Type scale (reference):
     xs=12 sm=14 base=16 lg=18 xl=20 2xl=24 3xl=30 4xl=36 —
     Geist Sans 400/500/700 (body), Outfit 500/600/700 (headings) */
}

@layer base {
  body {
    @apply font-sans antialiased bg-canvas text-ink-900;
  }
  /* Headings: Outfit, weight steps down the hierarchy per the style guide. */
  h1, h2, h3, h4 {
    @apply font-display tracking-tight;
  }
  h1 { @apply font-bold; }
  h2 { @apply font-semibold; }
  h3, h4 { @apply font-medium; }
}

@layer components {
  /* Primary CTA — lime (ball) accent, ink text. Hover goes DARKER
     (lime-600), flipped from the old lighter-hover pattern. */
  .btn-primary {
    @apply bg-lime-400 text-ink-900 font-extrabold py-3.5 px-6 rounded-ctrl
           shadow-card transition-all duration-fast
           hover:bg-lime-600 active:scale-[0.98]
           min-h-[48px] text-base;
  }

  /* Secondary — quiet ink outline. */
  .btn-secondary {
    @apply bg-surface text-ink-900 font-extrabold py-3.5 px-6 rounded-ctrl
           border border-line transition-all duration-fast
           hover:border-ink-200 hover:bg-ink-50 active:scale-[0.98]
           min-h-[48px] text-base;
  }

  .card {
    @apply bg-surface rounded-card shadow-card p-5
           transition-shadow duration-base;
  }

  .input-field {
    @apply w-full px-4 py-3.5 text-base rounded-ctrl bg-surface
           border border-line text-ink-900 placeholder:text-muted/60
           focus:border-ink-500 focus:ring-2 focus:ring-ink-50
           outline-none transition-all duration-fast min-h-[48px];
  }

  /* Pressable card affordance */
  .press {
    @apply transition-transform duration-fast active:scale-[0.985];
  }
}

/* ─── Motion — subtle & fast ─────────────────────────────────────────────── */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pop {
  0%   { opacity: 0; transform: scale(0.6); }
  70%  { opacity: 1; transform: scale(1.08); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.animate-fade-up { animation: fade-up 220ms ease-out both; }
.animate-pop     { animation: pop 250ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both; }
.animate-fade-in { animation: fade-in 180ms ease-out both; }

@media (prefers-reduced-motion: reduce) {
  .animate-fade-up, .animate-pop, .animate-fade-in { animation: none; }
  .press { transition: none; }
}
```

- [ ] **Step 2: Confirm no stale token names remain in this file**

Run:
```bash
grep -nE "court-|volt-|apple-|--court|--volt|--sand\b" src/index.css
```
Expected: no output (exit code 1). (`npm run build` will still fail at this point — `tailwind.config.js` in Task 3 hasn't been updated yet, so the new `bg-ink-900`/`bg-canvas`/etc. classes referenced by `@apply` don't resolve. That's expected; do not run `npm run build` as a gate until Task 3 is done.)

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: replace court/volt color tokens with alinho ink/lime palette, add self-hosted fonts"
```

---

### Task 3: Rewrite `tailwind.config.js` — token family rename + font families, drop `apple.*` alias

**Files:**
- Modify: `tailwind.config.js` (whole file)

**Interfaces:**
- Consumes: CSS var names from Task 2 (`--ink-50/200/500/700/900`, `--lime-100/400/600`, `--canvas`, `--surface`, `--line`, `--muted`, `--ok`, `--danger`, `--warning`); the verified `font-family` strings from Task 1 Step 4.
- Produces: Tailwind color utilities `ink-{50,200,500,700,900}`, `lime-{100,400,600}`, `canvas`, `surface`, `line`, `muted`, `ok`, `danger`, `warning`; `fontFamily.display`, `fontFamily.sans`, `fontFamily.mono` — every later task's className strings (`bg-ink-900`, `text-lime-400`, `font-display`, `font-mono`, etc.) depend on these exact names.

- [ ] **Step 1: Replace the entire contents of `tailwind.config.js`**

(Replace `'Outfit'`, `'Geist Sans'`, `'Geist Mono'` below with whatever Task 1 Step 4 actually printed, if different.)

```js
/** @type {import('tailwindcss').Config} */

// ─── Design tokens live in src/index.css (:root) ────────────────────────────
// This config maps Tailwind utilities onto those CSS variables, so the whole
// theme can be tweaked in ONE place: the token block at the top of index.css.

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Headings — Outfit, weights bold/semibold/medium per level (see src/index.css base layer)
        display: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        // Body/UI text — Geist Sans, replacing Manrope
        sans: ['Geist Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        // Small uppercase labels (badges, section eyebrows) — Geist Mono, tracked-wide at call sites
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Ink — near-black + neutral grays (primary family, was: court)
        ink: {
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
        },
        // Lime (single sharp accent — the ball, was: volt)
        lime: {
          100: 'rgb(var(--lime-100) / <alpha-value>)',
          400: 'rgb(var(--lime-400) / <alpha-value>)',
          600: 'rgb(var(--lime-600) / <alpha-value>)',
        },
        canvas: 'rgb(var(--canvas) / <alpha-value>)',    // pure-white app background (was: sand)
        surface: 'rgb(var(--surface) / <alpha-value>)',  // light-gray cards (was: white cards)
        line: 'rgb(var(--line) / <alpha-value>)',        // hairline borders
        muted: 'rgb(var(--muted) / <alpha-value>)',      // secondary text
        ok: 'rgb(var(--ok) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',  // new, not yet consumed by any component
      },
      borderRadius: {
        card: 'var(--radius-card)',   // 16px — cards
        ctrl: 'var(--radius-ctrl)',   // 12px — buttons, inputs, chips
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
      },
    },
  },
  plugins: [],
}
```

Note: the old bare `apple: { blue, gray, darkgray }` alias block is fully removed (Global Constraints), and the old bare `ink: 'rgb(var(--court-900) / <alpha-value>)'` single-color alias is also gone — it's superseded by the new `ink` shaded scale (`ink-900` covers the same near-black role). No code in the repo referenced bare `text-ink`/`bg-ink` before this change (verified via `grep -rnE "(text|bg|border)-ink\b" src` returning no matches), so removing it is safe.

- [ ] **Step 2: Verify the build now succeeds (index.css's `@apply` calls now resolve)**

Run: `npm run build`
Expected: exits 0. (The app itself still visually references the OLD `court-*`/`volt-*`/`apple-*` classes everywhere outside `src/index.css` — those are just plain, valid-but-wrong-looking Tailwind classes that don't error; they get renamed in Tasks 6–8. This step only proves the token *infrastructure* — `:root` vars + Tailwind config + `@apply` — is internally consistent.)

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: map ink/lime tokens into Tailwind config, drop legacy apple.* alias"
```

---

### Task 4: Extract `icon-mark.svg`, generate favicon + PWA icon PNGs

**Files:**
- Create: `src/logo/icon-mark.svg`
- Create: `pwa-assets.config.js`
- Modify: `index.html:5` (favicon `<link>` only)
- Create (generated): `public/favicon.ico`, `public/apple-touch-icon.png`, `public/pwa-192x192.png`, `public/pwa-512x512.png`

**Interfaces:**
- Consumes: `@vite-pwa/assets-generator` CLI (`pwa-assets-generator` binary, `generate-pwa-assets` npm script) from Task 1.
- Produces: the 4 icon files at the exact paths `vite.config.js`'s existing `includeAssets`/`manifest.icons` already reference (Task 5 reads/confirms these paths, no further renaming needed there).

- [ ] **Step 1: Create the standalone icon-only glyph SVG**

The padel-ball ring glyph is the final "o" of the `alinho` wordmark inside `src/logo/primary-dark-card.svg` — a self-contained ring path (`#C5DD01`) plus a white "seam" swirl path, both nearly perfectly square in their own bounding box (~27.19 × 27.19 units). Create `src/logo/icon-mark.svg`:

```svg
<svg width="512" height="512" viewBox="0 0 27.1915 27.1915" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="27.1915" height="27.1915" rx="6" fill="#040404"/>
  <path d="M23.517 13.5958 C23.517 8.1164 19.075 3.6745 13.595 3.6745 C8.116 3.6745 3.674 8.1164 3.674 13.5958 C3.674 19.0751 8.116 23.517 13.595 23.517 V27.1915 C6.087 27.1915 0 21.1045 0 13.5958 C0 6.087 6.087 0 13.595 0 C21.104 0 27.191 6.087 27.191 13.5958 C27.191 21.1045 21.104 27.1915 13.595 27.1915 V23.517 C19.075 23.517 23.517 19.0751 23.517 13.5958 Z" fill="#C5DD01"/>
  <path d="M3.911 15.7466 C5.375 15.2233 6.72 15.1111 7.973 15.3481 C9.716 15.6777 11.093 16.6464 12.227 17.6899 C12.796 18.2134 13.326 18.7778 13.82 19.3149 C14.325 19.8645 14.781 20.3718 15.247 20.8462 C16.16 21.7753 16.934 22.3765 17.715 22.6196 C16.661 23.1016 15.51 23.404 14.296 23.4887 C13.985 23.2157 13.69 22.932 13.412 22.6489 C12.906 22.1343 12.402 21.5709 11.927 21.0551 C11.442 20.5269 10.971 20.0303 10.485 19.5835 C9.51 18.6864 8.561 18.0769 7.496 17.8755 C6.765 17.7372 5.884 17.7744 4.789 18.1635 C4.397 17.4093 4.099 16.5987 3.911 15.7466 ZM9.439 4.5874 C10.878 6.8877 14.926 10.0422 22.376 8.978 C22.78 9.7452 23.086 10.5713 23.279 11.4409 C14.666 12.849 9.344 9.3088 7.26 5.9604 C7.92 5.4128 8.652 4.9511 9.439 4.5874 Z" fill="#FFFFFF"/>
</svg>
```

(This is a translation of the exact path data at `src/logo/primary-dark-card.svg` lines 8–9, shifted by `(-112.809, -6.88977)` so the glyph's own bounding box becomes `0,0` → `27.1915,27.1915`, plus a near-black rounded-square backdrop matching the "dark card" lockup the header already uses.)

- [ ] **Step 2: Create the asset-generator config**

Create `pwa-assets.config.js`:

```js
import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  images: ['src/logo/icon-mark.svg'],
  preset: {
    transparent: {
      sizes: [192, 512],
      favicons: [[48, 'favicon.ico']],
    },
    apple: {
      sizes: [180],
      padding: 0,
    },
  },
})
```

- [ ] **Step 3: Run the generator**

Run:
```bash
npm run generate-pwa-assets
```
Expected: exits 0, and prints a summary listing generated files (`pwa-192x192.png`, `pwa-512x512.png`, `favicon.ico`, an apple touch icon).

- [ ] **Step 4: Verify the exact 4 required filenames exist in `public/`, correcting the apple icon name if needed**

Run:
```bash
ls public/favicon.ico public/pwa-192x192.png public/pwa-512x512.png public/apple-touch-icon.png 2>&1
```
Expected: all 4 paths listed with no "No such file or directory" errors.

If `public/apple-touch-icon.png` is missing but `public/apple-touch-icon-180x180.png` exists instead (the generator's `apple` preset key defaults to a dimension-suffixed filename), rename it:
```bash
mv public/apple-touch-icon-180x180.png public/apple-touch-icon.png
```
Then re-run the `ls` check above and confirm all 4 paths now resolve.

- [ ] **Step 5: Point `index.html`'s favicon link at the generated `.ico` instead of the vite placeholder**

Modify `index.html` line 5, replacing:
```html
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
```
with:
```html
    <link rel="icon" href="/favicon.ico" />
```

- [ ] **Step 6: Build and manually confirm the icons load**

Run: `npm run build && npm run preview`
Then open the printed preview URL (typically `http://localhost:4173`) in a browser and check:
- the browser tab shows the new lime-ring-on-dark favicon (not the old blue "P" square)
- devtools Network tab (or View Source → open each URL directly) confirms `/favicon.ico`, `/apple-touch-icon.png`, `/pwa-192x192.png`, `/pwa-512x512.png` all return 200

Stop the preview server (Ctrl+C) when done.

- [ ] **Step 7: Commit**

```bash
git add src/logo/icon-mark.svg pwa-assets.config.js index.html public/favicon.ico public/apple-touch-icon.png public/pwa-192x192.png public/pwa-512x512.png
git commit -m "feat: generate alinho favicon and PWA icons from extracted ball-ring glyph"
```

---

### Task 5: Rename the app everywhere — `index.html` + `vite.config.js` manifest

**Files:**
- Modify: `index.html` (title, meta description, theme-color, remove Manrope `<link>`s)
- Modify: `vite.config.js:11-16` (manifest `name`/`short_name`/`description`/`theme_color`/`background_color`)

**Interfaces:**
- Consumes: nothing from earlier tasks (pure string rename).
- Produces: nothing later tasks depend on by name (naming/copy only).

- [ ] **Step 1: Replace `index.html`'s `<head>`**

Replace the entire `<head>...</head>` block with:

```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="App para gerir jogos de padel do grupo alinho" />
    <meta name="theme-color" content="#040404" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <title>alinho</title>
  </head>
```

(This removes the two Google Fonts `preconnect` links and the Manrope `<link href="https://fonts.googleapis.com/css2?family=Manrope...">` — fonts are now self-hosted per Task 2. The favicon link matches Task 4 Step 5's already-applied change; if you're doing Tasks 4 and 5 in the same session in order, this replace is idempotent.)

- [ ] **Step 2: Update the PWA manifest fields in `vite.config.js`**

Replace the `manifest` block (lines 11–16 in the original file) so the full `VitePWA(...)` call reads:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'alinho',
        short_name: 'alinho',
        description: 'App para gerir jogos de padel do grupo alinho',
        theme_color: '#040404',
        background_color: '#FFFFFF',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
})
```

- [ ] **Step 3: Confirm no old-name strings remain**

Run:
```bash
grep -nE "padel\.app|Os Padeleiros|Manrope|0B2545|F6F7F3" index.html vite.config.js
```
Expected: no output (exit code 1).

- [ ] **Step 4: Build and manually confirm the tab title/meta**

Run: `npm run build && npm run preview`
Open the preview URL and check: browser tab title reads "alinho" (not "padel.app"); View Source shows `<meta name="description" content="App para gerir jogos de padel do grupo alinho">` and `<meta name="theme-color" content="#040404">`. Stop the preview server when done.

- [ ] **Step 5: Commit**

```bash
git add index.html vite.config.js
git commit -m "feat: rename app to alinho in title, meta, and PWA manifest"
```

---

### Task 6: `Layout.jsx` — real SVG logo, token rename, icon restyle

**Files:**
- Modify: `src/components/Layout.jsx` (whole file — `Wordmark` at lines 87–96, header at lines 136–167, nav at lines 174–211, `PhoneRequiredModal` token classes throughout)

**Interfaces:**
- Consumes: `ink-*`/`lime-*`/`canvas` Tailwind classes from Task 3.
- Produces: `Wordmark({ className, variant = 'dark' | 'light' })` — a named export rendering the real `alinho` logo as inline SVG. `variant='dark'` (default) renders white wordmark letters + a lime ring with a white ball-seam swirl, for use on the near-black header. `variant='light'` renders near-black wordmark letters + a solid-lime ball icon (ring and swirl both `#C5DD01`), for use on light backgrounds. Task 8 (`Instructions.jsx`) consumes `variant="light"` — this exact prop name and these exact two values are what Task 8's edit assumes exists.

- [ ] **Step 1: Replace the `Wordmark` component (lines 87–96)**

Replace:
```jsx
/* Brand wordmark — the "." in padel.app is the ball */
export function Wordmark({ className = '' }) {
  return (
    <span className={`inline-flex items-baseline font-extrabold tracking-tight ${className}`}>
      padel
      <span className="w-[0.32em] h-[0.32em] rounded-full bg-volt-400 mx-[0.08em] self-end mb-[0.09em]" aria-hidden="true" />
      app
    </span>
  )
}
```
with:
```jsx
/* Brand wordmark — the real alinho logo, inlined (no SVGR/asset-import
   tooling in this project — Vite would otherwise only give us the file's
   URL, not a component). Path data is extracted from src/logo/*.svg:
   the four letter shapes + dot/stem (a, l, i, n) + the tall ascender (h)
   render in `textFill`; the final "o" is the ball icon — a lime ring with
   a seam swirl that's WHITE on the dark-card variant (for contrast against
   the near-black header) and solid LIME on the light-background variant
   (matching src/logo/Primary Logo (Light Background).svg exactly). */
const WORDMARK_LETTER_PATHS = [
  'M12.2178 7.90027C18.9655 7.90027 24.4355 13.2882 24.4355 19.9344C24.4355 19.9651 24.4348 19.9957 24.4346 20.0262H24.4355V32.1522H19.6582V29.4764C17.5974 31.0377 15.0186 31.9686 12.2178 31.9686C5.47011 31.9686 3.97697e-05 26.5807 0 19.9344C0 13.2882 5.47008 7.90028 12.2178 7.90027ZM12.2188 12.8553C8.24951 12.8553 5.03125 16.0249 5.03125 19.9344C5.03132 23.844 8.24955 27.0135 12.2188 27.0135C16.1879 27.0135 19.4052 23.8439 19.4053 19.9344C19.4053 16.0249 16.1879 12.8554 12.2188 12.8553Z',
  'M88.1885 11.3911V0H85.4327C84.4222 0 82.6768 0.826771 82.6768 3.39895V32.1522H87.8211V17.8215C87.8211 16.0626 90.6689 13.4121 94.8946 13.4121C99.1203 13.4121 101.968 15.9842 101.968 17.8215V32.1522H107.112V17.4541C107.112 13.9632 104.448 8.45143 96.9155 8.45143C90.8893 8.45143 88.5866 10.4724 88.1885 11.3911Z',
  'M31.5087 0H34.0809C34.0809 0 34.1727 22.0472 34.1727 24.2519C34.1727 26.4567 35.3669 27.7428 37.1123 27.7428C37.9391 27.7428 38.1228 27.7428 38.1228 27.7428V32.1522C38.1228 32.1522 39.7764 32.1522 35.2751 32.1522C30.7738 32.1522 28.9365 28.0183 28.9365 24.2519C28.9365 21.3131 28.9365 8.19484 28.9365 2.57218C28.9365 1.74541 29.5796 0 31.5087 0Z',
  'M52.9658 15.2493V31.5092H57.8346V18.0971C57.8346 16.4436 59.8556 12.9527 65.7348 12.9527C70.4382 12.9527 72.349 16.6273 72.349 18.0971V31.5092H77.1258V15.3412C77.1258 12.5853 72.6245 8.08398 66.286 8.08398C61.4172 8.08398 59.0288 9.79877 57.9264 10.6562V7.07349C52.9659 7.07349 52.9658 11.5748 52.9658 15.2493Z',
]
const WORDMARK_BALL_SWIRL_PATH = 'M116.72 22.6364C118.184 22.1131 119.529 22.0009 120.782 22.2379C122.525 22.5675 123.902 23.5362 125.036 24.5797C125.605 25.1032 126.135 25.6676 126.629 26.2047C127.134 26.7543 127.59 27.2616 128.056 27.736C128.969 28.6651 129.743 29.2663 130.524 29.5094C129.47 29.9914 128.319 30.2938 127.105 30.3785C126.794 30.1055 126.499 29.8218 126.221 29.5387C125.715 29.0241 125.211 28.4607 124.736 27.9449C124.251 27.4167 123.78 26.9201 123.294 26.4733C122.319 25.5762 121.37 24.9667 120.305 24.7653C119.574 24.627 118.693 24.6642 117.598 25.0533C117.206 24.2991 116.908 23.4885 116.72 22.6364ZM122.248 11.4772C123.687 13.7775 127.735 16.932 135.185 15.8678C135.589 16.635 135.895 17.4611 136.088 18.3307C127.475 19.7388 122.153 16.1986 120.069 12.8502C120.729 12.3026 121.461 11.8409 122.248 11.4772Z'
const WORDMARK_BALL_RING_PATH = 'M136.326 20.4856C136.326 15.0062 131.884 10.5643 126.404 10.5643C120.925 10.5643 116.483 15.0062 116.483 20.4856C116.483 25.9649 120.925 30.4068 126.404 30.4068V34.0813C118.896 34.0813 112.809 27.9943 112.809 20.4856C112.809 12.9768 118.896 6.88977 126.404 6.88977C133.913 6.88977 140 12.9768 140 20.4856C140 27.9943 133.913 34.0813 126.404 34.0813V30.4068C131.884 30.4068 136.326 25.9649 136.326 20.4856Z'

export function Wordmark({ className = '', variant = 'dark' }) {
  const textFill = variant === 'dark' ? '#FFFFFF' : '#040404'
  const swirlFill = variant === 'dark' ? '#FFFFFF' : '#C5DD01'
  return (
    <svg
      viewBox="0 0 140 35"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="alinho"
      className={`h-6 w-auto ${className}`}
    >
      {WORDMARK_LETTER_PATHS.map((d, i) => (
        <path key={i} d={d} fill={textFill} />
      ))}
      <ellipse cx="44.5529" cy="2.93963" rx="2.93962" ry="2.93963" fill={textFill} />
      <rect x="41.9824" y="8.63513" width="5.14434" height="23.517" fill={textFill} />
      <path d={WORDMARK_BALL_SWIRL_PATH} fill={swirlFill} />
      <path d={WORDMARK_BALL_RING_PATH} fill="#C5DD01" />
    </svg>
  )
}
```

- [ ] **Step 2: Simplify the header `Link` wrapping `Wordmark`**

In the `header`, replace:
```jsx
          <Link to="/" className="text-white text-xl leading-none">
            <Wordmark />
          </Link>
```
with:
```jsx
          <Link to="/" className="leading-none">
            <Wordmark />
          </Link>
```
(the SVG no longer relies on inherited `text-white`/`text-xl` — its fill colors are explicit, and its size comes from the `h-6 w-auto` in the component itself.)

- [ ] **Step 3: Fix the nav icon's ad hoc `strokeWidth`**

In the nav `.map(...)` block, replace:
```jsx
                <Icon size={21} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
```
with:
```jsx
                <Icon size={20} strokeWidth={2} className="shrink-0" />
```

- [ ] **Step 4: Mechanically rename every remaining `court-*`/`volt-*`/`-sand` class in this file**

Run:
```bash
sed -i -E \
  -e 's/\bcourt-900\b/ink-900/g' \
  -e 's/\bcourt-700\b/ink-700/g' \
  -e 's/\bcourt-600\b/ink-700/g' \
  -e 's/\bcourt-500\b/ink-500/g' \
  -e 's/\bcourt-200\b/ink-200/g' \
  -e 's/\bcourt-100\b/ink-50/g' \
  -e 's/\bcourt-50\b/ink-50/g' \
  -e 's/\bvolt-400\b/lime-400/g' \
  -e 's/\bvolt-300\b/lime-600/g' \
  -e 's/\bvolt-600\b/lime-600/g' \
  -e 's/-sand\b/-canvas/g' \
  src/components/Layout.jsx
```
Expected: exits 0, no output.

- [ ] **Step 5: Verify no stale tokens remain and the file still parses**

Run:
```bash
grep -nE "\b(court|volt)-[0-9]{2,3}\b|apple-(blue|gray|darkgray)|bg-sand\b" src/components/Layout.jsx
```
Expected: no output (exit code 1).

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 6: Manual visual check**

Run: `npm run dev`, open the printed local URL, log in (or view the login screen), and check:
- header background is near-black (`#040404`), not navy
- the `alinho` wordmark renders in white with a lime ring + white swirl on the final "o"
- the floating pill nav at the bottom has the same near-black background, active tab text/icon is lime (`#C5DD01`), inactive icons are medium-gray
- nav icons are a consistent size/weight (no more slightly-larger active-icon `strokeWidth`)

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 7: Commit**

```bash
git add src/components/Layout.jsx
git commit -m "feat: replace text Wordmark with real alinho SVG logo, rename Layout.jsx tokens"
```

---

### Task 7: `ui.jsx` — `PrimaryButton` variant rename, badges, ball-ring motif, icon restyle

**Files:**
- Modify: `src/components/ui.jsx` (whole file — header comment at lines 332–336, `PrimaryButton` at 364–386, `LevelBadge` at 388–408, `GuestBadge` at 410–426, `Avatar` at 428–440, `PlayerAvatarRow` at 442–478, `EmptyState` at 480–503, `RoundTimer` at 776–854, remaining sections mechanically renamed)

**Interfaces:**
- Consumes: `ink-*`/`lime-*`/`canvas` classes from Task 3; `#C5DD01` as the literal lime hex (matches `--lime-400`) for the two hand-drawn SVG motifs below, where a literal is simpler than a Tailwind `currentColor` chain.
- Produces: `PrimaryButton({ variant = 'lime' | 'navy' | 'ghost' | 'danger' | 'whatsapp', ... })` — default variant key is now `'lime'` (was `'volt'`). No call site in the repo passes an explicit `variant="volt"` (verified via `grep -rn "variant=[\"']volt[\"']" src`), so this rename is self-contained to `ui.jsx` and doesn't require touching any page.

- [ ] **Step 1: Rename the stale header comment**

Replace:
```jsx
/* ════════════════════════════════════════════════════════════════════════
   UI kit — Os Padeleiros
   Reusable components: PrimaryButton, LevelBadge, PlayerAvatarRow,
   EmptyState, MixCard. Design tokens live in src/index.css.
   ════════════════════════════════════════════════════════════════════════ */
```
with:
```jsx
/* ════════════════════════════════════════════════════════════════════════
   UI kit — alinho
   Reusable components: PrimaryButton, LevelBadge, PlayerAvatarRow,
   EmptyState, MixCard. Design tokens live in src/index.css.
   ════════════════════════════════════════════════════════════════════════ */
```

- [ ] **Step 2: Rename `PrimaryButton`'s default variant and class map**

Replace:
```jsx
/* ─── PrimaryButton ──────────────────────────────────────────────────────
   variant: "volt" (main CTA) | "navy" | "ghost" | "danger" */
export function PrimaryButton({ variant = 'volt', className = '', children, ...props }) {
  const variants = {
    volt:     'bg-volt-400 text-court-900 hover:bg-volt-300 shadow-card',
    navy:     'bg-court-600 text-white hover:bg-court-500 shadow-card',
    ghost:    'bg-surface text-court-900 border border-line hover:bg-court-50 hover:border-court-200',
    danger:   'bg-danger/10 text-danger hover:bg-danger/15',
    whatsapp: 'bg-[#25D366] text-white hover:bg-[#20bd5a] shadow-card',
  }
```
with:
```jsx
/* ─── PrimaryButton ──────────────────────────────────────────────────────
   variant: "lime" (main CTA) | "navy" | "ghost" | "danger" | "whatsapp" */
export function PrimaryButton({ variant = 'lime', className = '', children, ...props }) {
  const variants = {
    lime:     'bg-lime-400 text-ink-900 hover:bg-lime-600 shadow-card',
    navy:     'bg-ink-700 text-white hover:bg-ink-500 shadow-card',
    ghost:    'bg-surface text-ink-900 border border-line hover:bg-ink-50 hover:border-ink-200',
    danger:   'bg-danger/10 text-danger hover:bg-danger/15',
    whatsapp: 'bg-[#25D366] text-white hover:bg-[#20bd5a] shadow-card',
  }
```
(rest of the function body is unchanged — only the variant key/values above change.)

- [ ] **Step 3: Rename `LevelBadge`'s token classes and give it the Geist Mono label treatment**

Replace:
```jsx
export function LevelBadge({ level, range, me = false, size = 'sm' }) {
  const text = range ?? levelMeta(level).label
  const title = range ? `Níveis ${range}` : levelMeta(level).full
  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full font-extrabold tracking-wide uppercase
                  ${sizes[size]}
                  ${me ? 'bg-volt-400 text-court-900' : 'bg-court-900 text-volt-400'}`}
    >
      {text}
    </span>
  )
}
```
with:
```jsx
export function LevelBadge({ level, range, me = false, size = 'sm' }) {
  const text = range ?? levelMeta(level).label
  const title = range ? `Níveis ${range}` : levelMeta(level).full
  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full font-mono font-extrabold tracking-wide uppercase
                  ${sizes[size]}
                  ${me ? 'bg-lime-400 text-ink-900' : 'bg-ink-900 text-lime-400'}`}
    >
      {text}
    </span>
  )
}
```

- [ ] **Step 4: Rename `GuestBadge`'s token classes, same Geist Mono treatment**

Replace:
```jsx
export function GuestBadge({ size = 'sm', label = 'Convidado' }) {
  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }
  return (
    <span
      title={label === 'Teste' ? 'Jogador de teste (admin)' : 'Jogador convidado'}
      className={`inline-flex items-center rounded-full font-extrabold tracking-wide uppercase
                  border border-dashed border-court-200 bg-sand text-muted ${sizes[size]}`}
    >
      {label}
    </span>
  )
}
```
with:
```jsx
export function GuestBadge({ size = 'sm', label = 'Convidado' }) {
  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }
  return (
    <span
      title={label === 'Teste' ? 'Jogador de teste (admin)' : 'Jogador convidado'}
      className={`inline-flex items-center rounded-full font-mono font-extrabold tracking-wide uppercase
                  border border-dashed border-ink-200 bg-canvas text-muted ${sizes[size]}`}
    >
      {label}
    </span>
  )
}
```

- [ ] **Step 5: Rename `Avatar`'s default fallback color**

Replace:
```jsx
export function Avatar({ name, url, size = 'w-10 h-10 text-sm', colorClass = 'bg-court-600 text-white' }) {
```
with:
```jsx
export function Avatar({ name, url, size = 'w-10 h-10 text-sm', colorClass = 'bg-ink-700 text-white' }) {
```

- [ ] **Step 6: Give `EmptyState`'s illustration a subtle lime ball-ring accent**

Replace:
```jsx
/* ─── EmptyState ─────────────────────────────────────────────────────────
   Friendly copy + court-line motif + always one clear action. */
export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="card text-center py-12 px-6 animate-fade-up">
      <div className="relative w-24 h-24 mx-auto mb-5">
        {/* faint court-line motif */}
        <svg viewBox="0 0 96 96" className="absolute inset-0 text-court-100" fill="none">
          <rect x="8" y="14" width="80" height="68" rx="10" stroke="currentColor" strokeWidth="2.5" />
          <line x1="48" y1="14" x2="48" y2="82" stroke="currentColor" strokeWidth="2.5" />
          <line x1="8" y1="48" x2="88" y2="48" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 5" />
        </svg>
        {Icon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon size={30} className="text-court-600" />
          </div>
        )}
      </div>
      <h3 className="text-lg text-court-900 mb-1">{title}</h3>
      {subtitle && <p className="text-muted text-sm mb-6">{subtitle}</p>}
      {action}
    </div>
  )
}
```
with:
```jsx
/* ─── EmptyState ─────────────────────────────────────────────────────────
   Friendly copy + court-line motif (now with a small lime ball-ring accent,
   a nod to the logo) + always one clear action. */
export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="card text-center py-12 px-6 animate-fade-up">
      <div className="relative w-24 h-24 mx-auto mb-5">
        {/* faint court-line motif */}
        <svg viewBox="0 0 96 96" className="absolute inset-0 text-ink-50" fill="none">
          <rect x="8" y="14" width="80" height="68" rx="10" stroke="currentColor" strokeWidth="2.5" />
          <line x1="48" y1="14" x2="48" y2="82" stroke="currentColor" strokeWidth="2.5" />
          <line x1="8" y1="48" x2="88" y2="48" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 5" />
          {/* ball-ring accent, echoing the logo's lime ring glyph */}
          <circle cx="76" cy="24" r="9" stroke="#C5DD01" strokeWidth="2.5" />
        </svg>
        {Icon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon size={32} strokeWidth={2} className="text-ink-700" />
          </div>
        )}
      </div>
      <h3 className="text-lg text-ink-900 mb-1">{title}</h3>
      {subtitle && <p className="text-muted text-sm mb-6">{subtitle}</p>}
      {action}
    </div>
  )
}
```

- [ ] **Step 7: Give `RoundTimer` a lime ball-ring progress indicator, replacing the plain `Clock` icon**

Replace:
```jsx
  if (!startedAt || !durationMinutes) return null

  const totalSeconds = Math.ceil(remainingMs / 1000)
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const ss = (totalSeconds % 60).toString().padStart(2, '0')

  return (
    <div className={`inline-flex items-center gap-2 ${expired ? 'text-danger animate-pulse' : 'text-court-900'}`}>
      <Clock size={16} className="shrink-0" />
      <span className="font-extrabold tabular-nums text-sm">{mm}:{ss}</span>
      {isAdmin && onAdjust && (
        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            onClick={() => onAdjust(-5)}
            aria-label="Menos 5 minutos"
            className="w-6 h-6 flex items-center justify-center rounded-full bg-court-100 text-court-700 text-xs font-extrabold hover:bg-court-200 transition-colors duration-fast"
          >
            −5
          </button>
          <button
            type="button"
            onClick={() => onAdjust(5)}
            aria-label="Mais 5 minutos"
            className="w-6 h-6 flex items-center justify-center rounded-full bg-court-100 text-court-700 text-xs font-extrabold hover:bg-court-200 transition-colors duration-fast"
          >
            +5
          </button>
        </div>
      )}
    </div>
  )
}
```
with:
```jsx
  if (!startedAt || !durationMinutes) return null

  const totalSeconds = Math.ceil(remainingMs / 1000)
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const ss = (totalSeconds % 60).toString().padStart(2, '0')

  // Ball-ring progress indicator — a nod to the logo's lime ring glyph,
  // sweeping clockwise from full down to empty as the round counts down.
  const totalDurationMs = (durationMinutes || 0) * 60000
  const remainingFraction = totalDurationMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalDurationMs)) : 0
  const ringRadius = 8
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference * (1 - remainingFraction)

  return (
    <div className={`inline-flex items-center gap-2 ${expired ? 'text-danger animate-pulse' : 'text-ink-900'}`}>
      <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0 -rotate-90">
        <circle cx="10" cy="10" r={ringRadius} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2.5" />
        <circle
          cx="10" cy="10" r={ringRadius} fill="none"
          stroke={expired ? '#EF4444' : '#C5DD01'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringOffset}
        />
      </svg>
      <span className="font-extrabold tabular-nums text-sm">{mm}:{ss}</span>
      {isAdmin && onAdjust && (
        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            onClick={() => onAdjust(-5)}
            aria-label="Menos 5 minutos"
            className="w-6 h-6 flex items-center justify-center rounded-full bg-ink-50 text-ink-700 text-xs font-extrabold hover:bg-ink-200 transition-colors duration-fast"
          >
            −5
          </button>
          <button
            type="button"
            onClick={() => onAdjust(5)}
            aria-label="Mais 5 minutos"
            className="w-6 h-6 flex items-center justify-center rounded-full bg-ink-50 text-ink-700 text-xs font-extrabold hover:bg-ink-200 transition-colors duration-fast"
          >
            +5
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Remove the now-unused `Clock` import**

Replace:
```jsx
import { MapPin, CheckCircle2, ChevronRight, ChevronDown, ChevronLeft, Lock, Play, Calendar, X, Share2, MessageCircle, Link2, Clock } from 'lucide-react'
```
with:
```jsx
import { MapPin, CheckCircle2, ChevronRight, ChevronDown, ChevronLeft, Lock, Play, Calendar, X, Share2, MessageCircle, Link2 } from 'lucide-react'
```

- [ ] **Step 9: Mechanically rename every remaining `court-*`/`volt-*`/`-sand` class, and normalize the remaining icon sizes, in this file**

Run:
```bash
sed -i -E \
  -e 's/\bcourt-900\b/ink-900/g' \
  -e 's/\bcourt-700\b/ink-700/g' \
  -e 's/\bcourt-600\b/ink-700/g' \
  -e 's/\bcourt-500\b/ink-500/g' \
  -e 's/\bcourt-200\b/ink-200/g' \
  -e 's/\bcourt-100\b/ink-50/g' \
  -e 's/\bcourt-50\b/ink-50/g' \
  -e 's/\bvolt-400\b/lime-400/g' \
  -e 's/-sand\b/-canvas/g' \
  -e 's/size=\{17\}/size={16}/g' \
  -e 's/size=\{18\}/size={20}/g' \
  -e 's/size=\{19\}/size={20}/g' \
  -e 's/size=\{20\}/size={20}/g' \
  src/components/ui.jsx
```
Expected: exits 0, no output. (This covers `DateField`/`DateTimeField`/`MonthCalendar`/`Select`/`ShareModal`/`MixCard`, none of which have bespoke rewrites above — every token class in those sections is a plain rename.)

- [ ] **Step 10: Verify no stale tokens remain**

Run:
```bash
grep -nE "\b(court|volt)-[0-9]{2,3}\b|apple-(blue|gray|darkgray)|bg-sand\b|Os Padeleiros" src/components/ui.jsx
```
Expected: no output (exit code 1).

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 11: Manual visual check**

Run: `npm run dev`, navigate to Home (mix list), open a mix's `GameDetails` page, and check:
- primary CTA buttons are lime (`#C5DD01`) with near-black text, hover state goes to a darker olive-lime, not a lighter one
- level badges are pill-shaped, monospace uppercase text, near-black background with lime text (or lime background with near-black text for "me")
- an "EmptyState" screen (e.g. Rankings with no data, or Home with no upcoming mixes) shows the small lime ring accent in the illustration's corner
- if a mix is in progress, `RoundTimer`'s clock now shows a small circular lime progress ring instead of a clock icon, sweeping down as time passes

Stop the dev server when done.

- [ ] **Step 12: Commit**

```bash
git add src/components/ui.jsx
git commit -m "feat: rename PrimaryButton variant to lime, add ball-ring motif to EmptyState/RoundTimer, rename ui.jsx tokens"
```

---

### Task 8: Batch token-class rename across the remaining 9 files

**Files:**
- Modify: `src/App.jsx`, `src/pages/Admin.jsx`, `src/pages/GameDetails.jsx`, `src/pages/Home.jsx`, `src/pages/Instructions.jsx`, `src/pages/Login.jsx`, `src/pages/PlayerDetails.jsx`, `src/pages/Profile.jsx`, `src/pages/Rankings.jsx`

**Interfaces:**
- Consumes: `ink-*`/`lime-*`/`canvas` classes (Task 3); `Wordmark({ variant })` (Task 6) — `Instructions.jsx` is updated in this task to pass `variant="light"`.
- Produces: nothing later tasks depend on.

`src/App.jsx` is not in the design spec's explicit file-touch list, but it uses the `apple-gray`/`apple-blue` legacy alias classes 6 times (loading-spinner screens) — dropping the `apple.*` Tailwind alias in Task 3 means these classes now resolve to nothing, so `App.jsx` must be included here or the loading screens silently lose their background/spinner color. Verified via `grep -rn "apple-" src --include="*.jsx"`.

- [ ] **Step 1: Run the mechanical token-class rename, `-sand`→`-canvas` rename, icon-size normalization, and lucide `strokeWidth` fix across all 9 files**

Run:
```bash
for f in src/App.jsx src/pages/Admin.jsx src/pages/GameDetails.jsx src/pages/Home.jsx src/pages/Instructions.jsx src/pages/Login.jsx src/pages/PlayerDetails.jsx src/pages/Profile.jsx src/pages/Rankings.jsx; do
  sed -i -E \
    -e 's/\bcourt-900\b/ink-900/g' \
    -e 's/\bcourt-700\b/ink-700/g' \
    -e 's/\bcourt-600\b/ink-700/g' \
    -e 's/\bcourt-500\b/ink-500/g' \
    -e 's/\bcourt-200\b/ink-200/g' \
    -e 's/\bcourt-100\b/ink-50/g' \
    -e 's/\bcourt-50\b/ink-50/g' \
    -e 's/\bvolt-400\b/lime-400/g' \
    -e 's/\bvolt-500\b/lime-600/g' \
    -e 's/\bapple-blue\b/ink-700/g' \
    -e 's/\bapple-gray\b/canvas/g' \
    -e 's/\bapple-darkgray\b/ink-900/g' \
    -e 's/-sand\b/-canvas/g' \
    -e 's/size=\{13\}/size={14}/g' \
    -e 's/size=\{15\}/size={16}/g' \
    -e 's/size=\{17\}/size={16}/g' \
    -e 's/size=\{18\}/size={20}/g' \
    -e 's/size=\{19\}/size={20}/g' \
    -e 's/size=\{21\}/size={20}/g' \
    -e 's/size=\{30\}/size={32}/g' \
    -e 's/size=\{34\}/size={32}/g' \
    -e 's/strokeWidth=\{3\}/strokeWidth={2}/g' \
    "$f"
done
```
Expected: exits 0, no output.

- [ ] **Step 2: Fix `Instructions.jsx`'s `Wordmark` call site to use the light-background variant**

Run:
```bash
sed -i 's|Como usar a <Wordmark />|Como usar a <Wordmark variant="light" className="h-8 inline-block align-middle" />|' src/pages/Instructions.jsx
```
Expected: exits 0, no output. (Without this, `Instructions.jsx`'s white-filled `Wordmark` — the default `variant="dark"` — would render invisible white-on-white text, since this page has a white header, unlike the app's near-black main header.)

- [ ] **Step 3: Verify no stale tokens remain in any of the 9 files**

Run:
```bash
grep -rnE "\b(court|volt)-[0-9]{2,3}\b|apple-(blue|gray|darkgray)|bg-sand\b" src/App.jsx src/pages/Admin.jsx src/pages/GameDetails.jsx src/pages/Home.jsx src/pages/Instructions.jsx src/pages/Login.jsx src/pages/PlayerDetails.jsx src/pages/Profile.jsx src/pages/Rankings.jsx
```
Expected: no output (exit code 1).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Manual visual walk of all 8 pages**

Run: `npm run dev`, open the printed local URL, and for each of the 8 routes check that headings/body text read near-black/dark-gray (not navy-blue), cards are recessed light-gray on a white page background (not white cards on off-white), and any lime accents (CTA buttons, "joined" indicators, confirmed badges) show `#C5DD01`/darker-on-hover, not the old yellow-green:
- `/` — Home (mix list)
- `/jogo/:id` — GameDetails (open any mix from the list)
- `/rankings` — Rankings
- `/jogador/:id` — PlayerDetails (open any player from Rankings)
- `/perfil` — Profile
- `/admin` — Admin (requires an admin account)
- `/instrucoes` — Instructions — specifically confirm the `alinho` logo inside "Como usar a **alinho**" is now visible (near-black letters, solid-lime ball), not blank/invisible
- `/login` — Login

Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/pages/Admin.jsx src/pages/GameDetails.jsx src/pages/Home.jsx src/pages/Instructions.jsx src/pages/Login.jsx src/pages/PlayerDetails.jsx src/pages/Profile.jsx src/pages/Rankings.jsx
git commit -m "feat: rename ink/lime tokens and restyle icons across all pages and App.jsx"
```

---

### Task 9: Remove stale placeholder files

**Files:**
- Delete: `public/ICONS_README.md`
- Delete: `public/vite.svg`

**Interfaces:**
- Consumes: nothing (Task 4 already made the real icon files these placeholders described obsolete).
- Produces: nothing.

- [ ] **Step 1: Confirm nothing still references these files**

Run:
```bash
grep -rln "vite.svg" . --include="*.jsx" --include="*.html" --include="*.js" --include="*.json" | grep -v node_modules
```
Expected: no output (exit code 1) — Task 4/5 already repointed `index.html`'s favicon `<link>` away from `/vite.svg`.

- [ ] **Step 2: Delete the files**

```bash
rm public/ICONS_README.md public/vite.svg
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add -u public/ICONS_README.md public/vite.svg
git commit -m "chore: remove stale placeholder icon README and vite.svg"
```

---

### Task 10: Final whole-app verification

**Files:**
- None (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1–9.
- Produces: nothing (this is the plan's final gate).

- [ ] **Step 1: Full grep sweep across `src/` for any stale token classes**

Run:
```bash
grep -rnE "\b(court|volt)-[0-9]{2,3}\b|apple-(blue|gray|darkgray)|bg-sand\b|--court|--volt|Manrope|padel\.app|Os Padeleiros" src/
```
Expected: no output (exit code 1). (Two known, intentionally-untouched false-positive-adjacent comment strings — `"court-line motif"` in `src/components/ui.jsx` and `"completed court-1 match"` in `src/pages/GameDetails.jsx` — do NOT match this pattern, since neither is a real Tailwind class: `court-line` isn't `court-` followed by 2–3 digits, and `court-1` here is followed by a space, not more digits.)

- [ ] **Step 2: Full production build**

Run: `npm run build`
Expected: exits 0, `dist/` produced with no warnings about missing Tailwind classes or unresolved imports.

- [ ] **Step 3: Confirm every generated icon asset is present**

Run:
```bash
ls -la public/favicon.ico public/apple-touch-icon.png public/pwa-192x192.png public/pwa-512x512.png
```
Expected: all 4 files listed, none missing.

- [ ] **Step 4: Manual page-by-page walk (final pass)**

Run: `npm run dev` and walk every page one more time end-to-end, confirming the full rebrand is visually consistent:
- `/login` — page background is white (`canvas`), the "court-outline" decorative illustration reads in light-gray/ink tones, primary CTA is lime
- `/` (Home) — header/nav are near-black with the real `alinho` SVG logo and lime active-tab accents; mix cards are light-gray with hairline borders (not white-on-off-white); "joined" accent bar and "Inscrito"/"A decorrer" pills are lime
- `/jogo/:id` (GameDetails) — round timer (if a mix is live) shows the lime ring sweep instead of a clock icon; winner trophy/Check icons are lime/ink, not blue
- `/rankings` — trophy icons are lime, level badges are monospace uppercase pills
- `/jogador/:id` (PlayerDetails) — stat icons/cards use ink/lime, no blue
- `/perfil` (Profile) — same; if the "add phone number" nudge modal appears, its icon circle and CTA are lime, its backdrop is near-black at 70% opacity
- `/admin` — admin-only badges/buttons follow the same palette
- `/instrucoes` — the `alinho` logo renders visibly (near-black text, solid-lime ball) inside the "Como usar a alinho" heading; step-number circles and icons no longer reference the removed `apple-blue`/`apple-darkgray` classes visually (should read as `ink-700`/`ink-900` now)
- confirm the favicon in the browser tab and (if testing on a phone or via responsive devtools) the "Add to Home Screen" icon both show the lime-ring mark on a near-black square, not the old blue "P"

Stop the dev server when done.

- [ ] **Step 5: Commit (if Step 4 surfaced any small fixes)**

If the manual walk found nothing to fix, this task needs no commit — Tasks 1–9 already captured every change. If it did surface something, fix it, re-run Steps 1–2, then:
```bash
git add -A
git commit -m "fix: address visual issues found in final alinho rebrand verification pass"
```

### Critical Files for Implementation
- C:\Users\Renato Cruz\padeleirosrobot\.claude\worktrees\alinho-rebrand\src\index.css
- C:\Users\Renato Cruz\padeleirosrobot\.claude\worktrees\alinho-rebrand\tailwind.config.js
- C:\Users\Renato Cruz\padeleirosrobot\.claude\worktrees\alinho-rebrand\src\components\Layout.jsx
- C:\Users\Renato Cruz\padeleirosrobot\.claude\worktrees\alinho-rebrand\src\components\ui.jsx
- C:\Users\Renato Cruz\padeleirosrobot\.claude\worktrees\alinho-rebrand\vite.config.js