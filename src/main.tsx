import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AppDialogProvider } from './components/common/AppDialogProvider'

if (import.meta.env.PROD && 'serviceWorker' in navigator && !window.location.hostname.endsWith('.pages.dev')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppDialogProvider>
      <App />
    </AppDialogProvider>
  </React.StrictMode>,
)
