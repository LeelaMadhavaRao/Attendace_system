import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/server"
import { Header } from "@/components/header"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Users, ClipboardList, MessageSquare, TrendingUp } from "lucide-react"
import { WhatsAppIcon } from "@/components/whatsapp-icon"

export default async function FacultyDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[FACULTY] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[FACULTY] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find faculty profile specifically
  const facultyProfile = profiles.find(p => p.role === "faculty")

  if (!facultyProfile) {
    console.log("[FACULTY] Faculty profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  console.log("[FACULTY] Using faculty profile:", facultyProfile.id)

  // Get faculty record
  const { data: faculty } = await supabase
    .from("faculty")
    .select("id, whatsapp_number")
    .eq("profile_id", facultyProfile.id)
    .single()

  // Fetch stats
  let classCount = 0
  let studentCount = 0
  let sessionCount = 0

  if (faculty) {
    const { count: classes } = await supabase
      .from("classes")
      .select("*", { count: "exact", head: true })
      .eq("faculty_id", faculty.id)
    classCount = classes || 0

    const { data: classList } = await supabase.from("classes").select("id").eq("faculty_id", faculty.id)
    const classIds = classList?.map((c) => c.id) || []

    if (classIds.length > 0) {
      const { count: students } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .in("class_id", classIds)
      studentCount = students || 0
    }

    const { count: sessions } = await supabase
      .from("attendance_sessions")
      .select("*", { count: "exact", head: true })
      .eq("faculty_id", faculty.id)
    sessionCount = sessions || 0
  }

  return (
    <>
      <Header title="Faculty Dashboard" />
      <div className="p-6 space-y-6">
        {/* WhatsApp Integration Banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <WhatsAppIcon className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">WhatsApp Integration Active</h3>
              <p className="text-sm text-muted-foreground">
                {faculty?.whatsapp_number
                  ? `Connected: ${faculty.whatsapp_number}`
                  : "Send a message to the attendance bot to get started"}
              </p>
            </div>
            <a
              href="/faculty/commands"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View Commands
            </a>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="My Classes" value={classCount} description="Active classes" icon={BookOpen} />
          <StatsCard title="Total Students" value={studentCount} description="In your classes" icon={Users} />
          <StatsCard
            title="Attendance Sessions"
            value={sessionCount}
            description="Sessions recorded"
            icon={ClipboardList}
          />
          <StatsCard
            title="Avg Attendance"
            value="87%"
            description="Across all classes"
            icon={TrendingUp}
            trend={{ value: 3, isPositive: true }}
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
              <CardDescription>Manage your classes and attendance</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Link
                href="/faculty/classes"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">My Classes</p>
                  <p className="text-sm text-muted-foreground">View and manage your classes</p>
                </div>
              </Link>
              <a
                href="/faculty/attendance"
                className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Mark Attendance</p>
                  <p className="text-sm text-muted-foreground">Record attendance via web</p>
                </div>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                WhatsApp Commands
              </CardTitle>
              <CardDescription>Quick reference for WhatsApp bot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-muted p-3">
                <code className="text-sm">/help</code>
                <p className="text-xs text-muted-foreground mt-1">Show all available commands</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <code className="text-sm">/createclass</code>
                <p className="text-xs text-muted-foreground mt-1">Start creating a new class</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <code className="text-sm">/attendance</code>
                <p className="text-xs text-muted-foreground mt-1">Quick attendance marking</p>
              </div>
              <a href="/faculty/commands" className="text-sm text-primary hover:underline block text-center mt-2">
                View all commands →
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
