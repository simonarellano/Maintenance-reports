import { T } from '../tokens/design'

// ── DroneMark (logo SVG) ──────────────────────────────────────
export function DroneMark({ size = 40, color = T.cyan }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <line x1="22" y1="22" x2="9"  y2="9"  stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="22" y1="22" x2="35" y2="9"  stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="22" y1="22" x2="9"  y2="35" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="22" y1="22" x2="35" y2="35" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="9"  cy="9"  r="5" stroke={color} strokeWidth="2"/>
      <circle cx="35" cy="9"  r="5" stroke={color} strokeWidth="2"/>
      <circle cx="9"  cy="35" r="5" stroke={color} strokeWidth="2"/>
      <circle cx="35" cy="35" r="5" stroke={color} strokeWidth="2"/>
      <rect x="16" y="16" width="12" height="12" rx="3.5" fill={color} opacity="0.9"/>
      <rect x="20" y="20" width="4" height="4" rx="1" fill={T.bg} opacity="0.8"/>
    </svg>
  )
}

// ── Pill / Badge ──────────────────────────────────────────────
export function Pill({ label, color, bg, small, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: small ? '2px 8px' : '3px 10px',
      borderRadius: 999,
      background: bg || T.s2,
      color: color || T.sub,
      fontSize: small ? 10 : 11,
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      fontFamily: T.font,
      whiteSpace: 'nowrap',
    }}>
      {children || label}
    </span>
  )
}

// ── Btn ───────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary: { bg: T.cyan,        c: T.bg,    border: 'none' },
  ghost:   { bg: 'transparent', c: T.sub,   border: `1px solid ${T.border}` },
  danger:  { bg: T.rD,          c: T.red,   border: `1px solid rgba(255,69,69,0.40)` },
  surface: { bg: T.s2,          c: T.text,  border: `1px solid ${T.border}` },
  amber:   { bg: T.aD,          c: T.amber, border: `1px solid rgba(240,160,48,0.40)` },
  green:   { bg: T.gD,          c: T.green, border: `1px solid rgba(40,217,128,0.40)` },
}

export function Btn({
  label, children, onClick, variant = 'primary', disabled, type = 'button',
  icon, title, style,
}) {
  const s = BTN_VARIANTS[variant] || BTN_VARIANTS.primary
  return (
    <button
      type={type}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 8,
        height: 50,
        padding: '0 18px',
        borderRadius: 14,
        background: disabled ? T.s2 : s.bg,
        color: disabled ? T.dim : s.c,
        border: s.border,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 15, fontWeight: 600,
        fontFamily: T.font,
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity .15s, transform .1s',
        outline: 'none',
        ...style,
      }}
    >
      {icon}
      {label || children}
    </button>
  )
}

// Variante compacta — para acciones secundarias inline
export function BtnSm({ label, children, onClick, variant = 'ghost', disabled, title, style }) {
  const s = BTN_VARIANTS[variant] || BTN_VARIANTS.ghost
  return (
    <button
      type="button"
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        height: 32, padding: '0 12px', borderRadius: 10,
        background: disabled ? T.s2 : s.bg,
        color: disabled ? T.dim : s.c,
        border: s.border,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12, fontWeight: 600,
        fontFamily: T.font,
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity .15s',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label || children}
    </button>
  )
}

// ── Field (input con label) ───────────────────────────────────
export function Field({
  label, value, onChange, placeholder, type = 'text', mono, error,
  required, disabled, autoComplete, inputProps, register, rightAdornment,
}) {
  const inputStyle = {
    background: T.s2,
    border: `1px solid ${error ? `${T.red}80` : T.border}`,
    borderRadius: 10,
    padding: '11px 13px',
    color: T.text,
    fontSize: 15,
    fontFamily: mono ? T.mono : T.font,
    outline: 'none',
    width: '100%',
    transition: 'border-color .15s',
    opacity: disabled ? 0.55 : 1,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span style={{
          fontSize: 11, fontWeight: 600, color: T.sub,
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          {label}{required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
        </span>
      )}
      <div style={{ position: 'relative' }}>
        {register ? (
          <input
            {...register}
            type={type}
            placeholder={placeholder || ''}
            autoComplete={autoComplete}
            disabled={disabled}
            style={inputStyle}
            {...inputProps}
          />
        ) : (
          <input
            value={value ?? ''}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={placeholder || ''}
            type={type}
            autoComplete={autoComplete}
            disabled={disabled}
            style={inputStyle}
            {...inputProps}
          />
        )}
        {rightAdornment && (
          <div style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          }}>
            {rightAdornment}
          </div>
        )}
      </div>
      {error && (
        <span style={{ fontSize: 11, color: T.red, marginTop: 2 }}>{error}</span>
      )}
    </div>
  )
}

