import { redirect } from "next/navigation"
import { createClient } from "@/lib/server"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Settings, Key, Bell, MessageSquare } from "lucide-react"

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  console.log("[ADMIN/SETTINGS] User:", user.email)

  // Find all profiles for this email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email || "")

  if (!profiles || profiles.length === 0) {
    console.log("[ADMIN/SETTINGS] No profiles found, redirecting to login")
    redirect("/login")
  }

  // Find admin profile specifically
  const adminProfile = profiles.find(p => p.role === "admin")

  if (!adminProfile) {
    console.log("[ADMIN/SETTINGS] Admin profile not found, redirecting to dashboard")
    redirect("/dashboard")
  }

  return (
    <>
      <Header title="Settings" />
      <div className="p-6 space-y-6">
        {/* WhatsApp API Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>WhatsApp Business API</CardTitle>
                <CardDescription>Configure Meta WhatsApp Business API credentials</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="whatsapp-token">Access Token</Label>
              <Input id="whatsapp-token" type="password" placeholder="Enter WhatsApp API access token" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone-number-id">Phone Number ID</Label>
              <Input id="phone-number-id" placeholder="Enter phone number ID" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="webhook-verify">Webhook Verify Token</Label>
              <Input id="webhook-verify" placeholder="Enter webhook verification token" />
            </div>
            <Button>Save WhatsApp Settings</Button>
          </CardContent>
        </Card>

        {/* Gemini API Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Gemini AI API</CardTitle>
                <CardDescription>Configure Google Gemini API for message processing</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="gemini-key">API Key</Label>
              <Input id="gemini-key" type="password" placeholder="Enter Gemini API key" />
            </div>
            <Button>Save Gemini Settings</Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Bell className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Configure system notification preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="low-attendance">Low Attendance Threshold (%)</Label>
              <Input id="low-attendance" type="number" defaultValue="75" min="0" max="100" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="auto-notify" className="h-4 w-4 rounded border-gray-300" defaultChecked />
              <Label htmlFor="auto-notify">Auto-notify parents for low attendance</Label>
            </div>
            <Button>Save Notification Settings</Button>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>System-wide configuration options</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="institution-name">Institution Name</Label>
              <Input id="institution-name" placeholder="Enter institution name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="academic-year">Current Academic Year</Label>
              <Input id="academic-year" placeholder="2024-2025" />
            </div>
            <Button>Save General Settings</Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
