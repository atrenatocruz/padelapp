import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { signUp, signIn, signInAsAdmin } = useAuth()

  const handleAdminBypass = () => {
    signInAsAdmin()
    navigate('/')
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

      // Success - show message and auto-login
      alert('Conta criada com sucesso! A fazer login...')
      
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

  return (
    <div className="min-h-screen bg-apple-gray flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-apple-darkgray mb-2">Os Padeleiros</h1>
          <p className="text-gray-600 text-lg">
            {mode === 'login' ? 'Bem-vindo de volta' : 'Cria a tua conta'}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setMode('login')
                setError('')
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                mode === 'login'
                  ? 'bg-apple-blue text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => {
                setMode('signup')
                setError('')
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-apple-blue text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
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
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? 'A entrar...' : 'Entrar'}
              </button>
            </form>
          )}

          {/* Signup Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome completo
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de nascimento
                </label>
                <input
                  type="date"
                  value={signupBirthday}
                  onChange={(e) => setSignupBirthday(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Género
                </label>
                <select
                  value={signupGender}
                  onChange={(e) => setSignupGender(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Seleciona...</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar password
                </label>
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
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? 'A criar conta...' : 'Criar conta'}
              </button>
            </form>
          )}
        </div>

        {import.meta.env.DEV && (
          <div className="mt-4">
            <button
              onClick={handleAdminBypass}
              className="w-full py-3 px-4 rounded-xl font-medium border border-dashed border-apple-blue text-apple-blue hover:bg-blue-50 transition-all"
            >
              🔓 Entrar como Admin (dev)
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <a
            href="/instrucoes"
            className="text-apple-blue hover:underline"
          >
            Ver instruções de utilização
          </a>
        </div>
      </div>
    </div>
  )
}
