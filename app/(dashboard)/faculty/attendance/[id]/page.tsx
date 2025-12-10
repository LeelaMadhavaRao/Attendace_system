import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Clock, BookOpen, Users, CheckCircle, XCircle } from "lucide-react"

export default async function AttendanceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[FACULTY/ATTENDANCE/DETAILS] User:", user.email, "SessionID:", id)

  // Find faculty profile
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    redirect("/login")
  }

  const facultyProfile = profiles.find(p => p.role === "faculty")

  if (!facultyProfile) {
    redirect("/dashboard")
  }

  const { data: faculty } = await supabase.from("faculty").select("id").eq("profile_id", facultyProfile.id).single()

  if (!faculty) {
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get the attendance session
  const { data: session, error: sessionError } = await adminClient
    .from("attendance_sessions")
    .select(
      `
      *,
      class:classes(id, name),
      subject:subjects(id, name)
    `,
    )
    .eq("id", id)
    .eq("faculty_id", faculty.id)
    .single()

  console.log("[FACULTY/ATTENDANCE/DETAILS] Session query result:", {
    sessionId: id,
    facultyId: faculty.id,
    found: !!session,
    error: sessionError,
    session: session ? { id: session.id, date: session.date, class: session.class } : null,
  })

  if (!session) {
    console.log("[FACULTY/ATTENDANCE/DETAILS] Session not found or unauthorized")
    redirect("/faculty/attendance")
  }

  // Get all attendance records for this session with detailed logging
  console.log("[FACULTY/ATTENDANCE/DETAILS] Fetching attendance records for session:", session.id)
  
  const { data: records, error: recordsError } = await adminClient
    .from("attendance_records")
    .select(
      `
      id,
      session_id,
      student_id,
      is_present,
      marked_at,
      students (
        id,
        name,
        register_number,
        whatsapp_number
      )
    `,
    )
    .eq("session_id", session.id)

  console.log("[FACULTY/ATTENDANCE/DETAILS] Records query result:", {
    sessionId: session.id,
    recordCount: records?.length || 0,
    error: recordsError,
    firstRecord: records?.[0] || null,
  })

  // Calculate statistics
  const totalStudents = records?.length || 0
  const presentCount = records?.filter(r => r.is_present).length || 0
  const absentCount = totalStudents - presentCount
  const percentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0

  console.log("[FACULTY/ATTENDANCE/DETAILS] Session found:", {
    sessionId: session.id,
    date: session.date,
    class: session.class?.name,
    totalRecords: totalStudents,
    present: presentCount,
  })

  return (
    <>
      <Header title="Attendance Details" />
      <div className="p-6 space-y-6">
        {/* Session Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{session.class?.name}</CardTitle>
                  <CardDescription>{session.subject?.name || "No Subject"}</CardDescription>
                </div>
              </div>
              <Link href="/faculty/attendance">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Calendar className="h-4 w-4" />
                  Date
                </div>
                <p className="font-medium">
                  {new Date(session.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Clock className="h-4 w-4" />
                  Time
                </div>
                <p className="font-medium">
                  {session.start_time} - {session.end_time}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="h-4 w-4" />
                  Total Students
                </div>
                <p className="font-medium text-lg">{totalStudents}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  Attendance Rate
                </div>
                <p className="font-medium text-lg">
                  <Badge variant={percentage < 75 ? "destructive" : "secondary"}>{percentage}%</Badge>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Present</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{presentCount}</div>
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{absentCount}</div>
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {totalStudents > 0 ? Math.round((absentCount / totalStudents) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Attendance Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{percentage}%</div>
                <div className="text-sm font-medium px-2 py-1 rounded bg-primary/10 text-primary">
                  {percentage >= 75 ? "Good" : "Low"}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Overall class attendance</p>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Student Records</CardTitle>
            <CardDescription>Detailed attendance record for each student</CardDescription>
          </CardHeader>
          <CardContent>
            {!records || records.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No attendance records found</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll No.</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Marked At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record: any) => (
                      <TableRow key={record.id} className={record.is_present ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}>
                        <TableCell className="font-medium">{record.students?.register_number || "-"}</TableCell>
                        <TableCell>{record.students?.name || "Unknown"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{record.students?.whatsapp_number || "-"}</TableCell>
                        <TableCell className="text-center">
                          {record.is_present ? (
                            <div className="flex items-center justify-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <Badge className="bg-green-600 hover:bg-green-700">Present</Badge>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <XCircle className="h-4 w-4 text-red-600" />
                              <Badge className="bg-red-600 hover:bg-red-700">Absent</Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {record.marked_at
                            ? new Date(record.marked_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Not marked"}
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
