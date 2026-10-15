import { useEffect, useMemo, useState } from 'react'
import { useCollection } from '../lib/store'
import { useCards } from '../lib/cards'
import { cardImage, priceOf, type CardInfo } from '../lib/tcgdex'
import { fmtMoney } from '../lib/money'
import { ownedValue, todayKey } from '../lib/value'
import { collectionCsv, downloadText } from '../lib/export'
import { useI18n, type MessageKey } from '../i18n'
import { SLOTS, dexNo, slotByKey } from '../lib/pokedex'
import ValueHistory from './ValueHistory'

type View = 'owned' | 'wishlist' | 'history'
type Sort = 'value' | 'dex' | 'recent'

const slotOrder = (key?: string) => (key ? SLOTS.findIndex((s) => s.key === key) : -1)

const VIEWS: { id: View; label: MessageKey }[] = [
  { id: 'owned', label: 'col.tabOwned' },
  { id: 'wishlist', label: 'col.tabWishlist' },
  { id: 'history', label: 'col.tabHistory' },
]

export default function CollectionView({ onOpen }: { onOpen: (slot: string) => void }) {
  const { state } = useCollection()
  const { t } = useI18n()
  const [view, setView] = useState<View>('owned')

  return (
    <div className="collection">
      <div className="segmented col-tabs" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            className={view === v.id ? 'on' : ''}
            onClick={() => setView(v.id)}
          >
            {t(v.label)}
            {v.id === 'wishlist' && state.wishlist.length > 0 && <span className="count">{state.wishlist.length}</span>}
          </button>
        ))}
      </div>
      {view === 'owned' && <OwnedTable onOpen={onOpen} />}
      {view === 'wishlist' && <Wishlist onOpen={onOpen} />}
      {view === 'history' && <ValueHistory />}
    </div>
  )
}

function SlotNames({ slots }: { slots: string[] }) {
  const { slotName } = useI18n()
  return (
    <>
      {slots.map((k) => {
        const slot = slotByKey(k)
        return (
          <span key={k} className="hint">
            {dexNo(slot?.dex ?? 0)} {slot && slotName(slot)}
          </span>
        )
      })}
    </>
  )
}

function CardCell({ info, cardId }: { info?: CardInfo; cardId: string }) {
  return (
    <>
      <strong>{info?.name ?? cardId}</strong>
      <span className="hint">
        {info?.setName ?? '…'} · {info?.localId}
      </span>
    </>
  )
}

