import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { Header } from "@/components/header"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, School, Users, BarChart3, ClipboardList } from "lucide-react"

export default async function HODDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role, department").eq("id", user.id).single()

  if (profile?.role !== "hod") {
    redirect("/dashboard")
  }

  // Get HOD record
  const { data: hod } = await supabase.from("hods").select("id, department").eq("profile_id", user.id).single()

  if (!hod) {
    redirect("/dashboard")
  }

  // Fetch stats for HOD's department
  const { data: facultyList } = await supabase.from("faculty").select("id").eq("hod_id", hod.id)

  const facultyIds = facultyList?.map((f) => f.id) || []

  let classCount = 0
  let studentCount = 0

  if (facultyIds.length > 0) {
    const { count: classes } = await supabase
      .from("classes")
      .select("*", { count: "exact", head: true })
      .in("faculty_id", facultyIds)
    classCount = classes || 0

    const { data: classList } = await supabase.from("classes").select("id").in("faculty_id", facultyIds)
    const classIds = classList?.map((c) => c.id) || []

    if (classIds.length > 0) {
      const { count: students } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .in("class_id", classIds)
      studentCount = students || 0
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
            title="My Faculty"
            value={facultyIds.length}
            description="Faculty in your department"
            icon={GraduationCap}
          />
          <StatsCard title="Total Classes" value={classCount} description="Classes by your faculty" icon={School} />
          <StatsCard
            title="Total Students"
            value={studentCount}
            description="Students in department classes"
            icon={Users}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Manage your department</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <a
                href="/hod/faculty"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Manage Faculty</p>
                  <p className="text-sm text-muted-foreground">View and create faculty profiles</p>
                </div>
              </a>
              <a
                href="/hod/reports"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Attendance Reports</p>
                  <p className="text-sm text-muted-foreground">View attendance statistics</p>
                </div>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Department Overview
              </CardTitle>
              <CardDescription>Quick stats for your department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Average Attendance</span>
                  <span className="font-semibold">85%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-full w-[85%] rounded-full bg-primary" />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-muted-foreground">Students below 75%</span>
                  <span className="font-semibold text-destructive">12</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
