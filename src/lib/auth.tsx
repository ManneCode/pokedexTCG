// Sesión de Supabase y perfil (nombre de usuario) de quien usa la app.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createProfile, getProfile, supabase, type Profile } from './supabase'

type AuthState =
  | { status: 'disabled' } // sin Supabase configurado: solo modo local
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'needs-profile'; session: Session }
  | { status: 'ready'; session: Session; profile: Profile }
  | { status: 'error'; message: string }

type Ctx = {
  auth: AuthState
  signInWithEmail: (email: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  chooseUsername: (username: string) => Promise<void>
}

const AuthContext = createContext<Ctx | null>(null)

/** Después de iniciar sesión regresamos a la página principal. */
const redirectTo = () => `${window.location.origin}/`

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(supabase ? { status: 'loading' } : { status: 'disabled' })

  const resolve = useCallback(async (session: Session | null) => {
    if (!session) return setAuth({ status: 'signed-out' })
    try {
      const profile = await getProfile(session.user.id)
      setAuth(profile ? { status: 'ready', session, profile } : { status: 'needs-profile', session })
    } catch (e) {
      setAuth({ status: 'error', message: e instanceof Error ? e.message : 'No se pudo cargar tu perfil.' })
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => resolve(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Al refrescar el token no hace falta volver a cargar el perfil.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void resolve(session)
    })
    return () => data.subscription.unsubscribe()
  }, [resolve])

  const value: Ctx = {
    auth,
    async signInWithEmail(email) {
      const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } })
      if (error) throw error
    },
    async signInWithGoogle() {
      const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
      if (error) throw error
    },
    async signOut() {
      await supabase!.auth.signOut()
    },
    async chooseUsername(username) {
      if (auth.status !== 'needs-profile') return
      const profile = await createProfile(auth.session.user.id, username)
      setAuth({ status: 'ready', session: auth.session, profile })
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
