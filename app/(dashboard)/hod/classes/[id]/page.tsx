import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Users, BookOpen, TrendingUp, AlertTriangle } from "lucide-react"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function HODClassDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "hod") {
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get class details
  const { data: classData } = await adminClient
    .from("classes")
    .select(
      `
      *,
      faculty:faculty(
        id,
        profile:profiles(name),
        department,
        hod_id
      )
    `,
    )
    .eq("id", id)
    .single()

  if (!classData) {
    notFound()
  }

  // Verify HOD has access to this class
  const { data: hod } = await supabase.from("hods").select("id").eq("profile_id", user.id).single()

  if (classData.faculty?.hod_id !== hod?.id) {
    redirect("/hod/classes")
  }

  // Get students with attendance
  const { data: students } = await adminClient.from("students").select("*").eq("class_id", id).order("name")

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

  // Sort by attendance (lowest first)
  const sortedStudents = studentsWithAttendance.sort((a, b) => a.attendance - b.attendance)

  // Stats
  const totalStudents = students?.length || 0
  const lowAttendanceCount = sortedStudents.filter((s) => s.attendance < 75).length
  const avgAttendance =
    totalStudents > 0 ? Math.round(sortedStudents.reduce((acc, s) => acc + s.attendance, 0) / totalStudents) : 0

  return (
    <>
      <Header title={`Class: ${classData.name}`} />
      <div className="p-6 space-y-6">
        {/* Class Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <h2 className="text-xl font-semibold">{classData.name}</h2>
                <p className="text-muted-foreground">Faculty: {classData.faculty?.profile?.name}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Students</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{sessions?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Sessions</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{avgAttendance}%</p>
                  <p className="text-sm text-muted-foreground">Avg Attendance</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Total Students</p>
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
                  <p className="text-sm text-muted-foreground">Average Attendance</p>
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
                  <p className="text-sm text-muted-foreground">Below 75% Attendance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Student Attendance
            </CardTitle>
            <CardDescription>Sorted by attendance percentage (lowest first)</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedStudents.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No students in this class</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reg. No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Attended/Total</TableHead>
                      <TableHead>Attendance %</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono">{student.register_number}</TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>
                          {student.attended} / {student.total}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={student.attendance} className="h-2 w-20" />
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
