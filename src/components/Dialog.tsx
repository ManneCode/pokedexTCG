import { useEffect, type ReactNode } from 'react'
import { useI18n } from '../i18n'

/** Ventana modal sencilla: se cierra con Escape o al tocar fuera. */
export default function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label={t('panel.close')}>
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
