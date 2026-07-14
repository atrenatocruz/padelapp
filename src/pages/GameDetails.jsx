import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, MapPin, Users, ArrowLeft, UserPlus, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function GameDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [game, setGame] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [joinMode, setJoinMode] = useState(null) // null, 'alone', 'partner'
  const [selectedPartner, setSelectedPartner] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [showResultForm, setShowResultForm] = useState(false)
  const [team1Score, setTeam1Score] = useState('')
  const [team2Score, setTeam2Score] = useState('')

  useEffect(() => {
    loadGameDetails()
    loadAllUsers()

    // Subscribe to updates
    const subscription = supabase
      .channel(`game_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `game_id=eq.${id}` }, () => {
        loadGameDetails()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [id])

  const loadGameDetails = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select(`
          *,
          results (*)
        `)
        .eq('id', id)
        .single()

      if (gameError) throw gameError

      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select(`
          *,
          user:profiles!participants_user_id_fkey (id, name, level),
          partner:profiles!participants_partner_id_fkey (id, name, level)
        `)
        .eq('game_id', id)
        .eq('status', 'confirmed')

      if (participantsError) throw participantsError

      setGame(gameData)
      setParticipants(participantsData || [])
    } catch (error) {
      console.error('Error loading game details:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .neq('id', user.id)
        .order('name')

      if (error) throw error
      setAllUsers(data || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const handleJoinAlone = async () => {
    try {
      const { error } = await supabase
        .from('participants')
        .insert([
          {
            game_id: id,
            user_id: user.id,
            status: 'confirmed',
            joined_alone: true
          }
        ])

      if (error) throw error
      setJoinMode(null)
      loadGameDetails()
    } catch (error) {
      console.error('Error joining game:', error)
      alert('Erro ao entrar no jogo. Tenta novamente.')
    }
  }

  const handleJoinWithPartner = async () => {
    if (!selectedPartner) {
      alert('Escolhe um parceiro')
      return
    }

    try {
      const { error } = await supabase
        .from('participants')
        .insert([
          {
            game_id: id,
            user_id: user.id,
            partner_id: selectedPartner,
            status: 'confirmed',
            joined_alone: false
          }
        ])

      if (error) throw error
      setJoinMode(null)
      setSelectedPartner('')
      loadGameDetails()
    } catch (error) {
      console.error('Error joining game:', error)
      alert('Erro ao entrar no jogo. Tenta novamente.')
    }
  }

  const handleLeaveGame = async () => {
    if (!confirm('Tens a certeza que queres sair deste jogo?')) return

    try {
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('game_id', id)
        .eq('user_id', user.id)

      if (error) throw error
      loadGameDetails()
    } catch (error) {
      console.error('Error leaving game:', error)
      alert('Erro ao sair do jogo. Tenta novamente.')
    }
  }

  const handleSubmitResult = async (e) => {
    e.preventDefault()
    
    if (participants.length < 4) {
      alert('O jogo precisa de 4 jogadores para registar resultado')
      return
    }

    try {
      const { error } = await supabase
        .from('results')
        .insert([
          {
            game_id: id,
            team1_player1_id: participants[0]?.user_id,
            team1_player2_id: participants[1]?.user_id,
            team2_player1_id: participants[2]?.user_id,
            team2_player2_id: participants[3]?.user_id,
            team1_score: parseInt(team1Score),
            team2_score: parseInt(team2Score),
            submitted_by: user.id
          }
        ])

      if (error) throw error
      
      alert('Resultado registado com sucesso!')
      setShowResultForm(false)
      setTeam1Score('')
      setTeam2Score('')
      loadGameDetails()
    } catch (error) {
      console.error('Error submitting result:', error)
      alert('Erro ao registar resultado. Tenta novamente.')
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-PT', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isUserJoined = participants.some(p => p.user_id === user.id)
  const canJoin = game?.status === 'open' && participants.length < 4 && !isUserJoined
  const canSubmitResult = game?.status === 'closed' && isUserJoined && !game?.results?.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-apple-blue"></div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Jogo não encontrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-apple-blue hover:underline"
      >
        <ArrowLeft size={20} />
        Voltar aos jogos
      </button>

      <div className="card">
        <h1 className="text-3xl font-bold text-apple-darkgray mb-4">{game.title}</h1>
        
        <div className="space-y-3 text-gray-600 mb-6">
          <div className="flex items-center gap-3">
            <Calendar size={20} />
            <span className="text-lg">{formatDate(game.date)}</span>
          </div>
          
          {game.location && (
            <div className="flex items-center gap-3">
              <MapPin size={20} />
              <span className="text-lg">{game.location}</span>
            </div>
          )}
          
          <div className="flex items-center gap-3">
            <Users size={20} />
            <span className="text-lg">
              {participants.length}/{game.max_players} jogadores confirmados
            </span>
          </div>
        </div>

        {game.status === 'closed' && (
          <div className="bg-green-100 text-green-700 px-6 py-4 rounded-2xl font-semibold text-center mb-6">
            ✓ Jogo fechado — campo reservado
          </div>
        )}

        {game.status === 'completed' && game.results?.length > 0 && (
          <div className="bg-gray-100 px-6 py-4 rounded-2xl mb-6">
            <h3 className="font-semibold text-apple-darkgray mb-2">Resultado Final:</h3>
            <p className="text-2xl font-bold text-center">
              {game.results[0].team1_score} - {game.results[0].team2_score}
            </p>
          </div>
        )}

        {/* Participants */}
        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-xl font-semibold text-apple-darkgray mb-4">Jogadores</h3>
          
          {participants.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Ainda não há jogadores inscritos</p>
          ) : (
            <div className="space-y-3">
              {participants.map((participant, index) => (
                <div key={participant.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-apple-blue text-white rounded-full flex items-center justify-center font-semibold">
                      {participant.user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-apple-darkgray">
                        {participant.user?.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        Nível: {participant.user?.level}
                      </p>
                    </div>
                    {participant.user_id === user.id && (
                      <span className="text-sm text-apple-blue font-medium">Tu</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-100 pt-6 mt-6 space-y-3">
          {canJoin && !joinMode && (
            <>
              <button
                onClick={() => setJoinMode('alone')}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <User size={20} />
                Entrar sozinho
              </button>
              <button
                onClick={() => setJoinMode('partner')}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <UserPlus size={20} />
                Entrar com parceiro
              </button>
            </>
          )}

          {joinMode === 'alone' && (
            <div className="bg-blue-50 p-6 rounded-2xl space-y-4">
              <p className="text-gray-700">
                Vais entrar sozinho. O sistema vai tentar arranjar-te um parceiro.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleJoinAlone}
                  className="btn-primary flex-1"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setJoinMode(null)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {joinMode === 'partner' && (
            <div className="bg-blue-50 p-6 rounded-2xl space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Escolhe o teu parceiro
                </label>
                <select
                  value={selectedPartner}
                  onChange={(e) => setSelectedPartner(e.target.value)}
                  className="input-field"
                >
                  <option value="">Seleciona um jogador</option>
                  {allUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleJoinWithPartner}
                  className="btn-primary flex-1"
                  disabled={!selectedPartner}
                >
                  Confirmar
                </button>
                <button
                  onClick={() => {
                    setJoinMode(null)
                    setSelectedPartner('')
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {isUserJoined && game.status === 'open' && (
            <button
              onClick={handleLeaveGame}
              className="w-full py-4 px-8 rounded-2xl font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              Sair do jogo
            </button>
          )}

          {canSubmitResult && !showResultForm && (
            <button
              onClick={() => setShowResultForm(true)}
              className="btn-primary w-full"
            >
              Registar resultado
            </button>
          )}

          {showResultForm && (
            <form onSubmit={handleSubmitResult} className="bg-blue-50 p-6 rounded-2xl space-y-4">
              <h4 className="font-semibold text-apple-darkgray">Registar resultado</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Equipa 1
                  </label>
                  <input
                    type="number"
                    value={team1Score}
                    onChange={(e) => setTeam1Score(e.target.value)}
                    className="input-field"
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Equipa 2
                  </label>
                  <input
                    type="number"
                    value={team2Score}
                    onChange={(e) => setTeam2Score(e.target.value)}
                    className="input-field"
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResultForm(false)
                    setTeam1Score('')
                    setTeam2Score('')
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

