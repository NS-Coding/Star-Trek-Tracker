"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts"

interface RatingDistributionChartProps {
  filters: {
    series: string
    timeRange: string
    users: string[]
  }
}

interface RatingData {
  rating: number
  count: number
}

export function RatingDistributionChart({ filters }: RatingDistributionChartProps) {
  const [data, setData] = useState<RatingData[]>([])
  const [loading, setLoading] = useState(true)
  const [shows, setShows] = useState<{ id: string; title: string }[]>([])
  const [search, setSearch] = useState('')
  const [localScope, setLocalScope] = useState<'all' | 'series' | 'movies' | `show:${string}`>('all')

  // Load series list for local dropdown
  useEffect(() => {
    let canceled = false
    async function loadShows() {
      try {
        const res = await fetch('/api/content?type=show&sortBy=title')
        if (!res.ok) return
        const json = await res.json()
        // json is an array of shows with id/title
        const items = Array.isArray(json) ? json : []
        const mapped = items.map((it: any) => ({ id: it.id, title: it.title }))
        if (!canceled) setShows(mapped)
      } catch {}
    }
    loadShows()
    return () => { canceled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Prefer local scope selection over page filters
        const scope = localScope
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
        const dist = Array.isArray(json.distribution) ? json.distribution : []
        if (!cancelled) setData(dist)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filters.timeRange, filters.users, localScope])

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading chart data...</div>
  }

  // Helper function to get color based on rating
  const getColorForRating = (rating: number): string => {
    if (rating <= 2) return "#ef4444" // red
    if (rating <= 4) return "#f97316" // orange
    if (rating <= 6) return "#facc15" // yellow
    if (rating <= 8) return "#84cc16" // lime
    return "#22c55e" // green
  }

  // Filtered options for searchable dropdown
  const filteredShows = shows.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="h-96 w-full">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-300">Filter:</label>
          <select
            value={localScope}
            onChange={(e) => setLocalScope(e.target.value as any)}
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            <option value="series">Series (All)</option>
            <option value="movies">Movies (All)</option>
            {/* Individual series inserted below */}
            {filteredShows.map(s => (
              <option key={s.id} value={`show:${s.id}`}>Series: {s.title}</option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="Search series..."
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm w-full sm:w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ResponsiveContainer width="100%" height="70%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis
            dataKey="rating"
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            label={{ value: "Rating", position: "insideBottom", offset: -5, fill: "#888888" }}
          />
          <YAxis
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            label={{ value: "Number of Ratings", angle: -90, position: "insideLeft", fill: "#888888" }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-black p-2 shadow-sm">
                    <div className="grid gap-1">
                      <div className="font-bold">Rating: {payload[0].payload.rating}</div>
                      <div>Count: {payload[0].payload.count}</div>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={`cell-${entry.rating}`} fill={getColorForRating(entry.rating)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
