"use client"

import { useEffect, useState } from "react"
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts"

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
  const [data, setData] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data fetch - would be replaced with actual API call
    setTimeout(() => {
      setData([
        {
          user: "picard",
          color: "#f97316",
          ratings: [
            { series: "TOS", rating: 8.4 },
            { series: "TNG", rating: 9.6 },
            { series: "DS9", rating: 9.0 },
            { series: "VOY", rating: 8.0 },
            { series: "ENT", rating: 7.4 },
          ],
        },
        {
          user: "riker",
          color: "#3b82f6",
          ratings: [
            { series: "TOS", rating: 7.8 },
            { series: "TNG", rating: 9.8 },
            { series: "DS9", rating: 8.6 },
            { series: "VOY", rating: 7.6 },
            { series: "ENT", rating: 7.0 },
          ],
        },
        {
          user: "data",
          color: "#a855f7",
          ratings: [
            { series: "TOS", rating: 9.0 },
            { series: "TNG", rating: 9.4 },
            { series: "DS9", rating: 9.2 },
            { series: "VOY", rating: 8.8 },
            { series: "ENT", rating: 8.4 },
          ],
        },
      ])
      setLoading(false)
    }, 500)
  }, [filters])

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading chart data...</div>
  }

  // Transform data for line chart
  const series = ["TOS", "TNG", "DS9", "VOY", "ENT"]
  const chartData = series.map((seriesName) => {
    const seriesData: { [key: string]: any } = { name: seriesName }

    data.forEach((user) => {
      const rating = user.ratings.find((r) => r.series === seriesName)
      if (rating) {
        seriesData[user.user] = rating.rating
      }
    })

    return seriesData
  })

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 10]}
            stroke="#888888"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            ticks={[0, 2, 4, 6, 8, 10]}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-black p-2 shadow-sm">
                    <div className="grid gap-1">
                      <div className="font-bold">{label}</div>
                      {payload.map((entry, index) => (
                        <div key={`item-${index}`} style={{ color: entry.color }}>
                          {entry.name}: {entry.value.toFixed(1)}
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
          {data.map((user) => (
            <Line
              key={user.user}
              type="monotone"
              dataKey={user.user}
              stroke={user.color}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
