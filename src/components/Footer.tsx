import { useState } from 'react'
import { AUTHOR, DONATION_LINKS, FIRST_YEAR } from '../config'
import { supabase } from '../lib/supabase'
import { useI18n } from '../i18n'
import Dialog from './Dialog'
import FeedbackDialog from './FeedbackDialog'

export default function Footer() {
  const { t } = useI18n()
  const [open, setOpen] = useState<'donate' | 'feedback' | null>(null)
  const year = new Date().getFullYear()
  const years = year > FIRST_YEAR ? `${FIRST_YEAR}–${year}` : String(FIRST_YEAR)

  return (
    <footer className="site-footer">
      <span className="footer-mark" aria-hidden="true" />
      <p className="footer-credit">
        {t('footer.madeBy')} <strong>{AUTHOR}</strong>
      </p>
      <div className="footer-actions">
        {supabase && (
          <button className="ghost small" onClick={() => setOpen('feedback')}>
            {t('footer.feedback')}
          </button>
        )}
        {DONATION_LINKS.length > 0 && (
          <button className="small donate" onClick={() => setOpen('donate')}>
            {t('footer.donate')}
          </button>
        )}
      </div>
      <p className="hint">{t('footer.rights', { years, author: AUTHOR })}</p>
      <p className="hint legal">
        {t('footer.legal')} {t('footer.cardData')}{' '}
        <a href="https://tcgdex.dev" target="_blank" rel="noreferrer">
          TCGdex
        </a>
        . {t('footer.sprites')}{' '}
        <a href="https://pokeapi.co" target="_blank" rel="noreferrer">
          PokéAPI
        </a>
        .
      </p>

      {open === 'feedback' && <FeedbackDialog onClose={() => setOpen(null)} />}
      {open === 'donate' && (
        <Dialog title={t('donate.title')} onClose={() => setOpen(null)}>
          <p className="hint">{t('donate.text')}</p>
          <ul className="donate-list">
            {DONATION_LINKS.map((d) => (
              <li key={d.url}>
                <a className="button-link" href={d.url} target="_blank" rel="noreferrer">
                  {d.label}
                </a>
                {d.note && <span className="hint">{d.note}</span>}
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </footer>
  )
}
