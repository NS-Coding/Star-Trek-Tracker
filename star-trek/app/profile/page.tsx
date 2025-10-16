"use client"
export const dynamic = "force-dynamic"

import { useSession } from "next-auth/react"
import useSWR from "swr"
import axios from "axios"
import { LcarsHeader } from "@/components/lcars-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Star, Users } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const sessionResult = useSession()
  const session = sessionResult?.data
  const router = useRouter()

  const fetcher = (url: string) => axios.get(url).then((r) => r.data)
  const { data: userData, isLoading: loading } = useSWR("/api/me", fetcher)

  if (!session && !loading) {
    router.push("/login")
    return null
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <LcarsHeader title="User Profile" />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">Loading profile data...</div>
        </div>
      </main>
    )
  }

  const stats = {
    totalWatched: userData?.stats?.totalWatched ?? 0,
    totalRated: userData?.stats?.totalRated ?? 0,
    averageRating: userData?.stats?.averageRating ?? 0,
    watchTimeHours: userData?.stats?.watchTimeHours ?? 0,
    topRatedEpisodes: userData?.stats?.topRatedEpisodes ?? [],
    recentActivity: userData?.stats?.recentActivity ?? [],
  }

  return (
    <main className="min-h-screen">
      <LcarsHeader title={`Profile: ${userData.username}`} />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card className="lcars-panel">
              <CardHeader>
                <CardTitle>User Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center mb-6">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-900 to-black border-4 border-orange-500 flex items-center justify-center mb-4">
                    <span className="text-4xl font-bold text-orange-500">
                      {userData.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold">{userData.username}</h2>
                  <p className="text-gray-400">{userData.email}</p>
                  {userData.isAdmin && <Badge className="mt-2 bg-yellow-500 text-black">Administrator</Badge>}
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Member Since:</span>
                    <span>{userData.joinDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Episodes Watched:</span>
                    <span>{stats.totalWatched} / {userData?.stats?.totalEpisodesMovies ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Episodes Rated:</span>
                    <span>{stats.totalRated} / {userData?.stats?.totalRateableContent ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Episodes with Notes:</span>
                    <span>{userData?.stats?.notesWithContent ?? 0} / {userData?.stats?.totalNoteableContent ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Average Rating:</span>
                    <span className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 mr-1" />
                      {stats.averageRating.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Watch Time:</span>
                    <span>{stats.watchTimeHours} hours</span>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <Button className="lcars-button w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Export My Data
                  </Button>

                  {userData.isAdmin && (
                    <Button
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                      onClick={() => router.push("/admin")}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Administrator Panel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Tabs defaultValue="favorites" className="w-full">
              <TabsList className="lcars-tabs mb-6">
                <TabsTrigger value="favorites">Favorites</TabsTrigger>
                <TabsTrigger value="notes">My Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="favorites">
                <Card className="lcars-panel">
                  <CardHeader>
                    <CardTitle>Favorites</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(userData?.favorites || []).length === 0 && (
                        <p>No favorites yet.</p>
                      )}
                      {(userData?.favorites || []).map((fav: any) => (
                        <div key={fav.id} className="p-3 bg-gray-900 rounded-lg flex items-center justify-between">
                          <div className="font-medium">{fav.title}</div>
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 mr-1" />
                            <span>{fav.rating.toFixed(1)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes">
                <Card className="lcars-panel">
                  <CardHeader>
                    <CardTitle>My Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(userData?.notes || []).length === 0 && <p>No notes yet.</p>}
                      {(userData?.notes || []).map((note: any) => (
                        <div key={note.id} className="p-4 bg-gray-900 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">{note.title}</div>
                            <div className="text-sm text-gray-400">{note.updatedAt?.split('T')[0]}</div>
                          </div>
                          <p className="text-gray-300">{note.excerpt}...</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex justify-end">
                      <Button className="lcars-button" onClick={() => router.push("/export-notes")}>
                        <Download className="h-4 w-4 mr-2" />
                        Export All Notes
                      </Button>
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
