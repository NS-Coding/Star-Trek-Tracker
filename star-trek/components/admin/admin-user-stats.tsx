"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "@/components/ui/chart"
import { ChartTooltip } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Star, Eye, Clock } from "lucide-react"

interface User {
  id: string
  username: string
  email: string
  isAdmin: boolean
  status: "active" | "pending" | "rejected"
  createdAt: string
  lastLogin?: string
  watchedCount?: number
  ratedCount?: number
}

interface AdminUserStatsProps {
  users: User[]
}

export function AdminUserStats({ users }: AdminUserStatsProps) {
  const [userActivity, setUserActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Generate activity data based on users
    const activity = users
      .filter((user) => user.watchedCount && user.ratedCount)
      .map((user) => ({
        name: user.username,
        watched: user.watchedCount,
        rated: user.ratedCount,
        avgRating: (Math.random() * 2 + 7).toFixed(1), // Random rating between 7-9
        watchTime: Math.round((user.watchedCount || 0) * 0.75), // Approximate watch time in hours
      }))
      .sort((a, b) => b.watched - a.watched)

    setUserActivity(activity)
    setLoading(false)
  }, [users])

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading user statistics...</div>
  }

  // Calculate platform totals
  const totalWatched = userActivity.reduce((sum, user) => sum + user.watched, 0)
  const totalRated = userActivity.reduce((sum, user) => sum + user.rated, 0)
  const totalWatchTime = userActivity.reduce((sum, user) => sum + user.watchTime, 0)
  const avgRating = userActivity.reduce((sum, user) => sum + Number.parseFloat(user.avgRating), 0) / userActivity.length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="lcars-panel">
          <CardContent className="p-6">
            <div className="flex flex-col h-full">
              <div className="flex items-center mb-2">
                <Eye className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="text-lg font-medium">Total Episodes Watched</h3>
              </div>
              <div className="flex items-baseline mt-2">
                <span className="text-4xl font-bold text-orange-500">{totalWatched}</span>
                <span className="text-lg text-gray-400 ml-2">episodes</span>
              </div>
              <p className="text-sm text-gray-400 mt-2">Across all active users</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lcars-panel">
          <CardContent className="p-6">
            <div className="flex flex-col h-full">
              <div className="flex items-center mb-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mr-2" />
                <h3 className="text-lg font-medium">Average Platform Rating</h3>
              </div>
              <div className="flex items-baseline mt-2">
                <span className="text-4xl font-bold text-orange-500">{avgRating.toFixed(1)}</span>
                <span className="text-lg text-gray-400 ml-2">/ 10</span>
              </div>
              <p className="text-sm text-gray-400 mt-2">{totalRated} total ratings submitted</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lcars-panel">
          <CardContent className="p-6">
            <div className="flex flex-col h-full">
              <div className="flex items-center mb-2">
                <Clock className="h-5 w-5 text-purple-500 mr-2" />
                <h3 className="text-lg font-medium">Total Watch Time</h3>
              </div>
              <div className="flex items-baseline mt-2">
                <span className="text-4xl font-bold text-orange-500">{totalWatchTime}</span>
                <span className="text-lg text-gray-400 ml-2">hours</span>
              </div>
              <p className="text-sm text-gray-400 mt-2">{Math.round(totalWatchTime / 24)} days of Star Trek content</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="lcars-panel">
        <CardHeader>
          <CardTitle>User Activity Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <ChartTooltip>
                          <div className="font-bold">{payload[0].payload.name}</div>
                          <div>Episodes Watched: {payload[0].payload.watched}</div>
                          <div>Episodes Rated: {payload[0].payload.rated}</div>
                          <div>Average Rating: {payload[0].payload.avgRating}</div>
                        </ChartTooltip>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="watched" name="Episodes Watched" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lcars-panel">
        <CardHeader>
          <CardTitle>User Activity Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Episodes Watched</TableHead>
                <TableHead>Episodes Rated</TableHead>
                <TableHead>Average Rating</TableHead>
                <TableHead>Watch Time (hours)</TableHead>
                <TableHead>Last Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userActivity.map((user, index) => {
                const userDetails = users.find((u) => u.username === user.name)
                return (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.watched}</TableCell>
                    <TableCell>{user.rated}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 mr-1" />
                        {user.avgRating}
                      </div>
                    </TableCell>
                    <TableCell>{user.watchTime}</TableCell>
                    <TableCell>{userDetails?.lastLogin || "Unknown"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
