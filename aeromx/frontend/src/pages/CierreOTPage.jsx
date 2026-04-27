import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Header } from '../components/Header'
import { ordenesService } from '../api/ordenesService'
import { useAuthStore } from '../store/authStore'
import { T, ROL_LABELS } from '../tokens/design'
import {
  Btn, Card, ErrorBanner, FieldTextarea, Hdr, KV, Pill, Spinner,
} from '../components/ui'

export default function CierreOTPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [orden, setOrden] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [step, setStep] = useState('resumen') // 'resumen' o 'firma'
  const [firmaConfirmada, setFirmaConfirmada] = useState(false)

  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      seEncontroDefecto: false,
      refDocCorrectivo: '',
      observacionesGenerales: '',
    }
  })

  const seEncontroDefecto = watch('seEncontroDefecto')

  useEffect(() => {
    cargarOrden()
  }, [id])

  const cargarOrden = async () => {
    try {
      const response = await ordenesService.obtener(id)
      setOrden(response.data)
      // Si la orden ya tiene cierre creado, saltar al paso de firma
      if (response.data.cierre) {
        setStep('firma')
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
      await ordenesService.crearCierre(id, data)
      // Recargar para que cierre quede visible y avanzar a firma
      await cargarOrden()
      setStep('firma')
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Error creando cierre')
    } finally {
      setSubmitLoading(false)
    }
  }

  // ── Estado derivado de las firmas ──
  const cierre = orden?.cierre
  const rolUsuario = user?.rol
  const tecnicoFirmado    = Boolean(cierre?.firmaTecnicoId)
  const supervisorFirmado = Boolean(cierre?.firmaSupervisorId)
  const ordenCerrada      = orden?.estado === 'cerrada'

  // ¿El rol del usuario actual ya firmó?
  const yaFirmoMiRol = useMemo(() => {
    if (!cierre || !rolUsuario) return false
    if (rolUsuario === 'tecnico' || rolUsuario === 'ingeniero') return tecnicoFirmado
    if (rolUsuario === 'supervisor') return supervisorFirmado
    return false
  }, [cierre, rolUsuario, tecnicoFirmado, supervisorFirmado])

  // Etiqueta del rol que aún falta por firmar
  const rolPendiente = useMemo(() => {
    if (!cierre) return null
    if (!tecnicoFirmado && !supervisorFirmado) return null
    if (!tecnicoFirmado) return 'Técnico / Ingeniero'
    if (!supervisorFirmado) return 'Supervisor'
    return null
  }, [cierre, tecnicoFirmado, supervisorFirmado])

  const handleFirmar = async () => {
    if (yaFirmoMiRol) {
      setError('Tu firma ya fue registrada para esta orden')
      return
    }
    if (!firmaConfirmada) {
      setError('Debe confirmar que está de acuerdo con los datos antes de firmar')
      return
    }
    setSubmitLoading(true)
    setError('')
    try {
      const firmaData = { tipo: rolUsuario }
      await ordenesService.firmarCierre(id, firmaData)
      await cargarOrden()
      // El check sólo se desmarca después de firmar correctamente; el botón
      // queda deshabilitado por `yaFirmoMiRol`, así que no hay rebote.
      setFirmaConfirmada(false)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Error firmando cierre')
      // Mantenemos el check marcado para que el usuario no tenga que volver a tildarlo si reintenta.
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
      setError('Error descargando el PDF')
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg }}>
        <Header />
        <Spinner label="Cargando orden…" />
      </div>
    )
  }

  const totalPuntos = orden?.resultados?.length || 0
  const completados = orden?.resultados?.filter((r) => r.completado).length || 0
  const todosCompletos = totalPuntos > 0 && completados === totalPuntos

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 60px' }}>
        <Hdr
          title="Cierre de O/T"
          sub={orden?.numeroOt}
          back={() => navigate(`/ordenes/${id}/inspeccion`)}
        />

        {/* Stepper */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          {[
            { id: 'resumen', label: '1. Cierre' },
            { id: 'firma',   label: '2. Firma' },
          ].map((s) => {
            const active = step === s.id
            const done = step === 'firma' && s.id === 'resumen'
            return (
              <div key={s.id} style={{
                flex: 1,
                padding: '12px 14px', borderRadius: 12,
                background: active ? T.cD : (done ? T.gD : T.s2),
                border: `1px solid ${active ? T.cyan : (done ? T.green : T.border)}40`,
                color: active ? T.cyan : (done ? T.green : T.sub),
                fontSize: 13, fontWeight: 600, textAlign: 'center',
                letterSpacing: '0.04em',
              }}>{s.label}</div>
            )
          })}
        </div>

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {step === 'resumen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card
              padding={16}
              style={{
                background: todosCompletos ? T.gD : T.aD,
                borderColor: `${todosCompletos ? T.green : T.amber}40`,
                borderLeft: `3px solid ${todosCompletos ? T.green : T.amber}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: todosCompletos ? T.green : T.amber,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {todosCompletos ? (
                    <svg width="16" height="13" viewBox="0 0 14 11">
                      <path d="M1 5l5 5L13 1" stroke={T.bg} strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span style={{ color: T.bg, fontWeight: 700, fontSize: 18 }}>!</span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: todosCompletos ? T.green : T.amber }}>
                    {todosCompletos ? 'Todos los puntos completados' : 'Hay puntos sin completar'}
                  </div>
                  <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                    {completados} de {totalPuntos} · {orden?.aeronave?.matricula} · {orden?.aeronave?.modelo?.nombre}
                  </div>
                </div>
              </div>
            </Card>

            <Card padding={20}>
              <form onSubmit={handleSubmit(onSubmitCierre)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 10,
                  }}>¿Se encontró algún defecto?</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { v: true,  label: 'Sí', c: T.red,   bg: T.rD },
                      { v: false, label: 'No', c: T.green, bg: T.gD },
                    ].map((opt) => {
                      const active = seEncontroDefecto === opt.v
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setValue('seEncontroDefecto', opt.v)}
                          style={{
                            flex: 1, height: 48, borderRadius: 12,
                            background: active ? opt.bg : T.s2,
                            border: `2px solid ${active ? opt.c : T.border}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontWeight: 600, fontSize: 15,
                            color: active ? opt.c : T.sub,
                            transition: 'all .15s',
                            fontFamily: T.font,
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {seEncontroDefecto && (
                  <div>
                    <div style={{
                      fontSize: 11, color: T.sub, fontWeight: 600,
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      marginBottom: 6,
                    }}>
                      Ref. Documento Correctivo <span style={{ color: T.red }}>*</span>
                    </div>
                    <input
                      {...register('refDocCorrectivo')}
                      placeholder="RNC-2026-XXX"
                      style={{
                        width: '100%',
                        background: T.s2, border: `1px solid ${T.border}`,
                        borderRadius: 10, padding: '11px 13px',
                        color: T.text, fontFamily: T.mono, fontSize: 14,
                        outline: 'none',
                      }}
                    />
                  </div>
                )}

                <FieldTextarea
                  label="Observaciones Generales"
                  register={register('observacionesGenerales')}
                  placeholder="Notas adicionales del mantenimiento…"
                  rows={4}
                  minHeight={88}
                />

                <div style={{ display: 'flex', gap: 12 }}>
                  <Btn
                    variant="ghost"
                    label="Cancelar"
                    onClick={() => navigate(`/ordenes/${id}/inspeccion`)}
                    style={{ flex: 1 }}
                  />
                  <Btn
                    type="submit"
                    label={submitLoading ? 'Guardando…' : 'Continuar a Firma →'}
                    disabled={submitLoading}
                    style={{ flex: 1 }}
                  />
                </div>
              </form>
            </Card>
          </div>
        )}

        {step === 'firma' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Datos de la orden */}
            <Card padding={16}>
              <div style={{
                fontSize: 11, color: T.sub, letterSpacing: '0.07em',
                textTransform: 'uppercase', fontWeight: 600, marginBottom: 12,
              }}>Datos de la orden</div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14,
              }}>
                <KV k="Orden"      v={orden?.numeroOt} mono vColor={T.cyan} />
                <KV k="Aeronave"   v={orden?.aeronave?.matricula} mono />
                <KV k="Técnico"    v={orden?.tecnico?.nombre} />
                <KV k="Supervisor" v={orden?.supervisor?.nombre} />
              </div>
            </Card>

            {/* Estado de las firmas — la O/T cierra cuando ambas están aplicadas */}
            <Card padding={16}>
              <div style={{
                fontSize: 11, color: T.sub, letterSpacing: '0.07em',
                textTransform: 'uppercase', fontWeight: 600, marginBottom: 12,
              }}>Firmas requeridas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FirmaRow
                  rol="Técnico / Ingeniero"
                  firmado={tecnicoFirmado}
                  nombre={cierre?.tecnico?.nombre || orden?.tecnico?.nombre}
                  fecha={cierre?.fechaFirmaTecnico}
                />
                <FirmaRow
                  rol="Supervisor"
                  firmado={supervisorFirmado}
                  nombre={cierre?.supervisor?.nombre || orden?.supervisor?.nombre}
                  fecha={cierre?.fechaFirmaSupervisor}
                />
              </div>
              {!ordenCerrada && rolPendiente && (
                <div style={{
                  marginTop: 12, padding: '10px 12px',
                  background: T.aD, border: `1px solid ${T.amber}30`,
                  borderRadius: 10, fontSize: 12, color: T.amber, lineHeight: 1.5,
                }}>
                  ⏳ La orden se cerrará automáticamente cuando firme el <strong>{rolPendiente}</strong>.
                </div>
              )}
            </Card>

            {/* Banner de éxito cuando la O/T está cerrada — siempre visible una vez cerrada */}
            {ordenCerrada && (
              <Card
                padding={20}
                style={{
                  background: T.gD,
                  borderColor: `${T.green}50`,
                  borderLeft: `3px solid ${T.green}`,
                  boxShadow: T.glowGreen,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: T.green,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="18" height="14" viewBox="0 0 14 11">
                      <path d="M1 5l5 5L13 1" stroke={T.bg} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.green }}>
                      Orden cerrada y firmada
                    </div>
                    <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                      Ambas firmas fueron registradas. La O/T cambió a estado <strong style={{ color: T.text }}>cerrada</strong>.
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.55, marginBottom: 14 }}>
                  El comprobante en PDF queda disponible para descarga bajo demanda.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Btn
                    label="📥 Descargar comprobante"
                    onClick={descargarPDF}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <Btn
                    variant="ghost"
                    label="Volver al dashboard"
                    onClick={() => navigate('/dashboard')}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                </div>
              </Card>
            )}

            {/* Bloque de firma — sólo si la O/T no está cerrada */}
            {!ordenCerrada && (
              <>
                {/* Identidad del firmante */}
                <Card
                  padding={18}
                  style={{
                    background: yaFirmoMiRol ? T.s1 : T.gD,
                    borderColor: yaFirmoMiRol ? T.border : `${T.green}40`,
                    borderLeft: `3px solid ${yaFirmoMiRol ? T.sub : T.green}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: T.bg, border: `1px solid ${yaFirmoMiRol ? T.border : T.green + '40'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4z" stroke={yaFirmoMiRol ? T.sub : T.green} strokeWidth="1.6"/>
                        <path d="M9 12l2 2 4-4" stroke={yaFirmoMiRol ? T.sub : T.green} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                        {yaFirmoMiRol ? 'Tu firma ya fue registrada' : 'Firma Digital Segura'}
                      </div>
                      <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                        {yaFirmoMiRol
                          ? `Esperando la firma del ${rolPendiente || 'otro firmante'} para cerrar la O/T.`
                          : 'Tu identidad será registrada automáticamente.'}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12, paddingTop: 12, borderTop: `1px solid ${yaFirmoMiRol ? T.border : T.green}25`,
                  }}>
                    <KV k="Usuario" v={user?.email} mono />
                    <KV k="Rol" v={
                      <Pill
                        small
                        label={ROL_LABELS[rolUsuario] || rolUsuario}
                        color={yaFirmoMiRol ? T.sub : T.green}
                        bg={yaFirmoMiRol ? T.s2 : T.gD}
                      />
                    } />
                    <KV
                      k="Fecha y hora"
                      v={new Date().toLocaleString('es-MX', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                      mono
                    />
                  </div>
                </Card>

                {/* Confirmación + botón — sólo si el rol del usuario aún no firmó */}
                {!yaFirmoMiRol && (
                  <>
                    <label
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: T.s1, border: `1px solid ${firmaConfirmada ? T.cyan + '50' : T.border}`,
                        borderRadius: 12, padding: '14px 16px',
                        cursor: 'pointer', transition: 'border-color .15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={firmaConfirmada}
                        onChange={(e) => setFirmaConfirmada(e.target.checked)}
                        style={{ width: 18, height: 18, flexShrink: 0 }}
                      />
                      <span style={{ color: T.text, fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>
                        Confirmo que he revisado los datos y autorizo el cierre de esta orden de trabajo
                      </span>
                    </label>

                    <Card padding={14}>
                      <p style={{ fontSize: 11, color: T.sub, lineHeight: 1.6 }}>
                        Al confirmar, declaro que revisé y ejecuté todos los puntos de este formato de mantenimiento
                        conforme a los procedimientos establecidos. Esta firma digital queda registrada en bitácora
                        con identidad, rol y timestamp.
                      </p>
                    </Card>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <Btn
                        variant="ghost"
                        label="← Volver"
                        onClick={() => navigate(`/ordenes/${id}/inspeccion`)}
                        style={{ flex: 1 }}
                      />
                      <Btn
                        variant={firmaConfirmada ? 'green' : 'ghost'}
                        label={submitLoading ? 'Firmando…' : '✓ Firmar'}
                        onClick={handleFirmar}
                        disabled={submitLoading || !firmaConfirmada}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </>
                )}

                {/* Si ya firmé pero falta el otro: solo botón volver */}
                {yaFirmoMiRol && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Btn
                      variant="ghost"
                      label="Volver al dashboard"
                      onClick={() => navigate('/dashboard')}
                      style={{ flex: 1 }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Fila por firma ────────────────────────────────────────────
function FirmaRow({ rol, firmado, nombre, fecha }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: firmado ? T.gD : T.s2,
      border: `1px solid ${firmado ? T.green + '35' : T.border}`,
      borderRadius: 10, padding: '10px 14px',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: firmado ? T.green : T.s1,
        border: `1px solid ${firmado ? T.green : T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {firmado ? (
          <svg width="13" height="10" viewBox="0 0 14 11">
            <path d="M1 5l5 5L13 1" stroke={T.bg} strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <span style={{ color: T.sub, fontSize: 13, fontWeight: 700 }}>·</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, color: T.sub, letterSpacing: '0.07em',
          textTransform: 'uppercase', fontWeight: 600,
        }}>{rol}</div>
        <div style={{
          fontSize: 13, color: T.text, fontWeight: 600, marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{nombre || 'Por asignar'}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {firmado ? (
          <>
            <div style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>✓ Firmado</div>
            {fecha && (
              <div style={{ fontSize: 10, color: T.sub, fontFamily: T.mono, marginTop: 2 }}>
                {new Date(fecha).toLocaleString('es-MX', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            )}
          </>
        ) : (
          <span style={{ fontSize: 11, color: T.sub, fontStyle: 'italic' }}>Pendiente</span>
        )}
      </div>
    </div>
  )
}
