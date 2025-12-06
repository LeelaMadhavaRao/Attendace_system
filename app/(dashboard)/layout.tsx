import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { Sidebar } from "@/components/sidebar"
import type { UserRole } from "@/lib/database"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single()

  if (!profile) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={profile.role as UserRole} userName={profile.name} />
      <main className="pl-64">
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  )
}
