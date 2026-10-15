// Mapa compartido de cartas descargadas, para que precios y valor se actualicen en toda la app.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { getCachedCard, getCards, type CardInfo } from './tcgdex'

type Ctx = {
  cards: Record<string, CardInfo>
  /** Descarga (o toma de caché) las cartas indicadas. */
  ensure: (ids: string[], opts?: { force?: boolean; signal?: AbortSignal }) => Promise<void>
}

const CardsContext = createContext<Ctx | null>(null)

export function CardsProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<Record<string, CardInfo>>({})
  const pending = useRef<Record<string, CardInfo>>({})
  const flushTimer = useRef<number | undefined>(undefined)

  // Junta las cartas que llegan en ráfaga para no re-renderizar 200 veces.
  const push = useCallback((card: CardInfo) => {
    pending.current[card.id] = card
    if (flushTimer.current) return
    flushTimer.current = window.setTimeout(() => {
      const batch = pending.current
      pending.current = {}
      flushTimer.current = undefined
      setCards((prev) => ({ ...prev, ...batch }))
    }, 120)
  }, [])

  const ensure = useCallback<Ctx['ensure']>(
    async (ids, opts) => {
      if (!opts?.force) for (const id of ids) {
        const c = getCachedCard(id)
        if (c) push(c)
      }
      await getCards(ids, push, opts)
    },
    [push],
  )

  return <CardsContext.Provider value={{ cards, ensure }}>{children}</CardsContext.Provider>
}

export function useCards() {
  const ctx = useContext(CardsContext)
  if (!ctx) throw new Error('useCards fuera de CardsProvider')
  return ctx
}
