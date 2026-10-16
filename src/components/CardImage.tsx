import { useEffect, useState } from 'react'
import { cardImage, fallbackImage } from '../lib/tcgdex'
import { spriteUrl } from '../lib/pokedex'
import { useI18n } from '../i18n'

type Props = {
  cardId: string
  localId?: string
  /** URL base de TCGdex (sin calidad); puede faltar */
  image?: string
  name: string
  setName?: string
  /** Sprite de PokeAPI para la carta de respaldo */
  sprite?: number
  quality?: 'low' | 'high'
  className?: string
  lazy?: boolean
}

/**
 * Imagen de una carta: primero TCGdex, si falla el banco de pokemontcg.io y, si tampoco existe,
 * una carta de respaldo con el sprite, el nombre y el set para que no quede un hueco feo.
 */
export default function CardImage({
  cardId,
  localId,
  image,
  name,
  setName,
  sprite,
  quality = 'low',
  className,
  lazy = true,
}: Props) {
  const { t } = useI18n()
  const sources = [cardImage(image, quality), localId ? fallbackImage(cardId, localId, quality) : undefined].filter(
    (s): s is string => !!s,
  )
  const [index, setIndex] = useState(0)

  // Otra carta: volver a empezar por la primera fuente.
  useEffect(() => setIndex(0), [cardId])

  const src = sources[index]
  if (!src) {
    return (
      <div className={`card-ph${className ? ` ${className}` : ''}`} role="img" aria-label={name}>
        <span className="card-ph-name">{name}</span>
        {sprite ? (
          <img className="card-ph-sprite" src={spriteUrl(sprite)} alt="" loading="lazy" />
        ) : (
          <span className="card-ph-mark" />
        )}
        <span className="card-ph-set">
          {setName}
          {localId ? ` · ${localId}` : ''}
        </span>
        <span className="card-ph-note">{t('panel.noImage')}</span>
      </div>
    )
  }
  return (
    <img
      className={className}
      src={src}
      alt={name}
      loading={lazy ? 'lazy' : undefined}
      onError={() => setIndex((i) => i + 1)}
      onLoad={(e) => isCardBack(e.currentTarget) && setIndex((i) => i + 1)}
      // Si ya estaba en caché, la imagen termina antes de que React escuche onLoad.
      ref={(img) => {
        if (img?.complete && isCardBack(img)) setIndex((i) => (sources[i] === img.src ? i + 1 : i))
      }}
    />
  )
}

/** pokemontcg.io responde con un reverso genérico de 640×892 cuando no tiene la carta. */
const isCardBack = (img: HTMLImageElement) =>
  img.src.includes('pokemontcg.io') && img.naturalWidth === 640 && img.naturalHeight === 892
