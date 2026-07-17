import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MapPin, CheckCircle2, ChevronRight, Lock, Play, Calendar, X, Share2, MessageCircle, Link2, Clock } from 'lucide-react'

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

/* ════════════════════════════════════════════════════════════════════════
   UI kit — Os Padeleiros
   Reusable components: PrimaryButton, LevelBadge, PlayerAvatarRow,
   EmptyState, MixCard. Design tokens live in src/index.css.
   ════════════════════════════════════════════════════════════════════════ */

/* ─── Level helpers ──────────────────────────────────────────────────────
   One canonical mapping so a level is never ambiguous anywhere in the app. */
const LEVEL_META = {
  iniciante:    { label: 'INI', full: 'Iniciante',  rank: 1 },
  N6:           { label: 'N6',  full: 'Nível 6',    rank: 2 },
  N5:           { label: 'N5',  full: 'Nível 5',    rank: 3 },
  'intermédio': { label: 'INT', full: 'Intermédio', rank: 3 },
  N4:           { label: 'N4',  full: 'Nível 4',    rank: 4 },
  N3:           { label: 'N3',  full: 'Nível 3',    rank: 5 },
  'avançado':   { label: 'AVA', full: 'Avançado',   rank: 5 },
  N2:           { label: 'N2',  full: 'Nível 2',    rank: 6 },
}

export const levelMeta = (level) =>
  LEVEL_META[level] || { label: '—', full: 'Sem nível', rank: 0 }

