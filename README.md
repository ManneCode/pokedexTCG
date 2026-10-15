# Pokédex TCG

Tracker personal de una Pokédex completa (1025 especies + 55 formas regionales de Alola, Galar, Hisui y Paldea; aparte, como extras que no cuentan para el avance: 95 Megas y las formas de Rotom y Wormadam) hecha con cartas físicas de Pokémon TCG. Las cartas regionales ("Alolan Meowth", "Hisuian Growlithe"…) van en la casilla de su forma, no en la de la especie.

- Para cada Pokémon consultas todas sus cartas (imagen, set, rareza y precio) y marcas cuál tienes, con su variante y cantidad.
- El valor de la colección usa el market price de TCGplayer en USD. Si TCGplayer no tiene precio, se usa el promedio de Cardmarket convertido (`EUR_TO_USD` en `src/lib/tcgdex.ts`) y se marca con ≈.
- Las cartas de TCG Pocket se excluyen porque no son físicas.
- Datos: [TCGdex](https://tcgdex.dev) (cartas y precios) y [PokeAPI](https://pokeapi.co) (nombres y sprites).

## Uso

```bash
npm install
npm run dev
```

Abre http://localhost:5173. Sin Supabase configurado la app funciona en modo local: la colección se guarda en el navegador (localStorage) y puedes exportar o cargar un respaldo en JSON desde el menú **Más**.

Con Supabase cada quien crea su cuenta con correo y contraseña, su colección se guarda en la nube y tiene un perfil público en `/u/<usuario>` que se puede compartir. Para configurarlo y publicar en Vercel, sigue [DEPLOY.md](DEPLOY.md).

**Importar de Pokédex Tracker** (menú **Más**, o en la bienvenida) trae las capturas de cualquier usuario de pokedextracker.com como "sin carta elegida". Pasa por el proxy `/ptk` (en `vite.config.ts` y `vercel.json`) porque esa API no acepta llamadas desde otros dominios.

Para regenerar la lista de especies y formas: `node scripts/build-pokedex.mjs`.

## Autor y donaciones

Hecho por **ManneCode**. El pie de página y los links de donación se configuran en `src/config.ts`: si `DONATION_LINKS` está vacío, el botón "Apóyame" no aparece.
