import { useState, useEffect } from 'react'
import { Plus, Calendar, Users, Trash2, Edit2, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Admin() {
  const [activeTab, setActiveTab] = useState('games') // 'games', 'members', 'settings'
  const [games, setGames] = useState([])
  const [members, setMembers] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateGame, setShowCreateGame] = useState(false)
  const [editingGame, setEditingGame] = useState(null)
  
  // Form states
  const [gameForm, setGameForm] = useState({
    title: '',
    date: '',
    location: '',
    max_players: 4
  })

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
      alert('Jogo criado com sucesso!')
      setShowCreateGame(false)
      setGameForm({ title: '', date: '', location: '', max_players: 4 })
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
        .update(gameForm)
        .eq('id', editingGame.id)

      if (error) throw error

      alert('Jogo atualizado com sucesso!')
      setEditingGame(null)
      setGameForm({ title: '', date: '', location: '', max_players: 4 })
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
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      alert('Permissões atualizadas com sucesso!')
      loadMembers()
    } catch (error) {
      console.error('Error updating admin status:', error)
      alert('Erro ao atualizar permissões')
    }
  }

  const handleUpdateSettings = async (e) => {
    e.preventDefault()
    
    try {
      const { error } = await supabase
        .from('settings')
        .update({
          robot_contact: settings.robot_contact,
          group_name: settings.group_name
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
      date: new Date(game.date).toISOString().slice(0, 16),
      location: game.location || '',
      max_players: game.max_players
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
                      <input
                        type="datetime-local"
                        value={gameForm.date}
                        onChange={(e) => setGameForm({ ...gameForm, date: e.target.value })}
                        className="input-field"
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
                        Número máximo de jogadores
                      </label>
                      <input
                        type="number"
                        value={gameForm.max_players}
                        onChange={(e) => setGameForm({ ...gameForm, max_players: parseInt(e.target.value) })}
                        className="input-field"
                        min="2"
                        max="8"
                        required
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
                          setGameForm({ title: '', date: '', location: '', max_players: 4 })
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
                  const confirmedCount = game.participants?.filter(p => p.status === 'confirmed').length || 0
                  
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
                              👥 {confirmedCount}/{game.max_players} jogadores
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
                        game.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {game.status === 'open' && 'Aberto'}
                        {game.status === 'closed' && 'Fechado'}
                        {game.status === 'completed' && 'Terminado'}
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold text-lg">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-apple-darkgray">
                          {member.name}
                          {member.is_admin && (
                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                              Admin
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Nível: {member.level} • {member.phone || 'Sem contacto'}
                        </p>
                        {member.player_stats?.[0] && (
                          <p className="text-sm text-gray-500 mt-1">
                            {member.player_stats[0].games_played} jogos • {member.player_stats[0].games_won} vitórias
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleToggleAdmin(member.id, member.is_admin)}
                      className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                        member.is_admin
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {member.is_admin ? 'Remover admin' : 'Tornar admin'}
                    </button>
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

