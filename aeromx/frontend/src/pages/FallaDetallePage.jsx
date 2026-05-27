import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { fallasService } from '../api/fallasService'
import { usuariosService } from '../api/usuariosService'
import { ordenesService } from '../api/ordenesService'
import { useAuthStore } from '../store/authStore'
import {
  T, ESTADO_FALLA, SEVERIDAD, TIPO_PRODUCTO, ROL_LABELS,
} from '../tokens/design'
import {
  Btn, BtnSm, Card, ErrorBanner, FieldSelect, FieldTextarea, Hdr,
  KV, Modal, Pill, Spinner,
} from '../components/ui'

// Roles que pueden ser asignados como responsable de una falla
const ROLES_RESPONSABLE = ['tecnico_soporte', 'ingeniero_soporte', 'mecanico', 'gerente_soporte']

export default function FallaDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [falla, setFalla] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Asignar responsable
  const [showAsignar, setShowAsignar] = useState(false)
  const [usuarios, setUsuarios] = useState([])
  const [responsableId, setResponsableId] = useState('')
  const [asignarLoading, setAsignarLoading] = useState(false)

  // Resolver
  const [showResolver, setShowResolver] = useState(false)
  const [accionCorrectiva, setAccionCorrectiva] = useState('')
  const [ordenCorrectivaId, setOrdenCorrectivaId] = useState('')
  const [ordenes, setOrdenes] = useState([])
  const [resolverLoading, setResolverLoading] = useState(false)

  useEffect(() => { cargarFalla() }, [id])

  const cargarFalla = async () => {
    try {
      const { data } = await fallasService.obtener(id)
      setFalla(data)
      setError('')
    } catch (e) {
      console.error(e)
      setError('Error cargando el reporte de falla')
    } finally {
      setLoading(false)
    }
  }

  // ── Permisos ──────────────────────────────────────────────────
  const esSuper      = user?.superusuario === true
  const esGerente    = esSuper || user?.rol === 'gerente_soporte'
  const esSoporte    = esSuper || ['tecnico_soporte', 'ingeniero_soporte', 'gerente_soporte'].includes(user?.rol)
  const esResponsable = falla?.responsable?.id === user?.id
  const puedeAsignar = esGerente
  const puedeResolver = falla && falla.estado !== 'resuelta' && (esSuper || esSoporte || esResponsable)
  const estaResuelta = falla?.estado === 'resuelta'
  // Evidencia de resolución: quien puede resolver, incluso después de resuelta
  const puedeEvidenciaResolucion = esSuper || esSoporte || esResponsable

  // ── Abrir modal de asignación ─────────────────────────────────
  const abrirAsignar = async () => {
    setResponsableId(falla?.responsable?.id || '')
    setShowAsignar(true)
    if (usuarios.length === 0) {
      try {
        const { data } = await usuariosService.listar({ activo: true })
        setUsuarios(data || [])
      } catch (e) {
        console.error(e)
      }
    }
  }

  const confirmarAsignar = async () => {
    if (!responsableId) {
      setError('Selecciona un responsable')
      return
    }
    setAsignarLoading(true)
    try {
      await fallasService.asignarResponsable(id, responsableId)
      setShowAsignar(false)
      await cargarFalla()
    } catch (e) {
      setError(e.response?.data?.error || 'Error asignando responsable')
    } finally {
      setAsignarLoading(false)
    }
  }

  // ── Abrir modal de resolución ─────────────────────────────────
  const abrirResolver = async () => {
    setAccionCorrectiva('')
    setOrdenCorrectivaId('')
    setShowResolver(true)
    if (ordenes.length === 0) {
      try {
        // Cargar órdenes cerradas como posibles órdenes correctivas
        const { data } = await ordenesService.listar({ estado: 'cerrada' })
        setOrdenes(data || [])
      } catch (e) {
        console.error(e)
        // No-op: el selector de O/T es opcional
      }
    }
  }

  const confirmarResolver = async () => {
    if (!accionCorrectiva.trim()) {
      setError('La acción correctiva es obligatoria')
      return
    }
    setResolverLoading(true)
    try {
      const body = { accionCorrectiva: accionCorrectiva.trim() }
      if (ordenCorrectivaId) body.ordenCorrectivaId = ordenCorrectivaId
      await fallasService.resolver(id, body)
      setShowResolver(false)
      await cargarFalla()
    } catch (e) {
      setError(e.response?.data?.error || 'Error resolviendo la falla')
    } finally {
      setResolverLoading(false)
    }
  }

  // ── Fotos ─────────────────────────────────────────────────────
  const handleSubirFoto = async (file, etapa) => {
    try {
      await fallasService.subirFoto(id, file, etapa)
      await cargarFalla()
    } catch (e) {
      setError(e.response?.data?.error || 'Error subiendo la foto')
    }
  }

  const handleEliminarFoto = async (fotoId) => {
    if (!confirm('¿Eliminar esta foto?')) return
    try {
      await fallasService.eliminarFoto(id, fotoId)
      await cargarFalla()
    } catch (e) {
      setError(e.response?.data?.error || 'Error eliminando la foto')
    }
  }

  // ── Descarga de PDF (con Bearer token — igual que DashboardPage) ──
  const descargarPDF = async () => {
    try {
      const response = await fallasService.descargarPDF(id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `Falla-${falla?.numeroFalla || id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)
    } catch (e) {
      console.error(e)
      setError('Error descargando el PDF')
    }
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg }}>
        <Header />
        <Spinner label="Cargando reporte de falla…" />
      </div>
    )
  }

  if (!falla && !loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg }}>
        <Header />
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px' }}>
          <ErrorBanner onClose={() => setError('')}>{error || 'No se encontró el reporte'}</ErrorBanner>
          <Btn variant="ghost" label="← Volver a fallas" onClick={() => navigate('/fallas')} />
        </main>
      </div>
    )
  }

  const estadoMeta = ESTADO_FALLA[falla.estado] || { label: falla.estado, color: T.sub }
  const severidadMeta = SEVERIDAD[falla.severidad] || { label: falla.severidad, color: T.sub }
  const tipoMeta = TIPO_PRODUCTO[falla.producto?.tipoProducto] || { label: 'Producto', icon: '📦', c: T.sub, bg: T.s2 }

  // Opciones de usuarios para el selector de responsable
  const opcionesResponsable = usuarios
    .filter((u) => ROLES_RESPONSABLE.includes(u.rol))
    .map((u) => ({
      value: u.id,
      label: `${u.nombre} — ${ROL_LABELS[u.rol] || u.rol}`,
    }))

  // Opciones de órdenes cerradas para el selector de O/T correctiva
  const opcionesOrdenes = ordenes.map((o) => ({
    value: o.id,
    label: `${o.numeroOt} · ${o.producto?.identificador || ''}`,
  }))

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* ── Cabecera ── */}
        <Hdr
          title={falla.titulo}
          sub={falla.numeroFalla}
          back={() => navigate('/fallas')}
          right={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn
                variant="ghost"
                label="📥 PDF"
                onClick={descargarPDF}
              />
              {puedeAsignar && !estaResuelta && (
                <Btn
                  variant="surface"
                  label="👤 Asignar responsable"
                  onClick={abrirAsignar}
                />
              )}
              {puedeResolver && (
                <Btn
                  variant="green"
                  label="✓ Resolver"
                  onClick={abrirResolver}
                />
              )}
            </div>
          }
        />

        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {/* ── Timeline de estado ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {Object.entries(ESTADO_FALLA).map(([key, meta]) => {
            const activo = falla.estado === key
            const ordenEstados = ['detectada', 'en_proceso', 'resuelta']
            const idxActual = ordenEstados.indexOf(falla.estado)
            const idxEste = ordenEstados.indexOf(key)
            const completado = idxEste < idxActual
            return (
              <div
                key={key}
                style={{
                  flex: 1, minWidth: 110,
                  padding: '10px 14px', borderRadius: 12,
                  background: activo
                    ? `${meta.color}20`
                    : completado ? `${T.green}15` : T.s2,
                  border: `1px solid ${activo ? meta.color : completado ? T.green : T.border}40`,
                  textAlign: 'center',
                  fontSize: 12, fontWeight: 600,
                  color: activo ? meta.color : completado ? T.green : T.sub,
                  letterSpacing: '0.04em',
                }}
              >
                {completado && <span style={{ marginRight: 4 }}>✓</span>}
                {meta.label}
              </div>
            )
          })}
        </div>

        {/* ── Clasificación ── */}
        <Card padding={16} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, color: T.sub, letterSpacing: '0.07em',
            textTransform: 'uppercase', fontWeight: 600, marginBottom: 12,
          }}>Clasificación</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <Pill
              label={`${severidadMeta.label}`}
              color={severidadMeta.color}
              bg={`${severidadMeta.color}20`}
            />
            <Pill
              label={estadoMeta.label}
              color={estadoMeta.color}
              bg={`${estadoMeta.color}20`}
            />
            {falla.categoria && (
              <Pill
                label={falla.categoria.nombre}
                color={falla.categoria.color || T.cyan}
                bg={`${falla.categoria.color || T.cyan}20`}
              />
            )}
            <Pill
              label={`${tipoMeta.icon} ${tipoMeta.label}`}
              color={tipoMeta.c}
              bg={tipoMeta.bg}
              small
            />
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 14,
          }}>
            <KV k="N.º Falla" v={falla.numeroFalla} mono vColor={T.cyan} />
            {falla.componente && <KV k="Componente" v={falla.componente} />}
            {falla.origen && (
              <KV k="Origen" v={
                { mantenimiento: 'Mantenimiento', prevuelo: 'Prevuelo', operacion: 'Operación' }[falla.origen] || falla.origen
              } />
            )}
            <KV
              k="Fecha detección"
              v={falla.fechaDeteccion
                ? new Date(falla.fechaDeteccion).toLocaleDateString('es-MX', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                  })
                : '—'}
            />
          </div>
        </Card>

        {/* ── Producto ── */}
        {falla.producto && (
          <Card padding={16} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, color: T.sub, letterSpacing: '0.07em',
              textTransform: 'uppercase', fontWeight: 600, marginBottom: 12,
            }}>Producto afectado</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 14,
            }}>
              <KV k="Identificador" v={falla.producto.identificador} mono />
              <KV k="Modelo" v={falla.producto.modelo?.nombre} />
              {falla.producto.numeroSerie && <KV k="N.º Serie" v={falla.producto.numeroSerie} mono />}
              <KV k="Tipo" v={`${tipoMeta.icon} ${tipoMeta.label}`} />
            </div>
          </Card>
        )}

        {/* ── Descripción ── */}
        <Card padding={16} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, color: T.sub, letterSpacing: '0.07em',
            textTransform: 'uppercase', fontWeight: 600, marginBottom: 10,
          }}>Descripción de la falla</div>
          <p style={{
            fontSize: 14, color: T.text, lineHeight: 1.65,
            whiteSpace: 'pre-wrap', margin: 0,
          }}>
            {falla.descripcion || '—'}
          </p>
        </Card>

        {/* ── Personal ── */}
        <Card padding={16} style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 11, color: T.sub, letterSpacing: '0.07em',
            textTransform: 'uppercase', fontWeight: 600, marginBottom: 12,
          }}>Personal</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
          }}>
            <KV k="Reportado por" v={falla.reportadoPor?.nombre || '—'} />
            <KV
              k="Responsable"
              v={
                falla.responsable
                  ? falla.responsable.nombre
                  : (
                    <span style={{ color: T.amber, fontStyle: 'italic' }}>Sin asignar</span>
                  )
              }
            />
            {falla.resueltoPor && (
              <KV k="Resuelto por" v={falla.resueltoPor.nombre} />
            )}
          </div>
        </Card>

        {/* ── Órdenes vinculadas ── */}
        {(falla.ordenOrigen || falla.ordenCorrectiva) && (
          <Card padding={16} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, color: T.sub, letterSpacing: '0.07em',
              textTransform: 'uppercase', fontWeight: 600, marginBottom: 12,
            }}>Órdenes vinculadas</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {falla.ordenOrigen && (
                <OrdenLink
                  label="O/T de origen"
                  orden={falla.ordenOrigen}
                  onClick={() => navigate(`/ordenes/${falla.ordenOrigen.id}/inspeccion`)}
                />
              )}
              {falla.ordenCorrectiva && (
                <OrdenLink
                  label="O/T correctiva"
                  orden={falla.ordenCorrectiva}
                  onClick={() => navigate(`/ordenes/${falla.ordenCorrectiva.id}/inspeccion`)}
                />
              )}
            </div>
          </Card>
        )}

        {/* ── Resolución ── */}
        {estaResuelta && (
          <Card
            padding={16}
            style={{
              marginBottom: 16,
              background: T.gD,
              borderColor: `${T.green}40`,
              borderLeft: `3px solid ${T.green}`,
            }}
          >
            <div style={{
              fontSize: 11, color: T.green, letterSpacing: '0.07em',
              textTransform: 'uppercase', fontWeight: 600, marginBottom: 10,
            }}>✓ Falla resuelta</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 14, marginBottom: falla.accionCorrectiva ? 14 : 0,
            }}>
              {falla.resueltoPor && <KV k="Por" v={falla.resueltoPor.nombre} />}
              {falla.fechaResolucion && (
                <KV
                  k="Fecha"
                  v={new Date(falla.fechaResolucion).toLocaleDateString('es-MX', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                  })}
                />
              )}
            </div>
            {falla.accionCorrectiva && (
              <>
                <div style={{
                  fontSize: 11, color: T.sub, letterSpacing: '0.07em',
                  textTransform: 'uppercase', fontWeight: 600,
                  marginBottom: 6,
                }}>Acción correctiva</div>
                <p style={{
                  fontSize: 14, color: T.text, lineHeight: 1.65,
                  whiteSpace: 'pre-wrap', margin: 0,
                }}>
                  {falla.accionCorrectiva}
                </p>
              </>
            )}
          </Card>
        )}

        {/* ── Evidencia fotográfica por etapa ── */}
        <GaleriaEvidencia
          titulo="Evidencia al reportar"
          icon="📸"
          fotos={(falla.fotos || []).filter((f) => (f.etapa || 'reporte') === 'reporte')}
          puedeEditar={!estaResuelta}
          onSubir={(file) => handleSubirFoto(file, 'reporte')}
          onEliminar={handleEliminarFoto}
        />
        <GaleriaEvidencia
          titulo="Evidencia al resolver"
          icon="🔧"
          fotos={(falla.fotos || []).filter((f) => f.etapa === 'resolucion')}
          puedeEditar={puedeEvidenciaResolucion}
          onSubir={(file) => handleSubirFoto(file, 'resolucion')}
          onEliminar={handleEliminarFoto}
        />

        {/* ── Botones de acción inferiores ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn
            variant="ghost"
            label="← Volver a fallas"
            onClick={() => navigate('/fallas')}
          />
          {puedeAsignar && !estaResuelta && (
            <Btn
              variant="surface"
              label="👤 Asignar responsable"
              onClick={abrirAsignar}
            />
          )}
          {puedeResolver && (
            <Btn
              variant="green"
              label="✓ Resolver falla"
              onClick={abrirResolver}
            />
          )}
          <Btn
            variant="ghost"
            label="📥 Descargar PDF"
            onClick={descargarPDF}
          />
        </div>
      </main>

      {/* ── Modal: asignar responsable ── */}
      <Modal
        open={showAsignar}
        onClose={() => setShowAsignar(false)}
        title="Asignar responsable"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.55, margin: 0 }}>
            Selecciona el técnico o ingeniero responsable de atender la falla{' '}
            <strong style={{ color: T.text }}>{falla?.numeroFalla}</strong>.
            La falla pasará a estado <strong style={{ color: T.amber }}>en proceso</strong>.
          </p>
          <FieldSelect
            label="Responsable"
            required
            value={responsableId}
            onChange={setResponsableId}
            placeholder="Selecciona un responsable…"
            options={opcionesResponsable}
          />
          {opcionesResponsable.length === 0 && usuarios.length > 0 && (
            <p style={{ fontSize: 12, color: T.amber }}>
              No hay usuarios activos con los roles requeridos.
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn
              variant="ghost"
              label="Cancelar"
              onClick={() => setShowAsignar(false)}
              style={{ flex: 1 }}
            />
            <Btn
              label={asignarLoading ? 'Asignando…' : 'Confirmar asignación'}
              disabled={asignarLoading || !responsableId}
              onClick={confirmarAsignar}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal: resolver falla ── */}
      <Modal
        open={showResolver}
        onClose={() => setShowResolver(false)}
        title="Resolver falla"
        maxWidth={540}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13, color: T.sub, lineHeight: 1.55, margin: 0 }}>
            Documenta la acción correctiva aplicada para cerrar la falla{' '}
            <strong style={{ color: T.text }}>{falla?.numeroFalla}</strong>.
          </p>

          <div>
            <div style={{
              fontSize: 11, color: T.sub, fontWeight: 600,
              letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6,
            }}>
              Acción correctiva <span style={{ color: T.red }}>*</span>
            </div>
            <textarea
              value={accionCorrectiva}
              onChange={(e) => setAccionCorrectiva(e.target.value)}
              placeholder="Describe la acción correctiva realizada…"
              rows={4}
              autoFocus
              style={{
                width: '100%', minHeight: 100,
                background: T.s2, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: '10px 12px',
                color: T.text, fontSize: 14, fontFamily: T.font,
                resize: 'vertical', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <FieldSelect
            label="O/T correctiva (opcional)"
            value={ordenCorrectivaId}
            onChange={setOrdenCorrectivaId}
            placeholder="Selecciona la O/T correctiva…"
            options={opcionesOrdenes}
          />
          {opcionesOrdenes.length === 0 && (
            <p style={{ fontSize: 11, color: T.sub, margin: 0 }}>
              No hay órdenes cerradas disponibles para vincular (opcional).
            </p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn
              variant="ghost"
              label="Cancelar"
              onClick={() => setShowResolver(false)}
              style={{ flex: 1 }}
            />
            <Btn
              variant="green"
              label={resolverLoading ? 'Resolviendo…' : 'Resolver falla'}
              disabled={resolverLoading || !accionCorrectiva.trim()}
              onClick={confirmarResolver}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Componente: enlace a O/T ──────────────────────────────────
function OrdenLink({ label, orden, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: T.s2, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: '10px 14px',
        cursor: 'pointer', transition: 'border-color .15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${T.cyan}40` }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border }}
    >
      <div>
        <div style={{
          fontSize: 9, color: T.sub, textTransform: 'uppercase',
          letterSpacing: '0.07em', fontWeight: 600, marginBottom: 2,
        }}>{label}</div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.text,
          fontFamily: T.mono,
        }}>{orden.numeroOt}</div>
      </div>
      <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
        <path d="M1 1l5 5-5 5" stroke={T.sub} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ── Componente: galería de evidencia de una etapa ─────────────
