import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, Clock, Star } from "lucide-react"
import Image from "next/image"

interface ContentDetailsProps {
  content: any // This would be properly typed in a real application
}

export function ContentDetails({ content }: ContentDetailsProps) {
  if (!content) return null

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-orange-500">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline" className="bg-orange-500 text-black font-bold">
              {content.type.toUpperCase()}
            </Badge>
            {content.watched && (
              <Badge variant="outline" className="bg-green-500 text-black font-bold">
                WATCHED
              </Badge>
            )}
          </div>

          <h2 className="text-2xl font-bold mb-4">{content.title}</h2>

          {content.summary && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Summary</h3>
              <p className="text-gray-300">{content.summary}</p>
            </div>
          )}

          {(content.type === "episode" && content.airDate) && (
            <div className="mb-6 -mt-4 flex items-center gap-2 text-sm text-gray-400">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span>Aired: {content.airDate}</span>
            </div>
          )}

          {(content.type === "movie" && content.releaseDate) && (
            <div className="mb-6 -mt-4 flex items-center gap-2 text-sm text-gray-400">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span>Released: {content.releaseDate}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-4 mb-6">
            {content.watchedDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                <span>Watched on: {content.watchedDate}</span>
              </div>
            )}

            {content.duration && (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <span>{content.duration} minutes</span>
              </div>
            )}

            {content.rating && (
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <span>{content.rating.toFixed(1)} / 10.0</span>
              </div>
            )}
          </div>

          {content.type === "show" && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Watch Progress</h3>
              {(() => {
                const total = Number(content.progress?.total ?? 0)
                const watched = Number(content.progress?.watched ?? 0)
                const pct = total > 0 ? Math.round((watched / total) * 100) : 0
                return (
                  <>
                    <Progress value={pct} className="h-2 bg-gray-700 [&>div]:bg-orange-500" />
                    <div className="flex justify-between mt-1 text-sm text-gray-400">
                      <span>{pct}% Complete</span>
                      <span>{watched}/{total} Episodes</span>
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </div>

        <div className="md:w-1/3 flex justify-center">
          {content.imagePath ? (
            <div className="w-full max-w-[200px] aspect-[2/3] rounded-lg overflow-hidden border-2 border-orange-500">
              <Image
                src={content.imagePath || "/placeholder.svg"}
                alt={content.title}
                width={200}
                height={300}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = `/placeholder.svg?height=300&width=200`
                }}
              />
            </div>
          ) : (
            <div className="w-full max-w-[200px] aspect-[2/3] bg-black border-2 border-orange-500 rounded-lg overflow-hidden">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-black">
                <span className="text-orange-500 font-bold">
                  {content.type === "show"
                    ? "SERIES"
                    : content.type === "movie"
                      ? "MOVIE"
                      : content.type === "season"
                        ? "SEASON"
                        : "EPISODE"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
