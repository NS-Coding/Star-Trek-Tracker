"use client"

import { useEffect, useState } from "react"
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceArea, ReferenceDot, ReferenceLine } from "recharts"

interface UserComparisonChartProps {
  filters: {
    series: string
    timeRange: string
    users: string[]
  }
}

interface UserData {
  user: string
  color: string
  ratings: { series: string; rating: number }[]
}

export function UserComparisonChart({ filters }: UserComparisonChartProps) {
  const [chartData, setChartData] = useState<any[]>([])
  const [users, setUsers] = useState<string[]>([])
  const [bands, setBands] = useState<{ title: string; start: number; end: number }[]>([])
  const [movieOrders, setMovieOrders] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const scope = (() => {
          if (filters.series === 'movies') return 'movies'
          if (filters.series === 'all') return 'all'
          return filters.series.startsWith('show:') ? filters.series : 'series'
        })()
        const usersFilter = (() => {
          const nonCurrent = filters.users.filter(u => u !== 'current')
          if (nonCurrent.length > 0) return 'all'
          return ['current']
        })()
        const res = await fetch('/api/statistics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope, timeRange: filters.timeRange || 'all', users: usersFilter }),
        })
        if (!res.ok) throw new Error('Failed to load statistics')
        const json = await res.json()
        const rows: { user: string; order: number; rating: number; title?: string }[] = Array.isArray(json.userComparison) ? json.userComparison : []
        const userSet = Array.from(new Set(rows.map(r => r.user)))
        const orderSet = Array.from(new Set(rows.map(r => r.order))).sort((a, b) => a - b)
        const titleByOrder = new Map<number, string>()
        rows.forEach(r => { if (!titleByOrder.has(r.order) && r.title) titleByOrder.set(r.order, r.title) })
        const pivot = orderSet.map(ord => {
          const row: any = { order: ord, title: titleByOrder.get(ord) }
          userSet.forEach(u => {
            const rec = rows.find(r => r.order === ord && r.user === u)
            row[u] = rec ? Number(rec.rating) : undefined
          })
          return row
        })
        if (!cancelled) {
          setUsers(userSet)
          setChartData(pivot)
          setBands(Array.isArray(json.seriesBands) ? json.seriesBands : [])
          setMovieOrders(Array.isArray(json.movieOrders) ? json.movieOrders : [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filters])

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading chart data...</div>
  }

  const palette = ["#f97316", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#22c55e", "#eab308"]

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          {bands.map((b, i) => (
            <ReferenceArea key={`${b.title}-${i}`} x1={b.start} x2={b.end} y1={0} y2={10} fill={i % 2 === 0 ? "#0f172a" : "#111827"} fillOpacity={0.25} />
          ))}
          {bands.map((b, i) => (
            <ReferenceLine key={`line-${b.title}-${i}`} x={b.start} stroke="#9ca3af" strokeWidth={1.25} strokeDasharray="3 3" ifOverflow="visible" />
          ))}
          <XAxis dataKey="order" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 10]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} ticks={[0,2,4,6,8,10]} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const row: any = payload[0].payload
                return (
                  <div className="rounded-lg border bg-black p-2 shadow-sm">
                    <div className="grid gap-1">
                      <div className="font-bold">{row.title || `Order ${row.order}`}</div>
                      <div className="text-xs text-gray-400">Order: {row.order}</div>
                      {payload.map((p: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                          <span>{p.name}: {Number(p.value).toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Legend />
          {users.map((u, idx) => (
            <Line key={u} type="monotone" dataKey={u} stroke={palette[idx % palette.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          ))}
          {movieOrders.map((ord, idx) => (
            <ReferenceDot key={`mv-${idx}`} x={ord} y={10} r={5} fill="transparent" stroke="#ffffff" strokeWidth={1.25} />
          ))}
          {movieOrders.map((ord, idx) => (
            <ReferenceLine key={`mv-line-${idx}`} x={ord} stroke="#9ca3af" strokeWidth={1.25} strokeDasharray="4 2" ifOverflow="visible" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
