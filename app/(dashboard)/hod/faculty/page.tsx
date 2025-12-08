import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateFacultyDialog } from "@/components/create-faculty-dialog"
import { UsersTable } from "@/components/users-table"
import { GraduationCap } from "lucide-react"

export default async function HODFacultyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[HOD/FACULTY] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[HOD/FACULTY] No profiles found, redirecting to login")
    redirect("/login")
  }

  console.log("[HOD/FACULTY] Profiles:", profiles.map(p => ({ id: p.id, role: p.role })))

  // Find HOD profile specifically
  const hodProfile = profiles.find(p => p.role === "hod")

  if (!hodProfile) {
    console.log("[HOD/FACULTY] HOD profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  console.log("[HOD/FACULTY] Using HOD profile:", hodProfile.id)

  // Get HOD record
  const { data: hod } = await supabase
    .from("hods")
    .select("id, department")
    .eq("profile_id", hodProfile.id)
    .single()

  if (!hod) {
    console.log("[HOD/FACULTY] HOD record not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  console.log("[HOD/FACULTY] HOD record found:", hod.id)

  const adminClient = createAdminClient()

  // Get faculty under this HOD
  const { data: faculty, error: facultyError } = await adminClient
    .from("faculty")
    .select("*")
    .eq("hod_id", hod.id)
    .order("created_at", { ascending: false })

  console.log("[HOD/FACULTY] Faculty query error:", facultyError)
  console.log("[HOD/FACULTY] Faculty records found:", faculty?.length || 0)

  // Fetch profiles for these faculty members
  let facultyWithProfiles = []
  if (faculty && faculty.length > 0) {
    const profileIds = faculty.map((f: any) => f.profile_id)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", profileIds)

    console.log("[HOD/FACULTY] Profiles fetched:", profiles?.length || 0)

    // Combine faculty and profile data
    facultyWithProfiles = faculty.map((f: any) => ({
      ...f,
      profile: profiles?.find((p: any) => p.id === f.profile_id),
    }))
  }

  console.log("[HOD/FACULTY] Final faculty list with profiles:", facultyWithProfiles.length)

  return (
    <>
      <Header title="My Faculty" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Faculty Members</CardTitle>
                <CardDescription>Faculty in {hod.department}</CardDescription>
              </div>
            </div>
            <CreateFacultyDialog isHOD={true} />
          </CardHeader>
          <CardContent>
            <UsersTable users={(facultyWithProfiles as never[]) || []} type="faculty" />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
