import { useEffect, useMemo, useRef, useState } from 'react'
import { isEmptyCollection, useCollection, type CollectionState } from './lib/store'
import { useCards } from './lib/cards'
import { useAuth } from './lib/auth'
import type { Profile } from './lib/supabase'
import { collectionTotals, todayKey } from './lib/value'
import { fmtMoney } from './lib/money'
import { TOTAL_SLOTS, isExtra, slotByKey } from './lib/pokedex'
import { useI18n, type MessageKey } from './i18n'
import DexView from './components/DexView'
import CollectionView from './components/CollectionView'
import BinderView from './components/BinderView'
import PokemonPanel from './components/PokemonPanel'
import LoginDialog from './components/LoginDialog'
import CardFan from './components/CardFan'
import Dialog from './components/Dialog'
import Footer from './components/Footer'
import ScanDialog from './components/ScanDialog'

type Tab = 'dex' | 'binder' | 'collection'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

export type AppMode =
  | { kind: 'local' }
  | {
      kind: 'cloud'
      profile: Profile
      isPublic: boolean
      onTogglePublic: () => void
      saveStatus: SaveStatus
      onRetrySave: () => void
    }
  | { kind: 'public'; profile: Profile; updatedAt: string; isMine: boolean }

const SAVE_LABELS: Record<SaveStatus, MessageKey> = {
  saved: 'save.saved',
  pending: 'save.pending',
  saving: 'save.saving',
  error: 'save.error',
}

