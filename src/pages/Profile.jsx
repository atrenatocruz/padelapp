import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Award, Trophy, Target, Flame, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { hashPhone } from '../lib/hashPhone'
import { PrimaryButton, LevelBadge, GuestBadge, DateField } from '../components/ui'

export default function Profile() {
  const { profile, updateProfile, updateMembership, currentMembership, currentOrganizationId, isGuest, signOut } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.name || '')
  const [level, setLevel] = useState(currentMembership?.level || 'iniciante')
  const [preferredSide, setPreferredSide] = useState(profile?.preferred_side || 'both')
  const [birthday, setBirthday] = useState(profile?.birthday || '')
  const [gender, setGender] = useState(profile?.gender || '')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setName(profile.name)
      setLevel(currentMembership?.level || 'iniciante')
      setPreferredSide(profile.preferred_side || 'both')
      setBirthday(profile.birthday || '')
      setGender(profile.gender || '')
      if (!isGuest && currentOrganizationId) {
        loadStats()
      }
    }
  }, [profile, currentMembership, currentOrganizationId])

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('user_id', profile.id)
        .eq('organization_id', currentOrganizationId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setPhoneError('')

    // Phone is optional — only validate/hash it if the person typed one in.
    if (phone && phone.replace(/\D/g, '').length < 9) {
      setPhoneError('Introduz um número de telemóvel válido, ou deixa em branco')
      return
    }

    setLoading(true)

    try {
      const updates = { name, preferred_side: preferredSide, birthday, gender }
      if (phone) {
        updates.phone_hash = await hashPhone(phone)
      }
      const { error: profileError } = await updateProfile(updates)
      if (profileError) throw profileError
      const { error: membershipError } = await updateMembership({ level })
      if (membershipError) throw membershipError
      setPhone('')
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Erro ao atualizar perfil')
    } finally {
      setLoading(false)
    }
  }

  const gamesPlayed = (stats?.game_wins || 0) + (stats?.game_losses || 0)
  const winRate = gamesPlayed > 0
    ? ((stats.game_wins / gamesPlayed) * 100).toFixed(0)
    : 0

  const inputLabel = 'block text-sm font-extrabold text-court-900 mb-2'
  const fieldLabel = 'text-[11px] font-extrabold uppercase tracking-widest text-muted'
  const fieldValue = 'text-base text-court-900 mt-0.5'

  // Guest view: header only — name + (Convidado) + Sair. No stats, no settings.
  if (isGuest) {
    return (
      <div className="space-y-4">
        <div className="card bg-court-900 text-center relative overflow-hidden">
          <svg
            viewBox="0 0 400 160"
            className="absolute inset-0 w-full h-full text-white/[0.05]"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <rect x="60" y="-60" width="280" height="260" rx="16" stroke="currentColor" strokeWidth="3" fill="none" />
            <line x1="200" y1="-60" x2="200" y2="200" stroke="currentColor" strokeWidth="3" />
          </svg>
          <div className="relative py-2">
            <div className="w-20 h-20 bg-volt-400 text-court-900 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl font-extrabold">
              {profile?.name?.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl text-white">
              {profile?.name} <span className="text-court-200 font-normal">(Convidado)</span>
            </h2>
            <div className="mt-2.5">
              <GuestBadge size="md" />
            </div>
          </div>
        </div>

        <PrimaryButton
          variant="ghost"
          onClick={async () => {
            await signOut()
            navigate('/login')
          }}
          className="w-full"
        >
          <LogOut size={19} />
          Sair
        </PrimaryButton>
      </div>
    )
  }

  const statTiles = stats && (gamesPlayed > 0 || (stats.mix_wins || 0) > 0) ? [
    { icon: Trophy, value: stats.mix_wins || 0, label: 'Mixes ganhos', cls: 'text-volt-500' },
    { icon: Target, value: gamesPlayed, label: 'Jogos', cls: 'text-court-600' },
    { icon: Flame, value: stats.game_wins || 0, label: 'Jogos ganhos', cls: 'text-ok' },
    { icon: Award, value: `${winRate}%`, label: 'Taxa de vitória', cls: 'text-court-600' },
  ] : null

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="card bg-court-900 text-center relative overflow-hidden">
        <svg
          viewBox="0 0 400 160"
          className="absolute inset-0 w-full h-full text-white/[0.05]"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <rect x="60" y="-60" width="280" height="260" rx="16" stroke="currentColor" strokeWidth="3" fill="none" />
          <line x1="200" y1="-60" x2="200" y2="200" stroke="currentColor" strokeWidth="3" />
        </svg>
        <div className="relative py-2">
          <div className="w-20 h-20 bg-volt-400 text-court-900 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl font-extrabold">
            {profile?.name?.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-2xl text-white">{profile?.name}</h2>
          <div className="mt-2.5">
            <LevelBadge level={currentMembership?.level} me size="md" />
          </div>
        </div>
      </div>

      {saved && (
        <div className="bg-ok/10 text-ok px-4 py-3 rounded-ctrl text-sm font-extrabold animate-fade-up">
          ✓ Perfil atualizado
        </div>
      )}

      {/* Stats */}
      {statTiles && (
        <div className="grid grid-cols-2 gap-3">
          {statTiles.map(({ icon: Icon, value, label, cls }) => (
            <div key={label} className="card text-center py-5">
              <Icon size={21} className={`mx-auto mb-1.5 ${cls}`} />
              <p className="text-2xl font-extrabold text-court-900 tabular-nums">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Personal info */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg text-court-900 flex items-center gap-2">
            <User size={20} className="text-court-600" />
            Informação pessoal
          </h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-court-600 font-extrabold text-sm min-h-[44px] px-2"
            >
              Editar
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4 animate-fade-up">
            <div>
              <label className={inputLabel}>Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className={inputLabel}>Data de nascimento</label>
              <DateField
                value={birthday}
                onChange={setBirthday}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>

            <div>
              <label className={inputLabel}>Género</label>
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
              <label className={inputLabel}>Nível de jogo</label>
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

            <div>
              <label className={inputLabel}>Nº de telemóvel</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
                placeholder={profile?.phone_hash ? 'Já associado — escreve para substituir' : '912 345 678'}
              />
              {phoneError && <p className="text-xs text-danger mt-1.5">{phoneError}</p>}
              <p className="text-xs text-muted mt-1.5">
                {profile?.phone_hash
                  ? 'Deixa em branco para manter o número atual.'
                  : 'Opcional — só é preciso se quiseres usar o bot do WhatsApp.'}
              </p>
            </div>

            <div>
              <label className={inputLabel}>Lado preferido</label>
              <select
                value={preferredSide}
                onChange={(e) => setPreferredSide(e.target.value)}
                className="input-field"
              >
                <option value="left">Esquerda</option>
                <option value="right">Direita</option>
                <option value="both">Ambos</option>
              </select>
              <p className="text-xs text-muted mt-1.5">Usado na formação de duplas dos mixes</p>
            </div>

            <div className="flex gap-3 pt-2">
              <PrimaryButton type="submit" disabled={loading} className="flex-1">
                {loading ? 'A guardar…' : 'Guardar'}
              </PrimaryButton>
              <PrimaryButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(false)
                  setName(profile.name)
                  setLevel(currentMembership?.level || 'iniciante')
                  setBirthday(profile.birthday || '')
                  setGender(profile.gender || '')
                  setPhone('')
                  setPhoneError('')
                }}
                className="flex-1"
              >
                Cancelar
              </PrimaryButton>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <p className={fieldLabel}>Nome</p>
              <p className={fieldValue}>{profile?.name}</p>
            </div>

            <div>
              <p className={fieldLabel}>Email</p>
              <p className={fieldValue}>{profile?.email}</p>
            </div>

            <div>
              <p className={fieldLabel}>Data de nascimento</p>
              <p className={fieldValue}>
                {profile?.birthday ? new Date(profile.birthday).toLocaleDateString('pt-PT') : 'Não definido'}
              </p>
            </div>

            <div>
              <p className={fieldLabel}>Género</p>
              <p className={fieldValue}>
                {profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Não definido'}
              </p>
            </div>

            <div>
              <p className={fieldLabel}>Nº de telemóvel</p>
              <p className={fieldValue}>{profile?.phone_hash ? 'Associado ✓' : 'Não associado'}</p>
            </div>

            <div>
              <p className={fieldLabel}>Nível de jogo</p>
              <p className={fieldValue}>{currentMembership?.level}</p>
            </div>

            <div>
              <p className={fieldLabel}>Lado preferido</p>
              <p className={fieldValue}>
                {{ left: 'Esquerda', right: 'Direita', both: 'Ambos' }[profile?.preferred_side] || 'Ambos'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
