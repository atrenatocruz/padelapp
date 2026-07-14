import { useState, useEffect } from 'react'
import { CalendarX2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MixCard, EmptyState } from '../components/ui'

export default function Home() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const { user, profile } = useAuth()

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
            status,
            user:profiles!participants_user_id_fkey (name, level, is_guest)
          )
        `)
        .order('date', { ascending: true })

      if (error) {
        console.error('Error loading games:', error)
        throw error
      }

      // Show all games that are not cancelled
      const filteredGames = data ? data.filter(game => game.status !== 'cancelled') : []

      setGames(filteredGames)
    } catch (error) {
      console.error('Error in loadGames:', error)
    } finally {
      setLoading(false)
    }
  }

  const isUserJoined = (game) => {
    return game.participants?.some(p => p.user_id === user.id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-court-100 border-t-court-600"></div>
      </div>
    )
  }

  const firstName = profile?.name?.split(' ')[0]

  return (
    <div className="space-y-5">
      <div>
        {firstName && (
          <p className="text-muted text-sm mb-0.5">Olá, {firstName} 👋</p>
        )}
        <h2 className="text-3xl text-court-900">Próximos jogos</h2>
      </div>

      {games.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="Campo livre… por agora"
          subtitle="Ainda não há jogos marcados. Volta em breve — ou dá um toque ao admin."
        />
      ) : (
        <div className="space-y-3.5">
          {games.map(game => (
            <MixCard key={game.id} game={game} joined={isUserJoined(game)} />
          ))}
        </div>
      )}
    </div>
  )
}
