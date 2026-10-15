// Cliente de TCGdex (https://tcgdex.dev): listado de cartas por Pokémon, detalle y precios.
const API = 'https://api.tcgdex.net/v2/en'

/** Euros → dólares, solo para cartas sin precio en TCGplayer. */
export const EUR_TO_USD = 1.15

/** Series que no son cartas físicas (TCG Pocket es un juego de celular). */
const EXCLUDED_SERIES = new Set(['tcgp'])

const PRICE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_KEY = 'pkt-cards-v1'
const LIST_KEY = 'pkt-lists-v1'

export type CardBrief = { id: string; localId: string; name: string; image?: string }

export type CardInfo = {
  id: string
  name: string
  localId: string
  image?: string
  rarity?: string
  setId: string
  setName: string
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

export const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal',
  holofoil: 'Holo',
  'reverse-holofoil': 'Reverse holo',
  reverse: 'Reverse holo',
  holo: 'Holo',
  firstEdition: '1ª edición',
  '1st-edition': '1ª edición',
  '1st-edition-holofoil': '1ª edición holo',
  '1st-edition-normal': '1ª edición',
  'unlimited-holofoil': 'Unlimited holo',
  wPromo: 'Promo W',
}

export const variantLabel = (v: string) => VARIANT_LABELS[v] ?? v

/** Serie a partir de la URL de imagen: .../en/{serie}/{set}/{num} */
export const seriesOf = (image?: string) => image?.split('/')[4]

export const cardImage = (image: string | undefined, quality: 'low' | 'high' = 'low') =>
  image ? `${image}/${quality}.webp` : undefined

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

export async function listCardsForDex(dex: number): Promise<CardBrief[]> {
  const cached = listCache[dex]
  if (cached && Date.now() - cached.at < 7 * PRICE_TTL_MS) return cached.cards
  const res = await fetch(`${API}/cards?dexId=eq:${dex}`)
  if (!res.ok) throw new Error(`TCGdex respondió ${res.status}`)
  const all: CardBrief[] = await res.json()
  const cards = all.filter((c) => !EXCLUDED_SERIES.has(seriesOf(c.image) ?? ''))
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
  set: { id: string; name: string }
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

export const fmtUsd = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
