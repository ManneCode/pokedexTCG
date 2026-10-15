import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.tsx'
import { AuthProvider } from './lib/auth.tsx'
import { CardsProvider } from './lib/cards.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CardsProvider>
        <Root />
      </CardsProvider>
    </AuthProvider>
  </StrictMode>,
)
