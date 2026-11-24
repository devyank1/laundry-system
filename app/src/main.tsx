import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import { App } from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth, RequireMfa, RequireRegistration } from './auth/RouteGuards'
import { NotFoundPage } from './ui/ErrorPages'
import { LoginPage } from './ui/LoginPage'
import { SetPasswordPage } from './ui/SetPasswordPage'
import { ErrorBoundary } from './ui/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <RequireMfa>
                <RequireRegistration>
                  <App />
                </RequireRegistration>
                </RequireMfa>
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
