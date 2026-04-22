import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { aeronavesService } from '../api/aeronavesService'
import { ordenesService } from '../api/ordenesService'

const ESTADO_COLORS = {
  borrador:        'bg-gray-100 text-gray-800 border-gray-300',
  en_proceso:      'bg-blue-100 text-blue-800 border-blue-300',
  pendiente_firma: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  cerrada:         'bg-green-100 text-green-800 border-green-300',
}

export default function FlotaPage() {
  const navigate = useNavigate()
  const [aeronaves, setAeronaves] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState({})
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    try {
      const [aerRes, ordRes] = await Promise.all([
        aeronavesService.listar({ todas: 'true' }),
        ordenesService.listar({ archivada: 'todas' }),
      ])
      setAeronaves(aerRes.data || [])
      setOrdenes(ordRes.data || [])
      setError('')
    } catch (e) {
      setError('Error cargando flota')
    } finally {
      setLoading(false)
    }
  }

  // Agrupar O/T por aeronaveId
  const ordenesPorAeronave = useMemo(() => {
    const m = new Map()
    for (const o of ordenes) {
      if (!m.has(o.aeronaveId)) m.set(o.aeronaveId, [])
      m.get(o.aeronaveId).push(o)
    }
    // Ordenar cada grupo por fecha de creación descendente
    for (const v of m.values()) {
      v.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    return m
  }, [ordenes])

  const aeronavesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return aeronaves
    return aeronaves.filter(a =>
      a.matricula?.toLowerCase().includes(q) ||
      a.modelo?.nombre?.toLowerCase().includes(q) ||
      a.numeroSerie?.toLowerCase().includes(q)
    )
  }, [aeronaves, busqueda])

  const toggle = (id) => setExpandido(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Volver
        </button>

        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-800">Flota por aeronave</h2>
          <p className="text-sm text-gray-500 mt-1">
            Histórico de órdenes de mantenimiento agrupadas por aeronave
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="🔎 Buscar por matrícula, modelo o serie…"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Cargando flota…</p>
          </div>
        ) : aeronavesFiltradas.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-10 text-center text-gray-600">
            No hay aeronaves registradas.
          </div>
        ) : (
          <div className="space-y-3">
            {aeronavesFiltradas.map((a) => {
              const ords = ordenesPorAeronave.get(a.id) || []
              const isOpen = Boolean(expandido[a.id])
              const enProceso = ords.filter(o => o.estado !== 'cerrada' && !o.archivada).length
              const cerradas = ords.filter(o => o.estado === 'cerrada').length
              return (
                <section key={a.id} className="bg-white rounded-lg shadow overflow-hidden">
                  <button
                    onClick={() => toggle(a.id)}
                    className="w-full px-5 py-4 flex justify-between items-center bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 hover:from-blue-100 transition text-left"
                  >
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-gray-800 font-mono">
                          {a.matricula}
                        </h3>
                        <span className="text-sm text-gray-600">
                          {a.modelo?.nombre}{a.modelo?.fabricante ? ` · ${a.modelo.fabricante}` : ''}
                        </span>
                        {a.activa === false && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full font-semibold">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {a.numeroSerie ? `S/N ${a.numeroSerie} · ` : ''}
                        Horas totales: {a.horasTotales ?? 0}h · Motor D: {a.horasMotorDer ?? 0}h · Motor I: {a.horasMotorIzq ?? 0}h
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <div className="text-blue-700 font-semibold">{enProceso} activas</div>
                        <div className="text-green-700">{cerradas} cerradas</div>
                      </div>
                      <span className="text-gray-500">{isOpen ? '▼' : '▶'}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-gray-100">
                      {ords.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 text-sm">
                          Esta aeronave aún no tiene órdenes registradas.
                        </div>
                      ) : (
                        ords.map((o) => (
                          <ResumenOrden key={o.id} orden={o} onClick={() => navigate(`/ordenes/${o.id}/inspeccion`)} />
                        ))
                      )}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function ResumenOrden({ orden, onClick }) {
  const fecha = orden.createdAt ? new Date(orden.createdAt) : null
  return (
    <button
      onClick={onClick}
      className="w-full px-5 py-3 text-left hover:bg-gray-50 flex justify-between items-center gap-3 flex-wrap"
    >
      <div className="flex-1 min-w-[260px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-800">{orden.numeroOt}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${ESTADO_COLORS[orden.estado] || ''}`}>
            {orden.estado?.replace(/_/g, ' ')}
          </span>
          {orden.archivada && (
            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full font-semibold">
              Archivada
            </span>
          )}
        </div>
        <div className="text-xs text-gray-600 mt-1 space-x-3">
          <span>Técnico: <strong>{orden.tecnico?.nombre || '—'}</strong></span>
          <span>Supervisor: <strong>{orden.supervisor?.nombre || '—'}</strong></span>
          {orden.lugarMantenimiento && <span>Lugar: <strong>{orden.lugarMantenimiento}</strong></span>}
        </div>
      </div>
      <div className="text-right text-xs text-gray-500">
        {fecha && (
          <>
            <div>{fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div>{fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
          </>
        )}
      </div>
    </button>
  )
}
