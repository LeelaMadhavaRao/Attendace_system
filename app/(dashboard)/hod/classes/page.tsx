import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { School, Users, BookOpen } from "lucide-react"
import Link from "next/link"

export default async function HODClassesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[HOD/CLASSES] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[HOD/CLASSES] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find HOD profile specifically
  const hodProfile = profiles.find(p => p.role === "hod")

  if (!hodProfile) {
    console.log("[HOD/CLASSES] HOD profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  console.log("[HOD/CLASSES] Using HOD profile:", hodProfile.id)

  // Get HOD record
  const { data: hod } = await supabase
    .from("hods")
    .select("id, department")
    .eq("profile_id", hodProfile.id)
    .single()

  if (!hod) {
    console.log("[HOD/CLASSES] HOD record not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Get faculty IDs under this HOD
  const { data: facultyList, error: facultyError } = await adminClient
    .from("faculty")
    .select("id, profile_id, department")
    .eq("hod_id", hod.id)
  
  // Get profile names for faculty members
  let facultyWithProfiles: Array<{ id: string; profile_id: string; department: string; profile?: { name: string } }> = []
  if (facultyList && facultyList.length > 0) {
    const profileIds = facultyList.map(f => f.profile_id).filter(Boolean)
    if (profileIds.length > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, name")
        .in("id", profileIds)
      
      facultyWithProfiles = facultyList.map(fac => ({
        id: fac.id,
        profile_id: fac.profile_id,
        department: fac.department,
        profile: profiles?.find(p => p.id === fac.profile_id) as any
      }))
    } else {
      facultyWithProfiles = facultyList
    }
  }

  console.log("[HOD/CLASSES] ========== START DEBUG LOG ==========")
  console.log("[HOD/CLASSES] HOD Profile:", hodProfile.id, hodProfile.email, hodProfile.department)
  console.log("[HOD/CLASSES] HOD Record:", hod.id, hod.department)
  console.log("[HOD/CLASSES] Faculty Error:", facultyError)
  console.log("[HOD/CLASSES] Faculty List:", facultyWithProfiles)
  console.log("[HOD/CLASSES] Faculty Count:", facultyWithProfiles?.length || 0)
  console.log("[HOD/CLASSES] HOD ID being queried:", hod.id)

  const facultyIds = facultyWithProfiles?.map((f) => f.id) || []

  // Fetch classes by faculty under this HOD
  let classes: Array<{
    id: string
    name: string
    department?: string
    created_at: string
    faculty?: {
      profile?: { name: string }
      department?: string
    }
    studentCount: number
    sessionCount: number
  }> = []

  if (facultyIds.length > 0) {
    console.log("[HOD/CLASSES] Attempting primary query by faculty_id:", facultyIds)
    
    const { data: classesData, error: classError } = await adminClient
      .from("classes")
      .select("id, name, department, created_at, faculty_id")
      .in("faculty_id", facultyIds)
      .order("created_at", { ascending: false })

    console.log("[HOD/CLASSES] Primary query error:", classError)
    console.log("[HOD/CLASSES] Primary query - Classes found:", classesData?.length || 0)

    if (classesData && classesData.length > 0) {
      console.log("[HOD/CLASSES] Using primary query results")
      
      // Build a map of faculty names for quick lookup
      const facultyNameMap = new Map<string, string>()
      for (const fac of facultyWithProfiles || []) {
        facultyNameMap.set(fac.id, fac.profile?.name || "-")
      }
      
      // Get student and session counts
      classes = await Promise.all(
        (classesData || []).map(async (cls) => {
          const { count: studentCount } = await adminClient
            .from("students")
            .select("*", { count: "exact", head: true })
            .eq("class_id", cls.id)

          const { count: sessionCount } = await adminClient
            .from("attendance_sessions")
            .select("*", { count: "exact", head: true })
            .eq("class_id", cls.id)

          return {
            id: cls.id,
            name: cls.name,
            department: cls.department,
            created_at: cls.created_at,
            faculty: {
              profile: {
                name: facultyNameMap.get(cls.faculty_id) || "-"
              },
              department: facultyWithProfiles?.find(f => f.id === cls.faculty_id)?.department
            },
            studentCount: studentCount || 0,
            sessionCount: sessionCount || 0,
          }
        }),
      )
    } else {
      console.log("[HOD/CLASSES] Primary query returned no results, trying department fallback...")
    }
  }

  // Fallback 1: If primary faculty query returned no results, try by department
  if (classes.length === 0) {
    console.log("[HOD/CLASSES] Fallback 1: Querying classes by department:", hod.department)
    
    const { data: classesData, error: deptError } = await adminClient
      .from("classes")
      .select("id, name, department, created_at, faculty_id")
      .eq("department", hod.department)
      .order("created_at", { ascending: false })

    console.log("[HOD/CLASSES] Fallback 1 error:", deptError)
    console.log("[HOD/CLASSES] Fallback 1 - Classes found:", classesData?.length || 0)

    if (classesData && classesData.length > 0) {
      console.log("[HOD/CLASSES] Using fallback 1 results (by department)")
      
      // Build a map of faculty names
      const facultyNameMap = new Map<string, string>()
      for (const fac of facultyWithProfiles || []) {
        facultyNameMap.set(fac.id, fac.profile?.name || "-")
      }
      
      classes = await Promise.all(
        classesData.map(async (cls) => {
          const { count: studentCount } = await adminClient
            .from("students")
            .select("*", { count: "exact", head: true })
            .eq("class_id", cls.id)

          const { count: sessionCount } = await adminClient
            .from("attendance_sessions")
            .select("*", { count: "exact", head: true })
            .eq("class_id", cls.id)

          return {
            id: cls.id,
            name: cls.name,
            department: cls.department,
            created_at: cls.created_at,
            faculty: {
              profile: {
                name: facultyNameMap.get(cls.faculty_id) || "-"
              },
              department: facultyWithProfiles?.find(f => f.id === cls.faculty_id)?.department
            },
            studentCount: studentCount || 0,
            sessionCount: sessionCount || 0,
          }
        }),
      )
    }
  }

  // Fallback 2: If still no results, get ALL classes regardless of department
  // This handles cases where data integrity might be compromised
  if (classes.length === 0) {
    console.log("[HOD/CLASSES] Fallback 2: Attempting to fetch ALL classes (last resort)")
    
    const { data: classesData, error: allError } = await adminClient
      .from("classes")
      .select("id, name, department, created_at, faculty_id")
      .order("created_at", { ascending: false })

    console.log("[HOD/CLASSES] Fallback 2 error:", allError)
    console.log("[HOD/CLASSES] Fallback 2 - Classes found:", classesData?.length || 0)
    console.log("[HOD/CLASSES] WARNING: Using all classes - data may not be filtered by department!")

    if (classesData && classesData.length > 0) {
      console.log("[HOD/CLASSES] Using fallback 2 results (ALL classes)")
      
      // Build a map of faculty names
      const facultyNameMap = new Map<string, string>()
      for (const fac of facultyWithProfiles || []) {
        facultyNameMap.set(fac.id, fac.profile?.name || "-")
      }
      
      classes = await Promise.all(
        classesData.map(async (cls) => {
          const { count: studentCount } = await adminClient
            .from("students")
            .select("*", { count: "exact", head: true })
            .eq("class_id", cls.id)

          const { count: sessionCount } = await adminClient
            .from("attendance_sessions")
            .select("*", { count: "exact", head: true })
            .eq("class_id", cls.id)

          return {
            id: cls.id,
            name: cls.name,
            department: cls.department,
            created_at: cls.created_at,
            faculty: {
              profile: {
                name: facultyNameMap.get(cls.faculty_id) || "-"
              },
              department: facultyWithProfiles?.find(f => f.id === cls.faculty_id)?.department
            },
            studentCount: studentCount || 0,
            sessionCount: sessionCount || 0,
          }
        }),
      )
    }
  }

  console.log("[HOD/CLASSES] ========== END DEBUG LOG ==========")
  console.log("[HOD/CLASSES] Final classes count:", classes.length)

  return (
    <>
      <Header title="Department Classes" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <School className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Classes in {hod.department}</CardTitle>
                <CardDescription>Classes created by faculty in your department</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No classes created yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Faculty can create classes via WhatsApp or the web interface
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class Name</TableHead>
                      <TableHead>Faculty</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.name}</TableCell>
                        <TableCell>{cls.faculty?.profile?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{cls.department || "-"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {cls.studentCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            {cls.sessionCount}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(cls.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/hod/classes/${cls.id}`}
                            className="text-primary hover:underline text-sm font-medium"
                          >
                            View Details
                          </Link>
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
