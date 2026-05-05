import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initSentry } from './sentry'
import './styles/globals.css'
import { syncI18nLanguage } from './i18n'

initSentry()

syncI18nLanguage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
