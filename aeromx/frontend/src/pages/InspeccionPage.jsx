import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { ordenesService } from '../api/ordenesService'

const ESTADO_COLORES = {
  bueno: 'bg-green-100 text-green-800',
  correcto_con_danos: 'bg-yellow-100 text-yellow-800',
  requiere_atencion: 'bg-orange-100 text-orange-800',
  no_aplica: 'bg-gray-100 text-gray-800'
}

export default function InspeccionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [orden, setOrden] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedSection, setExpandedSection] = useState(0)

  useEffect(() => {
    cargarOrden()
  }, [id])

  const cargarOrden = async () => {
    try {
      const response = await ordenesService.obtener(id)
      setOrden(response.data)
      setError('')
    } catch (err) {
      setError('Error cargando orden')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleResultadoChange = async (resultadoId, campo, valor) => {
    try {
      const data = { [campo]: valor }
      await ordenesService.actualizarResultado(id, resultadoId, data)
      cargarOrden()
    } catch (err) {
      setError('Error actualizando resultado')
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Cargando orden...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!orden) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="text-center py-8">
          <p className="text-gray-600">Orden no encontrada</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Agrupar puntos por sección
  const secciones = {}
  orden.resultados?.forEach((resultado) => {
    const seccionNombre = resultado.punto?.seccion?.nombre || 'Sin sección'
    if (!secciones[seccionNombre]) {
      secciones[seccionNombre] = []
    }
    secciones[seccionNombre].push(resultado)
  })

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

        {/* Encabezado */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            O/T {orden.numeroOt}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Aeronave</p>
              <p className="font-semibold">{orden.aeronave?.matricula}</p>
            </div>
            <div>
              <p className="text-gray-600">Modelo</p>
              <p className="font-semibold">{orden.aeronave?.modelo?.nombre}</p>
            </div>
            <div>
              <p className="text-gray-600">Formato</p>
              <p className="font-semibold">{orden.formato?.nombre}</p>
            </div>
            <div>
              <p className="text-gray-600">Estado</p>
              <p className="font-semibold capitalize">{orden.estado}</p>
            </div>
          </div>
        </div>

        {/* Progreso */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-medium">Progreso General</span>
            <span className="text-gray-800 font-bold">
              {orden.resultados?.filter((r) => r.completado).length || 0} / {orden.resultados?.length || 0}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-600 h-3 rounded-full transition-all duration-300"
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

        {/* Secciones */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(secciones).map(([ seccionNombre, puntos ], idx) => (
            <div key={seccionNombre} className="bg-white rounded-lg shadow overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === idx ? -1 : idx)}
                className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition"
              >
                <h3 className="text-lg font-semibold text-gray-800">{seccionNombre}</h3>
                <span className="text-gray-600">
                  {expandedSection === idx ? '▼' : '▶'}
                </span>
              </button>

              {expandedSection === idx && (
                <div className="px-6 py-4 border-t space-y-4">
                  {puntos.map((resultado) => (
                    <PuntoInspeccion
                      key={resultado.id}
                      resultado={resultado}
                      onChange={handleResultadoChange}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Botones de acción */}
        <div className="mt-8 flex gap-4 justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          {orden.estado === 'en_proceso' && (
            <button
              onClick={() => navigate(`/ordenes/${id}/cierre`)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:bg-gray-400"
              disabled={!orden.resultados?.every((r) => r.completado)}
            >
              Completar Inspección →
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

function PuntoInspeccion({ resultado, onChange }) {
  const [fotosExpanded, setFotosExpanded] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="mb-4">
        <h4 className="font-semibold text-gray-800 mb-1">
          {resultado.punto?.nombreComponente}
        </h4>
        <p className="text-sm text-gray-600">{resultado.punto?.descripcion}</p>
      </div>

      {/* Estado */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Estado
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {['bueno', 'correcto_con_danos', 'requiere_atencion', 'no_aplica'].map(
            (estado) => (
              <button
                key={estado}
                onClick={() => onChange(resultado.id, 'estadoResultado', estado)}
                className={`px-3 py-2 rounded text-sm font-medium transition ${
                  resultado.estadoResultado === estado
                    ? 'ring-2 ring-blue-500 ' + ESTADO_COLORES[estado]
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {estado === 'bueno'
                  ? 'Bueno'
                  : estado === 'correcto_con_danos'
                    ? 'Con Daños'
                    : estado === 'requiere_atencion'
                      ? 'Requiere Atención'
                      : 'No Aplica'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Observación */}
      {['correcto_con_danos', 'requiere_atencion'].includes(resultado.estadoResultado) && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observación <span className="text-red-600">*</span>
          </label>
          <textarea
            value={resultado.observacion || ''}
            onChange={(e) =>
              onChange(resultado.id, 'observacion', e.target.value)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows="2"
            placeholder="Describe el problema encontrado..."
          />
        </div>
      )}

      {/* Fotos */}
      <div className="mb-4">
        <button
          onClick={() => setFotosExpanded(!fotosExpanded)}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          📷 Fotos ({resultado.fotos?.length || 0})
          {fotosExpanded ? '▼' : '▶'}
        </button>
        {fotosExpanded && (
          <div className="mt-2 p-3 bg-gray-50 rounded">
            <p className="text-xs text-gray-600">
              Soporte para cámara en desarrollo
            </p>
          </div>
        )}
      </div>

      {/* Marca como completado */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={resultado.completado || false}
          onChange={(e) => onChange(resultado.id, 'completado', e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
        />
        <label className="text-sm text-gray-700">Punto completado</label>
      </div>
    </div>
  )
}
