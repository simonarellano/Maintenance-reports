import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { modelosService } from '../api/modelosService'
import { useAuthStore } from '../store/authStore'
import { T } from '../tokens/design'
import {
  Btn, BtnSm, Card, ErrorBanner, Field, FieldTextarea, Hdr, Pill, Spinner,
} from '../components/ui'

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
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16, flexWrap: 'wrap',
        }}>
          <Hdr title="Catálogo de modelos" sub="Familias de aeronaves" back={() => navigate('/dashboard')} />
          {esSupervisor && (
            <div style={{ paddingTop: 6 }}>
              <Btn label="+ Nuevo modelo" onClick={() => { setModoAlta(true); setEditando(null) }} />
            </div>
          )}
        </div>
        <p style={{ color: T.sub, fontSize: 13, marginTop: -8, marginBottom: 20 }}>
          Gestión de modelos de aeronaves utilizados en la flota
        </p>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {(modoAlta || editando) && esSupervisor && (
          <FormularioModelo
            inicial={editando}
            onCancelar={() => { setModoAlta(false); setEditando(null) }}
            onGuardar={guardar}
          />
        )}

        {loading ? (
          <Spinner label="Cargando modelos…" />
        ) : modelos.length === 0 ? (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <p style={{ color: T.sub }}>No hay modelos registrados.</p>
          </Card>
        ) : (
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.s2 }}>
                    <Th>Modelo</Th>
                    <Th>Fabricante</Th>
                    <Th>Descripción</Th>
                    <Th align="center">Aeronaves</Th>
                    {esSupervisor && <Th align="right">Acciones</Th>}
                  </tr>
                </thead>
                <tbody>
                  {modelos.map((m) => (
                    <tr key={m.id} style={{ borderTop: `1px solid ${T.border}` }}>
                      <Td>
                        <span style={{ fontWeight: 600, color: T.text }}>{m.nombre}</span>
                      </Td>
                      <Td>{m.fabricante || '—'}</Td>
                      <Td>
                        {m.descripcion ? (
                          <span style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            color: T.sub, fontSize: 12, lineHeight: 1.5,
                          }}>{m.descripcion}</span>
                        ) : (
                          <span style={{ color: T.dim, fontStyle: 'italic' }}>—</span>
                        )}
                      </Td>
                      <Td align="center">
                        <Pill
                          small
                          label={String(m._count?.aeronaves ?? 0)}
                          color={T.cyan}
                          bg={T.cD}
                        />
                      </Td>
                      {esSupervisor && (
                        <Td align="right">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <BtnSm
                              variant="surface"
                              label="Editar"
                              onClick={() => { setEditando(m); setModoAlta(false) }}
                            />
                            <BtnSm
                              variant="danger"
                              label="Eliminar"
                              onClick={() => eliminar(m)}
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
    <Card padding={20} style={{ marginBottom: 18, borderLeft: `3px solid ${T.cyan}` }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
          {inicial ? 'Editar modelo' : 'Nuevo modelo'}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
        }}>
          <Field
            label="Nombre"
            required
            value={nombre}
            onChange={setNombre}
            placeholder="Ej. Cessna 172S"
          />
          <Field
            label="Fabricante"
            value={fabricante}
            onChange={setFabricante}
            placeholder="Ej. Cessna"
          />
        </div>
        <FieldTextarea
          label="Descripción"
          value={descripcion}
          onChange={setDescripcion}
          placeholder="Descripción breve del modelo"
          rows={3}
          minHeight={64}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn variant="ghost" label="Cancelar" onClick={onCancelar} style={{ flex: 1 }} />
          <Btn
            type="submit"
            label={saving ? 'Guardando…' : (inicial ? 'Guardar cambios' : 'Crear modelo')}
            disabled={saving || !nombre.trim()}
            style={{ flex: 1 }}
          />
        </div>
      </form>
    </Card>
  )
}
