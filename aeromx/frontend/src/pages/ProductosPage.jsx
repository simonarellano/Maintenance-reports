import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { productosService } from '../api/productosService'
import { modelosService } from '../api/modelosService'
import { useAuthStore } from '../store/authStore'
import { T, TIPO_PRODUCTO, TIPOS_PRODUCTO } from '../tokens/design'
import {
  Btn, BtnSm, Card, ErrorBanner, Field, FieldSelect, Hdr, Pill, Spinner,
} from '../components/ui'

export default function ProductosPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const puedeEditar =
    user?.superusuario === true ||
    user?.rol === 'gerente_soporte' ||
    user?.rol === 'ingeniero_soporte'

  const tipoParam = searchParams.get('tipo')
  const tipo = TIPOS_PRODUCTO.includes(tipoParam) ? tipoParam : 'aeronave'

  const [productos, setProductos] = useState([])
  const [modelos, setModelos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [incluirInactivos, setIncluirInactivos] = useState(false)
  const [editando, setEditando] = useState(null)
  const [modoAlta, setModoAlta] = useState(false)

  useEffect(() => {
    setEditando(null)
    setModoAlta(false)
    cargar()
  }, [tipo, incluirInactivos])

  const cargar = async () => {
    setLoading(true)
    try {
      const params = { tipoProducto: tipo }
      if (!incluirInactivos) params.activo = true
      const [prodRes, modRes] = await Promise.all([
        productosService.listar(params),
        modelosService.listar({ tipoProducto: tipo }),
      ])
      setProductos(prodRes.data || [])
      setModelos(modRes.data || [])
      setError('')
    } catch (e) {
      setError('Error cargando productos')
    } finally {
      setLoading(false)
    }
  }

  const cambiarTipo = (t) => setSearchParams(t === 'aeronave' ? {} : { tipo: t })

  const guardar = async (datos) => {
    try {
      if (editando) {
        await productosService.actualizar(editando.id, datos)
      } else {
        await productosService.crear({ tipoProducto: tipo, ...datos })
      }
      setModoAlta(false)
      setEditando(null)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando el producto')
    }
  }

  const desactivar = async (p) => {
    if (!confirm(`¿Desactivar ${p.identificador}? Las O/T históricas seguirán visibles.`)) return
    try {
      await productosService.desactivar(p.id)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error desactivando el producto')
    }
  }

  const meta = TIPO_PRODUCTO[tipo]

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16, flexWrap: 'wrap', marginBottom: 4,
        }}>
          <Hdr
            title="Productos"
            sub="Catálogo de flota multiproducto"
            back={() => navigate('/dashboard')}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 6, flexWrap: 'wrap' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: T.sub, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={incluirInactivos}
                onChange={(e) => setIncluirInactivos(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Incluir inactivos
            </label>
            {puedeEditar && (
              <Btn
                label={`+ Nuevo ${meta.label.toLowerCase()}`}
                onClick={() => { setModoAlta(true); setEditando(null) }}
                disabled={modelos.length === 0}
                title={modelos.length === 0 ? `Registra al menos un modelo de tipo ${meta.label} primero` : ''}
              />
            )}
          </div>
        </div>

        {/* Pestañas de tipo */}
        <TabsTipo tipo={tipo} onChange={cambiarTipo} />

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {modelos.length === 0 && puedeEditar && (
          <Card
            padding={14}
            style={{ marginBottom: 16, background: T.aD, borderColor: `${T.amber}40`, borderLeft: `3px solid ${T.amber}` }}
          >
            <div style={{ fontSize: 13, color: T.text }}>
              No hay modelos de tipo <strong>{meta.label}</strong>. Primero crea uno en el{' '}
              <button
                onClick={() => navigate(`/modelos?tipo=${tipo}`)}
                style={{
                  background: 'transparent', border: 'none',
                  color: T.amber, fontWeight: 700, cursor: 'pointer',
                  textDecoration: 'underline', fontFamily: T.font, fontSize: 13,
                }}
              >catálogo de modelos</button>.
            </div>
          </Card>
        )}

        {(modoAlta || editando) && puedeEditar && (
          <FormularioProducto
            tipo={tipo}
            inicial={editando}
            modelos={modelos}
            onCancelar={() => { setModoAlta(false); setEditando(null) }}
            onGuardar={guardar}
          />
        )}

        {loading ? (
          <Spinner label="Cargando productos…" />
        ) : productos.length === 0 ? (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <p style={{ color: T.sub }}>No hay {meta.label.toLowerCase()}s registrados.</p>
          </Card>
        ) : (
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.font }}>
                <thead>
                  <tr style={{ background: T.s2 }}>
                    <Th>Identificador</Th>
                    <Th>Modelo</Th>
                    <Th>N.º serie</Th>
                    <Th>Detalle</Th>
                    <Th align="center">Estado</Th>
                    {puedeEditar && <Th align="right">Acciones</Th>}
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => (
                    <tr key={p.id} style={{
                      borderTop: `1px solid ${T.border}`,
                      opacity: p.activo === false ? 0.55 : 1,
                    }}>
                      <Td>
                        <span style={{ fontFamily: T.mono, fontSize: 14, color: T.text, fontWeight: 600 }}>
                          {p.identificador}
                        </span>
                      </Td>
                      <Td>
                        <div style={{ color: T.text, fontSize: 13 }}>{p.modelo?.nombre || '—'}</div>
                        {p.modelo?.fabricante && (
                          <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{p.modelo.fabricante}</div>
                        )}
                      </Td>
                      <Td>
                        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.sub }}>
                          {p.numeroSerie || '—'}
                        </span>
                      </Td>
                      <Td>
                        <DetalleResumen tipo={tipo} producto={p} />
                      </Td>
                      <Td align="center">
                        {p.activo === false ? (
                          <Pill small label="Inactivo" color={T.sub} bg={T.s1} />
                        ) : (
                          <Pill small label="Activo" color={T.green} bg={T.gD} />
                        )}
                      </Td>
                      {puedeEditar && (
                        <Td align="right">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <BtnSm variant="surface" label="Editar" onClick={() => { setEditando(p); setModoAlta(false) }} />
                            {p.activo !== false && (
                              <BtnSm variant="danger" label="Desactivar" onClick={() => desactivar(p)} />
                            )}
                          </div>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}

// ── Pestañas por tipo ─────────────────────────────────────────────────────────
function TabsTipo({ tipo, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0 20px' }}>
      {TIPOS_PRODUCTO.map((t) => {
        const m = TIPO_PRODUCTO[t]
        const active = tipo === t
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
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
  )
}

// ── Resumen del detalle por tipo en la tabla ──────────────────────────────────
function DetalleResumen({ tipo, producto }) {
  const mono = { fontFamily: T.mono, fontSize: 12, color: T.sub }
  if (tipo === 'aeronave') {
    const d = producto.aeronave || {}
    return (
      <div style={mono}>
        {d.horasTotales ?? 0}h · D:{d.horasMotorDer ?? 0} · I:{d.horasMotorIzq ?? 0}
      </div>
    )
  }
  if (tipo === 'gcs') {
    const d = producto.gcs || {}
    return (
      <div style={mono}>
        Placas: {d.placas || '—'} · {d.odometro ?? 0} km
        {d.vin ? <div style={{ marginTop: 2 }}>VIN: {d.vin}</div> : null}
      </div>
    )
  }
  if (tipo === 'planta') {
    const d = producto.planta || {}
    return <div style={mono}>Horímetro: {d.horimetro ?? 0}h</div>
  }
  if (tipo === 'sensor_inteligencia') {
    const d = producto.sensor_inteligencia || {}
    return (
      <div style={mono}>
        {d.fabricante || '—'} · FW {d.versionFirmware || '—'}
        {d.fechaCalibracion ? (
          <div style={{ marginTop: 2 }}>
            Calib: {new Date(d.fechaCalibracion).toLocaleDateString('es-MX')}
          </div>
        ) : null}
      </div>
    )
  }
  return <span style={{ color: T.dim }}>—</span>
}

function Th({ children, align }) {
  return (
    <th style={{
      padding: '12px 14px', textAlign: align || 'left',
      fontSize: 10, color: T.sub, fontWeight: 600,
      letterSpacing: '0.07em', textTransform: 'uppercase',
    }}>{children}</th>
  )
}

function Td({ children, align }) {
  return (
    <td style={{
      padding: '14px 14px', textAlign: align || 'left',
      verticalAlign: 'middle', color: T.text, fontSize: 13,
    }}>{children}</td>
  )
}

// ── Formulario por tipo ───────────────────────────────────────────────────────
function FormularioProducto({ tipo, inicial, modelos, onCancelar, onGuardar }) {
  const det = inicial?.[tipo] || {}
  const [identificador, setIdentificador] = useState(inicial?.identificador || '')
  const [modeloId, setModeloId] = useState(inicial?.modeloId || inicial?.modelo?.id || '')
  const [numeroSerie, setNumeroSerie] = useState(inicial?.numeroSerie || '')

  // Campos de detalle (uno por tipo)
  const [horasTotales, setHorasTotales] = useState(det.horasTotales ?? 0)
  const [horasMotorDer, setHorasMotorDer] = useState(det.horasMotorDer ?? 0)
  const [horasMotorIzq, setHorasMotorIzq] = useState(det.horasMotorIzq ?? 0)
  const [placas, setPlacas] = useState(det.placas || '')
  const [vin, setVin] = useState(det.vin || '')
  const [odometro, setOdometro] = useState(det.odometro ?? 0)
  const [horimetro, setHorimetro] = useState(det.horimetro ?? 0)
  const [fabricante, setFabricante] = useState(det.fabricante || '')
  const [versionFirmware, setVersionFirmware] = useState(det.versionFirmware || '')
  const [fechaCalibracion, setFechaCalibracion] = useState(
    det.fechaCalibracion ? det.fechaCalibracion.slice(0, 10) : ''
  )

  const [saving, setSaving] = useState(false)
  const meta = TIPO_PRODUCTO[tipo]

  const idLabel = tipo === 'gcs' ? 'Placas / Identificador'
    : tipo === 'aeronave' ? 'Matrícula' : 'Identificador'
  const idPlaceholder = tipo === 'aeronave' ? 'XB-ABC'
    : tipo === 'gcs' ? 'MX-GCS-001'
    : tipo === 'planta' ? 'PE-001' : 'SE-001'

  const construirDetalle = () => {
    if (tipo === 'aeronave') return {
      horasTotales: parseFloat(horasTotales) || 0,
      horasMotorDer: parseFloat(horasMotorDer) || 0,
      horasMotorIzq: parseFloat(horasMotorIzq) || 0,
    }
    if (tipo === 'gcs') return {
      placas: placas.trim().toUpperCase(),
      vin: vin.trim() || null,
      odometro: parseFloat(odometro) || 0,
    }
    if (tipo === 'planta') return { horimetro: parseFloat(horimetro) || 0 }
    if (tipo === 'sensor_inteligencia') return {
      fabricante: fabricante.trim() || null,
      versionFirmware: versionFirmware.trim() || null,
      fechaCalibracion: fechaCalibracion || null,
    }
    return {}
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!identificador.trim() || !modeloId) return
    if (tipo === 'gcs' && !placas.trim()) return
    setSaving(true)
    try {
      await onGuardar({
        modeloId,
        identificador: identificador.trim().toUpperCase(),
        numeroSerie: numeroSerie.trim() || null,
        detalle: construirDetalle(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padding={20} style={{ marginBottom: 18, borderLeft: `3px solid ${meta.c}` }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
          {inicial ? `Editar ${inicial.identificador}` : `${meta.icon} Nuevo ${meta.label.toLowerCase()}`}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Field label={idLabel} required value={identificador} onChange={(v) => setIdentificador(v.toUpperCase())} placeholder={idPlaceholder} mono />
          <FieldSelect
            label="Modelo"
            required
            value={modeloId}
            onChange={setModeloId}
            placeholder="-- Selecciona un modelo --"
            options={modelos.map(m => ({ value: m.id, label: `${m.nombre}${m.fabricante ? ` · ${m.fabricante}` : ''}` }))}
          />
        </div>

        <Field label="Número de serie" value={numeroSerie} onChange={setNumeroSerie} placeholder="Ej. C172S-12345" mono />

        {/* Campos específicos del tipo */}
        {tipo === 'aeronave' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Field label="Horas totales" type="number" value={horasTotales} onChange={setHorasTotales} mono inputProps={{ step: '0.1', min: '0' }} />
            <Field label="Horas motor der." type="number" value={horasMotorDer} onChange={setHorasMotorDer} mono inputProps={{ step: '0.1', min: '0' }} />
            <Field label="Horas motor izq." type="number" value={horasMotorIzq} onChange={setHorasMotorIzq} mono inputProps={{ step: '0.1', min: '0' }} />
          </div>
        )}
        {tipo === 'gcs' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Placas" required value={placas} onChange={(v) => setPlacas(v.toUpperCase())} placeholder="MX-GCS-001" mono />
            <Field label="VIN" value={vin} onChange={setVin} placeholder="1FT8W3DT5KEE12345" mono />
            <Field label="Odómetro (km)" type="number" value={odometro} onChange={setOdometro} mono inputProps={{ step: '1', min: '0' }} />
          </div>
        )}
        {tipo === 'planta' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Horímetro (h)" type="number" value={horimetro} onChange={setHorimetro} mono inputProps={{ step: '0.1', min: '0' }} />
          </div>
        )}
        {tipo === 'sensor_inteligencia' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Field label="Fabricante" value={fabricante} onChange={setFabricante} placeholder="AutoSentinel" />
            <Field label="Versión firmware" value={versionFirmware} onChange={setVersionFirmware} placeholder="3.2.1" mono />
            <Field label="Fecha de calibración" type="date" value={fechaCalibracion} onChange={setFechaCalibracion} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn variant="ghost" label="Cancelar" onClick={onCancelar} style={{ flex: 1 }} />
          <Btn
            type="submit"
            label={saving ? 'Guardando…' : (inicial ? 'Guardar cambios' : `Registrar ${meta.label.toLowerCase()}`)}
            disabled={saving || !identificador.trim() || !modeloId || (tipo === 'gcs' && !placas.trim())}
            style={{ flex: 1 }}
          />
        </div>
      </form>
    </Card>
  )
}
