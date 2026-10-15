import { useState } from 'react'
import { useCollection, type Condition, type GradingCompany, type OwnedCard, type OwnedPatch } from '../lib/store'
import { CONDITIONS } from '../lib/value'
import { displayCurrency, fromDisplay, toDisplay } from '../lib/money'
import { useI18n } from '../i18n'

const COMPANIES: GradingCompany[] = ['PSA', 'BGS', 'CGC', 'TAG']

/** Condición, gradeo y precio manual de una carta que ya tienes. */
export default function CardDetails({ owned }: { owned: OwnedCard }) {
  const { dispatch } = useCollection()
  const { t } = useI18n()
  const currency = displayCurrency()
  const shown = owned.customPrice != null ? toDisplay(owned.customPrice).amount.toFixed(2) : ''
  const [price, setPrice] = useState(shown)
  const update = (patch: OwnedPatch) => dispatch({ type: 'update', uid: owned.uid, patch })

  function commitPrice() {
    const n = Number(price.replace(',', '.'))
    if (price.trim() === '' || Number.isNaN(n)) {
      setPrice('')
      if (owned.customPrice != null) update({ customPrice: undefined })
      return
    }
    update({ customPrice: Math.max(0, Math.round(fromDisplay(n) * 100) / 100) })
  }

  const hasDetails = (owned.condition ?? 'NM') !== 'NM' || !!owned.grade || owned.customPrice != null

  return (
    <details className="card-details" open={hasDetails || undefined}>
      <summary>{t('details.title')}</summary>
      <div className="details-grid">
        <label htmlFor={`cond-${owned.uid}`}>{t('details.condition')}</label>
        <select
          id={`cond-${owned.uid}`}
          value={owned.condition ?? 'NM'}
          onChange={(e) => update({ condition: e.target.value as Condition })}
        >
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c} · {t(`condition.${c}`)}
            </option>
          ))}
        </select>

        <label htmlFor={`grade-${owned.uid}`}>{t('details.grade')}</label>
        <span className="grade-row">
          <select
            id={`grade-${owned.uid}`}
            value={owned.grade?.company ?? ''}
            onChange={(e) =>
              update({
                grade: e.target.value
                  ? { company: e.target.value as GradingCompany, score: owned.grade?.score ?? 10 }
                  : undefined,
              })
            }
          >
            <option value="">{t('details.ungraded')}</option>
            {COMPANIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {owned.grade && (
            <input
              id={`score-${owned.uid}`}
              type="number"
              min={1}
              max={10}
              step={0.5}
              aria-label={t('details.score')}
              value={owned.grade.score}
              onChange={(e) =>
                update({
                  grade: {
                    company: owned.grade!.company,
                    score: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                  },
                })
              }
            />
          )}
        </span>

        <label htmlFor={`price-${owned.uid}`}>{t('details.manualPrice')}</label>
        <span className="price-row">
          <input
            id={`price-${owned.uid}`}
            inputMode="decimal"
            placeholder={t('details.auto')}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <span className="hint">{currency}</span>
        </span>
      </div>
      <p className="hint details-note">
        {owned.grade && owned.customPrice == null ? t('details.gradedHint') : t('details.conditionHint')}
      </p>
    </details>
  )
}
