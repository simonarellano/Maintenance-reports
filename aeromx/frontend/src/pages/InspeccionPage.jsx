import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { ordenesService } from '../api/ordenesService'
import { usuariosService } from '../api/usuariosService'
import { useAuthStore } from '../store/authStore'
import { T, STATUS, PUNTO_STATUS, TIPO_PRODUCTO, ROL_LABELS } from '../tokens/design'
import {
  Btn, BtnSm, Card, ErrorBanner, FieldSelect, Hdr,
  KV, Modal, Pill, ProgressBar, Spinner,
} from '../components/ui'

const ESTADOS_OPCIONES = [
  { value: 'bueno',              label: 'Bueno' },
  { value: 'correcto_con_danos', label: 'Con daños' },
  { value: 'requiere_atencion',  label: 'Requiere atención' },
  { value: 'no_aplica',          label: 'No aplica' },
]

const REQUIERE_OBSERVACION = ['correcto_con_danos', 'requiere_atencion']

const ROLES_SOPORTE = ['tecnico_soporte', 'ingeniero_soporte']

// Requisitos de personal por tipo de producto (espejo del backend).
const REQUISITOS_PERSONAL = {
  aeronave:            { mecanico: 'obligatorio', piloto: 'obligatorio', operador: 'prohibido'   },
  gcs:                 { mecanico: 'opcional',    piloto: 'prohibido',   operador: 'obligatorio' },
  planta:              { mecanico: 'obligatorio', piloto: 'prohibido',   operador: 'prohibido'   },
  sensor_inteligencia: { mecanico: 'prohibido',   piloto: 'prohibido',   operador: 'prohibido'   },
}

