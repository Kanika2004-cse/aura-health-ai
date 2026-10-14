import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'

const initialAppearance = localStorage.getItem('aura-appearance')
const initialDark = initialAppearance === 'system'
  ? window.matchMedia('(prefers-color-scheme: dark)').matches
  : initialAppearance !== 'light'
document.documentElement.dataset.theme = initialDark ? 'dark' : 'light'
document.documentElement.style.colorScheme = initialDark ? 'dark' : 'light'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  if (localStorage.getItem('aura-appearance') !== 'system') return
  document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'
  document.documentElement.style.colorScheme = event.matches ? 'dark' : 'light'
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
