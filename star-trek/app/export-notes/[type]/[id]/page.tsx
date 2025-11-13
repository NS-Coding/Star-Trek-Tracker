"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { LcarsHeader } from "@/components/lcars-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Download, ArrowLeft } from "lucide-react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"

interface Note {
  id: string
  username: string
  content: string
  timestamp: string
  contentTitle?: string
}

export default function ExportNotesPage() {
  const params = useParams()
  const { type, id } = params
  const [notes, setNotes] = useState<Note[]>([])
  const [contentTitle, setContentTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [includeOtherUsers, setIncludeOtherUsers] = useState(false)
  const [exportFormat, setExportFormat] = useState("markdown")

  useEffect(() => {
    // Mock data fetch - would be replaced with actual API call
    setTimeout(() => {
      setContentTitle(
        type === "show"
          ? "Star Trek: The Next Generation"
          : type === "movie"
            ? "Star Trek: First Contact"
            : type === "season"
              ? "Season 3"
              : "Episode 5: The Inner Light",
      )

      setNotes([
        {
          id: "1",
          username: "current_user",
          content:
            "I found the character development in this episode particularly compelling.\n\n## Highlights\n- Picard's emotional journey\n- The flute melody is *haunting*\n- The ending scene is **powerful**",
          timestamp: "2023-05-20T10:30:00Z",
          contentTitle: "Episode 5: The Inner Light",
        },
        {
          id: "2",
          username: "picard",
          content: "This episode explores the nature of humanity and consciousness in a profound way.",
          timestamp: "2023-05-10T14:30:00Z",
          contentTitle: "Episode 5: The Inner Light",
        },
        {
          id: "3",
          username: "data",
          content:
            "The philosophical implications of this narrative are fascinating. It raises questions about identity and perception.\n\n" +
            "## Key Themes\n" +
            "- Identity and self-perception\n" +
            "- The nature of consciousness\n" +
            "- **Time** and its subjective experience",
          timestamp: "2023-05-15T09:15:00Z",
          contentTitle: "Episode 5: The Inner Light",
        },
        {
          id: "4",
          username: "current_user",
          content:
            "The Borg are truly the most terrifying villains in Star Trek. Their collective consciousness represents the antithesis of Federation values.",
          timestamp: "2023-04-12T16:45:00Z",
          contentTitle: "Star Trek: First Contact",
        },
      ])
      setLoading(false)
    }, 1000)
  }, [type, id])

  const getFilteredNotes = () => {
    if (includeOtherUsers) {
      return notes
    } else {
      return notes.filter((note) => note.username === "current_user")
    }
  }

  const getPreviewNotes = () => {
    // Return a subset of notes for preview (max 2)
    return getFilteredNotes().slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const generateExportContent = () => {
    const filteredNotes = getFilteredNotes()
    let content = ""

    if (exportFormat === "markdown") {
      content += `# Notes for ${contentTitle}\n\n`

      filteredNotes.forEach((note) => {
        content += `## ${note.contentTitle || contentTitle} - ${formatDate(note.timestamp)}\n`
        if (includeOtherUsers) {
          content += `### By: ${note.username}\n`
        }
        content += `\n${note.content}\n\n---\n\n`
      })
    } else {
      // Plain text format
      content += `NOTES FOR ${contentTitle.toUpperCase()}\n\n`

      filteredNotes.forEach((note) => {
        content += `${note.contentTitle || contentTitle} - ${formatDate(note.timestamp)}\n`
        if (includeOtherUsers) {
          content += `By: ${note.username}\n`
        }
        content += `\n${note.content}\n\n-----------------\n\n`
      })
    }

    return content
  }

  const handleExport = () => {
    const content = generateExportContent()
    const fileExtension = exportFormat === "markdown" ? "md" : "txt"
    const fileName = `${contentTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-notes.${fileExtension}`

    // Create a blob and download it
    const blob = new Blob([content], { type: `text/${fileExtension === "md" ? "markdown" : "plain"}` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <LcarsHeader title="Loading Notes..." />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">Loading notes data...</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <LcarsHeader title={`Export Notes: ${contentTitle}`} />
      <div className="container mx-auto px-4 py-8">
        <Link href={`/content/${type}/${id}`} className="flex items-center text-orange-500 hover:text-orange-400 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Content
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="lcars-panel">
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3">Content Options</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-others"
                    checked={includeOtherUsers}
                    onCheckedChange={(checked) => setIncludeOtherUsers(checked as boolean)}
                    className="lcars-checkbox"
                  />
                  <Label htmlFor="include-others">Include notes from other users</Label>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3">Format Options</h3>
                <RadioGroup value={exportFormat} onValueChange={setExportFormat}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="markdown" id="format-md" className="text-orange-500" />
                    <Label htmlFor="format-md">Markdown (.md)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="text" id="format-txt" className="text-orange-500" />
                    <Label htmlFor="format-txt">Plain Text (.txt)</Label>
                  </div>
                </RadioGroup>
              </div>

              <Button className="lcars-button w-full" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Download Notes
              </Button>
            </CardContent>
          </Card>

          <Card className="lcars-panel">
            <CardHeader>
              <CardTitle>Notes Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 rounded-lg p-4 max-h-[400px] overflow-auto">
                {getPreviewNotes().length > 0 ? (
                  <div className="space-y-6">
                    {getPreviewNotes().map((note) => (
                      <div
                        key={note.id}
                        className="border-b border-gray-700 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0"
                      >
                        <div className="flex justify-between mb-2">
                          <div className="font-medium">{note.contentTitle || contentTitle}</div>
                          <div className="text-sm text-gray-400">{formatDate(note.timestamp)}</div>
                        </div>
                        {includeOtherUsers && <div className="text-sm text-orange-500 mb-2">By: {note.username}</div>}
                        <div className="prose prose-invert max-w-none text-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{note.content}</ReactMarkdown>
                        </div>
                      </div>
                    ))}

                    {getFilteredNotes().length > 2 && (
                      <div className="text-center text-gray-400 text-sm pt-2">
                        + {getFilteredNotes().length - 2} more notes will be included in the export
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">No notes to export with the current settings</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
