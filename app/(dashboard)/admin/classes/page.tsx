import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { School, Users, BookOpen } from "lucide-react"
import Link from "next/link"

export default async function AdminClassesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[ADMIN/CLASSES] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[ADMIN/CLASSES] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find admin profile specifically
  const adminProfile = profiles.find(p => p.role === "admin")

  if (!adminProfile) {
    console.log("[ADMIN/CLASSES] Admin profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  const adminClient = createAdminClient()

  // Fetch all classes with faculty info
  const { data: classes } = await adminClient
    .from("classes")
    .select(
      `
      *,
      faculty:faculty(
        profile:profiles(name),
        department
      )
    `,
    )
    .order("created_at", { ascending: false })

  // Get student counts for each class
  const classesWithCounts = await Promise.all(
    (classes || []).map(async (cls) => {
      const { count } = await adminClient
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("class_id", cls.id)

      const { count: sessionCount } = await adminClient
        .from("attendance_sessions")
        .select("*", { count: "exact", head: true })
        .eq("class_id", cls.id)

      return {
        ...cls,
        studentCount: count || 0,
        sessionCount: sessionCount || 0,
      }
    }),
  )

  return (
    <>
      <Header title="All Classes" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <School className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Classes Overview</CardTitle>
                <CardDescription>View all classes created by faculty members</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {classesWithCounts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No classes created yet</p>
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
                    {classesWithCounts.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.name}</TableCell>
                        <TableCell>{cls.faculty?.profile?.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{cls.faculty?.department || "-"}</Badge>
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
                          {new Date(cls.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/admin/classes/${cls.id}`}
                            className="text-primary hover:underline text-sm font-medium"
                          >
                            View Attendance
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
