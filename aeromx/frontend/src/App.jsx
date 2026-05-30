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
import ProductosPage from './pages/ProductosPage'
import UsuariosPage from './pages/UsuariosPage'
import FlotaPage from './pages/FlotaPage'
import FormatosPage from './pages/FormatosPage'
import CategoriasFallaPage from './pages/CategoriasFallaPage'
import CrearFallaPage from './pages/CrearFallaPage'
import FallasPage from './pages/FallasPage'
import FallaDetallePage from './pages/FallaDetallePage'
import FallasDashboardPage from './pages/FallasDashboardPage'
import PanelControlPage from './pages/PanelControlPage'
import MiPerfilPage from './pages/MiPerfilPage'

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
        <Route
          path="/formatos"
          element={
            <ProtectedRoute>
              <FormatosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/productos"
          element={
            <ProtectedRoute>
              <ProductosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <UsuariosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/flota"
          element={
            <ProtectedRoute>
              <FlotaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categorias-falla"
          element={
            <ProtectedRoute>
              <CategoriasFallaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fallas/nueva"
          element={
            <ProtectedRoute>
              <CrearFallaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fallas/dashboard"
          element={
            <ProtectedRoute>
              <FallasDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fallas"
          element={
            <ProtectedRoute>
              <FallasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fallas/:id"
          element={
            <ProtectedRoute>
              <FallaDetallePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/panel"
          element={
            <ProtectedRoute>
              <PanelControlPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mi-perfil"
          element={
            <ProtectedRoute>
              <MiPerfilPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
