# Custom Date Picker + Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's native `<select>` dropdowns and native `<input type="date"/"datetime-local">` date pickers with fully custom, self-built components, fixing a real desktop-browser interaction bug (date inputs needing a precise click to open) and an unstyled-dropdown look, without adding any new dependency.

**Architecture:** Both new components reuse the bottom-sheet modal pattern already established by `ShareModal` in this codebase (`fixed inset-0` dimmed backdrop, slides up from the bottom on phones / centers as a card on desktop, rendered via `createPortal(..., document.body)`). `DateField`/`DateTimeField` keep their exact existing external props (`value`, `onChange`, `required`, `min`, `max`, `placeholder`) — no caller needs to change how it uses them, only their internals change. `Select` is a new component with its own small API (`value`, `onChange`, `options`, `placeholder`), and gets wired into the 8 places that currently use a native `<select>`.

**Tech Stack:** React (Vite), Tailwind. No new npm dependency — plain React state + native `<input type="time">` (kept as-is, it isn't broken) + Canvas-free hand-built calendar grid.

## Global Constraints

- No JS test framework exists in this repo — verification is `npx vite build` (compile-time correctness) plus manual click-through in the browser, matching every other feature in this codebase.
- Portuguese user-facing copy throughout, matching the rest of the app.
- No new npm dependency.
- Every new floating panel (`Select`'s option sheet, `DateField`/`DateTimeField`'s calendar sheet) MUST be rendered via `createPortal(..., document.body)` from the moment it's written — never as a normal nested child. An ancestor with any CSS `transform` (even a completed one, e.g. this app's own `animate-fade-up` mount animation on `<main>`) becomes the containing block for a descendant `position: fixed` element on iOS Safari, silently turning a fullscreen modal into inline page content. This exact bug already happened once this session in `ShareModal` before it was portal'd — do not reintroduce it here.
- `DateField`/`DateTimeField`'s props stay exactly: `{ value, onChange, required, max, min, placeholder }` (`DateTimeField` has no `min`/`max`, matching its current signature) — no call site (`Login.jsx`, `Profile.jsx`, `Admin.jsx`) should need to change how it invokes these components.
- Removing `required` from a real `<input>` means the browser no longer blocks form submission on an empty value — every place that relied on that (found during planning, not just the one the design doc called out) needs an explicit JS check added in its own submit handler: `Login.jsx`'s signup gender (`Select`) AND signup birthday (`DateField`) both currently rely solely on the native `required` attribute with no other check in `handleSignup`; `Admin.jsx`'s game date (`DateTimeField`) likewise relies solely on `required` with no check in `handleCreateGame`/`handleUpdateGame`. All three get a check in this plan.

---

## Task 1: `Select` component

**Files:**
- Modify: `src/components/ui.jsx`

**Interfaces:**
- Produces: `Select({ value, onChange, options, placeholder, className })` — `options` is `[{ value, label }]`. Renders a trigger box styled like `.input-field` with a chevron, and (when tapped) a portal'd bottom sheet listing every option; tapping a row calls `onChange(option.value)` and closes the sheet. Task 2 wires this into 8 existing call sites.

- [ ] **Step 1: Add the `ChevronDown` icon to the existing lucide-react import**

Find (top of the file):

```jsx
import { MapPin, CheckCircle2, ChevronRight, Lock, Play, Calendar, X, Share2, MessageCircle, Link2, Clock } from 'lucide-react'
```

Replace with:

```jsx
import { MapPin, CheckCircle2, ChevronRight, ChevronDown, Lock, Play, Calendar, X, Share2, MessageCircle, Link2, Clock } from 'lucide-react'
```

- [ ] **Step 2: Add the `Select` component**

Append this to the end of `src/components/ui.jsx` (after the closing `}` of `RoundTimer`, the last thing in the file):

