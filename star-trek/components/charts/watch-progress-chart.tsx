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
    // Mock data fetch - would be replaced with actual API call
    setTimeout(() => {
      setData([
        { series: "TOS", total: 79, watched: 79, color: "#f97316" },
        { series: "TNG", total: 178, watched: 120, color: "#3b82f6" },
        { series: "DS9", total: 176, watched: 80, color: "#a855f7" },
        { series: "VOY", total: 172, watched: 50, color: "#ec4899" },
        { series: "ENT", total: 98, watched: 30, color: "#14b8a6" },
      ])
      setLoading(false)
    }, 500)
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
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={40}
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
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
