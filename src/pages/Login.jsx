import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PrimaryButton, DateField } from '../components/ui'
import { Wordmark } from '../components/Layout'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { signUp, signIn, signInAsGuest, signInAsAdmin } = useAuth()

  const handleAdminBypass = () => {
    signInAsAdmin()
    navigate('/')
  }

  // Guest entry state
  const [guestMode, setGuestMode] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestError, setGuestError] = useState('')
  const [guestLoading, setGuestLoading] = useState(false)

  const handleGuestEntry = async (e) => {
    e.preventDefault()
    const name = guestName.trim()

    if (name.length < 2 || name.length > 30) {
      setGuestError('O nome deve ter entre 2 e 30 caracteres')
      return
    }

    setGuestLoading(true)
    setGuestError('')

    try {
      const { error } = await signInAsGuest(name)
      if (error) throw error
      navigate('/')
    } catch (err) {
      console.error('Guest sign-in error:', err)
      setGuestError('Não foi possível entrar como convidado. Tenta novamente.')
    } finally {
      setGuestLoading(false)
    }
  }

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupBirthday, setSignupBirthday] = useState('')
  const [signupGender, setSignupGender] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await signIn(loginEmail, loginPassword)
      if (error) throw error
      navigate('/')
    } catch (err) {
      setError(err.message || 'Email ou password incorretos')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validate password match
    if (signupPassword !== signupConfirmPassword) {
      setError('As passwords não coincidem')
      setLoading(false)
      return
    }

    // Validate password length
    if (signupPassword.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres')
      setLoading(false)
      return
    }

    try {
      const { error } = await signUp(signupEmail, signupPassword, {
        name: signupName,
        birthday: signupBirthday,
        gender: signupGender,
      })

      if (error) throw error

      // Auto-login after signup
      const { error: loginError } = await signIn(signupEmail, signupPassword)
      if (loginError) throw loginError

      navigate('/')
    } catch (err) {
      setError(err.message || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  const inputLabel = 'block text-sm font-extrabold text-court-900 mb-2'

  return (
    <div className="min-h-screen bg-court-900 flex flex-col">
      {/* Hero — court lines + volt ball */}
      <div className="relative px-6 pt-14 pb-10 text-center overflow-hidden shrink-0">
        <svg
          viewBox="0 0 400 200"
          className="absolute inset-0 w-full h-full text-white/[0.06]"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <rect x="40" y="-40" width="320" height="280" rx="18" stroke="currentColor" strokeWidth="3" fill="none" />
          <line x1="200" y1="-40" x2="200" y2="240" stroke="currentColor" strokeWidth="3" />
          <line x1="40" y1="100" x2="360" y2="100" stroke="currentColor" strokeWidth="3" strokeDasharray="8 10" />
        </svg>
        <div className="relative">
          <h1 className="text-5xl text-white">
            <Wordmark />
          </h1>
          <p className="text-court-200 mt-3">
            {mode === 'login' ? 'Bem-vindo de volta' : 'Cria a tua conta'}
          </p>
        </div>
      </div>

      {/* Sheet */}
      <div className="flex-1 bg-sand rounded-t-[28px] px-5 py-8">
        <div className="w-full max-w-md mx-auto">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-surface rounded-ctrl p-1.5 shadow-card">
            <button
              onClick={() => {
                setMode('login')
                setError('')
              }}
              className={`flex-1 py-2.5 px-4 rounded-[8px] font-extrabold text-sm min-h-[44px] transition-all duration-fast ${
                mode === 'login'
                  ? 'bg-court-900 text-white'
                  : 'text-muted hover:text-court-900'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => {
                setMode('signup')
                setError('')
              }}
              className={`flex-1 py-2.5 px-4 rounded-[8px] font-extrabold text-sm min-h-[44px] transition-all duration-fast ${
                mode === 'signup'
                  ? 'bg-court-900 text-white'
                  : 'text-muted hover:text-court-900'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 animate-fade-up">
              <div>
                <label className={inputLabel}>Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="input-field"
                  placeholder="nome@exemplo.pt"
                  required
                />
              </div>

              <div>
                <label className={inputLabel}>Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="bg-danger/10 text-danger px-4 py-3 rounded-ctrl text-sm font-extrabold">
                  {error}
                </div>
              )}

              <PrimaryButton type="submit" disabled={loading} className="w-full">
                {loading ? 'A entrar…' : 'Entrar'}
              </PrimaryButton>
            </form>
          )}

          {/* Signup Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4 animate-fade-up">
              <div>
                <label className={inputLabel}>Nome completo</label>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="input-field"
                  placeholder="João Silva"
                  required
                />
              </div>

              <div>
                <label className={inputLabel}>Email</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="input-field"
                  placeholder="nome@exemplo.pt"
                  required
                />
              </div>

              <div>
                <label className={inputLabel}>Data de nascimento</label>
                <DateField
                  value={signupBirthday}
                  onChange={setSignupBirthday}
                  max={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>

              <div>
                <label className={inputLabel}>Género</label>
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
              </div>

              <div>
                <label className={inputLabel}>Password</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <p className="text-xs text-muted mt-1.5">Mínimo 6 caracteres</p>
              </div>

              <div>
                <label className={inputLabel}>Confirmar password</label>
                <input
                  type="password"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>

              {error && (
                <div className="bg-danger/10 text-danger px-4 py-3 rounded-ctrl text-sm font-extrabold">
                  {error}
                </div>
              )}

              <PrimaryButton type="submit" disabled={loading} className="w-full">
                {loading ? 'A criar conta…' : 'Criar conta'}
              </PrimaryButton>
            </form>
          )}

          {/* Guest entry — clearly secondary */}
          <div className="mt-6">
            {!guestMode ? (
              <button
                onClick={() => {
                  setGuestMode(true)
                  setGuestError('')
                }}
                className="w-full py-3 px-4 rounded-ctrl font-extrabold text-sm text-muted border border-line bg-surface hover:text-court-900 hover:bg-court-50 transition-all duration-fast min-h-[48px]"
              >
                Entrar como convidado
              </button>
            ) : (
              <form onSubmit={handleGuestEntry} className="card space-y-4 animate-fade-up">
                <div>
                  <label className={inputLabel}>O teu nome</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="input-field"
                    placeholder="João"
                    minLength={2}
                    maxLength={30}
                    autoFocus
                    required
                  />
                  <p className="text-xs text-muted mt-1.5">
                    Entras só com o nome — sem conta, sem email.
                  </p>
                </div>

                {guestError && (
                  <div className="bg-danger/10 text-danger px-4 py-3 rounded-ctrl text-sm font-extrabold">
                    {guestError}
                  </div>
                )}

                <div className="flex gap-3">
                  <PrimaryButton type="submit" disabled={guestLoading} className="flex-1">
                    {guestLoading ? 'A entrar…' : 'Continuar'}
                  </PrimaryButton>
                  <PrimaryButton
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setGuestMode(false)
                      setGuestName('')
                      setGuestError('')
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </PrimaryButton>
                </div>
              </form>
            )}
          </div>

          {import.meta.env.DEV && (
            <button
              onClick={handleAdminBypass}
              className="w-full mt-4 py-3 px-4 rounded-ctrl font-extrabold text-sm border border-dashed border-court-500 text-court-600 hover:bg-court-50 transition-all duration-fast min-h-[48px]"
            >
              🔓 Entrar como Admin (dev)
            </button>
          )}

          <div className="mt-8 text-center">
            <a href="/instrucoes" className="text-court-600 font-extrabold text-sm hover:underline">
              Ver instruções de utilização
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
