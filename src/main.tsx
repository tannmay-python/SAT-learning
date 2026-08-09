import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './styles.css'
import App from './App'
import { AppStateProvider } from './state/AppState'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </StrictMode>,
)

// Earlier SATLAS builds installed an offline shell. Remove it so the browser is
// only a view over the server-owned learning record and never serves stale UI.
if ('serviceWorker' in navigator) void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
if ('caches' in window) void caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('satlas-')).map((key) => caches.delete(key))))
