import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Header } from '../components/Header'
import { formatosService } from '../api/formatosService'
import { productosService } from '../api/productosService'
import { ordenesService } from '../api/ordenesService'
import { usuariosService } from '../api/usuariosService'
import { useAuthStore } from '../store/authStore'
import { T, TIPO_PRODUCTO, TIPOS_PRODUCTO, ROL_LABELS } from '../tokens/design'
import {
  Btn, Card, ErrorBanner, Field, FieldSelect, Hdr, Spinner,
} from '../components/ui'

const ROLES_SOPORTE = ['tecnico_soporte', 'ingeniero_soporte']

// Requisitos de personal por tipo de producto (espejo del backend).
// 'obligatorio' | 'opcional' | 'prohibido'. soporte y gerente siempre obligatorios.
const REQUISITOS_PERSONAL = {
  aeronave:            { mecanico: 'obligatorio', piloto: 'obligatorio', operador: 'prohibido'   },
  gcs:                 { mecanico: 'opcional',    piloto: 'prohibido',   operador: 'obligatorio' },
  planta:              { mecanico: 'obligatorio', piloto: 'prohibido',   operador: 'prohibido'   },
  sensor_inteligencia: { mecanico: 'prohibido',   piloto: 'prohibido',   operador: 'prohibido'   },
}

