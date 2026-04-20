import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Header } from '../components/Header'
import { formatosService } from '../api/formatosService'
import { aeronavesService } from '../api/aeronavesService'
import { ordenesService } from '../api/ordenesService'

export default function CrearOTPage() {
  const navigate = useNavigate()
  const [formatos, setFormatos] = useState([])
  const [aeronaves, setAeronaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      cliente: '',
      ordenServicio: '',
      formatoId: '',
      aeronaveId: ''
    }
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const [formatosRes, aeronavesRes] = await Promise.all([
        formatosService.listar(),
        aeronavesService.listar()
      ])
      setFormatos(formatosRes.data || [])
      setAeronaves(aeronavesRes.data || [])
    } catch (err) {
      setError('Error cargando datos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data) => {
    setSubmitLoading(true)
    try {
      const response = await ordenesService.crear(data)
      navigate(`/ordenes/${response.data.id}/inspeccion`)
    } catch (err) {
      setError(err.response?.data?.message || 'Error creando orden')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Cargando...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Volver
        </button>

        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Nueva Orden de Mantenimiento</h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Formato <span className="text-red-600">*</span>
              </label>
              <select
                {...register('formatoId', { required: 'Selecciona un formato' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Selecciona un formato --</option>
                {formatos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
              {errors.formatoId && (
                <p className="text-red-500 text-sm mt-1">{errors.formatoId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aeronave <span className="text-red-600">*</span>
              </label>
              <select
                {...register('aeronaveId', { required: 'Selecciona una aeronave' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Selecciona una aeronave --</option>
                {aeronaves.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.matricula} ({a.modelo?.nombre})
                  </option>
                ))}
              </select>
              {errors.aeronaveId && (
                <p className="text-red-500 text-sm mt-1">{errors.aeronaveId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cliente
              </label>
              <input
                type="text"
                {...register('cliente')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre del cliente"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Orden de Servicio
              </label>
              <input
                type="text"
                {...register('ordenServicio')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Número de orden de servicio"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitLoading}
                className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition duration-200"
              >
                {submitLoading ? 'Creando...' : 'Crear Orden'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
