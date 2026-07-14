import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, MapPin, ArrowLeft, UserPlus, User, Check, Lock, Trophy, Play, ChevronRight, Swords } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { PrimaryButton, LevelBadge, GuestBadge, PlayerAvatarRow, EmptyState } from '../components/ui'
import {
  countPeople, totalRounds, formDuplas, seedCourts, nextSobeDesce,
  roundRobin, standings, eliminationPhases, firstElimMatches, nextElimMatches,
  PHASE_LABEL, FORMAT_LABEL,
} from '../lib/mixLogic'

export default function GameDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, isGuest } = useAuth()
  const [game, setGame] = useState(null)
  const [participants, setParticipants] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joinMode, setJoinMode] = useState(null) // null | 'partner'
  const [selectedPartner, setSelectedPartner] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [joinError, setJoinError] = useState('')
  const [justBooked, setJustBooked] = useState(false)
  const [mixError, setMixError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scores, setScores] = useState({}) // matchId -> {a, b}

  const isAdmin = profile?.is_admin === true

  useEffect(() => {
    loadGameDetails()
    loadAllUsers()

    // Subscribe to updates
    const subscription = supabase
      .channel(`game_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `game_id=eq.${id}` }, () => {
        loadGameDetails()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `game_id=eq.${id}` }, () => {
        loadGameDetails()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, () => {
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
      setGame(gameData)

      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select(`
          *,
          user:profiles!participants_user_id_fkey (id, name, level, is_guest, preferred_side),
          partner:profiles!participants_partner_id_fkey (id, name, level, is_guest, preferred_side)
        `)
        .eq('game_id', id)
        .eq('status', 'confirmed')

      if (participantsError) throw participantsError

      // Mix data (duplas + jogos sorteados)
      const { data: teamsData } = await supabase
        .from('teams')
        .select(`
          *,
          player1:profiles!teams_player1_id_fkey (id, name, is_guest),
          player2:profiles!teams_player2_id_fkey (id, name, is_guest)
        `)
        .eq('game_id', id)

      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .eq('game_id', id)
        .order('round_number')
        .order('court_number')

      setParticipants(participantsData || [])
      setTeams(teamsData || [])
      setMatches(matchesData || [])
    } catch (error) {
      console.error('Error loading game details:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllUsers = async () => {
    try {
      // Partner picker is a global player list — guests never appear in it
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('is_guest', false)
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
      // (a DB trigger reopens the game if it was closed and a slot freed up)
      loadGameDetails()
    } catch (error) {
      console.error('Error leaving game:', error)
      alert('Erro ao sair do jogo. Tenta novamente.')
    }
  }

  /* ─── Mix engine actions (admin) ──────────────────────────────────── */

  const handleStartMix = async () => {
    setBusy(true)
    setMixError('')
    try {
      // seeds from current stats
      const playerIds = participants.flatMap(p => [p.user_id, p.partner_id]).filter(Boolean)
      const { data: statsRows } = await supabase
        .from('player_stats')
        .select('user_id, mix_wins, game_wins, game_losses')
        .in('user_id', playerIds)
      const statsById = Object.fromEntries((statsRows || []).map(s => [s.user_id, s]))

      // 4.1 formação de duplas
      const duplas = formDuplas(participants, statsById)
      if (duplas.length < 2) throw new Error('São precisas pelo menos 2 duplas')

      const { data: insertedTeams, error: teamsError } = await supabase
        .from('teams')
        .insert(duplas.map(d => ({
          game_id: id,
          player1_id: d.player1.id,
          player2_id: d.player2.id,
          seed_ranking: d.seed,
        })))
        .select()
      if (teamsError) throw teamsError

      // 4.3 sorteio conforme o formato
      const numCourts = game.num_courts || 1
      let rows
      if ((game.format || 'sobe_desce') === 'sobe_desce') {
        rows = seedCourts(insertedTeams, numCourts).map(m => ({ ...m, game_id: id, round_number: 1, phase: 'group' }))
      } else {
        const orderedIds = [...insertedTeams]
          .sort((a, b) => (b.seed_ranking ?? 0) - (a.seed_ranking ?? 0))
          .map(t => t.id)
        rows = roundRobin(orderedIds, numCourts, totalRounds(game))
          .flatMap((round, i) => round.map(m => ({ ...m, game_id: id, round_number: i + 1, phase: 'group' })))
      }

      const { error: matchesError } = await supabase.from('matches').insert(rows)
      if (matchesError) throw matchesError

      const { error: statusError } = await supabase
        .from('games')
        .update({ status: 'in_progress' })
        .eq('id', id)
      if (statusError) throw statusError

      loadGameDetails()
    } catch (error) {
      console.error('Error starting mix:', error)
      setMixError(error.message || 'Erro ao começar o jogo')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveScore = async (match) => {
    const s = scores[match.id] || {}
    const a = parseInt(s.a, 10)
    const b = parseInt(s.b, 10)
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) return
    if (a === b) {
      setMixError('Não existem empates — o resultado tem de ter um vencedor.')
      return
    }
    setMixError('')
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          score_a: a,
          score_b: b,
          winner_team_id: a > b ? match.team_a_id : match.team_b_id,
        })
        .eq('id', match.id)
      if (error) throw error
      setScores(prev => ({ ...prev, [match.id]: undefined }))
      loadGameDetails()
    } catch (error) {
      console.error('Error saving score:', error)
      setMixError('Erro ao guardar o resultado')
    }
  }

  // Derived tournament state
  const roundsTotal = game ? totalRounds(game) : 0
  const numCourts = game?.num_courts || 1
  const maxRound = matches.length ? Math.max(...matches.map(m => m.round_number)) : 0
  const currentRoundMatches = matches.filter(m => m.round_number === maxRound)
  const currentRoundDone = currentRoundMatches.length > 0 && currentRoundMatches.every(m => m.winner_team_id)
  const allDone = matches.length > 0 && matches.every(m => m.winner_team_id)
  const isSobeDesce = (game?.format || 'sobe_desce') === 'sobe_desce'
  const groupRounds = isSobeDesce ? roundsTotal : Math.min(Math.max(teams.length - 1, 1), roundsTotal)
  const elimPhases = isSobeDesce ? [] : eliminationPhases(teams.length, roundsTotal - groupRounds)
  const existingElim = [...new Set(matches.filter(m => m.phase !== 'group').map(m => m.phase))]
  const nextPhase = elimPhases.find(ph => !existingElim.includes(ph))

  const canAdvance = isSobeDesce
    ? currentRoundDone && maxRound < roundsTotal
    : allDone && !!nextPhase
  const canFinalize = matches.length > 0 && allDone && !canAdvance

  const winnerTeamId = (() => {
    if (!allDone || !matches.length) return null
    if (isSobeDesce) {
      const last = matches.filter(m => m.round_number === maxRound && m.court_number === 1)[0]
      return last?.winner_team_id || null
    }
    const finalMatch = matches.find(m => m.phase === 'final')
    if (finalMatch) return finalMatch.winner_team_id
    return standings(teams, matches)[0]?.team?.id || null
  })()

  const handleAdvance = async () => {
    setBusy(true)
    setMixError('')
    try {
      let rows, phase
      if (isSobeDesce) {
        phase = 'group'
        rows = nextSobeDesce(currentRoundMatches, numCourts)
      } else {
        phase = nextPhase
        if (existingElim.length === 0) {
          const orderedIds = standings(teams, matches).map(s => s.team.id)
          rows = firstElimMatches(phase, orderedIds)
        } else {
          const prevPhase = existingElim[existingElim.length - 1]
          rows = nextElimMatches(matches.filter(m => m.phase === prevPhase))
        }
      }
      const { error } = await supabase.from('matches').insert(
        rows.map(m => ({ ...m, game_id: id, round_number: maxRound + 1, phase }))
      )
      if (error) throw error
      loadGameDetails()
    } catch (error) {
      console.error('Error advancing round:', error)
      setMixError(error.message || 'Erro ao avançar a ronda')
    } finally {
      setBusy(false)
    }
  }

  const handleFinalize = async () => {
    if (!winnerTeamId) return
    if (!confirm('Finalizar o mix e atualizar o ranking?')) return
    setBusy(true)
    setMixError('')
    try {
      const { error } = await supabase.rpc('finalize_mix', {
        p_game_id: id,
        p_winner_team_id: winnerTeamId,
      })
      if (error) throw error
      loadGameDetails()
    } catch (error) {
      console.error('Error finalizing mix:', error)
      setMixError(error.message || 'Erro ao finalizar o mix')
    } finally {
      setBusy(false)
    }
  }

  /* ─── Render helpers ──────────────────────────────────────────────── */

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

  const teamById = Object.fromEntries(teams.map(t => [t.id, t]))
  const teamName = (teamId) => {
    const t = teamById[teamId]
    if (!t) return '—'
    const first = (p) => p?.name?.split(' ')[0] || '?'
    return `${first(t.player1)} / ${first(t.player2)}`
  }

  // Every person in the game (rows + partners), for list + capacity
  const people = participants.flatMap(p => [
    { ...p.user, rowOwner: true, rowUserId: p.user_id },
    ...(p.partner ? [{ ...p.partner, rowOwner: false, rowUserId: p.user_id }] : []),
  ]).filter(x => x?.id)

  const peopleCount = countPeople(participants)
  const capacity = game?.max_players || numCourts * 4
  const isUserJoined = participants.some(p => p.user_id === user.id || p.partner_id === user.id)
  const canJoin = game?.status === 'open' && peopleCount < capacity && !isUserJoined
  const mixStarted = game?.status === 'in_progress' || game?.status === 'finished'
  // A full game counts as closed even if the stored status lagged behind
  // (e.g. players who joined before the auto-close trigger existed)
  const isFull = peopleCount >= capacity
  const showClosed = !mixStarted && game?.status !== 'completed' &&
    (game?.status === 'closed' || (game?.status === 'open' && isFull))
  const canStart = isAdmin && !mixStarted && showClosed
  const rounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b)
  const tctStandings = !isSobeDesce && teams.length ? standings(teams, matches) : []

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
          <div className="flex items-center gap-2.5">
            <Swords size={18} className="text-court-600 shrink-0" />
            <span>
              {FORMAT_LABEL[game.format] || 'Sobe e desce'} • {numCourts} {numCourts === 1 ? 'campo' : 'campos'} • {roundsTotal} rondas de {game.game_time_minutes || 20}min
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-line">
          <PlayerAvatarRow
            players={people.map(p => ({ id: p.id, name: p.name }))}
            max={capacity}
          />
          {showClosed && (
            <span className="inline-flex items-center gap-1.5 bg-ok/10 text-ok text-xs font-extrabold px-3 py-1.5 rounded-full">
              <Lock size={14} /> Mix fechado — campo reservado
            </span>
          )}
          {game.status === 'in_progress' && (
            <span className="inline-flex items-center gap-1.5 bg-volt-400 text-court-900 text-xs font-extrabold px-3 py-1.5 rounded-full">
              <Play size={14} /> A decorrer
            </span>
          )}
        </div>
      </div>

      {/* Winner (mix finalizado) */}
      {game.status === 'finished' && game.winner_team_id && (
        <div className="card bg-court-900 text-center">
          <p className="text-court-200 text-xs font-extrabold uppercase tracking-widest mb-2">🏆 Vencedores do mix</p>
          <p className="text-2xl font-extrabold text-volt-400">{teamName(game.winner_team_id)}</p>
        </div>
      )}

      {/* Legacy result (jogos antigos) */}
      {game.status === 'completed' && game.results?.length > 0 && (
        <div className="card bg-court-900 text-center">
          <p className="text-court-200 text-xs font-extrabold uppercase tracking-widest mb-2">Resultado final</p>
          <p className="text-4xl font-extrabold text-white tabular-nums">
            {game.results[0].team1_score} <span className="text-court-200">–</span> {game.results[0].team2_score}
          </p>
        </div>
      )}

      {mixError && (
        <div className="bg-danger/10 text-danger px-4 py-3 rounded-ctrl text-sm font-extrabold animate-fade-up">
          {mixError}
        </div>
      )}

      {/* Começar o jogo (admin, mix cheio) */}
      {canStart && (
        <PrimaryButton onClick={handleStartMix} disabled={busy} className="w-full">
          <Play size={19} />
          {busy ? 'A sortear…' : 'Começar o jogo'}
        </PrimaryButton>
      )}

      {/* ─── Mix board ─────────────────────────────────────────────── */}
      {mixStarted && (
        <>
          {/* Duplas */}
          <div className="card">
            <h3 className="text-lg text-court-900 mb-3">Duplas</h3>
            <div className="space-y-2">
              {teams.map((t, i) => (
                <div key={t.id} className={`flex items-center gap-3 rounded-ctrl p-3 ${
                  t.id === game.winner_team_id ? 'bg-volt-400/20' : 'bg-sand'
                }`}>
                  <span className="w-7 h-7 rounded-full bg-court-600 text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <p className="flex-1 font-extrabold text-court-900 truncate">
                    {teamName(t.id)}
                    {t.id === game.winner_team_id && ' 🏆'}
                  </p>
                  {(t.player1?.is_guest || t.player2?.is_guest) && <GuestBadge />}
                </div>
              ))}
            </div>
          </div>

          {/* Classificação (todos contra todos) */}
          {!isSobeDesce && tctStandings.length > 0 && (
            <div className="card">
              <h3 className="text-lg text-court-900 mb-3">Classificação — fase de grupo</h3>
              <div className="space-y-1.5">
                {tctStandings.map((s, i) => (
                  <div key={s.team.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-line last:border-0">
                    <span className="w-6 font-extrabold text-court-900 tabular-nums">{i + 1}</span>
                    <span className="flex-1 font-extrabold text-court-900 truncate">{teamName(s.team.id)}</span>
                    <span className="text-muted tabular-nums" title="Vitórias">{s.wins}V</span>
                    <span className="text-muted tabular-nums w-12 text-right" title="Diferença de pontos">
                      {s.diff > 0 ? '+' : ''}{s.diff}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rondas */}
          {rounds.map(r => {
            const ms = matches.filter(m => m.round_number === r)
            const phase = ms[0]?.phase || 'group'
            const isCurrent = r === maxRound && game.status === 'in_progress'
            return (
              <div key={r} className={`card ${isCurrent ? 'ring-2 ring-volt-400' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg text-court-900">
                    Ronda {r}
                    {phase !== 'group' && (
                      <span className="ml-2 text-xs font-extrabold uppercase tracking-wide bg-court-900 text-volt-400 px-2.5 py-1 rounded-full">
                        {PHASE_LABEL[phase]}
                      </span>
                    )}
                  </h3>
                  {isCurrent && <span className="text-xs font-extrabold text-court-600">RONDA ATUAL</span>}
                </div>

                <div className="space-y-2.5">
                  {ms.map(m => {
                    const done = !!m.winner_team_id
                    const s = scores[m.id] || { a: '', b: '' }
                    return (
                      <div key={m.id} className="rounded-ctrl bg-sand p-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted mb-1.5">
                          Campo {m.court_number}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`flex-1 text-sm font-extrabold truncate ${done && m.winner_team_id === m.team_a_id ? 'text-court-900' : done ? 'text-muted' : 'text-court-900'}`}>
                            {teamName(m.team_a_id)}
                          </span>

                          {done ? (
                            <span className="font-extrabold text-court-900 tabular-nums px-2">
                              {m.score_a} – {m.score_b}
                            </span>
                          ) : isAdmin && game.status === 'in_progress' ? (
                            <span className="flex items-center gap-1.5">
                              <input
                                type="number" min="0" inputMode="numeric"
                                value={s.a}
                                onChange={e => setScores(prev => ({ ...prev, [m.id]: { ...s, a: e.target.value } }))}
                                className="w-14 px-2 py-2 text-center font-extrabold rounded-ctrl border border-line bg-surface"
                                placeholder="0"
                              />
                              <span className="text-muted">–</span>
                              <input
                                type="number" min="0" inputMode="numeric"
                                value={s.b}
                                onChange={e => setScores(prev => ({ ...prev, [m.id]: { ...s, b: e.target.value } }))}
                                className="w-14 px-2 py-2 text-center font-extrabold rounded-ctrl border border-line bg-surface"
                                placeholder="0"
                              />
                            </span>
                          ) : (
                            <span className="text-muted text-sm px-2">vs</span>
                          )}

                          <span className={`flex-1 text-sm font-extrabold truncate text-right ${done && m.winner_team_id === m.team_b_id ? 'text-court-900' : done ? 'text-muted' : 'text-court-900'}`}>
                            {teamName(m.team_b_id)}
                          </span>
                        </div>

                        {!done && isAdmin && game.status === 'in_progress' && s.a !== '' && s.b !== '' && (
                          <button
                            onClick={() => handleSaveScore(m)}
                            className="mt-2.5 w-full py-2 rounded-ctrl bg-court-900 text-volt-400 text-sm font-extrabold transition-all duration-fast active:scale-[0.98]"
                          >
                            Guardar resultado
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Controlo de rondas (admin) */}
          {isAdmin && game.status === 'in_progress' && (
            <div className="space-y-3">
              {canAdvance && (
                <PrimaryButton onClick={handleAdvance} disabled={busy} className="w-full">
                  <ChevronRight size={19} />
                  {busy ? 'A sortear…'
                    : isSobeDesce ? `Avançar para a ronda ${maxRound + 1}`
                    : `Sortear ${PHASE_LABEL[nextPhase]?.toLowerCase()}`}
                </PrimaryButton>
              )}
              {canFinalize && (
                <PrimaryButton variant="navy" onClick={handleFinalize} disabled={busy} className="w-full">
                  <Trophy size={19} />
                  {busy ? 'A finalizar…' : 'Finalizar jogo'}
                </PrimaryButton>
              )}
              {!canAdvance && !canFinalize && (
                <p className="text-muted text-sm text-center">
                  Regista os resultados da ronda {maxRound} para continuar
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Jogadores (antes do sorteio) */}
      {!mixStarted && (
        <div className="card">
          <h3 className="text-lg text-court-900 mb-4">Jogadores</h3>

          {people.length === 0 ? (
            <p className="text-muted text-sm text-center py-4">
              Sê o primeiro a inscrever-te 🎾
            </p>
          ) : (
            <div className="space-y-2.5">
              {people.map((person, idx) => (
                <div
                  key={`${person.id}-${idx}`}
                  className={`rounded-ctrl p-3.5 flex items-center gap-3 ${
                    person.id === user.id ? 'bg-volt-400/20' : 'bg-sand'
                  }`}
                >
                  <div className="w-10 h-10 bg-court-600 text-white rounded-full flex items-center justify-center font-extrabold shrink-0">
                    {person.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-court-900 truncate">
                      {person.name}
                      {person.id === user.id && (
                        <span className="text-muted font-normal text-sm"> · tu</span>
                      )}
                    </p>
                  </div>
                  {person.is_guest
                    ? <GuestBadge />
                    : <LevelBadge level={person.level} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ações de inscrição */}
      {!mixStarted && (
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
              {/* Guests join alone only — the partner picker is a member list */}
              {!isGuest && peopleCount + 2 <= capacity && (
                <PrimaryButton
                  variant="ghost"
                  onClick={() => setJoinMode('partner')}
                  disabled={joining}
                  className="w-full"
                >
                  <UserPlus size={19} />
                  Entrar com parceiro
                </PrimaryButton>
              )}
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
                  {allUsers
                    .filter(u => !people.some(p => p.id === u.id))
                    .map(u => (
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

          {isUserJoined && (game.status === 'open' || game.status === 'closed') && (
            <PrimaryButton variant="danger" onClick={handleLeaveGame} className="w-full">
              Sair do jogo
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  )
}
