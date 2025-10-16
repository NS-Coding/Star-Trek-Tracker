"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { LcarsHeader } from "@/components/lcars-header"
import { ContentDetails } from "@/components/content-details"
import { RatingSystem } from "@/components/rating-system"
import { NotesEditor } from "@/components/notes-editor"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

export default function ContentPage() {
  const params = useParams()
  const type = params.type as string
  const id = params.id as string
  interface ContentData {
    id: string
    type: string
    title: string
    summary?: string
    airDate?: string
    releaseDate?: string
    description?: string
    rating?: number
    duration?: number
    imdbRating?: number
    userRating?: number
    watched?: boolean
    watchedDate?: string
    imagePath?: string
    artworkUrl?: string
    number?: number
    episodeNumber?: number
    season?: { show?: { artworkUrl?: string } }
    show?: { artworkUrl?: string }
    watchStatus?: Array<{ createdAt: string }>
  }

  const [content, setContent] = useState<ContentData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(`/api/content/${type}/${id}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch content')
        }
        
        const data = await response.json()
        
        // Transform data to match the expected format
        const formattedContent = {
          ...data,
          id: data.id,
          type: type,
          title: data.title || 
            (type === 'season' ? `Season ${data.number}` : 
            type === 'episode' ? `Episode ${data.episodeNumber}: ${data.title}` : data.title),
          summary: data.description,
          duration: typeof data.runtime === 'number' ? data.runtime : undefined,
          airDate: type === 'episode' && data.airDate ? String(data.airDate).split('T')[0] : undefined,
          releaseDate: type === 'movie' && data.releaseDate ? String(data.releaseDate).split('T')[0] : undefined,
          rating: data.imdbRating,
          userRating: data.userRating,
          watched: data.watched || false,
          watchedDate: data.watchStatus?.[0]?.createdAt?.split('T')[0],
          imagePath: data.artworkUrl || 
            (type === 'episode' ? data.season?.show?.artworkUrl : 
            type === 'season' ? data.show?.artworkUrl : data.artworkUrl),
        }
        
        setContent(formattedContent)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching content:', error)
        setLoading(false)
      }
    }

    if (id && type) {
      fetchContent()
    }
  }, [id, type])

  if (loading) {
    return (
      <main className="min-h-screen">
        <LcarsHeader title="Loading Content..." />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-64 w-full mb-8" />
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <LcarsHeader title={content?.title || "Content Details"} />
      <div className="container mx-auto px-4 py-8">
        <ContentDetails content={content} />

        <Tabs defaultValue="rating" className="w-full mt-8">
          <TabsList className="lcars-tabs mb-4">
            <TabsTrigger value="rating">Rating</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="rating">
            <RatingSystem contentId={id} contentType={type} initialRating={content?.userRating} />
          </TabsContent>
          <TabsContent value="notes">
            <NotesEditor contentId={id} contentType={type} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
