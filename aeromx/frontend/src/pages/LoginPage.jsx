import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../store/authStore'
import { authService } from '../api/authService'
import { T } from '../tokens/design'
import { Btn, DroneMark, ErrorBanner, Field } from '../components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const login = useAuthStore((state) => state.login)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      email: 'tecnico@aeromx.com',
      password: 'aeromx123'
    }
  })

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const onSubmit = async (data) => {
    setLoading(true)
    setError('')
    try {
      const response = await authService.login(data.email, data.password)
      const { user, token } = response.data
      login(user, token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Error en autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow ambient */}
      <div style={{
        position: 'absolute',
        top: '-200px', right: '-200px',
        width: 500, height: 500, borderRadius: '50%',
        background: T.cD, filter: 'blur(120px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-200px', left: '-200px',
        width: 500, height: 500, borderRadius: '50%',
        background: T.pD, filter: 'blur(120px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column', gap: 32,
        position: 'relative',
      }}>
        {/* Logo + branding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <img 
            src="/logo.png" 
            alt="Hydra Logo" 
            style={{
              width: 170, height: 100, borderRadius: 10,
              objectFit: 'contain',
              border: `1px solid ${T.border}`,
            }} 
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 34, fontWeight: 700, color: T.text,
              letterSpacing: '-0.03em',
            }}></div>
            <div style={{
              fontSize: 12, color: T.sub, marginTop: 4,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>Sistema de Mantenimiento</div>
          </div>
        </div>

        {/* Form card */}
        <div style={{
          background: T.s1, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: 28,
          boxShadow: T.shadow,
        }}>
          <ErrorBanner onClose={() => setError('')}>{error}</ErrorBanner>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field
              label="Correo Electrónico"
              type="email"
              placeholder="usuario@aeromx.com"
              register={register('email', { required: 'El correo es obligatorio' })}
              error={errors.email?.message}
            />
            <Field
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              register={register('password', { required: 'La contraseña es obligatoria' })}
              error={errors.password?.message}
            />
            <div style={{ marginTop: 8 }}>
              <Btn
                type="submit"
                disabled={loading}
                label={loading ? 'Verificando…' : 'Iniciar Sesión'}
                style={{ width: '100%' }}
              />
            </div>
          </form>
        </div>

        {/* Hint card de credenciales */}
        <div style={{
          background: T.s1, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: '12px 14px',
        }}>
          <div style={{
            fontSize: 10, color: T.sub, letterSpacing: '0.07em',
            textTransform: 'uppercase', fontWeight: 600, marginBottom: 8,
          }}>Credenciales de prueba</div>
          <div style={{
            fontSize: 11, color: T.sub, fontFamily: T.mono, lineHeight: 1.7,
          }}>
            <div>tecnico@aeromx.com · aeromx123</div>
            <div>ingeniero@aeromx.com · aeromx123</div>
            <div>supervisor@aeromx.com · aeromx123</div>
          </div>
        </div>

        <div style={{
          textAlign: 'center', fontSize: 11,
          color: T.dim, fontFamily: T.mono,
        }}>AeroMX v1.0 · 2026</div>
      </div>
    </div>
  )
}
