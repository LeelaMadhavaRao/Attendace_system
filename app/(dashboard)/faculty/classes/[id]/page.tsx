import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Users, BookOpen, TrendingUp, AlertTriangle, Phone } from "lucide-react"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function FacultyClassDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[FACULTY/CLASSES/[ID]] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[FACULTY/CLASSES/[ID]] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find faculty profile specifically
  const facultyProfile = profiles.find(p => p.role === "faculty")

  if (!facultyProfile) {
    console.log("[FACULTY/CLASSES/[ID]] Faculty profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  const { data: faculty } = await supabase.from("faculty").select("id").eq("profile_id", facultyProfile.id).single()

  if (!faculty) {
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get class details
  const { data: classData } = await adminClient.from("classes").select("*").eq("id", id).single()

  if (!classData || classData.faculty_id !== faculty.id) {
    notFound()
  }

  // Get students
  const { data: students } = await adminClient.from("students").select("*").eq("class_id", id).order("register_number")

  // Get all sessions for this class
  const { data: sessions } = await adminClient.from("attendance_sessions").select("id").eq("class_id", id)

  const sessionIds = sessions?.map((s) => s.id) || []

  // Calculate attendance for each student
  const studentsWithAttendance = await Promise.all(
    (students || []).map(async (student) => {
      if (sessionIds.length === 0) {
        return { ...student, attendance: 0, attended: 0, total: 0 }
      }

      const { count: total } = await adminClient
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.id)
        .in("session_id", sessionIds)

      const { count: attended } = await adminClient
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("student_id", student.id)
        .in("session_id", sessionIds)
        .eq("is_present", true)

      const attendance = total && total > 0 ? Math.round(((attended || 0) / total) * 100) : 0

      return {
        ...student,
        attendance,
        attended: attended || 0,
        total: total || 0,
      }
    }),
  )

  // Stats
  const totalStudents = students?.length || 0
  const lowAttendanceCount = studentsWithAttendance.filter((s) => s.attendance < 75).length
  const avgAttendance =
    totalStudents > 0 ? Math.round(studentsWithAttendance.reduce((acc, s) => acc + s.attendance, 0) / totalStudents) : 0

  return (
    <>
      <Header title={`Class: ${classData.name}`} />
      <div className="p-6 space-y-6">
        {/* Class Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{classData.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {classData.department && <Badge variant="secondary">{classData.department}</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sessions?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgAttendance}%</p>
                  <p className="text-sm text-muted-foreground">Avg Attendance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{lowAttendanceCount}</p>
                  <p className="text-sm text-muted-foreground">Below 75%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Students
            </CardTitle>
            <CardDescription>{totalStudents} students enrolled</CardDescription>
          </CardHeader>
          <CardContent>
            {studentsWithAttendance.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No students in this class</p>
                <p className="text-sm text-muted-foreground mt-1">Add students manually or upload an Excel file</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reg. No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Parent Contact</TableHead>
                      <TableHead>Attended/Total</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsWithAttendance.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono">{student.register_number}</TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
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
                          {student.attended} / {student.total}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={student.attendance} className="h-2 w-16" />
                            <span className="text-sm font-medium w-12">{student.attendance}%</span>
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
