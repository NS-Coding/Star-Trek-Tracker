"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"

interface NotesEditorProps {
  contentId: string
  contentType: string
}

interface Note {
  id: string
  username: string
  content: string
  timestamp: string
}

export function NotesEditor({ contentId, contentType }: NotesEditorProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [userNote, setUserNote] = useState("")
  const [activeTab, setActiveTab] = useState("edit")
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const { data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch(`/api/notes?contentId=${contentId}&contentType=${contentType}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch notes')
        }
        
        const data = await response.json()
        setNotes(data.notes || [])
        
        // Find current user's note if it exists
        const currentUserId = session?.user?.id
        if (currentUserId) {
          const userNoteData = (data.notes || []).find((note: any) => note.userId === currentUserId)
          if (userNoteData) {
            setUserNote(userNoteData.content)
          } else {
            setUserNote('')
          }
        }
      } catch (error) {
        console.error('Error fetching notes:', error)
      }
    }

    if (contentId && contentType) {
      fetchNotes()
    }
  }, [contentId, contentType, session?.user?.id])

  useEffect(() => {
    const saveInterval = setInterval(() => {
      handleSaveNote()
    }, 30000) // Auto-save every 30 seconds

    return () => {
      clearInterval(saveInterval)
    }
  }, [userNote])

  // Also save when user switches to preview tab
  useEffect(() => {
    if (activeTab === "preview" && userNote.trim()) {
      handleSaveNote()
    }
  }, [activeTab])

  useEffect(() => {
    const key = `note-draft-${contentType}-${contentId}`
    const saved = localStorage.getItem(key)
    if (saved) setUserNote(saved)
  }, [contentId, contentType])

  useEffect(() => {
    const key = `note-draft-${contentType}-${contentId}`
    localStorage.setItem(key, userNote)
  }, [userNote, contentId, contentType])

  const handleSaveNote = async () => {
    if (!userNote.trim()) return

    try {
      if (!session?.user?.id) {
        alert("You must be logged in to save notes")
        return
      }
      const userId = session.user.id

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentId,
          contentType,
          userId,
          content: userNote,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save note')
      }

      const now = new Date()
      setLastSaved(now.toLocaleTimeString())

      // Refresh notes from the server
      const notesResponse = await fetch(`/api/notes?contentId=${contentId}&contentType=${contentType}`)
      
      if (notesResponse.ok) {
        const data = await notesResponse.json()
        setNotes(data.notes || [])
      }
    } catch (error) {
      console.error('Error saving note:', error)
    }
  }

  const handleExportNotes = () => {
    router.push(`/export-notes/${contentType}/${contentId}`)
  }

  return (
    <div className="space-y-6">
      <Card className="lcars-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Notes</CardTitle>
            {lastSaved && <span className="text-sm text-gray-400">Last saved: {lastSaved}</span>}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="edit" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="lcars-tabs mb-4">
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">
              <textarea
                className="w-full h-64 p-4 bg-black border border-orange-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={userNote}
                onChange={(e) => setUserNote(e.target.value)}
                placeholder="Enter your notes here... Markdown is supported."
              />
            </TabsContent>
            <TabsContent value="preview">
              <div className="w-full h-64 p-4 bg-black border border-orange-500 rounded-lg overflow-auto">
                <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{userNote}</ReactMarkdown>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-gray-400">
            <span>Markdown formatting is supported</span>
          </div>
          <div className="flex space-x-2">
            <Button className="lcars-button" onClick={handleExportNotes}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button className="lcars-button" onClick={handleSaveNote}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card className="lcars-panel">
        <CardHeader>
          <CardTitle>Community Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {notes
              .filter((note) => note.username !== "current_user")
              .map((note) => (
                <div key={note.id} className="p-4 bg-gray-900 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold">{note.username}</div>
                    <div className="text-sm text-gray-400">{new Date(note.timestamp).toLocaleString()}</div>
                  </div>
                  <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{note.content}</ReactMarkdown>
                  </div>
                </div>
              ))}

            {notes.filter((note) => note.username !== "current_user").length === 0 && (
              <div className="text-center text-gray-400 py-8">No community notes yet. Be the first to add a note!</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
