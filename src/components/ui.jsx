import { Link } from 'react-router-dom'
import { MapPin, CheckCircle2, ChevronRight, Lock, Play } from 'lucide-react'

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
    volt:   'bg-volt-400 text-court-900 hover:bg-volt-300 shadow-card',
    navy:   'bg-court-600 text-white hover:bg-court-500 shadow-card',
    ghost:  'bg-surface text-court-900 border border-line hover:bg-court-50 hover:border-court-200',
    danger: 'bg-danger/10 text-danger hover:bg-danger/15',
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
   Filled initials + dashed empty slots + count. Slots visible at a glance. */
export function PlayerAvatarRow({ players = [], max = 4, size = 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-sm'
  const empty = Math.max(0, max - players.length)
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex -space-x-2">
        {players.slice(0, max).map((p, i) => (
          <div
            key={p.id || i}
            title={p.name}
            style={{ zIndex: max - i }}
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
        ) : isClosed ? (
          <span className="inline-flex items-center gap-1.5 bg-ok/10 text-ok text-xs font-extrabold px-3 py-1.5 rounded-full">
            <Lock size={14} /> Mix fechado — campo reservado
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

      <div className="flex items-center justify-between pt-3 border-t border-line">
        <div className="flex items-center gap-3">
          <PlayerAvatarRow players={players} max={game.max_players} size="sm" />
          {range && <LevelBadge range={range} />}
        </div>
        {game.status === 'open' && !joined && !isFull && (
          <span className="inline-flex items-center gap-0.5 text-court-600 text-sm font-extrabold">
            Jogar <ChevronRight size={17} />
          </span>
        )}
      </div>
    </Link>
  )
}
