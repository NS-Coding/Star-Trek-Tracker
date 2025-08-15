"use client"

import { useEffect, useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

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
  const [data, setData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data fetch - would be replaced with actual API call
    setTimeout(() => {
      setData([
        { date: "2023-01", rating: 7.8, episodes: 5 },
        { date: "2023-02", rating: 8.2, episodes: 8 },
        { date: "2023-03", rating: 8.5, episodes: 10 },
        { date: "2023-04", rating: 8.1, episodes: 7 },
        { date: "2023-05", rating: 9.0, episodes: 12 },
        { date: "2023-06", rating: 8.7, episodes: 9 },
        { date: "2023-07", rating: 8.9, episodes: 11 },
        { date: "2023-08", rating: 9.2, episodes: 15 },
        { date: "2023-09", rating: 8.8, episodes: 10 },
        { date: "2023-10", rating: 9.1, episodes: 13 },
        { date: "2023-11", rating: 9.3, episodes: 14 },
        { date: "2023-12", rating: 9.0, episodes: 12 },
      ])
      setLoading(false)
    }, 500)
  }, [filters])

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading chart data...</div>
  }

  // Format dates for display
  const formattedData = data.map((item) => ({
    ...item,
    formattedDate: new Date(item.date).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
  }))

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="formattedDate" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
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
                const data = payload[0].payload
                return (
                  <div className="rounded-lg border bg-black p-2 shadow-sm">
                    <div className="grid gap-1">
                      <div className="font-bold">{data.formattedDate}</div>
                      <div>Average Rating: {data.rating.toFixed(1)}</div>
                      <div>Episodes Watched: {data.episodes}</div>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <Area type="monotone" dataKey="rating" stroke="#f97316" fill="url(#colorRating)" strokeWidth={2} />
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
