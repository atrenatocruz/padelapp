import { useState, useEffect } from 'react'
import { User, Award, Trophy, Target } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const { profile, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [level, setLevel] = useState(profile?.level || 'iniciante')
  const [birthday, setBirthday] = useState(profile?.birthday || '')
  const [gender, setGender] = useState(profile?.gender || '')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setPhone(profile.phone || '')
      setLevel(profile.level)
      setBirthday(profile.birthday || '')
      setGender(profile.gender || '')
      loadStats()
    }
  }, [profile])

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('user_id', profile.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await updateProfile({ name, phone, level, birthday, gender })
      if (error) throw error
      setEditing(false)
      alert('Perfil atualizado com sucesso!')
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Erro ao atualizar perfil')
    } finally {
      setLoading(false)
    }
  }

  const winRate = stats?.games_played > 0
    ? ((stats.games_won / stats.games_played) * 100).toFixed(1)
    : 0

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-24 h-24 bg-apple-blue text-white rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-bold">
          {profile?.name?.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-3xl font-bold text-apple-darkgray">{profile?.name}</h2>
        <p className="text-gray-600 mt-1">Nível: {profile?.level}</p>
      </div>

      {/* Stats Card */}
      {stats && stats.games_played > 0 && (
        <div className="card">
          <h3 className="text-xl font-semibold text-apple-darkgray mb-4 flex items-center gap-2">
            <Trophy size={24} className="text-yellow-500" />
            Estatísticas
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <Target size={24} className="mx-auto text-apple-blue mb-2" />
              <p className="text-2xl font-bold text-apple-darkgray">{stats.games_played}</p>
              <p className="text-sm text-gray-600">Jogos</p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <Trophy size={24} className="mx-auto text-yellow-500 mb-2" />
              <p className="text-2xl font-bold text-apple-darkgray">{stats.games_won}</p>
              <p className="text-sm text-gray-600">Vitórias</p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <Award size={24} className="mx-auto text-green-500 mb-2" />
              <p className="text-2xl font-bold text-green-600">{winRate}%</p>
              <p className="text-sm text-gray-600">Taxa de vitória</p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">🎯</div>
              <p className="text-2xl font-bold text-apple-darkgray">{stats.total_points_scored}</p>
              <p className="text-sm text-gray-600">Pontos marcados</p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Info Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-apple-darkgray flex items-center gap-2">
            <User size={24} />
            Informação Pessoal
          </h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-apple-blue font-semibold hover:underline"
            >
              Editar
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de nascimento
              </label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Género
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="input-field"
              >
                <option value="">Não especificado</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telemóvel
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
                placeholder="+351 XXX XXX XXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nível de jogo
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="input-field"
              >
                <option value="iniciante">Iniciante</option>
                <option value="intermédio">Intermédio</option>
                <option value="avançado">Avançado</option>
                <option value="N2">N2</option>
                <option value="N3">N3</option>
                <option value="N4">N4</option>
                <option value="N5">N5</option>
                <option value="N6">N6</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {loading ? 'A guardar...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setName(profile.name)
                  setPhone(profile.phone || '')
                  setLevel(profile.level)
                  setBirthday(profile.birthday || '')
                  setGender(profile.gender || '')
                }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Nome</p>
              <p className="text-lg text-apple-darkgray font-medium">{profile?.name}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-lg text-apple-darkgray font-medium">{profile?.email}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Data de nascimento</p>
              <p className="text-lg text-apple-darkgray font-medium">
                {profile?.birthday ? new Date(profile.birthday).toLocaleDateString('pt-PT') : 'Não definido'}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Género</p>
              <p className="text-lg text-apple-darkgray font-medium">
                {profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Não definido'}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Telemóvel</p>
              <p className="text-lg text-apple-darkgray font-medium">
                {profile?.phone || 'Não definido'}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Nível de jogo</p>
              <p className="text-lg text-apple-darkgray font-medium">{profile?.level}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

