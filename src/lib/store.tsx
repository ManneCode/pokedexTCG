// Estado de la colección: cartas que tienes, carta destacada por casilla y casillas
// marcadas como "lo tengo" sin carta elegida todavía.
// Una casilla es una especie ("25") o una forma regional ("52-alola").
import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react'

export type OwnedCard = {
  uid: string
  cardId: string
  /** Casillas que cubre la carta (varias en cartas tag team) */
  slots: string[]
  variant: string
  qty: number
  addedAt: string
}

export type CollectionState = {
  version: 1
  owned: OwnedCard[]
  /** casilla → uid de la carta que la representa en la Pokédex */
  featured: Record<string, string>
  /** Casillas que tienes pero sin carta elegida todavía */
  marked: string[]
}

type Action =
  | { type: 'add'; cardId: string; slots: string[]; variant: string }
  | { type: 'update'; uid: string; patch: Partial<Pick<OwnedCard, 'variant' | 'qty'>> }
  | { type: 'remove'; uid: string }
  | { type: 'feature'; slot: string; uid: string }
  | { type: 'toggleMark'; slot: string }
  | { type: 'markMany'; slots: string[] }
  | { type: 'replace'; state: CollectionState }

const STORAGE_KEY = 'pkt-collection-v1'
const EMPTY: CollectionState = { version: 1, owned: [], featured: {}, marked: [] }

type StoredState = Partial<Omit<CollectionState, 'owned' | 'marked'>> & {
  owned?: (Omit<OwnedCard, 'slots'> & { slots?: string[]; dexIds?: number[] })[]
  marked?: (string | number)[]
}

/** La primera versión guardaba números de Pokédex (dexIds) en lugar de casillas. */
function migrate(data: StoredState): CollectionState {
  return {
    ...EMPTY,
    ...data,
    owned: (data.owned ?? []).map(({ dexIds, ...o }) => ({ ...o, slots: o.slots ?? (dexIds ?? []).map(String) })),
    marked: (data.marked ?? []).map(String),
  }
}

function load(): CollectionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? migrate(JSON.parse(raw)) : EMPTY
  } catch {
    return EMPTY
  }
}

const uid = () => Math.random().toString(36).slice(2, 10)

function reducer(state: CollectionState, action: Action): CollectionState {
  switch (action.type) {
    case 'add': {
      const existing = state.owned.find((o) => o.cardId === action.cardId && o.variant === action.variant)
      if (existing) return reducer(state, { type: 'update', uid: existing.uid, patch: { qty: existing.qty + 1 } })
      const card: OwnedCard = {
        uid: uid(),
        cardId: action.cardId,
        slots: action.slots,
        variant: action.variant,
        qty: 1,
        addedAt: new Date().toISOString(),
      }
      const featured = { ...state.featured }
      for (const s of action.slots) featured[s] ??= card.uid
      return {
        ...state,
        owned: [...state.owned, card],
        featured,
        marked: state.marked.filter((s) => !action.slots.includes(s)),
      }
    }
    case 'update':
      return {
        ...state,
        owned: state.owned.map((o) =>
          o.uid === action.uid ? { ...o, ...action.patch, qty: Math.max(1, action.patch.qty ?? o.qty) } : o,
        ),
      }
    case 'remove': {
      const owned = state.owned.filter((o) => o.uid !== action.uid)
      const featured: Record<string, string> = {}
      for (const [slot, u] of Object.entries(state.featured)) {
        if (u !== action.uid) featured[slot] = u
        else {
          const next = owned.find((o) => o.slots.includes(slot))
          if (next) featured[slot] = next.uid
        }
      }
      return { ...state, owned, featured }
    }
    case 'feature':
      return { ...state, featured: { ...state.featured, [action.slot]: action.uid } }
    case 'toggleMark':
      return {
        ...state,
        marked: state.marked.includes(action.slot)
          ? state.marked.filter((s) => s !== action.slot)
          : [...state.marked, action.slot],
      }
    case 'markMany': {
      const withCard = new Set(state.owned.flatMap((o) => o.slots))
      const marked = new Set(state.marked)
      for (const s of action.slots) if (!withCard.has(s)) marked.add(s)
      return { ...state, marked: [...marked] }
    }
    case 'replace':
      return migrate(action.state)
  }
}

type Ctx = { state: CollectionState; dispatch: (a: Action) => void; readOnly: boolean }
const CollectionContext = createContext<Ctx | null>(null)

/** La colección guardada en este navegador (modo local, o antes de subirla a la nube). */
export const loadLocalCollection = load

export function isEmptyCollection(state: CollectionState) {
  return !state.owned.length && !state.marked.length
}

type ProviderProps = {
  children: ReactNode
  /** Estado inicial; sin él se usa la colección de este navegador. */
  initial?: CollectionState
  /** Colección de otra persona: se muestra pero no se puede cambiar. */
  readOnly?: boolean
  /** Se llama después de cada cambio; sin él se guarda en localStorage. */
  onChange?: (state: CollectionState) => void
}

export function CollectionProvider({ children, initial, readOnly = false, onChange }: ProviderProps) {
  const [state, rawDispatch] = useReducer(reducer, initial, (i) => (i ? migrate(i) : load()))
  const dispatch = (a: Action) => {
    if (!readOnly) rawDispatch(a)
  }
  const first = useRef(true)
  useEffect(() => {
    // El estado inicial ya está guardado; solo persistimos cambios.
    if (first.current) {
      first.current = false
      return
    }
    if (readOnly) return
    if (onChange) return onChange(state)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // sin almacenamiento: la colección vive solo en esta pestaña
    }
  }, [state, readOnly, onChange])
  return <CollectionContext.Provider value={{ state, dispatch, readOnly }}>{children}</CollectionContext.Provider>
}

export function useCollection() {
  const ctx = useContext(CollectionContext)
  if (!ctx) throw new Error('useCollection fuera de CollectionProvider')
  return ctx
}

/** Estado de una casilla en la Pokédex. */
export type SlotStatus = 'card' | 'marked' | 'missing'

export function slotStatus(state: CollectionState, slot: string): SlotStatus {
  if (state.owned.some((o) => o.slots.includes(slot))) return 'card'
  if (state.marked.includes(slot)) return 'marked'
  return 'missing'
}
