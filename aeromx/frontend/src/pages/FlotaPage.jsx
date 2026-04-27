import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { aeronavesService } from '../api/aeronavesService'
import { ordenesService } from '../api/ordenesService'
import { T, STATUS } from '../tokens/design'
import {
  Btn, Card, ErrorBanner, Hdr, Pill, Spinner,
} from '../components/ui'

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

  const ordenesPorAeronave = useMemo(() => {
    const m = new Map()
    for (const o of ordenes) {
      if (!m.has(o.aeronaveId)) m.set(o.aeronaveId, [])
      m.get(o.aeronaveId).push(o)
    }
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
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
        <Hdr
          title="Flota por aeronave"
          sub="Histórico de operaciones"
          back={() => navigate('/dashboard')}
        />
        <p style={{ color: T.sub, fontSize: 13, marginTop: -8, marginBottom: 20 }}>
          Histórico de órdenes de mantenimiento agrupadas por aeronave
        </p>

        <Card padding={14} style={{ marginBottom: 18 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por matrícula, modelo o número de serie…"
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
        ) : aeronavesFiltradas.length === 0 ? (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <p style={{ color: T.sub }}>No hay aeronaves registradas.</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {aeronavesFiltradas.map((a) => {
              const ords = ordenesPorAeronave.get(a.id) || []
              const isOpen = Boolean(expandido[a.id])
              const enProceso = ords.filter(o => o.estado !== 'cerrada' && !o.archivada).length
              const cerradas = ords.filter(o => o.estado === 'cerrada').length

              return (
                <section key={a.id} style={{
                  background: T.s1, border: `1px solid ${T.border}`,
                  borderRadius: 14, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => toggle(a.id)}
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
                        }}>{a.matricula}</span>
                        <span style={{ fontSize: 13, color: T.sub }}>
                          {a.modelo?.nombre}
                          {a.modelo?.fabricante ? ` · ${a.modelo.fabricante}` : ''}
                        </span>
                        {a.activa === false && (
                          <Pill small label="Inactiva" color={T.sub} bg={T.s1} />
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.sub, marginTop: 5, fontFamily: T.mono }}>
                        {a.numeroSerie ? `S/N ${a.numeroSerie} · ` : ''}
                        Total: {a.horasTotales ?? 0}h · M.D: {a.horasMotorDer ?? 0}h · M.I: {a.horasMotorIzq ?? 0}h
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
                          Esta aeronave aún no tiene órdenes registradas.
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
          <span>Técnico: <strong style={{ color: T.text }}>{orden.tecnico?.nombre || '—'}</strong></span>
          <span>Supervisor: <strong style={{ color: T.text }}>{orden.supervisor?.nombre || '—'}</strong></span>
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
