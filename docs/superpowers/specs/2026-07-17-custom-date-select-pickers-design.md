# Custom Date Picker + Select — Design

## Context

`DateField`/`DateTimeField` (`src/components/ui.jsx`) work by stacking a fully transparent native `<input type="date"/"datetime-local">` on top of a styled fake display box — the native input holds the value and opens the OS picker, the box underneath just shows a nicely pt-PT-formatted value. On iOS Safari this works great (native input taps open a polished full picker immediately). On desktop Chrome/Edge/Firefox it doesn't: a native date input only opens its picker when the click lands on the browser's own tiny built-in calendar-icon hotspot, not anywhere else in the field — so admins using the web app on a laptop have to click precisely, sometimes needing a second click, to get the picker to appear. Native `<select>` elements have the reverse problem: interaction is fine everywhere, but the open dropdown renders in the browser's own unstyled default look (plain white list, system font, no rounding) with no reliable cross-browser way to restyle it, clashing with the rest of the app's design.

Both are replaced with fully custom, self-built components — no new npm dependency, matching this app's existing pattern of hand-rolling small pieces of UI (e.g. Canvas-based image compression instead of a library) rather than reaching for a package.

## Shared interaction pattern: bottom-sheet, not an anchored popover

Rather than building anchor/collision-detection logic (measuring the trigger's position, flipping above/below near viewport edges, etc.), both new components reuse the bottom-sheet modal pattern already established in this codebase by `ShareModal` (`src/components/ui.jsx`): `fixed inset-0` dimmed backdrop, `flex items-end sm:items-center` (slides up from the bottom on phones, centers as a card on desktop), rendered via `createPortal(..., document.body)`.

The portal is non-negotiable here, not just a nice-to-have: earlier this session, a modal rendered as a normal child (inside `<main>`, which carries a permanent `transform` from its own mount animation) silently stopped behaving as a fullscreen overlay on iOS Safari, because an ancestor with any `transform` becomes the containing block for descendant `position: fixed` elements. Both new components portal to `document.body` from the first line of code, so that bug class can't recur here.

## `Select`

Replaces all 8 current native `<select>` usages (`Login.jsx` signup gender, `Profile.jsx` gender/level/preferred-side, `Rankings.jsx` month filter, `GameDetails.jsx` partner picker) with one shared component:

```
Select({ value, onChange, options, placeholder, className })
```

`options` is `[{ value, label }]` — every current call site's options (static lists like gender, or dynamic ones like the partner picker or month filter) collapse to this same shape. The trigger is styled like `.input-field` with a chevron icon; tapping it opens the bottom sheet listing every option as a row (the current selection highlighted), tapping a row selects it and closes the sheet, tapping the backdrop closes without changing anything.

**Known, accepted trade-off:** native `<select>` lets a desktop user type a letter to jump to a matching option; a custom listbox doesn't get that for free. Not replicated in this pass — none of the 8 lists are long enough (max ~12 items, the month filter) for this to matter much.

**One behavioral gap to close during the swap:** `Login.jsx`'s signup gender select currently uses the native `required` attribute to block submission when empty — a custom `Select` isn't a real form control, so that stops working for free. The signup submit handler needs an explicit `if (!signupGender) { ...error...; return }` check added as part of that one call site's swap (not a new component feature).

## Date picker

`DateField`/`DateTimeField` keep their exact existing external API (`value`, `onChange`, `required`, `min`, `max`, `placeholder`) — every caller (`Login.jsx` birthday, `Profile.jsx` birthday, `Admin.jsx` game date+time) needs zero changes. Only what's *inside* changes: the trigger box (unchanged look) now opens the same bottom-sheet pattern instead of relying on a hidden native input.

Both share a `MonthCalendar` building block — a 7-column month grid with Portuguese single-letter weekday headers and prev/next month navigation, respecting `min`/`max` by disabling out-of-range days.

- **`DateField`** (date-only, e.g. birthday): sheet shows `MonthCalendar` alone. Tapping a day selects it and closes immediately — no separate confirm step, matching how a plain date picker is normally used.
- **`DateTimeField`** (date + time, e.g. a mix's start): sheet shows `MonthCalendar` plus a native `<input type="time">` row below it, and a "Confirmar" button that combines both into the final value and closes. The time portion deliberately stays a native input rather than a custom time-wheel: unlike `date`/`datetime-local`, a native `type="time"` input doesn't have the desktop click-precision problem (its segments are directly clickable/typeable everywhere), so building a custom replacement here would be effort spent on something that isn't actually broken.

## Files touched

- `src/components/ui.jsx` — new `Select` component; new internal `MonthCalendar`; `DateField`/`DateTimeField` rebuilt internally (same external props).
- `src/pages/Login.jsx` — swap the gender `<select>` for `<Select>`; add the explicit empty-gender validation check in `handleSignup`.
- `src/pages/Profile.jsx` — swap gender/level/preferred-side `<select>`s for `<Select>`.
- `src/pages/Rankings.jsx` — swap the month filter `<select>` for `<Select>`.
- `src/pages/GameDetails.jsx` — swap the partner-picker `<select>` for `<Select>`.
