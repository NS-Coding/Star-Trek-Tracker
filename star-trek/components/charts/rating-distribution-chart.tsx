"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

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

  useEffect(() => {
    // Mock data fetch - would be replaced with actual API call
    setTimeout(() => {
      setData([
        { rating: 1, count: 5 },
        { rating: 2, count: 12 },
        { rating: 3, count: 25 },
        { rating: 4, count: 45 },
        { rating: 5, count: 38 },
        { rating: 6, count: 67 },
        { rating: 7, count: 89 },
        { rating: 8, count: 120 },
        { rating: 9, count: 95 },
        { rating: 10, count: 42 },
      ])
      setLoading(false)
    }, 500)
  }, [filters])

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

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
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
          <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={(entry) => getColorForRating(entry.rating)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
