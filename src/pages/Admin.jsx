import { useState, useEffect } from 'react'
import { Plus, Calendar, Users, Trash2, Edit2, Check, X, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DateTimeField } from '../components/ui'
import { totalRounds, FORMAT_LABEL } from '../lib/mixLogic'

// datetime-local <-> stored timestamptz helpers (keeps Portugal wall-clock)
const toLocalInput = (d) => {
  const dt = new Date(d)
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const COURT_TIMES = [
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
  { value: 150, label: '2h30' },
  { value: 180, label: '3h' },
]
const GAME_TIMES = [
  { value: 10, label: '10min' },
  { value: 15, label: '15min' },
  { value: 20, label: '20min' },
  { value: 30, label: '30min' },
]
const FORMATS = [
  { value: 'sobe_desce', label: 'Sobe e desce' },
  { value: 'todos_contra_todos', label: 'Todos contra todos' },
]

const EMPTY_GAME_FORM = {
  title: '',
  date: '',
  location: '',
  num_courts: 1,
  court_time_minutes: 90,
  game_time_minutes: 20,
  format: 'sobe_desce',
}

/* Segmented tab selector for form options */
function Segmented({ options, value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-2 min-h-[44px] rounded-ctrl text-sm font-extrabold transition-all duration-fast ${
            value === opt.value
              ? 'bg-court-900 text-white'
              : 'bg-surface text-muted border border-line hover:text-court-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function Admin() {
  const { profile: currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState('games') // 'games', 'members', 'settings'
  const [games, setGames] = useState([])
  const [members, setMembers] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateGame, setShowCreateGame] = useState(false)
  const [editingGame, setEditingGame] = useState(null)

  // Form states
  const [gameForm, setGameForm] = useState(EMPTY_GAME_FORM)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'games') {
        await loadGames()
      } else if (activeTab === 'members') {
        await loadMembers()
      } else if (activeTab === 'settings') {
        await loadSettings()
      }
    } finally {
      setLoading(false)
    }
  }

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
            status
          )
        `)
        .order('date', { ascending: false })

      if (error) {
        console.error('Error loading games:', error)
        throw error
      }
      
      console.log('Admin games loaded:', data)
      setGames(data || [])
    } catch (error) {
      console.error('Error in loadGames:', error)
      alert('Erro ao carregar jogos: ' + error.message)
    }
  }

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        player_stats (*)
      `)
      .eq('is_guest', false)
      .order('name')

    if (error) {
      console.error('Error loading members:', error)
      return
    }
    setMembers(data || [])
  }

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single()

    if (error) {
      console.error('Error loading settings:', error)
      return
    }
    setSettings(data)
  }

  const handleCreateGame = async (e) => {
    e.preventDefault()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      console.log('Creating game with data:', {
        ...gameForm,
        created_by: user.id,
        status: 'open'
      })
      
      const { data, error } = await supabase
        .from('games')
        .insert([
          {
            ...gameForm,
            // datetime-local is Portugal wall-clock; store the real instant
            date: new Date(gameForm.date).toISOString(),
            max_players: gameForm.num_courts * 4, // derived
            created_by: user.id,
            status: 'open'
          }
        ])
        .select()

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      console.log('Game created successfully:', data)
      setShowCreateGame(false)
      setGameForm(EMPTY_GAME_FORM)
      loadGames()
    } catch (error) {
      console.error('Error creating game:', error)
      alert('Erro ao criar jogo: ' + error.message)
    }
  }

  const handleUpdateGame = async (e) => {
    e.preventDefault()
    
    try {
      const { error } = await supabase
        .from('games')
        .update({
          ...gameForm,
          date: new Date(gameForm.date).toISOString(),
          max_players: gameForm.num_courts * 4,
        })
        .eq('id', editingGame.id)

      if (error) throw error

      setEditingGame(null)
      setGameForm(EMPTY_GAME_FORM)
      loadGames()
    } catch (error) {
      console.error('Error updating game:', error)
      alert('Erro ao atualizar jogo')
    }
  }

  const handleDeleteGame = async (gameId) => {
    if (!confirm('Tens a certeza que queres eliminar este jogo?')) return

    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId)

      if (error) throw error

      alert('Jogo eliminado com sucesso!')
      loadGames()
    } catch (error) {
      console.error('Error deleting game:', error)
      alert('Erro ao eliminar jogo')
    }
  }

  const handleToggleAdmin = async (userId, currentStatus) => {
    try {
      const { error } = await supabase.rpc('admin_set_admin', {
        p_user_id: userId,
        p_is_admin: !currentStatus,
      })

      if (error) throw error

      alert('Permissões atualizadas com sucesso!')
      loadMembers()
    } catch (error) {
      console.error('Error updating admin status:', error)
      alert('Erro ao atualizar permissões: ' + error.message)
    }
  }

  const handleDeleteUser = async (member) => {
    if (!confirm(
      `Remover ${member.name} permanentemente?\n\n` +
      `Isto apaga a conta e todo o histórico deste jogador (inscrições, duplas, estatísticas). ` +
      `Não pode ser revertido.`
    )) return

    try {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: member.id })
      if (error) throw error
      loadMembers()
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Erro ao remover utilizador: ' + error.message)
    }
  }

  const handleUpdateSettings = async (e) => {
    e.preventDefault()
    
    try {
      const { error } = await supabase
        .from('settings')
        .update({
          robot_contact: settings.robot_contact,
          group_name: settings.group_name,
          points_rules: settings.points_rules
        })
        .eq('id', settings.id)

      if (error) throw error

      alert('Definições atualizadas com sucesso!')
    } catch (error) {
      console.error('Error updating settings:', error)
      alert('Erro ao atualizar definições')
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const startEditGame = (game) => {
    setEditingGame(game)
    setGameForm({
      title: game.title,
      date: toLocalInput(game.date),
      location: game.location || '',
      num_courts: game.num_courts || 1,
      court_time_minutes: game.court_time_minutes || 90,
      game_time_minutes: game.game_time_minutes || 20,
      format: game.format || 'sobe_desce',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-apple-darkgray">Painel Admin</h2>
        <p className="text-gray-600 mt-1">Gerir jogos, membros e definições</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('games')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
            activeTab === 'games'
              ? 'bg-apple-blue text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Calendar className="inline mr-2" size={20} />
          Jogos
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
            activeTab === 'members'
              ? 'bg-apple-blue text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Users className="inline mr-2" size={20} />
          Membros
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-apple-blue text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Definições
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-apple-blue"></div>
        </div>
      ) : (
        <>
          {/* Games Tab */}
          {activeTab === 'games' && (
            <div className="space-y-4">
              <button
                onClick={() => setShowCreateGame(true)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Criar novo jogo
              </button>

              {/* Create/Edit Game Form */}
              {(showCreateGame || editingGame) && (
                <div className="card bg-blue-50 border-2 border-blue-200">
                  <h3 className="text-xl font-semibold text-apple-darkgray mb-4">
                    {editingGame ? 'Editar jogo' : 'Criar novo jogo'}
                  </h3>
                  <form onSubmit={editingGame ? handleUpdateGame : handleCreateGame} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Título
                      </label>
                      <input
                        type="text"
                        value={gameForm.title}
                        onChange={(e) => setGameForm({ ...gameForm, title: e.target.value })}
                        className="input-field"
                        placeholder="Mix de domingo"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data e hora
                      </label>
                      <DateTimeField
                        value={gameForm.date}
                        onChange={(v) => setGameForm({ ...gameForm, date: v })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Local
                      </label>
                      <input
                        type="text"
                        value={gameForm.location}
                        onChange={(e) => setGameForm({ ...gameForm, location: e.target.value })}
                        className="input-field"
                        placeholder="Clube de Padel"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Número de campos
                      </label>
                      <input
                        type="number"
                        value={gameForm.num_courts}
                        onChange={(e) => setGameForm({ ...gameForm, num_courts: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="input-field"
                        min="1"
                        max="6"
                        required
                      />
                      <p className="text-sm text-muted mt-1.5">
                        = <strong className="text-court-900">{(gameForm.num_courts || 1) * 4} jogadores</strong> ({gameForm.num_courts || 1} {gameForm.num_courts === 1 ? 'campo' : 'campos'} × 4)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tempo do court
                      </label>
                      <Segmented
                        options={COURT_TIMES}
                        value={gameForm.court_time_minutes}
                        onChange={(v) => setGameForm({ ...gameForm, court_time_minutes: v })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tempo de jogo
                      </label>
                      <Segmented
                        options={GAME_TIMES}
                        value={gameForm.game_time_minutes}
                        onChange={(v) => setGameForm({ ...gameForm, game_time_minutes: v })}
                      />
                      <p className="text-sm text-muted mt-1.5">
                        = <strong className="text-court-900">{totalRounds(gameForm)} rondas</strong> ({gameForm.court_time_minutes}min ÷ {gameForm.game_time_minutes}min)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Formato
                      </label>
                      <Segmented
                        options={FORMATS}
                        value={gameForm.format}
                        onChange={(v) => setGameForm({ ...gameForm, format: v })}
                      />
                    </div>

                    <div className="flex gap-3">
                      <button type="submit" className="btn-primary flex-1">
                        {editingGame ? 'Atualizar' : 'Criar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateGame(false)
                          setEditingGame(null)
                          setGameForm(EMPTY_GAME_FORM)
                        }}
                        className="btn-secondary flex-1"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Games List */}
              <div className="space-y-3">
                {games.map(game => {
                  const peopleCount = (game.participants || [])
                    .filter(p => p.status === 'confirmed')
                    .reduce((n, p) => n + 1 + (p.partner_id ? 1 : 0), 0)

                  return (
                    <div key={game.id} className="card">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-apple-darkgray mb-2">
                            {game.title}
                          </h3>
                          <div className="space-y-1 text-gray-600">
                            <p>{formatDate(game.date)}</p>
                            {game.location && <p>📍 {game.location}</p>}
                            <p>
                              👥 {peopleCount}/{game.max_players || (game.num_courts || 1) * 4} jogadores
                            </p>
                            <p className="text-sm">
                              {FORMAT_LABEL[game.format] || 'Sobe e desce'} • {game.num_courts || 1} {(game.num_courts || 1) === 1 ? 'campo' : 'campos'} • {totalRounds(game)} rondas
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditGame(game)}
                            className="p-2 text-apple-blue hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={20} />
                          </button>
                          <button
                            onClick={() => handleDeleteGame(game.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>

                      <div className={`inline-block px-4 py-2 rounded-xl font-medium ${
                        game.status === 'open' ? 'bg-blue-100 text-blue-700' :
                        game.status === 'closed' ? 'bg-green-100 text-green-700' :
                        game.status === 'in_progress' ? 'bg-volt-400 text-court-900' :
                        game.status === 'completed' || game.status === 'finished' ? 'bg-gray-100 text-gray-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {game.status === 'open' && 'Aberto'}
                        {game.status === 'closed' && 'Mix fechado — campo reservado'}
                        {game.status === 'in_progress' && 'A decorrer'}
                        {(game.status === 'completed' || game.status === 'finished') && 'Terminado'}
                        {game.status === 'cancelled' && 'Cancelado'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              <div className="card bg-blue-50">
                <p className="text-gray-700">
                  <strong>Total de membros:</strong> {members.length}
                </p>
              </div>

              {members.map(member => (
                <div key={member.id} className="card">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 bg-court-600 text-white rounded-full flex items-center justify-center font-extrabold shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-court-900 truncate flex items-center gap-1.5">
                        <span className="truncate">{member.name}</span>
                        {member.is_admin && (
                          <span className="w-2 h-2 rounded-full bg-volt-500 shrink-0" title="Admin" />
                        )}
                      </h3>
                      <p className="text-sm text-muted truncate">
                        Nível: {member.level} • {member.phone || 'Sem contacto'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleAdmin(member.id, member.is_admin)}
                        className="whitespace-nowrap text-xs font-extrabold px-3 py-2 min-h-[44px] rounded-full bg-court-100 text-court-700 hover:bg-court-200 transition-colors duration-fast"
                      >
                        {member.is_admin ? 'Retirar admin' : 'Tornar admin'}
                      </button>
                      {member.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(member)}
                          title={`Eliminar ${member.name}`}
                          className="w-10 h-10 flex items-center justify-center rounded-full text-danger hover:bg-danger/10 transition-colors duration-fast"
                        >
                          <UserX size={19} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && settings && (
            <div className="card">
              <h3 className="text-xl font-semibold text-apple-darkgray mb-6">
                Definições do Grupo
              </h3>
              
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do grupo
                  </label>
                  <input
                    type="text"
                    value={settings.group_name}
                    onChange={(e) => setSettings({ ...settings, group_name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contacto do Robot (placeholder)
                  </label>
                  <input
                    type="text"
                    value={settings.robot_contact}
                    onChange={(e) => setSettings({ ...settings, robot_contact: e.target.value })}
                    className="input-field"
                    placeholder="+351 XXX XXX XXX"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Número de contacto para notificações futuras (não ativo)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo do grupo (em breve)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center text-gray-500">
                    Funcionalidade de upload em desenvolvimento
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <h4 className="text-base font-semibold text-apple-darkgray mt-6 mb-1">
                    Sistema de pontos
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Pontos atribuídos a cada jogador quando um mix é finalizado. Alterar
                    estes valores só afeta mixes finalizados a partir de agora.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Por jogo disputado
                      </label>
                      <input
                        type="number" min="0"
                        value={settings.points_rules?.point_per_match_played ?? 0}
                        onChange={(e) => setSettings({
                          ...settings,
                          points_rules: { ...settings.points_rules, point_per_match_played: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Por jogo ganho
                      </label>
                      <input
                        type="number" min="0"
                        value={settings.points_rules?.point_per_match_win ?? 0}
                        onChange={(e) => setSettings({
                          ...settings,
                          points_rules: { ...settings.points_rules, point_per_match_win: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Por participar num mix
                      </label>
                      <input
                        type="number" min="0"
                        value={settings.points_rules?.point_per_mix_participation ?? 0}
                        onChange={(e) => setSettings({
                          ...settings,
                          points_rules: { ...settings.points_rules, point_per_mix_participation: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Por ganhar o mix
                      </label>
                      <input
                        type="number" min="0"
                        value={settings.points_rules?.point_per_mix_win ?? 0}
                        onChange={(e) => setSettings({
                          ...settings,
                          points_rules: { ...settings.points_rules, point_per_mix_win: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full">
                  Guardar definições
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}