/** Range string for a set of players, e.g. "INT – AVA" or "INT". */
export const levelRange = (levels) => {
  const known = levels.map(levelMeta).filter(m => m.rank > 0)
  if (known.length === 0) return null
  const sorted = [...known].sort((a, b) => a.rank - b.rank)
  const lo = sorted[0].label
  const hi = sorted[sorted.length - 1].label
  return lo === hi ? lo : `${lo} – ${hi}`
}

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
  return (
    <button
      className={`font-extrabold py-3.5 px-6 rounded-ctrl min-h-[48px] text-base
                  inline-flex items-center justify-center gap-2
                  transition-all duration-fast active:scale-[0.98]
                  disabled:opacity-40 disabled:pointer-events-none
                  ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/* ─── LevelBadge ─────────────────────────────────────────────────────────
   Impossible to misread: bold label on ink. `me` gets the volt treatment.
   Pass `range` (string) instead of `level` for a level range. */
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

/* ─── GuestBadge ─────────────────────────────────────────────────────────
   Marks non-regular players inside game participant lists. */
export function GuestBadge({ size = 'sm' }) {
  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }
  return (
    <span
      title="Jogador convidado"
      className={`inline-flex items-center rounded-full font-extrabold tracking-wide uppercase
                  border border-dashed border-court-200 bg-sand text-muted ${sizes[size]}`}
    >
      Convidado
    </span>
  )
}

/* ─── PlayerAvatarRow ────────────────────────────────────────────────────
   Filled initials + dashed empty slots + count. Slots visible at a glance.
   Caps visible avatars (cap) with a +N chip so wide games stay compact. */
export function PlayerAvatarRow({ players = [], max = 4, size = 'md', cap = 6 }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-sm'
  const shown = players.slice(0, cap)
  const overflow = players.length - shown.length
  // only show empty slots when nothing is hidden (small games)
  const empty = overflow > 0 ? 0 : Math.max(0, Math.min(max - players.length, cap - shown.length))
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex -space-x-2">
        {shown.map((p, i) => (
          <div
            key={p.id || i}
            title={p.name}
            style={{ zIndex: cap - i }}
            className={`${dim} relative rounded-full bg-court-600 text-white font-extrabold
                        flex items-center justify-center ring-2 ring-surface`}
          >
            {(p.name || '?').charAt(0).toUpperCase()}
          </div>
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <div
            key={`e${i}`}
            className={`${dim} rounded-full border-2 border-dashed border-court-200
                        bg-sand ring-2 ring-surface`}
          />
        ))}
        {overflow > 0 && (
          <div className={`${dim} relative rounded-full bg-court-100 text-court-700 font-extrabold
                          flex items-center justify-center ring-2 ring-surface`}>
            +{overflow}
          </div>
        )}
      </div>
      <span className="text-sm font-extrabold text-court-900 tabular-nums">
        {players.length}<span className="text-muted font-normal">/{max}</span>
      </span>
    </div>
  )
}

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

/* ─── MixCard ────────────────────────────────────────────────────────────
   Scannable at a glance: when, where, levels, slots, my state.
   States: open | closed (court reservado) | completed | joined. */
export function MixCard({ game, joined = false }) {
  // Every person in the game — a row with partner counts as 2 players
  const players = (game.participants || [])
    .filter(p => p.status === 'confirmed')
    .flatMap(p => [
      { id: p.user_id, name: p.user?.name, level: p.user?.level, isGuest: p.user?.is_guest },
      ...(p.partner_id ? [{ id: p.partner_id, name: p.partner?.name, level: p.partner?.level, isGuest: p.partner?.is_guest }] : []),
    ])

  // Guests count as players but their (default) level shouldn't skew the range
  const range = levelRange(players.filter(p => !p.isGuest).map(p => p.level))
  // A full game reads as closed even if the stored status lagged behind
  const capacity = game.max_players || (game.num_courts || 1) * 4
  const isFull = players.length >= capacity
  const isClosed = game.status === 'closed' || (game.status === 'open' && isFull)
  const isLive = game.status === 'in_progress'
  const isDone = game.status === 'completed' || game.status === 'finished'

  const d = new Date(game.date)
  const today = new Date(); const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const dayLabel =
    d.toDateString() === today.toDateString() ? 'Hoje'
    : d.toDateString() === tomorrow.toDateString() ? 'Amanhã'
    : d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

  return (
    <Link
      to={`/jogo/${game.id}`}
      className={`card press block hover:shadow-lift relative overflow-hidden
                  ${isDone ? 'opacity-60' : ''}`}
    >
      {/* joined = volt accent bar, instantly distinct */}
      {joined && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-volt-400" />}

      <div className="flex items-start justify-between gap-3 mb-3">
        {/* When — the strongest element on the card */}
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-court-600">{dayLabel}</p>
          <p className="text-2xl text-court-900 leading-tight">{time}</p>
        </div>

        {/* State — color + icon, never text alone */}
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 bg-volt-400 text-court-900 text-xs font-extrabold px-3 py-1.5 rounded-full">
            <Play size={14} /> A decorrer
          </span>
        ) : joined ? (
          <span className="inline-flex items-center gap-1.5 bg-volt-400 text-court-900 text-xs font-extrabold px-3 py-1.5 rounded-full">
            <CheckCircle2 size={14} /> Inscrito
          </span>
        ) : isDone ? (
          <span className="inline-flex items-center gap-1.5 bg-court-100 text-court-700 text-xs font-extrabold px-3 py-1.5 rounded-full">
            <CheckCircle2 size={14} /> Terminado
          </span>
        ) : null}
      </div>

      <h3 className="text-lg text-court-900 leading-snug mb-1">{game.title}</h3>
      {game.location && (
        <p className="flex items-center gap-1.5 text-muted text-sm mb-4">
          <MapPin size={15} className="shrink-0" /> {game.location}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 border-t border-line">
        <div className="flex items-center gap-3 min-w-0">
          <PlayerAvatarRow players={players} max={game.max_players} size="sm" />
          {range && <LevelBadge range={range} />}
        </div>
        {game.status === 'open' && !joined && !isFull && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-court-600 text-sm font-extrabold">
            Jogar <ChevronRight size={17} />
          </span>
        )}
        {isClosed && !isLive && !isDone && (
          <span className="ml-auto inline-flex items-center gap-1.5 bg-ok/10 text-ok text-[11px] font-extrabold px-2.5 py-1 rounded-full">
            <Lock size={13} className="shrink-0" /> Mix fechado — campo reservado
          </span>
        )}
      </div>
    </Link>
  )
}

/* ─── ShareModal ─────────────────────────────────────────────────────────
   Share sheet used for mixes: editable caption + link, WhatsApp + native
   share (when the device supports it) + copy-link fallback. */
export function ShareModal({ title = 'Partilhar', message, url, onClose }) {
  const [caption, setCaption] = useState(message)
  const [editingCaption, setEditingCaption] = useState(false)
  const [copied, setCopied] = useState(false)

  const fullText = `${caption}\n\n🔗 ${url}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API unavailable (older browsers, insecure context) — the
      // link is still visible in the textarea/preview for manual copy.
    }
  }

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, '_blank', 'noopener,noreferrer')
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text: caption, url })
    } catch {
      // user cancelled the OS share sheet — nothing to do
    }
  }

  // Rendered via portal straight into <body> — this modal is opened from
  // pages nested inside <main>, which carries a permanent (fill-mode:
  // both) animate-fade-up transform. An ancestor with any transform,
  // including a completed one, becomes the containing block for
  // descendant `fixed` elements on iOS Safari, so without the portal this
  // renders inline in the page instead of as a fullscreen overlay.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-court-900/50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-card sm:rounded-card shadow-lift w-full sm:max-w-md max-h-[90vh] overflow-y-auto animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Share2 size={20} className="text-court-600" />
            <h3 className="text-lg text-court-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:bg-court-50 hover:text-court-900 transition-colors duration-fast"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <div className="bg-sand rounded-ctrl p-3.5 text-sm text-court-900 whitespace-pre-line">
            {fullText}
          </div>

          {editingCaption ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-extrabold text-court-900">Legenda</label>
                <div className="flex items-center gap-3">
                  {caption !== message && (
                    <button
                      onClick={() => setCaption(message)}
                      className="text-court-600 text-xs font-extrabold"
                    >
                      Repor
                    </button>
                  )}
                  <button
                    onClick={() => setEditingCaption(false)}
                    className="text-court-600 text-xs font-extrabold"
                  >
                    Concluído
                  </button>
                </div>
              </div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                className="input-field resize-none"
                autoFocus
              />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="flex-1 min-w-0 truncate text-sm text-muted">
                <span className="font-extrabold text-court-900">Legenda: </span>
                {caption}
              </p>
              <button
                onClick={() => setEditingCaption(true)}
                className="text-court-600 text-xs font-extrabold shrink-0"
              >
                Editar
              </button>
            </div>
          )}

          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-2.5 rounded-ctrl border border-line px-3.5 py-3 min-h-[48px]
                       text-sm font-extrabold text-court-900 hover:border-court-200 transition-colors duration-fast"
          >
            <Link2 size={17} className="text-court-600 shrink-0" />
            <span className="flex-1 min-w-0 text-left truncate text-muted font-normal">{url}</span>
            <span className="text-court-600 shrink-0">{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          <PrimaryButton variant="whatsapp" onClick={handleWhatsApp} className="w-full">
            <MessageCircle size={19} />
            Partilhar via WhatsApp
          </PrimaryButton>

          {typeof navigator !== 'undefined' && navigator.share && (
            <PrimaryButton variant="ghost" onClick={handleNativeShare} className="w-full">
              <Share2 size={19} />
              Mais opções
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// Three short beeps via the Web Audio API — no bundled audio asset, works
// offline as a PWA, and needs no license. Wrapped in try/catch: Web Audio
// can be unavailable or blocked by autoplay policy on some browsers: the
// visual "00:00" state is still enough of a signal if the beep is silently
// skipped.
function playRoundEndBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    ;[0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.25)
    })
  } catch {
    // Web Audio unavailable — silent fallback.
  }
}

/* Per-round countdown. Visible to everyone; the +/- adjust controls and
   the expiry beep are admin-only. `startedAt`/`durationMinutes` come
   straight from the `games` row, which every open device already receives
   live via the existing Realtime subscription on games UPDATE — no new
   sync mechanism needed here. */
export function RoundTimer({ startedAt, durationMinutes, isAdmin, onAdjust }) {
  const [now, setNow] = useState(Date.now())
  const alertedRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Re-arm the alert whenever a new round starts, or the admin extends a
  // round that had already rung once (so it can ring again at the new end).
  useEffect(() => {
    alertedRef.current = false
  }, [startedAt, durationMinutes])

  const endTime = startedAt ? new Date(startedAt).getTime() + (durationMinutes || 0) * 60000 : null
  const remainingMs = endTime !== null ? Math.max(0, endTime - now) : null
  const expired = remainingMs !== null && remainingMs <= 0

  useEffect(() => {
    if (expired && isAdmin && !alertedRef.current) {
      alertedRef.current = true
      playRoundEndBeep()
    }
  }, [expired, isAdmin])

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
