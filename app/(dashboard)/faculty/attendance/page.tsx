import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ClipboardList, Calendar, Clock, BookOpen } from "lucide-react"
import Link from "next/link"

export default async function FacultyAttendancePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "faculty") {
    redirect("/dashboard")
  }

  const { data: faculty } = await supabase.from("faculty").select("id").eq("profile_id", user.id).single()

  if (!faculty) {
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get recent attendance sessions
  const { data: sessions } = await adminClient
    .from("attendance_sessions")
    .select(
      `
      *,
      class:classes(name),
      subject:subjects(name)
    `,
    )
    .eq("faculty_id", faculty.id)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(50)

  // Get counts for each session
  const sessionsWithCounts = await Promise.all(
    (sessions || []).map(async (session) => {
      const { count: total } = await adminClient
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id)

      const { count: present } = await adminClient
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id)
        .eq("is_present", true)

      return {
        ...session,
        totalStudents: total || 0,
        presentCount: present || 0,
        absentCount: (total || 0) - (present || 0),
      }
    }),
  )

  return (
    <>
      <Header title="Attendance Sessions" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Attendance History</CardTitle>
                <CardDescription>View and manage attendance sessions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sessionsWithCounts.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No attendance sessions recorded</p>
                <p className="text-sm text-muted-foreground mt-1">Mark attendance via WhatsApp or the web interface</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Percentage</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionsWithCounts.map((session) => {
                      const percentage =
                        session.totalStudents > 0 ? Math.round((session.presentCount / session.totalStudents) * 100) : 0

                      return (
                        <TableRow key={session.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(session.date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {session.start_time} - {session.end_time}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{session.class?.name}</Badge>
                          </TableCell>
                          <TableCell>
                            {session.subject?.name ? (
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-muted-foreground" />
                                {session.subject.name}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-green-600 dark:text-green-400 font-medium">
                            {session.presentCount}
                          </TableCell>
                          <TableCell className="text-red-600 dark:text-red-400 font-medium">
                            {session.absentCount}
                          </TableCell>
                          <TableCell>
                            <Badge variant={percentage < 75 ? "destructive" : "secondary"}>{percentage}%</Badge>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/faculty/attendance/${session.id}`}
                              className="text-primary hover:underline text-sm font-medium"
                            >
                              View Details
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
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
