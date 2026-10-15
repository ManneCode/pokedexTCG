import { useMemo, useState } from 'react'
import { useCollection } from '../lib/store'
import { useCards } from '../lib/cards'
import { cardImage, fmtUsd, priceOf } from '../lib/tcgdex'
import { useI18n } from '../i18n'
import { SLOTS, dexNo, slotByKey } from '../lib/pokedex'

type Sort = 'value' | 'dex' | 'recent'

const slotOrder = (key?: string) => (key ? SLOTS.findIndex((s) => s.key === key) : -1)

export default function CollectionView({ onOpen }: { onOpen: (slot: string) => void }) {
  const { state } = useCollection()
  const { cards } = useCards()
  const { t, slotName, variantLabel } = useI18n()
  const [sort, setSort] = useState<Sort>('value')

  const rows = useMemo(() => {
    const r = state.owned.map((o) => {
      const info = cards[o.cardId]
      const p = priceOf(info, o.variant)
      return { o, info, unit: p?.usd ?? null, approx: p?.approx ?? false, total: (p?.usd ?? 0) * o.qty }
    })
    return r.sort((a, b) => {
      if (sort === 'value') return b.total - a.total
      if (sort === 'dex') return slotOrder(a.o.slots[0]) - slotOrder(b.o.slots[0])
      return b.o.addedAt.localeCompare(a.o.addedAt)
    })
  }, [state.owned, cards, sort])

  const total = rows.reduce((n, r) => n + r.total, 0)

  if (!rows.length) {
    return (
      <div className="empty">
        <h2>{t('col.emptyTitle')}</h2>
        <p>{t('col.emptyText')}</p>
      </div>
    )
  }

  return (
    <div className="collection">
      <div className="toolbar">
        <label htmlFor="collection-sort">{t('col.sortBy')}</label>
        <select id="collection-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="value">{t('col.sortValue')}</option>
          <option value="dex">{t('col.sortDex')}</option>
          <option value="recent">{t('col.sortRecent')}</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th />
              <th>{t('col.card')}</th>
              <th>{t('col.pokemon')}</th>
              <th>{t('col.variant')}</th>
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
                  <strong>{info?.name ?? o.cardId}</strong>
                  <span className="hint">
                    {info?.setName ?? '…'} · {info?.localId}
                  </span>
                </td>
                <td>
                  {o.slots.map((k) => (
                    <span key={k} className="hint">
                      {dexNo(slotByKey(k)?.dex ?? 0)} {slotByKey(k) && slotName(slotByKey(k)!)}
                    </span>
                  ))}
                </td>
                <td>{variantLabel(o.variant)}</td>
                <td className="num">{o.qty}</td>
                <td className="num">{unit != null ? `${approx ? '≈ ' : ''}${fmtUsd(unit)}` : '—'}</td>
                <td className="num money">{unit != null ? fmtUsd(total) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>{t('col.total')}</td>
              <td className="num money">{fmtUsd(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
