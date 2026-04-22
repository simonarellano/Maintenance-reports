import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const navLink = (to, label) => {
    const active = location.pathname.startsWith(to)
    return (
      <button
        key={to}
        onClick={() => navigate(to)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
          active ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold">AeroMX</h1>
            <p className="text-blue-100 text-xs">Gestión de Mantenimiento</p>
          </div>
          <nav className="flex items-center gap-1">
            {navLink('/dashboard', 'Órdenes')}
            {user?.rol === 'supervisor' && navLink('/modelos', 'Modelos')}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold">{user?.nombre}</p>
            <p className="text-blue-100 text-sm capitalize">{user?.rol}</p>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition duration-200"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
