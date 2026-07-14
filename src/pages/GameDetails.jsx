import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, MapPin, ArrowLeft, UserPlus, User, Check, Lock, Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PrimaryButton, LevelBadge, PlayerAvatarRow, EmptyState } from '../components/ui'

export default function GameDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [game, setGame] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joinMode, setJoinMode] = useState(null) // null | 'partner'
  const [selectedPartner, setSelectedPartner] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [joinError, setJoinError] = useState('')
  const [justBooked, setJustBooked] = useState(false)
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

  const celebrate = () => {
    setJustBooked(true)
    setTimeout(() => setJustBooked(false), 1500)
  }

  // One tap, no redundant confirmation — booking should feel instant.
  const handleJoinAlone = async () => {
    setJoining(true)
    setJoinError('')
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
      celebrate()
      loadGameDetails()
    } catch (error) {
      console.error('Error joining game:', error)
      setJoinError('Não conseguimos inscrever-te. Tenta novamente.')
    } finally {
      setJoining(false)
    }
  }

  const handleJoinWithPartner = async () => {
    if (!selectedPartner) return
    setJoining(true)
    setJoinError('')
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
      celebrate()
      loadGameDetails()
    } catch (error) {
      console.error('Error joining game:', error)
      setJoinError('Não conseguimos inscrever-te. Tenta novamente.')
    } finally {
      setJoining(false)
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
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isUserJoined = participants.some(p => p.user_id === user.id)
  const canJoin = game?.status === 'open' && participants.length < 4 && !isUserJoined
  const canSubmitResult = game?.status === 'closed' && isUserJoined && !game?.results?.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-court-100 border-t-court-600"></div>
      </div>
    )
  }

  if (!game) {
    return (
      <EmptyState
        icon={Calendar}
        title="Jogo não encontrado"
        subtitle="Este jogo já não existe ou foi removido."
        action={
          <PrimaryButton variant="navy" onClick={() => navigate('/')}>
            Voltar aos jogos
          </PrimaryButton>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Booking confirmation — satisfying, brief, out of the way */}
      {justBooked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-court-900/50 animate-fade-in" aria-hidden="true">
          <div className="bg-surface rounded-card shadow-lift px-10 py-8 text-center animate-pop">
            <div className="w-16 h-16 rounded-full bg-volt-400 flex items-center justify-center mx-auto mb-3">
              <Check size={34} strokeWidth={3} className="text-court-900" />
            </div>
            <p className="font-extrabold text-lg text-court-900">Estás dentro!</p>
            <p className="text-muted text-sm">Bola ao ar 🎾</p>
          </div>
        </div>
      )}

      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-court-600 font-extrabold text-sm min-h-[44px] pr-3"
      >
        <ArrowLeft size={18} />
        Jogos
      </button>

      {/* Hero card */}
      <div className="card relative overflow-hidden">
        {isUserJoined && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-volt-400" />}

        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-2xl text-court-900 leading-tight">{game.title}</h1>
          {isUserJoined && (
            <span className="inline-flex items-center gap-1.5 bg-volt-400 text-court-900 text-xs font-extrabold px-3 py-1.5 rounded-full shrink-0">
              <Check size={14} strokeWidth={3} /> Inscrito
            </span>
          )}
        </div>

        <div className="space-y-2 text-muted mt-4">
          <div className="flex items-center gap-2.5">
            <Calendar size={18} className="text-court-600 shrink-0" />
            <span className="capitalize">{formatDate(game.date)}</span>
          </div>
          {game.location && (
            <div className="flex items-center gap-2.5">
              <MapPin size={18} className="text-court-600 shrink-0" />
              <span>{game.location}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-line">
          <PlayerAvatarRow
            players={participants.map(p => ({ id: p.user_id, name: p.user?.name }))}
            max={game.max_players}
          />
          {game.status === 'closed' && (
            <span className="inline-flex items-center gap-1.5 bg-ok/10 text-ok text-xs font-extrabold px-3 py-1.5 rounded-full">
              <Lock size={14} /> Campo reservado
            </span>
          )}
        </div>
      </div>

      {/* Final result */}
      {game.status === 'completed' && game.results?.length > 0 && (
        <div className="card bg-court-900 text-center">
          <p className="text-court-200 text-xs font-extrabold uppercase tracking-widest mb-2">Resultado final</p>
          <p className="text-4xl font-extrabold text-white tabular-nums">
            {game.results[0].team1_score} <span className="text-court-200">–</span> {game.results[0].team2_score}
          </p>
        </div>
      )}

      {/* Players */}
      <div className="card">
        <h3 className="text-lg text-court-900 mb-4">Jogadores</h3>

        {participants.length === 0 ? (
          <p className="text-muted text-sm text-center py-4">
            Sê o primeiro a inscrever-te 🎾
          </p>
        ) : (
          <div className="space-y-2.5">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className={`rounded-ctrl p-3.5 flex items-center gap-3 ${
                  participant.user_id === user.id ? 'bg-volt-400/20' : 'bg-sand'
                }`}
              >
                <div className="w-10 h-10 bg-court-600 text-white rounded-full flex items-center justify-center font-extrabold shrink-0">
                  {participant.user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-court-900 truncate">
                    {participant.user?.name}
                    {participant.user_id === user.id && (
                      <span className="text-muted font-normal text-sm"> · tu</span>
                    )}
                  </p>
                </div>
                <LevelBadge level={participant.user?.level} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {joinError && (
          <div className="bg-danger/10 text-danger px-4 py-3 rounded-ctrl text-sm font-extrabold animate-fade-up">
            {joinError}
          </div>
        )}

        {canJoin && !joinMode && (
          <>
            <PrimaryButton
              onClick={handleJoinAlone}
              disabled={joining}
              className="w-full"
            >
              <User size={19} />
              {joining ? 'A inscrever…' : 'Entrar sozinho'}
            </PrimaryButton>
            <PrimaryButton
              variant="ghost"
              onClick={() => setJoinMode('partner')}
              disabled={joining}
              className="w-full"
            >
              <UserPlus size={19} />
              Entrar com parceiro
            </PrimaryButton>
          </>
        )}

        {joinMode === 'partner' && (
          <div className="card space-y-4 animate-fade-up">
            <div>
              <label className="block text-sm font-extrabold text-court-900 mb-2">
                Escolhe o teu parceiro
              </label>
              <select
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
                className="input-field"
              >
                <option value="">Seleciona um jogador</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <PrimaryButton
                onClick={handleJoinWithPartner}
                disabled={!selectedPartner || joining}
                className="flex-1"
              >
                {joining ? 'A inscrever…' : 'Confirmar'}
              </PrimaryButton>
              <PrimaryButton
                variant="ghost"
                onClick={() => {
                  setJoinMode(null)
                  setSelectedPartner('')
                }}
                className="flex-1"
              >
                Cancelar
              </PrimaryButton>
            </div>
          </div>
        )}

        {isUserJoined && game.status === 'open' && (
          <PrimaryButton variant="danger" onClick={handleLeaveGame} className="w-full">
            Sair do jogo
          </PrimaryButton>
        )}

        {canSubmitResult && !showResultForm && (
          <PrimaryButton variant="navy" onClick={() => setShowResultForm(true)} className="w-full">
            <Trophy size={19} />
            Registar resultado
          </PrimaryButton>
        )}

        {showResultForm && (
          <form onSubmit={handleSubmitResult} className="card space-y-4 animate-fade-up">
            <h4 className="font-extrabold text-court-900">Registar resultado</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-extrabold text-court-900 mb-2">
                  Equipa 1
                </label>
                <input
                  type="number"
                  value={team1Score}
                  onChange={(e) => setTeam1Score(e.target.value)}
                  className="input-field text-center text-2xl font-extrabold"
                  placeholder="0"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-extrabold text-court-900 mb-2">
                  Equipa 2
                </label>
                <input
                  type="number"
                  value={team2Score}
                  onChange={(e) => setTeam2Score(e.target.value)}
                  className="input-field text-center text-2xl font-extrabold"
                  placeholder="0"
                  min="0"
                  required
                />
              </div>
            </div>
            <div className="flex gap-3">
              <PrimaryButton type="submit" className="flex-1">
                Guardar
              </PrimaryButton>
              <PrimaryButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowResultForm(false)
                  setTeam1Score('')
                  setTeam2Score('')
                }}
                className="flex-1"
              >
                Cancelar
              </PrimaryButton>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
