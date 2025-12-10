import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  UserCheck, 
  Mail, 
  Phone, 
  Building2, 
  Calendar, 
  GraduationCap, 
  School, 
  Users,
  ArrowLeft 
} from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function HODDetailPage({ params }: PageProps) {
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

  console.log("[ADMIN/HOD_DETAIL] Loading HOD with ID:", id)

  // Fetch HOD details
  const { data: allHods, error: hodsError } = await adminClient
    .from("hods")
    .select("*")

  if (hodsError) {
    console.error("[ADMIN/HOD_DETAIL] Error fetching HODs:", hodsError)
    notFound()
  }

  const hodData = (allHods || []).find(h => h.id === id)

  if (!hodData) {
    console.log("[ADMIN/HOD_DETAIL] HOD not found with ID:", id, "Available IDs:", (allHods || []).map((h: any) => h.id))
    notFound()
  }

  console.log("[ADMIN/HOD_DETAIL] HOD found, profile_id:", hodData.profile_id)

  // Fetch HOD profile
  const { data: hodProfile } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", hodData.profile_id)
    .single()

  const hod = { ...hodData, profile: hodProfile }

  console.log("[ADMIN/HOD_DETAIL] HOD loaded:", hod.profile?.name)

  // Fetch faculty under this HOD
  const { data: facultyList, error: facultyError } = await adminClient
    .from("faculty")
    .select("id, profile_id, whatsapp_number, created_at")
    .eq("hod_id", id)
    .order("created_at", { ascending: false })

  console.log("[ADMIN/HOD_DETAIL] Faculty count:", facultyList?.length || 0, "Error:", facultyError?.message)

  // Fetch profiles for faculty
  const facultyProfileIds = (facultyList || []).map(f => f.profile_id).filter(Boolean)
  const { data: facultyProfiles } = await adminClient
    .from("profiles")
    .select("id, name, email")
    .in("id", facultyProfileIds.length > 0 ? facultyProfileIds : ["none"])

  const profileMap = new Map((facultyProfiles || []).map(p => [p.id, p]))
  const enrichedFacultyList = (facultyList || []).map(f => ({
    ...f,
    profile: profileMap.get(f.profile_id)
  }))

  // Fetch classes created by faculty under this HOD
  const facultyIds = (enrichedFacultyList || []).map(f => f.id)
  let classes: { id: string; name: string; faculty_id: string; created_at: string; studentCount: number; facultyName: string }[] = []
  
  if (facultyIds.length > 0) {
    const { data: classData, error: classError } = await adminClient
      .from("classes")
      .select("*")
      .in("faculty_id", facultyIds)
      .order("created_at", { ascending: false })

    console.log("[ADMIN/HOD_DETAIL] Classes fetched:", classData?.length || 0, "Error:", classError?.message)
    
    // Get student counts for each class
    classes = await Promise.all(
      (classData || []).map(async (cls) => {
        const { count } = await adminClient
          .from("students")
          .select("*", { count: "exact", head: true })
          .eq("class_id", cls.id)
        
        const faculty = enrichedFacultyList.find(f => f.id === cls.faculty_id)
        
        return { 
          ...cls, 
          studentCount: count || 0,
          facultyName: faculty?.profile?.name || "-"
        }
      })
    )
  }

  // Calculate total students under this HOD
  const totalStudents = classes.reduce((sum, cls) => sum + cls.studentCount, 0)

  return (
    <>
      <Header title="HOD Details" />
      <div className="p-6 space-y-6">
        {/* Back Button */}
        <Link href="/admin/hods">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to HODs
          </Button>
        </Link>

        {/* HOD Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <UserCheck className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{hod.profile?.name}</CardTitle>
                <CardDescription>Head of Department</CardDescription>
              </div>
              <Badge variant="secondary" className="ml-auto text-base px-4 py-1">
                {hod.department}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium truncate">{hod.profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{hod.profile?.phone || "Not provided"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{hod.department}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">
                    {new Date(hod.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Faculty Members</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enrichedFacultyList?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Under this HOD</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Classes</CardTitle>
              <School className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{classes.length}</div>
              <p className="text-xs text-muted-foreground">Total classes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
              <p className="text-xs text-muted-foreground">Total students</p>
            </CardContent>
          </Card>
        </div>

        {/* Faculty Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Faculty Members</CardTitle>
                <CardDescription>Faculty under {hod.profile?.name}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!enrichedFacultyList || enrichedFacultyList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No faculty members under this HOD</p>
              </div>
            ) : (
          <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrichedFacultyList.map((faculty) => (
                      <TableRow key={faculty.id}>
                        <TableCell className="font-medium">{faculty.profile?.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {faculty.profile?.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          {faculty.whatsapp_number ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {faculty.whatsapp_number}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(faculty.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Classes Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <School className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Classes</CardTitle>
                <CardDescription>Classes created by faculty under this HOD</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {classes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No classes created yet</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class Name</TableHead>
                      <TableHead>Faculty</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.name}</TableCell>
                        <TableCell>{cls.facultyName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {cls.studentCount}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(cls.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
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
