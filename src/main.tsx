import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './app/i18n'
import { bootstrapTelegram } from './app/telegram'
import App from './App.tsx'

bootstrapTelegram()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
