// Idioma de la interfaz (español o inglés), recordado en este navegador.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { MESSAGES, type Lang, type MessageKey } from './messages'
import { setNumberLocale } from '../lib/tcgdex'
import type { Slot } from '../lib/pokedex'

export type { Lang, MessageKey }

const STORAGE_KEY = 'pkt-lang'
export const LOCALES: Record<Lang, string> = { es: 'es-MX', en: 'en-US' }

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    // sin almacenamiento: usamos el idioma del navegador
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

type Ctx = {
  lang: Lang
  locale: string
  setLang: (lang: Lang) => void
  t: Translate
  /** Traduce si el texto es una llave conocida (p. ej. el mensaje de un error); si no, lo deja igual. */
  tx: (text: string) => string
  /** Nombre del Pokémon o forma en el idioma actual. */
  slotName: (slot: Slot) => string
  /** Nombre de una variante de carta ("reverse-holofoil" → "Reverse holo"). */
  variantLabel: (variant: string) => string
}

const I18nContext = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  setNumberLocale(LOCALES[lang])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // se queda solo para esta pestaña
    }
  }, [])

  const t: Translate = useCallback(
    (key, vars) => {
      let text: string = MESSAGES[lang][key] ?? MESSAGES.es[key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v))
      return text
    },
    [lang],
  )

  const tx = useCallback((text: string) => (text in MESSAGES[lang] ? t(text as MessageKey) : text), [lang, t])

  const slotName = useCallback((slot: Slot) => (lang === 'es' ? slot.es : slot.en), [lang])

  const variantLabel = useCallback(
    (variant: string) => {
      const key = `variant.${variant}`
      return key in MESSAGES[lang] ? t(key as MessageKey) : variant
    },
    [lang, t],
  )

  return (
    <I18nContext.Provider value={{ lang, locale: LOCALES[lang], setLang, t, tx, slotName, variantLabel }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n fuera de I18nProvider')
  return ctx
}
