import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './brand.css'
import Root from './Root.tsx'
import { AuthProvider } from './lib/auth.tsx'
import { CardsProvider } from './lib/cards.tsx'
import { I18nProvider } from './i18n'
import { Analytics } from '@vercel/analytics/react'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <CardsProvider>
          <Root />
        </CardsProvider>
      </AuthProvider>
      <Analytics />
    </I18nProvider>
  </StrictMode>,
)
