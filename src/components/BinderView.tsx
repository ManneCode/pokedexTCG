import { useEffect, useMemo, useState } from 'react'
import { useCollection } from '../lib/store'
import { useCards } from '../lib/cards'
import { MAIN_SLOTS, SLOTS, dexNo, spriteUrl } from '../lib/pokedex'
import { useI18n } from '../i18n'
import CardImage from './CardImage'

/** Hojas típicas de binder: 4 (2×2), 9 (3×3) o 12 (3×4) bolsas por página. */
const POCKETS = [4, 9, 12] as const
type Pockets = (typeof POCKETS)[number]
const COLUMNS: Record<Pockets, number> = { 4: 2, 9: 3, 12: 3 }

const PREF_KEY = 'pkt-binder-v1'

function loadPrefs(): { pockets: Pockets; extras: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}')
    return { pockets: POCKETS.includes(p.pockets) ? p.pockets : 9, extras: !!p.extras }
  } catch {
    return { pockets: 9, extras: false }
  }
}

export default function BinderView({ onOpen }: { onOpen: (slot: string) => void }) {
  const { state } = useCollection()
  const { cards } = useCards()
  const { t, slotName } = useI18n()
  const [prefs, setPrefs] = useState(loadPrefs)
  const [spread, setSpread] = useState(0)
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
    } catch {
      // preferencia solo para esta pestaña
    }
  }, [prefs])

  const slots = prefs.extras ? SLOTS : MAIN_SLOTS
  const pages = useMemo(() => {
    const out = []
    for (let i = 0; i < slots.length; i += prefs.pockets) out.push(slots.slice(i, i + prefs.pockets))
    return out
  }, [slots, prefs.pockets])

  // En pantalla ancha se ven dos páginas, como un binder abierto.
  const perSpread = wide ? 2 : 1
  const spreads = Math.ceil(pages.length / perSpread)
  const current = Math.min(spread, spreads - 1)
  const shown = pages.slice(current * perSpread, current * perSpread + perSpread)

  const featuredCard = (key: string) => {
    const owned =
      state.owned.find((o) => o.uid === state.featured[key]) ?? state.owned.find((o) => o.slots.includes(key))
    return owned ? cards[owned.cardId] : undefined
  }

  function change(next: Partial<typeof prefs>) {
    setPrefs((p) => ({ ...p, ...next }))
    setSpread(0)
  }

  return (
    <div className="binder-view">
      <div className="toolbar">
        <label htmlFor="binder-pockets">{t('binder.pockets')}</label>
        <select
          id="binder-pockets"
          value={prefs.pockets}
          onChange={(e) => change({ pockets: Number(e.target.value) as Pockets })}
        >
          {POCKETS.map((n) => (
            <option key={n} value={n}>
              {t('binder.perPage', { n })}
            </option>
          ))}
        </select>
        <label className="toggle">
          <input
            id="binder-extras"
            type="checkbox"
            checked={prefs.extras}
            onChange={(e) => change({ extras: e.target.checked })}
          />
          {t('binder.includeExtras')}
        </label>
        <span className="hint push-right">{t('binder.totalPages', { n: pages.length })}</span>
      </div>

      <div className="binder-nav">
        <button className="ghost" disabled={current === 0} onClick={() => setSpread(current - 1)}>
          ← {t('panel.prev')}
        </button>
        <select
          id="binder-page"
          aria-label={t('binder.goTo')}
          value={current}
          onChange={(e) => setSpread(Number(e.target.value))}
        >
          {Array.from({ length: spreads }, (_, i) => {
            const first = pages[i * perSpread][0]
            const lastPage = pages[Math.min(i * perSpread + perSpread, pages.length) - 1]
            const last = lastPage[lastPage.length - 1]
            return (
              <option key={i} value={i}>
                {t('binder.pageRange', {
                  pages:
                    perSpread === 2 && i * 2 + 1 < pages.length ? `${i * 2 + 1}–${i * 2 + 2}` : `${i * perSpread + 1}`,
                  from: dexNo(first.dex),
                  to: dexNo(last.dex),
                })}
              </option>
            )
          })}
        </select>
        <button className="ghost" disabled={current >= spreads - 1} onClick={() => setSpread(current + 1)}>
          {t('panel.next')} →
        </button>
      </div>

      <div className={`binder-spread pockets-${prefs.pockets}`}>
        {shown.map((page, pi) => {
          const pageNo = current * perSpread + pi + 1
          const have = page.filter((s) => state.owned.some((o) => o.slots.includes(s.key))).length
          return (
            <section key={pageNo} className="binder-page">
              <header>
                <span>{t('binder.page', { n: pageNo })}</span>
                <span className={have === page.length ? 'page-count done' : 'page-count'}>
                  {have} / {page.length}
                </span>
              </header>
              <ol className="pockets" style={{ gridTemplateColumns: `repeat(${COLUMNS[prefs.pockets]}, 1fr)` }}>
                {page.map((s) => {
                  const card = featuredCard(s.key)
                  const marked = !card && state.marked.includes(s.key)
                  return (
                    <li key={s.key}>
                      <button
                        className={card ? 'pocket filled' : marked ? 'pocket marked' : 'pocket'}
                        onClick={() => onOpen(s.key)}
                        title={`${dexNo(s.dex)} ${slotName(s)}`}
                      >
                        {card ? (
                          <CardImage
                            cardId={card.id}
                            localId={card.localId}
                            image={card.image}
                            name={card.name}
                            setName={card.setName}
                            sprite={s.sprite}
                          />
                        ) : (
                          <>
                            <img className="pocket-sprite" src={spriteUrl(s.sprite)} alt="" loading="lazy" />
                            <span className="slot-no">{dexNo(s.dex)}</span>
                            <span className="pocket-name">{slotName(s)}</span>
                          </>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
      </div>
    </div>
  )
}