export default function InspeccionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [orden, setOrden] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const [identificadorInput, setIdentificadorInput] = useState('')
  const [recepcionLoading, setRecepcionLoading] = useState(false)
  const [showAsignacion, setShowAsignacion] = useState(false)
  const [usuarios, setUsuarios] = useState([])
  const [showHistorial, setShowHistorial] = useState(false)
  const [revisionPara, setRevisionPara] = useState(null)
  const [comentarioRevision, setComentarioRevision] = useState('')
  const [revisionLoading, setRevisionLoading] = useState(false)
  const [soloMisTareas, setSoloMisTareas] = useState(false)

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

  const cargarUsuariosParaAsignacion = async () => {
    try {
      const { data } = await usuariosService.listar({ activo: true })
      setUsuarios(data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const abrirAsignacion = () => {
    setShowAsignacion(true)
    if (usuarios.length === 0) cargarUsuariosParaAsignacion()
  }

  const guardarAsignacion = async (asignaciones) => {
    try {
      await ordenesService.asignar(id, asignaciones)
      setShowAsignacion(false)
      await cargarOrden()
    } catch (e) {
      console.error(e)
      setError(e.response?.data?.error || 'Error asignando la orden')
    }
  }

  const recepcionar = async () => {
    if (!identificadorInput.trim()) {
      setError('Ingresa el identificador para validar la recepción')
      return
    }
    setRecepcionLoading(true)
    try {
      await ordenesService.recepcionar(id, identificadorInput.trim())
      setIdentificadorInput('')
      setError('')
      await cargarOrden()
    } catch (e) {
      setError(e.response?.data?.error || 'Error registrando la recepción')
    } finally {
      setRecepcionLoading(false)
    }
  }

  const iniciarMantenimiento = async (lecturas) => {
    await ordenesService.iniciarMantenimiento(id, lecturas)
    setError('')
    await cargarOrden()
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

  const asignarPunto = async (resultadoId, asignadoId) => {
    try {
      await ordenesService.asignarPunto(id, resultadoId, asignadoId || null)
      await cargarOrden()
    } catch (e) {
      console.error(e)
      setError(e.response?.data?.error || 'Error asignando responsable')
    }
  }

  const firmarTarea = async (resultadoId) => {
    try {
      await ordenesService.firmarTarea(id, resultadoId)
      await cargarOrden()
    } catch (e) {
      console.error(e)
      setError(e.response?.data?.error || 'Error firmando la tarea')
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

  const pedirRevision = (resultadoId) => {
    setComentarioRevision('')
    setRevisionPara(resultadoId)
  }

  const confirmarPedirRevision = async () => {
    if (!comentarioRevision.trim()) {
      setError('El motivo de la revisión es obligatorio')
      return
    }
    setRevisionLoading(true)
    try {
      await ordenesService.pedirRevisionPunto(id, revisionPara, comentarioRevision.trim())
      setRevisionPara(null)
      setComentarioRevision('')
      await cargarOrden()
    } catch (e) {
      console.error(e)
      setError(e.response?.data?.error || 'Error al pedir revisión')
    } finally {
      setRevisionLoading(false)
    }
  }

  const resolverRevision = async (revisionId) => {
    if (!window.confirm('¿Marcar esta revisión como resuelta?')) return
    try {
      await ordenesService.resolverRevision(id, revisionId)
      await cargarOrden()
    } catch (e) {
      console.error(e)
      setError(e.response?.data?.error || 'Error al resolver revisión')
    }
  }

  const descargarPDF = async (conFotos = true) => {
    try {
      const response = await ordenesService.descargarPDF(orden.id, conFotos)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `OT-${orden.numeroOt}${conFotos ? '' : '-sin-fotos'}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Error descargando el PDF')
    }
  }

  const toggleSection = (key) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg }}>
        <Header />
        <Spinner label="Cargando orden…" />
      </div>
    )
  }

  if (!orden) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg }}>
        <Header />
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
          <Card padding={32}>
            <p style={{ color: T.sub, marginBottom: 16 }}>Orden no encontrada</p>
            <Btn label="Volver al Dashboard" onClick={() => navigate('/dashboard')} />
          </Card>
        </main>
      </div>
    )
  }

  // Agrupar por sección
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
  secciones.forEach((s) =>
    s.resultados.sort((a, b) => (a.punto?.orden ?? 0) - (b.punto?.orden ?? 0))
  )

  const totalPuntos = orden.resultados?.length || 0
  const completados = orden.resultados?.filter((r) => r.completado).length || 0
  const progreso = totalPuntos > 0 ? completados / totalPuntos : 0
  const todosCompletos = totalPuntos > 0 && completados === totalPuntos

  const producto = orden.producto
  const tipo = producto?.tipoProducto
  const tipoMeta = TIPO_PRODUCTO[tipo] || { label: 'Producto', icon: '📦', c: T.cyan, bg: T.cD }

  const uid = user?.id
  const esSuper = user?.superusuario === true
  const esGerente = esSuper || user?.rol === 'gerente_soporte'
  const asignado = esSuper || [
    orden.soporte, orden.ingenieroAuxiliar, orden.mecanico, orden.gerente, orden.operador,
  ].some((u) => u?.id === uid)
  const puedeEditar = asignado && orden.estado !== 'cerrada'

  // Personal involucrado (para el selector de responsable de cada punto).
  const involucrados = []
  const vistos = new Set()
  for (const u of [orden.soporte, orden.ingenieroAuxiliar, orden.mecanico, orden.gerente, orden.piloto, orden.operador]) {
    if (u && !vistos.has(u.id)) { vistos.add(u.id); involucrados.push(u) }
  }
  const puedeAsignar = esGerente && orden.estado !== 'cerrada'
  const misTareas = (orden.resultados || []).filter((r) => r.asignado?.id === uid).length

  const tieneRecepcion = Boolean(orden.fechaRecepcion)
  const tieneInicio = Boolean(orden.fechaInicio)
  const inspeccionBloqueada = !tieneInicio
  const soloLectura = !puedeEditar || inspeccionBloqueada

  const st = STATUS[orden.estado] || { label: orden.estado, c: T.sub, bg: T.s2 }
  const historial = orden.historial || []
  // Rechazo reciente: orden en en_proceso cuyo último evento de estado es un rechazo.
  const ultimoEvento = historial[0]
  const fueRechazada = orden.estado === 'en_proceso' && ultimoEvento?.motivo?.startsWith('Rechazo:')

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
        <Hdr
          title={orden.formato?.nombre || 'Orden de Mantenimiento'}
          sub={orden.numeroOt}
          back={() => navigate('/dashboard')}
          right={<Pill label={st.label} color={st.c} bg={st.bg} />}
        />

        {/* Producto card */}
        <Card padding={16} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: tipoMeta.bg, border: `1px solid ${tipoMeta.c}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {tipoMeta.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>
                  {producto?.modelo?.nombre || tipoMeta.label}
                </span>
                <Pill small label={tipoMeta.label} color={tipoMeta.c} bg={tipoMeta.bg} />
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 13, color: tipoMeta.c, marginTop: 2 }}>
                {producto?.identificador}
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`,
          }}>
            <KV k="Soporte"  v={soporteLabel(orden.soporte, orden.ingenieroAuxiliar)} />
            {orden.mecanico && <KV k="Mecánico" v={orden.mecanico.nombre} />}
            {tipo === 'gcs' && <KV k="Operador" v={orden.operador?.nombre || 'Sin asignar'} />}
            <KV k="Gerente"  v={orden.gerente?.nombre || 'Sin asignar'} />
            {tipo === 'aeronave' && <KV k="Piloto" v={orden.piloto?.nombre || 'Sin asignar'} />}
            {orden.cliente && <KV k="Cliente" v={orden.cliente} />}
            {orden.ordenServicio && <KV k="O/S" v={orden.ordenServicio} mono />}
            {orden.lugarMantenimiento && <KV k="Lugar" v={`📍 ${orden.lugarMantenimiento}`} />}
          </div>

          {/* Lecturas del medidor (si ya se capturaron al iniciar) */}
          {tieneInicio && <LecturasMedidor tipo={tipo} orden={orden} />}

          {/* Hitos */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`,
          }}>
            <HitoTemporal n={1} label="Creación" ts={orden.createdAt} />
            <HitoTemporal n={2} label="Recepción" ts={orden.fechaRecepcion} />
            <HitoTemporal n={3} label="Inicio mantenimiento" ts={orden.fechaInicio} />
            <HitoTemporal n={4} label="Finalización" ts={orden.fechaCierre} />
          </div>

          {esGerente && orden.estado !== 'cerrada' && (
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 12, color: T.sub }}>Gestión de asignación:</span>
              <BtnSm
                variant="surface"
                onClick={abrirAsignacion}
                label="Reasignar responsables"
              />
            </div>
          )}
        </Card>

        {/* Banner de rechazo — motivo visible al abrir la orden */}
        {fueRechazada && (
          <div style={{
            background: T.rD, border: `1px solid ${T.red}40`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 14,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: T.red,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            }}>
              ✗ Orden rechazada
              {ultimoEvento?.usuario?.nombre && (
                <span style={{ color: T.sub, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                  por {ultimoEvento.usuario.nombre} · {new Date(ultimoEvento.createdAt).toLocaleString('es-MX')}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: T.text, marginTop: 6, lineHeight: 1.55 }}>
              {ultimoEvento.motivo.replace(/^Rechazo:\s*/, '')}
            </div>
            <div style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>
              Corrige lo señalado y vuelve a enviar la orden a firma.
            </div>
          </div>
        )}

        {/* Paso 1: Recepción */}
        {!tieneRecepcion && puedeEditar && (
          <Card
            padding={18}
            style={{
              marginBottom: 14,
              background: T.aD,
              borderColor: `${T.amber}40`,
              borderLeft: `3px solid ${T.amber}`,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: T.amber, marginBottom: 4 }}>
              Paso 1 · Recepción del {tipoMeta.label.toLowerCase()}
            </div>
            <p style={{ fontSize: 13, color: T.text, marginBottom: 12, lineHeight: 1.5 }}>
              Confirma la recepción ingresando el identificador para validar la identidad.
              <br/>Esperado: <span style={{ fontFamily: T.mono, color: T.amber, fontWeight: 700 }}>
                {producto?.identificador}
              </span>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={identificadorInput}
                onChange={(e) => setIdentificadorInput(e.target.value.toUpperCase())}
                placeholder="Identificador (matrícula / placas / serie)"
                style={{
                  flex: 1, minWidth: 240,
                  background: T.s2, border: `1px solid ${T.amber}40`,
                  borderRadius: 10, padding: '10px 12px',
                  color: T.text, fontFamily: T.mono, fontSize: 14,
                  outline: 'none',
                }}
              />
              <Btn
                variant="amber"
                disabled={recepcionLoading}
                onClick={recepcionar}
                label={recepcionLoading ? 'Validando…' : 'Registrar recepción'}
              />
            </div>
          </Card>
        )}

        {/* Paso 2: Iniciar mantenimiento (pide lecturas según tipo) */}
        {tieneRecepcion && !tieneInicio && puedeEditar && (
          <IniciarPanel
            tipo={tipo}
            producto={producto}
            onIniciar={iniciarMantenimiento}
            onError={setError}
          />
        )}

        {/* Modo solo lectura */}
        {!puedeEditar && orden.estado !== 'cerrada' && (
          <Card padding={14} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.5 }}>
              🔒 <strong style={{ color: T.text }}>Modo solo lectura.</strong> Solo el soporte,
              el ingeniero auxiliar, el mecánico o el gerente asignados pueden capturar datos
              de esta orden.
            </div>
          </Card>
        )}
        {puedeEditar && inspeccionBloqueada && tieneRecepcion && (
          <Card padding={14} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: T.sub }}>
              🔒 Orden congelada: inicia el mantenimiento para habilitar la captura de resultados.
            </div>
          </Card>
        )}

        {/* Modal asignación */}
        <Modal
          open={showAsignacion}
          onClose={() => setShowAsignacion(false)}
          title="Reasignar responsables"
          maxWidth={560}
        >
          <ModalAsignacionContent
            orden={orden}
            usuarios={usuarios}
            onClose={() => setShowAsignacion(false)}
            onGuardar={guardarAsignacion}
          />
        </Modal>

        {/* Modal de pedir revisión de un punto */}
        <Modal
          open={Boolean(revisionPara)}
          onClose={() => setRevisionPara(null)}
          title="Pedir revisión del punto"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.55 }}>
              El punto quedará marcado <strong style={{ color: T.amber }}>en revisión</strong> y
              <strong style={{ color: T.text }}> bloqueará el cierre</strong> de la orden hasta que
              alguien lo resuelva.
            </p>
            <div>
              <div style={{
                fontSize: 11, color: T.sub, fontWeight: 600,
                letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6,
              }}>
                Motivo de la revisión <span style={{ color: T.red }}>*</span>
              </div>
              <textarea
                value={comentarioRevision}
                onChange={(e) => setComentarioRevision(e.target.value)}
                placeholder="Ej. Verificar el torque del tornillo y volver a fotografiar…"
                rows={3}
                autoFocus
                style={{
                  width: '100%', minHeight: 80,
                  background: T.s2, border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: '10px 12px',
                  color: T.text, fontSize: 14, fontFamily: T.font,
                  resize: 'vertical', outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" label="Cancelar" onClick={() => setRevisionPara(null)} style={{ flex: 1 }} />
              <Btn
                variant="amber"
                label={revisionLoading ? 'Enviando…' : 'Pedir revisión'}
                onClick={confirmarPedirRevision}
                disabled={revisionLoading || !comentarioRevision.trim()}
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </Modal>

        {/* Progreso global sticky */}
        <div style={{
          position: 'sticky', top: 70, zIndex: 20,
          background: T.s1, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: '12px 14px',
          marginBottom: 14, boxShadow: T.shadow,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 8,
          }}>
            <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>
              Progreso general
            </span>
            <span style={{ fontSize: 13, color: T.text, fontFamily: T.mono, fontWeight: 600 }}>
              {completados} / {totalPuntos} · {Math.round(progreso * 100)}%
            </span>
          </div>
          <ProgressBar value={progreso} color={progreso === 1 ? T.green : T.cyan} height={4} />
          {misTareas > 0 && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: T.amber, fontWeight: 600 }}>
                🛠 Tienes {misTareas} tarea{misTareas === 1 ? '' : 's'} asignada{misTareas === 1 ? '' : 's'}
              </span>
              <BtnSm
                variant={soloMisTareas ? 'primary' : 'ghost'}
                onClick={() => setSoloMisTareas((v) => !v)}
                label={soloMisTareas ? 'Ver todos los puntos' : 'Ver solo mis tareas'}
              />
            </div>
          )}
        </div>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {/* Secciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {secciones.map((sec, idx) => {
            const visibles = soloMisTareas
              ? sec.resultados.filter((r) => r.asignado?.id === uid)
              : sec.resultados
            if (visibles.length === 0) return null
            const isCollapsed = collapsed[sec.id] === true
            const secTotal = sec.resultados.length
            const secHechos = sec.resultados.filter((r) => r.completado).length
            const completo = secTotal > 0 && secHechos === secTotal
            return (
              <section key={sec.id} style={{
                background: T.s1, border: `1px solid ${T.border}`,
                borderRadius: 14, overflow: 'hidden',
              }}>
                <button
                  onClick={() => toggleSection(sec.id)}
                  style={{
                    width: '100%', padding: '14px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                    background: T.s2, border: 'none',
                    borderBottom: !isCollapsed ? `1px solid ${T.border}` : 'none',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: T.font,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>
                      {idx + 1}. {sec.nombre}
                    </div>
                    {sec.descripcion && (
                      <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                        {sec.descripcion}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Pill
                      small
                      label={`${secHechos}/${secTotal}`}
                      color={completo ? T.green : T.sub}
                      bg={completo ? T.gD : T.s1}
                    />
                    <span style={{ color: T.sub, fontSize: 12, fontFamily: T.mono }}>
                      {isCollapsed ? '▶' : '▼'}
                    </span>
                  </div>
                </button>

                {!isCollapsed && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%', borderCollapse: 'collapse',
                      fontSize: 13, color: T.text,
                    }}>
                      <thead>
                        <tr style={{ background: T.bg, color: T.sub }}>
                          <Th width={36}>#</Th>
                          <Th minWidth={170}>Componente</Th>
                          <Th minWidth={220}>Descripción de trabajo</Th>
                          <Th minWidth={240}>Condición</Th>
                          <Th minWidth={130}>Firma</Th>
                          <Th minWidth={200}>Registro fotográfico</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibles.map((r, i) => (
                          <FilaPunto
                            key={r.id}
                            index={i + 1}
                            resultado={r}
                            soloLectura={soloLectura}
                            onCambiar={actualizarResultado}
                            onFirmar={firmarPunto}
                            onSubirFoto={subirFoto}
                            onEliminarFoto={eliminarFoto}
                            puedeRevisar={puedeEditar && !inspeccionBloqueada}
                            onPedirRevision={pedirRevision}
                            onResolverRevision={resolverRevision}
                            puedeAsignar={puedeAsignar}
                            involucrados={involucrados}
                            currentUserId={uid}
                            onAsignar={asignarPunto}
                            onFirmarTarea={firmarTarea}
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

        {/* Historial de estados */}
        {historial.length > 0 && (
          <section style={{
            marginTop: 14,
            background: T.s1, border: `1px solid ${T.border}`,
            borderRadius: 14, overflow: 'hidden',
          }}>
            <button
              onClick={() => setShowHistorial((v) => !v)}
              style={{
                width: '100%', padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                background: T.s2, border: 'none',
                borderBottom: showHistorial ? `1px solid ${T.border}` : 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: T.font,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                🕓 Historial de estados ({historial.length})
              </div>
              <span style={{ color: T.sub, fontSize: 12, fontFamily: T.mono }}>
                {showHistorial ? '▼' : '▶'}
              </span>
            </button>
            {showHistorial && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {historial.map((h) => (
                  <HistorialRow key={h.id} h={h} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Acciones */}
        <div style={{
          marginTop: 28, display: 'flex', gap: 10,
          justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <Btn variant="ghost" label="Volver" onClick={() => navigate('/dashboard')} />
          {orden.estado === 'cerrada' && (
            <>
              <Btn variant="primary" label="📥 Descargar PDF" onClick={() => descargarPDF(true)} />
              <Btn variant="ghost" label="Descargar sin fotos" onClick={() => descargarPDF(false)} />
            </>
          )}
          {orden.estado === 'pendiente_firma' && (
            <Btn
              variant="primary"
              label="Ir a firmar →"
              onClick={() => navigate(`/ordenes/${id}/cierre`)}
            />
          )}
          {(orden.estado === 'borrador' || orden.estado === 'en_proceso') && (
            <Btn
              variant={todosCompletos ? 'primary' : 'ghost'}
              label="Ir a Cierre y Firma →"
              onClick={() => navigate(`/ordenes/${id}/cierre`)}
              disabled={!todosCompletos}
              title={todosCompletos ? '' : 'Completar todos los puntos antes de cerrar'}
            />
          )}
        </div>
      </main>
    </div>
  )
}

// Etiqueta combinada de soporte (+ auxiliar si existe).
function soporteLabel(soporte, auxiliar) {
  if (!soporte) return 'Sin asignar'
  return auxiliar ? `${soporte.nombre} (+ ${auxiliar.nombre})` : soporte.nombre
}

// ── Lecturas del medidor según el tipo ───────────────────────
function LecturasMedidor({ tipo, orden }) {
  let chips = []
  if (tipo === 'aeronave') {
    chips = [
      { label: 'Horas totales', v: orden.horasTotales, unidad: 'h' },
      { label: 'Motor derecho', v: orden.horasMotorDer, unidad: 'h' },
      { label: 'Motor izquierdo', v: orden.horasMotorIzq, unidad: 'h' },
    ]
  } else if (tipo === 'gcs') {
    chips = [{ label: 'Odómetro', v: orden.odometro, unidad: 'km' }]
  } else if (tipo === 'planta') {
    chips = [{ label: 'Horímetro', v: orden.horimetro, unidad: 'h' }]
  } else {
    return null // sensor_inteligencia: sin medidor
  }
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${Math.min(chips.length, 3)}, 1fr)`,
      gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`,
    }}>
      {chips.map((c) => <MedidorChip key={c.label} label={c.label} v={c.v} unidad={c.unidad} />)}
    </div>
  )
}

function MedidorChip({ label, v, unidad }) {
  return (
    <div style={{
      background: T.cD, border: `1px solid ${T.cyan}25`,
      borderRadius: 12, padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 9, color: T.cyan, fontWeight: 600,
        letterSpacing: '0.07em', textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontSize: 18, color: T.cyan, fontWeight: 700,
        fontFamily: T.mono, marginTop: 2,
      }}>{v ?? 0} {unidad}</div>
    </div>
  )
}

// ── Panel de inicio de mantenimiento con lecturas por tipo ────
function IniciarPanel({ tipo, producto, onIniciar, onError }) {
  // Prefill con la lectura actual del producto.
  const det = producto?.[tipo]
  const [horasTotales, setHorasTotales] = useState(det?.horasTotales ?? '')
  const [horasMotorDer, setHorasMotorDer] = useState(det?.horasMotorDer ?? '')
  const [horasMotorIzq, setHorasMotorIzq] = useState(det?.horasMotorIzq ?? '')
  const [odometro, setOdometro] = useState(det?.odometro ?? '')
  const [horimetro, setHorimetro] = useState(det?.horimetro ?? '')
  const [loading, setLoading] = useState(false)

  const iniciar = async () => {
    const lecturas = {}
    if (tipo === 'aeronave') {
      if (horasTotales === '' || horasTotales === null) {
        onError('Las horas totales son obligatorias para iniciar el mantenimiento de una aeronave')
        return
      }
      lecturas.horasTotales = Number(horasTotales)
      if (horasMotorDer !== '') lecturas.horasMotorDer = Number(horasMotorDer)
      if (horasMotorIzq !== '') lecturas.horasMotorIzq = Number(horasMotorIzq)
    } else if (tipo === 'gcs') {
      if (odometro === '') { onError('El odómetro es obligatorio para iniciar el mantenimiento'); return }
      lecturas.odometro = Number(odometro)
    } else if (tipo === 'planta') {
      if (horimetro === '') { onError('El horímetro es obligatorio para iniciar el mantenimiento'); return }
      lecturas.horimetro = Number(horimetro)
    }
    setLoading(true)
    try {
      await onIniciar(lecturas)
    } catch (e) {
      onError(e.response?.data?.error || 'Error iniciando el mantenimiento')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: T.s2, border: `1px solid ${T.cyan}40`,
    borderRadius: 10, padding: '10px 12px',
    color: T.text, fontFamily: T.mono, fontSize: 14, outline: 'none',
  }
  const labelStyle = {
    fontSize: 10, color: T.cyan, fontWeight: 600,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    display: 'block', marginBottom: 5,
  }

  return (
    <Card
      padding={18}
      style={{
        marginBottom: 14,
        background: T.cD,
        borderColor: `${T.cyan}40`,
        borderLeft: `3px solid ${T.cyan}`,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: T.cyan, marginBottom: 4 }}>
        Paso 2 · Iniciar mantenimiento
      </div>
      <p style={{ fontSize: 13, color: T.text, marginBottom: 14, lineHeight: 1.5 }}>
        La orden está <strong>congelada</strong> hasta iniciar los trabajos. Registra la lectura
        del medidor al momento de iniciar; con esto se habilita la captura de resultados.
      </p>

      {tipo === 'aeronave' && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12, marginBottom: 14,
        }}>
          <div>
            <label style={labelStyle}>Horas totales *</label>
            <input type="number" step="0.1" min="0" value={horasTotales}
              onChange={(e) => setHorasTotales(e.target.value)} placeholder="0.0" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Horas motor der.</label>
            <input type="number" step="0.1" min="0" value={horasMotorDer}
              onChange={(e) => setHorasMotorDer(e.target.value)} placeholder="0.0" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Horas motor izq.</label>
            <input type="number" step="0.1" min="0" value={horasMotorIzq}
              onChange={(e) => setHorasMotorIzq(e.target.value)} placeholder="0.0" style={inputStyle} />
          </div>
        </div>
      )}
      {tipo === 'gcs' && (
        <div style={{ maxWidth: 240, marginBottom: 14 }}>
          <label style={labelStyle}>Odómetro (km) *</label>
          <input type="number" step="1" min="0" value={odometro}
            onChange={(e) => setOdometro(e.target.value)} placeholder="0" style={inputStyle} />
        </div>
      )}
      {tipo === 'planta' && (
        <div style={{ maxWidth: 240, marginBottom: 14 }}>
          <label style={labelStyle}>Horímetro (h) *</label>
          <input type="number" step="0.1" min="0" value={horimetro}
            onChange={(e) => setHorimetro(e.target.value)} placeholder="0.0" style={inputStyle} />
        </div>
      )}
      {tipo === 'sensor_inteligencia' && (
        <p style={{ fontSize: 12, color: T.sub, marginBottom: 14 }}>
          Los sensores de inteligencia no llevan medidor — solo confirma el inicio del mantenimiento.
        </p>
      )}

      <Btn
        disabled={loading}
        onClick={iniciar}
        label={loading ? 'Iniciando…' : '▶ Iniciar mantenimiento'}
      />
    </Card>
  )
}

// ── Hito temporal ─────────────────────────────────────────────
function HitoTemporal({ n, label, ts }) {
  const completado = Boolean(ts)
  const c = completado ? T.green : T.sub
  return (
    <div style={{
      background: completado ? T.gD : T.s2,
      border: `1px solid ${completado ? `${T.green}30` : T.border}`,
      borderRadius: 10, padding: '8px 10px',
    }}>
      <div style={{
        fontSize: 9, color: c, fontWeight: 600,
        letterSpacing: '0.07em', textTransform: 'uppercase',
      }}>{n}. {label}</div>
      <div style={{
        fontSize: 11, marginTop: 4,
        color: completado ? T.text : T.dim,
        fontFamily: T.mono, fontWeight: completado ? 600 : 400,
      }}>
        {completado
          ? new Date(ts).toLocaleString('es-MX', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : 'Pendiente'}
      </div>
    </div>
  )
}

// ── Fila del historial de estados ────────────────────────────
function HistorialRow({ h }) {
  const stA = STATUS[h.estadoAnterior] || { label: h.estadoAnterior, c: T.sub, bg: T.s2 }
  const stN = STATUS[h.estadoNuevo] || { label: h.estadoNuevo, c: T.sub, bg: T.s2 }
  return (
    <div style={{
      background: T.s2, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: '10px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pill small label={stA.label} color={stA.c} bg={stA.bg} />
        <span style={{ color: T.sub, fontFamily: T.mono }}>→</span>
        <Pill small label={stN.label} color={stN.c} bg={stN.bg} />
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.sub, fontFamily: T.mono }}>
          {new Date(h.createdAt).toLocaleString('es-MX', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>
      <div style={{ fontSize: 12, color: T.text, marginTop: 6 }}>
        {h.usuario?.nombre || 'Usuario'}
        <span style={{ color: T.sub }}> · {ROL_LABELS[h.usuario?.rol] || h.usuario?.rol}</span>
      </div>
      {h.motivo && (
        <div style={{ fontSize: 12, color: T.sub, marginTop: 4, fontStyle: 'italic' }}>
          “{h.motivo}”
        </div>
      )}
    </div>
  )
}

// ── Hora chip ────────────────────────────────────────────────

// ── Th ──────────────────────────────────────────────────────────
function Th({ children, width, minWidth }) {
  return (
    <th style={{
      padding: '10px 12px',
      fontSize: 10, color: T.sub, fontWeight: 600,
      letterSpacing: '0.07em', textTransform: 'uppercase',
      textAlign: 'left',
      borderBottom: `1px solid ${T.border}`,
      width, minWidth,
    }}>{children}</th>
  )
}

// ── Modal asignación ─────────────────────────────────────────
function ModalAsignacionContent({ orden, usuarios, onClose, onGuardar }) {
  const tipo = orden.producto?.tipoProducto
  const esAeronave = tipo === 'aeronave'
  const req = REQUISITOS_PERSONAL[tipo] || REQUISITOS_PERSONAL.aeronave
  const muestraMecanico = req.mecanico !== 'prohibido'
  const mecanicoObligatorio = req.mecanico === 'obligatorio'
  const muestraOperador = req.operador !== 'prohibido'

  const [soporteId, setSoporteId] = useState(orden.soporte?.id || '')
  const [ingenieroAuxiliarId, setIngenieroAuxiliarId] = useState(orden.ingenieroAuxiliar?.id || '')
  const [mecanicoId, setMecanicoId] = useState(orden.mecanico?.id || '')
  const [gerenteId, setGerenteId] = useState(orden.gerente?.id || '')
  const [pilotoId, setPilotoId] = useState(orden.piloto?.id || '')
  const [operadorId, setOperadorId] = useState(orden.operador?.id || '')
  const [saving, setSaving] = useState(false)

  const soportes  = usuarios.filter((u) => ROLES_SOPORTE.includes(u.rol))
  const ingenieros = usuarios.filter((u) => u.rol === 'ingeniero_soporte')
  const mecanicos  = usuarios.filter((u) => u.rol === 'mecanico')
  const gerentes   = usuarios.filter((u) => u.rol === 'gerente_soporte')
  const pilotos    = usuarios.filter((u) => u.rol === 'piloto')
  const operadores = usuarios.filter((u) => u.rol === 'operador')

  const soporteEsTecnico = soportes.find((u) => u.id === soporteId)?.rol === 'tecnico_soporte'

  const opcion = (u) => ({
    value: u.id,
    label: `${u.nombre} · ${ROL_LABELS[u.rol] || u.rol}${u.licenciaNum ? ` · ${u.licenciaNum}` : ''}`,
  })

  const guardar = async () => {
    setSaving(true)
    try {
      await onGuardar({
        soporteId,
        ingenieroAuxiliarId: soporteEsTecnico ? (ingenieroAuxiliarId || null) : null,
        mecanicoId: muestraMecanico ? (mecanicoId || null) : null,
        gerenteId,
        ...(esAeronave ? { pilotoId } : {}),
        ...(muestraOperador ? { operadorId } : {}),
      })
    } finally {
      setSaving(false)
    }
  }

  const completo = soporteId && gerenteId
    && (!mecanicoObligatorio || mecanicoId)
    && (!esAeronave || pilotoId)
    && (!muestraOperador || operadorId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FieldSelect
        label="Soporte (técnico o ingeniero)"
        required value={soporteId} onChange={setSoporteId}
        placeholder="-- Selecciona --"
        options={soportes.map(opcion)}
      />
      {soporteEsTecnico && (
        <FieldSelect
          label="Ingeniero auxiliar (opcional)"
          value={ingenieroAuxiliarId} onChange={setIngenieroAuxiliarId}
          placeholder="-- Sin ingeniero auxiliar --"
          options={ingenieros.map(opcion)}
        />
      )}
      {muestraMecanico && (
        <FieldSelect
          label={mecanicoObligatorio ? 'Mecánico' : 'Mecánico (opcional)'}
          required={mecanicoObligatorio} value={mecanicoId} onChange={setMecanicoId}
          placeholder={mecanicoObligatorio ? '-- Selecciona --' : '-- Sin mecánico --'}
          options={mecanicos.map(opcion)}
        />
      )}
      {muestraOperador && (
        <FieldSelect
          label="Operador"
          required value={operadorId} onChange={setOperadorId}
          placeholder="-- Selecciona --"
          options={operadores.map(opcion)}
        />
      )}
      <FieldSelect
        label="Gerente de soporte"
        required value={gerenteId} onChange={setGerenteId}
        placeholder="-- Selecciona --"
        options={gerentes.map(opcion)}
      />
      {esAeronave && (
        <FieldSelect
          label="Piloto"
          required value={pilotoId} onChange={setPilotoId}
          placeholder="-- Selecciona --"
          options={pilotos.map(opcion)}
        />
      )}
      <p style={{ fontSize: 11, color: T.sub, lineHeight: 1.5 }}>
        El soporte, ingeniero auxiliar, mecánico, operador y gerente asignados tienen permisos de edición.
        El piloto (aeronave) y el operador (GCS) firman el cierre.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <Btn variant="ghost" label="Cancelar" onClick={onClose} style={{ flex: 1 }} />
        <Btn
          label={saving ? 'Guardando…' : 'Guardar'}
          onClick={guardar}
          disabled={saving || !completo}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  )
}

// ── Bloque de responsable + firma de tarea por punto ─────────
function TareaBloque({ resultado, puedeAsignar, involucrados, currentUserId, soloLectura, onAsignar, onFirmarTarea }) {
  const asignado = resultado.asignado
  const tareaFirmada = Boolean(resultado.firmaTareaPorId)
  const soyAsignado = asignado?.id && asignado.id === currentUserId
  const puedoFirmar = soyAsignado && resultado.completado && !tareaFirmada && !soloLectura

  // Sin nada que mostrar: ni puede asignar, ni hay responsable.
  if (!puedeAsignar && !asignado) return null

  return (
    <div style={{
      marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.border}`,
    }}>
      <div style={{
        fontSize: 9, color: T.sub, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4,
      }}>
        Responsable de la tarea
      </div>

      {puedeAsignar ? (
        <select
          value={asignado?.id || ''}
          onChange={(e) => onAsignar(resultado.id, e.target.value || null)}
          style={{
            width: '100%', background: T.s2, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: '6px 8px', color: T.text,
            fontSize: 12, fontFamily: T.font, outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">— Sin responsable —</option>
          {involucrados.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} · {ROL_LABELS[u.rol] || u.rol}
            </option>
          ))}
        </select>
      ) : (
        <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>
          {asignado.nombre}
          <span style={{ color: T.sub, fontWeight: 400 }}> · {ROL_LABELS[asignado.rol] || asignado.rol}</span>
        </div>
      )}

      {/* Estado de la firma de tarea */}
      {asignado && (
        tareaFirmada ? (
          <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="11" height="9" viewBox="0 0 12 10"><path d="M1 5l4 4 7-8" stroke={T.green} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Tarea firmada
            {resultado.firmaTareaPor?.nombre && <span style={{ color: T.text, fontWeight: 400 }}>· {resultado.firmaTareaPor.nombre}</span>}
          </div>
        ) : puedoFirmar ? (
          <BtnSm
            variant="primary"
            onClick={() => onFirmarTarea(resultado.id)}
            label="✍ Firmar mi tarea"
            style={{ marginTop: 6 }}
          />
        ) : (
          <div style={{ fontSize: 11, color: T.sub, marginTop: 6, fontStyle: 'italic' }}>
            {resultado.completado
              ? `Pendiente de firma de ${asignado.nombre}`
              : 'Completa el punto para habilitar la firma de tarea'}
          </div>
        )
      )}
    </div>
  )
}

// ── Fila de la tabla ─────────────────────────────────────────
function FilaPunto({ index, resultado, soloLectura, onCambiar, onFirmar, onSubirFoto, onEliminarFoto, puedeRevisar, onPedirRevision, onResolverRevision, puedeAsignar, involucrados, currentUserId, onAsignar, onFirmarTarea }) {
  const punto = resultado.punto
  const [obs, setObs] = useState(resultado.observacion || '')
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [modoCaptura, setModoCaptura] = useState(null)

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

  const estadoMeta = PUNTO_STATUS[resultado.estadoResultado] || null

  return (
    <tr style={{
      borderBottom: `1px solid ${T.border}`,
      background: filaCompleta ? `${T.green}08` : 'transparent',
    }}>
      {/* # */}
      <td style={tdStyle}>
        <span style={{ color: T.sub, fontFamily: T.mono }}>{index}</span>
      </td>

      {/* Componente */}
      <td style={tdStyle}>
        <div style={{ fontWeight: 600, color: T.text }}>{punto?.nombreComponente}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
          {punto?.esCritico && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: T.red,
              background: T.rD, padding: '2px 7px', borderRadius: 4,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>Crítico</span>
          )}
          {punto?.fotoRequerida && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: T.cyan,
              background: T.cD, padding: '2px 7px', borderRadius: 4,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>Foto obligatoria</span>
          )}
        </div>

        {/* Revisiones abiertas */}
        {(resultado.revisiones || []).filter((rev) => rev.estado === 'abierta').map((rev) => (
          <div key={rev.id} style={{
            marginTop: 6,
            background: T.aD,
            border: `1px solid ${T.amber}40`,
            borderLeft: `3px solid ${T.amber}`,
            borderRadius: 8, padding: '6px 8px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              🔍 En revisión
            </div>
            <div style={{ fontSize: 11, color: T.text, marginTop: 2, lineHeight: 1.4 }}>
              {rev.comentario}
            </div>
            <div style={{ fontSize: 10, color: T.sub, marginTop: 2 }}>
              — {rev.solicitante?.nombre}
            </div>
            {puedeRevisar && (
              <button
                type="button"
                onClick={() => onResolverRevision(rev.id)}
                style={{
                  marginTop: 5,
                  fontSize: 10, fontWeight: 600,
                  color: T.green, background: T.gD,
                  border: `1px solid ${T.green}40`,
                  borderRadius: 5, padding: '2px 8px',
                  cursor: 'pointer', fontFamily: T.font,
                }}
              >
                Resolver
              </button>
            )}
          </div>
        ))}

        {/* Enlace discreto para pedir revisión (solo si no hay revisiones abiertas y puede revisar) */}
        {puedeRevisar && !(resultado.revisiones || []).some((rev) => rev.estado === 'abierta') && (
          <button
            type="button"
            onClick={() => onPedirRevision(resultado.id)}
            style={{
              marginTop: 6,
              fontSize: 10, color: T.sub,
              background: 'none', border: 'none',
              padding: 0, cursor: 'pointer',
              textDecoration: 'underline', fontFamily: T.font,
            }}
          >
            Pedir revisión
          </button>
        )}

        <label style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 8, fontSize: 12, color: T.sub, cursor: soloLectura ? 'not-allowed' : 'pointer',
        }}>
          <input
            type="checkbox"
            checked={resultado.completado || false}
            onChange={toggleCompletado}
            disabled={soloLectura}
            style={{ width: 14, height: 14, cursor: soloLectura ? 'not-allowed' : 'pointer' }}
          />
          Completado
        </label>

        {/* Responsable / firma de tarea */}
        <TareaBloque
          resultado={resultado}
          puedeAsignar={puedeAsignar}
          involucrados={involucrados}
          currentUserId={currentUserId}
          soloLectura={soloLectura}
          onAsignar={onAsignar}
          onFirmarTarea={onFirmarTarea}
        />
      </td>

      {/* Descripción */}
      <td style={tdStyle}>
        <span style={{ color: T.text, lineHeight: 1.5 }}>
          {punto?.descripcion || <span style={{ color: T.dim, fontStyle: 'italic' }}>—</span>}
        </span>
      </td>

      {/* Condición */}
      <td style={tdStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select
            value={resultado.estadoResultado || 'bueno'}
            onChange={(e) => cambiarEstado(e.target.value)}
            disabled={soloLectura}
            style={{
              background: T.s2,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '8px 10px',
              color: T.text,
              fontSize: 12,
              fontFamily: T.font,
              outline: 'none',
              width: '100%',
              cursor: soloLectura ? 'not-allowed' : 'pointer',
              opacity: soloLectura ? 0.6 : 1,
            }}
          >
            {ESTADOS_OPCIONES.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
          {estadoMeta && (
            <Pill small label={estadoMeta.label} color={estadoMeta.c} bg={estadoMeta.bg} />
          )}
          {requiereObs && (
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              onBlur={guardarObs}
              disabled={soloLectura}
              placeholder="Observación obligatoria…"
              rows={2}
              style={{
                width: '100%',
                background: T.s2,
                border: `1px solid ${(!obs || !obs.trim()) ? `${T.red}70` : T.border}`,
                borderRadius: 8,
                padding: '7px 10px',
                color: T.text, fontSize: 12,
                fontFamily: T.font,
                resize: 'vertical', outline: 'none',
                opacity: soloLectura ? 0.6 : 1,
              }}
            />
          )}
        </div>
      </td>

      {/* Firma */}
      <td style={tdStyle}>
        {!punto?.esCritico ? (
          <span style={{ color: T.dim, fontSize: 12, fontStyle: 'italic' }}>No requiere</span>
        ) : resultado.firmadoPor ? (
          <div style={{ fontSize: 12 }}>
            <div style={{ color: T.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="9" viewBox="0 0 12 10"><path d="M1 5l4 4 7-8" stroke={T.green} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Firmado
            </div>
            <div style={{ color: T.text, marginTop: 2 }}>{resultado.firmante?.nombre}</div>
            {resultado.fechaFirma && (
              <div style={{ color: T.sub, fontFamily: T.mono, fontSize: 11 }}>
                {new Date(resultado.fechaFirma).toLocaleDateString('es-MX')}
              </div>
            )}
          </div>
        ) : (
          <BtnSm
            variant={puedeFirmarse ? 'primary' : 'ghost'}
            disabled={soloLectura || !puedeFirmarse}
            onClick={() => onFirmar(resultado.id)}
            label="Firmar"
            title={puedeFirmarse ? 'Firmar este punto crítico' : 'Completa el punto antes de firmar'}
          />
        )}
      </td>

      {/* Fotos */}
      <td style={tdStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {(resultado.fotos || []).map((f) => (
            <div key={f.id} style={{ position: 'relative' }}>
              <a href={f.urlArchivo} target="_blank" rel="noreferrer">
                <img
                  src={f.urlArchivo}
                  alt={f.nombreArchivo}
                  style={{
                    width: 56, height: 56, objectFit: 'cover',
                    borderRadius: 8, border: `1px solid ${T.cyan}40`,
                  }}
                />
              </a>
              {!soloLectura && (
                <button
                  type="button"
                  onClick={() => onEliminarFoto(resultado.id, f.id)}
                  style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 16, height: 16, borderRadius: '50%',
                    background: T.red, color: T.bg,
                    border: 'none', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', lineHeight: 1,
                  }}
                  title="Eliminar"
                >×</button>
              )}
            </div>
          ))}
          {(resultado.fotos || []).length === 0 && (
            <span style={{ fontSize: 12, color: T.dim, fontStyle: 'italic' }}>Sin fotos</span>
          )}
        </div>

        {!soloLectura && modoCaptura === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <BtnSm variant="surface" onClick={iniciarCapturaCamara} label="📷 Capturar" />
            <BtnSm variant="ghost" onClick={() => fileInputRef.current?.click()} label="📁 Cargar archivo" />
          </div>
        )}

        {modoCaptura === 'camara' && (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(9,11,18,0.92)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, zIndex: 100,
          }}>
            <div style={{
              background: T.s1, borderRadius: 16,
              border: `1px solid ${T.border}`, overflow: 'hidden',
              width: '100%', maxWidth: 480,
            }}>
              <div style={{ background: T.bg }}>
                <video
                  ref={videoRef}
                  style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                  playsInline
                />
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div style={{ display: 'flex', gap: 10, padding: 14 }}>
                <Btn variant="ghost" label="Cancelar" onClick={cerrarCaptura} style={{ flex: 1 }} />
                <Btn label="📷 Capturar" onClick={capturarFoto} style={{ flex: 1 }} />
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
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

const tdStyle = {
  padding: '12px 12px',
  verticalAlign: 'top',
  fontSize: 13,
  color: T.text,
}
