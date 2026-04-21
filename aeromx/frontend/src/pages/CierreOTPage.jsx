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
  const [firmaConfirmada, setFirmaConfirmada] = useState(false)

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
    if (!firmaConfirmada) {
      setError('Debe confirmar que está de acuerdo con los datos antes de firmar')
      return
    }
    setSubmitLoading(true)
    try {
      const firmaData = {
        tipo: user.rol
      }
      await ordenesService.firmarCierre(id, firmaData)
      await cargarOrden()
      setFirmaConfirmada(false)
      setTimeout(() => {
        descargarPDF()
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Error firmando cierre')
      setFirmaConfirmada(false)
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
                {/* Resumen de datos a firmar */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-gray-800 mb-3">Datos de la Orden</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Orden:</p>
                      <p className="font-semibold text-blue-600">{orden?.numeroOt}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Aeronave:</p>
                      <p className="font-semibold">{orden?.aeronave?.matricula}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Técnico:</p>
                      <p className="font-semibold">{orden?.tecnico?.nombre}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Supervisor:</p>
                      <p className="font-semibold">{orden?.supervisor?.nombre || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Información de firma */}
                <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
                  <div className="flex gap-3 mb-3">
                    <span className="text-2xl">🔐</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">Firma Digital Segura</p>
                      <p className="text-sm text-gray-600">Tu identidad será registrada automáticamente</p>
                    </div>
                  </div>
                  <div className="ml-9 space-y-2 text-sm text-gray-700">
                    <p><strong>Usuario autenticado:</strong> {user?.email}</p>
                    <p><strong>Rol:</strong> {user?.rol?.charAt(0).toUpperCase() + user?.rol?.slice(1)}</p>
                    <p><strong>Fecha y hora:</strong> {new Date().toLocaleString('es-MX')}</p>
                  </div>
                </div>

                {/* Confirmación requerida */}
                <label className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                  <input
                    type="checkbox"
                    checked={firmaConfirmada}
                    onChange={(e) => setFirmaConfirmada(e.target.checked)}
                    className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-gray-800 font-medium">
                    Confirmo que he revisado los datos y autorizo el cierre de esta orden de trabajo
                  </span>
                </label>

                {/* Botones de acción */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('resumen')
                      setFirmaConfirmada(false)
                    }}
                    className="flex-1 px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={handleFirmar}
                    disabled={submitLoading || !firmaConfirmada}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition font-semibold text-lg"
                  >
                    {submitLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block animate-spin">⏳</span>
                        Firmando...
                      </span>
                    ) : (
                      '✓ Firmar y Completar'
                    )}
                  </button>
                </div>

                {/* Confirmación de éxito */}
                {orden?.estado === 'cerrada' && (
                  <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                    <p className="text-green-800 font-bold text-lg mb-3">
                      ✓ Orden completada exitosamente
                    </p>
                    <p className="text-sm text-green-700 mb-4">
                      La orden ha sido firmada y cerrada. Se descargará el PDF automáticamente.
                    </p>
                    <button
                      onClick={descargarPDF}
                      className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition"
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
