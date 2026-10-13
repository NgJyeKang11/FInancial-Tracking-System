import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { todayISO } from './lib/dates'
import { applyDueRecurring } from './lib/recurring'

// Add this month's allowance, rent and so on before the app reads its saved data.
applyDueRecurring(todayISO())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
