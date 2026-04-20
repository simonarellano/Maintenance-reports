import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Header } from '../components/Header'
import { ordenesService } from '../api/ordenesService'
import { useAuthStore } from '../store/authStore'

export default function CierreOTPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [orden, setOrden] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [cierre, setCierre] = useState(null)
  const [step, setStep] = useState('resumen') // 'resumen' o 'firma'

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      seEncontroDefecto: false,
      refDocCorrectivo: ''
    }
  })

  useEffect(() => {
    cargarOrden()
  }, [id])

  const cargarOrden = async () => {
    try {
      const response = await ordenesService.obtener(id)
      setOrden(response.data)
      if (response.data.cierre) {
        setCierre(response.data.cierre)
      }
      setError('')
    } catch (err) {
      setError('Error cargando orden')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const onSubmitCierre = async (data) => {
    setSubmitLoading(true)
    try {
      const response = await ordenesService.crearCierre(id, data)
      setCierre(response.data)
      setStep('firma')
    } catch (err) {
      setError(err.response?.data?.message || 'Error creando cierre')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleFirmar = async () => {
    setSubmitLoading(true)
    try {
      const firmaData = {
        tipo: user.rol
      }
      await ordenesService.firmarCierre(id, firmaData)
      cargarOrden()
      // Mostrar éxito y opción de descargar PDF
      setTimeout(() => {
        descargarPDF()
      }, 1000)
    } catch (err) {
      setError(err.response?.data?.message || 'Error firmando cierre')
    } finally {
      setSubmitLoading(false)
    }
  }

  const descargarPDF = async () => {
    try {
      const response = await ordenesService.descargarPDF(id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `OT-${orden.numeroOt}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
    } catch (err) {
      console.error('Error descargando PDF:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Cargando orden...</p>
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
          onClick={() => navigate(`/ordenes/${id}/inspeccion`)}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Volver
        </button>

        <div className="max-w-2xl mx-auto">
          {/* Indicador de paso */}
          <div className="flex gap-4 mb-8">
            <div
              className={`flex-1 py-3 px-4 rounded-lg text-center font-semibold ${
                step === 'resumen'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-300 text-gray-700'
              }`}
            >
              Cierre
            </div>
            <div
              className={`flex-1 py-3 px-4 rounded-lg text-center font-semibold ${
                step === 'firma'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-300 text-gray-700'
              }`}
            >
              Firma
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {step === 'resumen' && (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">
                Cierre de Orden O/T {orden?.numeroOt}
              </h2>

              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Total de puntos:</strong> {orden?.resultados?.length}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Puntos completados:</strong> {orden?.resultados?.filter((r) => r.completado).length}
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmitCierre)} className="space-y-6">
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('seEncontroDefecto')}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 font-medium">
                      ¿Se encontró defecto?
                    </span>
                  </label>
                </div>

                {/* Campo condicionalmente visible */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Referencia de Documento Correctivo
                  </label>
                  <input
                    type="text"
                    {...register('refDocCorrectivo')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Orden Correctiva #12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones Generales
                  </label>
                  <textarea
                    {...register('observacionesGenerales')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="4"
                    placeholder="Adiciona observaciones de la inspección"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => navigate(`/ordenes/${id}/inspeccion`)}
                    className="flex-1 px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition"
                  >
                    {submitLoading ? 'Guardando...' : 'Continuar a Firma →'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 'firma' && (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">
                Firma Digital
              </h2>

              <div className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-gray-700 mb-2">
                    <strong>Técnico/Ingeniero:</strong> {orden?.tecnico?.nombre}
                  </p>
                  <p className="text-gray-700">
                    <strong>Supervisor:</strong> {orden?.supervisor?.nombre || 'No asignado'}
                  </p>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <p className="text-gray-600 mb-4">
                    Firma digital registrada automáticamente con tu autenticación
                  </p>
                  <p className="text-sm text-gray-500">
                    Usuario: {user?.email}
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep('resumen')}
                    className="flex-1 px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={handleFirmar}
                    disabled={submitLoading}
                    className="flex-1 px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition"
                  >
                    {submitLoading ? 'Firmando...' : 'Firmar y Completar'}
                  </button>
                </div>

                {orden?.cierre?.firmasTecnico?.length > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-semibold">✓ Orden completada exitosamente</p>
                    <button
                      onClick={descargarPDF}
                      className="mt-2 text-green-600 hover:text-green-800 font-medium"
                    >
                      📥 Descargar PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
