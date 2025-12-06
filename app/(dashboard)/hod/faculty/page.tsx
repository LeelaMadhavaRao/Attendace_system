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

  const { data: profile } = await supabase.from("profiles").select("role, department").eq("id", user.id).single()

  if (profile?.role !== "hod") {
    redirect("/dashboard")
  }

  // Get HOD record
  const { data: hod } = await supabase.from("hods").select("id, department").eq("profile_id", user.id).single()

  if (!hod) {
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get faculty under this HOD
  const { data: faculty } = await adminClient
    .from("faculty")
    .select(
      `
      *,
      profile:profiles(*),
      hod:hods(*, profile:profiles(name))
    `,
    )
    .eq("hod_id", hod.id)
    .order("created_at", { ascending: false })

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
            <UsersTable users={(faculty as never[]) || []} type="faculty" />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
