import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { AuthProvider } from './AuthContext.jsx'
import App from './App.jsx'
import { registerMatebudyServiceWorker } from './notifications.js'
import './index.css'

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter
const rootElement = document.getElementById('root')

window.__matebudyBooted = true
console.log('[MateBudy] main.jsx loaded', {
  native: Capacitor.isNativePlatform(),
  router: Capacitor.isNativePlatform() ? 'hash' : 'browser',
  href: window.location.href,
})

if (!Capacitor.isNativePlatform()) {
  void registerMatebudyServiceWorker()
}

function formatError(error) {
  if (!error) return 'Error desconocido'
  if (typeof error === 'string') return error
  return error.message || String(error)
}

function renderFatalScreen(message) {
  if (!rootElement) return

  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#fffaf5;font-family:system-ui,sans-serif;">
      <div style="max-width:520px;width:100%;background:#ffffff;border-radius:24px;padding:24px;box-shadow:0 18px 50px rgba(112,170,35,0.14);border:1px solid rgba(32,75,87,0.12);">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <div style="width:42px;height:42px;border-radius:14px;background:#effbdc;color:#5f9f17;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;">!</div>
          <div>
            <strong style="display:block;font-size:18px;color:#20313a;">MateBudy no pudo iniciar</strong>
            <span style="display:block;color:#57707a;font-size:13px;">Pantalla de diagnostico de arranque</span>
          </div>
        </div>
        <p style="color:#57707a;line-height:1.6;margin:0 0 14px;">Si ves esta pantalla, la app encontro un error antes de terminar de cargar.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#fff7de;color:#20313a;padding:14px;border-radius:16px;margin:0;font-size:12px;line-height:1.5;">${message}</pre>
      </div>
    </div>
  `
}

window.addEventListener('error', (event) => {
  renderFatalScreen(formatError(event.error || event.message))
})

window.addEventListener('unhandledrejection', (event) => {
  renderFatalScreen(formatError(event.reason))
})

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('MateBudy startup error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#fffaf5', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: '520px', width: '100%', background: '#ffffff', borderRadius: '24px', padding: '24px', boxShadow: '0 18px 50px rgba(112,170,35,0.14)', border: '1px solid rgba(32,75,87,0.12)' }}>
            <strong style={{ display: 'block', fontSize: '18px', color: '#20313a', marginBottom: '12px' }}>MateBudy encontro un error al abrir</strong>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fff7de', color: '#20313a', padding: '14px', borderRadius: '16px', margin: 0, fontSize: '12px', lineHeight: 1.5 }}>
              {formatError(this.state.error)}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Router>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Router>
    </AppErrorBoundary>
  </React.StrictMode>,
)
