import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { MIN_PASSWORD } from '../lib/supabase'
import Dialog from './Dialog'

type View = 'sign-in' | 'sign-up' | 'reset'

const TITLES: Record<View, string> = {
  'sign-in': 'Inicia sesión',
  'sign-up': 'Crea tu cuenta',
  reset: 'Recupera tu contraseña',
}

export default function LoginDialog({ onClose }: { onClose: () => void }) {
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const [view, setView] = useState<View>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function go(next: View) {
    setView(next)
    setError(null)
    setMessage(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const mail = email.trim()
      if (view === 'sign-in') {
        await signIn(mail, password)
        onClose()
      } else if (view === 'sign-up') {
        const { needsConfirmation } = await signUp(mail, password)
        if (needsConfirmation) setMessage(`Te mandamos un correo a ${mail}. Abre el link para activar tu cuenta.`)
        else onClose()
      } else {
        await sendPasswordReset(mail)
        setMessage(`Si hay una cuenta con ${mail}, te llegará un link para poner una contraseña nueva.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title={TITLES[view]} onClose={onClose}>
      {view !== 'reset' && (
        <p className="hint">
          Tu colección se guarda en la nube y tendrás un link para compartirla. Lo que ya tienes en este navegador se
          sube a tu cuenta la primera vez.
        </p>
      )}
      {message ? (
        <p className="success">{message}</p>
      ) : (
        <form onSubmit={submit} className="stack">
          <label htmlFor="login-email">Correo</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {view !== 'reset' && (
            <>
              <label htmlFor="login-password">Contraseña</label>
              <div className="password-field">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={MIN_PASSWORD}
                  autoComplete={view === 'sign-up' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {view === 'sign-up' && <span className="hint">Al menos {MIN_PASSWORD} caracteres.</span>}
            </>
          )}
          <button type="submit" disabled={busy}>
            {busy
              ? 'Un momento…'
              : view === 'sign-in'
                ? 'Entrar'
                : view === 'sign-up'
                  ? 'Crear cuenta'
                  : 'Mandarme el link'}
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <div className="auth-links">
        {view === 'sign-in' && (
          <>
            <button className="link" onClick={() => go('sign-up')}>
              ¿No tienes cuenta? Crea una
            </button>
            <button className="link" onClick={() => go('reset')}>
              Olvidé mi contraseña
            </button>
          </>
        )}
        {view !== 'sign-in' && (
          <button className="link" onClick={() => go('sign-in')}>
            Ya tengo cuenta, iniciar sesión
          </button>
        )}
      </div>
    </Dialog>
  )
}
