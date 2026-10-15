// Moneda en que se muestran los precios. Los precios base siempre son USD (TCGplayer);
// en MXN se convierten con el tipo de cambio del día de Frankfurter (Banco Central Europeo).

export type Currency = 'USD' | 'MXN'

export type Rate = { mxn: number; date: string }

const RATE_KEY = 'pkt-usd-mxn-v1'
const RATE_TTL_MS = 12 * 60 * 60 * 1000

let format = { locale: 'es-MX', currency: 'USD' as Currency, mxn: 0 }

/** Lo fija el proveedor de preferencias (src/i18n) cuando cambian idioma, moneda o tipo de cambio. */
export function setMoneyFormat(next: { locale: string; currency: Currency; mxn: number }) {
  format = next
}

/** Convierte de USD a la moneda elegida. Sin tipo de cambio todavía, se queda en USD. */
export function toDisplay(usd: number): { amount: number; currency: Currency } {
  if (format.currency === 'MXN' && format.mxn > 0) return { amount: usd * format.mxn, currency: 'MXN' }
  return { amount: usd, currency: 'USD' }
}

/** Lo contrario de toDisplay: un monto escrito en la moneda elegida, en USD. */
export function fromDisplay(amount: number): number {
  if (format.currency === 'MXN' && format.mxn > 0) return amount / format.mxn
  return amount
}

/** Código de la moneda en que se muestran los precios ahora mismo. */
export const displayCurrency = (): Currency => (format.currency === 'MXN' && format.mxn > 0 ? 'MXN' : 'USD')

/** Formatea un precio en USD en la moneda e idioma elegidos. */
export function fmtMoney(usd: number) {
  const { amount, currency } = toDisplay(usd)
  return (
    amount.toLocaleString(format.locale, {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'MXN' ? 'narrowSymbol' : 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + (currency === 'MXN' ? ' MXN' : '')
  )
}

function readCachedRate(): (Rate & { at: number }) | null {
  try {
    const raw = localStorage.getItem(RATE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Tipo de cambio USD→MXN (caché de 12 h en este navegador). */
export async function getUsdMxnRate(): Promise<Rate> {
  const cached = readCachedRate()
  if (cached && Date.now() - cached.at < RATE_TTL_MS) return cached
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN')
    if (!res.ok) throw new Error(String(res.status))
    const data: { date: string; rates: { MXN: number } } = await res.json()
    const rate = { mxn: data.rates.MXN, date: data.date }
    try {
      localStorage.setItem(RATE_KEY, JSON.stringify({ ...rate, at: Date.now() }))
    } catch {
      // sin caché
    }
    return rate
  } catch (e) {
    // Sin red: mejor un tipo de cambio de días atrás que ninguno.
    if (cached) return cached
    throw e
  }
}
