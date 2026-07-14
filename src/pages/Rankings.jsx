import { useState, useEffect } from 'react'
import { Trophy, Award, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LevelBadge, EmptyState } from '../components/ui'

export default function Rankings() {
  const [rankings, setRankings] = useState([])
  const [players, setPlayers] = useState([])
  const [showPlayers, setShowPlayers] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRankings()
    loadPlayers()
  }, [])

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, level')
        .order('name')

      if (error) throw error
      setPlayers(data || [])
    } catch (error) {
      console.error('Error loading players:', error)
    }
  }

  const loadRankings = async () => {
    try {
      const { data, error } = await supabase
        .from('player_stats')
        .select(`
          *,
          user:profiles!player_stats_user_id_fkey (name, level)
        `)
        .order('games_won', { ascending: false })
        .order('rating', { ascending: false })

      if (error) throw error

      // Calculate win rate and sort
      const rankedData = data
        .map(player => ({
          ...player,
          winRate: player.games_played > 0
            ? ((player.games_won / player.games_played) * 100).toFixed(1)
            : 0
        }))
        .sort((a, b) => {
          // Sort by games won, then by win rate
          if (b.games_won !== a.games_won) {
            return b.games_won - a.games_won
          }
          return b.winRate - a.winRate
        })

      setRankings(rankedData)
    } catch (error) {
      console.error('Error loading rankings:', error)
    } finally {
      setLoading(false)
    }
  }

  // Position chip: 1st gets the volt, 2nd/3rd get ink tones, rest neutral
  const positionStyle = (i) => {
    if (i === 0) return 'bg-volt-400 text-court-900'
    if (i === 1) return 'bg-court-900 text-white'
    if (i === 2) return 'bg-court-600 text-white'
    return 'bg-court-100 text-court-700'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-court-100 border-t-court-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-muted text-sm mb-0.5">Os Padeleiros</p>
        <h2 className="text-3xl text-court-900">Classificação</h2>
      </div>

      {rankings.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Ranking em branco"
          subtitle="Joga uns quantos jogos e o teu nome aparece aqui."
        />
      ) : (
        <div className="space-y-3">
          {rankings.map((player, index) => (
            <div
              key={player.id}
              className={`card ${index === 0 ? 'ring-2 ring-volt-400' : ''}`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-ctrl flex items-center justify-center font-extrabold text-lg shrink-0 tabular-nums ${positionStyle(index)}`}
                >
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-base text-court-900 truncate">
                    {player.user?.name}
                  </h3>
                  <div className="mt-0.5">
                    <LevelBadge level={player.user?.level} />
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Trophy size={15} className="text-volt-500" />
                    <span className="text-2xl font-extrabold text-court-900 tabular-nums">
                      {player.games_won}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">vitórias</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 pt-3.5 border-t border-line text-center">
                <div>
                  <p className="text-lg font-extrabold text-court-900 tabular-nums">{player.games_played}</p>
                  <p className="text-[11px] text-muted">jogos</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-ok tabular-nums">{player.winRate}%</p>
                  <p className="text-[11px] text-muted">taxa vitória</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-court-600 tabular-nums">{player.total_points_scored}</p>
                  <p className="text-[11px] text-muted">pontos</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de jogadores — collapsible */}
      <div className="card p-0 overflow-hidden">
        <button
          onClick={() => setShowPlayers(v => !v)}
          aria-expanded={showPlayers}
          className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] transition-colors duration-fast hover:bg-court-50"
        >
          <span className="text-lg font-extrabold text-court-900">
            Lista de jogadores
            <span className="text-muted font-normal text-sm ml-2">({players.length})</span>
          </span>
          <ChevronDown
            size={20}
            className={`text-muted transition-transform duration-base ${showPlayers ? 'rotate-180' : ''}`}
          />
        </button>

        {showPlayers && (
          <div className="border-t border-line divide-y divide-line animate-fade-up">
            {players.length === 0 ? (
              <p className="text-muted text-sm text-center py-6">Ainda não há jogadores registados</p>
            ) : (
              players.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 bg-court-600 text-white rounded-full flex items-center justify-center font-extrabold text-sm shrink-0">
                    {(p.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <p className="flex-1 min-w-0 font-extrabold text-court-900 truncate">{p.name}</p>
                  <LevelBadge level={p.level} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
