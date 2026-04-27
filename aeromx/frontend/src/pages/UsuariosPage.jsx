import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { usuariosService } from '../api/usuariosService'
import { useAuthStore } from '../store/authStore'
import { T, ROL_LABELS, ROL_COLOR } from '../tokens/design'
import {
  Btn, BtnSm, Card, ErrorBanner, Field, FieldSelect, Hdr, Pill, Spinner,
} from '../components/ui'

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
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16, flexWrap: 'wrap',
        }}>
          <Hdr title="Usuarios" sub="Gestión de cuentas" back={() => navigate('/dashboard')} />
          <div style={{ paddingTop: 6 }}>
            <Btn label="+ Nuevo usuario" onClick={() => { setModoAlta(true); setEditando(null) }} />
          </div>
        </div>
        <p style={{ color: T.sub, fontSize: 13, marginTop: -8, marginBottom: 20 }}>
          Gestión de cuentas de técnicos, ingenieros y supervisores
        </p>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {/* Filtros */}
        <Card padding={14} style={{ marginBottom: 18 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { v: 'todos', label: 'Todos' },
                { v: 'tecnico', label: 'Técnicos' },
                { v: 'ingeniero', label: 'Ingenieros' },
                { v: 'supervisor', label: 'Supervisores' },
              ].map((opt) => {
                const active = filtroRol === opt.v
                return (
                  <button
                    key={opt.v}
                    onClick={() => setFiltroRol(opt.v)}
                    style={{
                      padding: '7px 14px', borderRadius: 999,
                      background: active ? T.cD : T.s2,
                      color: active ? T.cyan : T.sub,
                      border: active ? `1px solid ${T.cyan}40` : `1px solid ${T.border}`,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      fontFamily: T.font,
                    }}
                  >{opt.label}</button>
                )
              })}
            </div>
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
          </div>
        </Card>

        {(modoAlta || editando) && (
          <FormularioUsuario
            inicial={editando}
            onCancelar={() => { setModoAlta(false); setEditando(null) }}
            onGuardar={guardar}
          />
        )}

        {loading ? (
          <Spinner label="Cargando…" />
        ) : usuarios.length === 0 ? (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <p style={{ color: T.sub }}>No hay usuarios registrados con estos filtros.</p>
          </Card>
        ) : (
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.s2 }}>
                    <Th>Nombre</Th>
                    <Th>Email</Th>
                    <Th>Rol</Th>
                    <Th>Licencia</Th>
                    <Th>Teléfono</Th>
                    <Th align="center">Estado</Th>
                    <Th align="right">Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const rolColor = ROL_COLOR[u.rol] || { c: T.sub, bg: T.s2 }
                    return (
                      <tr key={u.id} style={{
                        borderTop: `1px solid ${T.border}`,
                        opacity: !u.activo ? 0.55 : 1,
                      }}>
                        <Td>
                          <span style={{ fontWeight: 600, color: T.text }}>{u.nombre}</span>
                        </Td>
                        <Td>
                          <span style={{ color: T.sub, fontSize: 12 }}>{u.email}</span>
                        </Td>
                        <Td>
                          <Pill small label={ROL_LABELS[u.rol]} color={rolColor.c} bg={rolColor.bg} />
                        </Td>
                        <Td>
                          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.sub }}>
                            {u.licenciaNum || '—'}
                          </span>
                        </Td>
                        <Td>
                          <span style={{ color: T.sub, fontSize: 12 }}>{u.telefono || '—'}</span>
                        </Td>
                        <Td align="center">
                          {u.activo ? (
                            <Pill small label="Activo" color={T.green} bg={T.gD} />
                          ) : (
                            <Pill small label="Inactivo" color={T.sub} bg={T.s1} />
                          )}
                        </Td>
                        <Td align="right">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <BtnSm
                              variant="surface"
                              label="Editar"
                              onClick={() => { setEditando(u); setModoAlta(false) }}
                            />
                            {u.activo && u.id !== user?.id && (
                              <BtnSm
                                variant="danger"
                                label="Desactivar"
                                onClick={() => desactivar(u)}
                              />
                            )}
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
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
      color: T.text, fontSize: 13, verticalAlign: 'middle',
    }}>{children}</td>
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
    <Card padding={20} style={{ marginBottom: 18, borderLeft: `3px solid ${T.cyan}` }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
          {inicial ? `Editar usuario: ${inicial.nombre}` : 'Nuevo usuario'}
        </div>

        {errorLocal && (
          <div style={{
            background: T.rD, border: `1px solid rgba(255,69,69,0.30)`,
            color: T.red, borderRadius: 10, padding: '8px 12px', fontSize: 12,
          }}>{errorLocal}</div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12,
        }}>
          <Field label="Nombre completo" required value={nombre} onChange={setNombre} />
          <Field label="Email" required type="email" value={email} onChange={setEmail} />
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
        }}>
          <FieldSelect
            label="Rol"
            required
            value={rol}
            onChange={setRol}
            options={[
              { value: 'tecnico',    label: 'Técnico' },
              { value: 'ingeniero',  label: 'Ingeniero' },
              { value: 'supervisor', label: 'Supervisor' },
            ]}
          />
          <Field label="Licencia" value={licenciaNum} onChange={setLicenciaNum} placeholder="TEC-123" mono />
          <Field label="Teléfono" type="tel" value={telefono} onChange={setTelefono} />
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
        }}>
          <Field
            label={inicial ? 'Contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
            required={!inicial}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={inicial ? '••••••••' : 'Mínimo 6 caracteres'}
            autoComplete="new-password"
          />
          <Field
            label="Confirmar contraseña"
            type="password"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            autoComplete="new-password"
          />
        </div>

        {inicial && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: T.sub, cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Usuario activo
          </label>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn variant="ghost" label="Cancelar" onClick={onCancelar} style={{ flex: 1 }} />
          <Btn
            type="submit"
            label={saving ? 'Guardando…' : (inicial ? 'Guardar cambios' : 'Crear usuario')}
            disabled={saving}
            style={{ flex: 1 }}
          />
        </div>
      </form>
    </Card>
  )
}