export default function App({ mode }: { mode: AppMode }) {
  const { state, dispatch, readOnly } = useCollection()
  const { cards, ensure } = useCards()
  const { auth, signOut } = useAuth()
  const { t, lang, setLang, locale, currency, setCurrency, rate } = useI18n()
  const [tab, setTab] = useState<Tab>('dex')
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'login' | 'signup' | 'share' | 'scan' | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const ownedIds = useMemo(() => [...new Set(state.owned.map((o) => o.cardId))], [state.owned])

  // Precios de las cartas al abrir (respeta la caché de 24 h).
  useEffect(() => {
    if (ownedIds.length) void ensure(ownedIds)
  }, [ownedIds, ensure])

  const stats = useMemo(() => {
    // Megas y otras formas son extra: no cuentan para la Pokédex completa.
    const isMain = (key: string) => {
      const slot = slotByKey(key)
      return !!slot && !isExtra(slot)
    }
    const withCard = new Set(state.owned.flatMap((o) => o.slots).filter(isMain))
    const totals = collectionTotals(state, cards)
    return {
      withCard: withCard.size,
      marked: state.marked.filter((k) => isMain(k) && !withCard.has(k)).length,
      totalCards: totals.cards,
      value: totals.usd,
      approx: totals.approx,
      unpriced: totals.unpriced,
      // Solo guardamos la foto del día cuando ya llegaron los precios de todas las cartas.
      complete: ownedIds.every((id) => cards[id]),
    }
  }, [state, cards, ownedIds])

  // Foto diaria del valor para la gráfica de historial (solo en tu propia colección).
  const lastPoint = state.history[state.history.length - 1]
  useEffect(() => {
    if (readOnly || !stats.complete || !state.owned.length) return
    const point = {
      date: todayKey(),
      usd: Math.round(stats.value * 100) / 100,
      cards: stats.totalCards,
      withCard: stats.withCard,
    }
    if (
      lastPoint &&
      lastPoint.date === point.date &&
      lastPoint.usd === point.usd &&
      lastPoint.cards === point.cards &&
      lastPoint.withCard === point.withCard
    )
      return
    dispatch({ type: 'recordValue', point })
  }, [readOnly, stats, state.owned.length, lastPoint, dispatch])

  async function refreshPrices() {
    setRefreshing(true)
    await ensure(ownedIds, { force: true })
    setRefreshing(false)
    setNotice(t('notice.pricesUpdated', { n: ownedIds.length }))
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pokedex-tcg-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importBackup(file: File) {
    try {
      const data = JSON.parse(await file.text()) as CollectionState
      if (!Array.isArray(data.owned) || !Array.isArray(data.marked)) throw new Error()
      dispatch({ type: 'replace', state: data })
      setNotice(t('notice.backupLoaded', { n: data.owned.length }))
    } catch {
      setNotice(t('notice.backupInvalid'))
    }
  }

  const pctNum = (n: number) => (n / TOTAL_SLOTS) * 100
  const pct = (n: number) =>
    `${pctNum(n).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`
  const shareUrl = mode.kind === 'cloud' ? `${window.location.origin}/u/${mode.profile.username}` : ''
  const canLogin = auth.status !== 'disabled'

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
        <nav className="tabs" aria-label="Pokédex TCG">
          <button className={tab === 'dex' ? 'on' : ''} onClick={() => setTab('dex')}>
            {t('nav.dex')}
          </button>
          <button className={tab === 'binder' ? 'on' : ''} onClick={() => setTab('binder')}>
            {t('nav.binder')}
          </button>
          <button className={tab === 'collection' ? 'on' : ''} onClick={() => setTab('collection')}>
            {readOnly ? t('nav.collection') : t('nav.myCollection')}
          </button>
        </nav>
        <div className="topbar-actions">
          {!readOnly && (
            <button className="scan-btn" onClick={() => setDialog('scan')}>
              {t('scan.button')}
            </button>
          )}
          {canLogin && (
            <a className="ghost-button explore-link" href="/explorar">
              {t('explore.link')}
            </a>
          )}
          <button
            className="ghost lang-toggle"
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            title={t('top.language')}
            aria-label={t('top.language')}
          >
            {lang === 'es' ? 'EN' : 'ES'}
          </button>
          {mode.kind === 'cloud' && (
            <>
              <button
                className={`save-status ${mode.saveStatus}`}
                onClick={mode.saveStatus === 'error' ? mode.onRetrySave : undefined}
                title={mode.saveStatus === 'error' ? t('save.retry') : undefined}
              >
                {t(SAVE_LABELS[mode.saveStatus])}
              </button>
              <button onClick={() => setDialog('share')}>{t('top.share')}</button>
            </>
          )}
          {mode.kind === 'public' ? (
            <a className="button-link" href="/">
              {mode.isMine ? t('top.editMine') : t('top.makeYours')}
            </a>
          ) : (
            <details className="menu">
              <summary className="ghost-button">{t('top.more')}</summary>
              <div className="menu-list">
                <button className="ghost" onClick={exportBackup}>
                  {t('top.exportBackup')}
                </button>
                <button className="ghost" onClick={() => fileInput.current?.click()}>
                  {t('top.loadBackup')}
                </button>
                {mode.kind === 'cloud' && (
                  <button className="ghost" onClick={signOut}>
                    {t('top.signOut', { user: mode.profile.username })}
                  </button>
                )}
              </div>
            </details>
          )}
          {mode.kind === 'local' && canLogin && <button onClick={() => setDialog('login')}>{t('top.signIn')}</button>}
          <input
            id="backup-file"
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importBackup(f)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {mode.kind === 'public' && (
        <section className="owner-banner">
          <h2>{t('public.title', { user: mode.profile.username })}</h2>
          <span className="hint">
            {t('public.updated', {
              date: new Date(mode.updatedAt).toLocaleDateString(locale, { dateStyle: 'long' }),
            })}
          </span>
        </section>
      )}

      <section className="summary" aria-label="Pokédex TCG">
        <div className="stat stat-main">
          <span className="label">{t('stats.dexWithCard')}</span>
          <span className="value">
            {stats.withCard}
            <small> / {TOTAL_SLOTS}</small>
          </span>
          <div className="bar" role="progressbar" aria-valuenow={stats.withCard} aria-valuemax={TOTAL_SLOTS}>
            <span style={{ width: `${pctNum(stats.withCard)}%` }} className="bar-card" />
            <span style={{ width: `${pctNum(stats.marked)}%` }} className="bar-marked" />
          </div>
          <span className="hint">
            {t('stats.complete', { pct: pct(stats.withCard) })}
            {stats.marked > 0 && <> · {t('stats.markedNoCard', { n: stats.marked })}</>}
          </span>
        </div>
        <div className="stat">
          <span className="label">{t('stats.cards')}</span>
          <span className="value">{stats.totalCards}</span>
          <span className="hint">{t('stats.distinct', { n: ownedIds.length })}</span>
        </div>
        <div className="stat">
          <span className="label-row">
            <span className="label">{t('stats.value')}</span>
            <span className="currency-toggle" role="group" aria-label={t('stats.currency')}>
              {(['USD', 'MXN'] as const).map((c) => (
                <button key={c} className={currency === c ? 'on' : ''} onClick={() => setCurrency(c)}>
                  {c}
                </button>
              ))}
            </span>
          </span>
          <span className="value money">
            {stats.approx && '≈ '}
            {fmtMoney(stats.value)}
          </span>
          <span className="hint">
            {currency === 'MXN' && rate
              ? t('stats.valueSourceMxn', { rate: rate.mxn.toFixed(2), date: rate.date })
              : t('stats.valueSource')}
            {stats.unpriced > 0 && ` · ${t('stats.unpriced', { n: stats.unpriced })}`}
          </span>
        </div>
        <div className="stat stat-action">
          <button onClick={refreshPrices} disabled={refreshing || !ownedIds.length}>
            {refreshing ? t('stats.refreshing') : t('stats.refresh')}
          </button>
          <span className="hint">{t('stats.source')}</span>
        </div>
      </section>

      {mode.kind === 'local' && canLogin && !isEmptyCollection(state) && (
        <div className="notice">
          {t('notice.localOnly')}
          <button className="small" onClick={() => setDialog('login')}>
            {t('top.signIn')}
          </button>
        </div>
      )}

      {!readOnly && isEmptyCollection(state) && (
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{t('hero.eyebrow')}</p>
            <h2>
              {t('hero.title1')}
              <br />
              <span className="accent-text">{t('hero.title2')}</span>
            </h2>
            <ol className="steps">
              {(['1', '2', '3'] as const).map((n) => (
                <li key={n}>
                  <span>
                    <b>{t(`hero.step${n}a`)}</b> {t(`hero.step${n}b`)}
                  </span>
                </li>
              ))}
            </ol>
            <div className="hero-actions">
              <button onClick={() => setOpenSlot('1')}>{t('hero.start')}</button>
              {mode.kind === 'local' && canLogin && (
                <button className="ghost" onClick={() => setDialog('signup')}>
                  {t('hero.signUp')}
                </button>
              )}
            </div>
          </div>
          <CardFan />
        </section>
      )}

      {notice && (
        <div className="notice" role="status">
          {notice}
          <button className="ghost" onClick={() => setNotice(null)} aria-label={t('notice.close')}>
            ✕
          </button>
        </div>
      )}

      <main>
        {tab === 'dex' && <DexView onOpen={setOpenSlot} />}
        {tab === 'binder' && <BinderView onOpen={setOpenSlot} />}
        {tab === 'collection' && <CollectionView onOpen={setOpenSlot} />}
      </main>
      <Footer />

      {openSlot !== null && (
        <PokemonPanel slotKey={openSlot} onClose={() => setOpenSlot(null)} onNavigate={setOpenSlot} />
      )}

      {(dialog === 'login' || dialog === 'signup') && (
        <LoginDialog initialView={dialog === 'signup' ? 'sign-up' : 'sign-in'} onClose={() => setDialog(null)} />
      )}
      {dialog === 'scan' && <ScanDialog onClose={() => setDialog(null)} onOpen={setOpenSlot} />}
      {dialog === 'share' && mode.kind === 'cloud' && (
        <Dialog title={t('share.title')} onClose={() => setDialog(null)}>
          <div className="share-row">
            <input id="share-url" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
            <button
              onClick={() =>
                navigator.clipboard.writeText(shareUrl).then(
                  () => setNotice(t('notice.linkCopied')),
                  () => (document.getElementById('share-url') as HTMLInputElement | null)?.select(),
                )
              }
            >
              {t('share.copy')}
            </button>
          </div>
          <label className="toggle">
            <input id="share-public" type="checkbox" checked={mode.isPublic} onChange={mode.onTogglePublic} />
            {t('share.public')}
          </label>
          {!mode.isPublic && <p className="hint">{t('share.privateHint')}</p>}
          <a href={shareUrl}>{t('share.preview')}</a>
        </Dialog>
      )}
    </div>
  )
}
