import pokedex from '../data/pokedex.json'
import forms from '../data/forms.json'

export type Species = { id: number; en: string; es: string }
export type Region = 'alola' | 'galar' | 'hisui' | 'paldea'
export type FormGroup = Region | 'mega' | 'other'

/**
 * Una casilla de la Pokédex: una especie ("25"), una forma regional ("52-alola"),
 * una Mega ("6-mega-x", "382-primal") u otra forma ("479-heat").
 */
export type Slot = {
  key: string
  dex: number
  group?: FormGroup
  /** id de PokeAPI para el sprite (distinto al número de Pokédex en las formas) */
  sprite: number
  en: string
  es: string
}

export const SPECIES: Species[] = pokedex
export const TOTAL_SPECIES = SPECIES.length

const speciesSlots: Slot[] = SPECIES.map((s) => ({ key: String(s.id), dex: s.id, sprite: s.id, en: s.en, es: s.es }))
const formSlots: Slot[] = (forms as (Omit<Slot, 'group'> & { group: string })[]).map((f) => ({
  ...f,
  group: f.group as FormGroup,
}))

/** Megas y otras formas: secciones extra que no cuentan para el avance principal. */
export const isExtra = (slot: Slot) => slot.group === 'mega' || slot.group === 'other'

/** Todas las casillas en orden: especies, formas regionales y extras. */
export const SLOTS: Slot[] = [...speciesSlots, ...formSlots]
/** Casillas que cuentan para la Pokédex completa (especies + formas regionales). */
export const MAIN_SLOTS = SLOTS.filter((s) => !isExtra(s))
export const TOTAL_SLOTS = MAIN_SLOTS.length

const slotMap = new Map(SLOTS.map((s) => [s.key, s]))
export const slotByKey = (key: string) => slotMap.get(key)

export const GENERATIONS = [
  { gen: 1, region: 'Kanto', from: 1, to: 151 },
  { gen: 2, region: 'Johto', from: 152, to: 251 },
  { gen: 3, region: 'Hoenn', from: 252, to: 386 },
  { gen: 4, region: 'Sinnoh', from: 387, to: 493 },
  { gen: 5, region: 'Unova', from: 494, to: 649 },
  { gen: 6, region: 'Kalos', from: 650, to: 721 },
  { gen: 7, region: 'Alola', from: 722, to: 809 },
  { gen: 8, region: 'Galar', from: 810, to: 905 },
  { gen: 9, region: 'Paldea', from: 906, to: 1025 },
]

export const REGIONS: { id: Region; title: string; cardPrefix: string }[] = [
  { id: 'alola', title: 'Formas de Alola', cardPrefix: 'Alolan' },
  { id: 'galar', title: 'Formas de Galar', cardPrefix: 'Galarian' },
  { id: 'hisui', title: 'Formas de Hisui', cardPrefix: 'Hisuian' },
  { id: 'paldea', title: 'Formas de Paldea', cardPrefix: 'Paldean' },
]

export type Section = { id: string; title: string; subtitle?: string; extra?: boolean; slots: Slot[] }

/** Secciones de la Pokédex: generaciones, formas regionales y, al final, los extras. */
export const SECTIONS: Section[] = [
  ...GENERATIONS.map((g) => ({
    id: `gen${g.gen}`,
    title: `Gen ${g.gen}`,
    subtitle: g.region,
    slots: speciesSlots.slice(g.from - 1, g.to),
  })),
  ...REGIONS.map((r) => ({ id: r.id, title: r.title, slots: formSlots.filter((f) => f.group === r.id) })),
  { id: 'mega', title: 'Megas', subtitle: 'extra', extra: true, slots: formSlots.filter((f) => f.group === 'mega') },
  {
    id: 'other',
    title: 'Rotom y Wormadam',
    subtitle: 'extra',
    extra: true,
    slots: formSlots.filter((f) => f.group === 'other'),
  },
]

const ROTOM_FORMS: Record<string, string> = { Heat: 'heat', Wash: 'wash', Frost: 'frost', Fan: 'fan', Mow: 'mow' }

/**
 * Casillas candidatas de una carta para cierto número de Pokédex, según su nombre:
 * "Alolan Vulpix" → 37-alola, "M Charizard EX" → 6-mega-x y 6-mega-y (el nombre no dice cuál),
 * "Mega Charizard X ex" → 6-mega-x, "Heat Rotom" → 479-heat. Si nada aplica, la especie.
 */
export function slotCandidates(dex: number, cardName: string): string[] {
  const base = [String(dex)]
  // Las cartas tag team ("Mega Sableye & Tyranitar GX") van con la especie.
  if (cardName.includes('&')) return base

  const region = REGIONS.find((r) => cardName.startsWith(`${r.cardPrefix} `))
  if (region) return existing([`${dex}-${region.id}`], base)

  if (/^Primal /.test(cardName)) return existing([`${dex}-primal`], base)

  // XY: "M Charizard EX" / "M Lucario-EX". Mega Evolution: "Mega Charizard X ex".
  const mega = cardName.match(/^M (.+?)[ -]EX\b/) ?? cardName.match(/^Mega (.+?) ex\b/)
  if (mega) {
    const letter = mega[1].match(/ ([XYZ])$/)?.[1]
    if (letter) return existing([`${dex}-mega-${letter.toLowerCase()}`], base)
    const all = SLOTS.filter((s) => s.dex === dex && s.group === 'mega' && s.key.startsWith(`${dex}-mega`))
    // Sin letra: la Mega normal si existe; si solo hay X/Y/Z, cualquiera de ellas.
    const plain = all.find((s) => s.key === `${dex}-mega`)
    return plain ? [plain.key] : all.length ? all.map((s) => s.key) : base
  }

  const rotom = cardName.match(/^(Heat|Wash|Frost|Fan|Mow) Rotom\b/)
  if (rotom) return existing([`${dex}-${ROTOM_FORMS[rotom[1]]}`], base)

  const cloak = cardName.match(/^Wormadam (Sandy|Trash) Cloak/)
  if (cloak) return existing([`${dex}-${cloak[1].toLowerCase()}`], base)

  return base
}

const existing = (keys: string[], fallback: string[]) => {
  const found = keys.filter((k) => slotMap.has(k))
  return found.length ? found : fallback
}

export const spriteUrl = (sprite: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${sprite}.png`

export const dexNo = (id: number) => `#${String(id).padStart(4, '0')}`
