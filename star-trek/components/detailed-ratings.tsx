import { Star } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface DetailedRatingsProps {
  item: {
    type: "show" | "movie" | "season" | "episode"
    individualRating?: number
    aggregateRating?: number
    imdbRating?: number
    averageIndividualRating?: number
    averageAggregateRating?: number
  }
  ratingType: string
}

export function DetailedRatings({ item, ratingType }: DetailedRatingsProps) {
  const isShowOrSeason = item.type === "show" || item.type === "season"
  const showImdb = item.type === "show" || item.type === "movie" || item.type === "episode"

  return (
    <Accordion type="single" collapsible className="border-none">
      <AccordionItem value="detailed-ratings" className="border-none">
        <AccordionTrigger className="py-1 text-sm text-blue-400 hover:text-blue-300">View All Ratings</AccordionTrigger>
        <AccordionContent>
          <div className="pt-2 pl-2 pr-2 bg-gray-900/50 rounded-md">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Your Rating:</span>
                <div className="flex items-center">
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 mr-1" />
                  <span>{item.individualRating?.toFixed(1) || "N/A"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">User Average:</span>
                <div className="flex items-center">
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 mr-1" />
                  <span>{item.aggregateRating?.toFixed(1) || "N/A"}</span>
                </div>
              </div>

              {showImdb && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">IMDb Rating:</span>
                  <div className="flex items-center">
                    <Star className="h-3 w-3 text-blue-400 fill-blue-400 mr-1" />
                    <span>{item.imdbRating?.toFixed(1) || "N/A"}</span>
                  </div>
                </div>
              )}

              {isShowOrSeason && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Avg Episode (You):</span>
                    <div className="flex items-center">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 mr-1" />
                      <span>{item.averageIndividualRating?.toFixed(1) || "N/A"}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between col-span-2">
                    <span className="text-gray-400">Avg Episode (All Users):</span>
                    <div className="flex items-center">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 mr-1" />
                      <span>{item.averageAggregateRating?.toFixed(1) || "N/A"}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
