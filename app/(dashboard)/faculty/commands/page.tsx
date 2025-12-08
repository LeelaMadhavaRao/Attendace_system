import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, BookOpen, Users, ClipboardList, Bell, FileText, HelpCircle } from "lucide-react"
import { WhatsAppIcon } from "@/components/whatsapp-icon"

const commands = [
  {
    category: "Getting Started",
    icon: HelpCircle,
    items: [
      { command: "/help", description: "Show all available commands and usage guide" },
      { command: "/start", description: "Initialize your faculty profile with the bot" },
    ],
  },
  {
    category: "Class Management",
    icon: BookOpen,
    items: [
      { command: "/createclass", description: "Start the class creation wizard" },
      { command: "I want to create a class", description: "Natural language to create a class" },
      { command: "/myclasses", description: "List all your classes" },
    ],
  },
  {
    category: "Student Management",
    icon: Users,
    items: [
      { command: "[Send Excel File]", description: "Upload student list after class creation" },
      { command: "/addstudent", description: "Add a single student to a class" },
      { command: "/students [class]", description: "List all students in a class" },
    ],
  },
  {
    category: "Attendance",
    icon: ClipboardList,
    items: [
      {
        command: "06-12-2025, 9.00am - 12.00pm, 3/4 CSIT, OOAD, Absentees: 1,2,3",
        description: "Mark attendance with absentees list",
      },
      {
        command: "06-12-2025, 9.00am - 12.00pm, 3/4 CSIT, OOAD, Presentees: 1,2,3",
        description: "Mark attendance with presentees list",
      },
      { command: "/attendance [class]", description: "Get attendance summary for a class" },
    ],
  },
  {
    category: "Reports",
    icon: FileText,
    items: [
      { command: "Get attendance of 3/4 CSIT", description: "Fetch complete attendance data" },
      { command: "Students below 75% in 3/4 CSIT", description: "Get low attendance students" },
      { command: "/report [class]", description: "Generate detailed attendance report" },
    ],
  },
  {
    category: "Parent Communication",
    icon: Bell,
    items: [
      {
        command: "Send message to parents of students with 75% below in 3/4 CSIT",
        description: "Notify parents of low attendance students",
      },
      { command: "/notifyparents [class] [percentage]", description: "Bulk notify parents below threshold" },
    ],
  },
]

export default async function FacultyCommandsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[FACULTY/COMMANDS] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[FACULTY/COMMANDS] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find faculty profile specifically
  const facultyProfile = profiles.find(p => p.role === "faculty")

  if (!facultyProfile) {
    console.log("[FACULTY/COMMANDS] Faculty profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  return (
    <>
      <Header title="WhatsApp Commands" />
      <div className="p-6 space-y-6">
        {/* Info Banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <WhatsAppIcon className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">WhatsApp Bot Commands</h3>
              <p className="text-sm text-muted-foreground">
                Send these commands or natural language messages to the WhatsApp Attendance Bot to manage your classes
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Commands by Category */}
        <div className="grid gap-6">
          {commands.map((category) => {
            const Icon = category.icon
            return (
              <Card key={category.category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5 text-primary" />
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {category.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex-1">
                          <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                            {item.command}
                          </code>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Example Flow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Example: Creating a Class and Marking Attendance
            </CardTitle>
            <CardDescription>Step-by-step example of using WhatsApp commands</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge className="mt-1">1</Badge>
                <div>
                  <p className="font-medium">Send: &quot;I want to create a class&quot;</p>
                  <p className="text-sm text-muted-foreground">Bot will ask for class name</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="mt-1">2</Badge>
                <div>
                  <p className="font-medium">Send: &quot;3/4 CSIT&quot;</p>
                  <p className="text-sm text-muted-foreground">Bot creates the class and asks for student list</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="mt-1">3</Badge>
                <div>
                  <p className="font-medium">Upload Excel file with student data</p>
                  <p className="text-sm text-muted-foreground">
                    Columns: Register Number, Name, WhatsApp, Parent WhatsApp
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="mt-1">4</Badge>
                <div>
                  <p className="font-medium">
                    Send: &quot;06-12-2025, 9.00am - 12.00pm, 3/4 CSIT, OOAD, Absentees: 1,2,3&quot;
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Bot marks attendance with roll numbers 1, 2, 3 as absent
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge className="mt-1">5</Badge>
                <div>
                  <p className="font-medium">Send: &quot;Students below 75% in 3/4 CSIT&quot;</p>
                  <p className="text-sm text-muted-foreground">Bot sends a document with low attendance students</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
