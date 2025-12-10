"use client"

import type React from "react"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/client"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WhatsAppIcon } from "@/components/whatsapp-icon"
import type { UserRole } from "@/lib/database"
import { toast } from "sonner"
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Settings,
  LogOut,
  UserCheck,
  School,
  BarChart3,
  MessageSquare,
} from "lucide-react"

interface SidebarProps {
  role: UserRole
  userName: string
}

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
}

const navItemsByRole: Record<UserRole, NavItem[]> = {
  admin: [
    { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { title: "HODs", href: "/admin/hods", icon: UserCheck },
    { title: "Faculty", href: "/admin/faculty", icon: GraduationCap },
    { title: "All Classes", href: "/admin/classes", icon: School },
    { title: "Attendance Reports", href: "/admin/reports", icon: BarChart3 },
  ],
  hod: [
    { title: "Dashboard", href: "/hod", icon: LayoutDashboard },
    { title: "Faculty", href: "/hod/faculty", icon: GraduationCap },
    { title: "Classes", href: "/hod/classes", icon: School },
    { title: "Reports", href: "/hod/reports", icon: BarChart3 },
  ],
  faculty: [
    { title: "Dashboard", href: "/faculty", icon: LayoutDashboard },
    { title: "My Classes", href: "/faculty/classes", icon: BookOpen },
    { title: "Students", href: "/faculty/students", icon: Users },
    { title: "Attendance", href: "/faculty/attendance", icon: ClipboardList },
    { title: "WhatsApp Commands", href: "/faculty/commands", icon: MessageSquare },
  ],
  student: [
    { title: "Dashboard", href: "/student", icon: LayoutDashboard },
    { title: "My Attendance", href: "/student/attendance", icon: ClipboardList },
  ],
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = navItemsByRole[role] || []

  console.log("[SIDEBAR] Rendering with role:", role, "userName:", userName, "pathname:", pathname)
  console.log("[SIDEBAR] Nav items for role:", navItems.map(item => ({ title: item.title, href: item.href })))

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Logged out successfully")
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <WhatsAppIcon className="h-6 w-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold">Attendance</h1>
            <p className="text-xs text-sidebar-foreground/60">WhatsApp System</p>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== `/${role}` && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => console.log("[SIDEBAR] Navigating to:", item.href, "from:", pathname)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.title}
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* User section */}
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="text-xs capitalize text-sidebar-foreground/60">{role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </aside>
  )
}
