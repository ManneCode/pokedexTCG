// Valor de una carta de la colección según su precio de mercado, condición, gradeo o precio manual.
import { priceOf, type CardInfo } from './tcgdex'
import type { CollectionState, Condition, OwnedCard } from './store'
import { isExtra, slotByKey } from './pokedex'

export const CONDITIONS: Condition[] = ['NM', 'LP', 'MP', 'HP', 'DMG']

/**
 * Descuento aproximado sobre el precio Near Mint de TCGplayer. Es la regla que usa mucha gente
 * para cartas sueltas; para cartas caras conviene poner un precio manual.
 */
export const CONDITION_FACTOR: Record<Condition, number> = { NM: 1, LP: 0.85, MP: 0.7, HP: 0.5, DMG: 0.35 }

export type ValueSource = 'manual' | 'market' | 'condition'

export type OwnedValue = {
  /** Valor por copia en USD */
  unit: number
  /** true si viene de Cardmarket convertido o de un descuento por condición */
  approx: boolean
  source: ValueSource
} | null

export function ownedValue(owned: OwnedCard, card: CardInfo | undefined): OwnedValue {
  if (owned.customPrice != null && owned.customPrice >= 0)
    return { unit: owned.customPrice, approx: false, source: 'manual' }
  const market = priceOf(card, owned.variant)
  if (!market) return null
  const condition = owned.condition ?? 'NM'
  // Una carta gradeada sin precio manual se queda con el precio de mercado sin gradear.
  if (owned.grade || condition === 'NM') return { unit: market.usd, approx: market.approx, source: 'market' }
  return { unit: market.usd * CONDITION_FACTOR[condition], approx: true, source: 'condition' }
}

export type CollectionTotals = { usd: number; approx: boolean; unpriced: number; cards: number }

export function collectionTotals(state: CollectionState, cards: Record<string, CardInfo>): CollectionTotals {
  let usd = 0
  let approx = false
  let unpriced = 0
  for (const o of state.owned) {
    const v = ownedValue(o, cards[o.cardId])
    if (!v) unpriced += o.qty
    else {
      usd += v.unit * o.qty
      approx ||= v.approx
    }
  }
  return { usd, approx, unpriced, cards: state.owned.reduce((n, o) => n + o.qty, 0) }
}

/** Cuántas casillas de la Pokédex principal (sin Megas ni otras formas) tienen al menos una carta. */
export function mainSlotsWithCard(state: CollectionState): Set<string> {
  return new Set(
    state.owned
      .flatMap((o) => o.slots)
      .filter((key) => {
        const slot = slotByKey(key)
        return !!slot && !isExtra(slot)
      }),
  )
}

/** Resumen que se guarda junto a la colección para el ranking de Explorar. */
export function collectionSummary(state: CollectionState, cards: Record<string, CardInfo>) {
  const totals = collectionTotals(state, cards)
  return {
    with_card: mainSlotsWithCard(state).size,
    total_cards: totals.cards,
    value_usd: Math.round(totals.usd * 100) / 100,
  }
}

/** Fecha local AAAA-MM-DD, para la foto diaria del historial. */
export function todayKey(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
