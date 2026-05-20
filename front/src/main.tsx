import { createRoot } from 'react-dom/client'
import "@fontsource-variable/geist"
import "./index.css"
import App from './App.tsx'

import { AuthProvider } from '@/contexts/authContext'

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)
