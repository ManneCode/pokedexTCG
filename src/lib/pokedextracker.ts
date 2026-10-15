// Importa capturas de https://pokedextracker.com. Su API no permite llamadas desde otros
// dominios, así que pasa por /ptk: un proxy de Vite en desarrollo y un rewrite en vercel.json.
import { slotByKey } from './pokedex'

const API = '/ptk'

export type TrackerDex = { slug: string; title: string; caught: number; total: number }

export async function getTrackerDexes(username: string): Promise<TrackerDex[]> {
  const res = await fetch(`${API}/users/${encodeURIComponent(username.trim())}`)
  if (res.status === 404) throw new Error('No existe ese usuario en Pokédex Tracker.')
  if (!res.ok) throw new Error(`Pokédex Tracker respondió ${res.status}.`)
  const user: { dexes: TrackerDex[] } = await res.json()
  return user.dexes.map(({ slug, title, caught, total }) => ({ slug, title, caught, total }))
}

type Capture = { captured: boolean; pokemon: { national_id: number; form: string | null } }

/** Casillas marcadas en una Pokédex de Pokédex Tracker ("25", "52-alola"…). */
export async function getTrackerSlots(username: string, slug: string): Promise<string[]> {
  const res = await fetch(
    `${API}/users/${encodeURIComponent(username.trim())}/dexes/${encodeURIComponent(slug)}/captures`,
  )
  if (!res.ok) throw new Error(`Pokédex Tracker respondió ${res.status}.`)
  const captures: Capture[] = await res.json()
  return captures
    .filter((c) => c.captured)
    .map((c) => (c.pokemon.form ? `${c.pokemon.national_id}-${c.pokemon.form}` : String(c.pokemon.national_id)))
    .filter((key) => slotByKey(key))
}
