"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { LcarsHeader } from "@/components/lcars-header"
import { LoginForm } from "@/components/login-form"
import { RegisterForm } from "@/components/register-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState("login")
  const router = useRouter()

  const handleLogin = async (data: { username: string; password: string }) => {
    const result = await signIn("credentials", {
      username: data.username,
      password: data.password,
      redirect: false,
    })
    if (!result?.error) router.push("/")
  }

  const handleRegister = async (data: { username: string; email: string; password: string }) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      setActiveTab("login")
    }
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
