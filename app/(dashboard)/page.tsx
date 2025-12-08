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

  // Get all profiles for this email
  const { data: profiles } = await supabase.from("profiles").select("id, role").eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    redirect("/login")
  }

  const profileIds = profiles.map(p => p.id)

  // Check for HOD role first (more specific)
  const { data: hodRecord } = await supabase.from("hods").select("id").in("profile_id", profileIds).single()

  if (hodRecord) {
    redirect("/hod")
  }

  // Check for Faculty role
  const { data: facultyRecord } = await supabase.from("faculty").select("id").in("profile_id", profileIds).single()

  if (facultyRecord) {
    redirect("/faculty")
  }

  // Check for Student role
  const { data: studentRecord } = await supabase.from("students").select("id").in("profile_id", profileIds).single()

  if (studentRecord) {
    redirect("/student")
  }

  // Check for Admin role
  const adminProfile = profiles.find(p => p.role === "admin")
  if (adminProfile) {
    redirect("/admin")
  }

  redirect("/login")
}
