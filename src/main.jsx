import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

const pendingRedirect = sessionStorage.getItem('redirect')

if (pendingRedirect) {
  sessionStorage.removeItem('redirect')

  try {
    const url = new URL(pendingRedirect)
    const base = '/shabu-aroi-jang'
    const routePath = url.pathname.startsWith(base)
      ? url.pathname.slice(base.length) || '/'
      : url.pathname

    window.history.replaceState(
      null,
      '',
      `${base}${routePath}${url.search}${url.hash}`,
    )
  } catch {
    // Ignore malformed redirect data and continue to the app root.
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/shabu-aroi-jang">
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
