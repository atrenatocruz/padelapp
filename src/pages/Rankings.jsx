import { useState, useEffect } from 'react'
import { Trophy, TrendingUp, Award } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Rankings() {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRankings()
  }, [])

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

  const getMedalColor = (position) => {
    if (position === 0) return 'bg-yellow-500 text-white'
    if (position === 1) return 'bg-gray-300 text-gray-700'
    if (position === 2) return 'bg-orange-600 text-white'
    return 'bg-gray-100 text-gray-600'
  }

  const getMedalEmoji = (position) => {
    if (position === 0) return '🥇'
    if (position === 1) return '🥈'
    if (position === 2) return '🥉'
    return `${position + 1}º`
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
      <div className="text-center">
        <Trophy size={48} className="mx-auto text-yellow-500 mb-4" />
        <h2 className="text-3xl font-bold text-apple-darkgray">Classificação</h2>
        <p className="text-gray-600 mt-2">Top jogadores de Os Padeleiros</p>
      </div>

      {rankings.length === 0 ? (
        <div className="card text-center py-12">
          <Award size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600 text-lg">Ainda não há estatísticas</p>
          <p className="text-gray-500 mt-2">Joga alguns jogos para aparecer no ranking</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rankings.map((player, index) => (
            <div
              key={player.id}
              className={`card ${
                index < 3 ? 'border-2 border-yellow-400' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-2xl ${getMedalColor(
                    index
                  )}`}
                >
                  {getMedalEmoji(index)}
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-apple-darkgray">
                    {player.user?.name}
                  </h3>
                  <p className="text-sm text-gray-500">Nível: {player.user?.level}</p>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-1">
                    <Trophy size={16} className="text-yellow-500" />
                    <span className="text-2xl font-bold text-apple-darkgray">
                      {player.games_won}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">vitórias</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Jogos</p>
                  <p className="text-lg font-semibold text-apple-darkgray">
                    {player.games_played}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Taxa vitória</p>
                  <p className="text-lg font-semibold text-green-600">
                    {player.winRate}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Pontos</p>
                  <p className="text-lg font-semibold text-apple-blue">
                    {player.total_points_scored}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