```jsx

/* ─── Select ─────────────────────────────────────────────────────────────
   Replaces native <select> everywhere in the app: interaction is fine on
   every browser, but an open native dropdown renders in the browser's own
   unstyled default look with no reliable cross-browser way to restyle it.
   `options` is [{ value, label }]. Trades away one thing a native <select>
   gets for free — typing a letter to jump to a matching option — but none
   of this app's option lists are long enough for that to matter. */
export function Select({ value, onChange, options, placeholder = 'Seleciona…', className = '' }) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`input-field flex items-center justify-between text-left ${selected ? 'text-court-900' : 'text-muted'} ${className}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={18} className="text-court-600 shrink-0 ml-2" />
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-court-900/50 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface rounded-t-card sm:rounded-card shadow-lift w-full sm:max-w-md max-h-[70vh] overflow-y-auto animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-lg text-court-900">{placeholder}</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:bg-court-50 hover:text-court-900 transition-colors duration-fast"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-2 pb-5">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`w-full text-left px-3.5 py-3 rounded-ctrl text-base font-extrabold transition-colors duration-fast ${
                    o.value === value ? 'bg-volt-400/20 text-court-900' : 'text-court-900 hover:bg-court-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors (this only proves the file is syntactically valid — `Select` has no caller yet, so there's nothing to click through until Task 2).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui.jsx
