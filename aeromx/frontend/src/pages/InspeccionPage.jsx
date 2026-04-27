import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { ordenesService } from '../api/ordenesService'
import { usuariosService } from '../api/usuariosService'
import { useAuthStore } from '../store/authStore'
import { T, STATUS, PUNTO_STATUS } from '../tokens/design'
import {
  Btn, BtnSm, Card, DroneMark, ErrorBanner, Field, FieldSelect, Hdr,
  KV, Modal, Pill, ProgressBar, Spinner,
} from '../components/ui'

const ESTADOS_OPCIONES = [
  { value: 'bueno',              label: 'Bueno' },
  { value: 'correcto_con_danos', label: 'Con daños' },
  { value: 'requiere_atencion',  label: 'Requiere atención' },
  { value: 'no_aplica',          label: 'No aplica' },
]

const REQUIERE_OBSERVACION = ['correcto_con_danos', 'requiere_atencion']

export default function InspeccionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [orden, setOrden] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const [matriculaInput, setMatriculaInput] = useState('')
  const [recepcionLoading, setRecepcionLoading] = useState(false)
  const [iniciarLoading, setIniciarLoading] = useState(false)
  const [showAsignacion, setShowAsignacion] = useState(false)
  const [tecnicos, setTecnicos] = useState([])
  const [supervisores, setSupervisores] = useState([])

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
      const [tecsRes, supsRes] = await Promise.all([
        usuariosService.listar({ activo: true }),
        usuariosService.listar({ rol: 'supervisor', activo: true }),
      ])
      setTecnicos((tecsRes.data || []).filter(u => u.rol === 'tecnico' || u.rol === 'ingeniero'))
      setSupervisores(supsRes.data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const abrirAsignacion = () => {
    setShowAsignacion(true)
    if (tecnicos.length === 0) cargarUsuariosParaAsignacion()
  }

  const guardarAsignacion = async (tecnicoId, supervisorId) => {
    try {
      await ordenesService.asignar(id, { tecnicoId, supervisorId })
      setShowAsignacion(false)
      await cargarOrden()
    } catch (e) {
      console.error(e)
      setError(e.response?.data?.error || 'Error asignando la orden')
    }
  }

  const recepcionarAeronave = async () => {
    if (!matriculaInput.trim()) {
      setError('Ingresa la matrícula para validar la recepción')
      return
    }
    setRecepcionLoading(true)
    try {
      await ordenesService.recepcionarAeronave(id, matriculaInput.trim())
      setMatriculaInput('')
      setError('')
      await cargarOrden()
    } catch (e) {
      setError(e.response?.data?.error || 'Error registrando la recepción')
    } finally {
      setRecepcionLoading(false)
    }
  }

  const iniciarMantenimiento = async () => {
    if (!confirm('¿Iniciar el mantenimiento? El timestamp se registrará ahora y se podrán capturar resultados.')) return
    setIniciarLoading(true)
    try {
      await ordenesService.iniciarMantenimiento(id)
      setError('')
      await cargarOrden()
    } catch (e) {
      setError(e.response?.data?.error || 'Error iniciando el mantenimiento')
    } finally {
      setIniciarLoading(false)
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

  const esTecnicoAsignado = user && orden.tecnico?.id === user.id
  const esSupervisorAsignado = user && user.rol === 'supervisor' && orden.supervisor?.id === user.id
  const puedeEditar = (esTecnicoAsignado || esSupervisorAsignado) && orden.estado !== 'cerrada'

  const tieneRecepcion = Boolean(orden.fechaRecepcion)
  const tieneInicio = Boolean(orden.fechaInicio)
  const inspeccionBloqueada = !tieneInicio
  const soloLectura = !puedeEditar || inspeccionBloqueada

  const st = STATUS[orden.estado] || { label: orden.estado, c: T.sub, bg: T.s2 }

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

        {/* Drone card */}
        <Card padding={16} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: T.cD, border: `1px solid ${T.cyan}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <DroneMark size={26} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>
                {orden.aeronave?.modelo?.nombre || 'Aeronave'}
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 13, color: T.cyan, marginTop: 2 }}>
                {orden.aeronave?.matricula}
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`,
          }}>
            <KV k="Técnico"     v={orden.tecnico?.nombre} />
            <KV k="Supervisor"  v={orden.supervisor?.nombre || 'Sin asignar'} />
            {orden.cliente && <KV k="Cliente" v={orden.cliente} />}
            {orden.ordenServicio && <KV k="O/S" v={orden.ordenServicio} mono />}
            {orden.lugarMantenimiento && <KV k="Lugar" v={`📍 ${orden.lugarMantenimiento}`} />}
            <KV
              k="Creación"
              v={orden.createdAt ? new Date(orden.createdAt).toLocaleDateString('es-MX') : '—'}
              mono
            />
            {orden.fechaCierre && (
              <KV
                k="Cierre"
                v={new Date(orden.fechaCierre).toLocaleDateString('es-MX')}
                mono
                vColor={T.green}
              />
            )}
          </div>

          {/* Horas */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`,
          }}>
            <HoraChip label="Horas totales"   v={orden.horasAlMomento ?? 0} />
            <HoraChip label="Motor derecho"   v={orden.horasMotorDer ?? 0} />
            <HoraChip label="Motor izquierdo" v={orden.horasMotorIzq ?? 0} />
          </div>

          {/* Hitos */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`,
          }}>
            <HitoTemporal n={1} label="Creación" ts={orden.createdAt} />
            <HitoTemporal n={2} label="Recepción aeronave" ts={orden.fechaRecepcion} />
            <HitoTemporal n={3} label="Inicio mantenimiento" ts={orden.fechaInicio} />
            <HitoTemporal n={4} label="Finalización" ts={orden.fechaCierre} />
          </div>

          {user?.rol === 'supervisor' && orden.estado !== 'cerrada' && (
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 12, color: T.sub }}>Gestión de asignación:</span>
              <BtnSm
                variant="surface"
                onClick={abrirAsignacion}
                label="Reasignar técnico / supervisor"
              />
            </div>
          )}
        </Card>

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
              Paso 1 · Recepción de la aeronave
            </div>
            <p style={{ fontSize: 13, color: T.text, marginBottom: 12, lineHeight: 1.5 }}>
              Confirma la recepción de la aeronave ingresando su matrícula para validar la identidad.
              <br/>Esperada: <span style={{ fontFamily: T.mono, color: T.amber, fontWeight: 700 }}>
                {orden.aeronave?.matricula}
              </span>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={matriculaInput}
                onChange={(e) => setMatriculaInput(e.target.value.toUpperCase())}
                placeholder="Matrícula de la aeronave"
                style={{
                  flex: 1, minWidth: 200,
                  background: T.s2, border: `1px solid ${T.amber}40`,
                  borderRadius: 10, padding: '10px 12px',
                  color: T.text, fontFamily: T.mono, fontSize: 14,
                  outline: 'none',
                }}
              />
              <Btn
                variant="amber"
                disabled={recepcionLoading}
                onClick={recepcionarAeronave}
                label={recepcionLoading ? 'Validando…' : 'Registrar recepción'}
              />
            </div>
          </Card>
        )}

        {/* Paso 2: Iniciar mantenimiento */}
        {tieneRecepcion && !tieneInicio && puedeEditar && (
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
            <p style={{ fontSize: 13, color: T.text, marginBottom: 12, lineHeight: 1.5 }}>
              La orden está <strong>congelada</strong>: no se pueden capturar resultados hasta iniciar
              formalmente los trabajos. Al pulsar el botón se registra el timestamp de inicio.
            </p>
            <Btn
              disabled={iniciarLoading}
              onClick={iniciarMantenimiento}
              label={iniciarLoading ? 'Iniciando…' : '▶ Iniciar mantenimiento'}
            />
          </Card>
        )}

        {/* Modo solo lectura */}
        {!puedeEditar && orden.estado !== 'cerrada' && (
          <Card padding={14} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.5 }}>
              🔒 <strong style={{ color: T.text }}>Modo solo lectura.</strong> Esta orden está asignada a{' '}
              <strong style={{ color: T.text }}>{orden.tecnico?.nombre || 'otro usuario'}</strong> — solo
              la persona asignada o el supervisor de la orden pueden capturar datos.
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
          title="Asignación de la orden"
        >
          <ModalAsignacionContent
            orden={orden}
            tecnicos={tecnicos}
            supervisores={supervisores}
            onClose={() => setShowAsignacion(false)}
            onGuardar={guardarAsignacion}
          />
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
        </div>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {/* Secciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {secciones.map((sec, idx) => {
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
                          <Th minWidth={130}>Firma técnico</Th>
                          <Th minWidth={200}>Registro fotográfico</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {sec.resultados.map((r, i) => (
                          <FilaPunto
                            key={r.id}
                            index={i + 1}
                            resultado={r}
                            soloLectura={soloLectura}
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

        {/* Acciones */}
        <div style={{
          marginTop: 28, display: 'flex', gap: 10,
          justifyContent: 'center', flexWrap: 'wrap',
        }}>
          <Btn variant="ghost" label="Volver" onClick={() => navigate('/dashboard')} />
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

