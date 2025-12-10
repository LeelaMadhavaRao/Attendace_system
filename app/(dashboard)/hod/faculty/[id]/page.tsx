import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function HODFacultyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  // Find HOD profile specifically
  const hodProfile = profiles.find(p => p.role === "hod")

  if (!hodProfile) {
    redirect("/dashboard")
  }

  // Get HOD record
  const { data: hod } = await supabase
    .from("hods")
    .select("id, department")
    .eq("profile_id", hodProfile.id)
    .single()

  if (!hod) {
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get faculty details
  const { data: faculty } = await adminClient
    .from("faculty")
    .select("*")
    .eq("id", id)
    .single()

  // Get profile details separately
  let facultyProfile = null
  if (faculty?.profile_id) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", faculty.profile_id)
      .single()
    facultyProfile = profile
  }

  // Attach profile to faculty for template compatibility
  const facultyWithProfile = {
    ...faculty,
    profile: facultyProfile ? [facultyProfile] : []
  }

  if (!faculty) {
    console.log("[HOD/FACULTY/DETAIL] Faculty not found with ID:", id)
    redirect("/hod/faculty")
  }

  console.log("[HOD/FACULTY/DETAIL] Faculty found:", faculty.id, "hod_id:", faculty.hod_id)
  console.log("[HOD/FACULTY/DETAIL] Current HOD ID:", hod.id)

  // Verify faculty belongs to this HOD
  if (faculty.hod_id !== hod.id) {
    console.log("[HOD/FACULTY/DETAIL] Faculty hod_id mismatch. Faculty hod_id:", faculty.hod_id, "Expected hod id:", hod.id)
    redirect("/hod/faculty")
  }

  // Get classes created by this faculty
  const { data: classes } = await adminClient
    .from("classes")
    .select("*")
    .eq("faculty_id", faculty.id)
    .order("created_at", { ascending: false })

  // Get attendance data for each class
  let classesWithAttendance = []
  if (classes && classes.length > 0) {
    classesWithAttendance = await Promise.all(
      classes.map(async (cls) => {
        const { data: sessions } = await adminClient
          .from("attendance_sessions")
          .select("id")
          .eq("class_id", cls.id)

        const sessionIds = sessions?.map((s) => s.id) || []

        let totalRecords = 0
        let presentCount = 0

        if (sessionIds.length > 0) {
          const { count: total } = await adminClient
            .from("attendance_records")
            .select("*", { count: "exact", head: true })
            .in("session_id", sessionIds)

          const { count: present } = await adminClient
            .from("attendance_records")
            .select("*", { count: "exact", head: true })
            .in("session_id", sessionIds)
            .eq("is_present", true)

          totalRecords = total || 0
          presentCount = present || 0
        }

        const { count: studentCount } = await adminClient
          .from("students")
          .select("*", { count: "exact", head: true })
          .eq("class_id", cls.id)

        const attendance = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0

        return {
          ...cls,
          studentCount: studentCount || 0,
          sessionCount: sessions?.length || 0,
          attendance,
        }
      }),
    )
  }

  return (
    <>
      <Header title={`Faculty: ${facultyWithProfile.profile?.[0]?.name || "Unknown"}`} />
      <div className="p-6 space-y-6">
        {/* Back Link */}
        <Link href="/hod/faculty" className="flex items-center gap-2 text-primary hover:underline w-fit">
          <ArrowLeft className="h-4 w-4" />
          Back to Faculty
        </Link>

        {/* Faculty Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{facultyWithProfile.profile?.[0]?.name || "Unknown"}</CardTitle>
                <CardDescription className="mt-2 space-y-1">
                  <p>Email: {facultyWithProfile.profile?.[0]?.email || "N/A"}</p>
                  <p>Department: <Badge variant="secondary">{facultyWithProfile.department}</Badge></p>
                  {facultyWithProfile.whatsapp_number && <p>WhatsApp: {facultyWithProfile.whatsapp_number}</p>}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold">{classesWithAttendance.length}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-bold">
                  {classesWithAttendance.reduce((sum, c) => sum + c.sessionCount, 0)}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Average Attendance</p>
                <p className="text-2xl font-bold">
                  {classesWithAttendance.length > 0
                    ? Math.round(
                        classesWithAttendance.reduce((sum, c) => sum + c.attendance, 0) /
                          classesWithAttendance.length,
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Classes Card */}
        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
            <CardDescription>Classes created by {facultyWithProfile.profile?.[0]?.name || "Unknown"}</CardDescription>
          </CardHeader>
          <CardContent>
            {classesWithAttendance.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No classes created yet</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classesWithAttendance.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{cls.department || "-"}</Badge>
                        </TableCell>
                        <TableCell>{cls.studentCount}</TableCell>
                        <TableCell>{cls.sessionCount}</TableCell>
                        <TableCell>
                          <Badge
                            variant={cls.attendance < 75 ? "destructive" : "secondary"}
                          >
                            {cls.attendance}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(cls.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
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