export default function CrearOTPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const puedeCrear = user?.superusuario === true
    || user?.rol === 'gerente_soporte'
    || user?.rol === 'ingeniero_soporte'

  const [usuarios, setUsuarios] = useState([])
  const [formatos, setFormatos] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [cargandoTipo, setCargandoTipo] = useState(false)
  const [error, setError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  const hoyISO = new Date().toISOString().slice(0, 10)
  const hoyLegible = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      tipoProducto: 'aeronave',
      formatoId: '',
      productoId: '',
      soporteId: '',
      ingenieroAuxiliarId: '',
      mecanicoId: '',
      gerenteId: '',
      pilotoId: '',
      operadorId: '',
      cliente: '',
      ordenServicio: '',
      lugarMantenimiento: '',
    }
  })

  const tipoProducto = watch('tipoProducto')
  const soporteId = watch('soporteId')
  const esAeronave = tipoProducto === 'aeronave'
  const req = REQUISITOS_PERSONAL[tipoProducto] || REQUISITOS_PERSONAL.aeronave
  const muestraMecanico = req.mecanico !== 'prohibido'
  const mecanicoObligatorio = req.mecanico === 'obligatorio'
  const muestraOperador = req.operador !== 'prohibido'

  // ── Selectores derivados de la lista de usuarios ──
  const soportes  = usuarios.filter((u) => ROLES_SOPORTE.includes(u.rol))
  const ingenieros = usuarios.filter((u) => u.rol === 'ingeniero_soporte')
  const mecanicos  = usuarios.filter((u) => u.rol === 'mecanico')
  const gerentes   = usuarios.filter((u) => u.rol === 'gerente_soporte')
  const pilotos    = usuarios.filter((u) => u.rol === 'piloto')
  const operadores = usuarios.filter((u) => u.rol === 'operador')

  const soporteEsTecnico = soportes.find((u) => u.id === soporteId)?.rol === 'tecnico_soporte'

  useEffect(() => { cargarInicial() }, [])

  // Al cambiar el tipo de producto, recargar formatos y productos del tipo.
  useEffect(() => {
    if (loading) return
    cargarPorTipo(tipoProducto)
    setValue('formatoId', '')
    setValue('productoId', '')
    if (req.piloto === 'prohibido') setValue('pilotoId', '')
    if (req.operador === 'prohibido') setValue('operadorId', '')
    if (req.mecanico === 'prohibido') setValue('mecanicoId', '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoProducto])

  // Si el soporte deja de ser técnico, limpiar el ingeniero auxiliar.
  useEffect(() => {
    if (!soporteEsTecnico) setValue('ingenieroAuxiliarId', '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soporteEsTecnico])

  const cargarInicial = async () => {
    try {
      const [usuariosRes] = await Promise.all([
        usuariosService.listar({ activo: true }),
        cargarPorTipo('aeronave'),
      ])
      setUsuarios(usuariosRes.data || [])
    } catch (err) {
      setError('Error cargando datos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const cargarPorTipo = async (tipo) => {
    setCargandoTipo(true)
    try {
      const [formatosRes, productosRes] = await Promise.all([
        formatosService.listar({ tipoProducto: tipo }),
        productosService.listar({ tipoProducto: tipo, activo: true }),
      ])
      setFormatos(formatosRes.data || [])
      setProductos(productosRes.data || [])
    } catch (err) {
      setError('Error cargando formatos y productos del tipo seleccionado')
      console.error(err)
    } finally {
      setCargandoTipo(false)
    }
  }

  const onSubmit = async (data) => {
    setSubmitLoading(true)
    setError('')
    try {
      const payload = {
        formatoId: data.formatoId,
        productoId: data.productoId,
        soporteId: data.soporteId,
        ingenieroAuxiliarId: (soporteEsTecnico && data.ingenieroAuxiliarId) ? data.ingenieroAuxiliarId : undefined,
        mecanicoId: (muestraMecanico && data.mecanicoId) ? data.mecanicoId : undefined,
        gerenteId: data.gerenteId,
        pilotoId: req.piloto !== 'prohibido' ? data.pilotoId : undefined,
        operadorId: muestraOperador ? data.operadorId : undefined,
        cliente: data.cliente?.trim() || undefined,
        ordenServicio: data.ordenServicio?.trim() || undefined,
        lugarMantenimiento: data.lugarMantenimiento?.trim() || undefined,
      }
      const response = await ordenesService.crear(payload)
      navigate(`/ordenes/${response.data.id}/inspeccion`)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Error creando orden')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg }}>
        <Header />
        <Spinner label="Cargando datos…" />
      </div>
    )
  }

  if (!puedeCrear) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg }}>
        <Header />
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
          <Card padding={32}>
            <p style={{ color: T.text, fontWeight: 600, marginBottom: 6 }}>Acción no permitida</p>
            <p style={{ color: T.sub, fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
              Solo un gerente o ingeniero de soporte puede crear órdenes de mantenimiento.
            </p>
            <Btn label="Volver al Dashboard" onClick={() => navigate('/dashboard')} />
          </Card>
        </main>
      </div>
    )
  }

  const opcionUsuario = (u) => ({
    value: u.id,
    label: `${u.nombre} · ${ROL_LABELS[u.rol] || u.rol}${u.licenciaNum ? ` · ${u.licenciaNum}` : ''}`,
  })

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px 60px' }}>
        <Hdr
          title="Nueva Orden de Mantenimiento"
          sub="Paso inicial · Datos generales"
          back={() => navigate('/dashboard')}
          right={
            <div style={{
              background: T.cD, border: `1px solid ${T.cyan}30`,
              borderRadius: 10, padding: '8px 12px',
              fontFamily: T.mono, fontSize: 12, color: T.cyan,
            }}>
              {hoyISO}
            </div>
          }
        />
        <p style={{ color: T.sub, fontSize: 13, marginTop: -8, marginBottom: 20, textTransform: 'capitalize' }}>
          📅 Fecha de creación: <span style={{ color: T.text, fontWeight: 600 }}>{hoyLegible}</span>
        </p>
        <p style={{ color: T.sub, fontSize: 12, marginBottom: 24, lineHeight: 1.55 }}>
          La recepción del producto y la lectura del medidor se registran como hitos posteriores,
          al iniciar el mantenimiento dentro de la orden.
        </p>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tipo de producto */}
          <Card padding={20}>
            <SectionTitle>Tipo de producto</SectionTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TIPOS_PRODUCTO.map((tipo) => {
                const meta = TIPO_PRODUCTO[tipo]
                const active = tipoProducto === tipo
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setValue('tipoProducto', tipo)}
                    style={{
                      flex: 1, minWidth: 120,
                      padding: '12px 14px', borderRadius: 12,
                      background: active ? meta.bg : T.s2,
                      border: `1px solid ${active ? meta.c : T.border}`,
                      color: active ? meta.c : T.sub,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      fontFamily: T.font,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{meta.icon}</span> {meta.label}
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Formato + producto */}
          <Card padding={20}>
            <SectionTitle>Formato y {TIPO_PRODUCTO[tipoProducto].label.toLowerCase()}</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FieldSelect
                label="Formato"
                required
                disabled={cargandoTipo}
                register={register('formatoId', { required: 'Selecciona un formato' })}
                error={errors.formatoId?.message}
                placeholder={cargandoTipo ? 'Cargando…' : '-- Selecciona un formato --'}
                options={formatos.map((f) => ({ value: f.id, label: `${f.nombre} · v${f.version}` }))}
              />
              <FieldSelect
                label={TIPO_PRODUCTO[tipoProducto].label}
                required
                disabled={cargandoTipo}
                register={register('productoId', { required: 'Selecciona un producto' })}
                error={errors.productoId?.message}
                placeholder={cargandoTipo ? 'Cargando…' : `-- Selecciona ${TIPO_PRODUCTO[tipoProducto].label.toLowerCase()} --`}
                options={productos.map((p) => ({
                  value: p.id,
                  label: `${p.identificador} (${p.modelo?.nombre || 'Sin modelo'})`,
                }))}
              />
            </div>
            {!cargandoTipo && (formatos.length === 0 || productos.length === 0) && (
              <p style={{ fontSize: 11, color: T.amber, marginTop: 10, lineHeight: 1.5 }}>
                ⚠️ No hay {formatos.length === 0 ? 'formatos' : 'productos'} registrados para este tipo.
                Da de alta uno en los catálogos antes de crear la orden.
              </p>
            )}
            <p style={{ fontSize: 11, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
              Las lecturas del medidor (horas, odómetro u horímetro) se capturan al iniciar el mantenimiento.
            </p>
          </Card>

          {/* Asignación de responsables */}
          <Card padding={20}>
            <SectionTitle>Asignación de responsables</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <FieldSelect
                  label="Soporte (técnico o ingeniero)"
                  required
                  register={register('soporteId', { required: 'Selecciona un soporte' })}
                  error={errors.soporteId?.message}
                  placeholder="-- Selecciona soporte --"
                  options={soportes.map(opcionUsuario)}
                />
                <p style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>
                  Ejecuta y firma el mantenimiento. Puede ser técnico o ingeniero de soporte.
                </p>
              </div>

              {soporteEsTecnico && (
                <div>
                  <FieldSelect
                    label="Ingeniero auxiliar (opcional)"
                    register={register('ingenieroAuxiliarId')}
                    placeholder="-- Sin ingeniero auxiliar --"
                    options={ingenieros.map(opcionUsuario)}
                  />
                  <p style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>
                    Solo aplica cuando el soporte es técnico. El auxiliar comparte permisos de ejecución.
                  </p>
                </div>
              )}

              {muestraMecanico && (
                <div>
                  <FieldSelect
                    label={mecanicoObligatorio ? 'Mecánico' : 'Mecánico (opcional)'}
                    required={mecanicoObligatorio}
                    register={register('mecanicoId', {
                      validate: (v) => !mecanicoObligatorio || !!v || 'Selecciona un mecánico',
                    })}
                    error={errors.mecanicoId?.message}
                    placeholder={mecanicoObligatorio ? '-- Selecciona mecánico --' : '-- Sin mecánico --'}
                    options={mecanicos.map(opcionUsuario)}
                  />
                  {!mecanicoObligatorio && (
                    <p style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>
                      Opcional para este tipo de producto.
                    </p>
                  )}
                </div>
              )}

              {muestraOperador && (
                <div>
                  <FieldSelect
                    label="Operador"
                    required
                    register={register('operadorId', {
                      validate: (v) => !muestraOperador || !!v || 'Selecciona un operador',
                    })}
                    error={errors.operadorId?.message}
                    placeholder="-- Selecciona operador --"
                    options={operadores.map(opcionUsuario)}
                  />
                  <p style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>
                    Obligatorio para GCS. El operador firma el cierre junto con soporte y gerente.
                  </p>
                </div>
              )}

              <FieldSelect
                label="Gerente de soporte"
                required
                register={register('gerenteId', { required: 'Selecciona un gerente' })}
                error={errors.gerenteId?.message}
                placeholder="-- Selecciona gerente --"
                options={gerentes.map(opcionUsuario)}
              />

              {esAeronave && (
                <div>
                  <FieldSelect
                    label="Piloto"
                    required
                    register={register('pilotoId', {
                      validate: (v) => !esAeronave || !!v || 'Selecciona un piloto',
                    })}
                    error={errors.pilotoId?.message}
                    placeholder="-- Selecciona piloto --"
                    options={pilotos.map(opcionUsuario)}
                  />
                  <p style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>
                    Obligatorio para aeronaves. El piloto firma el cierre junto con soporte y gerente.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Datos del servicio */}
          <Card padding={20}>
            <SectionTitle>Datos del servicio</SectionTitle>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
            }}>
              <Field
                label="Cliente"
                placeholder="Nombre del cliente"
                register={register('cliente')}
              />
              <Field
                label="Orden de servicio"
                placeholder="Número de orden de servicio"
                register={register('ordenServicio')}
                mono
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <Field
                label="📍 Lugar donde se realiza el mantenimiento"
                placeholder="Ej. Hangar 3 · Base operativa · Rampa Norte"
                register={register('lugarMantenimiento')}
              />
              <p style={{ fontSize: 11, color: T.sub, marginTop: 6, lineHeight: 1.5 }}>
                Hangar, base operativa, rampa o ubicación específica donde se ejecutará el servicio.
              </p>
            </div>
          </Card>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <Btn
              variant="ghost"
              label="Cancelar"
              onClick={() => navigate('/dashboard')}
              style={{ flex: 1 }}
            />
            <Btn
              type="submit"
              label={submitLoading ? 'Creando…' : 'Crear Orden →'}
              disabled={submitLoading}
              style={{ flex: 1 }}
            />
          </div>
        </form>
      </main>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, color: T.sub, letterSpacing: '0.08em',
      textTransform: 'uppercase', fontWeight: 600,
      marginBottom: 14, fontFamily: T.font,
    }}>{children}</div>
  )
}
