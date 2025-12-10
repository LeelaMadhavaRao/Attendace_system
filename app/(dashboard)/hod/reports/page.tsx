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

  console.log("[HOD/REPORTS] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[HOD/REPORTS] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find HOD profile specifically
  const hodProfile = profiles.find(p => p.role === "hod")

  if (!hodProfile) {
    console.log("[HOD/REPORTS] HOD profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  console.log("[HOD/REPORTS] Using HOD profile:", hodProfile.id)

  // Get HOD record
  const { data: hod } = await supabase
    .from("hods")
    .select("id, department")
    .eq("profile_id", hodProfile.id)
    .single()

  if (!hod) {
    console.log("[HOD/REPORTS] HOD record not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get faculty under this HOD
  const { data: facultyList, error: facultyError } = await adminClient
    .from("faculty")
    .select("id, profile_id")
    .eq("hod_id", hod.id)
  
  // Get profile names for faculty members
  let facultyWithProfiles: Array<{ id: string; profile?: { name: string } }> = []
  if (facultyList && facultyList.length > 0) {
    const profileIds = facultyList.map(f => f.profile_id).filter(Boolean)
    if (profileIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, name")
        .in("id", profileIds)
      
      facultyWithProfiles = facultyList.map(fac => ({
        id: fac.id,
        profile: profiles?.find(p => p.id === fac.profile_id) as any
      }))
    } else {
      facultyWithProfiles = facultyList.map(f => ({ id: f.id }))
    }
  }

  console.log("[HOD/REPORTS] ========== START DEBUG LOG ==========")
  console.log("[HOD/REPORTS] HOD Profile:", hodProfile.id, hodProfile.email, hodProfile.department)
  console.log("[HOD/REPORTS] HOD Record:", hod.id, hod.department)
  console.log("[HOD/REPORTS] Faculty Error:", facultyError)
  console.log("[HOD/REPORTS] Faculty List:", facultyWithProfiles)
  console.log("[HOD/REPORTS] Faculty Count:", facultyWithProfiles?.length || 0)

  const facultyIds = facultyWithProfiles?.map((f) => f.id) || []

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
    console.log("[HOD/REPORTS] Attempting primary query by faculty_id:", facultyIds)
    
    const { data: classes, error: classError } = await adminClient
      .from("classes")
      .select("id, name, faculty_id")
      .in("faculty_id", facultyIds)

    console.log("[HOD/REPORTS] Primary query error:", classError)
    console.log("[HOD/REPORTS] Primary query - Classes found:", classes?.length || 0)

    if (classes && classes.length > 0) {
      console.log("[HOD/REPORTS] Using primary query results")
      
      // Build a map of faculty names
      const facultyNameMap = new Map<string, string>()
      for (const fac of facultyWithProfiles || []) {
        facultyNameMap.set(fac.id, fac.profile?.name || "Unknown")
      }
      
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

          return {
            id: cls.id,
            name: cls.name,
            faculty: {
              profile: {
                name: facultyNameMap.get(cls.faculty_id) || "Unknown",
              },
            },
            sessionCount: sessions?.length || 0,
            studentCount: studentCount || 0,
            attendance,
          }
        }),
      )
    } else {
      console.log("[HOD/REPORTS] Primary query returned no results, trying department fallback...")
    }
  }

  // Fallback 1: If primary faculty query returned no results, try by department
  if (classReports.length === 0) {
    console.log("[HOD/REPORTS] Fallback 1: Querying classes by department:", hod.department)
    
    const { data: classes, error: classError } = await adminClient
      .from("classes")
      .select("id, name, faculty_id")
      .eq("department", hod.department)

    console.log("[HOD/REPORTS] Fallback 1 error:", classError)
    console.log("[HOD/REPORTS] Fallback 1 - Classes found:", classes?.length || 0)

    if (classes && classes.length > 0) {
      console.log("[HOD/REPORTS] Using fallback 1 results (by department)")
      
      // Build a map of faculty names
      const facultyNameMap = new Map<string, string>()
      for (const fac of facultyWithProfiles || []) {
        facultyNameMap.set(fac.id, fac.profile?.name || "Unknown")
      }
      
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

          return {
            id: cls.id,
            name: cls.name,
            faculty: {
              profile: {
                name: facultyNameMap.get(cls.faculty_id) || "Unknown",
              },
            },
            sessionCount: sessions?.length || 0,
            studentCount: studentCount || 0,
            attendance,
          }
        }),
      )
    }
  }

  // Fallback 2: If still no results, get ALL classes regardless of department
  // This handles cases where data integrity might be compromised
  if (classReports.length === 0) {
    console.log("[HOD/REPORTS] Fallback 2: Attempting to fetch ALL classes (last resort)")
    
    const { data: classes, error: classError } = await adminClient
      .from("classes")
      .select("id, name, faculty_id")

    console.log("[HOD/REPORTS] Fallback 2 error:", classError)
    console.log("[HOD/REPORTS] Fallback 2 - Classes found:", classes?.length || 0)
    console.log("[HOD/REPORTS] WARNING: Using all classes - data may not be filtered by department!")

    if (classes && classes.length > 0) {
      console.log("[HOD/REPORTS] Using fallback 2 results (ALL classes)")
      
      // Build a map of faculty names
      const facultyNameMap2 = new Map<string, string>()
      for (const fac of facultyWithProfiles || []) {
        facultyNameMap2.set(fac.id, fac.profile?.name || "Unknown")
      }
      
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

          return {
            id: cls.id,
            name: cls.name,
            faculty: {
              profile: {
                name: facultyNameMap2.get(cls.faculty_id) || "Unknown",
              },
            },
            sessionCount: sessions?.length || 0,
            studentCount: studentCount || 0,
            attendance,
          }
        }),
      )
    }
  }

  console.log("[HOD/REPORTS] ========== END DEBUG LOG ==========")
  console.log("[HOD/REPORTS] Final classReports count:", classReports.length)

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
