"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export function CreateUserForm() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!username || !email || !password) {
      setError("Please fill in all required fields")
      return
    }

    try {
      setLoading(true)
      // This would be replaced with an actual API call
      console.log("Creating user:", { username, email, password, isAdmin })

      // Simulate API response
      setTimeout(() => {
        setSuccess(`User ${username} created successfully`)
        setUsername("")
        setEmail("")
        setPassword("")
        setIsAdmin(false)
        setLoading(false)
      }, 1000)
    } catch (err) {
      setError("Failed to create user. Please try again.")
      setLoading(false)
    }
  }

  return (
    <Card className="lcars-panel">
      <CardHeader>
        <CardTitle>Create New User</CardTitle>
        <CardDescription>Add a new user to the system</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-black border-orange-500"
              placeholder="Enter username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black border-orange-500"
              placeholder="Enter email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black border-orange-500"
              placeholder="Create password"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-admin"
              checked={isAdmin}
              onCheckedChange={(checked) => setIsAdmin(checked as boolean)}
              className="lcars-checkbox"
            />
            <Label htmlFor="is-admin">Admin privileges</Label>
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-900/20 border border-green-500 text-green-500 p-3 rounded-lg text-sm">
              {success}
            </div>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <Button className="lcars-button w-full" onClick={handleSubmit} disabled={loading}>
          {loading ? "Creating..." : "Create User"}
        </Button>
      </CardFooter>
    </Card>
  )
}
