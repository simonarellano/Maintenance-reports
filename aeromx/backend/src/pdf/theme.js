import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts')

// ─── Paleta (oklch del prototipo → hex) ──────────────────────────────────────
export const COLOR = {
  paper: '#FFFFFF', ink: '#111110', ink2: '#3A3A36', muted: '#76746B',
  line: '#E7E5DD', line2: '#F0EEE7',
  accent: '#2F5FA6', accentSoft: '#EDF1F8',
  ok: '#3F8F5F', okSoft: '#EAF4EE',
  warn: '#C08A2E', warnSoft: '#FBF3E3',
  critical: '#C0492F', criticalSoft: '#F8EAE6',
  headBg: '#F6F4ED', evidenceBg: '#FDFCF7', groupBg: '#FBFAF4',
}

// ─── Fuentes ──────────────────────────────────────────────────────────────────
export const FONT = {
  sans: 'Geist', sansMed: 'Geist-Med', sansSemi: 'Geist-Semi', sansBold: 'Geist-Bold',
  mono: 'GeistMono', monoMed: 'GeistMono-Med',
}

const FONT_FILES = {
  Geist: 'Geist-Regular.ttf', 'Geist-Med': 'Geist-Medium.ttf',
  'Geist-Semi': 'Geist-SemiBold.ttf', 'Geist-Bold': 'Geist-Bold.ttf',
  GeistMono: 'GeistMono-Regular.ttf', 'GeistMono-Med': 'GeistMono-Medium.ttf',
}

const FALLBACK = {
  Geist: 'Helvetica', 'Geist-Med': 'Helvetica', 'Geist-Semi': 'Helvetica-Bold',
  'Geist-Bold': 'Helvetica-Bold', GeistMono: 'Courier', 'GeistMono-Med': 'Courier-Bold',
}

let RESOLVED = {}

// Registra las fuentes en el doc. Idempotente por documento.
export function registerFonts(doc) {
  RESOLVED = {}
  for (const [name, file] of Object.entries(FONT_FILES)) {
    const p = path.join(FONTS_DIR, file)
    try {
      if (fs.existsSync(p)) {
        doc.registerFont(name, p)
        RESOLVED[name] = name
        continue
      }
    } catch { /* cae a fallback */ }
    RESOLVED[name] = FALLBACK[name]
  }
}

// Aplica un token de fuente lógico al doc (con fallback). Devuelve doc para encadenar.
export function font(doc, token) {
  return doc.font(RESOLVED[token] || FALLBACK[token] || 'Helvetica')
}

// ─── Formateadores ──────────────────────────────────────────────────────────
export const fmtFecha = (d) =>
  d ? new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' }) : '—'
export const fmtHora = (d) =>
  d ? new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—'
export const fmtFechaHora = (d) => (d ? `${fmtFecha(d)} · ${fmtHora(d)}` : '—')

// Duración legible entre dos fechas (p. ej. "1 h 12 min", "3 d", "—").
export function fmtDuracion(desde, hasta) {
  if (desde == null || hasta == null) return '—'
  const ms = new Date(hasta) - new Date(desde)
  if (ms < 0) return '—'
  const min = Math.round(ms / 60000)
  if (min < 1) return '< 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const rm = min % 60
  if (h < 24) return rm ? `${h} h ${rm} min` : `${h} h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d} d ${rh} h` : `${d} d`
}
