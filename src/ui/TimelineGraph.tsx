// src/ui/TimelineGraph.tsx
import { useState } from 'react'
import type { SimResult, TimelinePoint } from '../engine/types'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'

type Mode = 'hp' | 'alive'
type Point = TimelinePoint

function fmtSeconds(s: number) {
  const rounded = Math.abs(s - Math.round(s)) < 1e-6 ? Math.round(s) : s
  return `${rounded}s`
}

type TooltipPayloadItem = {
  dataKey?: string
  value?: number
  payload?: Point
}

type CustomTooltipProps = {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: number
  mode: Mode
}

function CustomTooltip({ active, payload, label, mode }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  const t = typeof label === 'number' ? label : 0

  const aliveA = row?.aliveA ?? 0
  const aliveB = row?.aliveB ?? 0
  const hpA = row?.hpA ?? 0
  const hpB = row?.hpB ?? 0

  const headline = mode === 'hp' ? 'HP Pool' : 'Alive Units'

  return (
    <div
      style={{
        background: 'rgba(10, 15, 25, 0.92)',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        color: 'rgba(226, 232, 240, 0.95)',
        minWidth: 190,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 0 }}>t = {fmtSeconds(t)}</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{headline}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: '#60a5fa' }} />
        <div style={{ fontSize: 13 }}>
          <div>
            <span style={{ opacity: 0.9 }}>Team A alive:</span>{' '}
            <span style={{ fontWeight: 700 }}>{aliveA}</span>
          </div>
          <div style={{ opacity: 0.9 }}>
            Team A HP: <span style={{ fontWeight: 700 }}>{Math.round(hpA)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: '#fb7185' }} />
        <div style={{ fontSize: 13 }}>
          <div>
            <span style={{ opacity: 0.9 }}>Team B alive:</span>{' '}
            <span style={{ fontWeight: 700 }}>{aliveB}</span>
          </div>
          <div style={{ opacity: 0.9 }}>
            Team B HP: <span style={{ fontWeight: 700 }}>{Math.round(hpB)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TimelineGraph({ result }: { result: SimResult }) {
  const [mode, setMode] = useState<Mode>('hp')

  if (!result.timeline.length) return null

  const endT = Math.max(0, result.seconds)
  const EPS = 1e-6

  // Map + clamp to endT
  let data: Point[] = result.timeline.filter((p) => p.t <= endT + EPS)

  // Ensure final point exists exactly at endT with final survivors
  const finalA = result.survivorsA
  const finalB = result.survivorsB

  const last = data[data.length - 1]
  if (!last) {
    data = [
      { t: 0, aliveA: finalA, aliveB: finalB, hpA: 0, hpB: 0 },
      { t: endT, aliveA: finalA, aliveB: finalB, hpA: 0, hpB: 0 },
    ]
  } else if (Math.abs(last.t - endT) > 1e-3) {
    data = [...data, { ...last, t: endT }]
  } else {
    // If we already have an end point, ensure it reflects final counts
    data = data.map((p, i) =>
      i === data.length - 1 ? { ...p, t: endT, aliveA: finalA, aliveB: finalB } : p,
    )
  }

  const maxY =
    mode === 'hp'
      ? Math.max(1, ...data.map((d) => Math.max(d.hpA, d.hpB)))
      : Math.max(1, ...data.map((d) => Math.max(d.aliveA, d.aliveB)))

  const keyA = mode === 'hp' ? ('hpA' as const) : ('aliveA' as const)
  const keyB = mode === 'hp' ? ('hpB' as const) : ('aliveB' as const)

  return (
    <div style={{ width: '100%', height: 310 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(226, 232, 240, 0.9)' }}>
          {mode === 'hp' ? 'HP Pool Over Time' : 'Alive Units Over Time'}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: 4,
            borderRadius: 12,
            border: '1px solid rgba(148, 163, 184, 0.25)',
            background: 'rgba(10, 15, 25, 0.35)',
          }}
        >
          <button
            type="button"
            onClick={() => setMode('hp')}
            style={{
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: mode === 'hp' ? 'rgba(226, 232, 240, 0.12)' : 'transparent',
              color: 'rgba(226, 232, 240, 0.85)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            HP Pool
          </button>

          <button
            type="button"
            onClick={() => setMode('alive')}
            style={{
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: mode === 'alive' ? 'rgba(226, 232, 240, 0.12)' : 'transparent',
              color: 'rgba(226, 232, 240, 0.85)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Alive
          </button>
        </div>
      </div>

      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 14, right: 18, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id="fillA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.34} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.06} />
            </linearGradient>
            <linearGradient id="fillB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.06} />
            </linearGradient>
          </defs>

          <ReferenceArea x1={0} x2={endT} fill="#ffffff" fillOpacity={0.035} />
          {/* Opening volley region */}
          {result.contactMade && result.timeToContact != null && result.timeToContact > 0 && (
            <ReferenceArea
              x1={0}
              x2={result.timeToContact}
              fill="#f59e0b"
              fillOpacity={0.08}
              label={{
                value: 'Opening volley',
                position: 'top',
                fill: '#fbbf24',
                fontSize: 11,
                offset: 2,
              }}
            />
          )}
          <CartesianGrid strokeDasharray="3 3" opacity={0.22} />

          <XAxis
            dataKey="t"
            type="number"
            domain={[0, endT]}
            tick={{ fontSize: 12, fill: 'rgba(226, 232, 240, 0.75)' }}
            tickFormatter={(v: number) => fmtSeconds(v)}
            minTickGap={28}
          />

          <YAxis
            domain={[0, Math.ceil(maxY)]}
            allowDecimals={mode === 'hp'}
            tick={{ fontSize: 12, fill: 'rgba(226, 232, 240, 0.75)' }}
          />

          <Tooltip
            content={<CustomTooltip mode={mode} />}
            cursor={{ stroke: 'rgba(148, 163, 184, 0.45)', strokeDasharray: '4 4' }}
          />

          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            formatter={(value: string) => (
              <span style={{ color: 'rgba(226, 232, 240, 0.78)' }}>{value}</span>
            )}
          />

          <ReferenceLine x={endT} stroke="rgba(148, 163, 184, 0.85)" strokeDasharray="4 4" />
          {result.contactMade && result.timeToContact != null && result.timeToContact > 0 && (
            <ReferenceLine
              x={result.timeToContact}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              label={{ value: 'Contact', position: 'top', fill: '#fbbf24', fontSize: 12 }}
            />
          )}

          <Area
            type="stepAfter"
            dataKey={keyA}
            name={mode === 'hp' ? 'Team A HP' : 'Team A alive'}
            stroke="#60a5fa"
            strokeWidth={2.6}
            fill="url(#fillA)"
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />

          <Area
            type="stepAfter"
            dataKey={keyB}
            name={mode === 'hp' ? 'Team B HP' : 'Team B alive'}
            stroke="#c4b5fd"
            strokeWidth={2.6}
            fill="url(#fillB)"
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
