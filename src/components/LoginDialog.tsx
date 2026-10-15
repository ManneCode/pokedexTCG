import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import Dialog from './Dialog'

export default function LoginDialog({ onClose }: { onClose: () => void }) {
  const { signInWithEmail, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInWithEmail(email.trim())
      setSentTo(email.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo.')
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir Google.')
    }
  }

  return (
    <Dialog title="Inicia sesión" onClose={onClose}>
      <p className="hint">
        Tu colección se guarda en la nube y tendrás un link para compartirla. Lo que ya tienes en este navegador se sube a
        tu cuenta la primera vez.
      </p>
      {sentTo ? (
        <p className="success">
          Te mandamos un link a <strong>{sentTo}</strong>. Ábrelo en este mismo navegador para entrar.
        </p>
      ) : (
        <>
          <button className="google" onClick={google}>
            Continuar con Google
          </button>
          <div className="divider">
            <span>o con tu correo</span>
          </div>
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
            <button type="submit" disabled={busy}>
              {busy ? 'Enviando…' : 'Mandarme un link'}
            </button>
          </form>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </Dialog>
  )
}
