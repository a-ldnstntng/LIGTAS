import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// Safe PWA service worker registration (browsers only; bypassed in Capacitor native WebView)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !window.Capacitor?.isNativePlatform()) {
  try {
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        if (typeof registerSW === 'function') {
          registerSW({ immediate: true });
        }
      })
      .catch((err) => {
        console.warn('PWA registration skipped:', err);
      });
  } catch (err) {
    console.warn('Service worker not supported in this host:', err);
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
