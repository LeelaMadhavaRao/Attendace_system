import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, GraduationCap, School, ClipboardList, UserCheck, TrendingUp } from "lucide-react"

// Helper function to format relative time
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

interface ActivityItem {
  action: string
  detail: string
  time: string
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[ADMIN] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[ADMIN] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find admin profile specifically
  const adminProfile = profiles.find(p => p.role === "admin")

  if (!adminProfile) {
    console.log("[ADMIN] Admin profile not found, redirecting to dashboard")
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

  // Fetch recent activities using admin client
  const adminClient = createAdminClient()

  // Fetch recent HODs with profiles
  const { data: recentHods } = await adminClient
    .from("hods")
    .select("id, created_at, department, profile_id")
    .order("created_at", { ascending: false })
    .limit(3)

  const hodProfileIds = (recentHods || []).map(h => h.profile_id).filter(Boolean)
  const { data: hodProfiles } = await adminClient
    .from("profiles")
    .select("id, name")
    .in("id", hodProfileIds.length > 0 ? hodProfileIds : ["none"])
  const hodProfileMap = new Map((hodProfiles || []).map(p => [p.id, p]))

  // Fetch recent faculty with profiles
  const { data: recentFaculty } = await adminClient
    .from("faculty")
    .select("id, created_at, department, profile_id")
    .order("created_at", { ascending: false })
    .limit(3)

  const facultyProfileIds = (recentFaculty || []).map(f => f.profile_id).filter(Boolean)
  const { data: facultyProfiles } = await adminClient
    .from("profiles")
    .select("id, name")
    .in("id", facultyProfileIds.length > 0 ? facultyProfileIds : ["none"])
  const facultyProfileMap = new Map((facultyProfiles || []).map(p => [p.id, p]))

  // Fetch recent classes
  const { data: recentClasses } = await adminClient
    .from("classes")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(3)

  // Fetch recent attendance sessions with class info
  const { data: recentSessions } = await adminClient
    .from("attendance_sessions")
    .select("id, created_at, class_id")
    .order("created_at", { ascending: false })
    .limit(3)

  const sessionClassIds = (recentSessions || []).map(s => s.class_id).filter(Boolean)
  const { data: sessionClasses } = await adminClient
    .from("classes")
    .select("id, name")
    .in("id", sessionClassIds.length > 0 ? sessionClassIds : ["none"])
  const classMap = new Map((sessionClasses || []).map(c => [c.id, c]))

  // Get attendance counts for sessions
  const sessionsWithCounts = await Promise.all(
    (recentSessions || []).map(async (session) => {
      const { count } = await adminClient
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("session_id", session.id)
        .eq("is_present", true)
      return { ...session, presentCount: count || 0 }
    })
  )

  // Build activities array
  const activities: ActivityItem[] = []

  // Add HOD activities
  for (const hod of recentHods || []) {
    const profile = hodProfileMap.get(hod.profile_id)
    activities.push({
      action: "HOD Created",
      detail: `${profile?.name || "Unknown"} added to ${hod.department} department`,
      time: getRelativeTime(new Date(hod.created_at)),
    })
  }

  // Add Faculty activities
  for (const faculty of recentFaculty || []) {
    const profile = facultyProfileMap.get(faculty.profile_id)
    activities.push({
      action: "Faculty Registered",
      detail: `${profile?.name || "Unknown"} joined ${faculty.department}`,
      time: getRelativeTime(new Date(faculty.created_at)),
    })
  }

  // Add Class activities
  for (const cls of recentClasses || []) {
    activities.push({
      action: "Class Created",
      detail: `New class ${cls.name} added`,
      time: getRelativeTime(new Date(cls.created_at)),
    })
  }

  // Add Attendance activities
  for (const session of sessionsWithCounts) {
    const cls = classMap.get(session.class_id)
    activities.push({
      action: "Attendance Marked",
      detail: `${cls?.name || "Unknown Class"} - ${session.presentCount} students marked`,
      time: getRelativeTime(new Date(session.created_at)),
    })
  }

  // Sort activities by recency (most recent first) and take top 5
  const sortedActivities = activities
    .sort((a, b) => {
      // Parse relative time to compare (crude but works for display)
      const getPriority = (time: string) => {
        if (time.includes("min")) return 1
        if (time.includes("hour")) return 2
        if (time.includes("day")) return 3
        return 4
      }
      return getPriority(a.time) - getPriority(b.time)
    })
    .slice(0, 5)

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
              {sortedActivities.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No recent activities</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedActivities.map((item, idx) => (
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
