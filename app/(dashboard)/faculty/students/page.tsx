import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Users, Phone } from "lucide-react"

export default async function FacultyStudentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[FACULTY/STUDENTS] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[FACULTY/STUDENTS] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find faculty profile specifically
  const facultyProfile = profiles.find(p => p.role === "faculty")

  if (!facultyProfile) {
    console.log("[FACULTY/STUDENTS] Faculty profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  const { data: faculty } = await supabase.from("faculty").select("id").eq("profile_id", facultyProfile.id).single()

  if (!faculty) {
    console.log("[FACULTY/STUDENTS] Faculty record not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get all classes
  const { data: classes } = await adminClient.from("classes").select("id, name").eq("faculty_id", faculty.id)

  const classIds = classes?.map((c) => c.id) || []

  // Get all students
  let allStudents: Array<{
    id: string
    register_number: string
    name: string
    whatsapp_number?: string
    parent_whatsapp_number?: string
    class_id: string
    className: string
    attendance: number
  }> = []

  if (classIds.length > 0) {
    const { data: students } = await adminClient.from("students").select("*").in("class_id", classIds).order("name")

    // Get attendance for each student
    allStudents = await Promise.all(
      (students || []).map(async (student) => {
        const className = classes?.find((c) => c.id === student.class_id)?.name || ""

        // Get sessions for this class WITH total_periods
        const { data: sessions } = await adminClient
          .from("attendance_sessions")
          .select("id, total_periods")
          .eq("class_id", student.class_id)

        const sessionIds = sessions?.map((s) => s.id) || []

        let attendance = 0
        if (sessionIds.length > 0) {
          // Get all attendance records for this student in these sessions
          const { data: attendanceRecords } = await adminClient
            .from("attendance_records")
            .select("session_id, is_present")
            .eq("student_id", student.id)
            .in("session_id", sessionIds)

          // Create a map of session_id to is_present
          const recordMap = new Map(attendanceRecords?.map(r => [r.session_id, r.is_present]) || [])

          // Calculate total periods and present periods
          let totalPeriods = 0
          let presentPeriods = 0

          sessions?.forEach(session => {
            const periods = session.total_periods || 1
            totalPeriods += periods

            const isPresent = recordMap.get(session.id) ?? false
            if (isPresent) {
              presentPeriods += periods
            }
          })

          attendance = totalPeriods > 0 ? Math.round((presentPeriods / totalPeriods) * 100) : 0
        }

        return {
          ...student,
          className,
          attendance,
        }
      }),
    )
  }

  return (
    <>
      <Header title="All Students" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Students</CardTitle>
                <CardDescription>All students across your classes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {allStudents.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No students found</p>
                <p className="text-sm text-muted-foreground mt-1">Add students to your classes to see them here</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reg. No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Parent Contact</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono">{student.register_number}</TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{student.className}</Badge>
                        </TableCell>
                        <TableCell>
                          {student.whatsapp_number ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {student.whatsapp_number}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.parent_whatsapp_number ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {student.parent_whatsapp_number}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={student.attendance} className="h-2 w-16" />
                            <span className="text-sm font-medium">{student.attendance}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.attendance < 75 ? "destructive" : "secondary"}>
                            {student.attendance < 75 ? "Low" : "Good"}
                          </Badge>
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
