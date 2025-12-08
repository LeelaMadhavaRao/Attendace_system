import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateClassDialog } from "@/components/create-class-dialog"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Users, ClipboardList, Calendar } from "lucide-react"
import Link from "next/link"

export default async function FacultyClassesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[FACULTY/CLASSES] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[FACULTY/CLASSES] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find faculty profile specifically
  const facultyProfile = profiles.find(p => p.role === "faculty")

  if (!facultyProfile) {
    console.log("[FACULTY/CLASSES] Faculty profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  // Get faculty record
  const { data: faculty } = await supabase.from("faculty").select("id").eq("profile_id", facultyProfile.id).single()

  if (!faculty) {
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get classes
  const { data: classes } = await adminClient
    .from("classes")
    .select("*")
    .eq("faculty_id", faculty.id)
    .order("created_at", { ascending: false })

  // Get counts for each class
  const classesWithCounts = await Promise.all(
    (classes || []).map(async (cls) => {
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

  return (
    <>
      <Header title="My Classes" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Classes</CardTitle>
                <CardDescription>Manage your classes and students</CardDescription>
              </div>
            </div>
            <CreateClassDialog />
          </CardHeader>
          <CardContent>
            {classesWithCounts.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No classes yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a class to start managing attendance, or use WhatsApp
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {classesWithCounts.map((cls) => (
                  <Link
                    key={cls.id}
                    href={`/faculty/classes/${cls.id}`}
                    className="block rounded-lg border p-4 transition-all hover:shadow-md hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold">{cls.name}</h3>
                      {cls.semester && <Badge variant="secondary">Sem {cls.semester}</Badge>}
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{cls.studentCount} students</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        <span>{cls.sessionCount} sessions</span>
                      </div>
                      {cls.academic_year && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{cls.academic_year}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
