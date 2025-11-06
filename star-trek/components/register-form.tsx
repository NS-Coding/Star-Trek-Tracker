"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Info } from "lucide-react"

interface RegisterFormProps {
  onSubmit: (data: { username: string; email: string; password: string; inviteCode: string }) => Promise<void>
}

export function RegisterForm({ onSubmit }: RegisterFormProps) {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!username || !email || !password || !confirmPassword || !inviteCode) {
      setError("Please fill in all fields")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    try {
      setLoading(true)
      await onSubmit({ username, email, password, inviteCode })
    } catch (err) {
      setError("Registration failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="lcars-panel w-full">
      <CardHeader>
        <CardTitle>Register</CardTitle>
        <CardDescription>Create a new account to access the system</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-black border-orange-500"
              placeholder="Choose a username"
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
              placeholder="Enter your email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-code">Invite Code</Label>
            <Input
              id="invite-code"
              type="password"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="bg-black border-orange-500"
              placeholder="Enter your invite code"
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
              placeholder="Create a password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-black border-orange-500"
              placeholder="Confirm your password"
            />
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center space-x-2 text-blue-500 text-sm">
            <Info className="h-4 w-4" />
            <span>Registration requires admin approval before you can log in.</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="lcars-button w-full" type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Register"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
