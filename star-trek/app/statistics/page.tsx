"use client"

import { useState, useEffect } from "react"
import { LcarsHeader } from "@/components/lcars-header"
import { StatisticsFilters } from "@/components/statistics-filters"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatisticsSummary } from "@/components/statistics-summary"
import { RatingDistributionChart } from "@/components/charts/rating-distribution-chart"
import { WatchProgressChart } from "@/components/charts/watch-progress-chart"
import { UserComparisonChart } from "@/components/charts/user-comparison-chart"
import { RatingTrendChart } from "@/components/charts/rating-trend-chart"
import { AdminUserStats } from "@/components/admin/admin-user-stats"

export default function StatisticsPage() {
  const [filters, setFilters] = useState({
    series: "all",
    timeRange: "all",
    users: ["current"],
  })

  const [activeUsers, setActiveUsers] = useState<any[]>([])

  useEffect(() => {
    // Mock data fetch - would be replaced with actual API call
    setTimeout(() => {
      setActiveUsers([
        {
          id: "1",
          username: "picard",
          email: "picard@starfleet.org",
          isAdmin: true,
          status: "active",
          createdAt: "2023-01-15",
          lastLogin: "2023-05-22",
          watchedCount: 342,
          ratedCount: 315,
        },
        {
          id: "2",
          username: "riker",
          email: "riker@starfleet.org",
          isAdmin: false,
          status: "active",
          createdAt: "2023-02-10",
          lastLogin: "2023-05-21",
          watchedCount: 256,
          ratedCount: 230,
        },
        {
          id: "3",
          username: "data",
          email: "data@starfleet.org",
          isAdmin: false,
          status: "active",
          createdAt: "2023-03-05",
          lastLogin: "2023-05-20",
          watchedCount: 695,
          ratedCount: 695,
        },
      ])
    }, 1000)
  }, [])

  return (
    <main className="min-h-screen">
      <LcarsHeader title="Statistical Analysis" />
      <div className="container mx-auto px-4 py-8">
        <StatisticsFilters filters={filters} setFilters={setFilters} />

        <StatisticsSummary filters={filters} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card className="lcars-panel">
            <CardHeader>
              <CardTitle>Rating Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <RatingDistributionChart filters={filters} />
            </CardContent>
          </Card>

          <Card className="lcars-panel">
            <CardHeader>
              <CardTitle>Watch Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <WatchProgressChart filters={filters} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 mt-6">
          <Card className="lcars-panel">
            <CardHeader>
              <CardTitle>User Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <UserComparisonChart filters={filters} />
            </CardContent>
          </Card>

          <Card className="lcars-panel">
            <CardHeader>
              <CardTitle>Rating Trends Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <RatingTrendChart filters={filters} />
            </CardContent>
          </Card>
        </div>
        <div className="mt-6">
          <Card className="lcars-panel">
            <CardHeader>
              <CardTitle>User Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminUserStats users={activeUsers} />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
