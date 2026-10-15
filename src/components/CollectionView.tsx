import { useMemo, useState } from 'react'
import { useCollection } from '../lib/store'
import { useCards } from '../lib/cards'
import { cardImage, fmtUsd, priceOf, variantLabel } from '../lib/tcgdex'
import { SLOTS, dexNo, slotByKey } from '../lib/pokedex'

type Sort = 'value' | 'dex' | 'recent'

const slotOrder = (key?: string) => (key ? SLOTS.findIndex((s) => s.key === key) : -1)

export default function CollectionView({ onOpen }: { onOpen: (slot: string) => void }) {
  const { state } = useCollection()
  const { cards } = useCards()
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
        <h2>Todavía no tienes cartas registradas</h2>
        <p>Abre un Pokémon en la Pokédex y toca "La tengo" en la carta que tienes.</p>
      </div>
    )
  }

  return (
    <div className="collection">
      <div className="toolbar">
        <label htmlFor="collection-sort">Ordenar por</label>
        <select id="collection-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="value">Valor</option>
          <option value="dex">Número de Pokédex</option>
          <option value="recent">Agregadas recientemente</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th />
              <th>Carta</th>
              <th>Pokémon</th>
              <th>Variante</th>
              <th className="num">Cant.</th>
              <th className="num">Precio</th>
              <th className="num">Subtotal</th>
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
                      {dexNo(slotByKey(k)?.dex ?? 0)} {slotByKey(k)?.es}
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
              <td colSpan={6}>Total</td>
              <td className="num money">{fmtUsd(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
