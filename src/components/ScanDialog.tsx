import { useEffect, useState, type FormEvent } from 'react'
import { useCollection } from '../lib/store'
import { defaultVariant, priceOf, type CardInfo } from '../lib/tcgdex'
import { fmtMoney } from '../lib/money'
import { dexNo, slotCandidates } from '../lib/pokedex'
import { findCandidates, findSlot, guessFromText, readCardText } from '../lib/scan'
import { useI18n } from '../i18n'
import Dialog from './Dialog'
import CardImage from './CardImage'

type Phase = 'pick' | 'reading' | 'review' | 'searching' | 'results'

/** Toma una foto de una carta, la reconoce y la agrega a la colección o a la lista de deseos. */
export default function ScanDialog({ onClose, onOpen }: { onClose: () => void; onOpen: (slot: string) => void }) {
  const { state, dispatch } = useCollection()
  const { t, slotName } = useI18n()
  const [phase, setPhase] = useState<Phase>('pick')
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [total, setTotal] = useState('')
  const [results, setResults] = useState<{ cards: CardInfo[]; exact: boolean; slotKey: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function read(file: File) {
    setPreview(URL.createObjectURL(file))
    setPhase('reading')
    setError(null)
    setProgress(0)
    try {
      const { text, bottom } = await readCardText(file, setProgress)
      const guess = guessFromText(text, bottom)
      setName(guess.slot ? slotName(guess.slot) : '')
      setNumber(guess.number ?? '')
      setTotal(guess.total ?? '')
      setPhase('review')
      if (guess.slot) void search(guess.slot.en, guess.number ?? '', guess.total ?? '')
    } catch {
      setError(t('scan.ocrError'))
      setPhase('review')
    }
  }

  async function search(pokemon = name, num = number, tot = total) {
    const slot = findSlot(pokemon)
    if (!slot) {
      setError(t('scan.unknownPokemon', { name: pokemon }))
      setPhase('review')
      return
    }
    setError(null)
    setPhase('searching')
    try {
      const found = await findCandidates(slot, num.trim() || undefined, tot.trim() || undefined)
      setResults({ ...found, slotKey: slot.key })
      setName(slotName(slot))
      setPhase('results')
    } catch {
      setError(t('panel.loadError'))
      setPhase('review')
    }
  }

  function placement(card: CardInfo, slotKey: string) {
    const dex = Number(slotKey.split('-')[0])
    return {
      cardId: card.id,
      slots: (card.dexIds.length ? card.dexIds : [dex]).map((d) =>
        d === dex ? slotKey : slotCandidates(d, card.name)[0],
      ),
      variant: defaultVariant(card),
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void search()
  }

  return (
    <Dialog title={t('scan.title')} onClose={onClose}>
      {phase === 'pick' && (
        <div className="stack">
          <p className="hint">{t('scan.lead')}</p>
          <label className="scan-drop" htmlFor="scan-file">
            <CameraIcon />
            <strong>{t('scan.take')}</strong>
            <span className="hint">{t('scan.tips')}</span>
          </label>
          <input
            id="scan-file"
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void read(f)
            }}
          />
        </div>
      )}

      {phase !== 'pick' && (
        <div className="scan-body">
          {preview && <img className="scan-preview" src={preview} alt="" />}
          <div className="stack scan-side">
            {phase === 'reading' && (
              <>
                <p>{t('scan.reading')}</p>
                <div className="bar">
                  <span className="bar-card" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p className="hint">{t('scan.firstTime')}</p>
              </>
            )}
            {phase !== 'reading' && (
              <form className="stack" onSubmit={onSubmit}>
                <label htmlFor="scan-name">{t('scan.pokemon')}</label>
                <input id="scan-name" required value={name} onChange={(e) => setName(e.target.value)} />
                <label htmlFor="scan-number">{t('scan.number')}</label>
                <input
                  id="scan-number"
                  placeholder="025"
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value)
                    setTotal('')
                  }}
                />
                <button type="submit" disabled={phase === 'searching'}>
                  {phase === 'searching' ? t('scan.searching') : t('scan.search')}
                </button>
                <button type="button" className="link" onClick={() => setPhase('pick')}>
                  {t('scan.again')}
                </button>
              </form>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}

      {phase === 'results' && results && (
        <div className="stack">
          <p className="hint">
            {results.exact
              ? results.cards.length === 1
                ? t('scan.exactOne')
                : t('scan.exact', { n: results.cards.length })
              : t('scan.noExact')}
          </p>
          <ul className="scan-results">
            {results.cards.map((card) => {
              const owned = state.owned.some((o) => o.cardId === card.id)
              const wished = state.wishlist.some((w) => w.cardId === card.id)
              const p = priceOf(card)
              return (
                <li key={card.id}>
                  <CardImage
                    cardId={card.id}
                    localId={card.localId}
                    image={card.image}
                    name={card.name}
                    setName={card.setName}
                  />
                  <div className="card-info">
                    <strong>{card.name}</strong>
                    <span className="hint">
                      {card.setName} · {card.localId}
                      {card.setTotal ? `/${card.setTotal}` : ''}
                    </span>
                    <span className="money">{p ? fmtMoney(p.usd) : '—'}</span>
                  </div>
                  <div className="scan-actions">
                    <button
                      className={owned ? 'small owned-btn' : 'small'}
                      onClick={() => dispatch({ type: 'add', ...placement(card, results.slotKey) })}
                    >
                      {owned ? t('scan.addAnother') : t('panel.add')}
                    </button>
                    {!owned && (
                      <button
                        className={wished ? 'wish-btn on' : 'wish-btn'}
                        onClick={() => dispatch({ type: 'wishToggle', ...placement(card, results.slotKey) })}
                        aria-label={wished ? t('wish.remove') : t('wish.add')}
                      >
                        {wished ? '♥' : '♡'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <button
            className="ghost small"
            onClick={() => {
              onClose()
              onOpen(results.slotKey)
            }}
          >
            {t('scan.seeAll', { name: `${dexNo(Number(results.slotKey.split('-')[0]))} ${name}` })}
          </button>
        </div>
      )}
    </Dialog>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        d="M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
      />
    </svg>
  )
}
