"use client"

import { useState } from "react"
import { ContentList } from "@/components/content-list"
import { FilterControls } from "@/components/filter-controls"
import { LcarsHeader } from "@/components/lcars-header"

export default function Home() {
  const [showUnwatchedOnly, setShowUnwatchedOnly] = useState(false)
  const [sortBy, setSortBy] = useState("order")
  const [contentType, setContentType] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [ratingType, setRatingType] = useState("aggregate")

  return (
    <main className="min-h-screen">
      <LcarsHeader title="Star Trek Content Database" />
      <div className="container mx-auto px-4 py-8">
        <FilterControls
          showUnwatchedOnly={showUnwatchedOnly}
          setShowUnwatchedOnly={setShowUnwatchedOnly}
          sortBy={sortBy}
          setSortBy={setSortBy}
          contentType={contentType}
          setContentType={setContentType}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          ratingType={ratingType}
          setRatingType={setRatingType}
        />
        <ContentList
          ratingType={ratingType}
          showUnwatchedOnly={showUnwatchedOnly}
          sortBy={sortBy}
          contentType={contentType}
          searchQuery={searchQuery}
        />
      </div>
    </main>
  )
}
