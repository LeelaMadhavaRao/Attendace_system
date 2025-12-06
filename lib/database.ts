export type UserRole = "admin" | "hod" | "faculty" | "student"

export interface Profile {
  id: string
  email: string
  name: string
  phone?: string
  role: UserRole
  department?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface HOD {
  id: string
  profile_id: string
  department: string
  created_by?: string
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface Faculty {
  id: string
  profile_id: string
  department: string
  hod_id?: string
  whatsapp_number?: string
  created_by?: string
  created_at: string
  updated_at: string
  profile?: Profile
  hod?: HOD
}

export interface Class {
  id: string
  name: string
  faculty_id: string
  department?: string
  semester?: string
  academic_year?: string
  created_at: string
  updated_at: string
  faculty?: Faculty
}

export interface Student {
  id: string
  register_number: string
  name: string
  whatsapp_number?: string
  parent_whatsapp_number?: string
  class_id: string
  created_at: string
  updated_at: string
  class?: Class
}

export interface Subject {
  id: string
  name: string
  code?: string
  class_id: string
  faculty_id: string
  created_at: string
}

export interface AttendanceSession {
  id: string
  class_id: string
  subject_id?: string
  faculty_id: string
  date: string
  start_time: string
  end_time: string
  total_periods: number
  created_at: string
  class?: Class
  subject?: Subject
  faculty?: Faculty
}

export interface AttendanceRecord {
  id: string
  session_id: string
  student_id: string
  is_present: boolean
  marked_at: string
  student?: Student
  session?: AttendanceSession
}

export interface ChatHistory {
  id: string
  faculty_id: string
  message_type: "incoming" | "outgoing"
  message: string
  media_url?: string
  media_type?: string
  whatsapp_message_id?: string
  gemini_response?: GeminiResponse
  created_at: string
}

export interface ParentMessage {
  id: string
  student_id: string
  parent_phone: string
  message: string
  sent_at: string
  status: string
}

// Gemini AI Response types
export interface GeminiResponse {
  route: string
  message?: string
  data?: Record<string, unknown>
}

export type GeminiRoute =
  | "general"
  | "createClass"
  | "createStudents"
  | "assignAttendance"
  | "attendanceFetch"
  | "parentMessage"
  | "addStudent"
  | "help"

export interface AttendanceData {
  class: string
  date: string
  startTime: string
  endTime: string
  subject: string
  presentees?: string[]
  absentees?: string[]
}

export interface StudentData {
  registerNumber: string
  name: string
  whatsappNumber?: string
  parentWhatsappNumber?: string
}

export interface StudentWithAttendance extends Student {
  attendance_percentage: number
  total_sessions: number
  attended_sessions: number
}

export interface ClassAttendanceSummary {
  class_id: string
  class_name: string
  total_students: number
  total_sessions: number
  total_periods: number
  avg_attendance: number
  faculty_name: string
}
