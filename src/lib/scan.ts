// Reconoce una carta a partir de una foto: OCR en el navegador (Tesseract.js) para leer
// el nombre del Pokémon y el número de la carta ("025/198"), y luego busca en TCGdex.
import { SLOTS, slotCandidates, type Slot } from './pokedex'
import { getCards, listCardsForDex, type CardBrief, type CardInfo } from './tcgdex'

export type ScanGuess = { slot?: Slot; number?: string; total?: string }

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9♀♂ ]/g, ' ')

// Nombres más largos primero, para que "Mega Charizard X" gane sobre "Charizard".
const NAMES = SLOTS.flatMap((slot) =>
  [...new Set([slot.en, slot.es])].map((name) => ({ slot, name: normalize(name).trim() })),
).sort((a, b) => b.name.length - a.name.length)

/**
 * La franja de abajo de la carta (donde va "025/198"), ampliada al doble y en escala de grises:
 * el número es tan chico que en la foto completa el OCR casi nunca lo lee bien.
 */
async function bottomStrip(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image)
  const top = Math.round(bitmap.height * 0.86)
  const h = bitmap.height - top
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width * 2
  canvas.height = h * 2
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(1) contrast(1.6)'
  ctx.drawImage(bitmap, 0, top, bitmap.width, h, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'),
  )
}

/**
 * Corre el OCR dos veces: la carta completa (para el nombre) y la franja de abajo solo con dígitos
 * (para el número). Tesseract se carga solo cuando se usa (pesa varios MB).
 */
export async function readCardText(
  image: Blob,
  onProgress?: (p: number) => void,
): Promise<{ text: string; bottom: string }> {
  const { createWorker } = await import('tesseract.js')
  let pass = 0
  const worker = await createWorker('eng', 1, {
    logger: (m) => m.status === 'recognizing text' && onProgress?.((pass + m.progress) / 2),
  })
  try {
    const { data } = await worker.recognize(image)
    pass = 1
    let bottom = ''
    try {
      await worker.setParameters({ tessedit_char_whitelist: '0123456789/ ' })
      bottom = (await worker.recognize(await bottomStrip(image))).data.text
    } catch {
      // sin la segunda pasada nos quedamos con lo que dio la primera
    }
    return { text: data.text, bottom }
  } finally {
    await worker.terminate()
  }
}

const FRACTION = /\b0*(\d{1,3})\s*\/\s*0*(\d{2,3})\b/

/** Un "número/total" creíble: los sets tienen entre 10 y 400 cartas oficiales. */
function fractionIn(text: string) {
  const m = text.match(FRACTION)
  return m && Number(m[2]) >= 10 && Number(m[2]) <= 400 ? m : null
}

/** Busca un nombre de Pokémon y un número de carta en el texto leído. */
export function guessFromText(text: string, bottom = ''): ScanGuess {
  const flat = ` ${normalize(text).replace(/\s+/g, ' ')} `
  // El nombre de la carta va arriba: gana el que aparece primero ("Furret" y no el "Sentret"
  // de "Evolves from Sentret"); a igual posición, el más largo ("Mega Charizard X").
  let found: (typeof NAMES)[number] | undefined
  let foundAt = Infinity
  for (const n of NAMES) {
    if (n.name.length < 3) continue
    const at = flat.indexOf(` ${n.name} `)
    if (at !== -1 && at < foundAt) {
      found = n
      foundAt = at
    }
  }
  // "025/198" (primero en la franja de abajo) o promos tipo "SWSH123", "SVP 045".
  const fraction = fractionIn(bottom) ?? fractionIn(text)
  const promo = text.match(/\b(SWSH|SVP?|SM|XY|BW|DP|HGSS)\s?0*(\d{1,3})\b/i)
  return {
    slot: found?.slot,
    number: fraction?.[1] ?? (promo ? `${promo[1].toUpperCase()}${promo[2]}` : undefined),
    total: fraction?.[2],
  }
}

/** Busca un Pokémon por nombre escrito a mano (español o inglés). */
export function findSlot(name: string): Slot | undefined {
  const q = normalize(name).trim()
  if (!q) return undefined
  return NAMES.find((n) => n.name === q)?.slot ?? NAMES.find((n) => n.name.startsWith(q))?.slot
}

const sameNumber = (localId: string, number: string) =>
  localId.replace(/^0+/, '').toLowerCase() === number.replace(/^0+/, '').toLowerCase() ||
  localId.toLowerCase().endsWith(number.toLowerCase())

/**
 * Cartas candidatas para un Pokémon y (si lo hay) un número. Con número, las que coinciden van primero
 * y, si se leyó el total del set, se prefieren los sets con ese total.
 */
export async function findCandidates(
  slot: Slot,
  number?: string,
  total?: string,
): Promise<{ cards: CardInfo[]; exact: boolean }> {
  const list: CardBrief[] = (await listCardsForDex(slot.dex)).filter((c) =>
    slotCandidates(slot.dex, c.name).includes(slot.key),
  )
  const matching = number ? list.filter((c) => sameNumber(c.localId, number)) : []
  const pick = matching.length ? matching : list.slice(0, 24)
  const infos: CardInfo[] = []
  await getCards(
    pick.map((c) => c.id),
    (card) => infos.push(card),
  )
  if (matching.length && total) {
    infos.sort((a, b) => Number(b.setTotal === Number(total)) - Number(a.setTotal === Number(total)))
  }
  return { cards: infos, exact: matching.length > 0 }
}
