"use client"

/**
 * Interactive group-advancement chart. Renders the exact (729-enumeration)
 * advance probabilities from lib/world-cup/metrics.simulateGroup as a
 * horizontal recharts bar chart, plus an expected-points table.
 *
 * Honesty rules (consistent with the edge pivot):
 *  - The two auto-advance slots are colour-highlighted; nothing is sold as a
 *    certainty.
 *  - When fixture coverage < 100% (some matches have no model yet) we show a
 *    calibration caveat instead of implying false precision.
 *  - Tiebreak simplification (no invented goal difference) is disclosed.
 */
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip, LabelList,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, Info } from 'lucide-react'
import type { GroupSimResult } from '@/lib/world-cup/metrics'

const ADVANCE_FILL = '#34d399'   // emerald — top-2 auto-advance line
const CHASE_FILL = '#64748b'     // slate — chasing pack

interface ChartRow {
  name: string
  label: string            // flag + name for the axis tick
  advance: number          // percentage 0..100
  win: number              // percentage
  xPts: number
  advancing: boolean       // top-2 by advance prob
}

function AxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill="#cbd5e1">
      {payload?.value}
    </text>
  )
}

export function WCGroupMetrics({ sim, groupLetter }: { sim: GroupSimResult; groupLetter: string }) {
  if (!sim.teams.length) return null

  const rows: ChartRow[] = sim.teams.map((t, i) => ({
    name: t.name,
    label: `${t.flagEmoji} ${t.name}`,
    advance: +(t.advanceProb * 100).toFixed(1),
    win: +(t.winGroupProb * 100).toFixed(1),
    xPts: t.expectedPoints,
    advancing: i < 2,
  }))

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
          <BarChart3 className="w-5 h-5 text-emerald-300" />
          Who advances from Group {groupLetter}?
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Model probability of a top-two finish, computed by enumerating every possible
          combination of the group&apos;s six results. The top two are highlighted.
        </p>

        <div style={{ width: '100%', height: rows.length * 56 + 20 }}>
          <ResponsiveContainer>
            <BarChart layout="vertical" data={rows} margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
              <XAxis
                type="number" domain={[0, 100]} unit="%"
                tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
              />
              <YAxis
                type="category" dataKey="label" width={150}
                tick={<AxisTick />} axisLine={false} tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v: number, key: string) =>
                  key === 'advance' ? [`${v}%`, 'Advance'] : [`${v}%`, key]}
              />
              <Bar dataKey="advance" radius={[0, 4, 4, 0]} barSize={26} isAnimationActive={false}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={r.advancing ? ADVANCE_FILL : CHASE_FILL} />
                ))}
                <LabelList dataKey="advance" position="right" formatter={(v: number) => `${v}%`}
                  style={{ fill: '#e2e8f0', fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expected-points + win-group strip */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {sim.teams.map(t => (
            <div key={t.slug} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-center">
              <div className="text-lg leading-none mb-1">{t.flagEmoji}</div>
              <div className="text-[11px] text-slate-400 truncate">{t.name}</div>
              <div className="text-sm font-semibold text-white mt-1">{t.expectedPoints} <span className="text-[10px] text-slate-500 font-normal">xPts</span></div>
              <div className="text-[10px] text-slate-500">win grp {(t.winGroupProb * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>

        {/* Honesty caveats */}
        <p className="text-[11px] text-slate-500 mt-4 flex items-start gap-1.5 leading-relaxed">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {sim.complete
              ? 'Based on current AI model probabilities for all six group fixtures.'
              : `Model probabilities cover ${sim.fixturesWithData} of ${sim.totalFixtures} fixtures; remaining matches use a neutral prior, so treat early numbers as a calibration estimate.`}
            {' '}Tiebreaks use points then head-to-head, then model strength — we don&apos;t project goal difference. Probabilities, not predictions.
          </span>
        </p>
      </CardContent>
    </Card>
  )
}
