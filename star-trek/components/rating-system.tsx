"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Star } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface RatingSystemProps {
  contentId: string
  contentType: string
  initialRating?: number
}

export function RatingSystem({ contentId, contentType, initialRating }: RatingSystemProps) {
  // Ensure we always work with a valid number
  const normalizeInitial = (val: number | undefined) => {
    const numeric = typeof val === "number" && !isNaN(val) ? val : 0
    // Convert initial rating to 10-point scale if it was previously on 5-point scale
    return numeric > 0 && numeric <= 5 ? numeric * 2 : numeric
  }

  const [rating, setRating] = useState<number>(normalizeInitial(initialRating))
  const [inputRating, setInputRating] = useState(normalizeInitial(initialRating).toString())
  const [hoveredRating, setHoveredRating] = useState(0)
  const [userRatings, setUserRatings] = useState<{ username: string; rating: number; date: string }[]>([])
  const [averageRating, setAverageRating] = useState(0)

  const { data: session } = useSession()

  // Sync when initialRating prop changes (e.g., after fetching user's saved rating)
  useEffect(() => {
    const next = normalizeInitial(initialRating)
    setRating(next)
    setInputRating(next.toString())
  }, [initialRating])

  useEffect(() => {
    const fetchRatings = async () => {
      try {
        const response = await fetch(`/api/ratings?contentId=${contentId}&contentType=${contentType}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch ratings')
        }
        
        const data = await response.json()
        setUserRatings(data.ratings || [])
        setAverageRating(typeof data.averageRating === 'number' ? data.averageRating : 0)

        // If no initial/user-prop rating yet, hydrate from the current user's saved rating in the list
        if (session?.user?.id && (!initialRating || initialRating === 0)) {
          const mine = (data.ratings || []).find((r: any) => r.userId === session.user.id)
          if (mine && typeof mine.rating === 'number') {
            const val = mine.rating
            setRating(val)
            setInputRating(val.toFixed(1))
          }
        }
      } catch (error) {
        console.error('Error fetching ratings:', error)
      }
    }

    if (contentId && contentType) {
      fetchRatings()
    }
  }, [contentId, contentType, session?.user?.id, session?.user?.username, initialRating])

  const handleStarClick = (value: number) => {
    // Convert 5-star scale to 10-point scale
    const newRating = value * 2
    setRating(newRating)
    setInputRating(newRating.toFixed(1))
  }

  const handleStarHover = (value: number) => {
    setHoveredRating(value)
  }

  const handleStarLeave = () => {
    setHoveredRating(0)
  }

  const handleSliderChange = (value: number[]) => {
    const newRating = value[0]
    setRating(newRating)
    setInputRating(newRating.toFixed(1))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputRating(value)

    const numValue = Number.parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 10) {
      setRating(numValue)
    }
  }

  const handleInputBlur = () => {
    let numValue = Number.parseFloat(inputRating)

    if (isNaN(numValue)) {
      numValue = 0
    } else if (numValue < 0) {
      numValue = 0
    } else if (numValue > 10) {
      numValue = 10
    }

    // Round to nearest 0.1
    numValue = Math.round(numValue * 10) / 10

    setRating(numValue)
    setInputRating(numValue.toFixed(1))
  }

  const handleSubmitRating = async () => {
    try {
      if (!session?.user?.id) {
        alert("You must be logged in to submit a rating")
        return
      }
      const userId = session.user.id

      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId,
          contentType,
          userId,
          rating,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save rating')
      }

      // After successful submission, refresh the ratings
      const ratingsResponse = await fetch(`/api/ratings?contentId=${contentId}&contentType=${contentType}`)
      
      if (ratingsResponse.ok) {
        const data = await ratingsResponse.json()
        setUserRatings(data.ratings || [])
        setAverageRating(data.averageRating || 0)
      }
    } catch (error) {
      console.error('Error submitting rating:', error)
    }
  }

  // Calculate star fill percentages based on 10-point rating
  const getStarFillPercentage = (starPosition: number) => {
    // For a 10-point scale mapped to 5 stars
    const effectiveRating = hoveredRating > 0 ? hoveredRating * 2 : rating
    const starValue = starPosition * 2 // Each star represents 2 points

    if (effectiveRating >= starValue) {
      return 100 // Full star
    } else if (effectiveRating > starValue - 2) {
      // Partial star - calculate percentage
      return ((effectiveRating - (starValue - 2)) / 2) * 100
    }
    return 0 // Empty star
  }

  return (
    <div className="space-y-6">
      <Card className="lcars-panel">
        <CardHeader>
          <CardTitle>Your Rating</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-6">
            <div className="lcars-rating flex items-center justify-center space-x-2" onMouseLeave={handleStarLeave}>
              {[1, 2, 3, 4, 5].map((value) => (
                <div key={value} className="relative">
                  <Star
                    className="h-10 w-10 cursor-pointer text-gray-400"
                    onClick={() => handleStarClick(value)}
                    onMouseEnter={() => handleStarHover(value)}
                  />
                  <div
                    className="absolute top-0 left-0 overflow-hidden pointer-events-none"
                    style={{ width: `${getStarFillPercentage(value)}%` }}
                  >
                    <Star className="h-10 w-10 text-yellow-500 fill-yellow-500" />
                  </div>
                </div>
              ))}
            </div>

            <div className="w-full max-w-md">
              <Slider
                value={[rating]}
                min={0}
                max={10}
                step={0.1}
                onValueChange={handleSliderChange}
                className="w-full"
              />
              <div className="flex justify-between mt-2 text-sm text-gray-400">
                <span>0</span>
                <span>2</span>
                <span>4</span>
                <span>6</span>
                <span>8</span>
                <span>10</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={inputRating}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className="w-20 text-center bg-black border-orange-500"
              />
              <span className="text-xl font-bold text-orange-500">/ 10.0</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button className="lcars-button" onClick={handleSubmitRating}>
            Submit Rating
          </Button>
        </CardFooter>
      </Card>

      <Card className="lcars-panel">
        <CardHeader>
          <CardTitle>Community Ratings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center">
              <Star className="h-8 w-8 text-yellow-500 fill-yellow-500 mr-2" />
              <span className="text-3xl font-bold">{averageRating.toFixed(1)}</span>
              <span className="text-gray-400 ml-2">/ 10.0</span>
            </div>
          </div>

          <div className="space-y-4">
            {userRatings.map((userRating, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                <div>
                  <div className="font-medium">{userRating.username}</div>
                  <div className="text-sm text-gray-400">{userRating.date}</div>
                </div>
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 mr-1" />
                  <span>{userRating.rating.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
