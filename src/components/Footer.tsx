import { useState } from 'react'
import { AUTHOR, DONATION_LINKS, FIRST_YEAR } from '../config'
import Dialog from './Dialog'

export default function Footer() {
  const [showDonate, setShowDonate] = useState(false)
  const year = new Date().getFullYear()
  const years = year > FIRST_YEAR ? `${FIRST_YEAR}–${year}` : String(FIRST_YEAR)

  return (
    <footer className="site-footer">
      <div className="footer-main">
        <p>
          © {years} <strong>{AUTHOR}</strong>. Todos los derechos reservados.
        </p>
        {DONATION_LINKS.length > 0 && (
          <button className="small donate" onClick={() => setShowDonate(true)}>
            ♥ Apóyame
          </button>
        )}
      </div>
      <p className="hint legal">
        Pokémon y los nombres de los personajes son marcas de Nintendo, Creatures Inc. y GAME FREAK inc. Este sitio es
        un proyecto de fans y no está afiliado ni respaldado por ellos. Datos de cartas y precios:{' '}
        <a href="https://tcgdex.dev" target="_blank" rel="noreferrer">
          TCGdex
        </a>
        . Sprites:{' '}
        <a href="https://pokeapi.co" target="_blank" rel="noreferrer">
          PokéAPI
        </a>
        .
      </p>

      {showDonate && (
        <Dialog title="Apoya Pokédex TCG" onClose={() => setShowDonate(false)}>
          <p className="hint">
            Pokédex TCG es gratis y sin anuncios. Si te sirve y quieres invitarme un café para seguir mejorándola,
            puedes hacerlo aquí. ¡Gracias!
          </p>
          <ul className="donate-list">
            {DONATION_LINKS.map((d) => (
              <li key={d.url}>
                <a className="button-link" href={d.url} target="_blank" rel="noreferrer">
                  {d.label}
                </a>
                {d.note && <span className="hint">{d.note}</span>}
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </footer>
  )
}
