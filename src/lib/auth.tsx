// Sesión de Supabase (correo y contraseña) y perfil (nombre de usuario) de quien usa la app.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthError, Session } from '@supabase/supabase-js'
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
  /** true al volver del link de "olvidé mi contraseña": hay que pedir la nueva. */
  recovering: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** Regresa true si Supabase pide confirmar el correo antes de entrar. */
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  sendPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  chooseUsername: (username: string) => Promise<void>
}

const AuthContext = createContext<Ctx | null>(null)

/** Los links de los correos regresan a la página principal. */
const redirectTo = () => `${window.location.origin}/`

/** Mensajes de Supabase en español para los errores más comunes. */
function friendly(error: AuthError): Error {
  const messages: Record<string, string> = {
    invalid_credentials: 'Correo o contraseña incorrectos.',
    email_not_confirmed: 'Primero confirma tu correo con el link que te mandamos.',
    user_already_exists: 'Ya hay una cuenta con ese correo. Inicia sesión.',
    weak_password: 'La contraseña es muy débil. Usa al menos 6 caracteres.',
    over_email_send_rate_limit: 'Se mandaron demasiados correos. Espera unos minutos e inténtalo de nuevo.',
    over_request_rate_limit: 'Demasiados intentos. Espera unos minutos.',
  }
  return new Error((error.code && messages[error.code]) || error.message)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(supabase ? { status: 'loading' } : { status: 'disabled' })
  const [recovering, setRecovering] = useState(false)

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
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      // Al refrescar el token no hace falta volver a cargar el perfil.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') void resolve(session)
    })
    return () => data.subscription.unsubscribe()
  }, [resolve])

  const value: Ctx = {
    auth,
    recovering,
    async signIn(email, password) {
      const { error } = await supabase!.auth.signInWithPassword({ email, password })
      if (error) throw friendly(error)
    },
    async signUp(email, password) {
      const { data, error } = await supabase!.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo() },
      })
      if (error) throw friendly(error)
      // Con un correo ya registrado Supabase no da error pero regresa un usuario sin identidades.
      if (data.user && data.user.identities?.length === 0)
        throw new Error('Ya hay una cuenta con ese correo. Inicia sesión.')
      return { needsConfirmation: !data.session }
    },
    async sendPasswordReset(email) {
      const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() })
      if (error) throw friendly(error)
    },
    async updatePassword(password) {
      const { error } = await supabase!.auth.updateUser({ password })
      if (error) throw friendly(error)
      setRecovering(false)
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
