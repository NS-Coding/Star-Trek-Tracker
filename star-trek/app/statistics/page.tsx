"use client"
import { LcarsHeader } from "@/components/lcars-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatisticsSummary } from "@/components/statistics-summary"
import { RatingDistributionChart } from "@/components/charts/rating-distribution-chart"
import { WatchProgressChart } from "@/components/charts/watch-progress-chart"
import { UserComparisonChart } from "@/components/charts/user-comparison-chart"
import { RatingTrendChart } from "@/components/charts/rating-trend-chart"
import { ActivityTable } from "@/components/statistics-activity-table"

export default function StatisticsPage() {
  // Fixed scope: show data for all users, whole library
  const filters = {
    series: "all",
    timeRange: "all",
    users: ["all"] as string[],
  }

  // no mock users; use activity table fed by /api/statistics

  return (
    <main className="min-h-screen">
      <LcarsHeader title="Statistical Analysis" />
      <div className="container mx-auto px-4 py-8">
        <StatisticsSummary filters={filters} />

        <div className="grid grid-cols-1 gap-6 mt-8">
          <Card className="lcars-panel">
            <CardHeader>
              <CardTitle>Rating Distribution (0–10 by 0.1)</CardTitle>
            </CardHeader>
            <CardContent>
              <RatingDistributionChart filters={filters} />
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
              <CardTitle>Rating Trends by Chronological Order</CardTitle>
            </CardHeader>
            <CardContent>
              <RatingTrendChart filters={filters} />
            </CardContent>
          </Card>
        </div>
        <div className="mt-6">
          <Card className="lcars-panel">
            <CardHeader>
              <CardTitle>User Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTable filters={filters} />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
