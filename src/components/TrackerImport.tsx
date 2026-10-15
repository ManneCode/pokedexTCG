import { useState, type FormEvent } from 'react'
import { useCollection } from '../lib/store'
import { getTrackerDexes, getTrackerSlots, type TrackerDex } from '../lib/pokedextracker'

/** Trae las capturas de una Pokédex de pokedextracker.com como "sin carta elegida". */
export default function TrackerImport({ onDone }: { onDone: (message: string) => void }) {
  const { dispatch } = useCollection()
  const [username, setUsername] = useState('')
  const [dexes, setDexes] = useState<TrackerDex[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function findUser(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setDexes(null)
    try {
      setDexes(await getTrackerDexes(username))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo consultar Pokédex Tracker.')
    } finally {
      setBusy(false)
    }
  }

  async function importDex(dex: TrackerDex) {
    setBusy(true)
    setError(null)
    try {
      const slots = await getTrackerSlots(username, dex.slug)
      dispatch({ type: 'markMany', slots })
      onDone(`Marcados ${slots.length} Pokémon de "${dex.title}". Ábrelos para elegir su carta.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron importar las capturas.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <form onSubmit={findUser} className="inline-form">
        <label htmlFor="tracker-user" className="sr-only">
          Usuario de Pokédex Tracker
        </label>
        <input
          id="tracker-user"
          required
          placeholder="Tu usuario de Pokédex Tracker"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          Buscar
        </button>
      </form>
      {dexes && dexes.length === 0 && <p className="hint">Ese usuario no tiene Pokédex.</p>}
      {dexes && dexes.length > 0 && (
        <ul className="dex-pick">
          {dexes.map((d) => (
            <li key={d.slug}>
              <span>
                <strong>{d.title}</strong>
                <span className="hint">
                  {' '}
                  {d.caught} / {d.total}
                </span>
              </span>
              <button className="small" disabled={busy} onClick={() => importDex(d)}>
                Importar
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
