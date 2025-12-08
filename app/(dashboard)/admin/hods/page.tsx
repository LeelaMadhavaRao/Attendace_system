import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateHODDialog } from "@/components/create-hod-dialog"
import { UsersTable } from "@/components/users-table"
import { getHODs } from "@/lib/admin"
import { UserCheck } from "lucide-react"

export default async function AdminHODsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[ADMIN/HODS] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[ADMIN/HODS] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find admin profile specifically
  const adminProfile = profiles.find(p => p.role === "admin")

  if (!adminProfile) {
    console.log("[ADMIN/HODS] Admin profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  const { data: hods, error } = await getHODs()

  return (
    <>
      <Header title="HOD Management" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Heads of Department</CardTitle>
                <CardDescription>Manage department heads in the system</CardDescription>
              </div>
            </div>
            <CreateHODDialog />
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-destructive">Error loading HODs: {error}</p>
            ) : (
              <UsersTable users={(hods as never[]) || []} type="hod" />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