// ── Hora chip ────────────────────────────────────────────────
function HoraChip({ label, v }) {
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
      }}>{v} h</div>
    </div>
  )
}

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
function ModalAsignacionContent({ orden, tecnicos, supervisores, onClose, onGuardar }) {
  const [tecnicoId, setTecnicoId] = useState(orden.tecnico?.id || '')
  const [supervisorId, setSupervisorId] = useState(orden.supervisor?.id || '')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    setSaving(true)
    try {
      await onGuardar(tecnicoId, supervisorId || null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FieldSelect
        label="Técnico / Ingeniero responsable"
        required
        value={tecnicoId}
        onChange={setTecnicoId}
        placeholder="-- Selecciona --"
        options={tecnicos.map(u => ({
          value: u.id,
          label: `${u.nombre} · ${u.rol}${u.licenciaNum ? ` · ${u.licenciaNum}` : ''}`,
        }))}
      />
      <FieldSelect
        label="Supervisor asignado"
        value={supervisorId}
        onChange={setSupervisorId}
        placeholder="-- Sin supervisor --"
        options={supervisores.map(u => ({
          value: u.id,
          label: `${u.nombre}${u.licenciaNum ? ` · ${u.licenciaNum}` : ''}`,
        }))}
      />
      <p style={{ fontSize: 11, color: T.sub, lineHeight: 1.5 }}>
        Solo el técnico asignado y el supervisor de la orden tendrán permisos de edición.
        El resto de usuarios verá la orden en modo solo lectura.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <Btn variant="ghost" label="Cancelar" onClick={onClose} style={{ flex: 1 }} />
        <Btn
          label={saving ? 'Guardando…' : 'Guardar'}
          onClick={guardar}
          disabled={saving || !tecnicoId}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  )
}

// ── Fila de la tabla ─────────────────────────────────────────
function FilaPunto({ index, resultado, soloLectura, onCambiar, onFirmar, onSubirFoto, onEliminarFoto }) {
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
