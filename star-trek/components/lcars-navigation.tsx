"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, BarChart2, User, LogOut, Download, FileText } from "lucide-react"

interface LcarsNavigationProps {
  isOpen: boolean
}

export function LcarsNavigation({ isOpen }: LcarsNavigationProps) {
  const pathname = usePathname()

  const navItems = [
    {
      name: "Home",
      href: "/",
      icon: <Home className="h-5 w-5" />,
      active: pathname === "/",
    },
    {
      name: "Statistics",
      href: "/statistics",
      icon: <BarChart2 className="h-5 w-5" />,
      active: pathname === "/statistics",
    },
    {
      name: "Profile",
      href: "/profile",
      icon: <User className="h-5 w-5" />,
      active: pathname === "/profile",
    },
    {
      name: "Export Notes",
      href: "/export-notes",
      icon: <Download className="h-5 w-5" />,
      active: pathname.startsWith("/export-notes"),
    },
    {
      name: "Legal Disclosures",
      href: "/legal",
      icon: <FileText className="h-5 w-5" />,
      active: pathname === "/legal",
    },
  ]

  return (
    <nav
      className={cn(
        "bg-black border-r border-orange-500 transition-all duration-300 overflow-hidden",
        isOpen ? "w-64" : "w-0 md:w-16",
      )}
    >
      <div className="flex flex-col h-full p-4">
        <div className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center space-x-2 p-2 rounded-lg transition-colors",
                item.active ? "bg-orange-500 text-black font-bold" : "text-orange-500 hover:bg-orange-500/10",
              )}
            >
              {item.icon}
              <span className={cn("transition-opacity", isOpen ? "opacity-100" : "opacity-0 md:hidden")}>
                {item.name}
              </span>
            </Link>
          ))}
        </div>

        <Link
          href="/login"
          className="flex items-center space-x-2 p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className={cn("transition-opacity", isOpen ? "opacity-100" : "opacity-0 md:hidden")}>Logout</span>
        </Link>
      </div>
    </nav>
  )
}
