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
  const { signUp, signIn, signInWithGoogle, signInAsAdmin } = useAuth()

  const handleAdminBypass = () => {
    signInAsAdmin()
    navigate('/')
  }

  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setGoogleError('')
    try {
      // Redirects to Google — on success the browser comes back to this
      // app with a session already set, so there's nothing to navigate to.
      const { error } = await signInWithGoogle()
      if (error) throw error
    } catch (err) {
      console.error('Google sign-in error:', err)
      setGoogleError('Não foi possível entrar com o Google. Tenta novamente.')
      setGoogleLoading(false)
    }
  }

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Signup form state
  const [signupEmail, setSignupEmail] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
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

    // Validate phone (tolerant of spaces/dashes/country code — just needs a real number in there)
    if (signupPhone.replace(/\D/g, '').length < 9) {
      setError('Introduz um número de telemóvel válido')
      setLoading(false)
      return
    }

    try {
      const { error } = await signUp(signupEmail, signupPassword, {
        name: signupName,
        phone: signupPhone,
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
          {/* Google — primary entry point */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-ctrl min-h-[48px]
                       bg-surface text-court-900 font-extrabold text-base border border-line shadow-card
                       hover:bg-court-50 transition-all duration-fast active:scale-[0.98]
                       disabled:opacity-40 disabled:pointer-events-none"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            {googleLoading ? 'A entrar…' : 'Continuar com Google'}
          </button>

          {googleError && (
            <div className="mt-3 bg-danger/10 text-danger px-4 py-3 rounded-ctrl text-sm font-extrabold">
              {googleError}
            </div>
          )}

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-line" />
            <span className="text-muted text-xs font-extrabold uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px bg-line" />
          </div>

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
                <label className={inputLabel}>Nº de telemóvel</label>
                <input
                  type="tel"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  className="input-field"
                  placeholder="912 345 678"
                  required
                />
                <p className="text-xs text-muted mt-1.5">Usado para o bot do WhatsApp reconhecer-te no grupo</p>
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
