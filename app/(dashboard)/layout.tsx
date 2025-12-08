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

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    redirect("/login")
  }

  console.log("[LAYOUT] User profiles found:", profiles.map(p => ({ id: p.id, email: p.email, role: p.role })))

  const profileIds = profiles.map(p => p.id)
  console.log("[LAYOUT] Profile IDs:", profileIds)

  // Detect which roles are available for this user
  const { data: hodCheck } = await supabase
    .from("hods")
    .select("id")
    .in("profile_id", profileIds)
    .single()

  const { data: facultyCheck } = await supabase
    .from("faculty")
    .select("id")
    .in("profile_id", profileIds)
    .single()

  const { data: studentCheck } = await supabase
    .from("students")
    .select("id")
    .in("profile_id", profileIds)
    .single()

  const adminProfile = profiles.find(p => p.role === "admin")

  // Priority-based selection: HOD > Faculty > Student > Admin
  let selectedProfile = profiles[0]
  let selectedRole: UserRole = "student"

  console.log("[LAYOUT] Role checks - HOD:", !!hodCheck, "Faculty:", !!facultyCheck, "Student:", !!studentCheck, "Admin:", !!adminProfile)

  if (hodCheck) {
    const hodProfile = profiles.find(p => p.role === "hod")
    if (hodProfile) {
      selectedProfile = hodProfile
      selectedRole = "hod"
      console.log("[LAYOUT] Selected role: HOD", { profileId: hodProfile.id })
    }
  } else if (facultyCheck) {
    const facultyProfile = profiles.find(p => p.role === "faculty")
    if (facultyProfile) {
      selectedProfile = facultyProfile
      selectedRole = "faculty"
      console.log("[LAYOUT] Selected role: FACULTY", { profileId: facultyProfile.id })
    }
  } else if (studentCheck) {
    const studentProfile = profiles.find(p => p.role === "student")
    if (studentProfile) {
      selectedProfile = studentProfile
      selectedRole = "student"
      console.log("[LAYOUT] Selected role: STUDENT", { profileId: studentProfile.id })
    }
  } else if (adminProfile) {
    selectedProfile = adminProfile
    selectedRole = "admin"
    console.log("[LAYOUT] Selected role: ADMIN", { profileId: adminProfile.id })
  }

  // Get role-specific name if available
  let displayName = selectedProfile.name

  // Check if user is HOD and get HOD-specific name
  if (selectedRole === "hod") {
    const { data: hod } = await supabase
      .from("hods")
      .select("name, display_name")
      .eq("profile_id", selectedProfile.id)
      .single()
    if (hod && (hod.name || hod.display_name)) {
      displayName = hod.display_name || hod.name || selectedProfile.name
      console.log("[LAYOUT] HOD display name:", displayName)
    }
  }

  // Check if user is faculty and get faculty-specific name
  if (selectedRole === "faculty") {
    const { data: faculty } = await supabase
      .from("faculty")
      .select("name, display_name")
      .eq("profile_id", selectedProfile.id)
      .single()
    if (faculty && (faculty.name || faculty.display_name)) {
      displayName = faculty.display_name || faculty.name || selectedProfile.name
      console.log("[LAYOUT] Faculty display name:", displayName)
    }
  }

  console.log("[LAYOUT] Rendering Sidebar with role:", selectedRole, "displayName:", displayName)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={selectedRole} userName={displayName} />
      <main className="pl-64">
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  )
}
