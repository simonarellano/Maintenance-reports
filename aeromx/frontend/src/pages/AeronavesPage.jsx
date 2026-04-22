import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { aeronavesService } from '../api/aeronavesService'
import { modelosService } from '../api/modelosService'
import { useAuthStore } from '../store/authStore'

export default function AeronavesPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const esSupervisor = user?.rol === 'supervisor'

  const [aeronaves, setAeronaves] = useState([])
  const [modelos, setModelos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [incluirInactivas, setIncluirInactivas] = useState(false)
  const [editando, setEditando] = useState(null)
  const [modoAlta, setModoAlta] = useState(false)

  useEffect(() => { cargar() }, [incluirInactivas])

  const cargar = async () => {
    setLoading(true)
    try {
      const [aerRes, modRes] = await Promise.all([
        aeronavesService.listar(incluirInactivas ? { todas: 'true' } : {}),
        modelosService.listar(),
      ])
      setAeronaves(aerRes.data || [])
      setModelos(modRes.data || [])
      setError('')
    } catch (e) {
      setError('Error cargando aeronaves')
    } finally {
      setLoading(false)
    }
  }

  const guardar = async (datos) => {
    try {
      if (editando) {
        await aeronavesService.actualizar(editando.id, datos)
      } else {
        await aeronavesService.crear(datos)
      }
      setModoAlta(false)
      setEditando(null)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando la aeronave')
    }
  }

  const desactivar = async (aer) => {
    if (!confirm(`¿Desactivar la aeronave ${aer.matricula}? Las O/T históricas seguirán visibles.`)) return
    try {
      await aeronavesService.desactivar(aer.id)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error desactivando la aeronave')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-4 text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Volver
        </button>

        <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Aeronaves</h2>
            <p className="text-sm text-gray-500 mt-1">
              Gestión de aeronaves registradas en la flota
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={incluirInactivas}
                onChange={(e) => setIncluirInactivas(e.target.checked)}
              />
              Incluir inactivas
            </label>
            {esSupervisor && (
              <button
                onClick={() => { setModoAlta(true); setEditando(null) }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold"
                disabled={modelos.length === 0}
                title={modelos.length === 0 ? 'Registra al menos un modelo antes de alta de aeronaves' : ''}
              >
                + Nueva aeronave
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button className="float-right font-bold" onClick={() => setError('')}>×</button>
          </div>
        )}

        {modelos.length === 0 && esSupervisor && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg p-4 mb-4 text-sm">
            No hay modelos registrados. Primero crea un modelo en el{' '}
            <button
              onClick={() => navigate('/modelos')}
              className="underline font-semibold"
            >
              catálogo de modelos
            </button>.
          </div>
        )}

        {(modoAlta || editando) && esSupervisor && (
          <FormularioAeronave
            inicial={editando}
            modelos={modelos}
            onCancelar={() => { setModoAlta(false); setEditando(null) }}
            onGuardar={guardar}
          />
        )}

        {loading ? (
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Cargando aeronaves…</p>
          </div>
        ) : aeronaves.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-10 text-center text-gray-600">
            No hay aeronaves registradas.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 text-left">
                <tr className="text-gray-700">
                  <th className="px-4 py-3 font-semibold">Matrícula</th>
                  <th className="px-4 py-3 font-semibold">Modelo</th>
                  <th className="px-4 py-3 font-semibold">N.º serie</th>
                  <th className="px-4 py-3 font-semibold text-right">Horas</th>
                  <th className="px-4 py-3 font-semibold text-center">Estado</th>
                  {esSupervisor && <th className="px-4 py-3 font-semibold text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {aeronaves.map((a) => (
                  <tr key={a.id} className={`border-b border-gray-100 hover:bg-gray-50 ${
                    a.activa === false ? 'opacity-60' : ''
                  }`}>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{a.matricula}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {a.modelo?.nombre || '—'}
                      {a.modelo?.fabricante && (
                        <span className="text-xs text-gray-400 block">{a.modelo.fabricante}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {a.numeroSerie || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 text-sm">
                      <div>Total: <strong>{a.horasTotales ?? 0}h</strong></div>
                      <div className="text-xs text-gray-500">
                        D: {a.horasMotorDer ?? 0}h · I: {a.horasMotorIzq ?? 0}h
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                        a.activa === false
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {a.activa === false ? 'Inactiva' : 'Activa'}
                      </span>
                    </td>
                    {esSupervisor && (
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => { setEditando(a); setModoAlta(false) }}
                          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
                        >
                          Editar
                        </button>
                        {a.activa !== false && (
                          <button
                            onClick={() => desactivar(a)}
                            className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded border border-red-300"
                          >
                            Desactivar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

function FormularioAeronave({ inicial, modelos, onCancelar, onGuardar }) {
  const [matricula, setMatricula] = useState(inicial?.matricula || '')
  const [modeloId, setModeloId] = useState(inicial?.modeloId || inicial?.modelo?.id || '')
  const [numeroSerie, setNumeroSerie] = useState(inicial?.numeroSerie || '')
  const [horasTotales, setHorasTotales] = useState(inicial?.horasTotales ?? 0)
  const [horasMotorDer, setHorasMotorDer] = useState(inicial?.horasMotorDer ?? 0)
  const [horasMotorIzq, setHorasMotorIzq] = useState(inicial?.horasMotorIzq ?? 0)
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!matricula.trim() || !modeloId) return
    setSaving(true)
    try {
      await onGuardar({
        matricula: matricula.trim().toUpperCase(),
        modeloId,
        numeroSerie: numeroSerie.trim() || null,
        horasTotales: parseFloat(horasTotales) || 0,
        horasMotorDer: parseFloat(horasMotorDer) || 0,
        horasMotorIzq: parseFloat(horasMotorIzq) || 0,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-lg shadow p-5 mb-6 border-l-4 border-l-blue-500 space-y-3"
    >
      <h3 className="text-lg font-bold text-gray-800">
        {inicial ? `Editar ${inicial.matricula}` : 'Nueva aeronave'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Matrícula <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value.toUpperCase())}
            required
            placeholder="XB-ABC"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Modelo <span className="text-red-600">*</span>
          </label>
          <select
            value={modeloId}
            onChange={(e) => setModeloId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">-- Selecciona un modelo --</option>
            {modelos.map(m => (
              <option key={m.id} value={m.id}>
                {m.nombre}{m.fabricante ? ` · ${m.fabricante}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Número de serie
        </label>
        <input
          type="text"
          value={numeroSerie}
          onChange={(e) => setNumeroSerie(e.target.value)}
          placeholder="Ej. C172S-12345"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Horas totales</label>
          <input
            type="number" step="0.1" min="0"
            value={horasTotales}
            onChange={(e) => setHorasTotales(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Horas Motor Der.</label>
          <input
            type="number" step="0.1" min="0"
            value={horasMotorDer}
            onChange={(e) => setHorasMotorDer(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Horas Motor Izq.</label>
          <input
            type="number" step="0.1" min="0"
            value={horasMotorIzq}
            onChange={(e) => setHorasMotorIzq(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !matricula.trim() || !modeloId}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:bg-blue-400"
        >
          {saving ? 'Guardando…' : (inicial ? 'Guardar cambios' : 'Registrar aeronave')}
        </button>
      </div>
    </form>
  )
}
