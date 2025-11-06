"use client"

import { useEffect, useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceArea, ReferenceDot, ReferenceLine } from "recharts"

interface RatingTrendChartProps {
  filters: {
    series: string
    timeRange: string
    users: string[]
  }
}

interface TrendData {
  date: string
  rating: number
  episodes: number
}

export function RatingTrendChart({ filters }: RatingTrendChartProps) {
  const [data, setData] = useState<{ order: number; rating: number; title?: string; isMovie?: boolean }[]>([])
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
        const users = (() => {
          const nonCurrent = filters.users.filter(u => u !== 'current')
          if (nonCurrent.length > 0) return 'all'
          return ['current']
        })()
        const res = await fetch('/api/statistics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope, timeRange: filters.timeRange || 'all', users }),
        })
        if (!res.ok) throw new Error('Failed to load statistics')
        const json = await res.json()
        const trend = Array.isArray(json.trend) ? json.trend : []
        if (!cancelled) {
          setData(trend)
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

  // Use order buckets for X axis
  const formattedData = data.map((d) => ({ order: d.order, rating: d.rating, title: d.title, isMovie: d.isMovie }))

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          {bands.map((b, i) => (
            <ReferenceArea key={`${b.title}-${i}`} x1={b.start} x2={b.end} y1={0} y2={10} fill={i % 2 === 0 ? "#0f172a" : "#111827"} fillOpacity={0.35} />
          ))}
          <XAxis dataKey="order" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 10]}
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            ticks={[0, 2, 4, 6, 8, 10]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const p = payload[0].payload as any
                return (
                  <div className="rounded-lg border bg-black p-2 shadow-sm">
                    <div className="grid gap-1">
                      <div className="font-bold">{p.title || `Order ${p.order}`}</div>
                      <div className="text-xs text-gray-400">Order: {p.order}</div>
                      <div>Average Rating: {p.rating.toFixed(1)}</div>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Area
            type="monotone"
            dataKey="rating"
            stroke="#f97316"
            fill="url(#colorRating)"
            strokeWidth={2}
            dot={(props: any) => {
              const { cx, cy, payload } = props
              const isMovie = payload?.isMovie
              return (
                <circle cx={cx} cy={cy} r={isMovie ? 4 : 0} fill="transparent" stroke="#ffffff" strokeWidth={1.5} />
              )
            }}
          />
          {bands.map((b, i) => (
            <ReferenceLine key={`line-start-${b.title}-${i}`} x={b.start} stroke="#9ca3af" strokeWidth={1.25} strokeDasharray="3 3" ifOverflow="visible" />
          ))}
          {bands.map((b, i) => (
            <ReferenceLine key={`line-end-${b.title}-${i}`} x={b.end} stroke="#9ca3af" strokeWidth={1.25} strokeDasharray="3 3" ifOverflow="visible" />
          ))}
          {movieOrders.map((ord, idx) => (
            <ReferenceDot key={`mv-${idx}`} x={ord} y={10} r={5} fill="transparent" stroke="#ffffff" strokeWidth={1.25} />
          ))}
          {movieOrders.map((ord, idx) => (
            <ReferenceLine key={`mv-line-${idx}`} x={ord} stroke="#666" strokeDasharray="4 2" ifOverflow="visible" />
          ))}
          <defs>
            <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
            </linearGradient>
          </defs>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
