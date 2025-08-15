"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Star, Clock, PlayCircle } from "lucide-react"

interface StatisticsSummaryProps {
  filters: {
    series: string
    timeRange: string
    users: string[]
  }
}

interface StatsSummary {
  totalAverageRating: number
  totalWatchTime: number
  totalPossibleWatchTime: number
  watchedEpisodes: number
  totalEpisodes: number
  watchedMovies: number
  totalMovies: number
}

export function StatisticsSummary({ filters }: StatisticsSummaryProps) {
  const [stats, setStats] = useState<StatsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data fetch - would be replaced with actual API call
    setTimeout(() => {
      setStats({
        totalAverageRating: 8.4,
        totalWatchTime: 312, // hours
        totalPossibleWatchTime: 520, // hours
        watchedEpisodes: 423,
        totalEpisodes: 695,
        watchedMovies: 9,
        totalMovies: 13,
      })
      setLoading(false)
    }, 500)
  }, [filters])

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="lcars-panel">
            <CardContent className="p-6">
              <div className="h-24 flex items-center justify-center">
                <p className="text-gray-500">Loading statistics...</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const watchTimePercentage = Math.round((stats.totalWatchTime / stats.totalPossibleWatchTime) * 100)
  const watchedContentPercentage = Math.round(
    ((stats.watchedEpisodes + stats.watchedMovies) / (stats.totalEpisodes + stats.totalMovies)) * 100,
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <Card className="lcars-panel">
        <CardContent className="p-6">
          <div className="flex flex-col h-full">
            <div className="flex items-center mb-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mr-2" />
              <h3 className="text-lg font-medium">Average Rating</h3>
            </div>
            <div className="flex items-baseline mt-2">
              <span className="text-4xl font-bold text-orange-500">{stats.totalAverageRating.toFixed(1)}</span>
              <span className="text-lg text-gray-400 ml-2">/ 10</span>
            </div>
            <p className="text-sm text-gray-400 mt-2">Average rating across all watched content</p>
          </div>
        </CardContent>
      </Card>

      <Card className="lcars-panel">
        <CardContent className="p-6">
          <div className="flex flex-col h-full">
            <div className="flex items-center mb-2">
              <Clock className="h-5 w-5 text-blue-500 mr-2" />
              <h3 className="text-lg font-medium">Watch Time</h3>
            </div>
            <div className="flex items-baseline mt-2">
              <span className="text-4xl font-bold text-orange-500">{stats.totalWatchTime}</span>
              <span className="text-lg text-gray-400 ml-2">hours</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span>{watchTimePercentage}% of total</span>
                <span>
                  {stats.totalWatchTime} / {stats.totalPossibleWatchTime} hours
                </span>
              </div>
              <Progress value={watchTimePercentage} className="h-2 bg-gray-700" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lcars-panel">
        <CardContent className="p-6">
          <div className="flex flex-col h-full">
            <div className="flex items-center mb-2">
              <PlayCircle className="h-5 w-5 text-green-500 mr-2" />
              <h3 className="text-lg font-medium">Watch Progress</h3>
            </div>
            <div className="flex items-baseline mt-2">
              <span className="text-4xl font-bold text-orange-500">{watchedContentPercentage}%</span>
              <span className="text-lg text-gray-400 ml-2">complete</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span>
                  Episodes: {stats.watchedEpisodes} / {stats.totalEpisodes}
                </span>
                <span>
                  Movies: {stats.watchedMovies} / {stats.totalMovies}
                </span>
              </div>
              <Progress value={watchedContentPercentage} className="h-2 bg-gray-700" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
