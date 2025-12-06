"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createFaculty, getHODs } from "@/lib/admin"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"

interface HODOption {
  id: string
  department: string
  profile: {
    name: string
  }
}

const departments = [
  "Computer Science & Engineering",
  "Electronics & Communication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Information Technology",
  "Chemical Engineering",
  "Biotechnology",
]

export function CreateFacultyDialog({ isHOD = false }: { isHOD?: boolean }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hods, setHods] = useState<HODOption[]>([])
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    department: "",
    whatsappNumber: "",
    hodId: "",
  })
  const router = useRouter()

  useEffect(() => {
    if (open && !isHOD) {
      loadHODs()
    }
  }, [open, isHOD])

  const loadHODs = async () => {
    const result = await getHODs()
    if (result.data) {
      setHods(result.data as unknown as HODOption[])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await createFaculty(
        {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          phone: formData.phone,
          department: formData.department,
          role: "faculty",
          whatsappNumber: formData.whatsappNumber,
        },
        isHOD ? undefined : formData.hodId || undefined,
      )

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Faculty created successfully")
        setOpen(false)
        setFormData({
          email: "",
          password: "",
          name: "",
          phone: "",
          department: "",
          whatsappNumber: "",
          hodId: "",
        })
        router.refresh()
      }
    } catch {
      toast.error("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Faculty
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Faculty</DialogTitle>
          <DialogDescription>Add a new faculty member to the system</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="faculty-name">Full Name</Label>
              <Input
                id="faculty-name"
                placeholder="Prof. Jane Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="faculty-email">Email</Label>
              <Input
                id="faculty-email"
                type="email"
                placeholder="jane.doe@university.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="faculty-password">Password</Label>
              <Input
                id="faculty-password"
                type="password"
                placeholder="Create a secure password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="faculty-phone">Phone</Label>
                <Input
                  id="faculty-phone"
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="faculty-whatsapp">WhatsApp Number</Label>
                <Input
                  id="faculty-whatsapp"
                  placeholder="+91 9876543210"
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="faculty-department">Department</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isHOD && (
              <div className="grid gap-2">
                <Label htmlFor="faculty-hod">Assign to HOD (Optional)</Label>
                <Select value={formData.hodId} onValueChange={(value) => setFormData({ ...formData, hodId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select HOD" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No HOD assigned</SelectItem>
                    {hods.map((hod) => (
                      <SelectItem key={hod.id} value={hod.id}>
                        {hod.profile.name} - {hod.department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.department}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Faculty"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
