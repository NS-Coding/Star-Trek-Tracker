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
interface UserAverage { user: string; average: number }

export function StatisticsSummary({ filters }: StatisticsSummaryProps) {
  const [stats, setStats] = useState<StatsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [userAverages, setUserAverages] = useState<UserAverage[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const scope = (() => {
          if (filters.series === 'movies') return 'movies'
          if (filters.series === 'all') return 'all'
          // until series filter is wired with real IDs, treat other values as 'series'
          return 'series'
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
        const s = data.summary || {}
        if (!cancelled) {
          setStats({
            totalAverageRating: Number(data.summary?.averageRating ?? 0),
            totalWatchTime: Number(s.watchTimeHours ?? 0),
            totalPossibleWatchTime: Number(s.possibleHours ?? 0),
            watchedEpisodes: Number(s.watchedEpisodes ?? s.watchedCount ?? 0),
            totalEpisodes: Number(s.totalEpisodes ?? s.totalCount ?? 0),
            watchedMovies: Number(s.watchedMovies ?? 0),
            totalMovies: Number(s.totalMovies ?? 0),
          })
          setUserAverages(Array.isArray(data.usersAverage) ? data.usersAverage : [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
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
      {/* Per-user averages card spans full width below */}
      <div className="md:col-span-3 col-span-1">
        <Card className="lcars-panel">
          <CardContent className="p-6">
            <div className="flex items-center mb-3">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mr-2" />
              <h3 className="text-lg font-medium">Per-User Average Ratings</h3>
            </div>
            {userAverages.length === 0 ? (
              <div className="text-gray-400 text-sm">No user ratings found.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {userAverages.map((u) => (
                  <div key={u.user} className="flex items-center justify-between bg-gray-900/60 rounded px-3 py-2">
                    <span className="text-gray-300">{u.user}</span>
                    <span className="text-orange-400 font-semibold">{Number(u.average).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