function OwnedTable({ onOpen }: { onOpen: (slot: string) => void }) {
  const { state } = useCollection()
  const { cards } = useCards()
  const { t, slotName, variantLabel } = useI18n()
  const [sort, setSort] = useState<Sort>('value')

  const rows = useMemo(() => {
    const r = state.owned.map((o) => {
      const info = cards[o.cardId]
      const v = ownedValue(o, info)
      return { o, info, unit: v?.unit ?? null, approx: v?.approx ?? false, total: (v?.unit ?? 0) * o.qty }
    })
    return r.sort((a, b) => {
      if (sort === 'value') return b.total - a.total
      if (sort === 'dex') return slotOrder(a.o.slots[0]) - slotOrder(b.o.slots[0])
      return b.o.addedAt.localeCompare(a.o.addedAt)
    })
  }, [state.owned, cards, sort])

  const total = rows.reduce((n, r) => n + r.total, 0)

  function exportCsv() {
    const csv = collectionCsv(state, cards, {
      headers: [
        '#',
        t('col.pokemon'),
        t('col.card'),
        'Set',
        t('export.number'),
        t('export.rarity'),
        t('col.variant'),
        t('details.condition'),
        t('details.grade'),
        t('col.qty'),
        t('col.price'),
        t('col.subtotal'),
        t('export.currency'),
        t('export.source'),
        'TCGdex ID',
      ],
      slotName,
      variantLabel,
      source: (s) => t(`export.source.${s}`),
    })
    downloadText(`pokedex-tcg-${todayKey()}.csv`, csv)
  }

  if (!rows.length) {
    return (
      <div className="empty">
        <h2>{t('col.emptyTitle')}</h2>
        <p>{t('col.emptyText')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="toolbar">
        <label htmlFor="collection-sort">{t('col.sortBy')}</label>
        <select id="collection-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="value">{t('col.sortValue')}</option>
          <option value="dex">{t('col.sortDex')}</option>
          <option value="recent">{t('col.sortRecent')}</option>
        </select>
        <button className="ghost small push-right" onClick={exportCsv}>
          {t('export.button')}
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th />
              <th>{t('col.card')}</th>
              <th>{t('col.pokemon')}</th>
              <th>{t('col.variant')}</th>
              <th>{t('details.condition')}</th>
              <th className="num">{t('col.qty')}</th>
              <th className="num">{t('col.price')}</th>
              <th className="num">{t('col.subtotal')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, info, unit, approx, total }) => (
              <tr key={o.uid} onClick={() => onOpen(o.slots[0])}>
                <td>{info?.image ? <img src={cardImage(info.image)} alt="" loading="lazy" /> : null}</td>
                <td>
                  <CardCell info={info} cardId={o.cardId} />
                </td>
                <td>
                  <SlotNames slots={o.slots} />
                </td>
                <td>{variantLabel(o.variant)}</td>
                <td>
                  {o.condition ?? 'NM'}
                  {o.grade && (
                    <span className="badge graded">
                      {o.grade.company} {o.grade.score}
                    </span>
                  )}
                </td>
                <td className="num">{o.qty}</td>
                <td className="num">
                  {unit != null ? `${approx ? '≈ ' : ''}${fmtMoney(unit)}` : '—'}
                  {o.customPrice != null && <span className="hint block">{t('col.manual')}</span>}
                </td>
                <td className="num money">{unit != null ? fmtMoney(total) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7}>{t('col.total')}</td>
              <td className="num money">{fmtMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}

function Wishlist({ onOpen }: { onOpen: (slot: string) => void }) {
  const { state, dispatch, readOnly } = useCollection()
  const { cards, ensure } = useCards()
  const { t, variantLabel } = useI18n()

  const ids = useMemo(() => state.wishlist.map((w) => w.cardId), [state.wishlist])
  useEffect(() => {
    if (ids.length) void ensure(ids)
  }, [ids, ensure])

  const rows = state.wishlist
    .map((w) => {
      const info = cards[w.cardId]
      const p = priceOf(info, w.variant)
      return { w, info, unit: p?.usd ?? null, approx: p?.approx ?? false }
    })
    .sort((a, b) => (b.unit ?? -1) - (a.unit ?? -1))
  const total = rows.reduce((n, r) => n + (r.unit ?? 0), 0)
  const unpriced = rows.filter((r) => r.unit == null).length

  if (!rows.length) {
    return (
      <div className="empty">
        <h2>{readOnly ? t('wish.emptyTheirs') : t('wish.emptyTitle')}</h2>
        {!readOnly && <p>{t('wish.emptyText')}</p>}
      </div>
    )
  }

  return (
    <>
      <div className="wish-total">
        <span className="label">{t('wish.total')}</span>
        <span className="money big">{fmtMoney(total)}</span>
        <span className="hint">
          {t('wish.count', { n: rows.length })}
          {unpriced > 0 && ` · ${t('stats.unpriced', { n: unpriced })}`}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th />
              <th>{t('col.card')}</th>
              <th>{t('col.pokemon')}</th>
              <th>{t('col.variant')}</th>
              <th className="num">{t('col.price')}</th>
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ w, info, unit, approx }) => (
              <tr key={w.uid} onClick={() => onOpen(w.slots[0])}>
                <td>{info?.image ? <img src={cardImage(info.image)} alt="" loading="lazy" /> : null}</td>
                <td>
                  <CardCell info={info} cardId={w.cardId} />
                </td>
                <td>
                  <SlotNames slots={w.slots} />
                </td>
                <td>{variantLabel(w.variant)}</td>
                <td className="num money">{unit != null ? `${approx ? '≈ ' : ''}${fmtMoney(unit)}` : '—'}</td>
                {!readOnly && (
                  <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="small"
                      onClick={() => dispatch({ type: 'add', cardId: w.cardId, slots: w.slots, variant: w.variant })}
                    >
                      {t('wish.got')}
                    </button>
                    <button className="ghost small" onClick={() => dispatch({ type: 'wishRemove', uid: w.uid })}>
                      {t('panel.remove')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
