import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Header } from '../components/Header'
import { formatosService } from '../api/formatosService'
import { aeronavesService } from '../api/aeronavesService'
import { ordenesService } from '../api/ordenesService'
import { usuariosService } from '../api/usuariosService'
import { useAuthStore } from '../store/authStore'

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

  // Auto-prellenar horas con las de la aeronave al seleccionar
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Cargando...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Volver
        </button>

        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Nueva Orden de Mantenimiento</h2>
              <p className="text-sm text-gray-500 mt-1 capitalize">
                📅 Fecha de creación: <span className="font-semibold">{hoyLegible}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                La recepción de la aeronave y el inicio del mantenimiento se registran como hitos
                posteriores dentro de la orden.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm">
              <div className="font-semibold">Hoy: {hoyISO}</div>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* ─── Datos del formato ─── */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                Tipo de mantenimiento
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Formato <span className="text-red-600">*</span>
                </label>
                <select
                  {...register('formatoId', { required: 'Selecciona un formato' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Selecciona un formato --</option>
                  {formatos.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </select>
                {errors.formatoId && (
                  <p className="text-red-500 text-sm mt-1">{errors.formatoId.message}</p>
                )}
              </div>
            </div>

            {/* ─── Aeronave + horas ─── */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                Aeronave y horas
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aeronave <span className="text-red-600">*</span>
                </label>
                <select
                  {...register('aeronaveId', { required: 'Selecciona una aeronave' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Selecciona una aeronave --</option>
                  {aeronaves.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.matricula} ({a.modelo?.nombre})
                    </option>
                  ))}
                </select>
                {errors.aeronaveId && (
                  <p className="text-red-500 text-sm mt-1">{errors.aeronaveId.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horas totales (celda)
                  </label>
                  <input
                    type="number" step="0.1" min="0"
                    {...register('horasAlMomento')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horas Motor Derecho
                  </label>
                  <input
                    type="number" step="0.1" min="0"
                    {...register('horasMotorDer')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Horas Motor Izquierdo
                  </label>
                  <input
                    type="number" step="0.1" min="0"
                    {...register('horasMotorIzq')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.0"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Al seleccionar la aeronave se precargan sus horas actuales. Puedes ajustarlas antes de crear la orden.
              </p>
            </div>

            {/* ─── Asignación ─── */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                Asignación
              </h3>

              {esSupervisor && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Técnico / Ingeniero responsable
                  </label>
                  <select
                    {...register('tecnicoId')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Asignarme a mí --</option>
                    {tecnicos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} · {t.rol}{t.licenciaNum ? ` · ${t.licenciaNum}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Solo el técnico asignado podrá capturar los resultados de la inspección.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supervisor asignado
                </label>
                <select
                  {...register('supervisorId')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Sin asignar --</option>
                  {supervisores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}{s.licenciaNum ? ` · Lic. ${s.licenciaNum}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Puedes dejarlo vacío y asignarlo después al momento del cierre.
                </p>
              </div>
            </div>

            {/* ─── Datos de servicio ─── */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                Datos del servicio
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cliente
                  </label>
                  <input
                    type="text"
                    {...register('cliente')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Orden de Servicio
                  </label>
                  <input
                    type="text"
                    {...register('ordenServicio')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Número de orden de servicio"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitLoading}
                className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition duration-200"
              >
                {submitLoading ? 'Creando...' : 'Crear Orden'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
