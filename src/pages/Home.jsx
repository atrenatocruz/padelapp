import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin, Users, CheckCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    loadGames()

    // Subscribe to game updates
    const subscription = supabase
      .channel('games_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        loadGames()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        loadGames()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select(`
          *,
          participants (
            id,
            user_id,
            status
          )
        `)
        .order('date', { ascending: true })

      if (error) {
        console.error('Error loading games:', error)
        throw error
      }

      console.log('Games loaded:', data) // Debug

      // Show all games that are not cancelled
      const filteredGames = data ? data.filter(game => game.status !== 'cancelled') : []

      setGames(filteredGames)
    } catch (error) {
      console.error('Error in loadGames:', error)
      alert('Erro ao carregar jogos: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getGameStatus = (game) => {
    const confirmedCount = game.participants?.filter(p => p.status === 'confirmed').length || 0
    
    if (game.status === 'closed') {
      return { text: 'Jogo fechado — campo reservado', color: 'bg-green-100 text-green-700', icon: CheckCircle }
    }
    
    if (game.status === 'completed') {
      return { text: 'Jogo terminado', color: 'bg-gray-100 text-gray-700', icon: CheckCircle }
    }
    
    return { 
      text: `${confirmedCount}/${game.max_players} jogadores`, 
      color: 'bg-blue-100 text-blue-700',
      icon: Users 
    }
  }

  const isUserJoined = (game) => {
    return game.participants?.some(p => p.user_id === user.id)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const dateOnly = date.toDateString()
    const todayOnly = today.toDateString()
    const tomorrowOnly = tomorrow.toDateString()

    const time = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

    if (dateOnly === todayOnly) {
      return `Hoje às ${time}`
    } else if (dateOnly === tomorrowOnly) {
      return `Amanhã às ${time}`
    } else {
      return date.toLocaleDateString('pt-PT', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-apple-blue"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-apple-darkgray">Próximos Jogos</h2>
      </div>

      {games.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600 text-lg">Ainda não há jogos marcados</p>
          <p className="text-gray-500 mt-2">Aguarda que o admin crie novos jogos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {games.map(game => {
            const status = getGameStatus(game)
            const StatusIcon = status.icon
            const joined = isUserJoined(game)

            return (
              <Link
                key={game.id}
                to={`/jogo/${game.id}`}
                className="card block hover:scale-[1.01] transition-transform"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-apple-darkgray mb-2">
                      {game.title}
                    </h3>
                    <div className="space-y-2 text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={18} />
                        <span>{formatDate(game.date)}</span>
                      </div>
                      {game.location && (
                        <div className="flex items-center gap-2">
                          <MapPin size={18} />
                          <span>{game.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {joined && (
                    <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Inscrito
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${status.color}`}>
                    <StatusIcon size={18} />
                    <span className="font-medium">{status.text}</span>
                  </div>
                  
                  {game.status === 'open' && !joined && (
                    <button className="text-apple-blue font-semibold hover:underline">
                      Quero jogar →
                    </button>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

