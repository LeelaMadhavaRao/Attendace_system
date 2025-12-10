"use server"

import { createAdminClient } from "@/lib/supabase-admin"

export interface AttendanceRecord {
  sessionId: string
  date: string
  startTime: string
  endTime: string
  subjectName: string | null
  isPresent: boolean
}

export interface StudentAttendanceData {
  studentId: string
  studentName: string
  registerNumber: string
  className: string
  totalSessions: number
  presentCount: number
  absentCount: number
  attendancePercentage: number
  records: AttendanceRecord[]
}

export interface AttendanceResult {
  success: boolean
  data?: StudentAttendanceData
  error?: string
}

/**
 * Fetch attendance for a student based on register number and class name
 * Only returns records for the matching class
 */
export async function getStudentAttendance(
  registerNumber: string,
  className: string
): Promise<AttendanceResult> {
  try {
    const adminClient = createAdminClient()

    // Step 1: Find student by register number
    const { data: students, error: studentError } = await adminClient
      .from("students")
      .select(
        `
        id,
        name,
        register_number,
        class_id,
        classes (
          id,
          name
        )
      `
      )
      .eq("register_number", registerNumber)

    if (studentError) {
      console.error("[ATTENDANCE] Database error fetching student:", studentError)
      return {
        success: false,
        error: "Failed to fetch student information",
      }
    }

    if (!students || students.length === 0) {
      console.log("[ATTENDANCE] Student not found with register number:", registerNumber)
      return {
        success: false,
        error: "Student not found",
      }
    }

    const student = students[0]
    const actualClassName = (student.classes as any)?.name || ""

    console.log("[ATTENDANCE] Student found:", {
      id: student.id,
      name: student.name,
      registerNumber: student.register_number,
      actualClassName,
      providedClassName: className,
    })

    // Step 2: Verify class name matches
    if (actualClassName !== className) {
      console.log(
        "[ATTENDANCE] Class name mismatch. Expected:",
        actualClassName,
        "Got:",
        className
      )
      return {
        success: false,
        error: `Class mismatch. Your class is ${actualClassName}, not ${className}`,
      }
    }

    // Step 3: Fetch all attendance sessions for this class
    const { data: sessions, error: sessionsError } = await adminClient
      .from("attendance_sessions")
      .select(
        `
        id,
        date,
        start_time,
        end_time,
        subject_id,
        subjects (
          name
        )
      `
      )
      .eq("class_id", student.class_id)
      .order("date", { ascending: false })

    if (sessionsError) {
      console.error("[ATTENDANCE] Database error fetching sessions:", sessionsError)
      return {
        success: false,
        error: "Failed to fetch attendance sessions",
      }
    }

    if (!sessions || sessions.length === 0) {
      console.log("[ATTENDANCE] No sessions found for class:", student.class_id)
      return {
        success: true,
        data: {
          studentId: student.id,
          studentName: student.name,
          registerNumber: student.register_number,
          className: actualClassName,
          totalSessions: 0,
          presentCount: 0,
          absentCount: 0,
          attendancePercentage: 0,
          records: [],
        },
      }
    }

    // Step 4: Fetch attendance records for this student in these sessions
    const sessionIds = sessions.map((s) => s.id)

    const { data: records, error: recordsError } = await adminClient
      .from("attendance_records")
      .select("session_id, is_present")
      .eq("student_id", student.id)
      .in("session_id", sessionIds)

    if (recordsError) {
      console.error("[ATTENDANCE] Database error fetching records:", recordsError)
      return {
        success: false,
        error: "Failed to fetch attendance records",
      }
    }

    // Step 5: Process attendance data
    const attendanceMap = new Map<string, boolean>()
    if (records) {
      records.forEach((record) => {
        attendanceMap.set(record.session_id, record.is_present)
      })
    }

    const detailedRecords: AttendanceRecord[] = sessions.map((session) => ({
      sessionId: session.id,
      date: session.date,
      startTime: session.start_time,
      endTime: session.end_time,
      subjectName: (session.subjects as any)?.name || null,
      isPresent: attendanceMap.get(session.id) ?? false,
    }))

    const presentCount = detailedRecords.filter((r) => r.isPresent).length
    const totalSessions = sessions.length
    const absentCount = totalSessions - presentCount
    const attendancePercentage = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

    console.log("[ATTENDANCE] Attendance calculated:", {
      studentId: student.id,
      totalSessions,
      presentCount,
      absentCount,
      attendancePercentage,
    })

    return {
      success: true,
      data: {
        studentId: student.id,
        studentName: student.name,
        registerNumber: student.register_number,
        className: actualClassName,
        totalSessions,
        presentCount,
        absentCount,
        attendancePercentage,
        records: detailedRecords,
      },
    }
  } catch (error: any) {
    console.error("[ATTENDANCE] Exception:", error)
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    }
  }
}
