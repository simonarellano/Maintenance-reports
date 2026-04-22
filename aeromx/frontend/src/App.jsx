import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { ProtectedRoute } from './components/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CrearOTPage from './pages/CrearOTPage'
import InspeccionPage from './pages/InspeccionPage'
import CierreOTPage from './pages/CierreOTPage'
import ModelosPage from './pages/ModelosPage'

function App() {
  const hydrate = useAuthStore((state) => state.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ordenes/crear"
          element={
            <ProtectedRoute>
              <CrearOTPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ordenes/:id/inspeccion"
          element={
            <ProtectedRoute>
              <InspeccionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ordenes/:id/cierre"
          element={
            <ProtectedRoute>
              <CierreOTPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modelos"
          element={
            <ProtectedRoute>
              <ModelosPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
