import { useEffect, useState } from 'react'
import { listCollectors, supabase, type CollectorRow, type CollectorSort } from '../lib/supabase'
import { TOTAL_SLOTS } from '../lib/pokedex'
import { fmtMoney } from '../lib/money'
import { useI18n, type MessageKey } from '../i18n'
import Footer from './Footer'

const SORTS: { id: CollectorSort; label: MessageKey }[] = [
  { id: 'with_card', label: 'explore.sortComplete' },
  { id: 'value_usd', label: 'explore.sortValue' },
  { id: 'total_cards', label: 'explore.sortCards' },
  { id: 'updated_at', label: 'explore.sortRecent' },
]

const MEDALS = ['🥇', '🥈', '🥉']

/** Página pública con las colecciones de todos y su ranking. */
export default function ExplorePage() {
  const { t, lang, setLang, locale } = useI18n()
  const [sort, setSort] = useState<CollectorSort>('with_card')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<CollectorRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    setError(false)
    const timer = window.setTimeout(
      () => {
        listCollectors(sort, search).then(
          (r) => alive && setRows(r),
          () => alive && setError(true),
        )
      },
      search ? 300 : 0,
    )
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [sort, search])

  const pct = (n: number) => (n / TOTAL_SLOTS) * 100

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">
            <h1>Pokédex TCG</h1>
            <span className="brand-sub">{t('app.brandSub')}</span>
          </span>
        </a>
        <div className="topbar-actions">
          <button
            className="ghost lang-toggle"
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            aria-label={t('top.language')}
          >
            {lang === 'es' ? 'EN' : 'ES'}
          </button>
          <a className="button-link" href="/">
            {t('splash.home')}
          </a>
        </div>
      </header>

      <section className="explore-hero">
        <p className="eyebrow">{t('explore.eyebrow')}</p>
        <h2>{t('explore.title')}</h2>
        <p className="hint">{t('explore.lead')}</p>
      </section>

      <div className="toolbar">
        <input
          id="explore-search"
          type="search"
          placeholder={t('explore.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="chips" role="group" aria-label={t('col.sortBy')}>
          {SORTS.map((s) => (
            <button key={s.id} className={sort === s.id ? 'chip on' : 'chip'} onClick={() => setSort(s.id)}>
              {t(s.label)}
            </button>
          ))}
        </div>
      </div>

      {!supabase && <p className="hint">{t('splash.needsSupabase')}</p>}
      {error && <p className="error">{t('explore.error')}</p>}
      {supabase && !rows && !error && <p className="hint">{t('splash.loading')}</p>}
      {rows && rows.length === 0 && <p className="hint">{t('explore.empty')}</p>}

      {rows && rows.length > 0 && (
        <ol className="leaderboard">
          {rows.map((r, i) => (
            <li key={r.username}>
              <a href={`/u/${r.username}`} className={i < 3 && !search ? 'collector top' : 'collector'}>
                <span className="rank">{i < 3 && !search ? MEDALS[i] : i + 1}</span>
                <span className="who">
                  <strong>@{r.username}</strong>
                  <span className="hint">
                    {t('explore.updated', {
                      date: new Date(r.updatedAt).toLocaleDateString(locale, { dateStyle: 'medium' }),
                    })}
                  </span>
                </span>
                <span className="progress">
                  <span className="bar small">
                    <span className="bar-card" style={{ width: `${pct(r.withCard)}%` }} />
                  </span>
                  <span className="hint">
                    {r.withCard} / {TOTAL_SLOTS} · {pct(r.withCard).toFixed(1)}%
                  </span>
                </span>
                <span className="num">
                  <strong>{r.totalCards}</strong>
                  <span className="hint"> {t('explore.cards')}</span>
                </span>
                <span className="num money">{fmtMoney(r.valueUsd)}</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      <Footer />
    </div>
  )
}
