"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/database"
import { Shield, GraduationCap, Users, UserCheck } from "lucide-react"

interface RoleSelectorProps {
  selectedRole: UserRole
  onRoleSelect: (role: UserRole) => void
}

const roles: { id: UserRole; label: string; description: string; icon: React.ElementType }[] = [
  {
    id: "admin",
    label: "Admin",
    description: "Manage all users and view all data",
    icon: Shield,
  },
  {
    id: "hod",
    label: "HOD",
    description: "Head of Department - Manage faculty",
    icon: UserCheck,
  },
  {
    id: "faculty",
    label: "Faculty",
    description: "Manage classes and attendance",
    icon: GraduationCap,
  },
  {
    id: "student",
    label: "Student",
    description: "View your attendance",
    icon: Users,
  },
]

export function RoleSelector({ selectedRole, onRoleSelect }: RoleSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {roles.map((role) => {
        const Icon = role.icon
        const isSelected = selectedRole === role.id
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onRoleSelect(role.id)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all duration-200",
              "hover:border-primary/50 hover:bg-accent",
              isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className={cn("font-medium", isSelected ? "text-primary" : "text-foreground")}>{role.label}</p>
              <p className="text-xs text-muted-foreground">{role.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
