import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Header } from '../components/Header'
import { ordenesService } from '../api/ordenesService'
import { useAuthStore } from '../store/authStore'
import { T, ROL_LABELS } from '../tokens/design'
import {
  Avatar, Btn, Card, ErrorBanner, FieldTextarea, Hdr, KV, Modal, Pill, Spinner,
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
  const [incluirFotos, setIncluirFotos] = useState(true)
  const [rechazoAbierto, setRechazoAbierto] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [rechazoLoading, setRechazoLoading] = useState(false)

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
  const esSuper = user?.superusuario === true
  const esGerente = esSuper || rolUsuario === 'gerente_soporte'
  const tipoProducto = orden?.producto?.tipoProducto
  const esAeronave = tipoProducto === 'aeronave'
  const esGcs = tipoProducto === 'gcs'

  const soporteFirmado  = Boolean(cierre?.firmaSoporteId)
  const gerenteFirmado  = Boolean(cierre?.firmaGerenteId)
  const pilotoFirmado   = Boolean(cierre?.firmaPilotoId)
  const operadorFirmado = Boolean(cierre?.firmaOperadorId)
  const ordenCerrada    = orden?.estado === 'cerrada'

  // Slot de firma que le corresponde al usuario según su rol.
  const miSlot = useMemo(() => {
    if (rolUsuario === 'gerente_soporte') return 'gerente'
    if (rolUsuario === 'tecnico_soporte' || rolUsuario === 'ingeniero_soporte') return 'soporte'
    if (rolUsuario === 'piloto') return 'piloto'
    if (rolUsuario === 'operador') return 'operador'
    return null
  }, [rolUsuario])

  // ¿El usuario está asignado al slot que le toca?
  const asignadoAMiSlot = useMemo(() => {
    if (!orden || !miSlot) return false
    if (esSuper) return true
    if (miSlot === 'soporte')  return orden.soporte?.id === user.id || orden.ingenieroAuxiliar?.id === user.id
    if (miSlot === 'gerente')  return orden.gerente?.id === user.id
    if (miSlot === 'piloto')   return esAeronave && orden.piloto?.id === user.id
    if (miSlot === 'operador') return esGcs && orden.operador?.id === user.id
    return false
  }, [orden, miSlot, esSuper, esAeronave, esGcs, user?.id])

  const yaFirmoMiRol = useMemo(() => {
    if (!cierre || !miSlot) return false
    if (miSlot === 'soporte')  return soporteFirmado
    if (miSlot === 'gerente')  return gerenteFirmado
    if (miSlot === 'piloto')   return pilotoFirmado
    if (miSlot === 'operador') return operadorFirmado
    return false
  }, [cierre, miSlot, soporteFirmado, gerenteFirmado, pilotoFirmado, operadorFirmado])

  const puedeFirmar = Boolean(cierre) && miSlot && asignadoAMiSlot && !yaFirmoMiRol
    && (miSlot !== 'piloto' || esAeronave)
    && (miSlot !== 'operador' || esGcs)

  // Firmas que aún faltan (para el banner).
  const pendientes = useMemo(() => {
    if (!cierre) return []
    const arr = []
    if (!soporteFirmado) arr.push('Soporte')
    if (!gerenteFirmado) arr.push('Gerente')
    if (esAeronave && !pilotoFirmado) arr.push('Piloto')
    if (esGcs && !operadorFirmado) arr.push('Operador')
    return arr
  }, [cierre, soporteFirmado, gerenteFirmado, pilotoFirmado, operadorFirmado, esAeronave, esGcs])

  const totalFirmas = (esAeronave || esGcs) ? 3 : 2

  const handleFirmar = async () => {
    if (!puedeFirmar) {
      setError('No tienes una firma pendiente que aplicar en esta orden')
      return
    }
    if (!firmaConfirmada) {
      setError('Debe confirmar que está de acuerdo con los datos antes de firmar')
      return
    }
    setSubmitLoading(true)
    setError('')
    try {
      await ordenesService.firmarCierre(id)
      await cargarOrden()
      setFirmaConfirmada(false)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Error firmando cierre')
    } finally {
      setSubmitLoading(false)
    }
  }

  const confirmarRechazo = async () => {
    if (!motivoRechazo.trim()) {
      setError('El motivo del rechazo es obligatorio')
      return
    }
    setRechazoLoading(true)
    try {
      await ordenesService.rechazar(id, motivoRechazo.trim())
      setRechazoAbierto(false)
      setMotivoRechazo('')
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al rechazar la orden')
    } finally {
      setRechazoLoading(false)
    }
  }

  const descargarPDF = async () => {
    try {
      const response = await ordenesService.descargarPDF(id, incluirFotos)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const sufijo = incluirFotos ? '' : '-sin-fotos'
      link.setAttribute('download', `OT-${orden.numeroOt}${sufijo}.pdf`)
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
  const identificador = orden?.producto?.identificador
  const modeloNombre = orden?.producto?.modelo?.nombre

  // Tareas con responsable asignado que aún no han firmado — bloquean el cierre.
  const tareasPendientes = (orden?.resultados || []).filter((r) => r.asignado && !r.firmaTareaPorId)

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
                    {completados} de {totalPuntos} · {identificador} · {modeloNombre}
                  </div>
                </div>
              </div>
            </Card>

            {tareasPendientes.length > 0 && (
              <Card
                padding={16}
                style={{
                  background: T.aD,
                  borderColor: `${T.amber}40`,
                  borderLeft: `3px solid ${T.amber}`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: T.amber, marginBottom: 8 }}>
                  Faltan {tareasPendientes.length} firma{tareasPendientes.length === 1 ? '' : 's'} de tarea asignada
                </div>
                <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.55, marginBottom: 10 }}>
                  El responsable de cada tarea asignada debe firmarla antes de cerrar la orden.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tareasPendientes.map((r) => (
                    <div key={r.id} style={{ fontSize: 12, color: T.text, lineHeight: 1.45 }}>
                      • <strong>{r.punto?.nombreComponente || 'Punto'}</strong>
                      <span style={{ color: T.sub }}> — {r.asignado?.nombre}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

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

        {step === 'firma' && esGerente &&
          (orden?.estado === 'pendiente_firma' || orden?.estado === 'cerrada') && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            marginBottom: 4,
          }}>
            <Btn
              variant="danger"
              label="✗ Rechazar orden"
              onClick={() => { setMotivoRechazo(''); setRechazoAbierto(true) }}
            />
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
                <KV k="Orden"    v={orden?.numeroOt} mono vColor={T.cyan} />
                <KV k="Producto" v={identificador} mono />
                <KV k="Soporte"  v={
                  orden?.soporte ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar usuario={orden.soporte} size={32} />
                      <div>
                        <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{orden.soporte.nombre}</div>
                        {orden.soporte.distintivo && (
                          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.cyan }}>{orden.soporte.distintivo}</div>
                        )}
                      </div>
                    </div>
                  ) : '—'
                } />
                <KV k="Gerente"  v={
                  orden?.gerente ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar usuario={orden.gerente} size={32} />
                      <div>
                        <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{orden.gerente.nombre}</div>
                        {orden.gerente.distintivo && (
                          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.cyan }}>{orden.gerente.distintivo}</div>
                        )}
                      </div>
                    </div>
                  ) : '—'
                } />
                {esAeronave && (
                  <KV k="Piloto" v={
                    orden?.piloto ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar usuario={orden.piloto} size={32} />
                        <div>
                          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{orden.piloto.nombre}</div>
                          {orden.piloto.distintivo && (
                            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.cyan }}>{orden.piloto.distintivo}</div>
                          )}
                        </div>
                      </div>
                    ) : '—'
                  } />
                )}
                {esGcs && (
                  <KV k="Operador" v={
                    orden?.operador ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar usuario={orden.operador} size={32} />
                        <div>
                          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{orden.operador.nombre}</div>
                          {orden.operador.distintivo && (
                            <div style={{ fontFamily: T.mono, fontSize: 10, color: T.cyan }}>{orden.operador.distintivo}</div>
                          )}
                        </div>
                      </div>
                    ) : '—'
                  } />
                )}
              </div>
            </Card>

            {/* Estado de las firmas — la O/T cierra cuando todas están aplicadas */}
            <Card padding={16}>
              <div style={{
                fontSize: 11, color: T.sub, letterSpacing: '0.07em',
                textTransform: 'uppercase', fontWeight: 600, marginBottom: 12,
              }}>Firmas requeridas ({totalFirmas})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FirmaRow
                  rol="Soporte"
                  firmado={soporteFirmado}
                  nombre={cierre?.soporte?.nombre || orden?.soporte?.nombre}
                  fecha={cierre?.fechaFirmaSoporte}
                />
                <FirmaRow
                  rol="Gerente"
                  firmado={gerenteFirmado}
                  nombre={cierre?.gerente?.nombre || orden?.gerente?.nombre}
                  fecha={cierre?.fechaFirmaGerente}
                />
                {esAeronave && (
                  <FirmaRow
                    rol="Piloto"
                    firmado={pilotoFirmado}
                    nombre={cierre?.piloto?.nombre || orden?.piloto?.nombre}
                    fecha={cierre?.fechaFirmaPiloto}
                  />
                )}
                {esGcs && (
                  <FirmaRow
                    rol="Operador"
                    firmado={operadorFirmado}
                    nombre={cierre?.operador?.nombre || orden?.operador?.nombre}
                    fecha={cierre?.fechaFirmaOperador}
                  />
                )}
              </div>
              {!ordenCerrada && pendientes.length > 0 && (
                <div style={{
                  marginTop: 12, padding: '10px 12px',
                  background: T.aD, border: `1px solid ${T.amber}30`,
                  borderRadius: 10, fontSize: 12, color: T.amber, lineHeight: 1.5,
                }}>
                  ⏳ La orden se cerrará cuando firmen: <strong>{pendientes.join(', ')}</strong>.
                </div>
              )}
            </Card>

            {/* Banner de éxito cuando la O/T está cerrada */}
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
                      Las {totalFirmas} firmas fueron registradas. La O/T cambió a estado <strong style={{ color: T.text }}>cerrada</strong>.
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.55, marginBottom: 14 }}>
                  El comprobante en PDF queda disponible para descarga bajo demanda.
                </p>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                  fontSize: 13, color: T.text, cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={incluirFotos}
                    onChange={(e) => setIncluirFotos(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  Incluir fotografías en el PDF
                </label>
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
              puedeFirmar ? (
                <>
                  {/* Identidad del firmante */}
                  <Card
                    padding={18}
                    style={{
                      background: T.gD,
                      borderColor: `${T.green}40`,
                      borderLeft: `3px solid ${T.green}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: T.bg, border: `1px solid ${T.green}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2L4 6v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V6l-8-4z" stroke={T.green} strokeWidth="1.6"/>
                          <path d="M9 12l2 2 4-4" stroke={T.green} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                          Firma Digital Segura
                        </div>
                        <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                          Firmarás el cierre como <strong style={{ color: T.text }}>{slotLabel(miSlot)}</strong>.
                          Tu identidad se registra automáticamente.
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 12, paddingTop: 12, borderTop: `1px solid ${T.green}25`,
                    }}>
                      <KV k="Usuario" v={user?.email} mono />
                      <KV k="Rol" v={
                        <Pill small label={ROL_LABELS[rolUsuario] || rolUsuario} color={T.green} bg={T.gD} />
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
                      Al confirmar, declaro que revisé y ejecuté los puntos de este formato de mantenimiento
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
              ) : (
                <Card padding={18}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>
                    {yaFirmoMiRol ? 'Tu firma ya fue registrada' : 'No puedes firmar esta orden'}
                  </div>
                  <p style={{ fontSize: 12, color: T.sub, lineHeight: 1.55, marginBottom: 14 }}>
                    {yaFirmoMiRol
                      ? `Esperando la firma de: ${pendientes.join(', ') || 'los demás responsables'}.`
                      : 'Solo el soporte, el gerente' + (esAeronave ? ' y el piloto' : esGcs ? ' y el operador' : '') + ' asignados pueden firmar el cierre.'}
                  </p>
                  <Btn
                    variant="ghost"
                    label="Volver al dashboard"
                    onClick={() => navigate('/dashboard')}
                  />
                </Card>
              )
            )}
          </div>
        )}
      </main>

      {/* Modal de rechazo */}
      <Modal
        open={rechazoAbierto}
        onClose={() => setRechazoAbierto(false)}
        title="Rechazar orden"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.55 }}>
            La orden <strong style={{ color: T.text }}>{orden?.numeroOt}</strong> volverá a estado{' '}
            <strong style={{ color: T.amber }}>en proceso</strong>. Se borrarán las firmas del cierre
            y el equipo deberá corregir y volver a firmar. El evento queda registrado en el historial.
          </p>
          <div>
            <div style={{
              fontSize: 11, color: T.sub, fontWeight: 600,
              letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6,
            }}>
              Motivo del rechazo <span style={{ color: T.red }}>*</span>
            </div>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Ej. Falta evidencia fotográfica en el punto 12 y el torque no fue registrado…"
              rows={3}
              autoFocus
              style={{
                width: '100%', minHeight: 80,
                background: T.s2, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: '10px 12px',
                color: T.text, fontSize: 14, fontFamily: T.font,
                resize: 'vertical', outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" label="Cancelar" onClick={() => setRechazoAbierto(false)} style={{ flex: 1 }} />
            <Btn
              variant="danger"
              label={rechazoLoading ? 'Rechazando…' : 'Rechazar orden'}
              onClick={confirmarRechazo}
              disabled={rechazoLoading || !motivoRechazo.trim()}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function slotLabel(slot) {
  if (slot === 'gerente') return 'gerente'
  if (slot === 'piloto') return 'piloto'
  if (slot === 'operador') return 'operador'
  return 'soporte'
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
