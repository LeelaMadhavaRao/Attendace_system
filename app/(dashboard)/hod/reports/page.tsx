import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BarChart3, TrendingUp, TrendingDown, Users, School, GraduationCap } from "lucide-react"

export default async function HODReportsPage() {
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

  // Get HOD record
  const { data: hod } = await supabase.from("hods").select("id, department").eq("profile_id", user.id).single()

  if (!hod) {
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get faculty under this HOD
  const { data: facultyList } = await adminClient
    .from("faculty")
    .select(
      `
      id,
      profile:profiles(name)
    `,
    )
    .eq("hod_id", hod.id)

  const facultyIds = facultyList?.map((f) => f.id) || []

  // Get classes and calculate attendance
  let classReports: Array<{
    id: string
    name: string
    faculty?: { profile?: { name: string } }
    sessionCount: number
    studentCount: number
    attendance: number
  }> = []

  if (facultyIds.length > 0) {
    const { data: classes } = await adminClient
      .from("classes")
      .select(
        `
        id,
        name,
        faculty:faculty(
          profile:profiles(name)
        )
      `,
      )
      .in("faculty_id", facultyIds)

    classReports = await Promise.all(
      (classes || []).map(async (cls) => {
        const { data: sessions } = await adminClient.from("attendance_sessions").select("id").eq("class_id", cls.id)

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

        // Type-safe faculty access
        const faculty = cls.faculty as unknown as { profile?: { name?: string } }
        const facultyProfile = faculty?.profile

        return {
          id: cls.id,
          name: cls.name,
          faculty: {
            profile: {
              name: facultyProfile?.name || "Unknown",
            },
          },
          sessionCount: sessions?.length || 0,
          studentCount: studentCount || 0,
          attendance,
        }
      }),
    )
  }

  // Sort by attendance
  const sortedReports = classReports.sort((a, b) => a.attendance - b.attendance)

  // Calculate overall stats
  const totalClasses = classReports.length
  const totalStudents = classReports.reduce((acc, c) => acc + c.studentCount, 0)
  const overallAttendance =
    classReports.length > 0
      ? Math.round(classReports.reduce((acc, c) => acc + c.attendance, 0) / classReports.length)
      : 0

  return (
    <>
      <Header title="Department Reports" />
      <div className="p-6 space-y-6">
        {/* Department Info */}
        <div className="rounded-lg bg-primary/10 p-4">
          <p className="text-sm text-primary font-medium">Department: {hod.department}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Attendance</p>
                  <p className="text-3xl font-bold">{overallAttendance}%</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Faculty Members</p>
                  <p className="text-3xl font-bold">{facultyList?.length || 0}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Classes</p>
                  <p className="text-3xl font-bold">{totalClasses}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <School className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                  <p className="text-3xl font-bold">{totalStudents}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                  <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Class-wise Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Class-wise Attendance Report
            </CardTitle>
            <CardDescription>Classes by faculty in your department (sorted by attendance)</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedReports.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No attendance data available</p>
            ) : (
              <div className="space-y-4">
                {sortedReports.map((report) => (
                  <div key={report.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{report.name}</h4>
                        <Badge variant={report.attendance < 75 ? "destructive" : "secondary"}>
                          {report.attendance}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {report.faculty?.profile?.name} | {report.studentCount} students | {report.sessionCount}{" "}
                        sessions
                      </p>
                    </div>
                    <div className="w-32 hidden md:block">
                      <Progress value={report.attendance} className="h-2" />
                    </div>
                    {report.attendance < 75 ? (
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
