import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { T, ROL_LABELS } from '../tokens/design'

// ── Hook: matchMedia para detectar mobile ─────────────────────
function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [breakpoint])
  return isMobile
}

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const esSupervisor = user?.rol === 'supervisor'
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Cerrar drawer al cambiar de ruta
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [drawerOpen])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const links = [
    { to: '/dashboard',  label: 'Órdenes',    show: true },
    { to: '/flota',      label: 'Flota',      show: true },
    { to: '/aeronaves',  label: 'Aeronaves',  show: esSupervisor },
    { to: '/modelos',    label: 'Modelos',    show: esSupervisor },
    { to: '/formatos',   label: 'Formatos',   show: esSupervisor },
    { to: '/usuarios',   label: 'Usuarios',   show: esSupervisor },
  ].filter((l) => l.show)

  const initials = (user?.nombre || user?.email || '?')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  const navButton = (l, { mobile } = {}) => {
    const active = location.pathname.startsWith(l.to)
    return (
      <button
        key={l.to}
        onClick={() => navigate(l.to)}
        style={{
          padding: mobile ? '12px 14px' : '8px 14px',
          borderRadius: 10,
          background: active ? T.cD : 'transparent',
          color: active ? T.cyan : T.sub,
          border: active ? `1px solid ${T.cyan}30` : '1px solid transparent',
          fontSize: mobile ? 14 : 13, fontWeight: 600,
          cursor: 'pointer',
          transition: 'color .15s, background .15s',
          fontFamily: T.font,
          width: mobile ? '100%' : 'auto',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = T.text }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = T.sub }}
      >
        {l.label}
      </button>
    )
  }

  return (
    <>
      <header style={{
        background: 'rgba(9,11,18,0.94)',
        backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${T.border}`,
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {/* Hamburger (solo mobile) */}
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              style={{
                width: 40, height: 40, borderRadius: 11,
                background: T.s1, border: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <path d="M1 1h16M1 7h16M1 13h16" stroke={T.text} strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Logo + brand */}
          <div
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <img
              src="/logo.png"
              alt="AeroMX Logo"
              style={{
                width: 70, height: 38, borderRadius: 3,
                objectFit: 'contain'
              }}
            />
            {!isMobile && (
              <div style={{
                fontSize: 9, color: T.sub, letterSpacing: '0.12em',
                textTransform: 'uppercase', marginTop: 0,
                fontFamily: T.mono,
              }}>Gestion de Mantenimientos</div>
            )}
          </div>

          {/* Nav inline (desktop) */}
          {!isMobile && (
            <nav style={{
              display: 'flex', alignItems: 'center', gap: 4,
              flex: 1, flexWrap: 'wrap', marginLeft: 10,
            }}>
              {links.map((l) => navButton(l))}
            </nav>
          )}

          {/* Spacer en mobile para empujar usuario al borde */}
          {isMobile && <div style={{ flex: 1 }} />}

          {/* User + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {!isMobile && (
              <div style={{ textAlign: 'right', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.1 }}>
                  {user?.nombre || '—'}
                </div>
                <div style={{
                  fontSize: 10, color: T.sub, letterSpacing: '0.06em',
                  textTransform: 'uppercase', marginTop: 2,
                }}>
                  {ROL_LABELS[user?.rol] || user?.rol}
                </div>
              </div>
            )}
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: T.cD, border: `1px solid ${T.cyan}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.cyan, fontSize: 13, fontWeight: 700,
              fontFamily: T.font, flexShrink: 0,
            }}>{initials}</div>
            {!isMobile && (
              <button
                onClick={handleLogout}
                title="Cerrar sesión"
                style={{
                  background: T.rD, color: T.red,
                  border: `1px solid rgba(255,69,69,0.30)`,
                  borderRadius: 10, padding: '8px 14px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: T.font, transition: 'opacity .15s',
                }}
              >Salir</button>
            )}
          </div>
        </div>
      </header>

      {/* Drawer lateral (mobile) */}
      {isMobile && drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(9,11,18,0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 50,
              animation: 'aeromx-fade-in .18s ease-out',
            }}
          />
          <aside style={{
            position: 'fixed', top: 0, left: 0, bottom: 0,
            width: 280, maxWidth: '85vw',
            background: T.bg, borderRight: `1px solid ${T.border}`,
            zIndex: 51, padding: '18px 16px',
            display: 'flex', flexDirection: 'column',
            boxShadow: '8px 0 32px rgba(0,0,0,0.6)',
            animation: 'aeromx-slide-in .22s ease-out',
          }}>
            {/* Header del drawer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10, marginBottom: 18,
            }}>
              <img
                src="/logo.png"
                alt="AeroMX Logo"
                style={{ width: 70, height: 38, objectFit: 'contain' }}
              />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: T.s1, border: `1px solid ${T.border}`,
                  color: T.sub, fontSize: 18, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>

            {/* Datos del usuario */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: T.s1, border: `1px solid ${T.border}`,
              borderRadius: 12, padding: '12px 14px', marginBottom: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: T.cD, border: `1px solid ${T.cyan}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.cyan, fontSize: 13, fontWeight: 700,
                flexShrink: 0,
              }}>{initials}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: T.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{user?.nombre || '—'}</div>
                <div style={{
                  fontSize: 10, color: T.sub, letterSpacing: '0.06em',
                  textTransform: 'uppercase', marginTop: 2,
                }}>
                  {ROL_LABELS[user?.rol] || user?.rol}
                </div>
              </div>
            </div>

            {/* Nav del drawer */}
            <div style={{
              fontSize: 10, color: T.sub, letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: 600, marginBottom: 6, padding: '0 4px',
            }}>Navegación</div>
            <nav style={{
              display: 'flex', flexDirection: 'column', gap: 4, flex: 1,
            }}>
              {links.map((l) => navButton(l, { mobile: true }))}
            </nav>

            {/* Footer del drawer */}
            <button
              onClick={handleLogout}
              style={{
                background: T.rD, color: T.red,
                border: `1px solid rgba(255,69,69,0.30)`,
                borderRadius: 10, padding: '12px 14px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: T.font, marginTop: 10,
                width: '100%',
              }}
            >Cerrar sesión</button>
          </aside>
        </>
      )}
    </>
  )
}
