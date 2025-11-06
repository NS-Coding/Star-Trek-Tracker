"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { LcarsHeader } from "@/components/lcars-header"
import { LoginForm } from "@/components/login-form"
import { RegisterForm } from "@/components/register-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState("login")
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (data: { username: string; password: string }) => {
    // Pre-check if user exists and is approved to provide clearer feedback
    try {
      const statusRes = await fetch("/api/auth/user-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: data.username }),
      })
      if (statusRes.ok) {
        const status = await statusRes.json()
        if (status.exists === false) {
          const msg = "User not found. Please check your username or register."
          toast({ title: "Access Denied", description: msg, variant: "destructive" })
          throw new Error(msg)
        }
        if (status.exists === true && status.isApproved === false) {
          const msg = "Your account is pending approval by an administrator."
          toast({ title: "Awaiting Approval", description: msg })
          throw new Error(msg)
        }
      }
    } catch (_) {
      // Error already surfaced via toast above; rethrow for inline form message
      throw _
    }

    const result = await signIn("credentials", {
      username: data.username,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      toast({ title: "Invalid Credentials", description: "Incorrect username or password.", variant: "destructive" })
      throw new Error("Invalid username or password")
    }

    toast({ title: "Access Granted", description: `Welcome aboard, ${data.username}!` })
    // Brief pause so the success toast is visible before redirect
    await new Promise((r) => setTimeout(r, 900))
    router.push("/")
  }

  const handleRegister = async (data: { username: string; email: string; password: string; inviteCode: string }) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const body = await res.json()
      const requiresApproval: boolean = !!body?.requiresApproval
      toast({
        title: "Registration Successful",
        description: requiresApproval
          ? "Your account request has been submitted. You can log in once an admin approves your account."
          : "Your account has been created and approved. You can log in now.",
      })
      setActiveTab("login")
      return
    }

    let errorMsg = "Registration failed. Please try again."
    try {
      const body = await res.json()
      if (body?.error) errorMsg = body.error
    } catch {}
    toast({ title: "Registration Error", description: errorMsg, variant: "destructive" })
    throw new Error(errorMsg)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <LcarsHeader title="Access Authorization" />
      <div className="w-full max-w-md p-8">
        <Tabs defaultValue="login" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="lcars-tabs mb-8 w-full">
            <TabsTrigger value="login" className="w-1/2">
              Login
            </TabsTrigger>
            <TabsTrigger value="register" className="w-1/2">
              Register
            </TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm onSubmit={handleLogin} />
          </TabsContent>
          <TabsContent value="register">
            <RegisterForm onSubmit={handleRegister} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
