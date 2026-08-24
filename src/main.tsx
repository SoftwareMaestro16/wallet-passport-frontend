import { Buffer } from 'buffer'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './app/i18n'
import { bootstrapTelegram } from './app/telegram'
import App from './App.tsx'

// @ton/core (mint tx cell-building, see features/mint/mintTx.ts) assumes a Node-like global
// Buffer; Vite doesn't polyfill it in the browser, so wire it up once at the entry point.
globalThis.Buffer = globalThis.Buffer ?? Buffer

bootstrapTelegram()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
