// aeromx/frontend/src/components/fallas/FallasGraficas.jsx
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import { T, SEVERIDAD, ESTADO_FALLA, ORIGEN_FALLA } from '../../tokens/design'

const PALETTE = [T.cyan, T.green, T.amber, T.red, T.purple, '#7dd3fc', '#f0abfc', '#fcd34d']
const SEV_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }
const ORIGEN_LABEL = { mantenimiento: 'Mantenimiento', prevuelo: 'Prevuelo', operacion: 'Operación' }

const tooltipStyle = {
  background: T.s2, border: `1px solid ${T.border}`, borderRadius: 8,
  color: T.text, fontSize: 12, fontFamily: T.font,
}

function Panel({ titulo, children, height = 240 }) {
  return (
    <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: T.sub, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>
        {titulo}
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function FallasGraficas({ stats }) {
  if (!stats) return null

  const dataCategoria = stats.porCategoria.map((c) => ({ name: c.nombre, value: c.count, color: c.color }))
  const dataSeveridad = stats.porSeveridad.map((s) => ({ name: SEV_LABEL[s.severidad] || s.severidad, value: s.count, color: SEVERIDAD[s.severidad]?.color }))
  const dataComponentes = stats.topComponentes.map((c) => ({ name: c.componente, value: c.count }))
  const dataOrigen = stats.porOrigen.map((o) => ({ name: ORIGEN_LABEL[o.origen] || o.origen, value: o.count }))
  const dataModelo = stats.porModelo.map((m) => ({ name: m.modelo, value: m.count }))
  const dataTendencia = stats.tendencia.map((t) => ({ name: t.periodo, value: t.count }))
  const dataProducto = (stats.porProducto || []).map((p) => ({ name: p.identificador, value: p.count }))
  const dataMttrSev = (stats.mttrPorSeveridad || []).map((m) => ({ name: SEV_LABEL[m.severidad] || m.severidad, value: m.mttrDias, color: SEVERIDAD[m.severidad]?.color }))
  const dataMttrCat = (stats.mttrPorCategoria || []).map((m) => ({ name: m.nombre, value: m.mttrDias }))
  const emb = stats.embudoEstados || {}
  const dataEmbudo = [
    { name: ESTADO_FALLA.detectada?.label || 'Detectada',  value: emb.detectada  || 0, color: ESTADO_FALLA.detectada?.color },
    { name: ESTADO_FALLA.en_proceso?.label || 'En proceso', value: emb.en_proceso || 0, color: ESTADO_FALLA.en_proceso?.color },
    { name: ESTADO_FALLA.resuelta?.label || 'Resuelta',    value: emb.resuelta   || 0, color: ESTADO_FALLA.resuelta?.color },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
      <Panel titulo="Fallas por categoría">
        <BarChart data={dataCategoria}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fill: T.sub, fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {dataCategoria.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </Panel>

      <Panel titulo="Distribución por severidad">
        <PieChart>
          <Pie data={dataSeveridad} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {dataSeveridad.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: T.sub }} />
        </PieChart>
      </Panel>

      <Panel titulo="Top componentes afectados">
        <BarChart data={dataComponentes} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis type="number" tick={{ fill: T.sub, fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} width={120} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" fill={T.cyan} radius={[0, 4, 4, 0]} />
        </BarChart>
      </Panel>

      <Panel titulo="Distribución por origen">
        <PieChart>
          <Pie data={dataOrigen} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {dataOrigen.map((d, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: T.sub }} />
        </PieChart>
      </Panel>

      <Panel titulo="Tendencia temporal (mensual)">
        <LineChart data={dataTendencia}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} />
          <YAxis tick={{ fill: T.sub, fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="value" stroke={T.cyan} strokeWidth={2} dot={{ fill: T.cyan, r: 3 }} />
        </LineChart>
      </Panel>

      <Panel titulo="Fallas por modelo">
        <BarChart data={dataModelo}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fill: T.sub, fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" fill={T.purple} radius={[4, 4, 0, 0]} />
        </BarChart>
      </Panel>

      <Panel titulo="Fallas por producto">
        <BarChart data={dataProducto} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis type="number" tick={{ fill: T.sub, fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} width={120} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" fill={T.green} radius={[0, 4, 4, 0]} />
        </BarChart>
      </Panel>

      <Panel titulo="MTTR por severidad (días)">
        <BarChart data={dataMttrSev}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis dataKey="name" tick={{ fill: T.sub, fontSize: 11 }} />
          <YAxis tick={{ fill: T.sub, fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [`${v} días`, 'MTTR']} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {dataMttrSev.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </Panel>

      <Panel titulo="MTTR por categoría (días)">
        <BarChart data={dataMttrCat} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis type="number" tick={{ fill: T.sub, fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: T.sub, fontSize: 10 }} width={120} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [`${v} días`, 'MTTR']} />
          <Bar dataKey="value" fill={T.amber} radius={[0, 4, 4, 0]} />
        </BarChart>
      </Panel>

      <Panel titulo="Embudo de estados">
        <BarChart data={dataEmbudo} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.dim} />
          <XAxis type="number" tick={{ fill: T.sub, fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: T.sub, fontSize: 11 }} width={90} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {dataEmbudo.map((d, i) => <Cell key={i} fill={d.color || PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </Panel>
    </div>
  )
}
