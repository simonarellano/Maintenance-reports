import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { productosService } from '../api/productosService'
import { ordenesService } from '../api/ordenesService'
import { T, STATUS, TIPO_PRODUCTO, TIPOS_PRODUCTO } from '../tokens/design'
import {
  Card, ErrorBanner, Hdr, Pill, Spinner,
} from '../components/ui'

export default function FlotaPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [productos, setProductos] = useState([])
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState({})
  const [busqueda, setBusqueda] = useState('')

  const tipoParam = searchParams.get('tipo')
  const tipo = TIPOS_PRODUCTO.includes(tipoParam) ? tipoParam : 'aeronave'
  const meta = TIPO_PRODUCTO[tipo]
  const cambiarTipo = (t) => setSearchParams(t === 'aeronave' ? {} : { tipo: t })

  useEffect(() => { cargar() }, [tipo])

  const cargar = async () => {
    setLoading(true)
    try {
      const [prodRes, ordRes] = await Promise.all([
        productosService.listar({ tipoProducto: tipo }),
        ordenesService.listar({ archivada: 'todas' }),
      ])
      setProductos(prodRes.data || [])
      setOrdenes(ordRes.data || [])
      setError('')
    } catch (e) {
      setError('Error cargando flota')
    } finally {
      setLoading(false)
    }
  }

  const ordenesPorProducto = useMemo(() => {
    const m = new Map()
    for (const o of ordenes) {
      if (!m.has(o.productoId)) m.set(o.productoId, [])
      m.get(o.productoId).push(o)
    }
    for (const v of m.values()) {
      v.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    return m
  }, [ordenes])

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos
    return productos.filter(p =>
      p.identificador?.toLowerCase().includes(q) ||
      p.modelo?.nombre?.toLowerCase().includes(q) ||
      p.numeroSerie?.toLowerCase().includes(q)
    )
  }, [productos, busqueda])

  const toggle = (id) => setExpandido(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
        <Hdr
          title="Flota por producto"
          sub="Histórico de operaciones"
          back={() => navigate('/dashboard')}
        />
        <p style={{ color: T.sub, fontSize: 13, marginTop: -8, marginBottom: 16 }}>
          Histórico de órdenes de mantenimiento agrupadas por producto
        </p>

        {/* Pestañas de tipo */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
          {TIPOS_PRODUCTO.map((t) => {
            const m = TIPO_PRODUCTO[t]
            const active = tipo === t
            return (
              <button
                key={t}
                onClick={() => cambiarTipo(t)}
                style={{
                  padding: '8px 16px', borderRadius: 999,
                  background: active ? m.bg : T.s2,
                  color: active ? m.c : T.sub,
                  border: active ? `1px solid ${m.c}55` : `1px solid ${T.border}`,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: T.font, display: 'inline-flex', alignItems: 'center', gap: 7,
                }}
              >
                <span>{m.icon}</span>{m.label}
              </button>
            )
          })}
        </div>

        <Card padding={14} style={{ marginBottom: 18 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por identificador, modelo o número de serie…"
              style={{
                width: '100%',
                background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10,
                padding: '11px 38px', color: T.text, fontSize: 14, outline: 'none',
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
          </div>
        </Card>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {loading ? (
          <Spinner label="Cargando flota…" />
        ) : productosFiltrados.length === 0 ? (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <p style={{ color: T.sub }}>No hay {meta.label.toLowerCase()}s registrados.</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {productosFiltrados.map((p) => {
              const ords = ordenesPorProducto.get(p.id) || []
              const isOpen = Boolean(expandido[p.id])
              const enProceso = ords.filter(o => o.estado !== 'cerrada' && !o.archivada).length
              const cerradas = ords.filter(o => o.estado === 'cerrada').length

              return (
                <section key={p.id} style={{
                  background: T.s1, border: `1px solid ${T.border}`,
                  borderRadius: 14, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => toggle(p.id)}
                    style={{
                      width: '100%',
                      padding: '16px 18px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 12, flexWrap: 'wrap',
                      background: T.s2, border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                      fontFamily: T.font,
                      borderBottom: isOpen ? `1px solid ${T.border}` : 'none',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 18, fontWeight: 700, color: T.text,
                          fontFamily: T.mono, letterSpacing: '0.02em',
                        }}>{p.identificador}</span>
                        <span style={{ fontSize: 13, color: T.sub }}>
                          {p.modelo?.nombre}
                          {p.modelo?.fabricante ? ` · ${p.modelo.fabricante}` : ''}
                        </span>
                        {p.activo === false && (
                          <Pill small label="Inactivo" color={T.sub} bg={T.s1} />
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.sub, marginTop: 5, fontFamily: T.mono }}>
                        {p.numeroSerie ? `S/N ${p.numeroSerie} · ` : ''}
                        <DetalleFlota tipo={tipo} producto={p} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); navigate(`/fallas/dashboard?productoId=${p.id}`) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); navigate(`/fallas/dashboard?productoId=${p.id}`) } }}
                        style={{
                          padding: '6px 12px', borderRadius: 999,
                          background: T.rD, color: T.red, border: `1px solid ${T.red}30`,
                          fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >⚠ Fallas</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: T.cyan, fontWeight: 600 }}>
                          {enProceso} activas
                        </div>
                        <div style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>
                          {cerradas} cerradas
                        </div>
                      </div>
                      <span style={{ color: T.sub, fontSize: 12, fontFamily: T.mono }}>
                        {isOpen ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div>
                      {ords.length === 0 ? (
                        <div style={{
                          padding: 28, textAlign: 'center',
                          color: T.sub, fontSize: 13,
                        }}>
                          Este producto aún no tiene órdenes registradas.
                        </div>
                      ) : (
                        ords.map((o) => (
                          <ResumenOrden
                            key={o.id}
                            orden={o}
                            onClick={() => navigate(`/ordenes/${o.id}/inspeccion`)}
                          />
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

function DetalleFlota({ tipo, producto }) {
  if (tipo === 'aeronave') {
    const d = producto.aeronave || {}
    return <>Total: {d.horasTotales ?? 0}h · M.D: {d.horasMotorDer ?? 0}h · M.I: {d.horasMotorIzq ?? 0}h</>
  }
  if (tipo === 'gcs') {
    const d = producto.gcs || {}
    return <>Placas: {d.placas || '—'} · {d.odometro ?? 0} km</>
  }
  if (tipo === 'planta') {
    const d = producto.planta || {}
    return <>Horímetro: {d.horimetro ?? 0}h</>
  }
  if (tipo === 'sensor_inteligencia') {
    const d = producto.sensor_inteligencia || {}
    return <>{d.fabricante || '—'} · FW {d.versionFirmware || '—'}</>
  }
  return null
}

function ResumenOrden({ orden, onClick }) {
  const fecha = orden.createdAt ? new Date(orden.createdAt) : null
  const st = STATUS[orden.estado] || { label: orden.estado, c: T.sub, bg: T.s2 }
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '12px 18px', textAlign: 'left',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 14, flexWrap: 'wrap',
        background: 'transparent', border: 'none',
        borderTop: `1px solid ${T.border}`,
        cursor: 'pointer', fontFamily: T.font,
        transition: 'background .15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = T.s2 }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: T.mono, fontSize: 13, color: T.text, fontWeight: 600,
          }}>{orden.numeroOt}</span>
          <Pill small label={st.label} color={st.c} bg={st.bg} />
          {orden.archivada && (
            <Pill small label="Archivada" color={T.sub} bg={T.s2} />
          )}
        </div>
        <div style={{
          fontSize: 11, color: T.sub, marginTop: 6,
          display: 'flex', flexWrap: 'wrap', gap: 14,
        }}>
          <span>Soporte: <strong style={{ color: T.text }}>{orden.soporte?.nombre || '—'}</strong></span>
          <span>Gerente: <strong style={{ color: T.text }}>{orden.gerente?.nombre || '—'}</strong></span>
          {orden.lugarMantenimiento && (
            <span>📍 <strong style={{ color: T.text }}>{orden.lugarMantenimiento}</strong></span>
          )}
        </div>
      </div>
      {fecha && (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: T.text, fontFamily: T.mono }}>
            {fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 10, color: T.sub, fontFamily: T.mono, marginTop: 2 }}>
            {fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </button>
  )
}
