import { useEffect, useMemo, useRef, useState } from 'react'
import { useCollection, type ValuePoint } from '../lib/store'
import { fmtMoney, toDisplay } from '../lib/money'
import { useI18n, type MessageKey } from '../i18n'

type Range = '30' | '90' | '365' | 'all'

const RANGES: { id: Range; label: MessageKey }[] = [
  { id: '30', label: 'history.r30' },
  { id: '90', label: 'history.r90' },
  { id: '365', label: 'history.r365' },
  { id: 'all', label: 'history.rAll' },
]

const HEIGHT = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 64 }

/** Escala "bonita" para el eje Y: 4 marcas redondas que cubren el rango. */
function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    const pad = Math.max(1, Math.abs(max) * 0.1)
    min -= pad
    max += pad
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

const parseDate = (d: string) => new Date(`${d}T12:00:00`)

export default function ValueHistory() {
  const { state } = useCollection()
  const { t, locale } = useI18n()
  const [range, setRange] = useState<Range>('90')
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const points: ValuePoint[] = useMemo(() => {
    const all = [...state.history].sort((a, b) => a.date.localeCompare(b.date))
    if (range === 'all') return all
    const from = Date.now() - Number(range) * 86400000
    return all.filter((p) => parseDate(p.date).getTime() >= from)
  }, [state.history, range])

  const fmtDate = (d: string, long = false) =>
    parseDate(d).toLocaleDateString(locale, long ? { dateStyle: 'medium' } : { month: 'short', day: 'numeric' })

  if (state.history.length === 0) {
    return (
      <div className="empty">
        <h2>{t('history.emptyTitle')}</h2>
        <p>{t('history.emptyText')}</p>
      </div>
    )
  }

  const first = points[0]
  const last = points[points.length - 1]
  const change = first && last ? last.usd - first.usd : 0
  const changePct = first && first.usd > 0 ? (change / first.usd) * 100 : 0

  // Geometría: x por fecha real (los días sin foto quedan como hueco proporcional).
  const innerW = width - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const t0 = first ? parseDate(first.date).getTime() : 0
  const t1 = last ? parseDate(last.date).getTime() : 1
  const values = points.map((p) => toDisplay(p.usd).amount)
  const ticks = niceTicks(Math.min(...values, 0), Math.max(...values, 0))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const x = (d: string) => PAD.left + (t1 === t0 ? innerW / 2 : ((parseDate(d).getTime() - t0) / (t1 - t0)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(values[i]).toFixed(1)}`).join(' ')
  const area =
    points.length > 1
      ? `${line} L${x(last.date).toFixed(1)},${y(yMin).toFixed(1)} L${x(first.date).toFixed(1)},${y(yMin).toFixed(1)} Z`
      : ''
  const fmtAxis = (v: number) =>
    v.toLocaleString(locale, { notation: Math.abs(yMax) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 0 })

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * innerW + PAD.left
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i
    })
    setHover(best)
  }

  const h = hover != null ? points[hover] : null

  return (
    <div className="history">
      <div className="history-head">
        <div>
          <span className="label">{t('history.title')}</span>
          <span className="money big">{last ? fmtMoney(last.usd) : '—'}</span>
          {points.length > 1 && (
            <span className={`delta ${change >= 0 ? 'up' : 'down'}`}>
              {change >= 0 ? '▲' : '▼'} {fmtMoney(Math.abs(change))} ({Math.abs(changePct).toFixed(1)}%)
              <span className="hint"> · {t('history.since', { date: fmtDate(first.date, true) })}</span>
            </span>
          )}
        </div>
        <div className="chips" role="group" aria-label={t('history.range')}>
          {RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? 'chip on' : 'chip'} onClick={() => setRange(r.id)}>
              {t(r.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-box" ref={box}>
        {points.length === 0 ? (
          <p className="hint">{t('history.noneInRange')}</p>
        ) : (
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label={t('history.title')}
            className="chart"
          >
            {ticks.map((v) => (
              <g key={v}>
                <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
                <text className="axis" x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
                  {fmtAxis(v)}
                </text>
              </g>
            ))}
            <text className="axis" x={PAD.left} y={HEIGHT - 8} textAnchor="start">
              {fmtDate(first.date)}
            </text>
            {points.length > 1 && (
              <text className="axis" x={width - PAD.right} y={HEIGHT - 8} textAnchor="end">
                {fmtDate(last.date)}
              </text>
            )}
            {area && <path className="area" d={area} />}
            {points.length > 1 && <path className="line" d={line} />}
            {/* Punto final con el valor de hoy */}
            <circle className="dot" cx={x(last.date)} cy={y(values[values.length - 1])} r={4.5} />
            {h && (
              <g>
                <line className="crosshair" x1={x(h.date)} x2={x(h.date)} y1={PAD.top} y2={PAD.top + innerH} />
                <circle className="dot" cx={x(h.date)} cy={y(toDisplay(h.usd).amount)} r={5} />
              </g>
            )}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}
        {h && (
          <div
            className="chart-tip"
            style={{ left: Math.min(Math.max(x(h.date), 90), width - 90), top: y(toDisplay(h.usd).amount) - 12 }}
          >
            <strong>{fmtMoney(h.usd)}</strong>
            <span>{fmtDate(h.date, true)}</span>
            <span className="hint">{t('history.tipCards', { cards: h.cards, slots: h.withCard })}</span>
          </div>
        )}
      </div>

      <p className="hint">{t('history.note')}</p>
      <button className="link" onClick={() => setShowTable((s) => !s)}>
        {showTable ? t('history.hideTable') : t('history.showTable')}
      </button>
      {showTable && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('history.date')}</th>
                <th className="num">{t('stats.value')}</th>
                <th className="num">{t('stats.cards')}</th>
                <th className="num">{t('stats.dexWithCard')}</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <td>{fmtDate(p.date, true)}</td>
                  <td className="num money">{fmtMoney(p.usd)}</td>
                  <td className="num">{p.cards}</td>
                  <td className="num">{p.withCard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
