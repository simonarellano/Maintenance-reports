// Design tokens — replicados del prototipo AeroMX (desing-example)
export const T = {
  bg:    '#090b12',
  s1:    '#12151e',
  s2:    '#1b1f2e',
  s3:    '#242840',
  border:'rgba(100,130,255,0.10)',

  cyan:  '#00d0e8',
  cD:    'rgba(0,208,232,0.13)',

  amber: '#f0a030',
  aD:    'rgba(240,160,48,0.13)',

  green: '#28d980',
  gD:    'rgba(40,217,128,0.13)',

  red:   '#ff4545',
  rD:    'rgba(255,69,69,0.13)',

  purple:'#a78bfa',
  pD:    'rgba(167,139,250,0.13)',

  text:  '#dde8f8',
  sub:   '#6070a0',
  dim:   '#2a3050',

  mono:  '"JetBrains Mono", monospace',
  font:  '"Space Grotesk", system-ui, sans-serif',

  shadow: '0 8px 32px rgba(0,0,0,0.5)',
  glowCyan:  '0 0 48px rgba(0,208,232,0.14)',
  glowGreen: '0 0 40px rgba(40,217,128,0.15)',
}

// Estados de la O/T → color + label
export const STATUS = {
  borrador:        { label: 'Borrador',     c: T.sub,   bg: 'rgba(96,112,160,0.15)' },
  en_proceso:      { label: 'En Proceso',   c: T.cyan,  bg: T.cD },
  pendiente_firma: { label: 'Pend. Firma',  c: T.amber, bg: T.aD },
  cerrada:         { label: 'Cerrada',      c: T.green, bg: T.gD },
}

// Mapa para los estados internos de un punto de inspección
export const PUNTO_STATUS = {
  bueno:               { label: 'Bueno',             c: T.green, bg: T.gD },
  no_aplica:           { label: 'No Aplica',         c: T.sub,   bg: T.s2 },
  correcto_con_danos:  { label: 'Con Daños',         c: T.amber, bg: T.aD },
  requiere_atencion:   { label: 'Req. Atención',     c: T.red,   bg: T.rD },
}

// Roles de usuario (rediseño multiproducto — 5 roles funcionales)
export const ROL_LABELS = {
  gerente_soporte:   'Gerente de soporte',
  ingeniero_soporte: 'Ingeniero de soporte',
  tecnico_soporte:   'Técnico de soporte',
  mecanico:          'Mecánico',
  piloto:            'Piloto',
  operador:          'Operador',
}

export const ROL_COLOR = {
  gerente_soporte:   { c: T.amber,  bg: T.aD },
  ingeniero_soporte: { c: T.purple, bg: T.pD },
  tecnico_soporte:   { c: T.cyan,   bg: T.cD },
  mecanico:          { c: T.green,  bg: T.gD },
  piloto:            { c: T.text,   bg: T.s2 },
  operador:          { c: T.cyan,   bg: T.cD },
}

// Lista de roles para selectores de formularios
export const ROLES = Object.keys(ROL_LABELS)

// Tipos de producto (multiproducto) → label, color, ícono y orden de pestañas
export const TIPO_PRODUCTO = {
  aeronave:            { label: 'Aeronave',          icon: '✈',  c: T.cyan,   bg: T.cD },
  gcs:                 { label: 'GCS',               icon: '🖥️', c: T.amber,  bg: T.aD },
  planta:              { label: 'Planta de energía', icon: '⚡', c: T.green,  bg: T.gD },
  sensor_inteligencia: { label: 'Sensor de inteligencia', icon: '🛰️', c: T.purple, bg: T.pD },
}

export const TIPOS_PRODUCTO = Object.keys(TIPO_PRODUCTO)

// Severidad de falla
export const SEVERIDAD = {
  baja:    { label: 'Baja',    color: '#22c55e' },
  media:   { label: 'Media',   color: '#eab308' },
  alta:    { label: 'Alta',    color: '#f97316' },
  critica: { label: 'Crítica', color: '#ef4444' },
}

// Estado de reporte de falla
export const ESTADO_FALLA = {
  detectada:  { label: 'Detectada',  color: '#3b82f6' },
  en_proceso: { label: 'En proceso', color: '#eab308' },
  resuelta:   { label: 'Resuelta',   color: '#22c55e' },
}

// Origen de falla
export const ORIGEN_FALLA = {
  mantenimiento: { label: 'Mantenimiento' },
  prevuelo:      { label: 'Prevuelo' },
  operacion:     { label: 'Operación' },
}

// Listas para selectores
export const SEVERIDADES = Object.entries(SEVERIDAD).map(([value, v]) => ({ value, ...v }))
export const ORIGENES_FALLA = Object.entries(ORIGEN_FALLA).map(([value, v]) => ({ value, ...v }))