git commit -m "Add custom Select component"
```

---

## Task 2: Wire `Select` into the 8 native `<select>` call sites

**Files:**
- Modify: `src/pages/Login.jsx`
- Modify: `src/pages/Profile.jsx`
- Modify: `src/pages/Rankings.jsx`
- Modify: `src/pages/GameDetails.jsx`

**Interfaces:**
- Consumes: `Select` from `../components/ui` (Task 1), exact signature `Select({ value, onChange, options, placeholder, className })`.

- [ ] **Step 1: `Login.jsx` — import `Select`**

Find:

```jsx
import { PrimaryButton, DateField } from '../components/ui'
```

Replace with:

```jsx
import { PrimaryButton, DateField, Select } from '../components/ui'
```

- [ ] **Step 2: `Login.jsx` — swap the signup gender `<select>`**

Find:

```jsx
                <select
                  value={signupGender}
                  onChange={(e) => setSignupGender(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Seleciona…</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                </select>
```

Replace with:

```jsx
                <Select
                  value={signupGender}
                  onChange={setSignupGender}
                  placeholder="Seleciona…"
                  options={[
                    { value: 'masculino', label: 'Masculino' },
                    { value: 'feminino', label: 'Feminino' },
                  ]}
                />
```

- [ ] **Step 3: `Login.jsx` — add the validation checks `required` used to provide**

Find (inside `handleSignup`, the first validation check):

```jsx
    // Validate password match
    if (signupPassword !== signupConfirmPassword) {
      setError('As passwords não coincidem')
      setLoading(false)
      return
    }
```

Replace with:

```jsx
    // Birthday and gender used to be enforced by the native inputs'
    // `required` attribute — DateField/Select are custom components now,
    // so the checks have to happen here instead.
    if (!signupBirthday) {
      setError('Introduz a tua data de nascimento')
      setLoading(false)
      return
    }

    if (!signupGender) {
      setError('Seleciona o teu género')
      setLoading(false)
      return
    }

    // Validate password match
    if (signupPassword !== signupConfirmPassword) {
      setError('As passwords não coincidem')
      setLoading(false)
      return
    }
```

- [ ] **Step 4: `Profile.jsx` — import `Select`**

Find:

```jsx
import { PrimaryButton, LevelBadge, GuestBadge, DateField, Avatar } from '../components/ui'
```

Replace with:

```jsx
import { PrimaryButton, LevelBadge, GuestBadge, DateField, Avatar, Select } from '../components/ui'
```

- [ ] **Step 5: `Profile.jsx` — swap the gender `<select>`**

Find:

```jsx
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="input-field"
              >
                <option value="">Não especificado</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
```

Replace with:

```jsx
              <Select
                value={gender}
                onChange={setGender}
                placeholder="Não especificado"
                options={[
                  { value: 'masculino', label: 'Masculino' },
                  { value: 'feminino', label: 'Feminino' },
                ]}
              />
```

- [ ] **Step 6: `Profile.jsx` — swap the level `<select>`**

Find:

```jsx
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="input-field"
              >
                <option value="iniciante">Iniciante</option>
                <option value="intermédio">Intermédio</option>
                <option value="avançado">Avançado</option>
                <option value="N2">N2</option>
                <option value="N3">N3</option>
                <option value="N4">N4</option>
                <option value="N5">N5</option>
                <option value="N6">N6</option>
              </select>
```

Replace with:

```jsx
              <Select
                value={level}
                onChange={setLevel}
                options={[
                  { value: 'iniciante', label: 'Iniciante' },
                  { value: 'intermédio', label: 'Intermédio' },
                  { value: 'avançado', label: 'Avançado' },
                  { value: 'N2', label: 'N2' },
                  { value: 'N3', label: 'N3' },
                  { value: 'N4', label: 'N4' },
                  { value: 'N5', label: 'N5' },
                  { value: 'N6', label: 'N6' },
                ]}
              />
```

- [ ] **Step 7: `Profile.jsx` — swap the preferred-side `<select>`**

Find:

```jsx
              <select
                value={preferredSide}
                onChange={(e) => setPreferredSide(e.target.value)}
                className="input-field"
              >
                <option value="left">Esquerda</option>
                <option value="right">Direita</option>
                <option value="both">Ambos</option>
              </select>
```

Replace with:

```jsx
              <Select
                value={preferredSide}
                onChange={setPreferredSide}
                options={[
                  { value: 'left', label: 'Esquerda' },
                  { value: 'right', label: 'Direita' },
                  { value: 'both', label: 'Ambos' },
                ]}
              />
```

- [ ] **Step 8: `Rankings.jsx` — import `Select`**

Find:

```jsx
import { LevelBadge, EmptyState, MixCard, Avatar } from '../components/ui'
```

Replace with:

```jsx
import { LevelBadge, EmptyState, MixCard, Avatar, Select } from '../components/ui'
```

- [ ] **Step 9: `Rankings.jsx` — swap the month-filter `<select>`**

Find:

```jsx
              <select
                value={selectedMonth || ''}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input-field capitalize"
              >
                {monthly.months.map(m => (
                  <option key={m.key} value={m.key} className="capitalize">{m.label}</option>
                ))}
              </select>
```

Replace with:

```jsx
              <Select
                value={selectedMonth || ''}
                onChange={setSelectedMonth}
                className="capitalize"
                options={monthly.months.map(m => ({ value: m.key, label: m.label }))}
              />
```

- [ ] **Step 10: `GameDetails.jsx` — import `Select`**

Find:

```jsx
import { PrimaryButton, LevelBadge, GuestBadge, PlayerAvatarRow, EmptyState, ShareModal, RoundTimer, Avatar } from '../components/ui'
```

Replace with:

```jsx
import { PrimaryButton, LevelBadge, GuestBadge, PlayerAvatarRow, EmptyState, ShareModal, RoundTimer, Avatar, Select } from '../components/ui'
```

- [ ] **Step 11: `GameDetails.jsx` — swap the partner-picker `<select>`**

Find:

```jsx
                <select
                  value={selectedPartner}
                  onChange={(e) => setSelectedPartner(e.target.value)}
                  className="input-field"
                >
                  <option value="">Seleciona um jogador</option>
                  {allUsers
                    .filter(u => !people.some(p => p.id === u.id))
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
```

Replace with:

```jsx
                <Select
                  value={selectedPartner}
                  onChange={setSelectedPartner}
                  placeholder="Seleciona um jogador"
                  options={allUsers
                    .filter(u => !people.some(p => p.id === u.id))
                    .map(u => ({ value: u.id, label: u.name }))}
                />
```

- [ ] **Step 12: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors.

- [ ] **Step 13: Manual verification in the browser**

Run `npm run dev`:
1. Signup form (Login.jsx) → tap Género → confirm the bottom sheet opens with Masculino/Feminino, selecting one closes it and shows the choice. Try submitting the form with birthday or gender left empty → confirm you now get an inline Portuguese error message (not a silent no-op or a raw DB error).
2. Profile → Editar → tap Género, Nível de jogo, and Lado preferido → confirm each opens the sheet, shows the current value highlighted, and updates on selection.
3. Rankings → Mensal tab → tap the month filter → confirm it lists every month and switches correctly.
4. Open a mix, tap "Entrar com parceiro" → tap the partner picker → confirm it lists eligible players and excludes anyone already in the mix.
5. On all of the above, confirm the sheet looks like the rest of the app (rounded corners, our fonts/colors) — not a plain browser dropdown.

- [ ] **Step 14: Commit**

```bash
git add src/pages/Login.jsx src/pages/Profile.jsx src/pages/Rankings.jsx src/pages/GameDetails.jsx
git commit -m "Wire custom Select into all 8 dropdowns"
```

---

## Task 3: `MonthCalendar` + rebuilt `DateField`

**Files:**
- Modify: `src/components/ui.jsx`
- Modify: `src/pages/Login.jsx`

**Interfaces:**
- Produces: an internal (not exported) `MonthCalendar({ selected, viewDate, onNavigate, onSelectDay, min, max })` — `selected` is a `Date` or `null`; `viewDate` is a `Date` representing the 1st of the currently-displayed month; `onNavigate(deltaMonths)` and `onSelectDay(dayOfMonth)` are callbacks. Task 4 reuses this exact component for `DateTimeField`.
- Modifies: `DateField` keeps its existing external signature `{ value, onChange, required, max, min, placeholder }` — no caller changes needed for it. `value`/`onChange` still deal in `'YYYY-MM-DD'` strings, same as before.

- [ ] **Step 1: Add the `ChevronLeft` icon to the lucide-react import**

Find:

```jsx
import { MapPin, CheckCircle2, ChevronRight, ChevronDown, Lock, Play, Calendar, X, Share2, MessageCircle, Link2, Clock } from 'lucide-react'
```

Replace with:

```jsx
import { MapPin, CheckCircle2, ChevronRight, ChevronDown, ChevronLeft, Lock, Play, Calendar, X, Share2, MessageCircle, Link2, Clock } from 'lucide-react'
```

- [ ] **Step 2: Replace `DateField` with the `MonthCalendar` helper + the rebuilt `DateField`**

Find the entire current `DateField` (including the file's opening comment block above it):

```jsx
/* ─── Date fields ────────────────────────────────────────────────────────
   Native <input type=date/datetime-local> pickers render in the device
   locale (English months on many phones) and look inconsistent. These wrap
   the native picker in a styled, always-Portuguese display: the visible box
   shows a pt-PT formatted value; a transparent native input on top opens the
   OS picker and holds the value. Best of both — native UX, our formatting. */

export function DateField({ value, onChange, required, max, min, placeholder = 'Seleciona a data' }) {
  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
    : placeholder
  return (
    <div className="relative">
      <div className={`input-field flex items-center justify-between ${value ? 'text-court-900' : 'text-muted'}`}>
        <span className="truncate">{display}</span>
        <Calendar size={18} className="text-court-600 shrink-0 ml-2" />
      </div>
      <input
        type="date"
        value={value || ''}
        max={max}
        min={min}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Data"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  )
}
```

Replace with:

```jsx
/* ─── Date fields ────────────────────────────────────────────────────────
   Native <input type=date/datetime-local> pickers open reliably on iOS
   Safari (any tap opens the full OS picker) but not on desktop Chrome/
   Edge/Firefox, where only a click on the browser's own tiny built-in
   calendar icon opens anything. Both fields below are fully custom instead
   — a styled trigger box (unchanged look) opens our own portal'd bottom
   sheet with a month-grid calendar, so behavior is identical everywhere. */

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function toIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* Month grid used by both DateField and DateTimeField's picker sheet.
   `selected`/`min`/`max` are Date objects or null; `viewDate` is the 1st
   of the month currently on screen (navigation doesn't move `selected`
   until a day is actually tapped). */
function MonthCalendar({ selected, viewDate, onNavigate, onSelectDay, min, max }) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = viewDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => onNavigate(-1)}
          aria-label="Mês anterior"
          className="w-9 h-9 flex items-center justify-center rounded-full text-court-600 hover:bg-court-50 transition-colors duration-fast"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="font-extrabold text-court-900 capitalize">{monthLabel}</span>
        <button
          type="button"
          onClick={() => onNavigate(1)}
          aria-label="Mês seguinte"
          className="w-9 h-9 flex items-center justify-center rounded-full text-court-600 hover:bg-court-50 transition-colors duration-fast"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="text-center text-[11px] font-extrabold uppercase text-muted py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />
          const cellDate = new Date(year, month, d)
          const isSelected = !!selected
            && selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === d
          const disabled = (min && cellDate < min) || (max && cellDate > max)
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDay(d)}
              className={`h-10 rounded-ctrl text-sm font-extrabold transition-colors duration-fast ${
                isSelected ? 'bg-volt-400 text-court-900'
                : disabled ? 'text-muted/40 cursor-not-allowed'
                : 'text-court-900 hover:bg-court-50'
              }`}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateField({ value, onChange, max, min, placeholder = 'Seleciona a data' }) {
  const [open, setOpen] = useState(false)
  const selectedDate = value ? new Date(value + 'T00:00:00') : null
  const minDate = min ? new Date(min + 'T00:00:00') : null
  const maxDate = max ? new Date(max + 'T00:00:00') : null
  const [viewDate, setViewDate] = useState(selectedDate || new Date())

  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
    : placeholder

  const openPicker = () => {
    setViewDate(selectedDate || new Date())
    setOpen(true)
  }

  const navigate = (delta) => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  const selectDay = (day) => {
    onChange(toIsoDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day)))
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        className={`input-field flex items-center justify-between text-left ${value ? 'text-court-900' : 'text-muted'}`}
      >
        <span className="truncate">{display}</span>
        <Calendar size={18} className="text-court-600 shrink-0 ml-2" />
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-court-900/50 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface rounded-t-card sm:rounded-card shadow-lift w-full sm:max-w-md p-5 animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-court-900">{placeholder}</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:bg-court-50 hover:text-court-900 transition-colors duration-fast"
              >
                <X size={18} />
              </button>
            </div>
            <MonthCalendar
              selected={selectedDate}
              viewDate={viewDate}
              onNavigate={navigate}
              onSelectDay={selectDay}
              min={minDate}
              max={maxDate}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
```

Note: `required` is dropped from `DateField`'s props here — it was never anything but a pass-through to the now-removed native `<input>`, and no caller can rely on it doing anything post-change. Step 3 below adds the one real check this drops (`Login.jsx`'s signup birthday).

- [ ] **Step 3: `Login.jsx` — add the birthday-required check**

This targets the exact same validation block Task 2 Step 3 already added to (in a fresh checkout of just this task, the block looks like the "Find" text below — if Task 2 already ran, this text has already changed and this step is a no-op, skip it).

Find:

```jsx
    // Validate password match
    if (signupPassword !== signupConfirmPassword) {
      setError('As passwords não coincidem')
      setLoading(false)
      return
    }
```

Replace with:

```jsx
    // Birthday used to be enforced by DateField's underlying native input's
    // `required` attribute — it's a fully custom component now, no native
    // form validation happens for it automatically.
    if (!signupBirthday) {
      setError('Introduz a tua data de nascimento')
      setLoading(false)
      return
    }

    // Validate password match
    if (signupPassword !== signupConfirmPassword) {
      setError('As passwords não coincidem')
      setLoading(false)
      return
    }
```

- [ ] **Step 4: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors.

- [ ] **Step 5: Manual verification in the browser**

Run `npm run dev`:
1. Profile → Editar → tap "Data de nascimento" → confirm a bottom sheet opens immediately (single tap, no precise-click needed, works the same on desktop and mobile), shows the correct month with today's date's neighborhood, and lets you navigate months and pick a day — the sheet closes immediately on picking a day.
2. Confirm the max-date constraint still works: try navigating to a future month and confirm future days are visibly disabled (greyed out, not clickable) — `Profile.jsx`'s birthday field passes `max={today}`.
3. Signup form → leave birthday empty, fill everything else, submit → confirm you get the new inline Portuguese error instead of the browser silently doing nothing or the form partially submitting.
4. Signup form → pick a birthday → confirm it displays correctly and the account creates successfully.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui.jsx src/pages/Login.jsx
git commit -m "Replace DateField's native input with a custom calendar picker"
```

---

## Task 4: Rebuilt `DateTimeField`

**Files:**
- Modify: `src/components/ui.jsx`
- Modify: `src/pages/Admin.jsx`

**Interfaces:**
- Consumes: `MonthCalendar` (Task 3, internal to `ui.jsx`).
- Modifies: `DateTimeField` keeps its existing external signature `{ value, onChange, required, placeholder }` — no caller changes needed. `value`/`onChange` still deal in the same `datetime-local`-shaped string (`'YYYY-MM-DDTHH:mm'`) the rest of the app already expects (`Admin.jsx` does `new Date(gameForm.date).toISOString()` on it elsewhere, unchanged).

- [ ] **Step 1: Replace `DateTimeField`**

Find the entire current `DateTimeField`:

```jsx
export function DateTimeField({ value, onChange, required, placeholder = 'Seleciona data e hora' }) {
  const display = value
    ? new Date(value).toLocaleString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : placeholder
  return (
    <div className="relative">
      <div className={`input-field flex items-center justify-between ${value ? 'text-court-900' : 'text-muted'}`}>
        <span className="truncate">{display}</span>
        <Calendar size={18} className="text-court-600 shrink-0 ml-2" />
      </div>
      <input
        type="datetime-local"
        value={value || ''}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Data e hora"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  )
}
```

Replace with:

```jsx
export function DateTimeField({ value, onChange, placeholder = 'Seleciona data e hora' }) {
  const [open, setOpen] = useState(false)
  // Pending date (from the calendar) and time (from the native time input)
  // are held separately while the sheet is open, and only combined into
  // one value when "Confirmar" is tapped — picking a day shouldn't close
  // this sheet the way it does for DateField, since there's still a time
  // to set.
  const initialDate = value ? new Date(value) : null
  const [pendingDate, setPendingDate] = useState(initialDate)
  const [pendingTime, setPendingTime] = useState(
    initialDate
      ? `${String(initialDate.getHours()).padStart(2, '0')}:${String(initialDate.getMinutes()).padStart(2, '0')}`
      : '10:00'
  )
  const [viewDate, setViewDate] = useState(initialDate || new Date())

  const display = value
    ? new Date(value).toLocaleString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : placeholder

  const openPicker = () => {
    const current = value ? new Date(value) : null
    setPendingDate(current)
    setPendingTime(
      current
        ? `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`
        : '10:00'
    )
    setViewDate(current || new Date())
    setOpen(true)
  }

  const navigate = (delta) => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }

  const selectDay = (day) => {
    setPendingDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day))
  }

  const confirm = () => {
    if (!pendingDate) return
    const [hours, minutes] = pendingTime.split(':').map(Number)
    const combined = new Date(pendingDate.getFullYear(), pendingDate.getMonth(), pendingDate.getDate(), hours, minutes)
    const iso = `${combined.getFullYear()}-${String(combined.getMonth() + 1).padStart(2, '0')}-${String(combined.getDate()).padStart(2, '0')}T${String(combined.getHours()).padStart(2, '0')}:${String(combined.getMinutes()).padStart(2, '0')}`
    onChange(iso)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        className={`input-field flex items-center justify-between text-left ${value ? 'text-court-900' : 'text-muted'}`}
      >
        <span className="truncate">{display}</span>
        <Calendar size={18} className="text-court-600 shrink-0 ml-2" />
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-court-900/50 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface rounded-t-card sm:rounded-card shadow-lift w-full sm:max-w-md p-5 animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-court-900">{placeholder}</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:bg-court-50 hover:text-court-900 transition-colors duration-fast"
              >
                <X size={18} />
              </button>
            </div>
            <MonthCalendar
              selected={pendingDate}
              viewDate={viewDate}
              onNavigate={navigate}
              onSelectDay={selectDay}
              min={null}
              max={null}
            />
            <div className="mt-4">
              <label className="block text-sm font-extrabold text-court-900 mb-2">Hora</label>
              <input
                type="time"
                value={pendingTime}
                onChange={(e) => setPendingTime(e.target.value)}
                className="input-field"
                aria-label="Hora"
              />
            </div>
            <button
              type="button"
              onClick={confirm}
              disabled={!pendingDate}
              className="btn-primary w-full mt-4 disabled:opacity-40 disabled:pointer-events-none"
            >
              Confirmar
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
```

- [ ] **Step 2: `Admin.jsx` — add the date-required check**

Find (inside `handleCreateGame`, right after `e.preventDefault()`):

```jsx
  const handleCreateGame = async (e) => {
    e.preventDefault()
    
    try {
```

Replace with:

```jsx
  const handleCreateGame = async (e) => {
    e.preventDefault()

    // Date used to be enforced by DateTimeField's underlying native
    // input's `required` attribute — it's a fully custom component now.
    if (!gameForm.date) {
      alert('Escolhe uma data e hora para o jogo')
      return
    }

    try {
```

Find (inside `handleUpdateGame`, right after `e.preventDefault()`):

```jsx
  const handleUpdateGame = async (e) => {
    e.preventDefault()
    
    try {
```

Replace with:

```jsx
  const handleUpdateGame = async (e) => {
    e.preventDefault()

    if (!gameForm.date) {
      alert('Escolhe uma data e hora para o jogo')
      return
    }

    try {
```

- [ ] **Step 3: Verify it compiles**

Run: `npx vite build`
Expected: `✓ built in ...s` with no errors.

- [ ] **Step 4: Manual verification in the browser**

Run `npm run dev`, log in as admin:
1. Admin → Jogos → Criar novo jogo → tap "Data e hora" → confirm the sheet opens with the calendar AND a time row together, picking a day does NOT close the sheet (only "Confirmar" does), and picking a day + a time + tapping Confirmar sets the field to the right combined value.
2. Try tapping Confirmar with no day picked → confirm the button is disabled (can't confirm with nothing selected).
3. Leave the date field entirely untouched and try submitting the "Criar novo jogo" form → confirm you get the new alert instead of a raw database error.
4. Create a mix successfully with a specific date+time → confirm it shows up correctly in the games list afterward (i.e. the combined ISO string round-trips correctly through the existing `new Date(gameForm.date).toISOString()` conversion already in `handleCreateGame`).
5. Edit an existing mix's date — confirm the sheet opens pre-filled with its current date and time.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui.jsx src/pages/Admin.jsx
git commit -m "Replace DateTimeField's native input with a custom calendar + time picker"
```
