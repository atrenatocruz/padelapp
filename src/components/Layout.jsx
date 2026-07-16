import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, Trophy, User, Settings, LogOut, HelpCircle, Phone } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { LevelBadge, PrimaryButton } from './ui'

/* Blocking modal — no close button, no click-outside-to-dismiss. Shown
   whenever a real (non-guest) member's profile has no phone number, since
   the WhatsApp bot needs it to recognize them in the group. Covers Google
   sign-ins (Google never provides a phone) and any older account created
   before phone became a required signup field. */
function PhoneRequiredModal({ onSave }) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (phone.replace(/\D/g, '').length < 9) {
      setError('Introduz um número de telemóvel válido')
      return
    }
    setSaving(true)
    setError('')
    const { error: saveError } = await onSave(phone)
    if (saveError) {
      setError('Não foi possível guardar. Tenta novamente.')
      setSaving(false)
    }
    // on success the parent's `profile.phone` updates and this modal unmounts
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-court-900/70 animate-fade-in">
      <div className="bg-surface rounded-t-card sm:rounded-card shadow-lift w-full sm:max-w-md p-6 animate-pop">
        <div className="w-11 h-11 rounded-full bg-volt-400/15 text-volt-600 flex items-center justify-center mb-4">
          <Phone size={20} />
        </div>
        <h3 className="text-lg text-court-900 mb-1.5">Falta o teu nº de telemóvel</h3>
        <p className="text-sm text-muted mb-5">
          Precisamos dele para te reconhecer no grupo de WhatsApp (para poderes escrever "In"/"Out" nos mixes). Sem isto não dá para continuar.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-field"
            placeholder="912 345 678"
            autoFocus
            required
          />
          {error && (
            <div className="bg-danger/10 text-danger px-4 py-3 rounded-ctrl text-sm font-extrabold">
              {error}
            </div>
          )}
          <PrimaryButton type="submit" disabled={saving} className="w-full">
            {saving ? 'A guardar…' : 'Guardar'}
          </PrimaryButton>
        </form>
      </div>
    </div>
  )
}

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

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, profile, updateProfile } = useAuth()

  const needsPhone = profile && !profile.is_guest && !profile.phone

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Guests only see Jogos + Perfil
  const navItems = profile?.is_guest
    ? [
        { path: '/', icon: Home, label: 'Jogos' },
        { path: '/perfil', icon: User, label: 'Perfil' },
      ]
    : [
        { path: '/', icon: Home, label: 'Jogos' },
        { path: '/rankings', icon: Trophy, label: 'Ranking' },
        { path: '/perfil', icon: User, label: 'Perfil' },
      ]

  if (profile?.is_admin) {
    navItems.push({ path: '/admin', icon: Settings, label: 'Admin' })
  }

  return (
    <div className="min-h-screen bg-sand pb-32">
      {/* Header — dark liquid glass */}
      <header className="sticky top-0 z-10 bg-court-900/95 backdrop-blur-xl border-b border-white/5 supports-[backdrop-filter]:bg-court-900/85">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-white text-xl leading-none">
            <Wordmark />
          </Link>

          <div className="flex items-center gap-1">
            {profile?.level && !profile?.is_guest && (
              <Link to="/perfil" title="O teu nível" className="mr-2">
                <LevelBadge level={profile.level} me />
              </Link>
            )}
            <Link
              to="/instrucoes"
              title="Instruções"
              className="w-11 h-11 flex items-center justify-center rounded-full text-court-200 hover:text-white hover:bg-white/10 transition-colors duration-fast"
            >
              <HelpCircle size={21} />
            </Link>
            <button
              onClick={handleSignOut}
              title="Sair"
              className="w-11 h-11 flex items-center justify-center rounded-full text-court-200 hover:text-white hover:bg-white/10 transition-colors duration-fast"
            >
              <LogOut size={21} />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-6 animate-fade-up">
        {children}
      </main>

      {/* Nav — floating dynamic island, liquid glass */}
      <nav
        className="fixed inset-x-0 z-20 flex justify-center pointer-events-none px-4"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto flex items-center gap-1 p-1.5 rounded-full
                        bg-court-900/95 supports-[backdrop-filter]:bg-court-900/90 backdrop-blur-xl
                        shadow-[0_8px_32px_rgba(11,37,69,0.35)]
                        ring-1 ring-white/10">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path
            return (
              <Link
                key={path}
                to={path}
                aria-current={isActive ? 'page' : undefined}
                aria-label={label}
                className={`flex items-center justify-center gap-1.5 h-12 rounded-full
                            transition-all duration-base ${
                  isActive
                    ? 'bg-white/15 text-volt-400 px-4'
                    : 'text-court-200 hover:text-white w-12'
                }`}
              >
                <Icon size={21} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
                {/* label morphs in on the active item — island style */}
                <span
                  className={`text-xs font-extrabold whitespace-nowrap overflow-hidden transition-all duration-base ${
                    isActive ? 'max-w-[80px] opacity-100' : 'max-w-0 opacity-0'
                  }`}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {needsPhone && (
        <PhoneRequiredModal onSave={(phone) => updateProfile({ phone })} />
      )}
    </div>
  )
}
