// Cliente de TCGdex (https://tcgdex.dev): listado de cartas por Pokémon, detalle y precios.
import { SPECIES } from './pokedex'

const API = 'https://api.tcgdex.net/v2/en'

/** Euros → dólares, solo para cartas sin precio en TCGplayer. */
export const EUR_TO_USD = 1.15

/** Series que no son cartas físicas (TCG Pocket es un juego de celular). */
const EXCLUDED_SERIES = new Set(['tcgp'])
/** Ids de sets de TCG Pocket (A1, A2b, B2a, P-A…). */
const POCKET_ID = /^(A\d|B\d|P-A)/

const PRICE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_KEY = 'pkt-cards-v2'
const LIST_KEY = 'pkt-lists-v2'
/** Las listas se renuevan seguido para que aparezcan los sets nuevos. */
const LIST_TTL_MS = 2 * 24 * 60 * 60 * 1000

export type CardBrief = { id: string; localId: string; name: string; image?: string }

export type CardInfo = {
  id: string
  name: string
  localId: string
  image?: string
  rarity?: string
  setId: string
  setName: string
  /** Cartas oficiales del set (el "198" de "025/198") */
  setTotal?: number
  series?: string
  dexIds: number[]
  /** Variantes con precio de TCGplayer (USD, market price). */
  usd: Record<string, number>
  /** Precio promedio de Cardmarket (EUR): normal y holo/reverse. */
  eur?: { normal?: number; holo?: number }
  /** Variantes que existen físicamente aunque no tengan precio. */
  variants: string[]
  fetchedAt: number
}

/** Serie a partir de la URL de imagen: .../en/{serie}/{set}/{num} */
export const seriesOf = (image?: string) => image?.split('/')[4]

export const cardImage = (image: string | undefined, quality: 'low' | 'high' = 'low') =>
  image ? `${image}/${quality}.webp` : undefined

/** Set de pokemontcg.io equivalente a uno de TCGdex (sv03.5 → sv3pt5, sm3.5 → sm35, me01 → me1). */
function ptcgSetId(setId: string): string {
  const special: Record<string, string> = { 'swsh12.5': 'swsh12pt5', 'swsh12.5gg': 'swsh12pt5gg', cel25cc: 'cel25c' }
  if (special[setId]) return special[setId]
  // Colecciones de McDonald's: "2021swsh" → "mcd21".
  const mcd = setId.match(/^20(\d\d)(bw|xy|sm|swsh|sv)$/)
  if (mcd) return `mcd${mcd[1]}`
  const half = setId.match(/^(sv|me)0?(\d+)\.5(.*)$/)
  if (half) return `${half[1]}${half[2]}pt5${half[3]}`
  const numbered = setId.match(/^(sv|me)0?(\d+)(.*)$/)
  if (numbered) return `${numbered[1]}${numbered[2]}${numbered[3]}`
  return setId.replace(/\./g, '')
}

/**
 * Imagen de respaldo en el banco de pokemontcg.io para cartas que TCGdex no tiene ilustradas.
 * Los números puramente numéricos van sin ceros ("001" → "1"); los de promos con letras se quedan igual.
 */
export function fallbackImage(cardId: string, localId: string, quality: 'low' | 'high' = 'low') {
  const setId = cardId.slice(0, cardId.length - localId.length - 1)
  if (!setId) return undefined
  const number = /^\d+$/.test(localId) ? String(Number(localId)) : localId
  return `https://images.pokemontcg.io/${ptcgSetId(setId)}/${number}${quality === 'high' ? '_hires' : ''}.png`
}

// ---------- caché local ----------

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // almacenamiento lleno o bloqueado: seguimos sin caché
  }
}

const cardCache: Record<string, CardInfo> = readJson(CACHE_KEY, {})
const listCache: Record<number, { at: number; cards: CardBrief[] }> = readJson(LIST_KEY, {})
let saveTimer: number | undefined

function persistCards() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => writeJson(CACHE_KEY, cardCache), 400)
}

export const getCachedCard = (id: string): CardInfo | undefined => cardCache[id]

// ---------- llamadas ----------

let seriesOrder: string[] | null = null

/** Orden cronológico de las series (Base, Gym, Neo... Scarlet & Violet). */
export async function getSeriesOrder(): Promise<string[]> {
  if (seriesOrder) return seriesOrder
  const res = await fetch(`${API}/series`)
  const data: { id: string }[] = await res.json()
  seriesOrder = data.map((s) => s.id)
  return seriesOrder
}

