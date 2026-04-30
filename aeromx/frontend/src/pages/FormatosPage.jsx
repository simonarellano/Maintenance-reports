import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { formatosService } from '../api/formatosService'
import { useAuthStore } from '../store/authStore'
import { T } from '../tokens/design'
import {
  Btn, BtnSm, Card, ErrorBanner, Field, FieldTextarea, Hdr, Modal, Pill, Spinner,
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

  // Editores modales — { formatoId, seccion?, seccionId?, punto?, bloque? }
  const [seccionEditor, setSeccionEditor] = useState(null)
  const [puntoEditor, setPuntoEditor] = useState(null)
  const [bloqueEditor, setBloqueEditor] = useState(null)

  const esSupervisor = user?.rol === 'supervisor'

  useEffect(() => {
    cargar()
  }, [])

  // El spinner solo se muestra en la primera carga. Los refetches posteriores
  // (tras crear/editar/borrar/reordenar) reemplazan la lista en silencio para
  // que el scroll del usuario no salte al top.
  const cargar = async ({ silencioso = false } = {}) => {
    if (!silencioso) setLoading(true)
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

  // ── Formato ─────────────────────────────────────────────────────────────
  const guardar = async (datos) => {
    try {
      if (editando) {
        await formatosService.actualizar(editando.id, datos)
      } else {
        await formatosService.crear(datos)
      }
      setModoAlta(false)
      setEditando(null)
      await cargar({ silencioso: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando el formato')
    }
  }

  const eliminar = async (formato) => {
    if (!confirm(`¿Eliminar el formato "${formato.nombre}"? Esta acción es irreversible.`)) return
    try {
      await formatosService.eliminar(formato.id)
      await cargar({ silencioso: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Error eliminando el formato')
    }
  }

  // ── Secciones ───────────────────────────────────────────────────────────
  const guardarSeccion = async ({ formatoId, seccion, datos }) => {
    try {
      if (seccion) {
        await formatosService.actualizarSeccion(formatoId, seccion.id, datos)
      } else {
        await formatosService.crearSeccion(formatoId, datos)
      }
      setSeccionEditor(null)
      await cargar({ silencioso: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando la sección')
    }
  }

  const borrarSeccion = async (formatoId, seccion) => {
    if (!confirm(`¿Eliminar la sección "${seccion.nombre}" y todos sus puntos? Esta acción no se puede deshacer.`)) return
    try {
      await formatosService.eliminarSeccion(formatoId, seccion.id)
      await cargar({ silencioso: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Error eliminando la sección')
    }
  }

  // ── Puntos ──────────────────────────────────────────────────────────────
  const guardarPunto = async ({ formatoId, seccionId, punto, datos }) => {
    try {
      if (punto) {
        await formatosService.actualizarPunto(formatoId, seccionId, punto.id, datos)
      } else {
        await formatosService.crearPunto(formatoId, seccionId, datos)
      }
      setPuntoEditor(null)
      await cargar({ silencioso: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando el punto')
    }
  }

  const borrarPunto = async (formatoId, seccionId, punto) => {
    if (!confirm(`¿Eliminar el punto "${punto.nombreComponente}"?`)) return
    try {
      await formatosService.eliminarPunto(formatoId, seccionId, punto.id)
      await cargar({ silencioso: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Error eliminando el punto')
    }
  }

  // ── Bloques de texto ────────────────────────────────────────────────────
  const guardarBloque = async ({ formatoId, bloque, datos }) => {
    try {
      if (bloque) {
        await formatosService.actualizarBloqueTexto(formatoId, bloque.id, datos)
      } else {
        await formatosService.crearBloqueTexto(formatoId, datos)
      }
      setBloqueEditor(null)
      await cargar({ silencioso: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Error guardando el bloque')
    }
  }

  const borrarBloque = async (formatoId, bloque) => {
    if (!confirm(`¿Eliminar el bloque "${bloque.titulo}"?`)) return
    try {
      await formatosService.eliminarBloqueTexto(formatoId, bloque.id)
      await cargar({ silencioso: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Error eliminando el bloque')
    }
  }

  // ── Secuencia (orden del documento) ─────────────────────────────────────
  const guardarSecuencia = async (formatoId, secuencia) => {
    try {
      await formatosService.actualizarSecuencia(formatoId, secuencia)
      await cargar({ silencioso: true })
    } catch (e) {
      setError(e.response?.data?.error || 'Error actualizando el orden del documento')
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
                <FormatoCard
                  key={f.id}
                  formato={f}
                  isOpen={isOpen}
                  totalPuntos={totalPuntos}
                  esSupervisor={esSupervisor}
                  onToggle={() => toggleExpandido(f.id)}
                  onEditar={() => { setEditando(f); setModoAlta(false) }}
                  onEliminar={() => eliminar(f)}
                  onCrearSeccion={() => setSeccionEditor({
                    formatoId: f.id,
                    seccion: null,
                    ordenDefecto: (f.secciones?.length || 0) + 1,
                  })}
                  onEditarSeccion={(seccion) => setSeccionEditor({ formatoId: f.id, seccion })}
                  onBorrarSeccion={(seccion) => borrarSeccion(f.id, seccion)}
                  onCrearPunto={(seccionId) => {
                    const sec = f.secciones?.find((s) => s.id === seccionId)
                    setPuntoEditor({
                      formatoId: f.id,
                      seccionId,
                      punto: null,
                      ordenDefecto: (sec?.puntos?.length || 0) + 1,
                    })
                  }}
                  onEditarPunto={(seccionId, punto) => setPuntoEditor({ formatoId: f.id, seccionId, punto })}
                  onBorrarPunto={(seccionId, punto) => borrarPunto(f.id, seccionId, punto)}
                  onCrearBloque={() => setBloqueEditor({ formatoId: f.id, bloque: null })}
                  onEditarBloque={(bloque) => setBloqueEditor({ formatoId: f.id, bloque })}
                  onBorrarBloque={(bloque) => borrarBloque(f.id, bloque)}
                  onGuardarSecuencia={(seq) => guardarSecuencia(f.id, seq)}
                />
              )
            })}
          </div>
        )}
      </main>

      <SeccionModal
        editor={seccionEditor}
        onCancelar={() => setSeccionEditor(null)}
        onGuardar={guardarSeccion}
      />

      <PuntoModal
        editor={puntoEditor}
        onCancelar={() => setPuntoEditor(null)}
        onGuardar={guardarPunto}
      />

      <BloqueModal
        editor={bloqueEditor}
        onCancelar={() => setBloqueEditor(null)}
        onGuardar={guardarBloque}
      />
    </div>
  )
}

// ── FormatoCard ─────────────────────────────────────────────────────────────
function FormatoCard({
  formato: f, isOpen, totalPuntos, esSupervisor,
  onToggle, onEditar, onEliminar,
  onCrearSeccion, onEditarSeccion, onBorrarSeccion,
  onCrearPunto, onEditarPunto, onBorrarPunto,
  onCrearBloque, onEditarBloque, onBorrarBloque,
  onGuardarSecuencia,
}) {
  return (
    <section style={{
      background: T.s1, border: `1px solid ${T.border}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Cabecera del formato */}
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
              onClick={onToggle}
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
            <BtnSm variant="surface" label="Editar" onClick={onEditar} />
            <BtnSm variant="danger"  label="Eliminar" onClick={onEliminar} />
          </div>
        )}
      </div>

      {/* Cuerpo expandido */}
      {isOpen && (
        <div style={{ padding: '16px 18px' }}>
          {/* Orden del documento — secuencia de elementos del PDF */}
          <OrdenDocumentoPanel
            formato={f}
            esSupervisor={esSupervisor}
            onGuardar={onGuardarSecuencia}
          />

          <div style={{
            height: 1, background: T.border, margin: '20px 0 16px',
          }} />

          {/* Bloques de texto del documento */}
          <BloquesTextoLista
            bloques={f.bloquesTexto || []}
            esSupervisor={esSupervisor}
            onCrear={onCrearBloque}
            onEditar={onEditarBloque}
            onBorrar={onBorrarBloque}
          />

          {/* Separador entre bloques y secciones */}
          <div style={{
            height: 1, background: T.border, margin: '20px 0 16px',
          }} />

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 14, flexWrap: 'wrap', gap: 10,
          }}>
            <div style={{
              fontSize: 11, color: T.sub, textTransform: 'uppercase',
              letterSpacing: '0.08em', fontFamily: T.mono, fontWeight: 600,
            }}>
              Secciones e inspecciones
            </div>
            {esSupervisor && (
              <BtnSm variant="primary" label="+ Nueva sección" onClick={onCrearSeccion} />
            )}
          </div>

          {f.secciones && f.secciones.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {f.secciones.map((sec, idx) => (
                <SeccionBloque
                  key={sec.id}
                  seccion={sec}
                  indice={idx + 1}
                  esSupervisor={esSupervisor}
                  onEditarSeccion={() => onEditarSeccion(sec)}
                  onBorrarSeccion={() => onBorrarSeccion(sec)}
                  onCrearPunto={() => onCrearPunto(sec.id)}
                  onEditarPunto={(punto) => onEditarPunto(sec.id, punto)}
                  onBorrarPunto={(punto) => onBorrarPunto(sec.id, punto)}
                />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: T.sub, fontStyle: 'italic' }}>
              {esSupervisor
                ? 'Este formato aún no tiene secciones. Agrega la primera con "+ Nueva sección".'
                : 'Sin secciones aún'}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// ── Orden del documento ─────────────────────────────────────────────────────
// Built-ins disponibles, en el orden por defecto. Si el formato no tiene una
// secuenciaDocumento definida, este es el orden que se usa.
const BUILTINS_SEQ = [
  'datos_generales',
  'datos_aeronave',
  'personal',
  'trabajos',
  'fotos',
  'dictamen',
  'firmas',
]

const BUILTIN_LABELS = {
  datos_generales: { titulo: 'Datos generales del servicio', desc: 'N.º de orden, cliente, fechas del ciclo de vida' },
  datos_aeronave:  { titulo: 'Datos de la aeronave',          desc: 'Matrícula, modelo, horas de motor' },
  personal:        { titulo: 'Personal responsable',          desc: 'Técnico que realiza y supervisor (tarjetas separadas)' },
  trabajos:        { titulo: 'Trabajos realizados',           desc: 'Tabla de inspección con secciones y puntos' },
  fotos:           { titulo: 'Evidencia fotográfica',         desc: 'Solo aparece si la O/T tiene fotos' },
  dictamen:        { titulo: 'Dictamen y observaciones',      desc: 'Solo aparece al cierre de la O/T' },
  firmas:          { titulo: 'Firmas de conformidad',         desc: 'Bloque de firma del técnico y supervisor' },
}

// Reproduce la lógica del backend: garantiza que TODOS los built-ins y bloques
// estén en la secuencia, con la almacenada (si la hay) determinando el orden.
function resolverSecuenciaCliente(formato) {
  const stored = Array.isArray(formato?.secuenciaDocumento) ? formato.secuenciaDocumento : null
  const bloques = formato?.bloquesTexto || []
  const bloqueIds = new Set(bloques.map((b) => b.id))

  let items = stored && stored.length > 0
    ? stored.filter((it) => {
        if (!it || typeof it !== 'object') return false
        if (it.tipo === 'bloque') return typeof it.id === 'string' && bloqueIds.has(it.id)
        return BUILTINS_SEQ.includes(it.tipo)
      }).map((it) => it.tipo === 'bloque' ? { tipo: 'bloque', id: it.id } : { tipo: it.tipo })
    : BUILTINS_SEQ.map((tipo) => ({ tipo }))

  for (const tipo of BUILTINS_SEQ) {
    if (!items.some((i) => i.tipo === tipo)) items.push({ tipo })
  }
  const presentes = new Set(items.filter((i) => i.tipo === 'bloque').map((i) => i.id))
  for (const b of bloques) {
    if (!presentes.has(b.id)) items.push({ tipo: 'bloque', id: b.id })
  }
  return items
}

function OrdenDocumentoPanel({ formato, esSupervisor, onGuardar }) {
  const [guardando, setGuardando] = useState(false)
  // Orden visual local — se inicializa desde la secuencia resuelta y se sincroniza
  // cada vez que el formato cambia. Los reordenamientos optimistas se aplican aquí
  // primero (UX fluido) y se persisten después.
  const remoto = resolverSecuenciaCliente(formato)
  const [items, setItems] = useState(remoto)
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const [refKey, setRefKey] = useState(0)
  // Resincronizar cuando cambia la secuencia almacenada (e.g. tras añadir
  // bloques) — comparamos signatures para evitar loops.
  const remotoSig = remoto.map((it) => `${it.tipo}:${it.id || ''}`).join('|')
  const localSig  = items.map((it) => `${it.tipo}:${it.id || ''}`).join('|')
  if (remotoSig !== localSig && draggingIdx === null) {
    setItems(remoto)
  }

  const bloquesPorId = Object.fromEntries((formato.bloquesTexto || []).map((b) => [b.id, b]))

  // Pre-calcular el número de sección de cada item: built-ins consumen número
  // (1, 2, 3…); los bloques no — salen como contenido propio en el PDF.
  let acc = 0
  const numeros = items.map((it) => (it.tipo === 'bloque' ? null : ++acc))

  const persistir = async (nueva) => {
    setGuardando(true)
    try {
      await onGuardar(nueva)
    } finally {
      setGuardando(false)
    }
  }

  // ── Drag & drop nativo HTML5 ─────────────────────────────────────────
  const onDragStart = (idx) => (e) => {
    setDraggingIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    // Algunos navegadores exigen setData para iniciar el drag
    try { e.dataTransfer.setData('text/plain', String(idx)) } catch {}
  }

  const onDragOver = (idx) => (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== overIdx) setOverIdx(idx)
  }

  const onDrop = (idx) => async (e) => {
    e.preventDefault()
    const from = draggingIdx
    setDraggingIdx(null)
    setOverIdx(null)
    if (from === null || from === idx) return

    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(idx, 0, moved)
    setItems(next) // optimistic update
    setRefKey((k) => k + 1)
    await persistir(next)
  }

  const onDragEnd = () => {
    setDraggingIdx(null)
    setOverIdx(null)
  }

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div style={{
            fontSize: 11, color: T.sub, textTransform: 'uppercase',
            letterSpacing: '0.08em', fontFamily: T.mono, fontWeight: 600,
          }}>
            Orden del documento
          </div>
          <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
            Arrastra cualquier elemento para reordenar el PDF. Datos, personal, trabajos, bloques — todo se mueve.
          </div>
        </div>
        {guardando && (
          <span style={{ fontSize: 11, color: T.cyan, fontStyle: 'italic' }}>
            Guardando…
          </span>
        )}
      </div>

      <ol style={{
        listStyle: 'none', padding: 0, margin: 0,
        display: 'flex', flexDirection: 'column', gap: 6,
      }} key={refKey}>
        {items.map((item, idx) => {
          const esBloque = item.tipo === 'bloque'
          const bloque = esBloque ? bloquesPorId[item.id] : null
          const meta = esBloque
            ? { titulo: bloque?.titulo || 'Bloque eliminado', desc: 'Bloque de texto del supervisor (Markdown)' }
            : (BUILTIN_LABELS[item.tipo] || { titulo: item.tipo, desc: '' })
          const tipoTag = esBloque ? 'BLOQUE' : item.tipo.replace(/_/g, ' ').toUpperCase()
          const numero = numeros[idx]
          const isDragging = draggingIdx === idx
          const isDropTarget = overIdx === idx && draggingIdx !== null && draggingIdx !== idx

          return (
            <li
              key={`${item.tipo}-${item.id || item.tipo}-${idx}`}
              draggable={esSupervisor && !guardando}
              onDragStart={onDragStart(idx)}
              onDragOver={onDragOver(idx)}
              onDrop={onDrop(idx)}
              onDragEnd={onDragEnd}
              style={{
                background: esBloque ? T.s2 : T.s1,
                border: `1px solid ${isDropTarget ? T.cyan : T.border}`,
                borderLeft: `3px solid ${esBloque ? T.cyan : T.dim}`,
                borderRadius: 10, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                cursor: esSupervisor ? (isDragging ? 'grabbing' : 'grab') : 'default',
                opacity: isDragging ? 0.45 : 1,
                transform: isDropTarget ? 'translateY(-1px)' : 'none',
                boxShadow: isDropTarget ? `0 2px 8px ${T.cyan}40` : 'none',
                transition: 'border-color .12s, transform .12s, box-shadow .12s',
                userSelect: 'none',
              }}
            >
              {esSupervisor && (
                <span
                  title="Arrastrar para reordenar"
                  style={{
                    fontSize: 14, color: T.dim, fontFamily: T.mono,
                    cursor: 'grab', userSelect: 'none', lineHeight: 1,
                  }}
                >⋮⋮</span>
              )}
              <span style={{
                fontSize: 11, color: numero ? T.sub : T.dim, fontFamily: T.mono, minWidth: 24,
              }}>
                {numero ? `${numero}.` : '·'}
              </span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Pill small label={tipoTag} color={esBloque ? T.cyan : T.sub} bg={esBloque ? T.cD : T.s2} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                    {meta.titulo}
                  </span>
                </div>
                {meta.desc && (
                  <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
                    {meta.desc}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ── BloquesTextoLista ───────────────────────────────────────────────────────
function BloquesTextoLista({ bloques, esSupervisor, onCrear, onEditar, onBorrar }) {
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{
          fontSize: 11, color: T.sub, textTransform: 'uppercase',
          letterSpacing: '0.08em', fontFamily: T.mono, fontWeight: 600,
        }}>
          Bloques de texto del documento
        </div>
        {esSupervisor && (
          <BtnSm variant="primary" label="+ Nuevo bloque" onClick={onCrear} />
        )}
      </div>

      {bloques.length === 0 ? (
        <p style={{ fontSize: 12, color: T.dim, fontStyle: 'italic', margin: 0 }}>
          {esSupervisor
            ? 'Sin bloques aún. Agrega alcance, descripciones, notas legales o cualquier sección textual del documento.'
            : 'Sin bloques de texto'}
        </p>
      ) : (
        <ul style={{
          listStyle: 'none', padding: 0, margin: 0,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {bloques.map((b) => (
            <li key={b.id} style={{
              background: T.s2, border: `1px solid ${T.border}`,
              borderLeft: `3px solid ${T.cyan}`,
              borderRadius: 10, padding: '10px 12px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              gap: 10, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: T.text,
                  }}>{b.titulo}</span>
                </div>
                <p style={{
                  fontSize: 12, color: T.sub, margin: '4px 0 0',
                  lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>
                  {b.contenido.length > 240
                    ? b.contenido.slice(0, 240) + '…'
                    : b.contenido}
                </p>
              </div>
              {esSupervisor && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <BtnSm variant="surface" label="Editar" onClick={() => onEditar(b)} />
                  <BtnSm variant="danger"  label="Borrar" onClick={() => onBorrar(b)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── SeccionBloque ───────────────────────────────────────────────────────────
function SeccionBloque({
  seccion: sec, indice, esSupervisor,
  onEditarSeccion, onBorrarSeccion, onCrearPunto, onEditarPunto, onBorrarPunto,
}) {
  return (
    <div style={{
      background: T.s2, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: '12px 14px',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>
            {indice}. {sec.nombre}
            <span style={{
              fontSize: 11, color: T.dim, fontFamily: T.mono, marginLeft: 8, fontWeight: 400,
            }}>
              orden #{sec.orden}
            </span>
          </div>
          {sec.descripcion && (
            <div style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>
              {sec.descripcion}
            </div>
          )}
        </div>
        {esSupervisor && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <BtnSm variant="surface" label="Editar" onClick={onEditarSeccion} />
            <BtnSm variant="danger"  label="Eliminar" onClick={onBorrarSeccion} />
          </div>
        )}
      </div>

      {/* Puntos */}
      <div style={{ marginTop: 10 }}>
        {sec.puntos && sec.puntos.length > 0 ? (
          <ul style={{
            listStyle: 'none', padding: 0, margin: 0,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {sec.puntos.map((p) => (
              <li key={p.id} style={{
                background: T.s1, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: '8px 10px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                gap: 8, flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>
                      {p.nombreComponente}
                    </span>
                    {p.esCritico && (
                      <Pill small label="Crítico" color={T.red} bg={T.rD} />
                    )}
                    {p.fotoRequerida && (
                      <Pill small label="Foto req." color={T.cyan} bg={T.cD} />
                    )}
                    {p.categoria && (
                      <Pill small label={p.categoria} color={T.sub} bg={T.s2} />
                    )}
                  </div>
                  {p.descripcion && (
                    <div style={{ fontSize: 12, color: T.sub, marginTop: 3 }}>
                      {p.descripcion}
                    </div>
                  )}
                </div>
                {esSupervisor && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <BtnSm variant="surface" label="Editar" onClick={() => onEditarPunto(p)} />
                    <BtnSm variant="danger"  label="Borrar" onClick={() => onBorrarPunto(p)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 12, color: T.dim, fontStyle: 'italic', margin: '4px 0 0' }}>
            Sin puntos.
          </p>
        )}

        {esSupervisor && (
          <div style={{ marginTop: 8 }}>
            <BtnSm variant="ghost" label="+ Agregar punto" onClick={onCrearPunto} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── FormularioFormato ───────────────────────────────────────────────────────
// Solo metadatos básicos: nombre y versión. El contenido textual del documento
// (alcance, descripciones, instrucciones, etc.) se gestiona como bloques de
// texto markdown desde la vista expandida del formato.
function FormularioFormato({ inicial, onCancelar, onGuardar }) {
  const [datos, setDatos] = useState(
    inicial || {
      nombre: '',
      version: '1.0',
    }
  )
  const [guardando, setGuardando] = useState(false)

  const setCampo = (k) => (v) => setDatos((prev) => ({ ...prev, [k]: v }))

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (!datos.nombre?.trim()) return alert('El nombre es requerido')

    setGuardando(true)
    try {
      // Solo enviamos los campos del formulario; campos legacy quedan tal cual
      // estén en BD (no se tocan al editar).
      await onGuardar({
        nombre:  datos.nombre,
        version: datos.version,
      })
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
          💡 <strong>Próximo paso:</strong> después de guardar, expande el formato (▶) y agrega <strong>bloques de texto</strong> (alcance, objetivos, descripciones — soportan Markdown) y <strong>secciones de inspección</strong>.
        </div>
      </form>
    </Card>
  )
}

// ── SeccionModal ────────────────────────────────────────────────────────────
function SeccionModal({ editor, onCancelar, onGuardar }) {
  const [datos, setDatos] = useState({ nombre: '', descripcion: '', orden: 1 })
  const [guardando, setGuardando] = useState(false)

  // Reinicia el formulario cuando cambia el editor (abrir/cambiar)
  useEffect(() => {
    if (!editor) return
    if (editor.seccion) {
      setDatos({
        nombre:      editor.seccion.nombre || '',
        descripcion: editor.seccion.descripcion || '',
        orden:       editor.seccion.orden ?? 1,
      })
    } else {
      setDatos({ nombre: '', descripcion: '', orden: editor.ordenDefecto ?? 1 })
    }
  }, [editor])

  if (!editor) return null

  const enviar = async (e) => {
    e.preventDefault()
    if (!datos.nombre?.trim()) return alert('El nombre de la sección es requerido')
    setGuardando(true)
    try {
      await onGuardar({
        formatoId: editor.formatoId,
        seccion:   editor.seccion,
        datos: {
          nombre:      datos.nombre.trim(),
          descripcion: datos.descripcion?.trim() || null,
          orden:       Number(datos.orden) || 1,
        },
      })
    } finally {
      setGuardando(false)
    }
  }

  const setCampo = (k) => (v) => setDatos((prev) => ({ ...prev, [k]: v }))

  return (
    <Modal
      open
      onClose={guardando ? undefined : onCancelar}
      title={editor.seccion ? 'Editar sección' : 'Nueva sección'}
      maxWidth={520}
    >
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field
          label="Nombre"
          required
          value={datos.nombre}
          onChange={setCampo('nombre')}
          placeholder="Ej. Alas, Tren Delantero, Electrónica"
        />
        <FieldTextarea
          label="Descripción"
          value={datos.descripcion}
          onChange={setCampo('descripcion')}
          placeholder="(Opcional) Notas o contexto de la sección"
          rows={2}
        />
        <Field
          label="Orden"
          type="number"
          value={datos.orden}
          onChange={setCampo('orden')}
          placeholder="1"
          mono
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" label="Cancelar" onClick={onCancelar} disabled={guardando} />
          <Btn
            type="submit"
            label={guardando ? 'Guardando…' : 'Guardar'}
            disabled={guardando}
          />
        </div>
      </form>
    </Modal>
  )
}

// ── PuntoModal ──────────────────────────────────────────────────────────────
function PuntoModal({ editor, onCancelar, onGuardar }) {
  const [datos, setDatos] = useState({
    nombreComponente: '',
    categoria: '',
    descripcion: '',
    esCritico: false,
    fotoRequerida: false,
    orden: 1,
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!editor) return
    if (editor.punto) {
      setDatos({
        nombreComponente: editor.punto.nombreComponente || '',
        categoria:        editor.punto.categoria || '',
        descripcion:      editor.punto.descripcion || '',
        esCritico:        Boolean(editor.punto.esCritico),
        fotoRequerida:    Boolean(editor.punto.fotoRequerida),
        orden:            editor.punto.orden ?? 1,
      })
    } else {
      setDatos({
        nombreComponente: '', categoria: '', descripcion: '',
        esCritico: false, fotoRequerida: false,
        orden: editor.ordenDefecto ?? 1,
      })
    }
  }, [editor])

  if (!editor) return null

  const enviar = async (e) => {
    e.preventDefault()
    if (!datos.nombreComponente?.trim()) return alert('El nombre del componente es requerido')
    setGuardando(true)
    try {
      await onGuardar({
        formatoId:  editor.formatoId,
        seccionId:  editor.seccionId,
        punto:      editor.punto,
        datos: {
          nombreComponente: datos.nombreComponente.trim(),
          categoria:        datos.categoria?.trim() || null,
          descripcion:      datos.descripcion?.trim() || null,
          esCritico:        datos.esCritico,
          fotoRequerida:    datos.fotoRequerida,
          orden:            Number(datos.orden) || 1,
        },
      })
    } finally {
      setGuardando(false)
    }
  }

  const setCampo = (k) => (v) => setDatos((prev) => ({ ...prev, [k]: v }))

  return (
    <Modal
      open
      onClose={guardando ? undefined : onCancelar}
      title={editor.punto ? 'Editar punto de inspección' : 'Nuevo punto de inspección'}
      maxWidth={580}
    >
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field
          label="Componente"
          required
          value={datos.nombreComponente}
          onChange={setCampo('nombreComponente')}
          placeholder="Ej. Tren delantero, Hélice, Motor derecho"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field
            label="Categoría"
            value={datos.categoria}
            onChange={setCampo('categoria')}
            placeholder="Ej. Mecánico, Eléctrico"
          />
          <Field
            label="Orden"
            type="number"
            value={datos.orden}
            onChange={setCampo('orden')}
            placeholder="1"
            mono
          />
        </div>
        <FieldTextarea
          label="Descripción del trabajo"
          value={datos.descripcion}
          onChange={setCampo('descripcion')}
          placeholder="(Opcional) Detalle de la inspección o trabajo a realizar"
          rows={3}
        />

        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap',
          background: T.s2, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '12px 14px',
        }}>
          <CheckboxLabel
            label="Punto crítico (requiere firma individual)"
            checked={datos.esCritico}
            onChange={setCampo('esCritico')}
          />
          <CheckboxLabel
            label="Foto requerida"
            checked={datos.fotoRequerida}
            onChange={setCampo('fotoRequerida')}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" label="Cancelar" onClick={onCancelar} disabled={guardando} />
          <Btn
            type="submit"
            label={guardando ? 'Guardando…' : 'Guardar'}
            disabled={guardando}
          />
        </div>
      </form>
    </Modal>
  )
}

// ── BloqueModal ─────────────────────────────────────────────────────────────
// El orden de aparición del bloque NO se edita aquí — se controla desde el
// panel "Orden del documento" del formato (drag/up-down). Aquí solo título +
// contenido en markdown.
function BloqueModal({ editor, onCancelar, onGuardar }) {
  const [datos, setDatos] = useState({ titulo: '', contenido: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!editor) return
    if (editor.bloque) {
      setDatos({
        titulo:    editor.bloque.titulo || '',
        contenido: editor.bloque.contenido || '',
      })
    } else {
      setDatos({ titulo: '', contenido: '' })
    }
  }, [editor])

  if (!editor) return null

  const enviar = async (e) => {
    e.preventDefault()
    if (!datos.titulo?.trim())     return alert('El título es requerido')
    if (!datos.contenido?.trim())  return alert('El contenido es requerido')
    setGuardando(true)
    try {
      await onGuardar({
        formatoId: editor.formatoId,
        bloque:    editor.bloque,
        datos: {
          titulo:    datos.titulo.trim(),
          contenido: datos.contenido,
          // El backend exige orden >= 0; mandamos uno arbitrario y la posición
          // real se gestiona vía el panel de Orden del documento.
          orden:     editor.bloque?.orden ?? 1,
        },
      })
    } finally {
      setGuardando(false)
    }
  }

  const setCampo = (k) => (v) => setDatos((prev) => ({ ...prev, [k]: v }))

  return (
    <Modal
      open
      onClose={guardando ? undefined : onCancelar}
      title={editor.bloque ? 'Editar bloque de texto' : 'Nuevo bloque de texto'}
      maxWidth={640}
    >
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field
          label="Título"
          required
          value={datos.titulo}
          onChange={setCampo('titulo')}
          placeholder="Ej. Alcance del servicio, Notas legales, Aplicación"
        />
        <FieldTextarea
          label="Contenido (soporta Markdown)"
          required
          value={datos.contenido}
          onChange={setCampo('contenido')}
          placeholder={'## Subtítulo\n\nPárrafo con **negrita** y *cursiva*.\n\n- Punto uno\n- Punto dos\n\n1. Paso uno\n2. Paso dos\n\n> Nota importante'}
          rows={10}
          minHeight={180}
        />
        <div style={{
          background: T.s2, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '10px 12px',
          fontSize: 11, color: T.sub, lineHeight: 1.6,
        }}>
          <strong style={{ color: T.cyan }}>Sintaxis soportada:</strong>{' '}
          <code style={{ fontFamily: T.mono, color: T.text }}>## Título</code>{' · '}
          <code style={{ fontFamily: T.mono, color: T.text }}>### Subtítulo</code>{' · '}
          <code style={{ fontFamily: T.mono, color: T.text }}>**negrita**</code>{' · '}
          <code style={{ fontFamily: T.mono, color: T.text }}>*cursiva*</code>{' · '}
          <code style={{ fontFamily: T.mono, color: T.text }}>- viñeta</code>{' · '}
          <code style={{ fontFamily: T.mono, color: T.text }}>1. lista numerada</code>{' · '}
          <code style={{ fontFamily: T.mono, color: T.text }}>{'> nota'}</code>{'. '}
          Línea en blanco = nuevo párrafo.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" label="Cancelar" onClick={onCancelar} disabled={guardando} />
          <Btn
            type="submit"
            label={guardando ? 'Guardando…' : 'Guardar'}
            disabled={guardando}
          />
        </div>
      </form>
    </Modal>
  )
}

function CheckboxLabel({ label, checked, onChange }) {
  return (
    <label style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      cursor: 'pointer', fontSize: 13, color: T.text,
    }}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: T.cyan, cursor: 'pointer' }}
      />
      {label}
    </label>
  )
}
