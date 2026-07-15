import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './lib/auth.tsx';
import { ensureCgopsSession } from './lib/cgopsSession';
import './index.css';

// Consume a CGOPS SSO handoff (office cohort) before anything renders, so the
// AuthProvider sees the resolved identity on mount. Chefs (no handoff) fall
// through to the normal PIN login. Runs first, before any hash-based routing.
ensureCgopsSession().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  );
});
