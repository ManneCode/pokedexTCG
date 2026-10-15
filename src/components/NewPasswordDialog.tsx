import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { MIN_PASSWORD } from '../lib/supabase'
import { useI18n } from '../i18n'

/** Aparece al abrir el link de "olvidé mi contraseña" del correo. */
export default function NewPasswordDialog() {
  const { updatePassword } = useAuth()
  const { t, tx } = useI18n()
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
      setError(tx(err instanceof Error ? err.message : 'error.generic'))
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop">
      <form
        className="dialog stack"
        role="dialog"
        aria-modal="true"
        aria-label={t('auth.newPassword')}
        onSubmit={submit}
      >
        <h2>{t('auth.newPasswordTitle')}</h2>
        <label htmlFor="new-password">{t('auth.newPassword')}</label>
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
        <span className="hint">{t('auth.atLeast', { n: MIN_PASSWORD })}</span>
        <button type="submit" disabled={busy}>
          {busy ? t('auth.saving') : t('auth.savePassword')}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}
