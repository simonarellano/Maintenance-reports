import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../store/authStore'
import { authService } from '../api/authService'

export default function LoginPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const login = useAuthStore((state) => state.login)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      email: 'tecnico@aeromx.com',
      password: 'aeromx123'
    }
  })

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const onSubmit = async (data) => {
    setLoading(true)
    setError('')
    try {
      const response = await authService.login(data.email, data.password)
      const { user, token } = response.data
      login(user, token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Error en autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">AeroMX</h1>
          <p className="text-center text-gray-600 mb-8">Gestión de Mantenimiento Aeronáutico</p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                {...register('email', { required: 'El correo es obligatorio' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="usuario@aeromx.com"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                {...register('password', { required: 'La contraseña es obligatoria' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
            >
              {loading ? 'Autenticando...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-gray-700">
            <p className="font-semibold mb-2">Credenciales de Prueba:</p>
            <p>• Técnico: tecnico@aeromx.com / aeromx123</p>
            <p>• Ingeniero: ingeniero@aeromx.com / aeromx123</p>
            <p>• Supervisor: supervisor@aeromx.com / aeromx123</p>
          </div>
        </div>
      </div>
    </div>
  )
}
