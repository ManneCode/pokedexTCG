// Genera src/data/pokedex.json con los 1025 Pokémon (nombre en inglés y español) y
// src/data/forms.json con formas regionales, Megas y otras formas, a partir de los CSV públicos de PokeAPI.
// Uso: node scripts/build-pokedex.mjs
import { writeFileSync, mkdirSync } from 'node:fs'

const CSV_URL =
  'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv'
const MAX_DEX = 1025
const LANG_ES = 7
const LANG_EN = 9

const csv = await (await fetch(CSV_URL)).text()
const byId = new Map()
for (const line of csv.split('\n').slice(1)) {
  const [id, lang, name] = line.split(',')
  const n = Number(id)
  if (!n || n > MAX_DEX) continue
  const entry = byId.get(n) ?? { id: n }
  if (Number(lang) === LANG_EN) entry.en = name
  if (Number(lang) === LANG_ES) entry.es = name
  byId.set(n, entry)
}

const list = [...byId.values()].sort((a, b) => a.id - b.id)
if (list.length !== MAX_DEX || list.some((p) => !p.en)) {
  throw new Error(`Lista incompleta: ${list.length} especies`)
}
for (const p of list) p.es ??= p.en

const POKEMON_URL = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv'
const pokemonCsv = await (await fetch(POKEMON_URL)).text()
const rows = pokemonCsv
  .split('\n')
  .slice(1)
  .map((line) => line.split(','))
  .filter(([id]) => id)
  .map(([id, identifier, speciesId]) => ({ sprite: Number(id), identifier, dex: Number(speciesId), sp: byId.get(Number(speciesId)) }))
  .filter((r) => r.sp)

// Formas regionales: la primera forma de cada especie por región (sin totem ni gorras).
const REGIONS = [
  { id: 'alola', en: 'Alolan', es: 'de Alola' },
  { id: 'galar', en: 'Galarian', es: 'de Galar' },
  { id: 'hisui', en: 'Hisuian', es: 'de Hisui' },
  { id: 'paldea', en: 'Paldean', es: 'de Paldea' },
]
const forms = []
const add = (form) => forms.some((f) => f.key === form.key) || forms.push(form)

for (const r of rows) {
  const region = REGIONS.find((g) => r.identifier.includes(`-${g.id}`))
  if (!region || /totem|cap/.test(r.identifier)) continue
  add({
    key: `${r.dex}-${region.id}`,
    dex: r.dex,
    group: region.id,
    sprite: r.sprite,
    en: `${region.en} ${r.sp.en}`,
    es: `${r.sp.es} ${region.es}`,
  })
}

// Megas y regresiones primigenias. Una casilla por letra (X/Y/Z); las variantes
// de género o color (Meowstic, Magearna, Tatsugiri) comparten casilla.
const megas = []
for (const r of rows) {
  const mega = r.identifier.match(/-mega(?:-([xyz]))?$/)
  const primal = r.identifier.endsWith('-primal')
  if (!mega && !primal) continue
  const letter = mega?.[1]?.toUpperCase()
  const key = primal ? `${r.dex}-primal` : `${r.dex}-mega${letter ? `-${letter.toLowerCase()}` : ''}`
  if (megas.some((m) => m.key === key)) continue
  const suffix = letter ? ` ${letter}` : ''
  megas.push({
    key,
    dex: r.dex,
    group: 'mega',
    sprite: r.sprite,
    en: primal ? `Primal ${r.sp.en}` : `Mega ${r.sp.en}${suffix}`,
    es: primal ? `${r.sp.es} Primigenio` : `Mega ${r.sp.es}${suffix}`,
  })
}
megas.sort((a, b) => a.dex - b.dex || a.key.localeCompare(b.key))
megas.forEach(add)

// Formas que las cartas sí distinguen por nombre ("Heat Rotom", "Wormadam Sandy Cloak").
const OTHER_FORMS = {
  'rotom-heat': { en: 'Heat Rotom', es: 'Rotom Calor' },
  'rotom-wash': { en: 'Wash Rotom', es: 'Rotom Lavado' },
  'rotom-frost': { en: 'Frost Rotom', es: 'Rotom Frío' },
  'rotom-fan': { en: 'Fan Rotom', es: 'Rotom Ventilador' },
  'rotom-mow': { en: 'Mow Rotom', es: 'Rotom Corte' },
  'wormadam-sandy': { en: 'Wormadam Sandy Cloak', es: 'Wormadam Tronco Arena' },
  'wormadam-trash': { en: 'Wormadam Trash Cloak', es: 'Wormadam Tronco Basura' },
}
for (const r of rows) {
  const names = OTHER_FORMS[r.identifier]
  if (!names) continue
  add({ key: `${r.dex}-${r.identifier.split('-')[1]}`, dex: r.dex, group: 'other', sprite: r.sprite, ...names })
}

mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true })
writeFileSync(new URL('../src/data/pokedex.json', import.meta.url), JSON.stringify(list))
writeFileSync(new URL('../src/data/forms.json', import.meta.url), JSON.stringify(forms))
const count = (g) => forms.filter((f) => f.group === g).length
console.log(
  `OK: ${list.length} especies, ${forms.length - count('mega') - count('other')} regionales, ${count('mega')} megas, ${count('other')} otras formas`,
)
