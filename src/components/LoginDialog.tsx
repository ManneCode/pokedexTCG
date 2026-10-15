import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { MIN_PASSWORD } from '../lib/supabase'
import CardFan from './CardFan'
import { useI18n, type MessageKey } from '../i18n'

type View = 'sign-in' | 'sign-up' | 'reset'

const COPY: Record<View, { title: MessageKey; lead: MessageKey; submit: MessageKey }> = {
  'sign-in': { title: 'auth.signInTitle', lead: 'auth.signInLead', submit: 'auth.signInSubmit' },
  'sign-up': { title: 'auth.signUpTitle', lead: 'auth.signUpLead', submit: 'auth.signUpSubmit' },
  reset: { title: 'auth.resetTitle', lead: 'auth.resetLead', submit: 'auth.resetSubmit' },
}

const PERKS: MessageKey[] = ['auth.perk1', 'auth.perk2', 'auth.perk3']

export default function LoginDialog({ onClose, initialView = 'sign-in' }: { onClose: () => void; initialView?: View }) {
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const { t, tx } = useI18n()
  const [view, setView] = useState<View>(initialView)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const copy = COPY[view]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        if (needsConfirmation) setMessage(t('auth.confirmSent', { email: mail }))
        else onClose()
      } else {
        await sendPasswordReset(mail)
        setMessage(t('auth.resetSent', { email: mail }))
      }
    } catch (err) {
      setError(tx(err instanceof Error ? err.message : 'error.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="auth-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="auth-art">
          <CardFan size="sm" />
          <div className="auth-art-copy">
            <p className="eyebrow">Pokédex TCG</p>
            <p className="auth-tagline">{t('auth.tagline')}</p>
            <ul className="perks">
              {PERKS.map((p) => (
                <li key={p}>{t(p)}</li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="auth-body">
          <button className="ghost auth-close" onClick={onClose} aria-label={t('panel.close')}>
            ✕
          </button>

          {view !== 'reset' && (
            <div className="segmented" role="tablist" aria-label={t('auth.tabs')}>
              <button
                role="tab"
                aria-selected={view === 'sign-in'}
                className={view === 'sign-in' ? 'on' : ''}
                onClick={() => go('sign-in')}
              >
                {t('auth.tabSignIn')}
              </button>
              <button
                role="tab"
                aria-selected={view === 'sign-up'}
                className={view === 'sign-up' ? 'on' : ''}
                onClick={() => go('sign-up')}
              >
                {t('auth.tabSignUp')}
              </button>
            </div>
          )}

          <header>
            <h2 id="auth-title">{t(copy.title)}</h2>
            <p className="hint">{t(copy.lead)}</p>
          </header>

          {message ? (
            <div className="auth-message">
              <p className="success">{message}</p>
              <button className="ghost" onClick={() => go('sign-in')}>
                {t('auth.backToSignIn')}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="auth-form">
              <div className="field">
                <label htmlFor="login-email">{t('auth.email')}</label>
                <span className="field-box">
                  <MailIcon />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </span>
              </div>

              {view !== 'reset' && (
                <div className="field">
                  <span className="field-label-row">
                    <label htmlFor="login-password">{t('auth.password')}</label>
                    {view === 'sign-in' && (
                      <button type="button" className="link" onClick={() => go('reset')}>
                        {t('auth.forgot')}
                      </button>
                    )}
                  </span>
                  <span className="field-box">
                    <LockIcon />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={MIN_PASSWORD}
                      autoComplete={view === 'sign-up' ? 'new-password' : 'current-password'}
                      placeholder={view === 'sign-up' ? t('auth.minChars', { n: MIN_PASSWORD }) : '••••••••'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      aria-pressed={showPassword}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </span>
                </div>
              )}

              {error && <p className="error">{error}</p>}

              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? t('auth.busy') : t(copy.submit)}
              </button>

              {view === 'reset' && (
                <button type="button" className="link center" onClick={() => go('sign-in')}>
                  {t('auth.backToSignIn')}
                </button>
              )}
              {view === 'sign-up' && <p className="hint small-print">{t('auth.uploadNote')}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M3 6h18v12H3z M3 7l9 6 9-6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M5 11h14v10H5z M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {!open && <path stroke="currentColor" strokeWidth="1.8" d="M4 20L20 4" />}
    </svg>
  )
}
