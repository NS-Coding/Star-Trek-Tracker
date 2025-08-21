"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Star } from "lucide-react"
import { DetailedRatings } from "@/components/detailed-ratings"

interface ContentItem {
  id: string
  title: string
  type: "show" | "movie" | "season" | "episode"
  order: number
  watched: boolean
  individualRating?: number
  aggregateRating?: number
  imdbRating?: number
  averageIndividualRating?: number
  averageAggregateRating?: number
  imagePath?: string
  children?: ContentItem[]
}

interface ContentListProps {
  ratingType: string
  showUnwatchedOnly?: boolean
  sortBy?: string
  contentType?: string
  searchQuery?: string
}

export function ContentList({
  ratingType = "aggregate",
  showUnwatchedOnly = false,
  sortBy = "order",
  contentType = "all",
  searchQuery = "",
}: ContentListProps) {
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [defaultOpenKeys, setDefaultOpenKeys] = useState<string[]>([])
  const [confirmState, setConfirmState] = useState<{
    open: boolean
    id?: string
    checked?: boolean
    message?: string
    type?: string
  }>({ open: false })

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const params = new URLSearchParams({
          type: contentType,
          sortBy,
          unwatchedOnly: showUnwatchedOnly.toString(),
          search: searchQuery,
        })

        const response = await fetch(`/api/content?${params.toString()}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch content')
        }
        
        const data: ContentItem[] = await response.json()
        // find path to first episode not watched
        const pathKeys: string[] = []
        const dfs = (items: ContentItem[]): boolean => {
          for (const it of items) {
            if (it.type === 'episode' && !it.watched) {
              pathKeys.push(it.id)
              return true
            }
            if (it.children && dfs(it.children)) {
              pathKeys.push(it.id)
              return true
            }
          }
          return false
        }
        dfs(data)
        setDefaultOpenKeys(pathKeys)
        setContent(data)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching content:', error)
        setLoading(false)
      }
    }

    fetchContent()
  }, [])

  const performWatchChange = async (id: string, checked: boolean) => {
    // First find the content item to get its type
    const findContentItem = (items: ContentItem[]): ContentItem | null => {
      for (const item of items) {
        if (item.id === id) {
          return item
        } else if (item.children) {
          const found = findContentItem(item.children)
          if (found) return found
        }
      }
      return null
    }

    const contentItem = findContentItem(content)
    if (!contentItem) return

    try {
      // helper to gather descendant nodes
      const gatherIds = (node: ContentItem): { id: string; type: string }[] => {
        let arr: { id: string; type: string }[] = [{ id: node.id, type: node.type }]
        if (node.children) {
          node.children.forEach((ch) => {
            arr = arr.concat(gatherIds(ch))
          })
        }
        return arr
      }

      const targets = gatherIds(contentItem)

      // Update watch status in DB for all targets (fire-and-forget)
      await Promise.all(
        targets.map((t) =>
          fetch('/api/watch-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contentId: t.id, contentType: t.type, watched: checked }),
          })
        )
      )

      const cascadeState = (node: ContentItem): ContentItem => {
        const updated: ContentItem = { ...node, watched: checked }
        if (node.children) {
          updated.children = node.children.map(cascadeState)
        }
        return updated
      }

      const updateWatchStatus = (items: ContentItem[]): ContentItem[] => {
        return items.map((item) => {
          if (item.id === id) {
            return cascadeState(item)
          } else if (item.children) {
            return { ...item, children: updateWatchStatus(item.children) }
          }
          return item
        })
      }

      setContent(updateWatchStatus(content))
    } catch (error) {
      console.error('Error updating watch status:', error)
    }
  }

  const handleWatchedChange = async (id: string, checked: boolean) => {
    const findContentItem = (items: ContentItem[]): ContentItem | null => {
      for (const item of items) {
        if (item.id === id) return item
        if (item.children) {
          const found = findContentItem(item.children)
          if (found) return found
        }
      }
      return null
    }

    const contentItem = findContentItem(content)
    if (!contentItem) return

    // Determine if confirmation needed and show themed dialog
    let message: string | undefined
    if (contentItem.watched && !checked) {
      message = `Mark this ${contentItem.type} as unwatched? This will remove watch dates${
        contentItem.type !== 'episode' ? ' and may affect its children' : ''
      }.`
    } else if ((contentItem.type === 'show' || contentItem.type === 'season') && checked) {
      message = `Mark entire ${contentItem.type} as watched? This will cascade to all contained items.`
    }

    if (message) {
      setConfirmState({ open: true, id, checked, message, type: contentItem.type })
      return
    }

    await performWatchChange(id, checked)
  }

  const getRating = (item: ContentItem, ratingType: string) => {
    switch (ratingType) {
      case "individual":
        return item.individualRating
      case "aggregate":
        return item.aggregateRating
      case "imdb":
        return item.imdbRating
      default:
        return item.aggregateRating
    }
  }

  const getRatingLabel = (ratingType: string) => {
    switch (ratingType) {
      case "individual":
        return "You"
      case "aggregate":
        return "Users"
      case "imdb":
        return "IMDb"
      default:
        return "Rating"
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading content...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold mb-4">Star Trek Content</h2>

      {content.map((item) => (
        <Card key={item.id} className="lcars-panel">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center space-x-4">
              <Checkbox
                id={`watched-${item.id}`}
                checked={item.watched}
                onCheckedChange={(checked) => handleWatchedChange(item.id, checked as boolean)}
                className="lcars-checkbox"
              />
              <div className="flex items-center space-x-3">
                {item.imagePath && (
                  <div className="relative h-12 w-16 overflow-hidden rounded-md border border-orange-500">
                    <Image
                      src={item.imagePath || "/placeholder.svg"}
                      alt={item.title}
                      width={64}
                      height={48}
                      className="object-cover"
                      // Fallback to placeholder if image fails to load
                      onError={(e) => {
                        e.currentTarget.src = `/placeholder.svg?height=48&width=64`
                      }}
                    />
                  </div>
                )}
                <CardTitle className="text-lg">
                  <Link href={`/content/${item.type}/${item.id}`} className="hover:text-orange-400 transition-colors">
                    {item.title}
                  </Link>
                </CardTitle>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getRating(item, ratingType) && (
                <div className="flex items-center">
                  <Star
                    className={`h-4 w-4 mr-1 fill-current ${ratingType === "imdb" ? "text-blue-400" : "text-yellow-500"}`}
                  />
                  <span>{getRating(item, ratingType)?.toFixed(1)}</span>
                  <span className="text-xs text-gray-400 ml-1">{getRatingLabel(ratingType)}</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <DetailedRatings item={item} ratingType={ratingType} />
          </CardContent>

          {item.children && (
            <CardContent>
              <Accordion
                key={item.id}
                type="single"
                collapsible
                defaultValue={defaultOpenKeys.includes(item.id) ? `content-${item.id}` : undefined}
              >
                <AccordionItem value={`content-${item.id}`} className="border-none">
                  <AccordionTrigger className="py-2 text-orange-500 hover:text-orange-400">
                    View {item.type === "show" ? "Seasons" : "Episodes"}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-6 space-y-4">
                      {item.children.map((child) => (
                        <div key={child.id}>
                          <div className="flex items-center justify-between py-2">
                            <div className="flex items-center space-x-4">
                              <Checkbox
                                id={`watched-${child.id}`}
                                checked={child.watched}
                                onCheckedChange={(checked) => handleWatchedChange(child.id, checked as boolean)}
                                className="lcars-checkbox"
                              />
                              <div className="flex items-center space-x-3">
                                {child.imagePath && (
                                  <div className="relative h-10 w-14 overflow-hidden rounded-md border border-orange-500">
                                    <Image
                                      src={child.imagePath || "/placeholder.svg"}
                                      alt={child.title}
                                      width={56}
                                      height={40}
                                      className="object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = `/placeholder.svg?height=40&width=56`
                                      }}
                                    />
                                  </div>
                                )}
                                <Link
                                  href={`/content/${child.type}/${child.id}`}
                                  className="hover:text-orange-400 transition-colors font-medium"
                                >
                                  {child.title}
                                </Link>
                              </div>
                            </div>
                            {getRating(child, ratingType) && (
                              <div className="flex items-center">
                                <Star
                                  className={`h-4 w-4 mr-1 fill-current ${ratingType === "imdb" ? "text-blue-400" : "text-yellow-500"}`}
                                />
                                <span>{getRating(child, ratingType)?.toFixed(1)}</span>
                                <span className="text-xs text-gray-400 ml-1">{getRatingLabel(ratingType)}</span>
                              </div>
                            )}
                          </div>

                          <div className="pl-10">
                            <DetailedRatings item={child} ratingType={ratingType} />
                          </div>

                          {child.children && (
                            <Accordion type="single" collapsible className="border-none pl-6">
                              <AccordionItem value={`content-${child.id}`} className="border-none">
                                <AccordionTrigger className="py-2 text-blue-500 hover:text-blue-400">
                                  View Episodes
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="pl-6 space-y-2">
                                    {child.children.map((episode) => (
                                      <div key={episode.id}>
                                        <div className="flex items-center justify-between py-2">
                                          <div className="flex items-center space-x-4">
                                            <Checkbox
                                              id={`watched-${episode.id}`}
                                              checked={episode.watched}
                                              onCheckedChange={(checked) =>
                                                handleWatchedChange(episode.id, checked as boolean)
                                              }
                                              className="lcars-checkbox"
                                            />
                                            <div className="flex items-center space-x-3">
                                              {episode.imagePath && (
                                                <div className="relative h-8 w-12 overflow-hidden rounded-md border border-orange-500">
                                                  <Image
                                                    src={episode.imagePath || "/placeholder.svg"}
                                                    alt={episode.title}
                                                    width={48}
                                                    height={32}
                                                    className="object-cover"
                                                    onError={(e) => {
                                                      e.currentTarget.src = `/placeholder.svg?height=32&width=48`
                                                    }}
                                                  />
                                                </div>
                                              )}
                                              <Link
                                                href={`/content/${episode.type}/${episode.id}`}
                                                className="hover:text-orange-400 transition-colors"
                                              >
                                                {episode.title}
                                              </Link>
                                            </div>
                                          </div>
                                          {getRating(episode, ratingType) && (
                                            <div className="flex items-center">
                                              <Star
                                                className={`h-4 w-4 mr-1 fill-current ${ratingType === "imdb" ? "text-blue-400" : "text-yellow-500"}`}
                                              />
                                              <span>{getRating(episode, ratingType)?.toFixed(1)}</span>
                                              <span className="text-xs text-gray-400 ml-1">
                                                {getRatingLabel(ratingType)}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        {/* Place the DetailedRatings component right after each episode */}
                                        <div className="pl-10 mb-4">
                                          <DetailedRatings item={episode} ratingType={ratingType} />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          )}
        </Card>
      ))}
      <AlertDialog open={confirmState.open} onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}>
        <AlertDialogContent className="lcars-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Update</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmState.id && typeof confirmState.checked === 'boolean') {
                  await performWatchChange(confirmState.id, confirmState.checked)
                }
                setConfirmState({ open: false })
              }}
              className="lcars-button"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
