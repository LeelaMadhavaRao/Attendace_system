import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { Header } from "@/components/header"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, GraduationCap, School, ClipboardList, UserCheck, TrendingUp } from "lucide-react"

export default async function AdminDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    redirect("/dashboard")
  }

  // Fetch stats
  const [{ count: hodCount }, { count: facultyCount }, { count: classCount }, { count: studentCount }] =
    await Promise.all([
      supabase.from("hods").select("*", { count: "exact", head: true }),
      supabase.from("faculty").select("*", { count: "exact", head: true }),
      supabase.from("classes").select("*", { count: "exact", head: true }),
      supabase.from("students").select("*", { count: "exact", head: true }),
    ])

  return (
    <>
      <Header title="Admin Dashboard" />
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total HODs"
            value={hodCount || 0}
            description="Active department heads"
            icon={UserCheck}
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Total Faculty"
            value={facultyCount || 0}
            description="Registered faculty members"
            icon={GraduationCap}
            trend={{ value: 8, isPositive: true }}
          />
          <StatsCard title="Total Classes" value={classCount || 0} description="Active classes" icon={School} />
          <StatsCard title="Total Students" value={studentCount || 0} description="Enrolled students" icon={Users} />
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <a
                href="/admin/hods"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Create HOD</p>
                  <p className="text-sm text-muted-foreground">Add a new Head of Department</p>
                </div>
              </a>
              <a
                href="/admin/faculty"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Create Faculty</p>
                  <p className="text-sm text-muted-foreground">Register a new faculty member</p>
                </div>
              </a>
              <a
                href="/admin/reports"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">View Reports</p>
                  <p className="text-sm text-muted-foreground">Analyze attendance data</p>
                </div>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest system activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    action: "HOD Created",
                    detail: "Dr. Smith added to CSE department",
                    time: "2 hours ago",
                  },
                  {
                    action: "Faculty Registered",
                    detail: "Prof. Johnson joined via WhatsApp",
                    time: "5 hours ago",
                  },
                  {
                    action: "Attendance Marked",
                    detail: "3/4 CSIT - 45 students marked",
                    time: "1 day ago",
                  },
                  {
                    action: "Class Created",
                    detail: "New class 2/4 ECE added",
                    time: "2 days ago",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
