import { createRoot } from 'react-dom/client'
import "@fontsource-variable/geist"
import "./index.css"
import App from './App.tsx'

import { AuthProvider } from '@/contexts/authContext'

async function bootstrap() {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK_API === 'true') {
    // Optional glob: deleting the temporary mock file does not break startup.
    const mocks = import.meta.glob('./mock-backend.ts');
    await mocks['./mock-backend.ts']?.();
  }

  createRoot(document.getElementById('root')!).render(
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}

void bootstrap();
