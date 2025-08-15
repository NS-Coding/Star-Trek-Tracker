"use client"

import { useState } from "react"
import { LcarsHeader } from "@/components/lcars-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, XCircle, UserCheck, UserX, Mail, Calendar } from "lucide-react"
import useSWR from "swr"
import axios from "axios"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface User {
  id: string
  username: string
  email: string
  isAdmin: boolean
  status: "active" | "pending" | "rejected"
  createdAt: string
  lastLogin?: string
  watchedCount?: number
  ratedCount?: number
}

export default function AdminPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const fetcher = (url: string) => axios.get(url).then((r) => r.data)
  const { data: users = [], isLoading, mutate } = useSWR<User[]>(
    status === "authenticated" && session?.user.isAdmin ? "/api/admin/users" : null,
    fetcher
  )

  // redirect non-admins
  if (status === "authenticated" && !session?.user.isAdmin) {
    router.push("/profile")
    return null
  }

  const patchUser = async (body: any) => {
    await axios.patch("/api/admin/users", body)
    mutate()
  }

  const handleApproveUser = (userId: string) => patchUser({ userId, action: "approve" })
  const handleRejectUser = (userId: string) => patchUser({ userId, action: "reject" })
  const handleToggleAdmin = (userId: string, makeAdmin: boolean) =>
    patchUser({ userId, action: "toggleAdmin", makeAdmin })

  if (isLoading || status === "loading") {
    return (
      <main className="min-h-screen">
        <LcarsHeader title="Administrative Controls" />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">Loading administrative data...</div>
        </div>
      </main>
    )
  }

  const pendingUsers = users.filter((user: any) => !user.isApproved)
  const activeUsers = users.filter((user: any) => user.isApproved)
  const rejectedUsers: any[] = [] // optional future implementation

  return (
    <main className="min-h-screen">
      <LcarsHeader title="Administrative Controls" />
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="lcars-tabs mb-8">
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="space-y-8">
              {pendingUsers.length > 0 && (
                <Card className="lcars-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <span>Pending Users</span>
                      <Badge className="ml-2 bg-orange-500 text-black">{pendingUsers.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {pendingUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                          <div>
                            <div className="font-medium">{user.username}</div>
                            <div className="flex items-center text-sm text-gray-400">
                              <Mail className="h-3 w-3 mr-1" />
                              {user.email}
                            </div>
                            <div className="flex items-center text-xs text-gray-500">
                              <Calendar className="h-3 w-3 mr-1" />
                              Registered: {user.createdAt}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-green-500 text-green-500 hover:bg-green-500 hover:text-black"
                              onClick={() => handleApproveUser(user.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-black"
                              onClick={() => handleRejectUser(user.id)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="lcars-panel">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span>Active Users</span>
                    <Badge className="ml-2 bg-green-500 text-black">{activeUsers.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {activeUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{user.username}</span>
                            {user.isAdmin && <Badge className="bg-yellow-500 text-black">Admin</Badge>}
                          </div>
                          <div className="flex items-center text-sm text-gray-400">
                            <Mail className="h-3 w-3 mr-1" />
                            {user.email}
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            Member since: {user.createdAt}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {user.isAdmin ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
                              onClick={() => handleToggleAdmin(user.id, false)}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Remove Admin
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-black"
                              onClick={() => handleToggleAdmin(user.id, true)}
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Make Admin
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {rejectedUsers.length > 0 && (
                <Card className="lcars-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <span>Rejected Users</span>
                      <Badge className="ml-2 bg-red-500 text-black">{rejectedUsers.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {rejectedUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                          <div>
                            <div className="font-medium">{user.username}</div>
                            <div className="flex items-center text-sm text-gray-400">
                              <Mail className="h-3 w-3 mr-1" />
                              {user.email}
                            </div>
                            <div className="flex items-center text-xs text-gray-500">
                              <Calendar className="h-3 w-3 mr-1" />
                              Registered: {user.createdAt}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-500 text-green-500 hover:bg-green-500 hover:text-black"
                            onClick={() => handleApproveUser(user.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
