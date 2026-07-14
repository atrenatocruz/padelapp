import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

// Dev-only bypass: fake admin session so we can enter the app without an account.
const MOCK_ADMIN_KEY = 'mockAdminSession'
const MOCK_ADMIN_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'admin@dev.local',
}
const MOCK_ADMIN_PROFILE = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'admin@dev.local',
  name: 'Admin (Dev)',
  gender: 'masculino',
  is_admin: true,
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore dev admin bypass if it was activated previously.
    if (import.meta.env.DEV && localStorage.getItem(MOCK_ADMIN_KEY) === 'true') {
      setUser(MOCK_ADMIN_USER)
      setProfile(MOCK_ADMIN_PROFILE)
      setLoading(false)
      return
    }

    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password, userData) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        emailRedirectTo: window.location.origin,
      }
    })
    return { data, error }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signInAsAdmin = () => {
    localStorage.setItem(MOCK_ADMIN_KEY, 'true')
    setUser(MOCK_ADMIN_USER)
    setProfile(MOCK_ADMIN_PROFILE)
    setLoading(false)
  }

  const signOut = async () => {
    // Clear dev admin bypass if active.
    if (localStorage.getItem(MOCK_ADMIN_KEY) === 'true') {
      localStorage.removeItem(MOCK_ADMIN_KEY)
      setUser(null)
      setProfile(null)
      return { error: null }
    }

    const { error } = await supabase.auth.signOut()
    if (!error) {
      setUser(null)
      setProfile(null)
    }
    return { error }
  }

  const updateProfile = async (updates) => {
    if (!user) return { error: new Error('No user logged in') }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (!error) {
      setProfile(data)
    }

    return { data, error }
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signInAsAdmin,
    signOut,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