// Select con la misma estética que Field
export function FieldSelect({ label, value, onChange, options, required, register, error, disabled, placeholder }) {
  const selectStyle = {
    background: T.s2,
    border: `1px solid ${error ? `${T.red}80` : T.border}`,
    borderRadius: 10,
    padding: '11px 13px',
    color: T.text,
    fontSize: 15,
    fontFamily: T.font,
    outline: 'none',
    width: '100%',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3e%3cpath d='M1 1L6 6L11 1' stroke='%236070a0' stroke-width='1.5' fill='none' stroke-linecap='round'/%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 13px center',
    paddingRight: 36,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span style={{
          fontSize: 11, fontWeight: 600, color: T.sub,
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          {label}{required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
        </span>
      )}
      {register ? (
        <select {...register} disabled={disabled} style={selectStyle}>
          {placeholder && <option value="">{placeholder}</option>}
          {options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <select
          value={value ?? ''}
          onChange={(e) => onChange && onChange(e.target.value)}
          disabled={disabled}
          style={selectStyle}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {error && (
        <span style={{ fontSize: 11, color: T.red, marginTop: 2 }}>{error}</span>
      )}
    </div>
  )
}

// Textarea con la misma estética
export function FieldTextarea({ label, value, onChange, placeholder, rows = 3, required, register, error, disabled, minHeight }) {
  const style = {
    width: '100%',
    minHeight: minHeight || 72,
    background: T.s2,
    border: `1px solid ${error ? `${T.red}80` : T.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    color: T.text,
    fontSize: 14,
    fontFamily: T.font,
    resize: 'vertical',
    outline: 'none',
    opacity: disabled ? 0.55 : 1,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span style={{
          fontSize: 11, fontWeight: 600, color: T.sub,
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          {label}{required && <span style={{ color: T.red, marginLeft: 3 }}>*</span>}
        </span>
      )}
      {register ? (
        <textarea {...register} placeholder={placeholder || ''} disabled={disabled} rows={rows} style={style} />
      ) : (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange && onChange(e.target.value)}
          placeholder={placeholder || ''}
          disabled={disabled}
          rows={rows}
          style={style}
        />
      )}
      {error && (
        <span style={{ fontSize: 11, color: T.red, marginTop: 2 }}>{error}</span>
      )}
    </div>
  )
}

// ── Card (contenedor base oscuro) ─────────────────────────────
export function Card({ children, style, padding = 16, hoverable, onClick, accent }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.s1,
        border: `1px solid ${T.border}`,
        borderLeft: accent ? `3px solid ${accent}` : `1px solid ${T.border}`,
        borderRadius: 16,
        padding,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s, transform .1s',
        ...style,
      }}
      onMouseEnter={hoverable ? (e) => { e.currentTarget.style.borderColor = `${T.cyan}40` } : undefined}
      onMouseLeave={hoverable ? (e) => { e.currentTarget.style.borderColor = T.border } : undefined}
    >
      {children}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────
export function Hdr({ title, sub, back, right, onBack }) {
  return (
    <div style={{ paddingBottom: 18, paddingTop: 4 }}>
      {(back || onBack) && (
        <div
          onClick={onBack || back}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: T.cyan, fontSize: 13, fontWeight: 500,
            marginBottom: 10, cursor: 'pointer',
          }}
        >
          <svg width="7" height="12" viewBox="0 0 7 12">
            <path d="M6 1L1 6l5 5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Atrás
        </div>
      )}
      {sub && (
        <div style={{
          fontSize: 11, color: T.sub,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          marginBottom: 4, fontFamily: T.mono,
        }}>{sub}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.text, lineHeight: 1.2, flex: 1 }}>
          {title}
        </div>
        {right && right}
      </div>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ label = 'Cargando…' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: '60px 20px',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: `3px solid ${T.dim}`,
        borderTopColor: T.cyan,
        animation: 'aeromx-spin .8s linear infinite',
      }} />
      <span style={{ color: T.sub, fontSize: 13 }}>{label}</span>
    </div>
  )
}

// ── Banner de error ───────────────────────────────────────────
export function ErrorBanner({ children, onClose }) {
  if (!children) return null
  return (
    <div style={{
      background: T.rD, border: `1px solid rgba(255,69,69,0.40)`,
      color: T.red, borderRadius: 12, padding: '12px 14px',
      marginBottom: 14, fontSize: 13,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
    }}>
      <span>{children}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none',
            color: T.red, fontSize: 16, fontWeight: 700,
            cursor: 'pointer', padding: '0 4px',
          }}
        >×</button>
      )}
    </div>
  )
}

// ── ProgressBar ───────────────────────────────────────────────
export function ProgressBar({ value, color = T.cyan, height = 4 }) {
  const v = Math.max(0, Math.min(1, value || 0))
  return (
    <div style={{ height, background: T.dim, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${v * 100}%`,
        background: color, borderRadius: 4,
        transition: 'width .4s',
      }} />
    </div>
  )
}

// ── KV (key-value) ────────────────────────────────────────────
export function KV({ k, v, mono, vColor }) {
  return (
    <div>
      <div style={{
        fontSize: 9, color: T.sub, textTransform: 'uppercase',
        letterSpacing: '0.07em', marginBottom: 3,
      }}>{k}</div>
      <div style={{
        fontSize: 13, color: vColor || T.text,
        fontFamily: mono ? T.mono : T.font,
        fontWeight: mono ? 500 : 600,
      }}>{v ?? '—'}</div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, maxWidth = 480 }) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(9,11,18,0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.s1, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: 24,
          width: '100%', maxWidth,
          boxShadow: T.shadow,
        }}
      >
        {title && (
          <div style={{
            fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 16,
          }}>{title}</div>
        )}
        {children}
        {footer && (
          <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
