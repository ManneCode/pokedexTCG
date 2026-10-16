import { useEffect, useMemo, useState } from 'react'
import { slotStatus, useCollection } from '../lib/store'
import { useCards } from '../lib/cards'
import {
  defaultVariant,
  getSeriesOrder,
  listCardsForDex,
  priceOf,
  seriesOf,
  type CardBrief,
  type CardInfo,
} from '../lib/tcgdex'
import { fmtMoney } from '../lib/money'
import { ownedValue } from '../lib/value'
import CardDetails from './CardDetails'
import { SLOTS, dexNo, slotByKey, slotCandidates, spriteUrl } from '../lib/pokedex'
import { useI18n } from '../i18n'
import CardImage from './CardImage'

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
  const { t, lang, slotName, variantLabel } = useI18n()
  const name = slotName(species)
  const otherName = lang === 'es' ? species.en : species.es
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
      .catch(() => !ctrl.signal.aborted && setError('panel.loadError'))
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

  /** Casillas y variante con las que se guarda una carta de esta lista. */
  function placement(card: CardBrief) {
    const info = cards[card.id]
    return {
      cardId: card.id,
      slots: (info?.dexIds.length ? info.dexIds : [dex]).map((d) =>
        d === dex ? slotKey : slotCandidates(d, card.name)[0],
      ),
      variant: info ? defaultVariant(info) : 'normal',
    }
  }

  const add = (card: CardBrief) => dispatch({ type: 'add', ...placement(card) })
  const toggleWish = (card: CardBrief) => dispatch({ type: 'wishToggle', ...placement(card) })

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <aside
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('panel.label', { name })}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel-head">
          <img src={spriteUrl(species.sprite)} alt="" className="panel-sprite" />
          <div className="panel-title">
            <span className="slot-no">{dexNo(dex)}</span>
            <h2>{name}</h2>
            {otherName !== name && <span className="hint">{otherName}</span>}
          </div>
          <div className="panel-nav">
            <button
              className="ghost"
              disabled={!prevSlot}
              onClick={() => prevSlot && onNavigate(prevSlot)}
              aria-label={t('panel.prev')}
            >
              ←
            </button>
            <button
              className="ghost"
              disabled={!nextSlot}
              onClick={() => nextSlot && onNavigate(nextSlot)}
              aria-label={t('panel.next')}
            >
              →
            </button>
            <button className="ghost" onClick={onClose} aria-label={t('panel.close')}>
              ✕
            </button>
          </div>
        </header>

        <section className="mine">
          <div className="mine-head">
            <h3>{readOnly ? t('panel.theirCards') : t('panel.myCards')}</h3>
            {status !== 'card' && !readOnly && (
              <button className="ghost small" onClick={() => dispatch({ type: 'toggleMark', slot: slotKey })}>
                {status === 'marked' ? t('panel.unmark') : t('panel.mark')}
              </button>
            )}
          </div>
          {status === 'marked' && <p className="hint">{readOnly ? t('panel.markedTheirs') : t('panel.markedMine')}</p>}
          {status === 'missing' && (
            <p className="hint">{readOnly ? t('panel.missingTheirs', { name }) : t('panel.missingMine', { name })}</p>
          )}
          {mine.length > 0 && (
            <ul className="mine-list">
              {mine.map((o) => {
                const info = cards[o.cardId]
                const v = ownedValue(o, info)
                const featured = state.featured[slotKey] === o.uid
                return (
                  <li key={o.uid} className={featured ? 'featured' : ''}>
                    <button className="mine-img" onClick={() => info && setPreview(info)} aria-label={info?.name}>
                      <CardImage
                        cardId={o.cardId}
                        localId={info?.localId}
                        image={info?.image}
                        name={info?.name ?? o.cardId}
                        setName={info?.setName}
                        sprite={species.sprite}
                      />
                    </button>
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
                            aria-label={t('panel.variant')}
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
                              aria-label={t('panel.less')}
                            >
                              −
                            </button>
                            <span>{o.qty}</span>
                            <button
                              onClick={() => dispatch({ type: 'update', uid: o.uid, patch: { qty: o.qty + 1 } })}
                              aria-label={t('panel.more')}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                      {readOnly ? (
                        (o.grade || (o.condition ?? 'NM') !== 'NM') && (
                          <span className="badges">
                            {o.condition && o.condition !== 'NM' && <span className="badge">{o.condition}</span>}
                            {o.grade && (
                              <span className="badge graded">
                                {o.grade.company} {o.grade.score}
                              </span>
                            )}
                          </span>
                        )
                      ) : (
                        <CardDetails owned={o} />
                      )}
                    </div>
                    <div className="mine-side">
                      <span className="money">
                        {v ? `${v.approx ? '≈ ' : ''}${fmtMoney(v.unit * o.qty)}` : t('panel.noPrice')}
                      </span>
                      {!readOnly && mine.length > 1 && (
                        <button
                          className="ghost small"
                          disabled={featured}
                          onClick={() => dispatch({ type: 'feature', slot: slotKey, uid: o.uid })}
                        >
                          {featured ? t('panel.featured') : t('panel.feature')}
                        </button>
                      )}
                      {!readOnly && (
                        <button className="ghost small danger" onClick={() => dispatch({ type: 'remove', uid: o.uid })}>
                          {t('panel.remove')}
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
            <h3>
              {t('panel.allCards')} {list && <span className="hint">({list.length})</span>}
            </h3>
            <input
              id="set-filter"
              type="search"
              placeholder={t('panel.filterSet')}
              value={setQuery}
              onChange={(e) => setSetQuery(e.target.value)}
            />
            <select
              id="card-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label={t('panel.sort')}
            >
              <option value="new">{t('panel.sortNew')}</option>
              <option value="old">{t('panel.sortOld')}</option>
              <option value="price-desc">{t('panel.sortPriceDesc')}</option>
              <option value="price-asc">{t('panel.sortPriceAsc')}</option>
            </select>
          </div>
          {list && loaded < list.length && (
            <p className="hint">{t('panel.loadingPrices', { n: loaded, total: list.length })}</p>
          )}
          {error && <p className="error">{t('panel.loadError')}</p>}
          {!list && !error && <p className="hint">{t('panel.searching', { name })}</p>}
          {list && list.length === 0 && <p className="hint">{t('panel.none', { name })}</p>}
          <ul className="card-grid">
            {sorted.map((c) => {
              const info = cards[c.id]
              const p = priceOf(info)
              const ownedQty = mine.filter((o) => o.cardId === c.id).reduce((n, o) => n + o.qty, 0)
              const wished = state.wishlist.some((w) => w.cardId === c.id)
              return (
                <li key={c.id} className={ownedQty ? 'owned' : ''}>
                  <button
                    className="card-img"
                    onClick={() => setPreview(info ?? c)}
                    aria-label={t('panel.zoom', { name: c.name })}
                  >
                    <CardImage
                      cardId={c.id}
                      localId={c.localId}
                      image={c.image}
                      name={c.name}
                      setName={info?.setName}
                      sprite={species.sprite}
                    />
                  </button>
                  <div className="card-info">
                    <strong title={c.name}>{c.name}</strong>
                    <span className="hint">
                      {info?.setName ?? c.id} · {c.localId}
                    </span>
                    {info?.rarity && <span className="rarity">{info.rarity}</span>}
                  </div>
                  <div className="card-foot">
                    <span className="money">
                      {info ? (p ? `${p.approx ? '≈ ' : ''}${fmtMoney(p.usd)}` : '—') : '…'}
                    </span>
                    {readOnly ? (
                      <>
                        {ownedQty > 0 && <span className="owned-tag">{t('panel.inCollection', { n: ownedQty })}</span>}
                        {wished && (
                          <span className="wish-tag" title={t('wish.theirs')}>
                            ♥
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="card-actions">
                        {!ownedQty && (
                          <button
                            className={wished ? 'wish-btn on' : 'wish-btn'}
                            onClick={() => toggleWish(c)}
                            aria-pressed={wished}
                            aria-label={wished ? t('wish.remove') : t('wish.add')}
                            title={wished ? t('wish.on') : t('wish.add')}
                          >
                            {wished ? '♥' : '♡'}
                          </button>
                        )}
                        <button className={ownedQty ? 'small owned-btn' : 'small'} onClick={() => add(c)}>
                          {ownedQty ? t('panel.owned', { n: ownedQty }) : t('panel.add')}
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {preview && (
          <div className="lightbox" onClick={() => setPreview(null)}>
            <CardImage
              key={preview.id}
              cardId={preview.id}
              localId={preview.localId}
              image={preview.image}
              name={preview.name}
              setName={'setName' in preview ? preview.setName : undefined}
              sprite={species.sprite}
              quality="high"
              className="lightbox-card"
              lazy={false}
            />
          </div>
        )}
      </aside>
    </div>
  )
}
