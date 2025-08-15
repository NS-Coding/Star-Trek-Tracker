"use client"

import { useEffect, useRef } from "react"

interface WatchProgressChartProps {
  filters: {
    series: string
    timeRange: string
    users: string[]
  }
}

export function WatchProgressChart({ filters }: WatchProgressChartProps) {
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

    // Draw background
    ctx.fillStyle = "#111"
    ctx.fillRect(0, 0, width, height)

    // Draw title
    ctx.fillStyle = "#fff"
    ctx.font = "16px sans-serif"
    ctx.textAlign = "center"
    ctx.fillText("Watch Progress by Series", width / 2, padding - 20)

    // Mock data - would be replaced with actual data from API
    const progressData = [
      { series: "TOS", total: 79, watched: 79, color: "#f97316" },
      { series: "TNG", total: 178, watched: 120, color: "#3b82f6" },
      { series: "DS9", total: 176, watched: 80, color: "#a855f7" },
      { series: "VOY", total: 172, watched: 50, color: "#ec4899" },
      { series: "ENT", total: 98, watched: 30, color: "#14b8a6" },
    ]

    // Calculate chart dimensions
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2
    const barHeight = (chartHeight / progressData.length) * 0.7
    const barSpacing = (chartHeight / progressData.length) * 0.3

    // Draw progress bars
    progressData.forEach((data, i) => {
      const y = padding + i * (barHeight + barSpacing)

      // Draw series label
      ctx.fillStyle = "#fff"
      ctx.textAlign = "right"
      ctx.fillText(data.series, padding - 10, y + barHeight / 2 + 4)

      // Draw background bar (total)
      ctx.fillStyle = "#333"
      ctx.fillRect(padding, y, chartWidth, barHeight)

      // Draw progress bar (watched)
      const progressWidth = (data.watched / data.total) * chartWidth
      ctx.fillStyle = data.color
      ctx.fillRect(padding, y, progressWidth, barHeight)

      // Draw percentage text
      const percentage = Math.round((data.watched / data.total) * 100)
      ctx.fillStyle = "#fff"
      ctx.textAlign = "left"
      ctx.fillText(
        `${percentage}% (${data.watched}/${data.total})`,
        padding + progressWidth + 10,
        y + barHeight / 2 + 4,
      )
    })
  }, [filters])

  return (
    <div className="w-full h-full flex justify-center">
      <canvas ref={chartRef} width={400} height={300} className="max-w-full" />
    </div>
  )
}
