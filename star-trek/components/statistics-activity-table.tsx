"use client"

import { useEffect, useState } from "react"

interface StatisticsActivityTableProps {
  filters: {
    series: string
    timeRange: string
    users: string[]
  }
}

interface ActivityRow {
  type: string
  title: string
  timestamp: string
  user?: string
}

export function ActivityTable({ filters }: StatisticsActivityTableProps) {
  const [rows, setRows] = useState<ActivityRow[]>([])
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
        const data = await res.json()
        const activity: ActivityRow[] = Array.isArray(data.activity) ? data.activity : []
        if (!cancelled) setRows(activity)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [filters])

  if (loading) {
    return <div className="flex justify-center items-center h-32">Loading activity...</div>
  }

  if (!rows.length) {
    return <div className="text-gray-400">No recent activity found for the selected filters.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-800">
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4">User</th>
            <th className="py-2 pr-4">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-b border-gray-900">
              <td className="py-2 pr-4 capitalize">{r.type}</td>
              <td className="py-2 pr-4">{r.title}</td>
              <td className="py-2 pr-4">{r.user || '-'}</td>
              <td className="py-2 pr-4">{new Date(r.timestamp).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
