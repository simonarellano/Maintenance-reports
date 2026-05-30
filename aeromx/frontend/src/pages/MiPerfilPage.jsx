import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { useAuthStore } from '../store/authStore'
import { usuariosService } from '../api/usuariosService'
import { T, ROL_LABELS } from '../tokens/design'
import { Avatar, Btn, BtnSm, Card, ErrorBanner, Field, Hdr, Spinner } from '../components/ui'

const MAX_FOTO_BYTES = 2 * 1024 * 1024
const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp']
const MAX_DISTINTIVO = 16
const MAX_DESCRIPCION = 200

export default function MiPerfilPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser) // si no existe en el store, ver Step 2

  const [perfil, setPerfil] = useState(null)
  const [distintivo, setDistintivo] = useState('')
  const [descripcionPuesto, setDescripcion] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const { data } = await usuariosService.obtenerMe()
      setPerfil(data)
      setDistintivo(data.distintivo || '')
      setDescripcion(data.descripcionPuesto || '')
      setError('')
    } catch (e) {
      setError('Error cargando perfil')
    } finally {
      setLoading(false)
    }
  }

  const guardar = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await usuariosService.actualizarMe({
        distintivo: distintivo.trim() || null,
        descripcionPuesto: descripcionPuesto.trim() || null,
      })
      setPerfil(data)
      if (setUser) setUser(data) // refresca avatar del Header
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando perfil')
    } finally {
      setSaving(false)
    }
  }

  const onPickFile = () => fileRef.current?.click()

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reseleccionar el mismo archivo
    if (!file) return
    if (!TIPOS_OK.includes(file.type)) {
      setError('Tipo de imagen no permitido (JPG, PNG o WebP)')
      return
    }
    if (file.size > MAX_FOTO_BYTES) {
      setError('La foto excede 2MB')
      return
    }
    setUploading(true)
    try {
      const { data } = await usuariosService.subirFoto(perfil.id, file)
      setPerfil(data)
      if (setUser) setUser(data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Error subiendo foto')
    } finally {
      setUploading(false)
    }
  }

  const eliminarFoto = async () => {
    if (!confirm('¿Eliminar tu foto de perfil?')) return
    setUploading(true)
    try {
      const { data } = await usuariosService.eliminarFoto(perfil.id)
      setPerfil(data)
      if (setUser) setUser(data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Error eliminando foto')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
        <Spinner />
      </main>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 60px' }}>
        <Hdr title="Mi perfil" sub="Foto, distintivo y descripción" back={() => navigate('/dashboard')} />
        <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

        {/* Foto */}
        <Card padding={20} style={{ marginBottom: 16, display: 'flex', gap: 20, alignItems: 'center' }}>
          <Avatar usuario={perfil} size={120} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }} onChange={onFileSelected} />
            <BtnSm label={uploading ? 'Subiendo…' : 'Cambiar foto'} onClick={onPickFile} disabled={uploading} />
            {perfil?.fotoUrl && (
              <BtnSm label="Eliminar" onClick={eliminarFoto} disabled={uploading} />
            )}
            <div style={{ fontSize: 11, color: T.sub }}>JPG / PNG / WebP · ≤ 2MB</div>
          </div>
        </Card>

        {/* Datos públicos */}
        <Card padding={20} style={{ marginBottom: 16 }}>
          <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label={`Distintivo (callsign, ≤ ${MAX_DISTINTIVO})`}>
              <input
                value={distintivo}
                onChange={(e) => setDistintivo(e.target.value)}
                maxLength={MAX_DISTINTIVO}
                placeholder="HALCON-01"
                style={inputStyle()}
                onInput={(e) => { e.currentTarget.value = e.currentTarget.value.toUpperCase() }}
              />
            </Field>
            <Field label={`Descripción del puesto (≤ ${MAX_DESCRIPCION})`}>
              <textarea
                value={descripcionPuesto}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={MAX_DESCRIPCION}
                rows={3}
                style={{ ...inputStyle(), resize: 'vertical', fontFamily: T.font }}
              />
            </Field>
            <Btn label={saving ? 'Guardando…' : 'Guardar'} type="submit" disabled={saving} />
          </form>
        </Card>

        {/* Identidad (read-only) */}
        <Card padding={20}>
          <div style={{ fontSize: 11, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Identidad
          </div>
          <RowReadonly label="Nombre"   value={perfil?.nombre} />
          <RowReadonly label="Email"    value={perfil?.email} />
          <RowReadonly label="Rol"      value={ROL_LABELS[perfil?.rol] || perfil?.rol} />
          <RowReadonly label="Licencia" value={perfil?.licenciaNum || '—'} />
          <div style={{ fontSize: 11, color: T.sub, marginTop: 12 }}>
            Solo el gerente puede modificar estos campos.
          </div>
        </Card>
      </main>
    </div>
  )
}

function RowReadonly({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.sub }}>{label}</span>
      <span style={{ fontSize: 13, color: T.text }}>{value || '—'}</span>
    </div>
  )
}

function inputStyle() {
  return {
    width: '100%',
    background: T.s0, border: `1px solid ${T.border}`,
    borderRadius: 10, padding: '10px 12px',
    color: T.text, fontSize: 14, fontFamily: T.font,
    outline: 'none',
  }
}
