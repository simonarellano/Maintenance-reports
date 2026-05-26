import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { categoriasFallaService } from '../api/categoriasFallaService'
import { useAuthStore } from '../store/authStore'
import { T } from '../tokens/design'
import {
  Btn, BtnSm, Card, ErrorBanner, Field, FieldTextarea, Hdr, Pill, Spinner,
} from '../components/ui'

export default function CategoriasFallaPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(null)
  const [modoAlta, setModoAlta] = useState(false)

  const puedeEditar =
    user?.superusuario === true ||
    user?.rol === 'gerente_soporte' ||
    user?.rol === 'ingeniero_soporte'

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await categoriasFallaService.listar()
      setCategorias(data || [])
      setError('')
    } catch (e) {
      setError('Error cargando categorías de falla')
    } finally {
      setLoading(false)
    }
  }

  const guardar = async (datos) => {
    try {
      if (editando) {
        await categoriasFallaService.actualizar(editando.id, datos)
      } else {
        await categoriasFallaService.crear(datos)
      }
      setModoAlta(false)
      setEditando(null)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando la categoría')
    }
  }

  const eliminar = async (cat) => {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"? Esta acción es irreversible.`)) return
    try {
      await categoriasFallaService.eliminar(cat.id)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error eliminando la categoría')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16, flexWrap: 'wrap',
        }}>
          <Hdr
            title="Categorías de falla"
            sub="Catálogo de fallas"
            back={() => navigate('/fallas')}
          />
          {puedeEditar && (
            <div style={{ paddingTop: 6 }}>
              <Btn
                label="+ Nueva categoría"
                onClick={() => { setModoAlta(true); setEditando(null) }}
              />
            </div>
          )}
        </div>
        <p style={{ color: T.sub, fontSize: 13, marginTop: -8, marginBottom: 16 }}>
          Clasificación de tipos de falla para los reportes del sistema
        </p>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {(modoAlta || editando) && puedeEditar && (
          <FormularioCategoria
            inicial={editando}
            onCancelar={() => { setModoAlta(false); setEditando(null) }}
            onGuardar={guardar}
          />
        )}

        {loading ? (
          <Spinner label="Cargando categorías…" />
        ) : categorias.length === 0 ? (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <p style={{ color: T.sub }}>No hay categorías registradas.</p>
          </Card>
        ) : (
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.s2 }}>
                    <Th>Nombre</Th>
                    <Th>Color</Th>
                    <Th>Descripción</Th>
                    <Th align="center">Fallas</Th>
                    <Th align="center">Formatos</Th>
                    <Th align="center">Activo</Th>
                    {puedeEditar && <Th align="right">Acciones</Th>}
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((cat) => (
                    <tr key={cat.id} style={{ borderTop: `1px solid ${T.border}` }}>
                      <Td>
                        <span style={{ fontWeight: 600, color: T.text }}>{cat.nombre}</span>
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            display: 'inline-block',
                            width: 18, height: 18,
                            borderRadius: 4,
                            background: cat.color || T.sub,
                            border: `1px solid rgba(255,255,255,0.15)`,
                            flexShrink: 0,
                          }} />
                          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.sub }}>
                            {cat.color || '—'}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        {cat.descripcion ? (
                          <span style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            color: T.sub, fontSize: 12, lineHeight: 1.5,
                          }}>{cat.descripcion}</span>
                        ) : (
                          <span style={{ color: T.dim, fontStyle: 'italic' }}>—</span>
                        )}
                      </Td>
                      <Td align="center">
                        <Pill
                          small
                          label={String(cat._count?.fallas ?? 0)}
                          color={T.red}
                          bg={T.rD}
                        />
                      </Td>
                      <Td align="center">
                        <Pill
                          small
                          label={String(cat._count?.formatos ?? 0)}
                          color={T.cyan}
                          bg={T.cD}
                        />
                      </Td>
                      <Td align="center">
                        {cat.activo ? (
                          <Pill small label="Activo" color={T.green} bg={T.gD} />
                        ) : (
                          <Pill small label="Inactivo" color={T.sub} bg={T.s2} />
                        )}
                      </Td>
                      {puedeEditar && (
                        <Td align="right">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <BtnSm
                              variant="surface"
                              label="Editar"
                              onClick={() => { setEditando(cat); setModoAlta(false) }}
                            />
                            <BtnSm
                              variant="danger"
                              label="Eliminar"
                              onClick={() => eliminar(cat)}
                              disabled={
                                (cat._count?.fallas ?? 0) > 0 ||
                                (cat._count?.formatos ?? 0) > 0
                              }
                              title={
                                (cat._count?.fallas ?? 0) > 0 || (cat._count?.formatos ?? 0) > 0
                                  ? 'No se puede eliminar: tiene fallas o formatos asociados'
                                  : undefined
                              }
                            />
                          </div>
                        </Td>
                      )}
                    </tr>
                  ))}
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

function FormularioCategoria({ inicial, onCancelar, onGuardar }) {
  const [nombre, setNombre] = useState(inicial?.nombre || '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion || '')
  const [color, setColor] = useState(inicial?.color || '#00d0e8')
  const [activo, setActivo] = useState(inicial?.activo ?? true)
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) return
    setSaving(true)
    try {
      const datos = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        color: color || null,
      }
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
          {inicial ? 'Editar categoría' : 'Nueva categoría'}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
        }}>
          <Field
            label="Nombre"
            required
            value={nombre}
            onChange={setNombre}
            placeholder="Ej. Falla eléctrica"
          />
          {/* Color picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: T.sub,
              letterSpacing: '0.07em', textTransform: 'uppercase',
            }}>
              Color
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{
                  width: 44, height: 44,
                  padding: 2, borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: T.s2,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
              <Field
                value={color}
                onChange={(v) => {
                  // accept hex values typed directly
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v)
                }}
                placeholder="#000000"
                mono
              />
            </div>
          </div>
        </div>

        <FieldTextarea
          label="Descripción"
          value={descripcion}
          onChange={setDescripcion}
          placeholder="Descripción breve de la categoría"
          rows={3}
          minHeight={64}
        />

        {/* Activo toggle — solo al editar */}
        {inicial && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            }}>
              <div
                onClick={() => setActivo((v) => !v)}
                style={{
                  width: 42, height: 24, borderRadius: 99,
                  background: activo ? T.cyan : T.dim,
                  position: 'relative', transition: 'background .2s',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 3, left: activo ? 21 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: T.bg,
                  transition: 'left .2s',
                }} />
              </div>
              <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>
                {activo ? 'Activo' : 'Inactivo'}
              </span>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn variant="ghost" label="Cancelar" onClick={onCancelar} style={{ flex: 1 }} />
          <Btn
            type="submit"
            label={saving ? 'Guardando…' : (inicial ? 'Guardar cambios' : 'Crear categoría')}
            disabled={saving || !nombre.trim()}
            style={{ flex: 1 }}
          />
        </div>
      </form>
    </Card>
  )
}
