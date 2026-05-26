import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { fallasService } from '../api/fallasService'
import { categoriasFallaService } from '../api/categoriasFallaService'
import {
  T, SEVERIDAD, SEVERIDADES, ESTADO_FALLA, ORIGENES_FALLA, TIPO_PRODUCTO,
} from '../tokens/design'
import { Btn, Card, ErrorBanner, Pill, Spinner } from '../components/ui'

const ESTADO_FALLA_FILTROS = ['todas', ...Object.keys(ESTADO_FALLA)]

const ESTADO_FALLA_LABELS = {
  todas: 'Todas',
  detectada: 'Detectada',
  en_proceso: 'En proceso',
  resuelta: 'Resuelta',
}

export default function FallasPage() {
  const navigate = useNavigate()

  const [fallas, setFallas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [filtroSeveridad, setFiltroSeveridad] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroOrigen, setFiltroOrigen] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const [resFallas, resCats] = await Promise.all([
        fallasService.listar({}),
        categoriasFallaService.listar({ activo: true }),
      ])
      setFallas(resFallas.data || [])
      setCategorias(resCats.data || [])
      setError('')
    } catch (err) {
      setError('Error cargando reportes de falla')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Filtrado client-side (espeja patrón de DashboardPage)
  const fallasFiltradas = useMemo(() => {
    let lista = fallas

    if (filtroEstado !== 'todas') {
      lista = lista.filter(f => f.estado === filtroEstado)
    }
    if (filtroSeveridad) {
      lista = lista.filter(f => f.severidad === filtroSeveridad)
    }
    if (filtroCategoria) {
      lista = lista.filter(f => f.categoria?.id === filtroCategoria)
    }
    if (filtroTipo) {
      lista = lista.filter(f => f.producto?.tipoProducto === filtroTipo)
    }
    if (filtroOrigen) {
      lista = lista.filter(f => f.origen === filtroOrigen)
    }

    const q = busqueda.trim().toLowerCase()
    if (q) {
      lista = lista.filter(f =>
        f.numeroFalla?.toLowerCase().includes(q) ||
        f.titulo?.toLowerCase().includes(q) ||
        f.producto?.identificador?.toLowerCase().includes(q) ||
        f.producto?.modelo?.nombre?.toLowerCase().includes(q) ||
        f.categoria?.nombre?.toLowerCase().includes(q) ||
        f.responsable?.nombre?.toLowerCase().includes(q)
      )
    }

    return lista
  }, [fallas, filtroEstado, filtroSeveridad, filtroCategoria, filtroTipo, filtroOrigen, busqueda])

  const contadores = useMemo(() => ({
    total:      fallas.length,
    detectada:  fallas.filter(f => f.estado === 'detectada').length,
    enProceso:  fallas.filter(f => f.estado === 'en_proceso').length,
    resuelta:   fallas.filter(f => f.estado === 'resuelta').length,
  }), [fallas])

  const limpiarFiltros = () => {
    setFiltroEstado('todas')
    setFiltroSeveridad('')
    setFiltroCategoria('')
    setFiltroTipo('')
    setFiltroOrigen('')
    setBusqueda('')
  }

  const hayFiltrosActivos = filtroEstado !== 'todas' || filtroSeveridad || filtroCategoria || filtroTipo || filtroOrigen || busqueda

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* Encabezado */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16, flexWrap: 'wrap', marginBottom: 22,
        }}>
          <div>
            <div style={{
              fontSize: 11, color: T.sub, letterSpacing: '0.08em',
              textTransform: 'uppercase', fontFamily: T.mono, marginBottom: 4,
            }}>Registro de fallas</div>
            <h2 style={{
              fontSize: 28, fontWeight: 700, color: T.text,
              letterSpacing: '-0.02em',
            }}>Reportes de Falla</h2>
            <p style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>
              Fallas detectadas, en proceso y resueltas de todos los productos
            </p>
          </div>
          <Btn
            label="+ Nueva falla"
            onClick={() => navigate('/fallas/nueva')}
          />
        </div>

        {/* Tarjetas de resumen */}
        {!loading && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 10, marginBottom: 18,
          }}>
            <StatChip label="Total"       value={contadores.total}      c={T.sub}    bg="rgba(96,112,160,0.12)" />
            <StatChip label="Detectadas"  value={contadores.detectada}  c="#3b82f6"  bg="rgba(59,130,246,0.13)" />
            <StatChip label="En proceso"  value={contadores.enProceso}  c={T.amber}  bg={T.aD} />
            <StatChip label="Resueltas"   value={contadores.resuelta}   c={T.green}  bg={T.gD} />
          </div>
        )}

        {/* Filtros */}
        <Card padding={14} style={{ marginBottom: 18 }}>
          {/* Pills de estado */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {ESTADO_FALLA_FILTROS.map((v) => {
              const active = filtroEstado === v
              const meta = v !== 'todas' ? ESTADO_FALLA[v] : null
              return (
                <button
                  key={v}
                  onClick={() => setFiltroEstado(v)}
                  style={{
                    padding: '7px 14px', borderRadius: 999,
                    background: active ? (meta ? `${meta.color}22` : T.cD) : T.s2,
                    color: active ? (meta ? meta.color : T.cyan) : T.sub,
                    border: active
                      ? `1px solid ${meta ? meta.color : T.cyan}40`
                      : `1px solid ${T.border}`,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                    fontFamily: T.font,
                  }}
                >
                  {ESTADO_FALLA_LABELS[v] || v}
                </button>
              )
            })}
          </div>

          {/* Selectores de filtro */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <select
              value={filtroSeveridad}
              onChange={e => setFiltroSeveridad(e.target.value)}
              style={selectStyle}
            >
              <option value="">Severidad: todas</option>
              {SEVERIDADES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              style={selectStyle}
            >
              <option value="">Categoría: todas</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>

            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              style={selectStyle}
            >
              <option value="">Tipo de producto: todos</option>
              {Object.entries(TIPO_PRODUCTO).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>

            <select
              value={filtroOrigen}
              onChange={e => setFiltroOrigen(e.target.value)}
              style={selectStyle}
            >
              <option value="">Origen: todos</option>
              {ORIGENES_FALLA.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                style={{
                  padding: '7px 14px', borderRadius: 999,
                  background: T.rD, color: T.red,
                  border: `1px solid ${T.red}30`,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: T.font,
                }}
              >
                × Limpiar filtros
              </button>
            )}
          </div>

          {/* Búsqueda de texto */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por N.º falla, título, producto, modelo, categoría o responsable…"
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
          <Spinner label="Cargando fallas…" />
        ) : fallasFiltradas.length === 0 ? (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <div style={{ color: T.sub, fontSize: 14, marginBottom: 18 }}>
              {busqueda || hayFiltrosActivos
                ? 'Sin resultados para los filtros aplicados.'
                : 'No hay reportes de falla registrados.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {hayFiltrosActivos && (
                <Btn label="Limpiar filtros" variant="ghost" onClick={limpiarFiltros} />
              )}
              <Btn label="+ Nueva falla" onClick={() => navigate('/fallas/nueva')} />
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fallasFiltradas.map(falla => (
              <FallaCard
                key={falla.id}
                falla={falla}
                onClick={() => navigate(`/fallas/${falla.id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Estilos reutilizables ────────────────────────────────────────
const selectStyle = {
  background: T.s2,
  border: `1px solid ${T.border}`,
  borderRadius: 10,
  padding: '7px 12px',
  color: T.text,
  fontSize: 12,
  fontFamily: T.font,
  outline: 'none',
  cursor: 'pointer',
}

// ── StatChip ────────────────────────────────────────────────────
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

// ── FallaCard ───────────────────────────────────────────────────
function FallaCard({ falla, onClick }) {
  const sevMeta = SEVERIDAD[falla.severidad] || { label: falla.severidad, color: T.sub }
  const estMeta = ESTADO_FALLA[falla.estado] || { label: falla.estado, color: T.sub }
  const tipoMeta = TIPO_PRODUCTO[falla.producto?.tipoProducto] || { label: 'Producto', icon: '📦', c: T.sub, bg: T.s2 }

  return (
    <div
      onClick={onClick}
      style={{
        background: T.s1,
        border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${sevMeta.color}`,
        borderRadius: 16,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${T.cyan}30`
        e.currentTarget.style.borderLeftColor = sevMeta.color
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border
        e.currentTarget.style.borderLeftColor = sevMeta.color
      }}
    >
      {/* Cabecera: número + producto + badges */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 8, gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.sub, marginBottom: 2 }}>
            {falla.numeroFalla}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>
            {falla.titulo || falla.categoria?.nombre || 'Sin título'}
          </div>
          <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
            {falla.producto?.identificador}
            {falla.producto?.modelo?.nombre && (
              <span> · {falla.producto.modelo.nombre}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill label={`${tipoMeta.icon} ${tipoMeta.label}`} color={tipoMeta.c} bg={tipoMeta.bg} small />
          <Pill
            label={sevMeta.label}
            color={sevMeta.color}
            bg={`${sevMeta.color}20`}
            small
          />
          <Pill
            label={estMeta.label}
            color={estMeta.color}
            bg={`${estMeta.color}20`}
            small
          />
        </div>
      </div>

      {/* Meta grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 10,
        paddingTop: 10,
        borderTop: `1px solid ${T.border}`,
      }}>
        {falla.categoria && (
          <MetaFalla k="Categoría" v={falla.categoria.nombre} color={falla.categoria.color || T.text} />
        )}
        {falla.origen && (
          <MetaFalla k="Origen" v={
            falla.origen === 'mantenimiento' ? 'Mantenimiento'
            : falla.origen === 'prevuelo' ? 'Prevuelo'
            : falla.origen === 'operacion' ? 'Operación'
            : falla.origen
          } />
        )}
        <MetaFalla
          k="Detectada"
          v={falla.fechaDeteccion
            ? new Date(falla.fechaDeteccion).toLocaleDateString('es-MX')
            : '—'}
        />
        <MetaFalla
          k="Responsable"
          v={falla.responsable?.nombre || 'Sin asignar'}
          color={falla.responsable ? T.text : T.amber}
        />
      </div>
    </div>
  )
}

function MetaFalla({ k, v, color }) {
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
