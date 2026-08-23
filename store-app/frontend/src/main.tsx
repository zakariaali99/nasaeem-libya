import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import './styles/globals.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found in index.html')

// Catch dynamic import errors caused by stale chunks after deployments and reload
window.addEventListener('error', (event) => {
  if (/Failed to fetch dynamically imported module|Loading chunk [\d]+ failed/i.test(event.message || '')) {
    const lastReload = sessionStorage.getItem('chunk_reload_ts')
    const now = Date.now()
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('chunk_reload_ts', now.toString())
      window.location.reload()
    }
  }
})

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/*
 * PWA: the service worker is the weak-network strategy — shell and assets
 * cached once, catalog reads fall back to last-known data, money path always
 * network. Registered in production only; a stale worker during development
 * is a bug factory. When a new build ships, the worker re-fetches itself and
 * takes over on the next load.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline install failure must never break the store itself */
    })
  })
}
