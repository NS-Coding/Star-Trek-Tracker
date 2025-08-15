"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { LcarsNavigation } from "@/components/lcars-navigation"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"

interface LcarsLayoutProps {
  children: React.ReactNode
}

export function LcarsLayout({ children }: LcarsLayoutProps) {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const sessionResult = useSession()
  const session = sessionResult?.data
  const pathname = usePathname()
  const isLoggedIn = !!session
  const isAdmin = session?.user?.isAdmin ?? false

  useEffect(() => {
    // Close navigation on route change
    setIsNavOpen(false)
  }, [pathname])

  if (pathname === "/login") {
    return <>{children}</>
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <div className="flex items-center justify-between p-4 bg-black border-b border-orange-500">
        <Link href="/" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-orange-500"></div>
          <span className="font-bold text-xl">LCARS: Trek View Command</span>
        </Link>
        <div className="flex items-center space-x-2">
          {isLoggedIn && (
            <Button
              variant="outline"
              size="sm"
              className="border-orange-500 text-orange-500"
              onClick={() => signOut()}
            >
              Logout
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-orange-500"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            {isNavOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      <div className="flex flex-1">
        <LcarsNavigation isOpen={isNavOpen} />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
