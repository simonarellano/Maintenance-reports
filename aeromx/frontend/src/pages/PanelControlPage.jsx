import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { useAuthStore } from '../store/authStore'
import { T } from '../tokens/design'
import { Card, Hdr } from '../components/ui'

const TARJETAS = [
  {
    slug: 'formatos',
    icono: '📋',
    titulo: 'Formatos',
    descripcion: 'Plantillas de mantenimiento y falla por tipo de producto',
    to: '/formatos',
  },
  {
    slug: 'usuarios',
    icono: '👥',
    titulo: 'Usuarios',
    descripcion: 'Alta y edición del personal del sistema',
    to: '/usuarios',
  },
  {
    slug: 'modelos',
    icono: '🛩',
    titulo: 'Modelos',
    descripcion: 'Catálogo de modelos por tipo de producto',
    to: '/modelos',
  },
  {
    slug: 'categorias-falla',
    icono: '⚠',
    titulo: 'Categorías de falla',
    descripcion: 'Taxonomía de fallas para reportes',
    to: '/categorias-falla',
  },
]

export default function PanelControlPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const esSuper = user?.superusuario === true
  const puedePanel = esSuper || user?.rol === 'gerente_soporte'

  useEffect(() => {
    if (!puedePanel) {
      navigate('/dashboard', { replace: true })
    }
  }, [puedePanel, navigate])

  if (!puedePanel) return null

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Header />
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px 60px' }}>
        <Hdr
          title="Panel de control"
          sub="Administración del sistema"
          back={() => navigate('/dashboard')}
        />
        <p style={{ color: T.sub, fontSize: 13, marginTop: -8, marginBottom: 24 }}>
          Catálogos y configuración del sistema. Selecciona una sección.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {TARJETAS.map((t) => (
            <Card
              key={t.slug}
              hoverable
              onClick={() => navigate(t.to)}
              padding={20}
              style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 140 }}
            >
              <div style={{ fontSize: 32, lineHeight: 1 }}>{t.icono}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{t.titulo}</div>
              <div style={{ fontSize: 13, color: T.sub, flex: 1 }}>{t.descripcion}</div>
              <div style={{ fontSize: 12, color: T.cyan, fontWeight: 600, marginTop: 4 }}>
                Abrir →
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
