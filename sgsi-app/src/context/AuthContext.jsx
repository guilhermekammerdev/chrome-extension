import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Garante que exista um perfil para o usuario logado (sem depender de trigger no auth)
  useEffect(() => {
    const user = session?.user
    if (!user) { setPerfil(null); return }
    let ativo = true
    ;(async () => {
      const { data } = await supabase.from('sgsi_perfis').select('*').eq('id', user.id).maybeSingle()
      if (!ativo) return
      if (data) { setPerfil(data); return }
      const novo = {
        id: user.id,
        email: user.email,
        nome: user.user_metadata?.nome || user.email?.split('@')[0],
      }
      const { data: criado } = await supabase.from('sgsi_perfis').insert(novo).select().maybeSingle()
      if (ativo) setPerfil(criado || novo)
    })()
    return () => { ativo = false }
  }, [session])

  const value = {
    session,
    user: session?.user ?? null,
    perfil,
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, nome) =>
      supabase.auth.signUp({ email, password, options: { data: { nome } } }),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
