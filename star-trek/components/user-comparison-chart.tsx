"use client"

import { useEffect, useRef } from "react"

interface UserComparisonChartProps {
  filters: {
    series: string
    timeRange: string
    users: string[]
  }
}

export function UserComparisonChart({ filters }: UserComparisonChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!chartRef.current) return

    const ctx = chartRef.current.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height)

    // Set dimensions
    const width = chartRef.current.width
    const height = chartRef.current.height
    const padding = 60

    // Draw background
    ctx.fillStyle = "#111"
    ctx.fillRect(0, 0, width, height)

    // Draw title
    ctx.fillStyle = "#fff"
    ctx.font = "16px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("User Rating Comparison by Series", width / 2, padding - 30)

    // Mock data - would be replaced with actual data from API
    const userData = [
      {
        user: "picard",
        color: "#f97316",
        ratings: [
          { series: "TOS", rating: 4.2 },
          { series: "TNG", rating: 4.8 },
          { series: "DS9", rating: 4.5 },
          { series: "VOY", rating: 4.0 },
          { series: "ENT", rating: 3.7 },
        ],
      },
      {
        user: "riker",
        color: "#3b82f6",
        ratings: [
          { series: "TOS", rating: 3.9 },
          { series: "TNG", rating: 4.9 },
          { series: "DS9", rating: 4.3 },
          { series: "VOY", rating: 3.8 },
          { series: "ENT", rating: 3.5 },
        ],
      },
      {
        user: "data",
        color: "#a855f7",
        ratings: [
          { series: "TOS", rating: 4.5 },
          { series: "TNG", rating: 4.7 },
          { series: "DS9", rating: 4.6 },
          { series: "VOY", rating: 4.4 },
          { series: "ENT", rating: 4.2 },
        ],
      },
    ]

    const series = ["TOS", "TNG", "DS9", "VOY", "ENT"]

    // Calculate chart dimensions
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    // Draw axes
    ctx.strokeStyle = "#f97316"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, height - padding)
    ctx.lineTo(width - padding, height - padding)
    ctx.stroke()

    // Draw X-axis labels (series)
    ctx.fillStyle = "#fff"
    ctx.textAlign = "center"
    series.forEach((s, i) => {
      const x = padding + (i / (series.length - 1)) * chartWidth
      ctx.fillText(s, x, height - padding + 20)
    })

    // Draw Y-axis labels (ratings)
    ctx.textAlign = "right"
    for (let rating = 1; rating <= 5; rating++) {
      const y = height - padding - ((rating - 1) / 4) * chartHeight
      ctx.fillText(rating.toString(), padding - 10, y + 4)
    }

    // Draw lines for each user
    userData.forEach((user) => {
      ctx.strokeStyle = user.color
      ctx.lineWidth = 3
      ctx.beginPath()

      user.ratings.forEach((rating, i) => {
        const x = padding + (i / (series.length - 1)) * chartWidth
        const y = height - padding - ((rating.rating - 1) / 4) * chartHeight

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()

      // Draw points
      user.ratings.forEach((rating, i) => {
        const x = padding + (i / (series.length - 1)) * chartWidth
        const y = height - padding - ((rating.rating - 1) / 4) * chartHeight

        ctx.fillStyle = user.color
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
      })
    })

    // Draw legend
    const legendX = width - padding - 100
    const legendY = padding + 20

    userData.forEach((user, i) => {
      const y = legendY + i * 25

      // Draw line
      ctx.strokeStyle = user.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(legendX, y)
      ctx.lineTo(legendX + 30, y)
      ctx.stroke()

      // Draw point
      ctx.fillStyle = user.color
      ctx.beginPath()
      ctx.arc(legendX + 15, y, 5, 0, Math.PI * 2)
      ctx.fill()

      // Draw text
      ctx.fillStyle = "#fff"
      ctx.textAlign = "left"
      ctx.fillText(user.user, legendX + 40, y + 4)
    })
  }, [filters])

  return (
    <div className="w-full h-full flex justify-center">
      <canvas ref={chartRef} width={800} height={400} className="max-w-full" />
    </div>
  )
}
