"use client"

import { useEffect, useState } from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Filter, RefreshCw } from "lucide-react"

interface StatisticsFiltersProps {
  filters: {
    series: string
    timeRange: string
    users: string[]
  }
  setFilters: (filters: any) => void
}

export function StatisticsFilters({ filters, setFilters }: StatisticsFiltersProps) {
  const [availableUsers, setAvailableUsers] = useState<{ id: string; username: string }[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadUsers() {
      try {
        const res = await fetch('/api/users')
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setAvailableUsers(Array.isArray(json.users) ? json.users : [])
      } catch {}
    }
    loadUsers()
    return () => { cancelled = true }
  }, [])
  const handleSeriesChange = (value: string) => {
    setFilters({ ...filters, series: value })
  }

  const handleTimeRangeChange = (value: string) => {
    setFilters({ ...filters, timeRange: value })
  }

  const handleUserToggle = (user: string, checked: boolean) => {
    let newUsers = [...filters.users]

    if (checked && !newUsers.includes(user)) {
      newUsers.push(user)
    } else if (!checked && newUsers.includes(user)) {
      newUsers = newUsers.filter((u) => u !== user)
    }

    setFilters({
      ...filters,
      users: newUsers,
    })
  }

  const handleReset = () => {
    setFilters({
      series: "all",
      timeRange: "all",
      users: ["current"],
    })
  }

  return (
    <Card className="lcars-panel mb-6">
      <CardHeader>
        <CardTitle>Statistics Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label htmlFor="series-filter" className="mb-2 block">
              Series
            </Label>
            <Select value={filters.series} onValueChange={handleSeriesChange}>
              <SelectTrigger id="series-filter" className="border-orange-500 bg-black">
                <SelectValue placeholder="Select Series" />
              </SelectTrigger>
              <SelectContent className="bg-black border border-orange-500">
                <SelectItem value="all">All Series</SelectItem>
                <SelectItem value="tos">The Original Series</SelectItem>
                <SelectItem value="tng">The Next Generation</SelectItem>
                <SelectItem value="ds9">Deep Space Nine</SelectItem>
                <SelectItem value="voy">Voyager</SelectItem>
                <SelectItem value="ent">Enterprise</SelectItem>
                <SelectItem value="movies">Movies Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="time-filter" className="mb-2 block">
              Time Range
            </Label>
            <Select value={filters.timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger id="time-filter" className="border-orange-500 bg-black">
                <SelectValue placeholder="Select Time Range" />
              </SelectTrigger>
              <SelectContent className="bg-black border border-orange-500">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="week">Past Week</SelectItem>
                <SelectItem value="month">Past Month</SelectItem>
                <SelectItem value="year">Past Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Users</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="user-current"
                  checked={filters.users.includes("current")}
                  onCheckedChange={(checked) => handleUserToggle("current", checked as boolean)}
                  className="lcars-checkbox"
                />
                <Label htmlFor="user-current">Current User</Label>
              </div>
              {availableUsers.map((u) => (
                <div key={u.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`user-${u.id}`}
                    checked={filters.users.includes(u.id)}
                    onCheckedChange={(checked) => handleUserToggle(u.id, checked as boolean)}
                    className="lcars-checkbox"
                  />
                  <Label htmlFor={`user-${u.id}`}>{u.username}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" className="mr-2" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button className="lcars-button">
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
