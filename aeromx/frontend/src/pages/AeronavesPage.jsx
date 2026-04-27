import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { aeronavesService } from '../api/aeronavesService'
import { modelosService } from '../api/modelosService'
import { useAuthStore } from '../store/authStore'
import { T } from '../tokens/design'
import {
  Btn, BtnSm, Card, ErrorBanner, Field, FieldSelect, Hdr, Pill, Spinner,
} from '../components/ui'

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
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16, flexWrap: 'wrap', marginBottom: 4,
        }}>
          <Hdr
            title="Aeronaves"
            sub="Catálogo de flota"
            back={() => navigate('/dashboard')}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 6, flexWrap: 'wrap' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: T.sub, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={incluirInactivas}
                onChange={(e) => setIncluirInactivas(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Incluir inactivas
            </label>
            {esSupervisor && (
              <Btn
                label="+ Nueva aeronave"
                onClick={() => { setModoAlta(true); setEditando(null) }}
                disabled={modelos.length === 0}
                title={modelos.length === 0 ? 'Registra al menos un modelo antes de alta de aeronaves' : ''}
              />
            )}
          </div>
        </div>
        <p style={{ color: T.sub, fontSize: 13, marginTop: -8, marginBottom: 20 }}>
          Gestión de aeronaves registradas en la flota
        </p>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {modelos.length === 0 && esSupervisor && (
          <Card
            padding={14}
            style={{
              marginBottom: 16,
              background: T.aD,
              borderColor: `${T.amber}40`,
              borderLeft: `3px solid ${T.amber}`,
            }}
          >
            <div style={{ fontSize: 13, color: T.text }}>
              No hay modelos registrados. Primero crea un modelo en el{' '}
              <button
                onClick={() => navigate('/modelos')}
                style={{
                  background: 'transparent', border: 'none',
                  color: T.amber, fontWeight: 700, cursor: 'pointer',
                  textDecoration: 'underline', fontFamily: T.font, fontSize: 13,
                }}
              >catálogo de modelos</button>.
            </div>
          </Card>
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
          <Spinner label="Cargando aeronaves…" />
        ) : aeronaves.length === 0 ? (
          <Card padding={40} style={{ textAlign: 'center' }}>
            <p style={{ color: T.sub }}>No hay aeronaves registradas.</p>
          </Card>
        ) : (
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.font }}>
                <thead>
                  <tr style={{ background: T.s2 }}>
                    <Th>Matrícula</Th>
                    <Th>Modelo</Th>
                    <Th>N.º serie</Th>
                    <Th align="right">Horas</Th>
                    <Th align="center">Estado</Th>
                    {esSupervisor && <Th align="right">Acciones</Th>}
                  </tr>
                </thead>
                <tbody>
                  {aeronaves.map((a) => (
                    <tr key={a.id} style={{
                      borderTop: `1px solid ${T.border}`,
                      opacity: a.activa === false ? 0.55 : 1,
                    }}>
                      <Td>
                        <span style={{ fontFamily: T.mono, fontSize: 14, color: T.text, fontWeight: 600 }}>
                          {a.matricula}
                        </span>
                      </Td>
                      <Td>
                        <div style={{ color: T.text, fontSize: 13 }}>
                          {a.modelo?.nombre || '—'}
                        </div>
                        {a.modelo?.fabricante && (
                          <div style={{ fontSize: 11, color: T.sub, marginTop: 2 }}>{a.modelo.fabricante}</div>
                        )}
                      </Td>
                      <Td>
                        <span style={{ fontFamily: T.mono, fontSize: 12, color: T.sub }}>
                          {a.numeroSerie || '—'}
                        </span>
                      </Td>
                      <Td align="right">
                        <div style={{ fontSize: 13, color: T.text, fontFamily: T.mono }}>
                          {a.horasTotales ?? 0} h
                        </div>
                        <div style={{ fontSize: 11, color: T.sub, fontFamily: T.mono, marginTop: 2 }}>
                          D: {a.horasMotorDer ?? 0}h · I: {a.horasMotorIzq ?? 0}h
                        </div>
                      </Td>
                      <Td align="center">
                        {a.activa === false ? (
                          <Pill small label="Inactiva" color={T.sub} bg={T.s1} />
                        ) : (
                          <Pill small label="Activa" color={T.green} bg={T.gD} />
                        )}
                      </Td>
                      {esSupervisor && (
                        <Td align="right">
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <BtnSm
                              variant="surface"
                              label="Editar"
                              onClick={() => { setEditando(a); setModoAlta(false) }}
                            />
                            {a.activa !== false && (
                              <BtnSm
                                variant="danger"
                                label="Desactivar"
                                onClick={() => desactivar(a)}
                              />
                            )}
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
      verticalAlign: 'middle', color: T.text, fontSize: 13,
    }}>{children}</td>
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
    <Card
      padding={20}
      style={{ marginBottom: 18, borderLeft: `3px solid ${T.cyan}` }}
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
          {inicial ? `Editar ${inicial.matricula}` : 'Nueva aeronave'}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
        }}>
          <Field
            label="Matrícula"
            required
            value={matricula}
            onChange={(v) => setMatricula(v.toUpperCase())}
            placeholder="XB-ABC"
            mono
          />
          <FieldSelect
            label="Modelo"
            required
            value={modeloId}
            onChange={setModeloId}
            placeholder="-- Selecciona un modelo --"
            options={modelos.map(m => ({
              value: m.id,
              label: `${m.nombre}${m.fabricante ? ` · ${m.fabricante}` : ''}`,
            }))}
          />
        </div>
        <Field
          label="Número de serie"
          value={numeroSerie}
          onChange={setNumeroSerie}
          placeholder="Ej. C172S-12345"
          mono
        />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12,
        }}>
          <Field
            label="Horas totales"
            type="number"
            value={horasTotales}
            onChange={setHorasTotales}
            mono
            inputProps={{ step: '0.1', min: '0' }}
          />
          <Field
            label="Horas motor derecho"
            type="number"
            value={horasMotorDer}
            onChange={setHorasMotorDer}
            mono
            inputProps={{ step: '0.1', min: '0' }}
          />
          <Field
            label="Horas motor izquierdo"
            type="number"
            value={horasMotorIzq}
            onChange={setHorasMotorIzq}
            mono
            inputProps={{ step: '0.1', min: '0' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Btn variant="ghost" label="Cancelar" onClick={onCancelar} style={{ flex: 1 }} />
          <Btn
            type="submit"
            label={saving ? 'Guardando…' : (inicial ? 'Guardar cambios' : 'Registrar aeronave')}
            disabled={saving || !matricula.trim() || !modeloId}
            style={{ flex: 1 }}
          />
        </div>
      </form>
    </Card>
  )
}
