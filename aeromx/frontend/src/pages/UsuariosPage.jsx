import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { usuariosService } from '../api/usuariosService'
import { useAuthStore } from '../store/authStore'

const ROL_LABELS = {
  tecnico:    'Técnico',
  ingeniero:  'Ingeniero',
  supervisor: 'Supervisor',
}

const ROL_COLORS = {
  tecnico:    'bg-blue-100 text-blue-800 border-blue-300',
  ingeniero:  'bg-purple-100 text-purple-800 border-purple-300',
  supervisor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
}

export default function UsuariosPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const esSupervisor = user?.rol === 'supervisor'

  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [incluirInactivos, setIncluirInactivos] = useState(false)
  const [editando, setEditando] = useState(null)
  const [modoAlta, setModoAlta] = useState(false)

  useEffect(() => {
    if (!esSupervisor) {
      navigate('/dashboard')
      return
    }
    cargar()
  }, [filtroRol, incluirInactivos])

  const cargar = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filtroRol !== 'todos') params.rol = filtroRol
      if (!incluirInactivos) params.activo = true
      const { data } = await usuariosService.listar(params)
      setUsuarios(data || [])
      setError('')
    } catch (e) {
      setError('Error cargando usuarios')
    } finally {
      setLoading(false)
    }
  }

  const guardar = async (datos) => {
    try {
      if (editando) {
        await usuariosService.actualizar(editando.id, datos)
      } else {
        await usuariosService.crear(datos)
      }
      setModoAlta(false)
      setEditando(null)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando el usuario')
    }
  }

  const desactivar = async (u) => {
    if (u.id === user?.id) {
      setError('No puedes desactivar tu propia cuenta')
      return
    }
    if (!confirm(`¿Desactivar al usuario ${u.nombre}?`)) return
    try {
      await usuariosService.desactivar(u.id)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error desactivando el usuario')
    }
  }

  if (!esSupervisor) return null

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
            <h2 className="text-3xl font-bold text-gray-800">Usuarios</h2>
            <p className="text-sm text-gray-500 mt-1">
              Gestión de cuentas de técnicos, ingenieros y supervisores
            </p>
          </div>
          <button
            onClick={() => { setModoAlta(true); setEditando(null) }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold"
          >
            + Nuevo usuario
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button className="float-right font-bold" onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            {['todos', 'tecnico', 'ingeniero', 'supervisor'].map(r => (
              <button
                key={r}
                onClick={() => setFiltroRol(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  filtroRol === r
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:border-blue-500'
                }`}
              >
                {r === 'todos' ? 'Todos' : ROL_LABELS[r]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 ml-auto">
            <input
              type="checkbox"
              checked={incluirInactivos}
              onChange={(e) => setIncluirInactivos(e.target.checked)}
            />
            Incluir inactivos
          </label>
        </div>

        {(modoAlta || editando) && (
          <FormularioUsuario
            inicial={editando}
            onCancelar={() => { setModoAlta(false); setEditando(null) }}
            onGuardar={guardar}
          />
        )}

        {loading ? (
          <div className="text-center py-10">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-2">Cargando…</p>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-10 text-center text-gray-600">
            No hay usuarios registrados con estos filtros.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 text-left">
                <tr className="text-gray-700">
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Licencia</th>
                  <th className="px-4 py-3 font-semibold">Teléfono</th>
                  <th className="px-4 py-3 font-semibold text-center">Estado</th>
                  <th className="px-4 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className={`border-b border-gray-100 hover:bg-gray-50 ${
                    !u.activo ? 'opacity-60' : ''
                  }`}>
                    <td className="px-4 py-3 font-semibold text-gray-800">{u.nombre}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold border rounded ${ROL_COLORS[u.rol]}`}>
                        {ROL_LABELS[u.rol]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.licenciaNum || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{u.telefono || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                        u.activo ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => { setEditando(u); setModoAlta(false) }}
                        className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
                      >
                        Editar
                      </button>
                      {u.activo && u.id !== user?.id && (
                        <button
                          onClick={() => desactivar(u)}
                          className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded border border-red-300"
                        >
                          Desactivar
                        </button>
                      )}
                    </td>
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

function FormularioUsuario({ inicial, onCancelar, onGuardar }) {
  const [nombre, setNombre] = useState(inicial?.nombre || '')
  const [email, setEmail] = useState(inicial?.email || '')
  const [rol, setRol] = useState(inicial?.rol || 'tecnico')
  const [licenciaNum, setLicenciaNum] = useState(inicial?.licenciaNum || '')
  const [telefono, setTelefono] = useState(inicial?.telefono || '')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [activo, setActivo] = useState(inicial?.activo ?? true)
  const [saving, setSaving] = useState(false)
  const [errorLocal, setErrorLocal] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErrorLocal('')
    if (!nombre.trim() || !email.trim() || !rol) return
    if (!inicial && !password) {
      setErrorLocal('La contraseña es obligatoria para nuevos usuarios')
      return
    }
    if (password && password !== passwordConfirm) {
      setErrorLocal('Las contraseñas no coinciden')
      return
    }
    if (password && password.length < 6) {
      setErrorLocal('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setSaving(true)
    try {
      const datos = {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        rol,
        licenciaNum: licenciaNum.trim() || null,
        telefono: telefono.trim() || null,
      }
      if (password) datos.password = password
      if (inicial) datos.activo = activo
      await onGuardar(datos)
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
        {inicial ? `Editar usuario: ${inicial.nombre}` : 'Nuevo usuario'}
      </h3>

      {errorLocal && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">
          {errorLocal}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre completo <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-600">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rol <span className="text-red-600">*</span>
          </label>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="tecnico">Técnico</option>
            <option value="ingeniero">Ingeniero</option>
            <option value="supervisor">Supervisor</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Licencia</label>
          <input
            type="text"
            value={licenciaNum}
            onChange={(e) => setLicenciaNum(e.target.value)}
            placeholder="TEC-123"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña {!inicial && <span className="text-red-600">*</span>}
            {inicial && <span className="text-xs text-gray-500 ml-2">(dejar vacío para no cambiar)</span>}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={inicial ? '••••••••' : 'Mínimo 6 caracteres'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirmar contraseña
          </label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {inicial && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />
          Usuario activo
        </label>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancelar}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:bg-blue-400"
        >
          {saving ? 'Guardando…' : (inicial ? 'Guardar cambios' : 'Crear usuario')}
        </button>
      </div>
    </form>
  )
}
