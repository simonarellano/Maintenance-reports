import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { ordenesService } from '../api/ordenesService'
import { useAuthStore } from '../store/authStore'

const ESTADO_COLORS = {
  borrador:        'bg-gray-100 text-gray-800 border-gray-300',
  en_proceso:      'bg-blue-100 text-blue-800 border-blue-300',
  pendiente_firma: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  cerrada:         'bg-green-100 text-green-800 border-green-300',
}

const ESTADO_LABELS = {
  todas:           'Todas',
  borrador:        'Borrador',
  en_proceso:      'En Proceso',
  pendiente_firma: 'Pendiente Firma',
  cerrada:         'Cerradas (histórico)',
}

const FILTROS_ORDEN = ['todas', 'borrador', 'en_proceso', 'pendiente_firma', 'cerrada']

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const esSupervisor = user?.rol === 'supervisor'
  const [ordenes, setOrdenes] = useState([])
  const [filtro, setFiltro] = useState('todas')
  const [vistaArchivo, setVistaArchivo] = useState('activas') // activas | archivadas | todas
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarOrdenes()
  }, [filtro, vistaArchivo])

  const cargarOrdenes = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filtro !== 'todas') params.estado = filtro
      if (vistaArchivo === 'archivadas') params.archivada = 'true'
      else if (vistaArchivo === 'todas') params.archivada = 'todas'
      // por defecto vistaArchivo='activas' → backend excluye archivadas
      const response = await ordenesService.listar(params)
      setOrdenes(response.data || [])
      setError('')
    } catch (err) {
      setError('Error cargando órdenes')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const archivarOrden = async (e, orden) => {
    e.stopPropagation()
    const accion = orden.archivada ? 'desarchivar' : 'archivar'
    if (!confirm(`¿${accion === 'archivar' ? 'Archivar' : 'Desarchivar'} la orden ${orden.numeroOt}?`)) return
    try {
      await ordenesService.archivar(orden.id, !orden.archivada)
      await cargarOrdenes()
    } catch (err) {
      setError(err.response?.data?.error || `Error al ${accion} la orden`)
    }
  }

  const eliminarOrden = async (e, orden) => {
    e.stopPropagation()
    if (!confirm(
      `⚠️ ¿Eliminar definitivamente la orden ${orden.numeroOt}?\n\nEsta acción es IRREVERSIBLE y borrará todos sus datos asociados.`
    )) return
    try {
      await ordenesService.eliminar(orden.id)
      await cargarOrdenes()
    } catch (err) {
      setError(err.response?.data?.error || 'Error eliminando la orden')
    }
  }

  const ordenesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return ordenes
    return ordenes.filter(o =>
      o.numeroOt?.toLowerCase().includes(q) ||
      o.aeronave?.matricula?.toLowerCase().includes(q) ||
      o.cliente?.toLowerCase().includes(q) ||
      o.tecnico?.nombre?.toLowerCase().includes(q) ||
      o.formato?.nombre?.toLowerCase().includes(q)
    )
  }, [ordenes, busqueda])

  const contadores = useMemo(() => ({
    total:           ordenes.length,
    enProceso:       ordenes.filter(o => o.estado === 'en_proceso').length,
    pendienteFirma:  ordenes.filter(o => o.estado === 'pendiente_firma').length,
    cerradas:        ordenes.filter(o => o.estado === 'cerrada').length,
  }), [ordenes])

  const descargarPDF = async (e, id, numeroOt) => {
    e.stopPropagation()
    try {
      const response = await ordenesService.descargarPDF(id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `OT-${numeroOt}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Error descargando el PDF')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Órdenes de Trabajo</h2>
            <p className="text-gray-500 text-sm mt-1">
              Registro histórico de mantenimientos realizados
            </p>
          </div>
          <button
            onClick={() => navigate('/ordenes/crear')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition duration-200 font-semibold"
          >
            + Nueva Orden
          </button>
        </div>

        {/* Tarjetas de resumen */}
        {filtro === 'todas' && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total" value={contadores.total} color="gray" />
            <StatCard label="En proceso" value={contadores.enProceso} color="blue" />
            <StatCard label="Pendiente firma" value={contadores.pendienteFirma} color="yellow" />
            <StatCard label="Cerradas" value={contadores.cerradas} color="green" />
          </div>
        )}

        {/* Filtros + búsqueda */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {FILTROS_ORDEN.map((value) => (
              <button
                key={value}
                onClick={() => setFiltro(value)}
                className={`px-4 py-2 rounded-lg font-medium transition duration-200 text-sm ${
                  filtro === value
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:border-blue-500'
                }`}
              >
                {ESTADO_LABELS[value]}
              </button>
            ))}
          </div>

          {/* Vista de archivo */}
          <div className="flex gap-2 flex-wrap items-center pt-2 border-t border-gray-200">
            <span className="text-xs text-gray-500 uppercase font-semibold mr-1">Archivo:</span>
            {[
              { value: 'activas',     label: 'Activas' },
              { value: 'archivadas',  label: 'Archivadas' },
              { value: 'todas',       label: 'Mostrar todas' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setVistaArchivo(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  vistaArchivo === opt.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:border-indigo-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="🔎 Buscar por matrícula, N.º O/T, cliente, técnico o formato…"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Lista */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-gray-600 mt-2">Cargando órdenes...</p>
            </div>
          ) : ordenesFiltradas.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-10 text-center">
              <p className="text-gray-600 mb-4">
                {busqueda
                  ? `Sin resultados para "${busqueda}"`
                  : 'No hay órdenes en este estado'}
              </p>
              <button
                onClick={() => navigate('/ordenes/crear')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Crear nueva orden
              </button>
            </div>
          ) : (
            ordenesFiltradas.map((orden) => {
              const totalPuntos = orden._count?.resultados || 0
              const completos = orden.resultados?.filter((r) => r.completado).length || 0
              const progreso = totalPuntos > 0 ? (completos / totalPuntos) * 100 : 0
              const esCerrada = orden.estado === 'cerrada'

              return (
                <div
                  key={orden.id}
                  onClick={() => navigate(`/ordenes/${orden.id}/inspeccion`)}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer p-5 border-l-4 border-l-blue-500"
                >
                  <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        O/T {orden.numeroOt}
                      </h3>
                      {orden.cliente && (
                        <p className="text-gray-600 text-sm">{orden.cliente}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        ESTADO_COLORS[orden.estado]
                      }`}>
                        {ESTADO_LABELS[orden.estado]?.replace(' (histórico)', '')}
                      </span>
                      {orden.archivada && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full font-semibold">
                          Archivada
                        </span>
                      )}
                      {esCerrada && (
                        <button
                          onClick={(e) => descargarPDF(e, orden.id, orden.numeroOt)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded font-semibold"
                          title="Descargar reporte PDF"
                        >
                          📄 PDF
                        </button>
                      )}
                      {esSupervisor && (
                        <>
                          <button
                            onClick={(e) => archivarOrden(e, orden)}
                            className={`px-3 py-1 text-xs rounded font-semibold border ${
                              orden.archivada
                                ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-300'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
                            }`}
                            title={orden.archivada ? 'Desarchivar' : 'Archivar'}
                          >
                            {orden.archivada ? '↩ Desarchivar' : '🗄 Archivar'}
                          </button>
                          {(orden.estado === 'borrador' || orden.archivada) && (
                            <button
                              onClick={(e) => eliminarOrden(e, orden)}
                              className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded font-semibold border border-red-300"
                              title="Eliminar definitivamente"
                            >
                              🗑 Eliminar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Aeronave</p>
                      <p className="font-semibold">
                        {orden.aeronave?.matricula}
                        {orden.aeronave?.modelo?.nombre && (
                          <span className="text-gray-500 font-normal"> · {orden.aeronave.modelo.nombre}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Técnico</p>
                      <p className="font-semibold">{orden.tecnico?.nombre || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Supervisor</p>
                      <p className="font-semibold">{orden.supervisor?.nombre || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Formato</p>
                      <p className="font-semibold">{orden.formato?.nombre}</p>
                    </div>
                    {orden.lugarMantenimiento && (
                      <div>
                        <p className="text-gray-500 text-xs">Lugar</p>
                        <p className="font-semibold">📍 {orden.lugarMantenimiento}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500 text-xs">Recepción</p>
                      <p className="font-semibold">
                        {orden.fechaRecepcion
                          ? new Date(orden.fechaRecepcion).toLocaleDateString('es-MX')
                          : <span className="text-amber-700">Pendiente</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Inicio trabajos</p>
                      <p className="font-semibold">
                        {orden.fechaInicio
                          ? new Date(orden.fechaInicio).toLocaleDateString('es-MX')
                          : <span className="text-gray-400">Sin iniciar</span>}
                      </p>
                    </div>
                    {esCerrada && (
                      <div>
                        <p className="text-gray-500 text-xs">Fecha cierre</p>
                        <p className="font-semibold text-green-700">
                          {orden.fechaCierre
                            ? new Date(orden.fechaCierre).toLocaleDateString('es-MX')
                            : '—'}
                        </p>
                      </div>
                    )}
                  </div>

                  {!esCerrada && totalPuntos > 0 && (
                    <div className="mt-4 pt-3 border-t">
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-gray-600">Progreso</span>
                        <span className="font-semibold text-gray-800">
                          {completos} / {totalPuntos}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progreso}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = {
    gray:   'bg-gray-50 text-gray-800 border-gray-300',
    blue:   'bg-blue-50 text-blue-800 border-blue-300',
    yellow: 'bg-yellow-50 text-yellow-800 border-yellow-300',
    green:  'bg-green-50 text-green-800 border-green-300',
  }
  return (
    <div className={`border rounded-lg p-3 ${colors[color]}`}>
      <div className="text-xs uppercase tracking-wide font-semibold opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}
