// Exporta la colección a CSV (se abre directo en Excel, Google Sheets o Numbers).
import type { CollectionState } from './store'
import type { CardInfo } from './tcgdex'
import { ownedValue } from './value'
import { displayCurrency, toDisplay } from './money'
import { dexNo, slotByKey, type Slot } from './pokedex'

type Labels = {
  headers: string[]
  slotName: (slot: Slot) => string
  variantLabel: (variant: string) => string
  source: (source: 'manual' | 'market' | 'condition' | 'none') => string
}

function csvCell(value: string | number) {
  const s = String(value)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function collectionCsv(state: CollectionState, cards: Record<string, CardInfo>, labels: Labels): string {
  const currency = displayCurrency()
  const rows = state.owned.map((o) => {
    const info = cards[o.cardId]
    const v = ownedValue(o, info)
    const slots = o.slots.map((k) => slotByKey(k)).filter((s): s is Slot => !!s)
    const unit = v ? toDisplay(v.unit).amount : null
    return [
      slots.map((s) => dexNo(s.dex)).join(' / '),
      slots.map((s) => labels.slotName(s)).join(' / '),
      info?.name ?? o.cardId,
      info?.setName ?? '',
      info?.localId ?? '',
      info?.rarity ?? '',
      labels.variantLabel(o.variant),
      o.condition ?? 'NM',
      o.grade ? `${o.grade.company} ${o.grade.score}` : '',
      o.qty,
      unit != null ? unit.toFixed(2) : '',
      unit != null ? (unit * o.qty).toFixed(2) : '',
      currency,
      labels.source(v?.source ?? 'none'),
      o.cardId,
    ]
  })
  // BOM para que Excel abra bien los acentos.
  return '﻿' + [labels.headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
