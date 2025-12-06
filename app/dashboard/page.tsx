import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user profile to determine role
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (!profile) {
    redirect("/login")
  }

  // Redirect to role-specific dashboard
  switch (profile.role) {
    case "admin":
      redirect("/admin")
    case "hod":
      redirect("/hod")
    case "faculty":
      redirect("/faculty")
    case "student":
      redirect("/student")
    default:
      redirect("/login")
  }
}
