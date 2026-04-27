import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Header } from '../components/Header'
import { formatosService } from '../api/formatosService'
import { aeronavesService } from '../api/aeronavesService'
import { ordenesService } from '../api/ordenesService'
import { usuariosService } from '../api/usuariosService'
import { useAuthStore } from '../store/authStore'
import { T } from '../tokens/design'
import {
  Btn, Card, ErrorBanner, Field, FieldSelect, Hdr, Spinner,
} from '../components/ui'

export default function CrearOTPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const esSupervisor = user?.rol === 'supervisor'
  const [formatos, setFormatos] = useState([])
  const [aeronaves, setAeronaves] = useState([])
  const [supervisores, setSupervisores] = useState([])
  const [tecnicos, setTecnicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  const hoyISO = new Date().toISOString().slice(0, 10)
  const hoyLegible = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      cliente: '',
      ordenServicio: '',
      lugarMantenimiento: '',
      formatoId: '',
      aeronaveId: '',
      supervisorId: '',
      tecnicoId: '',
      horasAlMomento: '',
      horasMotorDer: '',
      horasMotorIzq: '',
    }
  })

  const aeronaveSeleccionada = watch('aeronaveId')

  useEffect(() => {
    cargarDatos()
  }, [])

  useEffect(() => {
    if (!aeronaveSeleccionada) return
    const a = aeronaves.find(x => x.id === aeronaveSeleccionada)
    if (a) {
      setValue('horasAlMomento', a.horasTotales ?? 0)
      setValue('horasMotorDer', a.horasMotorDer ?? 0)
      setValue('horasMotorIzq', a.horasMotorIzq ?? 0)
    }
  }, [aeronaveSeleccionada, aeronaves, setValue])

  const cargarDatos = async () => {
    try {
      const base = [
        formatosService.listar(),
        aeronavesService.listar(),
        usuariosService.listar({ rol: 'supervisor', activo: true }),
      ]
      const requests = esSupervisor
        ? [...base, usuariosService.listar({ activo: true })]
        : base
      const results = await Promise.all(requests)
      setFormatos(results[0].data || [])
      setAeronaves(results[1].data || [])
      setSupervisores(results[2].data || [])
      if (esSupervisor && results[3]) {
        setTecnicos((results[3].data || []).filter(
          u => u.rol === 'tecnico' || u.rol === 'ingeniero',
        ))
      }
    } catch (err) {
      setError('Error cargando datos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data) => {
    setSubmitLoading(true)
    try {
      const payload = {
        ...data,
        supervisorId: data.supervisorId || undefined,
        tecnicoId: (esSupervisor && data.tecnicoId) ? data.tecnicoId : undefined,
        lugarMantenimiento: data.lugarMantenimiento?.trim() || undefined,
        horasAlMomento: data.horasAlMomento === '' ? 0 : parseFloat(data.horasAlMomento),
        horasMotorDer:  data.horasMotorDer  === '' ? 0 : parseFloat(data.horasMotorDer),
        horasMotorIzq:  data.horasMotorIzq  === '' ? 0 : parseFloat(data.horasMotorIzq),
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
          La recepción de la aeronave y el inicio del mantenimiento se registran como hitos posteriores
          dentro de la orden.
        </p>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tipo de mantenimiento */}
          <Card padding={20}>
            <SectionTitle>Tipo de mantenimiento</SectionTitle>
            <FieldSelect
              label="Formato"
              required
              register={register('formatoId', { required: 'Selecciona un formato' })}
              error={errors.formatoId?.message}
              placeholder="-- Selecciona un formato --"
              options={formatos.map(f => ({ value: f.id, label: f.nombre }))}
            />
          </Card>

          {/* Aeronave + horas */}
          <Card padding={20}>
            <SectionTitle>Aeronave y horas</SectionTitle>
            <FieldSelect
              label="Aeronave"
              required
              register={register('aeronaveId', { required: 'Selecciona una aeronave' })}
              error={errors.aeronaveId?.message}
              placeholder="-- Selecciona una aeronave --"
              options={aeronaves.map(a => ({
                value: a.id,
                label: `${a.matricula} (${a.modelo?.nombre || 'Sin modelo'})`,
              }))}
            />
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12, marginTop: 14,
            }}>
              <Field
                label="Horas totales (celda)"
                type="number"
                placeholder="0.0"
                register={register('horasAlMomento')}
                mono
                inputProps={{ step: '0.1', min: '0' }}
              />
              <Field
                label="Horas motor derecho"
                type="number"
                placeholder="0.0"
                register={register('horasMotorDer')}
                mono
                inputProps={{ step: '0.1', min: '0' }}
              />
              <Field
                label="Horas motor izquierdo"
                type="number"
                placeholder="0.0"
                register={register('horasMotorIzq')}
                mono
                inputProps={{ step: '0.1', min: '0' }}
              />
            </div>
            <p style={{ fontSize: 11, color: T.sub, marginTop: 10, lineHeight: 1.5 }}>
              Al seleccionar la aeronave se precargan sus horas actuales. Puedes ajustarlas antes de crear la orden.
            </p>
          </Card>

          {/* Asignación */}
          <Card padding={20}>
            <SectionTitle>Asignación</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {esSupervisor && (
                <div>
                  <FieldSelect
                    label="Técnico / Ingeniero responsable"
                    register={register('tecnicoId')}
                    placeholder="-- Asignarme a mí --"
                    options={tecnicos.map(t => ({
                      value: t.id,
                      label: `${t.nombre} · ${t.rol}${t.licenciaNum ? ` · ${t.licenciaNum}` : ''}`,
                    }))}
                  />
                  <p style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>
                    Solo el técnico asignado podrá capturar los resultados de la inspección.
                  </p>
                </div>
              )}
              <div>
                <FieldSelect
                  label="Supervisor asignado"
                  register={register('supervisorId')}
                  placeholder="-- Sin asignar --"
                  options={supervisores.map(s => ({
                    value: s.id,
                    label: `${s.nombre}${s.licenciaNum ? ` · Lic. ${s.licenciaNum}` : ''}`,
                  }))}
                />
                <p style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>
                  Puedes dejarlo vacío y asignarlo después al momento del cierre.
                </p>
              </div>
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
                placeholder="Ej. Hangar 3 · Aeropuerto Toluca · Rampa Norte"
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
