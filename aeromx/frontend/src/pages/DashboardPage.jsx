import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { ordenesService } from '../api/ordenesService'

const ESTADO_COLORS = {
  borrador: 'bg-gray-100 text-gray-800',
  en_proceso: 'bg-blue-100 text-blue-800',
  pendiente_firma: 'bg-yellow-100 text-yellow-800',
  cerrada: 'bg-green-100 text-green-800'
}

const ESTADO_LABELS = {
  borrador: 'Borrador',
  en_proceso: 'En Proceso',
  pendiente_firma: 'Pendiente Firma',
  cerrada: 'Cerrada'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [ordenes, setOrdenes] = useState([])
  const [filtro, setFiltro] = useState('en_proceso')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarOrdenes()
  }, [filtro])

  const cargarOrdenes = async () => {
    setLoading(true)
    try {
      const response = await ordenesService.listar({ estado: filtro })
      setOrdenes(response.data || [])
      setError('')
    } catch (err) {
      setError('Error cargando órdenes')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800">Órdenes de Trabajo</h2>
          <button
            onClick={() => navigate('/ordenes/crear')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition duration-200"
          >
            + Nueva Orden
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {Object.entries(ESTADO_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFiltro(value)}
              className={`px-4 py-2 rounded-lg font-medium transition duration-200 ${
                filtro === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Lista de órdenes */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-2">Cargando órdenes...</p>
            </div>
          ) : ordenes.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">No hay órdenes en este estado</p>
              <button
                onClick={() => navigate('/ordenes/crear')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Crear Primera Orden
              </button>
            </div>
          ) : (
            ordenes.map((orden) => (
              <div
                key={orden.id}
                onClick={() => navigate(`/ordenes/${orden.id}/inspeccion`)}
                className="bg-white rounded-lg shadow hover:shadow-md transition cursor-pointer p-6"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      O/T {orden.numeroOt}
                    </h3>
                    <p className="text-gray-600 text-sm">{orden.cliente}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      ESTADO_COLORS[orden.estado]
                    }`}
                  >
                    {ESTADO_LABELS[orden.estado]}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Aeronave</p>
                    <p className="font-semibold">{orden.aeronave?.matricula}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Técnico</p>
                    <p className="font-semibold">{orden.tecnico?.nombre}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Formato</p>
                    <p className="font-semibold">{orden.formato?.nombre}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Fecha Inicio</p>
                    <p className="font-semibold">
                      {orden.fechaInicio
                        ? new Date(orden.fechaInicio).toLocaleDateString()
                        : '-'}
                    </p>
                  </div>
                </div>

                {/* Progreso */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-600">Progreso</span>
                    <span className="font-semibold text-gray-800">
                      {orden.resultados
                        ? `${orden.resultados.filter((r) => r.completado).length} / ${orden.resultados.length}`
                        : '0 / 0'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width:
                          orden.resultados && orden.resultados.length > 0
                            ? `${
                                (orden.resultados.filter((r) => r.completado).length /
                                  orden.resultados.length) *
                                100
                              }%`
                            : '0%'
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