/** Busca cartas en TCGdex y quita las de TCG Pocket. */
async function fetchBriefs(query: string): Promise<CardBrief[]> {
  const res = await fetch(`${API}/cards?${query}`)
  if (!res.ok) throw new Error(`TCGdex respondió ${res.status}`)
  const all: CardBrief[] = await res.json()
  return all.filter((c) => !EXCLUDED_SERIES.has(seriesOf(c.image) ?? '') && !POCKET_ID.test(c.id))
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Cartas de un Pokémon. Se buscan por número de Pokédex y también por nombre, porque TCGdex
 * tarda unas semanas en ponerle el número a las cartas de los sets recién salidos
 * (p. ej. 30th Celebration). Del resultado por nombre solo se agregan las que no vinieron
 * por número y cuyo nombre lleva la palabra exacta ("Mew" no trae a "Mewtwo").
 */
export async function listCardsForDex(dex: number): Promise<CardBrief[]> {
  const cached = listCache[dex]
  if (cached && Date.now() - cached.at < LIST_TTL_MS) return cached.cards
  const name = SPECIES[dex - 1]?.en
  const [byDex, byName] = await Promise.all([
    fetchBriefs(`dexId=eq:${dex}`),
    name ? fetchBriefs(`name=${encodeURIComponent(name)}`).catch(() => []) : Promise.resolve([]),
  ])
  const seen = new Set(byDex.map((c) => c.id))
  const word = name ? new RegExp(`(^|[^A-Za-z])${escapeRe(name)}($|[^A-Za-z])`, 'i') : null
  const extra = byName.filter((c) => !seen.has(c.id) && word?.test(c.name))
  const cards = [...byDex, ...extra]
  listCache[dex] = { at: Date.now(), cards }
  writeJson(LIST_KEY, listCache)
  return cards
}

type RawCard = {
  id: string
  localId: string
  name: string
  image?: string
  rarity?: string
  dexId?: number[]
  set: { id: string; name: string; cardCount?: { official?: number } }
  variants?: Record<string, boolean>
  pricing?: {
    tcgplayer?: Record<string, { marketPrice?: number | null; midPrice?: number | null } | string>
    cardmarket?: Record<string, number | string | null>
  }
}

function toCardInfo(raw: RawCard): CardInfo {
  const usd: Record<string, number> = {}
  for (const [key, val] of Object.entries(raw.pricing?.tcgplayer ?? {})) {
    if (typeof val !== 'object' || val === null) continue
    const price = val.marketPrice ?? val.midPrice
    if (price) usd[key] = price
  }
  const cm = raw.pricing?.cardmarket
  const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined)
  const eur = cm
    ? { normal: num(cm.avg) ?? num(cm.trend), holo: num(cm['avg-holo']) ?? num(cm['trend-holo']) }
    : undefined
  const variants = Object.keys(usd).length
    ? Object.keys(usd)
    : Object.entries(raw.variants ?? { normal: true })
        .filter(([, on]) => on)
        .map(([k]) => k)
  return {
    id: raw.id,
    name: raw.name,
    localId: raw.localId,
    image: raw.image,
    rarity: raw.rarity,
    setId: raw.set.id,
    setName: raw.set.name,
    setTotal: raw.set.cardCount?.official,
    series: seriesOf(raw.image),
    dexIds: raw.dexId ?? [],
    usd,
    eur,
    variants: variants.length ? variants : ['normal'],
    fetchedAt: Date.now(),
  }
}

const inflight = new Map<string, Promise<CardInfo>>()

export async function getCard(id: string, { force = false } = {}): Promise<CardInfo> {
  const cached = cardCache[id]
  if (!force && cached && Date.now() - cached.fetchedAt < PRICE_TTL_MS) return cached
  const pending = inflight.get(id)
  if (pending) return pending
  const p = fetch(`${API}/cards/${encodeURIComponent(id)}`)
    .then((r) => {
      if (!r.ok) throw new Error(`TCGdex respondió ${r.status}`)
      return r.json() as Promise<RawCard>
    })
    .then((raw) => {
      const info = toCardInfo(raw)
      cardCache[id] = info
      persistCards()
      return info
    })
    .finally(() => inflight.delete(id))
  inflight.set(id, p)
  return p
}

/** Descarga varias cartas con concurrencia limitada, avisando cada una que llega. */
export async function getCards(
  ids: string[],
  onCard: (card: CardInfo) => void,
  { force = false, concurrency = 8, signal }: { force?: boolean; concurrency?: number; signal?: AbortSignal } = {},
) {
  const queue = [...ids]
  const worker = async () => {
    while (queue.length && !signal?.aborted) {
      const id = queue.shift()!
      try {
        onCard(await getCard(id, { force }))
      } catch {
        // una carta fallida no detiene las demás
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker))
}

// ---------- precios ----------

export type Price = { usd: number; approx: boolean } | null

const isHoloVariant = (v: string) => /holo|reverse/.test(v)

/** Precio en USD de una variante; si TCGplayer no la tiene, usa Cardmarket convertido. */
export function priceOf(card: CardInfo | undefined, variant?: string): Price {
  if (!card) return null
  const v = variant ?? defaultVariant(card)
  if (card.usd[v] != null) return { usd: card.usd[v], approx: false }
  const eur = isHoloVariant(v) ? (card.eur?.holo ?? card.eur?.normal) : card.eur?.normal
  if (eur) return { usd: eur * EUR_TO_USD, approx: true }
  return null
}

/** Variante "principal": normal si existe, si no la primera con precio. */
export function defaultVariant(card: CardInfo): string {
  if (card.variants.includes('normal')) return 'normal'
  return card.variants[0]
}