function GaleriaEvidencia({ titulo, icon, fotos, puedeEditar, onSubir, onEliminar }) {
  const inputRef = useRef(null)
  const [loading, setLoading] = useState(false)

  const handleChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      await onSubir(file)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Card padding={16} style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 14,
      }}>
        <div style={{
          fontSize: 11, color: T.sub, letterSpacing: '0.07em',
          textTransform: 'uppercase', fontWeight: 600,
        }}>
          {icon} {titulo}
          {fotos.length > 0 && (
            <span style={{ color: T.cyan, marginLeft: 6 }}>({fotos.length})</span>
          )}
        </div>
        {puedeEditar && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleChange}
            />
            <BtnSm
              variant="surface"
              label={loading ? 'Subiendo…' : '+ Foto'}
              disabled={loading}
              onClick={() => inputRef.current?.click()}
            />
          </>
        )}
      </div>

      {fotos.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '20px 0',
          color: T.sub, fontSize: 13,
        }}>
          Sin fotografías.{puedeEditar && ' Agrega evidencia con el botón "+ Foto".'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
        }}>
          {fotos.map((foto) => (
            <FotoCard
              key={foto.id}
              foto={foto}
              puedeEliminar={puedeEditar}
              onEliminar={() => onEliminar(foto.id)}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Componente: miniatura de foto ─────────────────────────────
function FotoCard({ foto, puedeEliminar, onEliminar }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      style={{
        position: 'relative', borderRadius: 10, overflow: 'hidden',
        background: T.s2, border: `1px solid ${T.border}`,
        aspectRatio: '1 / 1',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <img
        src={foto.urlArchivo}
        alt={foto.nombreArchivo || 'Evidencia'}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          display: 'block',
        }}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
      {/* Overlay con nombre y botón de eliminar */}
      {hover && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(9,11,18,0.78)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: 8,
        }}>
          <div style={{
            fontSize: 10, color: T.sub, textAlign: 'center',
            wordBreak: 'break-all', lineHeight: 1.3, maxWidth: '100%',
          }}>
            {foto.nombreArchivo}
          </div>
          {puedeEliminar && (
            <BtnSm
              variant="danger"
              label="🗑 Eliminar"
              onClick={(e) => { e.stopPropagation(); onEliminar() }}
            />
          )}
        </div>
      )}
    </div>
  )
}
