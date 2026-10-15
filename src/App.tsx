import { useEffect, useMemo, useRef, useState } from 'react'
import { isEmptyCollection, useCollection, type CollectionState } from './lib/store'
import { useCards } from './lib/cards'
import { useAuth } from './lib/auth'
import type { Profile } from './lib/supabase'
import { fmtUsd, priceOf } from './lib/tcgdex'
import { TOTAL_SLOTS, isExtra, slotByKey } from './lib/pokedex'
import DexView from './components/DexView'
import CollectionView from './components/CollectionView'
import PokemonPanel from './components/PokemonPanel'
import LoginDialog from './components/LoginDialog'
import TrackerImport from './components/TrackerImport'
import Dialog from './components/Dialog'

type Tab = 'dex' | 'collection'

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

const SAVE_LABELS: Record<SaveStatus, string> = {
  saved: 'Guardado',
  pending: 'Cambios sin guardar',
  saving: 'Guardando…',
  error: 'No se pudo guardar',
}

export default function App({ mode }: { mode: AppMode }) {
  const { state, dispatch, readOnly } = useCollection()
  const { cards, ensure } = useCards()
  const { auth, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('dex')
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'login' | 'tracker' | 'share' | null>(null)
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
    let value = 0
    let approx = false
    let unpriced = 0
    for (const o of state.owned) {
      const p = priceOf(cards[o.cardId], o.variant)
      if (!p) unpriced += o.qty
      else {
        value += p.usd * o.qty
        approx ||= p.approx
      }
    }
    return {
      withCard: withCard.size,
      marked: state.marked.filter((k) => isMain(k) && !withCard.has(k)).length,
      totalCards: state.owned.reduce((n, o) => n + o.qty, 0),
      value,
      approx,
      unpriced,
    }
  }, [state, cards])

  async function refreshPrices() {
    setRefreshing(true)
    await ensure(ownedIds, { force: true })
    setRefreshing(false)
    setNotice(`Precios actualizados (${ownedIds.length} cartas).`)
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
      setNotice(`Respaldo cargado: ${data.owned.length} cartas.`)
    } catch {
      setNotice('Ese archivo no es un respaldo de esta app.')
    }
  }

  const pct = (n: number) => `${((n / TOTAL_SLOTS) * 100).toFixed(1)}%`
  const shareUrl = mode.kind === 'cloud' ? `${window.location.origin}/u/${mode.profile.username}` : ''
  const canLogin = auth.status !== 'disabled'

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Pokédex TCG</h1>
        </a>
        <nav className="tabs" aria-label="Secciones">
          <button className={tab === 'dex' ? 'on' : ''} onClick={() => setTab('dex')}>
            Pokédex
          </button>
          <button className={tab === 'collection' ? 'on' : ''} onClick={() => setTab('collection')}>
            {readOnly ? 'Colección' : 'Mi colección'}
          </button>
        </nav>
        <div className="topbar-actions">
          {mode.kind === 'cloud' && (
            <>
              <button
                className={`save-status ${mode.saveStatus}`}
                onClick={mode.saveStatus === 'error' ? mode.onRetrySave : undefined}
                title={mode.saveStatus === 'error' ? 'Reintentar' : undefined}
              >
                {SAVE_LABELS[mode.saveStatus]}
              </button>
              <button onClick={() => setDialog('share')}>Compartir</button>
            </>
          )}
          {mode.kind === 'public' ? (
            <a className="button-link" href="/">
              {mode.isMine ? 'Editar mi Pokédex' : 'Arma la tuya'}
            </a>
          ) : (
            <details className="menu">
              <summary className="ghost-button">Más</summary>
              <div className="menu-list">
                <button className="ghost" onClick={() => setDialog('tracker')}>
                  Importar de Pokédex Tracker
                </button>
                <button className="ghost" onClick={exportBackup}>
                  Exportar respaldo
                </button>
                <button className="ghost" onClick={() => fileInput.current?.click()}>
                  Cargar respaldo
                </button>
                {mode.kind === 'cloud' && (
                  <button className="ghost" onClick={signOut}>
                    Salir de @{mode.profile.username}
                  </button>
                )}
              </div>
            </details>
          )}
          {mode.kind === 'local' && canLogin && <button onClick={() => setDialog('login')}>Iniciar sesión</button>}
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
          <h2>Pokédex de @{mode.profile.username}</h2>
          <span className="hint">
            Actualizada el {new Date(mode.updatedAt).toLocaleDateString('es-MX', { dateStyle: 'long' })}
          </span>
        </section>
      )}

      <section className="summary" aria-label="Resumen">
        <div className="stat stat-main">
          <span className="label">Pokédex con carta</span>
          <span className="value">
            {stats.withCard}
            <small> / {TOTAL_SLOTS}</small>
          </span>
          <div className="bar" role="progressbar" aria-valuenow={stats.withCard} aria-valuemax={TOTAL_SLOTS}>
            <span style={{ width: pct(stats.withCard) }} className="bar-card" />
            <span style={{ width: pct(stats.marked) }} className="bar-marked" />
          </div>
          <span className="hint">
            {pct(stats.withCard)} completo
            {stats.marked > 0 && <> · {stats.marked} marcados sin carta elegida</>}
          </span>
        </div>
        <div className="stat">
          <span className="label">Cartas</span>
          <span className="value">{stats.totalCards}</span>
          <span className="hint">{ownedIds.length} distintas</span>
        </div>
        <div className="stat">
          <span className="label">Valor de la colección</span>
          <span className="value money">
            {stats.approx && '≈ '}
            {fmtUsd(stats.value)}
          </span>
          <span className="hint">TCGplayer market (USD){stats.unpriced > 0 && ` · ${stats.unpriced} sin precio`}</span>
        </div>
        <div className="stat stat-action">
          <button onClick={refreshPrices} disabled={refreshing || !ownedIds.length}>
            {refreshing ? 'Actualizando…' : 'Actualizar precios'}
          </button>
          <span className="hint">Fuente: TCGdex</span>
        </div>
      </section>

      {mode.kind === 'local' && canLogin && !isEmptyCollection(state) && (
        <div className="notice">
          Tu colección solo está guardada en este navegador. Inicia sesión para guardarla en la nube y compartirla.
          <button className="small" onClick={() => setDialog('login')}>
            Iniciar sesión
          </button>
        </div>
      )}

      {!readOnly && isEmptyCollection(state) && (
        <section className="welcome">
          <div>
            <h2>Empieza con lo que ya tienes</h2>
            <p>
              Si usas Pokédex Tracker, trae tus Pokémon marcados. Quedan como "sin carta elegida" hasta que abras cada
              uno y escojas cuál carta es la tuya. También puedes abrir cualquier Pokémon y marcar sus cartas.
            </p>
          </div>
          <TrackerImport onDone={setNotice} />
        </section>
      )}

      {notice && (
        <div className="notice" role="status">
          {notice}
          <button className="ghost" onClick={() => setNotice(null)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      <main>{tab === 'dex' ? <DexView onOpen={setOpenSlot} /> : <CollectionView onOpen={setOpenSlot} />}</main>

      {openSlot !== null && (
        <PokemonPanel slotKey={openSlot} onClose={() => setOpenSlot(null)} onNavigate={setOpenSlot} />
      )}

      {dialog === 'login' && <LoginDialog onClose={() => setDialog(null)} />}
      {dialog === 'tracker' && (
        <Dialog title="Importar de Pokédex Tracker" onClose={() => setDialog(null)}>
          <p className="hint">Los Pokémon que tengas marcados quedan como "sin carta elegida". No se borra nada.</p>
          <TrackerImport
            onDone={(msg) => {
              setNotice(msg)
              setDialog(null)
            }}
          />
        </Dialog>
      )}
      {dialog === 'share' && mode.kind === 'cloud' && (
        <Dialog title="Compartir mi Pokédex" onClose={() => setDialog(null)}>
          <div className="share-row">
            <input id="share-url" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
            <button
              onClick={() =>
                navigator.clipboard.writeText(shareUrl).then(
                  () => setNotice('Link copiado.'),
                  () => (document.getElementById('share-url') as HTMLInputElement | null)?.select(),
                )
              }
            >
              Copiar
            </button>
          </div>
          <label className="toggle">
            <input id="share-public" type="checkbox" checked={mode.isPublic} onChange={mode.onTogglePublic} />
            Cualquiera con el link puede ver mi colección
          </label>
          {!mode.isPublic && <p className="hint">Tu colección es privada: el link mostrará que es privada.</p>}
          <a href={shareUrl}>Ver cómo la ven los demás</a>
        </Dialog>
      )}
    </div>
  )
}
