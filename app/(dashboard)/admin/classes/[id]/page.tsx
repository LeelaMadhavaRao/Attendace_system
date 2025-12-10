import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  School,
  GraduationCap,
  Users,
  Calendar,
  Clock,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClassAttendancePage({ params }: PageProps) {
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

  // Find admin profile specifically
  const adminProfile = profiles.find(p => p.role === "admin")

  if (!adminProfile) {
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  console.log("[ADMIN/CLASS_DETAIL] Loading class with ID:", id)

  // Fetch class details
  const { data: allClasses } = await adminClient
    .from("classes")
    .select("*")

  const classData = (allClasses || []).find(c => c.id === id)

  if (!classData) {
    console.log("[ADMIN/CLASS_DETAIL] Class not found with ID:", id)
    notFound()
  }

  console.log("[ADMIN/CLASS_DETAIL] Class found:", classData.name)

  // Fetch faculty details
  const { data: facultyData } = await adminClient
    .from("faculty")
    .select("id, profile_id")
    .eq("id", classData.faculty_id)
    .single()

  const { data: facultyProfile } = await adminClient
    .from("profiles")
    .select("name, email")
    .eq("id", facultyData?.profile_id || "")
    .single()

  // Fetch attendance sessions for this class
  const { data: sessions, error: sessionsError } = await adminClient
    .from("attendance_sessions")
    .select("id, subject_id, date, start_time, end_time, created_at")
    .eq("class_id", id)
    .order("date", { ascending: false })

  console.log("[ADMIN/CLASS_DETAIL] Sessions fetched:", sessions?.length || 0, "Error:", sessionsError?.message)

  // Fetch subjects
  const subjectIds = (sessions || []).map(s => s.subject_id).filter(Boolean)
  const { data: subjects } = await adminClient
    .from("subjects")
    .select("id, name")
    .in("id", subjectIds.length > 0 ? subjectIds : ["none"])

  const subjectMap = new Map((subjects || []).map(s => [s.id, s]))

  // Fetch student count
  const { count: studentCount } = await adminClient
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("class_id", id)

  // Get attendance stats for each session
  const sessionsWithStats = await Promise.all(
    (sessions || []).map(async (session) => {
      const { count: presentCount } = await adminClient
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id)
        .eq("is_present", true)

      const { count: totalRecords } = await adminClient
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id)

      const subject = subjectMap.get(session.subject_id)

      return {
        ...session,
        subjectName: subject?.name || "Unknown Subject",
        presentCount: presentCount || 0,
        absentCount: (totalRecords || 0) - (presentCount || 0),
        totalRecords: totalRecords || 0,
        attendancePercentage: totalRecords ? Math.round(((presentCount || 0) / totalRecords) * 100) : 0,
      }
    })
  )

  return (
    <>
      <Header title="Class Attendance Details" />
      <div className="p-6 space-y-6">
        {/* Back Button */}
        <Link href="/admin/classes">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Classes
          </Button>
        </Link>

        {/* Class Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <School className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl">{classData.name}</CardTitle>
                <CardDescription>Class Attendance Overview</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <GraduationCap className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Faculty</p>
                  <p className="font-medium truncate">{facultyProfile?.name || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Students</p>
                  <p className="font-medium">{studentCount || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Sessions</p>
                  <p className="font-medium">{sessionsWithStats.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(classData.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Sessions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Attendance Sessions</CardTitle>
                <CardDescription>All attendance sessions for this class</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sessionsWithStats.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No attendance sessions recorded</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Attendance %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionsWithStats.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          {new Date(session.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>{session.subjectName}</TableCell>
                        <TableCell className="text-sm">
                          {session.start_time} - {session.end_time}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {session.presentCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-red-100 text-red-800">
                            {session.absentCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{session.attendancePercentage}%</Badge>
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
