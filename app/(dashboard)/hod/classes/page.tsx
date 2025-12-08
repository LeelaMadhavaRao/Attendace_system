import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { School, Users, BookOpen } from "lucide-react"
import Link from "next/link"

export default async function HODClassesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[HOD/CLASSES] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[HOD/CLASSES] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find HOD profile specifically
  const hodProfile = profiles.find(p => p.role === "hod")

  if (!hodProfile) {
    console.log("[HOD/CLASSES] HOD profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  console.log("[HOD/CLASSES] Using HOD profile:", hodProfile.id)

  // Get HOD record
  const { data: hod } = await supabase
    .from("hods")
    .select("id, department")
    .eq("profile_id", hodProfile.id)
    .single()

  if (!hod) {
    console.log("[HOD/CLASSES] HOD record not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get faculty IDs under this HOD
  const { data: facultyList } = await adminClient.from("faculty").select("id").eq("hod_id", hod.id)

  const facultyIds = facultyList?.map((f) => f.id) || []

  // Fetch classes by faculty under this HOD
  let classes: Array<{
    id: string
    name: string
    semester?: string
    created_at: string
    faculty?: {
      profile?: { name: string }
      department?: string
    }
    studentCount: number
    sessionCount: number
  }> = []

  if (facultyIds.length > 0) {
    const { data: classesData } = await adminClient
      .from("classes")
      .select(
        `
        *,
        faculty:faculty(
          profile:profiles(name),
          department
        )
      `,
      )
      .in("faculty_id", facultyIds)
      .order("created_at", { ascending: false })

    // Get student and session counts
    classes = await Promise.all(
      (classesData || []).map(async (cls) => {
        const { count: studentCount } = await adminClient
          .from("students")
          .select("*", { count: "exact", head: true })
          .eq("class_id", cls.id)

        const { count: sessionCount } = await adminClient
          .from("attendance_sessions")
          .select("*", { count: "exact", head: true })
          .eq("class_id", cls.id)

        return {
          ...cls,
          studentCount: studentCount || 0,
          sessionCount: sessionCount || 0,
        }
      }),
    )
  }

  return (
    <>
      <Header title="Department Classes" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <School className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Classes in {hod.department}</CardTitle>
                <CardDescription>Classes created by faculty in your department</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No classes created yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Faculty can create classes via WhatsApp or the web interface
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class Name</TableHead>
                      <TableHead>Faculty</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.name}</TableCell>
                        <TableCell>{cls.faculty?.profile?.name || "-"}</TableCell>
                        <TableCell>
                          {cls.semester ? (
                            <Badge variant="secondary">{cls.semester}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {cls.studentCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            {cls.sessionCount}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(cls.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/hod/classes/${cls.id}`}
                            className="text-primary hover:underline text-sm font-medium"
                          >
                            View Details
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
