import { useMemo, useState } from 'react'
import { slotStatus, useCollection, type SlotStatus } from '../lib/store'
import { useCards } from '../lib/cards'
import { cardImage, fmtUsd, priceOf } from '../lib/tcgdex'
import { SECTIONS, SLOTS, dexNo, spriteUrl, type Slot } from '../lib/pokedex'

type Filter = 'all' | 'missing' | 'card' | 'marked'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'missing', label: 'Me faltan' },
  { id: 'card', label: 'Con carta' },
  { id: 'marked', label: 'Sin carta elegida' },
]

/** Chips de sección: 1–9 para generaciones, formas regionales y extras (Megas, Rotom, Wormadam). */
const SECTION_CHIPS = [
  ...SECTIONS.filter((s) => s.id.startsWith('gen')).map((s) => ({ label: s.id.slice(3), ids: [s.id] })),
  { label: 'Regionales', ids: SECTIONS.filter((s) => !s.id.startsWith('gen') && !s.extra).map((s) => s.id) },
  { label: 'Extras', ids: SECTIONS.filter((s) => s.extra).map((s) => s.id) },
]

export default function DexView({ onOpen }: { onOpen: (slot: string) => void }) {
  const { state } = useCollection()
  const { cards } = useCards()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [chip, setChip] = useState<string | null>(null)
  const [showArt, setShowArt] = useState(true)

  const status = useMemo(() => {
    const map = new Map<string, SlotStatus>()
    for (const s of SLOTS) map.set(s.key, slotStatus(state, s.key))
    return map
  }, [state])

  const q = query.trim().toLowerCase()
  const matches = (s: Slot) => {
    if (filter !== 'all' && status.get(s.key) !== filter) return false
    if (!q) return true
    return s.en.toLowerCase().includes(q) || s.es.toLowerCase().includes(q) || String(s.dex) === q.replace(/^#?0*/, '')
  }

  const activeIds = SECTION_CHIPS.find((c) => c.label === chip)?.ids

  return (
    <div className="dex">
      <div className="toolbar">
        <input
          id="dex-search"
          type="search"
          placeholder="Buscar por nombre o número"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips" role="group" aria-label="Filtro">
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? 'chip on' : 'chip'} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Sección">
          <button className={chip === null ? 'chip on' : 'chip'} onClick={() => setChip(null)}>
            Todas
          </button>
          {SECTION_CHIPS.map((c) => (
            <button key={c.label} className={chip === c.label ? 'chip on' : 'chip'} onClick={() => setChip(c.label)}>
              {c.label}
            </button>
          ))}
        </div>
        <label className="toggle">
          <input id="show-art" type="checkbox" checked={showArt} onChange={(e) => setShowArt(e.target.checked)} />
          Mostrar mi carta
        </label>
      </div>

      {SECTIONS.filter((sec) => !activeIds || activeIds.includes(sec.id)).map((sec) => {
        const visible = sec.slots.filter(matches)
        if (!visible.length) return null
        const have = sec.slots.filter((s) => status.get(s.key) === 'card').length
        const marked = sec.slots.filter((s) => status.get(s.key) === 'marked').length
        return (
          <section key={sec.id} className="gen">
            <header className="gen-head">
              <h2>
                {sec.title} {sec.subtitle && <span>{sec.subtitle}</span>}
              </h2>
              <span className="gen-count">
                {have} / {sec.slots.length}
                {marked > 0 && <em> +{marked} sin carta</em>}
              </span>
              <div className="bar small">
                <span className="bar-card" style={{ width: `${(have / sec.slots.length) * 100}%` }} />
                <span className="bar-marked" style={{ width: `${(marked / sec.slots.length) * 100}%` }} />
              </div>
            </header>
            <ol className="grid">
              {visible.map((s) => {
                const st = status.get(s.key)!
                const featured = state.owned.find((o) => o.uid === state.featured[s.key])
                const card = featured && cards[featured.cardId]
                const count = state.owned.filter((o) => o.slots.includes(s.key)).reduce((n, o) => n + o.qty, 0)
                const price = featured ? priceOf(card, featured.variant) : null
                const art = showArt && card?.image ? cardImage(card.image) : undefined
                return (
                  <li key={s.key}>
                    <button className={`slot ${st}${art ? ' has-art' : ''}`} onClick={() => onOpen(s.key)}>
                      {art ? (
                        <img className="slot-card" src={art} alt="" loading="lazy" />
                      ) : (
                        <img className="slot-sprite" src={spriteUrl(s.sprite)} alt="" loading="lazy" />
                      )}
                      <span className="slot-no">{dexNo(s.dex)}</span>
                      <span className="slot-name">{s.es}</span>
                      {st === 'card' && (
                        <span className="slot-meta">
                          {count > 1 && <b>×{count}</b>}
                          {price && <span>{fmtUsd(price.usd)}</span>}
                        </span>
                      )}
                      {st === 'marked' && <span className="slot-meta pending">elige carta</span>}
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
