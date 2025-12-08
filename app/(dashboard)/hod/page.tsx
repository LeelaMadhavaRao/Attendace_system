import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { Header } from "@/components/header"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, School, Users, BarChart3, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function HODDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get HOD record - check by email since multiple profiles might exist
  const { data: profiles } = await supabase.from("profiles").select("id").eq("email", user.email || "")
  
  if (!profiles || profiles.length === 0) {
    redirect("/login")
  }

  const profileIds = profiles.map(p => p.id)
  console.log("[HOD/DASHBOARD] Profile IDs:", profileIds)
  
  const { data: hod } = await supabase.from("hods").select("id, department").in("profile_id", profileIds).single()

  if (!hod) {
    redirect("/dashboard")
  }

  console.log("[HOD/DASHBOARD] HOD ID:", hod.id)

  // Fetch faculty count for this HOD
  const { data: facultyList, error: facultyError } = await supabase
    .from("faculty")
    .select("id")
    .eq("hod_id", hod.id)
  
  console.log("[HOD/DASHBOARD] Faculty query error:", facultyError)
  console.log("[HOD/DASHBOARD] Faculty count:", facultyList?.length || 0)
  console.log("[HOD/DASHBOARD] Faculty records:", facultyList)

  const facultyIds = facultyList?.map((f) => f.id) || []

  let classCount = 0
  let studentCount = 0
  let totalAttendancePercentage = 0
  let lowAttendanceCount = 0

  if (facultyIds.length > 0) {
    // Get classes count
    const { count: classes } = await supabase
      .from("classes")
      .select("*", { count: "exact", head: true })
      .in("faculty_id", facultyIds)
    classCount = classes || 0

    // Get students count
    const { data: classList } = await supabase.from("classes").select("id").in("faculty_id", facultyIds)
    const classIds = classList?.map((c) => c.id) || []

    if (classIds.length > 0) {
      const { count: students } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .in("class_id", classIds)
      studentCount = students || 0

      // Get attendance statistics
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("student_id")
        .in("class_id", classIds)
        .eq("status", "present")

      if (studentCount > 0 && attendanceData) {
        totalAttendancePercentage = Math.round((attendanceData.length / (studentCount * 10)) * 100) // Assuming 10 classes per student
      }

      // Get low attendance students (below 75%)
      const { data: studentsData } = await supabase
        .from("students")
        .select("id")
        .in("class_id", classIds)

      if (studentsData) {
        for (const student of studentsData) {
          const { count: presentCount } = await supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .eq("student_id", student.id)
            .eq("status", "present")
            .in("class_id", classIds)

          const { count: totalCount } = await supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .eq("student_id", student.id)
            .in("class_id", classIds)

          if (totalCount && presentCount && (presentCount / totalCount) * 100 < 75) {
            lowAttendanceCount++
          }
        }
      }
    }
  }

  return (
    <>
      <Header title="HOD Dashboard" />
      <div className="p-6 space-y-6">
        <div className="rounded-lg bg-primary/10 p-4">
          <p className="text-sm text-primary font-medium">Department: {hod.department}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatsCard
            title="Faculty Members"
            value={facultyIds.length}
            description="Faculty in your department"
            icon={GraduationCap}
          />
          <StatsCard title="Total Classes" value={classCount} description="Classes managed by faculty" icon={School} />
          <StatsCard title="Total Students" value={studentCount} description="Students in all classes" icon={Users} />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Faculty Management - Primary Focus */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Faculty Management
              </CardTitle>
              <CardDescription>Manage and add faculty members</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/hod/faculty" className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Manage Faculty</p>
                  <p className="text-xs text-muted-foreground">{facultyIds.length} faculty members</p>
                </div>
              </Link>
              <Button className="w-full" asChild>
                <Link href="/hod/faculty">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Faculty Member
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Attendance Alerts */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Attendance Insights
              </CardTitle>
              <CardDescription>Monitor student attendance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Department Attendance</span>
                  <span className="text-2xl font-bold">{totalAttendancePercentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${totalAttendancePercentage}%` }}
                  />
                </div>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3 space-y-1">
                <p className="font-medium text-sm text-destructive">{lowAttendanceCount} Students</p>
                <p className="text-xs text-muted-foreground">Below 75% attendance threshold</p>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/hod/reports">
                  View Detailed Reports
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

