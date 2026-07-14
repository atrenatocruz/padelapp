import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, Trophy, User, Settings, LogOut, HelpCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut, profile } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { path: '/', icon: Home, label: 'Jogos' },
    { path: '/rankings', icon: Trophy, label: 'Ranking' },
    { path: '/perfil', icon: User, label: 'Perfil' },
  ]

  if (profile?.is_admin) {
    navItems.push({ path: '/admin', icon: Settings, label: 'Admin' })
  }

  return (
    <div className="min-h-screen bg-apple-gray pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-apple-darkgray">Os Padeleiros</h1>
          <div className="flex items-center gap-4">
            <Link
              to="/instrucoes"
              className="text-gray-600 hover:text-apple-blue transition-colors"
              title="Instruções"
            >
              <HelpCircle size={24} />
            </Link>
            <button
              onClick={handleSignOut}
              className="text-gray-600 hover:text-red-500 transition-colors"
              title="Sair"
            >
              <LogOut size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-around">
            {navItems.map(({ path, icon: Icon, label }) => {
              const isActive = location.pathname === path
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex flex-col items-center py-3 px-4 transition-colors ${
                    isActive
                      ? 'text-apple-blue'
                      : 'text-gray-500 hover:text-apple-darkgray'
                  }`}
                >
                  <Icon size={24} />
                  <span className="text-xs mt-1 font-medium">{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}


