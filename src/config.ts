// Datos del autor y de donaciones que se muestran en el pie de página.

export const AUTHOR = 'ManneCode'
export const FIRST_YEAR = 2026

export type DonationLink = { label: string; url: string; note?: string }

/**
 * Plataformas donde te pueden apoyar. Si la lista está vacía, el botón "Apóyame" no aparece.
 * Ejemplos: { label: 'Ko-fi', url: 'https://ko-fi.com/mannecode' },
 *           { label: 'PayPal', url: 'https://paypal.me/mannecode' },
 *           { label: 'Mercado Pago', url: 'https://link.mercadopago.com.mx/mannecode' }
 */
export const DONATION_LINKS: DonationLink[] = [{ label: 'Buy Me a Coffee', url: 'https://buymeacoffee.com/mannecode' }]
