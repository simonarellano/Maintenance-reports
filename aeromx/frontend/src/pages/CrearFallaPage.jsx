import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Header } from '../components/Header'
import { formatosService } from '../api/formatosService'
import { productosService } from '../api/productosService'
import { categoriasFallaService } from '../api/categoriasFallaService'
import { fallasService } from '../api/fallasService'
import { useAuthStore } from '../store/authStore'
import { T, TIPO_PRODUCTO, TIPOS_PRODUCTO, SEVERIDADES, ORIGENES_FALLA } from '../tokens/design'
import {
  Btn, Card, ErrorBanner, Field, FieldSelect, FieldTextarea, Hdr, Spinner,
} from '../components/ui'

// Los orígenes disponibles para creación manual (excluir 'mantenimiento')
const ORIGENES_MANUAL = ORIGENES_FALLA.filter((o) => o.value !== 'mantenimiento')

export default function CrearFallaPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [formatos, setFormatos] = useState([])
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [cargandoTipo, setCargandoTipo] = useState(false)
  const [error, setError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  // Fotos seleccionadas para subir tras crear
  const [fotosSeleccionadas, setFotosSeleccionadas] = useState([])
  const fileInputRef = useRef(null)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      tipoProducto: 'aeronave',
      formatoId: '',
      productoId: '',
      categoriaId: '',
      severidad: '',
      origen: '',
      componente: '',
      titulo: '',
      descripcion: '',
    },
  })

  const tipoProducto = watch('tipoProducto')
  const formatoId = watch('formatoId')

  // Al cambiar el formato, preseleccionar la categoría del formato si tiene una
  useEffect(() => {
    if (!formatoId) return
    const formato = formatos.find((f) => f.id === formatoId)
    if (formato?.categoriaFalla?.id) {
      setValue('categoriaId', formato.categoriaFalla.id)
    } else if (formato?.categoriaFallaId) {
      setValue('categoriaId', formato.categoriaFallaId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatoId, formatos])

  // Al cambiar el tipo, recargar formatos y productos
  useEffect(() => {
    if (loading) return
    cargarPorTipo(tipoProducto)
    setValue('formatoId', '')
    setValue('productoId', '')
    setValue('categoriaId', '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoProducto])

  useEffect(() => { cargarInicial() }, [])

  const cargarInicial = async () => {
    try {
      const [categoriasRes] = await Promise.all([
        categoriasFallaService.listar({ activo: true }),
        cargarPorTipo('aeronave'),
      ])
      setCategorias(categoriasRes.data || [])
    } catch (err) {
      setError('Error cargando datos iniciales')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const cargarPorTipo = async (tipo) => {
    setCargandoTipo(true)
    try {
      const [formatosRes, productosRes] = await Promise.all([
        formatosService.listar({ tipoProducto: tipo, tipoFormato: 'falla' }),
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
        productoId: data.productoId,
        formatoId: data.formatoId,
        categoriaId: data.categoriaId,
        severidad: data.severidad,
        origen: data.origen,
        componente: data.componente?.trim() || undefined,
        titulo: data.titulo?.trim(),
        descripcion: data.descripcion?.trim() || undefined,
      }

      const { data: falla } = await fallasService.crear(payload)

      // Subir fotos seleccionadas una a una
      if (fotosSeleccionadas.length > 0) {
        for (const file of fotosSeleccionadas) {
          try {
            await fallasService.subirFoto(falla.id, file)
          } catch (fotoErr) {
            console.error('Error subiendo foto:', fotoErr)
            // No bloquear la navegación si falla una foto
          }
        }
      }

      navigate(`/fallas/${falla.id}`)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Error creando reporte de falla')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleFotosChange = (e) => {
    const files = Array.from(e.target.files || [])
    setFotosSeleccionadas((prev) => [...prev, ...files])
    // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
    e.target.value = ''
  }

  const quitarFoto = (idx) => {
    setFotosSeleccionadas((prev) => prev.filter((_, i) => i !== idx))
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg }}>
        <Header />
        <Spinner label="Cargando datos…" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px 60px' }}>
        <Hdr
          title="Nuevo Reporte de Falla"
          sub="Registro manual · Detección en campo"
          back={() => navigate('/fallas')}
        />
        <p style={{ color: T.sub, fontSize: 12, marginTop: -8, marginBottom: 24, lineHeight: 1.55 }}>
          Completa los datos de la falla detectada. Una vez creado el reporte,
          podrás asignar un responsable y hacer seguimiento desde la lista de fallas.
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

          {/* Formato y producto */}
          <Card padding={20}>
            <SectionTitle>Formato y {TIPO_PRODUCTO[tipoProducto].label.toLowerCase()}</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FieldSelect
                label="Formato de falla"
                required
                disabled={cargandoTipo}
                register={register('formatoId', { required: 'Selecciona un formato de falla' })}
                error={errors.formatoId?.message}
                placeholder={cargandoTipo ? 'Cargando…' : '-- Selecciona un formato de falla --'}
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
                ⚠️ No hay {formatos.length === 0 ? 'formatos de falla' : 'productos'} registrados para este tipo.
                Da de alta uno en los catálogos antes de crear el reporte.
              </p>
            )}
          </Card>

          {/* Clasificación de la falla */}
          <Card padding={20}>
            <SectionTitle>Clasificación de la falla</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <FieldSelect
                  label="Categoría"
                  required
                  register={register('categoriaId', { required: 'Selecciona una categoría' })}
                  error={errors.categoriaId?.message}
                  placeholder="-- Selecciona categoría --"
                  options={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
                />
                <FieldSelect
                  label="Severidad"
                  required
                  register={register('severidad', { required: 'Selecciona la severidad' })}
                  error={errors.severidad?.message}
                  placeholder="-- Selecciona severidad --"
                  options={SEVERIDADES.map((s) => ({ value: s.value, label: s.label }))}
                />
                <FieldSelect
                  label="Origen"
                  required
                  register={register('origen', { required: 'Selecciona el origen' })}
                  error={errors.origen?.message}
                  placeholder="-- Selecciona origen --"
                  options={ORIGENES_MANUAL.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
              <Field
                label="Componente afectado"
                placeholder="Ej. Motor izquierdo · Tren principal · Sensor de presión"
                register={register('componente')}
              />
              <p style={{ fontSize: 11, color: T.sub, marginTop: -6, lineHeight: 1.5 }}>
                La categoría se prellenó a partir del formato elegido; puedes cambiarla si es necesario.
              </p>
            </div>
          </Card>

          {/* Descripción de la falla */}
          <Card padding={20}>
            <SectionTitle>Descripción de la falla</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field
                label="Título"
                required
                placeholder="Resumen breve de la falla detectada"
                register={register('titulo', { required: 'Ingresa un título para el reporte' })}
                error={errors.titulo?.message}
              />
              <FieldTextarea
                label="Descripción detallada"
                required
                placeholder="Describe la falla: síntomas observados, condiciones en que se detectó, impacto operativo…"
                rows={4}
                register={register('descripcion', { required: 'Ingresa una descripción' })}
                error={errors.descripcion?.message}
              />
            </div>
          </Card>

          {/* Evidencia fotográfica */}
          <Card padding={20}>
            <SectionTitle>Evidencia fotográfica (opcional)</SectionTitle>
            <p style={{ fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.5 }}>
              Las fotos se subirán automáticamente después de crear el reporte. También puedes
              agregarlas desde la pantalla de detalle de la falla.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFotosChange}
                style={{ display: 'none' }}
              />
              <Btn
                variant="surface"
                label="+ Agregar fotos"
                onClick={() => fileInputRef.current?.click()}
                style={{ alignSelf: 'flex-start', height: 38, fontSize: 13 }}
              />
              {fotosSeleccionadas.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {fotosSeleccionadas.map((file, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: T.s2, border: `1px solid ${T.border}`,
                        borderRadius: 10, padding: '6px 10px',
                        fontSize: 12, color: T.text,
                        maxWidth: 220,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>🖼</span>
                      <span style={{
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarFoto(idx)}
                        title="Quitar foto"
                        style={{
                          background: 'none', border: 'none',
                          color: T.sub, cursor: 'pointer',
                          fontSize: 14, lineHeight: 1, padding: 2,
                          fontFamily: T.font,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <Btn
              variant="ghost"
              label="Cancelar"
              onClick={() => navigate('/fallas')}
              style={{ flex: 1 }}
            />
            <Btn
              type="submit"
              label={submitLoading ? 'Creando…' : 'Crear Reporte →'}
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
