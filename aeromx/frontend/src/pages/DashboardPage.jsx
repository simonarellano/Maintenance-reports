import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { ordenesService } from '../api/ordenesService'
import { useAuthStore } from '../store/authStore'
import { T, STATUS } from '../tokens/design'
import {
  Btn, BtnSm, Card, ErrorBanner, Pill, ProgressBar, Spinner,
} from '../components/ui'

const ESTADO_LABELS = {
  todas:           'Todas',
  borrador:        'Borrador',
  en_proceso:      'En Proceso',
  pendiente_firma: 'Pend. Firma',
  cerrada:         'Cerradas',
}

const FILTROS_ORDEN = ['todas', 'borrador', 'en_proceso', 'pendiente_firma', 'cerrada']

const VISTAS = [
  { value: 'mias',    label: 'Mis órdenes abiertas', descripcion: 'Sólo las órdenes asignadas a ti que aún no están cerradas' },
  { value: 'todas',   label: 'Ver todo',             descripcion: 'Todas las órdenes activas (propias y ajenas)' },
  { value: 'archivo', label: 'Archivo',              descripcion: 'Órdenes archivadas' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const esSupervisor = user?.rol === 'supervisor'
  const [ordenes, setOrdenes] = useState([])
  const [filtro, setFiltro] = useState('todas')
  const [vista, setVista] = useState('mias')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarOrdenes()
  }, [filtro, vista])

  const cargarOrdenes = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filtro !== 'todas') params.estado = filtro
      if (vista === 'archivo') params.archivada = 'true'
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

  const ordenesVisibles = useMemo(() => {
    let lista = ordenes
    if (vista === 'mias' && user?.id) {
      lista = lista.filter(o =>
        (o.tecnico?.id === user.id || o.supervisor?.id === user.id) &&
        o.estado !== 'cerrada'
      )
    }
    return lista
  }, [ordenes, vista, user?.id])

  const ordenesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return ordenesVisibles
    return ordenesVisibles.filter(o =>
      o.numeroOt?.toLowerCase().includes(q) ||
      o.aeronave?.matricula?.toLowerCase().includes(q) ||
      o.cliente?.toLowerCase().includes(q) ||
      o.tecnico?.nombre?.toLowerCase().includes(q) ||
      o.formato?.nombre?.toLowerCase().includes(q)
    )
  }, [ordenesVisibles, busqueda])

  const contadores = useMemo(() => ({
    total:           ordenesVisibles.length,
    enProceso:       ordenesVisibles.filter(o => o.estado === 'en_proceso').length,
    pendienteFirma:  ordenesVisibles.filter(o => o.estado === 'pendiente_firma').length,
    cerradas:        ordenesVisibles.filter(o => o.estado === 'cerrada').length,
  }), [ordenesVisibles])

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

  const vistaActiva = VISTAS.find(v => v.value === vista)

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Encabezado de la sección */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16, flexWrap: 'wrap', marginBottom: 22,
        }}>
          <div>
            <div style={{
              fontSize: 11, color: T.sub, letterSpacing: '0.08em',
              textTransform: 'uppercase', fontFamily: T.mono, marginBottom: 4,
            }}>Dashboard de operaciones</div>
            <h2 style={{
              fontSize: 28, fontWeight: 700, color: T.text,
              letterSpacing: '-0.02em',
            }}>{vistaActiva?.label || 'Órdenes de Trabajo'}</h2>
            <p style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>
              {vistaActiva?.descripcion}
            </p>
          </div>
          <Btn
            label="+ Nueva Orden"
            onClick={() => navigate('/ordenes/crear')}
          />
        </div>

        {/* Tabs de vista */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap',
          background: T.s1, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: 4,
        }}>
          {VISTAS.map((v) => {
            const active = vista === v.value
            return (
              <button
                key={v.value}
                onClick={() => { setVista(v.value); setFiltro('todas') }}
                style={{
                  flex: 1, minWidth: 140,
                  padding: '10px 14px', borderRadius: 9,
                  background: active ? T.cD : 'transparent',
                  color: active ? T.cyan : T.sub,
                  border: active ? `1px solid ${T.cyan}30` : '1px solid transparent',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: T.font, transition: 'background .15s, color .15s',
                }}
              >{v.label}</button>
            )
          })}
        </div>

        {/* Tarjetas de resumen */}
        {filtro === 'todas' && !loading && vista !== 'archivo' && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10, marginBottom: 18,
          }}>
            <StatChip label="Total"           value={contadores.total}          c={T.sub}    bg="rgba(96,112,160,0.12)" />
            <StatChip label="En proceso"      value={contadores.enProceso}      c={T.cyan}   bg={T.cD} />
            <StatChip label="Pendiente firma" value={contadores.pendienteFirma} c={T.amber}  bg={T.aD} />
            {vista === 'todas' && (
              <StatChip label="Cerradas"      value={contadores.cerradas}       c={T.green}  bg={T.gD} />
            )}
          </div>
        )}

        {/* Filtros + búsqueda */}
        <Card padding={14} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {FILTROS_ORDEN
              .filter((v) => vista !== 'mias' || v !== 'cerrada')
              .map((v) => {
                const active = filtro === v
                return (
                  <button
                    key={v}
                    onClick={() => setFiltro(v)}
                    style={{
                      padding: '7px 14px', borderRadius: 999,
                      background: active ? T.cD : T.s2,
                      color: active ? T.cyan : T.sub,
                      border: active ? `1px solid ${T.cyan}40` : `1px solid ${T.border}`,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      fontFamily: T.font,
                    }}
                  >
                    {ESTADO_LABELS[v]}
                  </button>
                )
              })}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por matrícula, N.º O/T, cliente, técnico o formato…"
              style={{
                width: '100%',
                background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '11px 40px 11px 38px', color: T.text, fontSize: 14,
                outline: 'none',
              }}
            />
            <span style={{
              position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
              color: T.sub, pointerEvents: 'none',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5.2" stroke={T.sub} strokeWidth="1.5"/>
                <path d="M11 11l3 3" stroke={T.sub} strokeWidth="1.7" strokeLinecap="round"/>
              </svg>
            </span>
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none',
                  color: T.sub, fontSize: 18, cursor: 'pointer', padding: '0 6px',
                }}
              >×</button>
            )}
          </div>
        </Card>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {/* Lista */}
        {loading ? (
          <Spinner label="Cargando órdenes…" />
        ) : ordenesFiltradas.length === 0 ? (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <div style={{ color: T.sub, fontSize: 14, marginBottom: 18 }}>
              {busqueda
                ? `Sin resultados para "${busqueda}"`
                : vista === 'mias'
                  ? 'No tienes órdenes abiertas asignadas. Cambia a "Ver todo" para revisar el histórico general.'
                  : vista === 'archivo'
                    ? 'No hay órdenes archivadas.'
                    : 'No hay órdenes en este estado'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {vista === 'mias' && (
                <Btn label="Ver todo" variant="ghost" onClick={() => setVista('todas')} />
              )}
              <Btn label="Crear nueva orden" onClick={() => navigate('/ordenes/crear')} />
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ordenesFiltradas.map((orden) => (
              <OrdenCard
                key={orden.id}
                orden={orden}
                esSupervisor={esSupervisor}
                onClick={() => navigate(`/ordenes/${orden.id}/inspeccion`)}
                onArchivar={(e) => archivarOrden(e, orden)}
                onEliminar={(e) => eliminarOrden(e, orden)}
                onPDF={(e) => descargarPDF(e, orden.id, orden.numeroOt)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ── StatChip ──────────────────────────────────────────────────
function StatChip({ label, value, c, bg }) {
  return (
    <div style={{
      background: bg,
      border: `1px solid ${c}25`,
      borderRadius: 14,
      padding: '12px 14px',
    }}>
      <div style={{
        fontSize: 9, color: c, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        fontSize: 26, fontWeight: 700, color: c,
        fontFamily: T.mono, marginTop: 2, lineHeight: 1.1,
      }}>{value}</div>
    </div>
  )
}

// ── Card de O/T ────────────────────────────────────────────────
function OrdenCard({ orden, esSupervisor, onClick, onArchivar, onEliminar, onPDF }) {
  const st = STATUS[orden.estado] || { label: orden.estado, c: T.sub, bg: T.s2 }
  const totalPuntos = orden._count?.resultados || 0
  const completos = orden.resultados?.filter((r) => r.completado).length || 0
  const progreso = totalPuntos > 0 ? completos / totalPuntos : 0
  const esCerrada = orden.estado === 'cerrada'
  const esBorrador = orden.estado === 'borrador'

  return (
    <div
      onClick={onClick}
      style={{
        background: T.s1,
        border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${st.c}`,
        borderRadius: 16, padding: 16,
        cursor: 'pointer', transition: 'border-color .15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${T.cyan}30`; e.currentTarget.style.borderLeftColor = st.c }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.borderLeftColor = st.c }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 8, gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.sub, marginBottom: 2 }}>
            {orden.numeroOt}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>
            {orden.aeronave?.matricula}
            <span style={{ color: T.sub, fontWeight: 400 }}>
              {orden.aeronave?.modelo?.nombre ? ` · ${orden.aeronave.modelo.nombre}` : ''}
            </span>
          </div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
            {orden.formato?.nombre}
            {orden.cliente && <span> · {orden.cliente}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill label={st.label} color={st.c} bg={st.bg} small />
          {orden.archivada && (
            <Pill label="Archivada" color={T.sub} bg={T.s2} small />
          )}
        </div>
      </div>

      {/* Meta grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10, marginBottom: 10,
        paddingTop: 10, borderTop: `1px solid ${T.border}`,
      }}>
        <Meta k="Técnico"     v={orden.tecnico?.nombre} />
        <Meta k="Supervisor"  v={orden.supervisor?.nombre} />
        {orden.lugarMantenimiento && <Meta k="Lugar" v={`📍 ${orden.lugarMantenimiento}`} />}
        <Meta
          k="Recepción"
          v={orden.fechaRecepcion
            ? new Date(orden.fechaRecepcion).toLocaleDateString('es-MX')
            : 'Pendiente'}
          color={orden.fechaRecepcion ? T.text : T.amber}
        />
        <Meta
          k="Inicio"
          v={orden.fechaInicio
            ? new Date(orden.fechaInicio).toLocaleDateString('es-MX')
            : 'Sin iniciar'}
          color={orden.fechaInicio ? T.text : T.sub}
        />
        {esCerrada && (
          <Meta
            k="Cierre"
            v={orden.fechaCierre ? new Date(orden.fechaCierre).toLocaleDateString('es-MX') : '—'}
            color={T.green}
          />
        )}
      </div>

      {/* Progreso */}
      {!esCerrada && totalPuntos > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginBottom: 6, fontSize: 11,
          }}>
            <span style={{ color: T.sub }}>Progreso</span>
            <span style={{ color: T.sub, fontFamily: T.mono }}>
              {completos} / {totalPuntos} · {Math.round(progreso * 100)}%
            </span>
          </div>
          <ProgressBar value={progreso} color={progreso === 1 ? T.green : T.cyan} height={3} />
        </div>
      )}

      {/* Acciones */}
      <div style={{
        marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end',
      }}>
        {esCerrada && (
          <BtnSm
            variant="surface"
            onClick={onPDF}
            label={
              <>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M3 12v2h10v-2M8 3v8M5 8l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>PDF</span>
              </>
            }
          />
        )}
        {esSupervisor && (
          <>
            <BtnSm
              variant={orden.archivada ? 'surface' : 'ghost'}
              onClick={onArchivar}
              label={orden.archivada ? '↩ Desarchivar' : '🗄 Archivar'}
            />
            {(esBorrador || orden.archivada) && (
              <BtnSm variant="danger" onClick={onEliminar} label="🗑 Eliminar" />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Meta({ k, v, color }) {
  return (
    <div>
      <div style={{
        fontSize: 9, color: T.sub, textTransform: 'uppercase',
        letterSpacing: '0.07em', marginBottom: 3, fontWeight: 600,
      }}>{k}</div>
      <div style={{
        fontSize: 12, color: color || T.text, fontWeight: 500,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{v ?? '—'}</div>
    </div>
  )
}
