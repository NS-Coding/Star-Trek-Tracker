"use client"

import { useEffect, useRef } from "react"

interface RatingChartProps {
  filters: {
    series: string
    timeRange: string
    users: string[]
  }
}

export function RatingChart({ filters }: RatingChartProps) {
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
    const padding = 40
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    // Draw background
    ctx.fillStyle = "#111"
    ctx.fillRect(0, 0, width, height)

    // Draw axes
    ctx.strokeStyle = "#f97316"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, height - padding)
    ctx.lineTo(width - padding, height - padding)
    ctx.stroke()

    // Draw labels
    ctx.fillStyle = "#fff"
    ctx.font = "12px sans-serif"
    ctx.textAlign = "center"

    // X-axis labels (ratings)
    for (let i = 0; i <= 5; i++) {
      const x = padding + (i / 5) * chartWidth
      ctx.fillText(i.toString(), x, height - padding + 20)
    }

    // Y-axis label (count)
    ctx.save()
    ctx.translate(padding - 20, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = "center"
    ctx.fillText("Number of Ratings", 0, 0)
    ctx.restore()

    // Draw title
    ctx.font = "16px sans-serif"
    ctx.fillText("Rating Distribution", width / 2, padding - 20)

    // Mock data - would be replaced with actual data from API
    const ratingData = [
      { rating: 1, count: 5 },
      { rating: 2, count: 12 },
      { rating: 3, count: 25 },
      { rating: 4, count: 45 },
      { rating: 5, count: 38 },
    ]

    // Find max count for scaling
    const maxCount = Math.max(...ratingData.map((d) => d.count))

    // Draw bars
    const barWidth = (chartWidth / 5) * 0.8
    const barSpacing = (chartWidth / 5) * 0.2

    ratingData.forEach((data, i) => {
      const barHeight = (data.count / maxCount) * chartHeight
      const x = padding + i * (barWidth + barSpacing)
      const y = height - padding - barHeight

      // Draw bar
      ctx.fillStyle = getColorForRating(data.rating)
      ctx.fillRect(x, y, barWidth, barHeight)

      // Draw count on top of bar
      ctx.fillStyle = "#fff"
      ctx.textAlign = "center"
      ctx.fillText(data.count.toString(), x + barWidth / 2, y - 5)
    })
  }, [filters])

  // Helper function to get color based on rating
  const getColorForRating = (rating: number): string => {
    if (rating <= 1) return "#ef4444" // red
    if (rating <= 2) return "#f97316" // orange
    if (rating <= 3) return "#facc15" // yellow
    if (rating <= 4) return "#84cc16" // lime
    return "#22c55e" // green
  }

  return (
    <div className="w-full h-full flex justify-center">
      <canvas ref={chartRef} width={400} height={300} className="max-w-full" />
    </div>
  )
}
