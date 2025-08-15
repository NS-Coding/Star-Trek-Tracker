"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Search, Filter } from "lucide-react"

interface FilterControlsProps {
  showUnwatchedOnly: boolean
  setShowUnwatchedOnly: (value: boolean) => void
  sortBy: string
  setSortBy: (value: string) => void
  contentType: string
  setContentType: (value: string) => void
  searchQuery: string
  setSearchQuery: (value: string) => void
  ratingType: string
  setRatingType: (value: string) => void
}

export function FilterControls({
  showUnwatchedOnly,
  setShowUnwatchedOnly,
  sortBy,
  setSortBy,
  contentType,
  setContentType,
  searchQuery,
  setSearchQuery,
  ratingType,
  setRatingType,
}: FilterControlsProps) {
  return (
    <div className="bg-gray-900 p-4 rounded-lg mb-6 border border-orange-500">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search content..."
            className="w-full pl-10 pr-4 py-2 bg-black border border-orange-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Switch
              id="unwatched-only"
              checked={showUnwatchedOnly}
              onCheckedChange={setShowUnwatchedOnly}
              className="data-[state=checked]:bg-orange-500"
            />
            <Label htmlFor="unwatched-only">Unwatched Only</Label>
          </div>

          <Select value={contentType} onValueChange={setContentType}>
            <SelectTrigger className="w-[140px] border-orange-500 bg-black">
              <SelectValue placeholder="Content Type" />
            </SelectTrigger>
            <SelectContent className="bg-black border border-orange-500">
              <SelectItem value="all">All Content</SelectItem>
              <SelectItem value="show">Shows</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] border-orange-500 bg-black">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent className="bg-black border border-orange-500">
              <SelectItem value="order">Chronological</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ratingType} onValueChange={setRatingType}>
            <SelectTrigger className="w-[140px] border-orange-500 bg-black">
              <SelectValue placeholder="Rating Type" />
            </SelectTrigger>
            <SelectContent className="bg-black border border-orange-500">
              <SelectItem value="individual">Your Rating</SelectItem>
              <SelectItem value="aggregate">User Average</SelectItem>
              <SelectItem value="imdb">IMDb Rating</SelectItem>
            </SelectContent>
          </Select>

          <Button className="lcars-button">
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  )
}
