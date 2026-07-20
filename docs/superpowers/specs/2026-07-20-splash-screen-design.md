# Alinho Splash Screen — Design

## Context

The app currently has three near-identical inline loading-spinner blocks
in `src/App.jsx` (`ProtectedRoute`, `MemberRoute`, `AdminRoute`), each
independently checking `AuthContext`'s `loading` flag and rendering a
generic spinner + "A carregar..." text while the initial session check
resolves. This replaces all three with a single branded splash screen
using the alinho logo, shown once per app boot.

Confirmed via reading `src/contexts/AuthContext.jsx`: `loading` starts
`true` and is set `false` exactly once, during the initial
`getSession()`/`onAuthStateChange` resolution (lines 43, 52, 65, 69, 81,
167, 211) — it is never set back to `true` afterward, including across
later sign-in/sign-out within the same session. It is a true one-shot
"app boot" signal, not a per-navigation one, so gating on it once at the
top of the route tree is safe and won't cause the splash to reappear
during normal use.

## Component

New file: `src/components/SplashScreen.jsx`

```jsx
import { Wordmark } from './Layout'

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900">
      <Wordmark className="h-10 sm:h-12 animate-pulse-soft" />
    </div>
  )
}
```

Reuses the existing `Wordmark` component (default `variant="dark"` —
white letters, lime ring, white swirl), already verified correct against
the source logo SVG during the rebrand. No new SVG/path data.

## Animation

New in `src/index.css`, alongside the existing `fade-up`/`pop`/`fade-in`
custom keyframes (same pattern, not Tailwind's default `animate-pulse`,
which blinks opacity only and reads as "stalled" rather than "loading"):

```css
@keyframes pulse-soft {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.06); opacity: 0.85; }
}
.animate-pulse-soft { animation: pulse-soft 1.6s ease-in-out infinite; }
```

Added to the existing `@media (prefers-reduced-motion: reduce)` block
alongside the other `.animate-*` classes, so it's disabled the same way.

## Gating logic

`/login` and `/instrucoes` are unguarded routes today — they render
immediately regardless of `loading`, since neither is wrapped in
`ProtectedRoute`/`MemberRoute`/`AdminRoute`. The splash must not change
that (it would be a scope-expanding regression: those two pages would
start waiting on auth for no reason). So the gate is threaded through
the three guards via a shared `showSplash` prop, computed once in
`AppRoutes()`, rather than hoisted above the whole `<Routes>` tree:

```jsx
function AppRoutes() {
  const { user, loading: authLoading } = useAuth()
  const [minDurationElapsed, setMinDurationElapsed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinDurationElapsed(true), 700)
    return () => clearTimeout(timer)
  }, [])

  const showSplash = authLoading || !minDurationElapsed

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/instrucoes" element={<Instructions />} />
      <Route path="/" element={<ProtectedRoute showSplash={showSplash}>...</ProtectedRoute>} />
      {/* ...same showSplash prop passed at every ProtectedRoute/MemberRoute/AdminRoute usage... */}
    </Routes>
  )
}
```

Each guard renders `<SplashScreen />` when `showSplash` is true, before
its normal redirect check:

```jsx
const ProtectedRoute = ({ children, showSplash }) => {
  const { user } = useAuth()
  if (showSplash) return <SplashScreen />
  if (!user) return <Navigate to="/login" />
  return children
}
```

(`MemberRoute`/`AdminRoute` follow the same pattern with their own
existing redirect checks.) The 700ms minimum is a plain `setTimeout`,
inlined in `AppRoutes` (not a separate hook file — it's a single one-off
use, a dedicated hook would be premature abstraction) and shared via the
one `showSplash` value, so all three guards agree on when to stop
showing the splash — it isn't recomputed per guard.

## Scope

- New: `src/components/SplashScreen.jsx`
- Modify: `src/index.css` (new keyframes/class + reduced-motion entry)
- Modify: `src/App.jsx` (add the gate, remove the 3 now-dead spinner
  branches, import `useState`/`useEffect`/`SplashScreen`)

Out of scope: no static/pre-React splash in `index.html` (per the
earlier scope decision — this is a pure-React, auth-loading-only splash,
not an instant-on-cold-load one); no PWA manifest changes (the manifest's
own browser-generated install splash is a separate, already-existing
mechanism, untouched here).

## Testing

No automated test suite exists in this repo (same as the rebrand work).
Verification: `npm run build` passes, a manual check that throttling the
network (or the existing dev-mode admin-bypass path, which resolves
`loading` synchronously) still shows the splash for at least ~700ms
before routes render, and that `prefers-reduced-motion` disables the
pulse.
