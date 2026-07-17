import { useState, useEffect } from 'react'
import { CalendarX2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MixCard, EmptyState } from '../components/ui'

export default function Home() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const { user, profile, currentOrganizationId } = useAuth()

  useEffect(() => {
    if (!currentOrganizationId) return

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
  }, [currentOrganizationId])

  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select(`
          *,
          participants (
            id,
            user_id,
            partner_id,
            status,
            user:profiles!participants_user_id_fkey (name),
            partner:profiles!participants_partner_id_fkey (name)
          )
        `)
        .eq('organization_id', currentOrganizationId)
        .order('date', { ascending: true })

      if (error) {
        console.error('Error loading games:', error)
        throw error
      }

      // level/is_guest moved to `memberships` (per-org) — fetch this org's
      // memberships once and merge onto each participant's user/partner so
      // MixCard's existing shape (p.user.level, p.user.is_guest) still works.
      const { data: memberRows, error: memberError } = await supabase
        .from('memberships')
        .select('user_id, level, is_guest')
        .eq('organization_id', currentOrganizationId)
      if (memberError) throw memberError
      const membershipByUser = new Map((memberRows || []).map((m) => [m.user_id, m]))

      const attachMembership = (person, userId) => {
        if (!person) return person
        const m = membershipByUser.get(userId)
        return { ...person, level: m?.level, is_guest: m?.is_guest ?? false }
      }

      // Show all games that are not cancelled
      const filteredGames = (data || [])
        .filter((game) => game.status !== 'cancelled')
        .map((game) => ({
          ...game,
          participants: (game.participants || []).map((p) => ({
            ...p,
            user: attachMembership(p.user, p.user_id),
            partner: attachMembership(p.partner, p.partner_id),
          })),
        }))

      setGames(filteredGames)
    } catch (error) {
      console.error('Error in loadGames:', error)
    } finally {
      setLoading(false)
    }
  }

  const isUserJoined = (game) => {
    return game.participants?.some(p => p.user_id === user.id || p.partner_id === user.id)
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
