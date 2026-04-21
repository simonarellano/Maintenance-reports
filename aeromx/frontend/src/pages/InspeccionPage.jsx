import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { ordenesService } from '../api/ordenesService'

const ESTADOS = [
  { value: 'bueno',              label: 'Bueno',             color: 'bg-green-100  text-green-800  border-green-300'  },
  { value: 'correcto_con_danos', label: 'Con daños',         color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'requiere_atencion',  label: 'Requiere atención', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'no_aplica',          label: 'No aplica',         color: 'bg-gray-100   text-gray-700   border-gray-300'   },
]

const REQUIERE_OBSERVACION = ['correcto_con_danos', 'requiere_atencion']

export default function InspeccionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [orden, setOrden] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState({})

  useEffect(() => { cargarOrden() }, [id])

  const cargarOrden = async () => {
    try {
      const { data } = await ordenesService.obtener(id)
      setOrden(data)
      setError('')
    } catch (e) {
      console.error(e)
      setError('Error cargando la orden')
    } finally {
      setLoading(false)
    }
  }

  const actualizarResultado = async (resultadoId, data) => {
    try {
      await ordenesService.actualizarResultado(id, resultadoId, data)
      await cargarOrden()
    } catch (e) {
      console.error(e)
      setError(e.response?.data?.error || 'Error actualizando punto')
    }
  }

  const firmarPunto = async (resultadoId) => {
    try {
      await ordenesService.firmarPunto(id, resultadoId)
      await cargarOrden()
    } catch (e) {
      console.error(e)
      setError(e.response?.data?.error || 'Error firmando')
    }
  }

  const subirFoto = async (resultadoId, file) => {
    if (!file) return
    try {
      await ordenesService.subirFoto(id, resultadoId, file)
      await cargarOrden()
    } catch (e) {
      console.error(e)
      setError(e.response?.data?.error || 'Error subiendo foto')
    }
  }

  const eliminarFoto = async (resultadoId, fotoId) => {
    if (!confirm('¿Eliminar esta foto?')) return
    try {
      await ordenesService.eliminarFoto(id, resultadoId, fotoId)
      await cargarOrden()
    } catch (e) {
      console.error(e)
      setError(e.response?.data?.error || 'Error eliminando foto')
    }
  }

  const toggleSection = (key) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))

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

  // Agrupar resultados por sección, respetando el orden definido en el formato
  const grupos = new Map()
  for (const r of orden.resultados || []) {
    const seccion = r.punto?.seccion
    const key = seccion?.id ?? 'sin-seccion'
    if (!grupos.has(key)) {
      grupos.set(key, {
        id: key,
        nombre: seccion?.nombre ?? 'Sin sección',
        descripcion: seccion?.descripcion ?? '',
        orden: seccion?.orden ?? 999,
        resultados: [],
      })
    }
    grupos.get(key).resultados.push(r)
  }
  const secciones = Array.from(grupos.values()).sort((a, b) => a.orden - b.orden)
  // Ordenar los puntos dentro de cada sección por el campo `orden` del punto
  secciones.forEach((s) =>
    s.resultados.sort((a, b) => (a.punto?.orden ?? 0) - (b.punto?.orden ?? 0))
  )

  const totalPuntos = orden.resultados?.length || 0
  const completados = orden.resultados?.filter((r) => r.completado).length || 0
  const progreso = totalPuntos > 0 ? (completados / totalPuntos) * 100 : 0
  const todosCompletos = totalPuntos > 0 && completados === totalPuntos

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Volver
        </button>

        {/* Encabezado de la O/T */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
            O/T {orden.numeroOt}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Aeronave</p>
              <p className="font-semibold">{orden.aeronave?.matricula}</p>
            </div>
            <div>
              <p className="text-gray-500">Modelo</p>
              <p className="font-semibold">{orden.aeronave?.modelo?.nombre}</p>
            </div>
            <div>
              <p className="text-gray-500">Formato</p>
              <p className="font-semibold">{orden.formato?.nombre}</p>
            </div>
            <div>
              <p className="text-gray-500">Estado</p>
              <p className="font-semibold capitalize">{orden.estado?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-gray-500">Técnico</p>
              <p className="font-semibold">{orden.tecnico?.nombre}</p>
            </div>
            {orden.supervisor && (
              <div>
                <p className="text-gray-500">Supervisor</p>
                <p className="font-semibold">{orden.supervisor?.nombre}</p>
              </div>
            )}
            {orden.cliente && (
              <div>
                <p className="text-gray-500">Cliente</p>
                <p className="font-semibold">{orden.cliente}</p>
              </div>
            )}
            {orden.ordenServicio && (
              <div>
                <p className="text-gray-500">Orden de servicio</p>
                <p className="font-semibold">{orden.ordenServicio}</p>
              </div>
            )}
          </div>
        </div>

        {/* Progreso */}
        <div className="bg-white rounded-lg shadow p-4 mb-4 sticky top-0 z-10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700 font-medium">Progreso general</span>
            <span className="text-gray-800 font-bold">
              {completados} / {totalPuntos}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button className="float-right font-bold" onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* Tablas por sección */}
        <div className="space-y-4">
          {secciones.map((sec, idx) => {
            const isCollapsed = collapsed[sec.id] === true
            const secTotal = sec.resultados.length
            const secHechos = sec.resultados.filter((r) => r.completado).length
            return (
              <section key={sec.id} className="bg-white rounded-lg shadow overflow-hidden">
                <button
                  onClick={() => toggleSection(sec.id)}
                  className="w-full px-5 py-3 flex justify-between items-center bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 hover:from-blue-100 transition"
                >
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-gray-800">
                      {idx + 1}. {sec.nombre}
                    </h3>
                    {sec.descripcion && (
                      <p className="text-sm text-gray-600">{sec.descripcion}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold px-2 py-1 rounded ${
                      secHechos === secTotal
                        ? 'bg-green-200 text-green-800'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {secHechos} / {secTotal}
                    </span>
                    <span className="text-gray-500">{isCollapsed ? '▶' : '▼'}</span>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr className="text-left text-gray-700">
                          <th className="px-3 py-2 font-semibold w-10">#</th>
                          <th className="px-3 py-2 font-semibold min-w-[180px]">Componente</th>
                          <th className="px-3 py-2 font-semibold min-w-[220px]">Descripción de trabajo</th>
                          <th className="px-3 py-2 font-semibold min-w-[260px]">Condición</th>
                          <th className="px-3 py-2 font-semibold min-w-[140px]">Firma técnico</th>
                          <th className="px-3 py-2 font-semibold min-w-[200px]">Registro fotográfico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sec.resultados.map((r, i) => (
                          <FilaPunto
                            key={r.id}
                            index={i + 1}
                            resultado={r}
                            soloLectura={orden.estado === 'cerrada'}
                            onCambiar={actualizarResultado}
                            onFirmar={firmarPunto}
                            onSubirFoto={subirFoto}
                            onEliminarFoto={eliminarFoto}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {/* Botones de acción */}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            Volver
          </button>
          {(orden.estado === 'borrador' || orden.estado === 'en_proceso') && (
            <button
              onClick={() => navigate(`/ordenes/${id}/cierre`)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:bg-gray-400"
              disabled={!todosCompletos}
              title={todosCompletos ? '' : 'Completar todos los puntos antes de cerrar'}
            >
              Completar inspección →
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Fila de la tabla de inspección
// ───────────────────────────────────────────────────────────────────────────

function FilaPunto({ index, resultado, soloLectura, onCambiar, onFirmar, onSubirFoto, onEliminarFoto }) {
  const punto = resultado.punto
  const [obs, setObs] = useState(resultado.observacion || '')
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [modoCaptura, setModoCaptura] = useState(null) // null | 'camara' | 'archivo'

  useEffect(() => {
    setObs(resultado.observacion || '')
  }, [resultado.observacion])

  const requiereObs = REQUIERE_OBSERVACION.includes(resultado.estadoResultado)
  const filaCompleta = resultado.completado
  const puedeFirmarse = punto?.esCritico && resultado.completado && !resultado.firmadoPor

  const cambiarEstado = (estado) => {
    if (soloLectura) return
    onCambiar(resultado.id, { estadoResultado: estado })
  }

  const guardarObs = () => {
    if (soloLectura) return
    if ((obs || '') === (resultado.observacion || '')) return
    onCambiar(resultado.id, { observacion: obs })
  }

  const toggleCompletado = () => {
    if (soloLectura) return
    if (!resultado.completado && requiereObs && !(obs || '').trim()) {
      alert('Escribe una observación antes de marcar como completado')
      return
    }
    onCambiar(resultado.id, {
      completado: !resultado.completado,
      ...(requiereObs ? { observacion: obs } : {}),
    })
  }

  const iniciarCapturaCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setModoCaptura('camara')
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err) {
      console.error('Error accediendo a la cámara:', err)
      alert('No se pudo acceder a la cámara. Usa el método manual.')
    }
  }

  const capturarFoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d')
      canvasRef.current.width = videoRef.current.videoWidth
      canvasRef.current.height = videoRef.current.videoHeight
      context.drawImage(videoRef.current, 0, 0)

      canvasRef.current.toBlob((blob) => {
        const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onSubirFoto(resultado.id, file)
        cerrarCaptura()
      }, 'image/jpeg', 0.95)
    }
  }

  const cerrarCaptura = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop())
    }
    setModoCaptura(null)
  }

  return (
    <tr className={`border-b border-gray-100 ${filaCompleta ? 'bg-green-50/40' : ''}`}>
        {/* # */}
        <td className="px-3 py-3 text-gray-500 align-top">{index}</td>

        {/* Componente */}
        <td className="px-3 py-3 align-top">
          <div className="font-semibold text-gray-800">{punto?.nombreComponente}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {punto?.esCritico && (
              <span className="text-[11px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">
                CRÍTICO
              </span>
            )}
            {punto?.fotoRequerida && (
              <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                FOTO OBLIGATORIA
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 mt-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={resultado.completado || false}
              onChange={toggleCompletado}
              disabled={soloLectura}
              className="w-4 h-4"
            />
            Completado
          </label>
        </td>

        {/* Descripción de trabajo */}
        <td className="px-3 py-3 text-gray-700 align-top">
          {punto?.descripcion || <span className="text-gray-400 italic">—</span>}
        </td>

        {/* Condición */}
        <td className="px-3 py-3 align-top">
          <div className="space-y-2">
            <select
              value={resultado.estadoResultado || 'bueno'}
              onChange={(e) => cambiarEstado(e.target.value)}
              disabled={soloLectura}
              className={`w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                soloLectura ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
              }`}
            >
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
            {resultado.estadoResultado && (
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                ESTADOS.find(e => e.value === resultado.estadoResultado)?.color
              }`}>
                {ESTADOS.find(e => e.value === resultado.estadoResultado)?.label}
              </span>
            )}
          </div>
          {requiereObs && (
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              onBlur={guardarObs}
              disabled={soloLectura}
              placeholder="Observación obligatoria..."
              rows={2}
              className="mt-2 w-full text-xs px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          )}
        </td>

        {/* Firma técnico */}
        <td className="px-3 py-3 align-top">
          {!punto?.esCritico ? (
            <span className="text-xs text-gray-400 italic">No requiere</span>
          ) : resultado.firmadoPor ? (
            <div className="text-xs">
              <div className="font-semibold text-green-700">✓ Firmado</div>
              <div className="text-gray-600">{resultado.firmante?.nombre}</div>
              {resultado.fechaFirma && (
                <div className="text-gray-500">
                  {new Date(resultado.fechaFirma).toLocaleDateString('es-MX')}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onFirmar(resultado.id)}
              disabled={soloLectura || !puedeFirmarse}
              title={puedeFirmarse ? 'Firmar este punto crítico' : 'Completa el punto antes de firmar'}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Firmar
            </button>
          )}
        </td>

        {/* Registro fotográfico */}
        <td className="px-3 py-3 align-top">
          <div className="flex flex-wrap gap-1 mb-2">
            {(resultado.fotos || []).map((f) => (
              <div key={f.id} className="relative group">
                <a href={f.urlArchivo} target="_blank" rel="noreferrer">
                  <img
                    src={f.urlArchivo}
                    alt={f.nombreArchivo}
                    className="w-14 h-14 object-cover rounded border border-gray-300"
                  />
                </a>
                {!soloLectura && (
                  <button
                    type="button"
                    onClick={() => onEliminarFoto(resultado.id, f.id)}
                    className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 transition"
                    title="Eliminar"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {(resultado.fotos || []).length === 0 && (
              <span className="text-xs text-gray-400 italic">Sin fotos</span>
            )}
          </div>

          {!soloLectura && modoCaptura === null && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={iniciarCapturaCamara}
                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
              >
                📷 Capturar
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-gray-700"
              >
                📁 Cargar archivo
              </button>
            </div>
          )}

          {modoCaptura === 'camara' && (
            <div className="fixed inset-0 bg-black/75 flex flex-col items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg w-full max-w-md overflow-hidden">
                <div className="bg-gray-200 relative">
                  <video
                    ref={videoRef}
                    className="w-full aspect-video object-cover"
                    playsInline
                  />
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2 p-4">
                  <button
                    type="button"
                    onClick={cerrarCaptura}
                    className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded font-medium text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={capturarFoto}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm"
                  >
                    📷 Capturar
                  </button>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onSubirFoto(resultado.id, file)
              e.target.value = ''
            }}
          />
        </td>
      </tr>
  )
}
