"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, UserCheck, UserX } from "lucide-react"

interface User {
  id: string
  username: string
  email: string
  isAdmin: boolean
  status: "active" | "pending" | "rejected"
  createdAt: string
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data fetch - would be replaced with actual API call
    setTimeout(() => {
      setUsers([
        {
          id: "1",
          username: "picard",
          email: "picard@starfleet.org",
          isAdmin: true,
          status: "active",
          createdAt: "2023-01-15",
        },
        {
          id: "2",
          username: "riker",
          email: "riker@starfleet.org",
          isAdmin: false,
          status: "active",
          createdAt: "2023-02-10",
        },
        {
          id: "3",
          username: "data",
          email: "data@starfleet.org",
          isAdmin: false,
          status: "active",
          createdAt: "2023-03-05",
        },
        {
          id: "4",
          username: "worf",
          email: "worf@starfleet.org",
          isAdmin: false,
          status: "pending",
          createdAt: "2023-05-20",
        },
        {
          id: "5",
          username: "crusher",
          email: "crusher@starfleet.org",
          isAdmin: false,
          status: "pending",
          createdAt: "2023-05-22",
        },
      ])
      setLoading(false)
    }, 1000)
  }, [])

  const handleApproveUser = (userId: string) => {
    // This would be replaced with an actual API call
    console.log(`Approving user ${userId}`)

    // Update local state to simulate API response
    setUsers(users.map((user) => (user.id === userId ? { ...user, status: "active" } : user)))
  }

  const handleRejectUser = (userId: string) => {
    // This would be replaced with an actual API call
    console.log(`Rejecting user ${userId}`)

    // Update local state to simulate API response
    setUsers(users.map((user) => (user.id === userId ? { ...user, status: "rejected" } : user)))
  }

  const handleToggleAdmin = (userId: string, makeAdmin: boolean) => {
    // This would be replaced with an actual API call
    console.log(`${makeAdmin ? "Making" : "Removing"} user ${userId} ${makeAdmin ? "an" : "from"} admin`)

    // Update local state to simulate API response
    setUsers(users.map((user) => (user.id === userId ? { ...user, isAdmin: makeAdmin } : user)))
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading users...</div>
  }

  const pendingUsers = users.filter((user) => user.status === "pending")
  const activeUsers = users.filter((user) => user.status === "active")
  const rejectedUsers = users.filter((user) => user.status === "rejected")

  return (
    <div className="space-y-8">
      {pendingUsers.length > 0 && (
        <Card className="lcars-panel">
          <CardHeader>
            <CardTitle>Pending Approval ({pendingUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                  <div>
                    <div className="font-medium">{user.username}</div>
                    <div className="text-sm text-gray-400">{user.email}</div>
                    <div className="text-xs text-gray-500">Registered: {user.createdAt}</div>
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
          <CardTitle>Active Users ({activeUsers.length})</CardTitle>
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
                  <div className="text-sm text-gray-400">{user.email}</div>
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
            <CardTitle>Rejected Users ({rejectedUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rejectedUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg">
                  <div>
                    <div className="font-medium">{user.username}</div>
                    <div className="text-sm text-gray-400">{user.email}</div>
                    <div className="text-xs text-gray-500">Registered: {user.createdAt}</div>
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
  )
}
