import { useEffect, useMemo, useState } from 'react'
import { slotStatus, useCollection } from '../lib/store'
import { useCards } from '../lib/cards'
import {
  cardImage,
  defaultVariant,
  fmtUsd,
  getSeriesOrder,
  listCardsForDex,
  priceOf,
  seriesOf,
  variantLabel,
  type CardBrief,
  type CardInfo,
} from '../lib/tcgdex'
import { SLOTS, dexNo, slotByKey, slotCandidates, spriteUrl } from '../lib/pokedex'

type Sort = 'new' | 'old' | 'price-desc' | 'price-asc'

type Props = { slotKey: string; onClose: () => void; onNavigate: (slot: string) => void }

export default function PokemonPanel({ slotKey, onClose, onNavigate }: Props) {
  const species = slotByKey(slotKey)!
  const dex = species.dex
  const index = SLOTS.indexOf(species)
  const prevSlot = SLOTS[index - 1]?.key
  const nextSlot = SLOTS[index + 1]?.key
  const { state, dispatch, readOnly } = useCollection()
  const { cards, ensure } = useCards()
  const [list, setList] = useState<CardBrief[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seriesOrder, setSeriesOrder] = useState<string[]>([])
  const [sort, setSort] = useState<Sort>('new')
  const [setQuery, setSetQuery] = useState('')
  const [preview, setPreview] = useState<CardInfo | CardBrief | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setList(null)
    setError(null)
    listCardsForDex(dex)
      .then((all) => {
        if (ctrl.signal.aborted) return
        const l = all.filter((c) => slotCandidates(dex, c.name).includes(slotKey))
        setList(l)
        return ensure(
          l.map((c) => c.id),
          { signal: ctrl.signal },
        )
      })
      .catch(() => !ctrl.signal.aborted && setError('No se pudo cargar la lista de cartas. Revisa tu conexión.'))
    getSeriesOrder().then(setSeriesOrder, () => {})
    return () => ctrl.abort()
  }, [dex, slotKey, ensure])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (preview) setPreview(null)
        else onClose()
      }
      if (preview) return
      if (e.key === 'ArrowRight' && nextSlot) onNavigate(nextSlot)
      if (e.key === 'ArrowLeft' && prevSlot) onNavigate(prevSlot)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevSlot, nextSlot, preview, onClose, onNavigate])

  const mine = state.owned.filter((o) => o.slots.includes(slotKey))
  const status = slotStatus(state, slotKey)

  const sorted = useMemo(() => {
    if (!list) return []
    const q = setQuery.trim().toLowerCase()
    const era = (c: CardBrief) => {
      const i = seriesOrder.indexOf(seriesOf(c.image) ?? '')
      return i === -1 ? -1 : i
    }
    const price = (c: CardBrief) => priceOf(cards[c.id])?.usd ?? -1
    return list
      .filter((c) => !q || (cards[c.id]?.setName ?? c.id).toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .sort((a, b) => {
        switch (sort) {
          case 'new':
            return era(b) - era(a) || b.id.localeCompare(a.id)
          case 'old':
            return era(a) - era(b) || a.id.localeCompare(b.id)
          case 'price-desc':
            return price(b) - price(a)
          case 'price-asc':
            return (price(a) < 0 ? Infinity : price(a)) - (price(b) < 0 ? Infinity : price(b))
        }
      })
  }, [list, cards, sort, setQuery, seriesOrder])

  const loaded = list ? list.filter((c) => cards[c.id]).length : 0

  function add(card: CardBrief) {
    const info = cards[card.id]
    dispatch({
      type: 'add',
      cardId: card.id,
      slots: (info?.dexIds.length ? info.dexIds : [dex]).map((d) =>
        d === dex ? slotKey : slotCandidates(d, card.name)[0],
      ),
      variant: info ? defaultVariant(info) : 'normal',
    })
  }

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <aside
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Cartas de ${species.es}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel-head">
          <img src={spriteUrl(species.sprite)} alt="" className="panel-sprite" />
          <div className="panel-title">
            <span className="slot-no">{dexNo(dex)}</span>
            <h2>{species.es}</h2>
            {species.en !== species.es && <span className="hint">{species.en}</span>}
          </div>
          <div className="panel-nav">
            <button
              className="ghost"
              disabled={!prevSlot}
              onClick={() => prevSlot && onNavigate(prevSlot)}
              aria-label="Anterior"
            >
              ←
            </button>
            <button
              className="ghost"
              disabled={!nextSlot}
              onClick={() => nextSlot && onNavigate(nextSlot)}
              aria-label="Siguiente"
            >
              →
            </button>
            <button className="ghost" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
        </header>

        <section className="mine">
          <div className="mine-head">
            <h3>{readOnly ? 'Cartas en la colección' : 'Mis cartas'}</h3>
            {status !== 'card' && !readOnly && (
              <button className="ghost small" onClick={() => dispatch({ type: 'toggleMark', slot: slotKey })}>
                {status === 'marked' ? 'Quitar marca "lo tengo"' : 'Marcar "lo tengo" sin elegir carta'}
              </button>
            )}
          </div>
          {status === 'marked' && (
            <p className="hint">
              {readOnly
                ? 'Marcado como suyo, sin carta elegida todavía.'
                : 'Lo marcaste como tuyo. Elige abajo cuál carta es para que cuente en el valor.'}
            </p>
          )}
          {status === 'missing' && (
            <p className="hint">{readOnly ? `Sin carta de ${species.es}.` : `Aún no tienes carta de ${species.es}.`}</p>
          )}
          {mine.length > 0 && (
            <ul className="mine-list">
              {mine.map((o) => {
                const info = cards[o.cardId]
                const p = priceOf(info, o.variant)
                const featured = state.featured[slotKey] === o.uid
                return (
                  <li key={o.uid} className={featured ? 'featured' : ''}>
                    {info?.image ? (
                      <img src={cardImage(info.image)} alt="" onClick={() => setPreview(info)} />
                    ) : (
                      <div className="noimg" />
                    )}
                    <div className="mine-info">
                      <strong>{info?.name ?? o.cardId}</strong>
                      <span className="hint">
                        {info?.setName ?? '…'} · {info?.localId}
                      </span>
                      {readOnly ? (
                        <span className="hint">
                          {variantLabel(o.variant)} · ×{o.qty}
                        </span>
                      ) : (
                        <div className="mine-controls">
                          <select
                            id={`variant-${o.uid}`}
                            value={o.variant}
                            onChange={(e) =>
                              dispatch({ type: 'update', uid: o.uid, patch: { variant: e.target.value } })
                            }
                            aria-label="Variante"
                          >
                            {(info?.variants ?? [o.variant]).map((v) => (
                              <option key={v} value={v}>
                                {variantLabel(v)}
                              </option>
                            ))}
                          </select>
                          <div className="stepper">
                            <button
                              onClick={() => dispatch({ type: 'update', uid: o.uid, patch: { qty: o.qty - 1 } })}
                              disabled={o.qty <= 1}
                              aria-label="Una menos"
                            >
                              −
                            </button>
                            <span>{o.qty}</span>
                            <button
                              onClick={() => dispatch({ type: 'update', uid: o.uid, patch: { qty: o.qty + 1 } })}
                              aria-label="Una más"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mine-side">
                      <span className="money">
                        {p ? `${p.approx ? '≈ ' : ''}${fmtUsd(p.usd * o.qty)}` : 'sin precio'}
                      </span>
                      {!readOnly && mine.length > 1 && (
                        <button
                          className="ghost small"
                          disabled={featured}
                          onClick={() => dispatch({ type: 'feature', slot: slotKey, uid: o.uid })}
                        >
                          {featured ? 'En la Pokédex' : 'Mostrar en Pokédex'}
                        </button>
                      )}
                      {!readOnly && (
                        <button className="ghost small danger" onClick={() => dispatch({ type: 'remove', uid: o.uid })}>
                          Quitar
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="catalog">
          <div className="catalog-head">
            <h3>Todas las cartas {list && <span className="hint">({list.length})</span>}</h3>
            <input
              id="set-filter"
              type="search"
              placeholder="Filtrar por set"
              value={setQuery}
              onChange={(e) => setSetQuery(e.target.value)}
            />
            <select id="card-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
              <option value="new">Más nuevas</option>
              <option value="old">Más viejas</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="price-asc">Precio: menor a mayor</option>
            </select>
          </div>
          {list && loaded < list.length && (
            <p className="hint">
              Cargando precios {loaded} / {list.length}…
            </p>
          )}
          {error && <p className="error">{error}</p>}
          {!list && !error && <p className="hint">Buscando cartas de {species.es}…</p>}
          {list && list.length === 0 && <p className="hint">TCGdex no tiene cartas físicas de {species.es}.</p>}
          <ul className="card-grid">
            {sorted.map((c) => {
              const info = cards[c.id]
              const p = priceOf(info)
              const ownedQty = mine.filter((o) => o.cardId === c.id).reduce((n, o) => n + o.qty, 0)
              return (
                <li key={c.id} className={ownedQty ? 'owned' : ''}>
                  <button
                    className="card-img"
                    onClick={() => setPreview(info ?? c)}
                    aria-label={`Ver ${c.name} en grande`}
                  >
                    {c.image ? (
                      <img src={cardImage(c.image)} alt="" loading="lazy" />
                    ) : (
                      <div className="noimg">Sin imagen</div>
                    )}
                  </button>
                  <div className="card-info">
                    <strong title={c.name}>{c.name}</strong>
                    <span className="hint">
                      {info?.setName ?? c.id} · {c.localId}
                    </span>
                    {info?.rarity && <span className="rarity">{info.rarity}</span>}
                  </div>
                  <div className="card-foot">
                    <span className="money">{info ? (p ? `${p.approx ? '≈ ' : ''}${fmtUsd(p.usd)}` : '—') : '…'}</span>
                    {readOnly ? (
                      ownedQty > 0 && <span className="owned-tag">En la colección ×{ownedQty}</span>
                    ) : (
                      <button className={ownedQty ? 'small owned-btn' : 'small'} onClick={() => add(c)}>
                        {ownedQty ? `Tengo ×${ownedQty} · +1` : 'La tengo'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {preview && (
          <div className="lightbox" onClick={() => setPreview(null)}>
            {preview.image ? (
              <img src={cardImage(preview.image, 'high')} alt={preview.name} />
            ) : (
              <div className="noimg big">Sin imagen</div>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
