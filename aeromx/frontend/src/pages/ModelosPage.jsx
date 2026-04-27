import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { modelosService } from '../api/modelosService'
import { useAuthStore } from '../store/authStore'

export default function ModelosPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [modelos, setModelos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(null)
  const [modoAlta, setModoAlta] = useState(false)

  const esSupervisor = user?.rol === 'supervisor'

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await modelosService.listar()
      setModelos(data || [])
      setError('')
    } catch (e) {
      setError('Error cargando modelos')
    } finally {
      setLoading(false)
    }
  }

  const guardar = async (datos) => {
    try {
      if (editando) {
        await modelosService.actualizar(editando.id, datos)
      } else {
        await modelosService.crear(datos)
      }
      setModoAlta(false)
      setEditando(null)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando el modelo')
    }
  }

  const eliminar = async (modelo) => {
    if (!confirm(`¿Eliminar el modelo "${modelo.nombre}"? Esta acción es irreversible.`)) return
    try {
      await modelosService.eliminar(modelo.id)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error eliminando el modelo')
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
            <h2 className="text-3xl font-bold text-gray-800">Catálogo de Modelos</h2>
            <p className="text-sm text-gray-500 mt-1">
              Gestión de modelos de aeronaves utilizados en la flota
            </p>
          </div>
          {esSupervisor && (
            <button
              onClick={() => { setModoAlta(true); setEditando(null) }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold"
            >
              + Nuevo modelo
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button className="float-right font-bold" onClick={() => setError('')}>×</button>
          </div>
        )}

        {(modoAlta || editando) && esSupervisor && (
          <FormularioModelo
            inicial={editando}
            onCancelar={() => { setModoAlta(false); setEditando(null) }}
            onGuardar={guardar}
          />
        )}

        {loading ? (
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Cargando modelos…</p>
          </div>
        ) : modelos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-10 text-center text-gray-600">
            No hay modelos registrados.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 text-left">
                <tr className="text-gray-700">
                  <th className="px-4 py-3 font-semibold">Modelo</th>
                  <th className="px-4 py-3 font-semibold">Fabricante</th>
                  <th className="px-4 py-3 font-semibold">Descripción</th>
                  <th className="px-4 py-3 font-semibold text-center">Aeronaves</th>
                  {esSupervisor && <th className="px-4 py-3 font-semibold text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {modelos.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{m.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{m.fabricante || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {m.descripcion
                        ? <span className="line-clamp-2">{m.descripcion}</span>
                        : <span className="text-gray-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                        {m._count?.aeronaves ?? 0}
                      </span>
                    </td>
                    {esSupervisor && (
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => { setEditando(m); setModoAlta(false) }}
                          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminar(m)}
                          className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded border border-red-300"
                        >
                          Eliminar
                        </button>
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

function FormularioModelo({ inicial, onCancelar, onGuardar }) {
  const [nombre, setNombre] = useState(inicial?.nombre || '')
  const [fabricante, setFabricante] = useState(inicial?.fabricante || '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion || '')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) return
    setSaving(true)
    try {
      await onGuardar({
        nombre: nombre.trim(),
        fabricante: fabricante.trim() || null,
        descripcion: descripcion.trim() || null,
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
        {inicial ? 'Editar modelo' : 'Nuevo modelo'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej. Cessna 172S"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fabricante
          </label>
          <input
            type="text"
            value={fabricante}
            onChange={(e) => setFabricante(e.target.value)}
            placeholder="Ej. Cessna"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción
        </label>
        <textarea
          rows={2}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Descripción breve del modelo"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
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
          disabled={saving || !nombre.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:bg-blue-400"
        >
          {saving ? 'Guardando…' : (inicial ? 'Guardar cambios' : 'Crear modelo')}
        </button>
      </div>
    </form>
  )
}
