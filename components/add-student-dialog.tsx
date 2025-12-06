"use client"

import type React from "react"

import { useState } from "react"
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
import { createStudent } from "@/lib/faculty"
import { toast } from "sonner"
import { Loader2, UserPlus } from "lucide-react"

interface AddStudentDialogProps {
  classId: string
}

export function AddStudentDialog({ classId }: AddStudentDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    registerNumber: "",
    name: "",
    whatsappNumber: "",
    parentWhatsappNumber: "",
  })
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await createStudent({
        ...formData,
        classId,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Student added successfully")
        setOpen(false)
        setFormData({ registerNumber: "", name: "", whatsappNumber: "", parentWhatsappNumber: "" })
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
        <Button variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Student</DialogTitle>
          <DialogDescription>Add a new student to this class</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="register-number">Register Number</Label>
              <Input
                id="register-number"
                placeholder="e.g., 21CS101"
                value={formData.registerNumber}
                onChange={(e) => setFormData({ ...formData, registerNumber: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="student-name">Full Name</Label>
              <Input
                id="student-name"
                placeholder="Student name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="student-whatsapp">Student WhatsApp Number</Label>
              <Input
                id="student-whatsapp"
                placeholder="+91 9876543210"
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="parent-whatsapp">Parent WhatsApp Number</Label>
              <Input
                id="parent-whatsapp"
                placeholder="+91 9876543210"
                value={formData.parentWhatsappNumber}
                onChange={(e) => setFormData({ ...formData, parentWhatsappNumber: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.registerNumber || !formData.name}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Student"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
