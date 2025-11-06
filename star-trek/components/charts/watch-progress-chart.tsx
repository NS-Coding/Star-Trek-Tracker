"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface WatchProgressChartProps {
  filters: {
    series: string
    timeRange: string
    users: string[]
  }
}

interface SeriesData {
  series: string
  total: number
  watched: number
  color: string
}

export function WatchProgressChart({ filters }: WatchProgressChartProps) {
  const [data, setData] = useState<SeriesData[]>([])
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
        const items = Array.isArray(json.progressBySeries) ? json.progressBySeries : []
        const colors = ["#f97316", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#22c55e", "#eab308"]
        const mapped = items.map((it: any, idx: number) => ({
          series: it.title,
          total: Number(it.total ?? 0),
          watched: Number(it.watched ?? 0),
          color: colors[idx % colors.length],
        }))
        if (!cancelled) setData(mapped)
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

  // Transform data for horizontal bar chart
  const chartData = data.map((item) => ({
    name: item.series,
    watched: item.watched,
    total: item.total,
    percentage: Math.round((item.watched / item.total) * 100),
    color: item.color,
  }))

  return (
    <div className="h-[480px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            unit="%"
          />
          <YAxis
            dataKey="name"
            type="category"
            stroke="#888888"
            fontSize={13}
            tickLine={false}
            axisLine={false}
            width={160}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div className="rounded-lg border bg-black p-2 shadow-sm">
                    <div className="grid gap-1">
                      <div className="font-bold">{data.name}</div>
                      <div>
                        Watched: {data.watched} / {data.total} episodes
                      </div>
                      <div>Progress: {data.percentage}%</div>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={26}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
