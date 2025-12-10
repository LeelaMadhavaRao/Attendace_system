import type React from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/server"
import { Sidebar } from "@/components/sidebar"
import type { UserRole } from "@/lib/database"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  
  // Get the current pathname to determine intended role
  const headersList = await headers()
  const pathname = headersList.get("x-pathname") || ""
  
  // Students use localStorage auth, not Supabase auth - skip auth check for /student route
  if (pathname === "/student") {
    return children
  }
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }
  
  // Extract intended role from URL path
  let intendedRole: UserRole | null = null
  if (pathname.includes("/admin")) {
    intendedRole = "admin"
  } else if (pathname.includes("/hod")) {
    intendedRole = "hod"
  } else if (pathname.includes("/faculty")) {
    intendedRole = "faculty"
  } else if (pathname.includes("/student")) {
    intendedRole = "student"
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
  console.log("[LAYOUT] Intended role from URL:", intendedRole)

  const profileIds = profiles.map(p => p.id)
  console.log("[LAYOUT] Profile IDs:", profileIds)

  // Check which roles are available for this user
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

  // If user intended to access a specific role, use that if available
  let selectedProfile = profiles[0]
  let selectedRole: UserRole = "student"

  console.log("[LAYOUT] Role checks - HOD:", !!hodCheck, "Faculty:", !!facultyCheck, "Student:", !!studentCheck, "Admin:", !!adminProfile)

  if (intendedRole) {
    // Try to use the intended role if user has access to it
    if (intendedRole === "admin" && adminProfile) {
      selectedProfile = adminProfile
      selectedRole = "admin"
      console.log("[LAYOUT] Selected role: ADMIN (from URL)")
    } else if (intendedRole === "hod" && hodCheck) {
      const hodProfile = profiles.find(p => p.role === "hod")
      if (hodProfile) {
        selectedProfile = hodProfile
        selectedRole = "hod"
        console.log("[LAYOUT] Selected role: HOD (from URL)")
      }
    } else if (intendedRole === "faculty" && facultyCheck) {
      const facultyProfile = profiles.find(p => p.role === "faculty")
      if (facultyProfile) {
        selectedProfile = facultyProfile
        selectedRole = "faculty"
        console.log("[LAYOUT] Selected role: FACULTY (from URL)")
      }
    } else if (intendedRole === "student" && studentCheck) {
      const studentProfile = profiles.find(p => p.role === "student")
      if (studentProfile) {
        selectedProfile = studentProfile
        selectedRole = "student"
        console.log("[LAYOUT] Selected role: STUDENT (from URL)")
      }
    } else {
      // User doesn't have access to intended role, fall back to priority
      console.log("[LAYOUT] User doesn't have access to intended role, using priority fallback")
      // Use default priority if intended role is not available
      if (hodCheck) {
        const hodProfile = profiles.find(p => p.role === "hod")
        if (hodProfile) {
          selectedProfile = hodProfile
          selectedRole = "hod"
        }
      } else if (facultyCheck) {
        const facultyProfile = profiles.find(p => p.role === "faculty")
        if (facultyProfile) {
          selectedProfile = facultyProfile
          selectedRole = "faculty"
        }
      } else if (studentCheck) {
        const studentProfile = profiles.find(p => p.role === "student")
        if (studentProfile) {
          selectedProfile = studentProfile
          selectedRole = "student"
        }
      } else if (adminProfile) {
        selectedProfile = adminProfile
        selectedRole = "admin"
      }
    }
  } else {
    // If no URL-based role detected, use priority: HOD > Faculty > Student > Admin
    if (hodCheck) {
      const hodProfile = profiles.find(p => p.role === "hod")
      if (hodProfile) {
        selectedProfile = hodProfile
        selectedRole = "hod"
        console.log("[LAYOUT] Selected role: HOD (default priority)")
      }
    } else if (facultyCheck) {
      const facultyProfile = profiles.find(p => p.role === "faculty")
      if (facultyProfile) {
        selectedProfile = facultyProfile
        selectedRole = "faculty"
        console.log("[LAYOUT] Selected role: FACULTY (default priority)")
      }
    } else if (studentCheck) {
      const studentProfile = profiles.find(p => p.role === "student")
      if (studentProfile) {
        selectedProfile = studentProfile
        selectedRole = "student"
        console.log("[LAYOUT] Selected role: STUDENT (default priority)")
      }
    } else if (adminProfile) {
      selectedProfile = adminProfile
      selectedRole = "admin"
      console.log("[LAYOUT] Selected role: ADMIN (default priority)")
    }
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
