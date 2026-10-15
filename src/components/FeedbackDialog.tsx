import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { sendFeedback, type FeedbackKind } from '../lib/supabase'
import Dialog from './Dialog'
import { useI18n, type MessageKey } from '../i18n'

const KINDS: { id: FeedbackKind; label: MessageKey; placeholder: MessageKey }[] = [
  { id: 'suggestion', label: 'feedback.suggestion', placeholder: 'feedback.suggestionPh' },
  { id: 'bug', label: 'feedback.bug', placeholder: 'feedback.bugPh' },
  { id: 'other', label: 'feedback.other', placeholder: 'feedback.otherPh' },
]

export default function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { auth } = useAuth()
  const { t } = useI18n()
  const accountEmail = auth.status === 'ready' || auth.status === 'needs-profile' ? auth.session.user.email : undefined
  const [kind, setKind] = useState<FeedbackKind>('suggestion')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState(accountEmail ?? '')
  const [website, setWebsite] = useState('') // trampa para bots: las personas no ven este campo
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = KINDS.find((k) => k.id === kind)!

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (website) return setSent(true)
    setBusy(true)
    setError(null)
    try {
      await sendFeedback({ kind, message: message.trim(), contact: contact.trim() })
      setSent(true)
    } catch {
      setError(t('feedback.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title={t('feedback.title')} onClose={onClose}>
      {sent ? (
        <div className="stack sent">
          <p className="success">{t('feedback.thanks')}</p>
          <button onClick={onClose}>{t('feedback.close')}</button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <p className="hint">{t('feedback.lead')}</p>
          <div className="segmented" role="radiogroup" aria-label={t('feedback.kind')}>
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                className={kind === k.id ? 'on' : ''}
                onClick={() => setKind(k.id)}
              >
                {t(k.label)}
              </button>
            ))}
          </div>
          <label htmlFor="feedback-message">{t('feedback.message')}</label>
          <textarea
            id="feedback-message"
            required
            minLength={5}
            maxLength={2000}
            rows={5}
            placeholder={t(current.placeholder)}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <label htmlFor="feedback-contact">
            {t('feedback.contact')} <span className="hint">{t('feedback.optional')}</span>
          </label>
          <input
            id="feedback-contact"
            type="email"
            maxLength={200}
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <input
            id="feedback-website"
            className="hp"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
          <button type="submit" disabled={busy || message.trim().length < 5}>
            {busy ? t('feedback.sending') : t('feedback.send')}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </Dialog>
  )
}
