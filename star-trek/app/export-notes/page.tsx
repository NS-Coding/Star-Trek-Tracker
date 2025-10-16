"use client"

import { useState, useEffect, useMemo } from "react"
import { LcarsHeader } from "@/components/lcars-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Download } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ReactMarkdown from "react-markdown"

interface Note {
  id: string
  username: string
  content: string
  timestamp: string
  contentId: string
  contentType: string
  contentTitle: string
}

interface ContentItem {
  id: string
  title: string
  type: "show" | "season" | "movie"
  noteCount: number
  progressEpisodes?: { noted: number; total: number }
  displayTitle?: string
}

export default function ExportNotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContent, setSelectedContent] = useState<string[]>([])
  const [includeOtherUsers, setIncludeOtherUsers] = useState(false)
  const [exportFormat, setExportFormat] = useState("markdown")

  // Load content summary whenever includeOtherUsers changes
  useEffect(() => {
    let cancelled = false
    async function loadSummary() {
      setLoading(true)
      try {
        const res = await fetch(`/api/export-notes/summary?includeOthers=${includeOtherUsers ? "1" : "0"}`)
        if (!res.ok) throw new Error("Failed to load content summary")
        const data = (await res.json()) as { items: ContentItem[] }
        if (!cancelled) {
          setContentItems(data.items)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadSummary()
    return () => {
      cancelled = true
    }
  }, [includeOtherUsers])

  // Load notes for preview when selection or includeOtherUsers or contentItems change
  useEffect(() => {
    let cancelled = false
    async function loadNotes() {
      if (contentItems.length === 0) {
        setNotes([])
        return
      }
      const idsToQuery = selectedContent.length > 0 ? selectedContent : contentItems.map((i) => i.id)
      try {
        const res = await fetch("/api/export-notes/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedIds: idsToQuery, includeOthers: includeOtherUsers }),
        })
        if (!res.ok) throw new Error("Failed to load notes")
        const data = (await res.json()) as { notes: Note[] }
        if (!cancelled) setNotes(data.notes)
      } catch {
        if (!cancelled) setNotes([])
      }
    }
    loadNotes()
    return () => {
      cancelled = true
    }
  }, [selectedContent, includeOtherUsers, contentItems])

  const getFilteredContent = () => contentItems

  const getFilteredNotes = () => notes

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const handleSelectAllContent = (checked: boolean) => {
    if (checked) {
      setSelectedContent(getFilteredContent().map((item) => item.id))
    } else {
      setSelectedContent([])
    }
  }

  const handleToggleContent = (contentId: string, checked: boolean) => {
    if (checked) {
      setSelectedContent([...selectedContent, contentId])
    } else {
      setSelectedContent(selectedContent.filter((id) => id !== contentId))
    }
  }

  const generateExportContent = () => {
    const filteredNotes = getFilteredNotes()
    let content = ""

    if (exportFormat === "markdown") {
      content += `# Star Trek Content Notes\n\n`
      content += `Exported on ${new Date().toLocaleDateString()}\n\n`

      // Group notes by content
      const contentGroups = filteredNotes.reduce(
        (groups, note) => {
          if (!groups[note.contentTitle]) {
            groups[note.contentTitle] = []
          }
          groups[note.contentTitle].push(note)
          return groups
        },
        {} as Record<string, Note[]>,
      )

      // Generate content for each group
      Object.entries(contentGroups).forEach(([title, contentNotes]) => {
        content += `## ${title}\n\n`

        contentNotes.forEach((note) => {
          content += `### ${formatDate(note.timestamp)}\n`
          if (includeOtherUsers) {
            content += `#### By: ${note.username}\n`
          }
          content += `\n${note.content}\n\n---\n\n`
        })
      })
    } else {
      // Plain text format
      content += `STAR TREK CONTENT NOTES\n\n`
      content += `Exported on ${new Date().toLocaleDateString()}\n\n`

      // Group notes by content
      const contentGroups = filteredNotes.reduce(
        (groups, note) => {
          if (!groups[note.contentTitle]) {
            groups[note.contentTitle] = []
          }
          groups[note.contentTitle].push(note)
          return groups
        },
        {} as Record<string, Note[]>,
      )

      // Generate content for each group
      Object.entries(contentGroups).forEach(([title, contentNotes]) => {
        content += `${title.toUpperCase()}\n${"=".repeat(title.length)}\n\n`

        contentNotes.forEach((note) => {
          content += `Date: ${formatDate(note.timestamp)}\n`
          if (includeOtherUsers) {
            content += `By: ${note.username}\n`
          }
          content += `\n${note.content}\n\n-----------------\n\n`
        })
      })
    }

    return content
  }

  const handleExport = () => {
    if (selectedContent.length === 0) {
      alert("Please select at least one content item to export notes from.")
      return
    }

    const content = generateExportContent()
    const fileExtension = exportFormat === "markdown" ? "md" : "txt"
    const fileName = `star-trek-notes-${new Date().toISOString().split("T")[0]}.${fileExtension}`

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
      <LcarsHeader title="Export Notes" />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="lcars-panel">
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Content Options</h3>
                  <div className="flex items-center space-x-2 mb-4">
                    <Checkbox
                      id="include-others"
                      checked={includeOtherUsers}
                      onCheckedChange={(checked) => setIncludeOtherUsers(checked as boolean)}
                      className="lcars-checkbox"
                    />
                    <Label htmlFor="include-others">Include notes from other users</Label>
                  </div>

                  {/* Content type filter removed as per requirements */}
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

                <Button className="lcars-button w-full" onClick={handleExport} disabled={selectedContent.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Notes
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Tabs defaultValue="select" className="w-full">
              <TabsList className="lcars-tabs mb-4">
                <TabsTrigger value="select">Select Content</TabsTrigger>
                <TabsTrigger value="preview">Preview Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="select">
                <Card className="lcars-panel">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Select Content to Export</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="select-all"
                          checked={
                            selectedContent.length === getFilteredContent().length && getFilteredContent().length > 0
                          }
                          onCheckedChange={handleSelectAllContent}
                          className="lcars-checkbox"
                        />
                        <Label htmlFor="select-all">Select All</Label>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {getFilteredContent().length > 0 ? (
                        getFilteredContent().map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`content-${item.id}`}
                                checked={selectedContent.includes(item.id)}
                                onCheckedChange={(checked) => handleToggleContent(item.id, checked as boolean)}
                                className="lcars-checkbox"
                              />
                              <div>
                                <Label htmlFor={`content-${item.id}`} className="font-medium">
                                  {item.displayTitle ?? item.title}
                                </Label>
                                <div className="text-sm text-gray-400">
                                  {(item.type.charAt(0).toUpperCase() + item.type.slice(1)) + ` • Notes: ${item.noteCount}`}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-400 py-8">
                          No content found with the current filter settings
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="preview">
                <Card className="lcars-panel">
                  <CardHeader>
                    <CardTitle>Notes Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-900 rounded-lg p-4 max-h-[500px] overflow-auto">
                      {getFilteredNotes().length > 0 ? (
                        <div className="space-y-6">
                          {getFilteredNotes()
                            .slice(0, 3)
                            .map((note) => (
                              <div
                                key={note.id}
                                className="border-b border-gray-700 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0"
                              >
                                <div className="flex justify-between mb-2">
                                  <div className="font-medium">{note.contentTitle}</div>
                                  <div className="text-sm text-gray-400">{formatDate(note.timestamp)}</div>
                                </div>
                                {includeOtherUsers && (
                                  <div className="text-sm text-orange-500 mb-2">By: {note.username}</div>
                                )}
                                <div className="prose prose-invert max-w-none text-sm">
                                  <ReactMarkdown>{note.content}</ReactMarkdown>
                                </div>
                              </div>
                            ))}

                          {getFilteredNotes().length > 3 && (
                            <div className="text-center text-gray-400 text-sm pt-2">
                              + {getFilteredNotes().length - 3} more notes will be included in the export
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-gray-400 py-8">
                          {selectedContent.length === 0
                            ? "Please select content to preview notes"
                            : "No notes found with the current settings"}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </main>
  )
}
