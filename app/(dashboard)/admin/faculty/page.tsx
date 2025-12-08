import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateFacultyDialog } from "@/components/create-faculty-dialog"
import { UsersTable } from "@/components/users-table"
import { getFaculty } from "@/lib/admin"
import { GraduationCap } from "lucide-react"

export default async function AdminFacultyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[ADMIN/FACULTY] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[ADMIN/FACULTY] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find admin profile specifically
  const adminProfile = profiles.find(p => p.role === "admin")

  if (!adminProfile) {
    console.log("[ADMIN/FACULTY] Admin profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  const { data: faculty, error } = await getFaculty()

  return (
    <>
      <Header title="Faculty Management" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Faculty Members</CardTitle>
                <CardDescription>Manage faculty members in the system</CardDescription>
              </div>
            </div>
            <CreateFacultyDialog />
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-destructive">Error loading faculty: {error}</p>
            ) : (
              <UsersTable users={(faculty as never[]) || []} type="faculty" />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
