// aeromx/frontend/src/pages/FallasDashboardPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { fallasService } from '../api/fallasService'
import { categoriasFallaService } from '../api/categoriasFallaService'
import FallasGraficas from '../components/fallas/FallasGraficas'
import { T, SEVERIDADES, ESTADO_FALLA, ORIGENES_FALLA, TIPO_PRODUCTO, SEVERIDAD } from '../tokens/design'
import { Btn, Card, ErrorBanner, Spinner } from '../components/ui'

const selectStyle = {
  background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10,
  padding: '7px 12px', color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none', cursor: 'pointer',
}

function StatChip({ label, value, c, bg }) {
  return (
    <div style={{ background: bg, border: `1px solid ${c}25`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 9, color: c, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: c, fontFamily: T.mono, marginTop: 2, lineHeight: 1.1 }}>{value}</div>
    </div>
  )
}

// Dispara la descarga de un blob recibido del backend.
function descargarBlob(blob, nombre) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export default function FallasDashboardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [stats, setStats] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportando, setExportando] = useState('')

  // productoId/modeloId se siembran desde la URL (enlace "Ver fallas" de la Flota).
  const [filtros, setFiltros] = useState({
    desde: '', hasta: '',
    productoId: searchParams.get('productoId') || '',
    modeloId: searchParams.get('modeloId') || '',
    tipoProducto: '', categoriaId: '', severidad: '', estado: '', origen: '',
  })

  const set = (k) => (e) => setFiltros((f) => ({ ...f, [k]: e.target.value }))

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      // Solo manda filtros con valor.
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v))
      const [resStats, resCats] = await Promise.all([
        fallasService.estadisticas(params),
        categorias.length ? Promise.resolve({ data: categorias }) : categoriasFallaService.listar({ activo: true }),
      ])
      setStats(resStats.data?.data || null)
      if (!categorias.length) setCategorias(resCats.data || [])
      setError('')
    } catch (err) {
      setError('Error cargando estadísticas')
      console.error(err)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])

  const exportar = async (tipo) => {
    setExportando(tipo)
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v))
      if (tipo === 'excel') {
        const res = await fallasService.descargarExcel(params)
        descargarBlob(res.data, 'fallas.xlsx')
      } else {
        const res = await fallasService.descargarResumenPDF(params)
        descargarBlob(res.data, 'resumen-fallas.pdf')
      }
    } catch (err) {
      setError('Error al exportar')
      console.error(err)
    } finally {
      setExportando('')
    }
  }

  const limpiar = () => setFiltros({ desde: '', hasta: '', productoId: '', modeloId: '', tipoProducto: '', categoriaId: '', severidad: '', estado: '', origen: '' })

  const k = stats?.kpis

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 11, color: T.sub, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: T.mono, marginBottom: 4 }}>Registro de fallas</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>Analítica de Fallas</h2>
            <p style={{ color: T.sub, fontSize: 13, marginTop: 4 }}>KPIs, tendencias y distribución de fallas. Los filtros afectan gráficas, tabla y exportación.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Btn variant="ghost" label="← Reportes" onClick={() => navigate('/fallas')} />
            <Btn variant="ghost" label={exportando === 'excel' ? 'Exportando…' : '⬇ Excel'} onClick={() => exportar('excel')} />
            <Btn label={exportando === 'pdf' ? 'Generando…' : '⬇ PDF resumen'} onClick={() => exportar('pdf')} />
          </div>
        </div>

        {/* Pestañas por tipo de producto */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {[{ key: '', label: 'Todas', icon: '▦', c: T.cyan, bg: T.cD }, ...Object.entries(TIPO_PRODUCTO).map(([key, v]) => ({ key, ...v }))].map((t) => {
            const active = filtros.tipoProducto === t.key
            return (
              <button
                key={t.key || 'todas'}
                onClick={() => setFiltros((f) => ({ ...f, tipoProducto: t.key }))}
                style={{
                  padding: '8px 16px', borderRadius: 999,
                  background: active ? t.bg : T.s2,
                  color: active ? t.c : T.sub,
                  border: active ? `1px solid ${t.c}55` : `1px solid ${T.border}`,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: T.font, display: 'inline-flex', alignItems: 'center', gap: 7,
                }}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            )
          })}
        </div>

        {/* Filtros */}
        <Card padding={14} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: T.sub }}>Desde
              <input type="date" value={filtros.desde} onChange={set('desde')} style={{ ...selectStyle, marginLeft: 6 }} />
            </label>
            <label style={{ fontSize: 11, color: T.sub }}>Hasta
              <input type="date" value={filtros.hasta} onChange={set('hasta')} style={{ ...selectStyle, marginLeft: 6 }} />
            </label>
            <select value={filtros.categoriaId} onChange={set('categoriaId')} style={selectStyle}>
              <option value="">Categoría: todas</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select value={filtros.severidad} onChange={set('severidad')} style={selectStyle}>
              <option value="">Severidad: todas</option>
              {SEVERIDADES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={filtros.estado} onChange={set('estado')} style={selectStyle}>
              <option value="">Estado: todos</option>
              {Object.entries(ESTADO_FALLA).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
            </select>
            <select value={filtros.origen} onChange={set('origen')} style={selectStyle}>
              <option value="">Origen: todos</option>
              {ORIGENES_FALLA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={limpiar} style={{ ...selectStyle, color: T.red, borderColor: `${T.red}30`, background: T.rD }}>× Limpiar</button>
          </div>
        </Card>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {loading ? (
          <Spinner label="Cargando analítica…" />
        ) : !stats || stats.kpis.total === 0 ? (
          <Card padding={40} style={{ textAlign: 'center', color: T.sub }}>Sin fallas para los filtros aplicados.</Card>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
              <StatChip label="Total"            value={k.total}            c={T.sub}   bg="rgba(96,112,160,0.12)" />
              <StatChip label="Abiertas"         value={k.abiertas}         c={T.amber} bg={T.aD} />
              <StatChip label="Resueltas"        value={k.resueltas}        c={T.green} bg={T.gD} />
              <StatChip label="Críticas abiertas" value={k.criticasAbiertas} c={T.red}   bg={T.rD} />
              <StatChip label="MTTR (días)"      value={k.mttrDias ?? '—'}  c={T.cyan}  bg={T.cD} />
              <StatChip label="% resueltas"      value={`${k.pctResueltas}%`} c={T.purple} bg={T.pD} />
            </div>

            {/* Gráficas */}
            <div style={{ marginBottom: 18 }}>
              <FallasGraficas stats={stats} />
            </div>

            {/* Tabla de detalle */}
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: T.s2, color: T.sub, textAlign: 'left' }}>
                      {['N.º', 'Título', 'Producto', 'Categoría', 'Severidad', 'Estado', 'Detección'].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.detalle.map((d) => (
                      <tr key={d.numeroFalla} style={{ borderTop: `1px solid ${T.border}`, color: T.text }}>
                        <td style={{ padding: '9px 12px', fontFamily: T.mono, color: T.sub, whiteSpace: 'nowrap' }}>{d.numeroFalla}</td>
                        <td style={{ padding: '9px 12px' }}>{d.titulo}</td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{d.producto}</td>
                        <td style={{ padding: '9px 12px' }}>{d.categoria}</td>
                        <td style={{ padding: '9px 12px', color: SEVERIDAD[d.severidad]?.color || T.text }}>{SEVERIDAD[d.severidad]?.label || d.severidad}</td>
                        <td style={{ padding: '9px 12px', color: ESTADO_FALLA[d.estado]?.color || T.text }}>{ESTADO_FALLA[d.estado]?.label || d.estado}</td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{d.fechaDeteccion ? new Date(d.fechaDeteccion).toLocaleDateString('es-MX') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
