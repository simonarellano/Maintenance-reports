import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { formatosService } from '../api/formatosService'
import { useAuthStore } from '../store/authStore'
import { T } from '../tokens/design'
import {
  Btn, BtnSm, Card, ErrorBanner, Field, FieldTextarea, Hdr, Pill, Spinner,
} from '../components/ui'

export default function FormatosPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [formatos, setFormatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modoAlta, setModoAlta] = useState(false)
  const [editando, setEditando] = useState(null)
  const [expandido, setExpandido] = useState(null)
  const [mostrarSecciones, setMostrarSecciones] = useState(false)

  const esSupervisor = user?.rol === 'supervisor'

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await formatosService.listar()
      setFormatos(data || [])
      setError('')
    } catch (e) {
      setError('Error cargando formatos')
    } finally {
      setLoading(false)
    }
  }

  const guardar = async (datos) => {
    try {
      if (editando) {
        await formatosService.actualizar(editando.id, datos)
      } else {
        await formatosService.crear(datos)
      }
      setModoAlta(false)
      setEditando(null)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando el formato')
    }
  }

  const eliminar = async (formato) => {
    if (!confirm(`¿Eliminar el formato "${formato.nombre}"? Esta acción es irreversible.`)) return
    try {
      await formatosService.eliminar(formato.id)
      await cargar()
    } catch (e) {
      setError(e.response?.data?.error || 'Error eliminando el formato')
    }
  }

  const toggleExpandido = (id) => {
    setExpandido(expandido === id ? null : id)
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16, flexWrap: 'wrap',
        }}>
          <Hdr title="Formatos de Mantenimiento" sub="Plantillas de inspección" back={() => navigate('/dashboard')} />
          {esSupervisor && (
            <div style={{ paddingTop: 6 }}>
              <Btn
                label="+ Nuevo formato"
                onClick={() => { setModoAlta(true); setEditando(null) }}
              />
            </div>
          )}
        </div>
        <p style={{ color: T.sub, fontSize: 13, marginTop: -8, marginBottom: 20 }}>
          Gestión de plantillas de órdenes de trabajo
        </p>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {(modoAlta || editando) && esSupervisor && (
          <FormularioFormato
            inicial={editando}
            onCancelar={() => { setModoAlta(false); setEditando(null) }}
            onGuardar={guardar}
          />
        )}

        {loading ? (
          <Spinner label="Cargando formatos…" />
        ) : formatos.length === 0 ? (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <p style={{ color: T.sub }}>No hay formatos registrados.</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {formatos.map((f) => {
              const isOpen = expandido === f.id
              const totalPuntos = f.secciones?.reduce(
                (acc, s) => acc + (s.puntos?.length || 0), 0
              ) || 0
              return (
                <section key={f.id} style={{
                  background: T.s1, border: `1px solid ${T.border}`,
                  borderRadius: 14, overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '16px 18px',
                    background: T.s2,
                    borderBottom: isOpen ? `1px solid ${T.border}` : 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    gap: 14, flexWrap: 'wrap',
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => toggleExpandido(f.id)}
                          style={{
                            background: 'transparent', border: 'none',
                            color: T.cyan, fontSize: 13, fontWeight: 700,
                            cursor: 'pointer', fontFamily: T.mono,
                            padding: '2px 6px',
                          }}
                        >{isOpen ? '▼' : '▶'}</button>
                        <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                          {f.nombre}
                        </span>
                        <Pill small label={`v${f.version}`} color={T.cyan} bg={T.cD} />
                      </div>
                      <div style={{
                        fontSize: 11, color: T.sub, marginTop: 6, fontFamily: T.mono,
                        marginLeft: 30,
                      }}>
                        {f.secciones?.length || 0} secciones · {totalPuntos} puntos
                      </div>
                      {f.objetivo && (
                        <p style={{
                          fontSize: 13, color: T.sub, marginTop: 6, lineHeight: 1.5,
                          marginLeft: 30,
                        }}>{f.objetivo}</p>
                      )}
                    </div>
                    {esSupervisor && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <BtnSm
                          variant="surface"
                          label="Editar"
                          onClick={() => { setEditando(f); setModoAlta(false) }}
                        />
                        <BtnSm
                          variant="danger"
                          label="Eliminar"
                          onClick={() => eliminar(f)}
                        />
                      </div>
                    )}
                  </div>

                  {isOpen && (
                    <div style={{ padding: '16px 18px' }}>
                      {f.secciones && f.secciones.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {f.secciones.map((sec, idx) => (
                            <div key={sec.id} style={{
                              background: T.s2, border: `1px solid ${T.border}`,
                              borderRadius: 12, padding: '12px 14px',
                            }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
                                {idx + 1}. {sec.nombre}
                              </div>
                              {sec.descripcion && (
                                <div style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>
                                  {sec.descripcion}
                                </div>
                              )}
                              {sec.puntos && sec.puntos.length > 0 && (
                                <ul style={{
                                  listStyle: 'none', marginTop: 8,
                                  display: 'flex', flexDirection: 'column', gap: 4,
                                  fontSize: 12, color: T.text,
                                }}>
                                  {sec.puntos.slice(0, 3).map((p) => (
                                    <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      <span style={{ color: T.sub }}>•</span>
                                      <span>{p.nombreComponente}</span>
                                      {p.esCritico && (
                                        <Pill small label="Crítico" color={T.red} bg={T.rD} />
                                      )}
                                      {p.fotoRequerida && (
                                        <Pill small label="Foto req." color={T.cyan} bg={T.cD} />
                                      )}
                                    </li>
                                  ))}
                                  {sec.puntos.length > 3 && (
                                    <li style={{ color: T.dim, fontSize: 11, fontStyle: 'italic' }}>
                                      +{sec.puntos.length - 3} más…
                                    </li>
                                  )}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 13, color: T.sub, fontStyle: 'italic' }}>
                          Sin secciones aún
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function FormularioFormato({ inicial, onCancelar, onGuardar }) {
  const [datos, setDatos] = useState(
    inicial || {
      nombre: '',
      version: '1.0',
      objetivo: '',
      instrucciones: '',
      definiciones: '',
    }
  )
  const [guardando, setGuardando] = useState(false)

  const setCampo = (k) => (v) => setDatos((prev) => ({ ...prev, [k]: v }))

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (!datos.nombre?.trim()) return alert('El nombre es requerido')
    if (!datos.objetivo?.trim()) return alert('El objetivo es requerido')

    setGuardando(true)
    try {
      await onGuardar(datos)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card padding={20} style={{ marginBottom: 18, borderLeft: `3px solid ${T.cyan}` }}>
      <form onSubmit={manejarEnvio} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
          {inicial ? 'Editar formato' : 'Nuevo formato'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field
            label="Nombre"
            required
            value={datos.nombre}
            onChange={setCampo('nombre')}
            placeholder="Ej. Mantenimiento Mayor"
          />
          <Field
            label="Versión"
            value={datos.version}
            onChange={setCampo('version')}
            placeholder="1.0"
            mono
          />
        </div>

        <Field
          label="Objetivo"
          required
          value={datos.objetivo}
          onChange={setCampo('objetivo')}
          placeholder="Descripción general del mantenimiento"
        />

        <FieldTextarea
          label="Instrucciones generales"
          value={datos.instrucciones}
          onChange={setCampo('instrucciones')}
          placeholder="Instrucciones aplicables a todo el formato"
          rows={3}
        />

        <FieldTextarea
          label="Definiciones"
          value={datos.definiciones}
          onChange={setCampo('definiciones')}
          placeholder="Términos y definiciones (CM, AC, etc.)"
          rows={3}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn variant="ghost" label="Cancelar" onClick={onCancelar} style={{ flex: 1 }} />
          <Btn
            type="submit"
            label={guardando ? 'Guardando…' : 'Guardar'}
            disabled={guardando}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{
          marginTop: 4,
          background: T.cD, border: `1px solid ${T.cyan}30`,
          borderRadius: 10, padding: '10px 12px',
          fontSize: 12, color: T.cyan, lineHeight: 1.5,
        }}>
          💡 <strong>Próximo paso:</strong> Después de crear el formato, podrás agregar secciones y puntos de inspección.
        </div>
      </form>
    </Card>
  )
}
