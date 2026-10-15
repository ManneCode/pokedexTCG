import { cardImage } from '../lib/tcgdex'

/** Cartas clásicas abiertas en abanico, con brillo holo. Decorativas. */
const FAN = [
  'https://assets.tcgdex.net/en/base/base1/15', // Venusaur
  'https://assets.tcgdex.net/en/base/base1/4', // Charizard
  'https://assets.tcgdex.net/en/base/base1/2', // Blastoise
]

export default function CardFan({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <div className={`card-fan ${size}`} aria-hidden="true">
      {FAN.map((src, i) => (
        <div key={src} className={`fan-card fan-${i}`}>
          <img src={cardImage(src, 'high')} alt="" />
          <span className="holo" />
        </div>
      ))}
    </div>
  )
}
