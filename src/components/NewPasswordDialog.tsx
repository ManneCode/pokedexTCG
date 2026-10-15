import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { MIN_PASSWORD } from '../lib/supabase'

/** Aparece al abrir el link de "olvidé mi contraseña" del correo. */
export default function NewPasswordDialog() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.')
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop">
      <form className="dialog stack" role="dialog" aria-modal="true" aria-label="Contraseña nueva" onSubmit={submit}>
        <h2>Pon tu contraseña nueva</h2>
        <label htmlFor="new-password">Contraseña nueva</label>
        <input
          id="new-password"
          type="password"
          required
          autoFocus
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <span className="hint">Al menos {MIN_PASSWORD} caracteres.</span>
        <button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar contraseña'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}
