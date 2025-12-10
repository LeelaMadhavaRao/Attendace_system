import { createSupabaseClient, sendWhatsAppMessage } from "../_shared/utils.ts"

interface RouteHandlerContext {
  facultyId: string
  geminiResponse: {
    route: string
    message: string
    data: Record<string, any>
  }
  supabase: any
  phoneNumber: string
}

// Calculate number of periods based on time duration
// Each period is 45 minutes
function calculatePeriods(startTime: string, endTime: string): number {
  try {
    // Parse time strings (format: "HH:MM" or "HH:MM AM/PM")
    const parseTime = (timeStr: string): Date => {
      const now = new Date()
      const timeParts = timeStr.trim().toLowerCase()
      
      // Handle 12-hour format
      if (timeParts.includes('am') || timeParts.includes('pm')) {
        const isPM = timeParts.includes('pm')
        const timeOnly = timeParts.replace(/am|pm/gi, '').trim()
        const [hours, minutes] = timeOnly.split(':').map(Number)
        
        let hour24 = hours
        if (isPM && hours !== 12) hour24 = hours + 12
        if (!isPM && hours === 12) hour24 = 0
        
        now.setHours(hour24, minutes || 0, 0, 0)
      } else {
        // Handle 24-hour format
        const [hours, minutes] = timeStr.split(':').map(Number)
        now.setHours(hours, minutes || 0, 0, 0)
      }
      
      return now
    }
    
    const start = parseTime(startTime)
    const end = parseTime(endTime)
    
    // Calculate difference in minutes
    const diffMs = end.getTime() - start.getTime()
    const diffMinutes = diffMs / (1000 * 60)
    
    // Calculate periods (45 minutes = 1 period)
    const periods = Math.round(diffMinutes / 45)
    
    console.log(`Time calculation: ${startTime} to ${endTime} = ${diffMinutes} minutes = ${periods} periods`)
    
    return Math.max(1, periods) // Minimum 1 period
  } catch (error) {
    console.error("Error calculating periods:", error)
    return 1 // Default to 1 period on error
  }
}

export async function handleCreateClass(ctx: RouteHandlerContext): Promise<string> {
  const data = ctx.geminiResponse.data as { className?: string; semester?: string; academicYear?: string }

  if (!data.className) {
    return "Please provide a class name to create."
  }

  // Get faculty's department
  const { data: facultyData } = await ctx.supabase
    .from("faculty")
    .select("department")
    .eq("id", ctx.facultyId)
    .single()

  if (!facultyData) {
    console.error("Faculty not found:", ctx.facultyId)
    return "Failed to create class. Faculty record not found."
  }

  const departmentName = facultyData.department

  // Check if class already exists
  const { data: existing } = await ctx.supabase
    .from("classes")
    .select("id, name")
    .eq("faculty_id", ctx.facultyId)
    .eq("name", data.className)
    .single()

  if (existing) {
    return `A class named "${data.className}" already exists.`
  }

  // Create the class with department assigned
  const { error } = await ctx.supabase.from("classes").insert({
    name: data.className,
    faculty_id: ctx.facultyId,
    department: departmentName,
  })

  if (error) {
    console.error("Error creating class:", error)
    return "Failed to create class. Please try again."
  }

  return `Class "${data.className}" created successfully in department: ${departmentName}!\n\nNow please send an Excel file with student data.\n\nRequired columns:\n- Register Number\n- Name\n- WhatsApp (optional)\n- Parent WhatsApp (optional)`
}

export async function handleAssignAttendance(ctx: RouteHandlerContext): Promise<string> {
  const data = ctx.geminiResponse.data as {
    className: string
    date: string
    startTime: string
    endTime: string
    subject: string
    type: "absentees" | "presentees"
    rollNumbers: string[]
  }

  // Validate required fields
  if (!data.className) {
    return "Class name is required. Please specify the class."
  }
  if (!data.date) {
    return "Date is required. Please specify the date (YYYY-MM-DD)."
  }
  if (!data.startTime || !data.endTime) {
    return "Time range is required. Please specify both start and end times."
  }
  if (!data.type || !["absentees", "presentees"].includes(data.type)) {
    return "Attendance type is required. Please specify 'absentees' or 'presentees'."
  }
  // Allow empty rollNumbers for "no absentees" or "no presentees" scenarios
  if (!data.rollNumbers) {
    data.rollNumbers = []
  }

  console.log("Attendance request validated:", {
    className: data.className,
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    subject: data.subject,
    type: data.type,
    rollCount: data.rollNumbers.length,
    allPresent: data.type === "absentees" && data.rollNumbers.length === 0,
    allAbsent: data.type === "presentees" && data.rollNumbers.length === 0,
  })

  // Get class
  const { data: classData } = await ctx.supabase
    .from("classes")
    .select("id")
    .eq("faculty_id", ctx.facultyId)
    .eq("name", data.className)
    .single()

  if (!classData) {
    return `Class "${data.className}" not found.`
  }

  // Get or create subject
  let subjectId = null
  if (data.subject) {
    const { data: subject } = await ctx.supabase
      .from("subjects")
      .select("id")
      .eq("name", data.subject)
      .eq("class_id", classData.id)
      .single()

    if (subject) {
      subjectId = subject.id
    } else {
      const { data: newSubject } = await ctx.supabase
        .from("subjects")
        .insert({
          name: data.subject,
          class_id: classData.id,
          faculty_id: ctx.facultyId,
        })
        .select()
        .single()
      subjectId = newSubject?.id
    }
  }

  // Calculate number of periods based on time duration
  const totalPeriods = calculatePeriods(data.startTime, data.endTime)
  console.log(`Session from ${data.startTime} to ${data.endTime} = ${totalPeriods} periods`)
  
  // Check if attendance already exists for this session (same class, date, time)
  const { data: existingSession } = await ctx.supabase
    .from("attendance_sessions")
    .select("id")
    .eq("class_id", classData.id)
    .eq("faculty_id", ctx.facultyId) // CRITICAL: Filter by faculty_id
    .eq("date", data.date)
    .eq("start_time", data.startTime)
    .eq("end_time", data.endTime)
    .single()

  if (existingSession) {
    return `⚠️ Attendance for ${data.className} on ${data.date} from ${data.startTime} to ${data.endTime} has already been marked.

To edit this attendance, please reply with:
"Edit attendance for ${data.className} on ${data.date} from ${data.startTime} to ${data.endTime} - Absentees/Presentees: [list]"

This requires confirmation before making changes.`
  }
  
  // Create attendance session
  const { data: session, error: sessionError } = await ctx.supabase
    .from("attendance_sessions")
    .insert({
      class_id: classData.id,
      subject_id: subjectId,
      faculty_id: ctx.facultyId,
      date: data.date,
      start_time: data.startTime,
      end_time: data.endTime,
      total_periods: totalPeriods,
    })
    .select()
    .single()

  if (sessionError) {
    console.error("Session creation error:", sessionError)
    return `Failed to create attendance session: ${sessionError.message}`
  }

  // Get all students
  const { data: students } = await ctx.supabase
    .from("students")
    .select("id, register_number")
    .eq("class_id", classData.id)
    .eq("faculty_id", ctx.facultyId) // CRITICAL: Filter by faculty_id

  if (!students || students.length === 0) {
    return "No students found in this class."
  }

  // Mark attendance with periods
  const attendanceRecords = students.map((student: any) => {
    // Compare as strings since register_number is stored as text
    const isPresent = data.type === "presentees"
      ? data.rollNumbers.includes(student.register_number)
      : !data.rollNumbers.includes(student.register_number)

    return {
      session_id: session.id,
      student_id: student.id,
      is_present: isPresent,
    }
  })

  console.log(`Creating ${attendanceRecords.length} attendance records`)
  const { error: recordError } = await ctx.supabase.from("attendance_records").insert(attendanceRecords)

  if (recordError) {
    console.error("Record insertion error:", recordError)
    return `Failed to record attendance: ${recordError.message}`
  }

  const presentCount = data.type === "presentees" ? data.rollNumbers.length : students.length - data.rollNumbers.length
  const absentCount = students.length - presentCount

  return `✅ Attendance recorded successfully!

Class: ${data.className}
Date: ${data.date}
Time: ${data.startTime} to ${data.endTime}
Periods: ${totalPeriods}
Subject: ${data.subject || 'Not specified'}

Present: ${presentCount} students (${totalPeriods} periods each)
Absent: ${absentCount} students`
}
export async function handleAttendanceFetch(ctx: RouteHandlerContext): Promise<string> {
  const data = ctx.geminiResponse.data as { className?: string; percentage?: number; format?: string }

  // Get class
  const { data: classData } = await ctx.supabase
    .from("classes")
    .select("id, name")
    .eq("faculty_id", ctx.facultyId)
    .ilike("name", `%${data.className}%`)
    .single()

  if (!classData) {
    // EDGE CASE: Class doesn't exist yet
    // Return empty CSV with 0 records instead of error
    ctx.geminiResponse.data.studentStats = []
    ctx.geminiResponse.data.className = data.className
    ctx.geminiResponse.data.classId = null
    ctx.geminiResponse.data.edgeCaseReason = "class_not_found"
    return "document"
  }

  // Get students with attendance
  const { data: students } = await ctx.supabase
    .from("students")
    .select("id, register_number, name")
    .eq("class_id", classData.id)
    .eq("faculty_id", ctx.facultyId) // CRITICAL: Filter by faculty_id

  if (!students || students.length === 0) {
    // EDGE CASE: Class exists but no students yet
    // Return empty CSV with 0 records instead of error
    ctx.geminiResponse.data.studentStats = []
    ctx.geminiResponse.data.className = classData.name
    ctx.geminiResponse.data.classId = classData.id
    ctx.geminiResponse.data.edgeCaseReason = "no_students"
    return "document"
  }

  const studentStats = []

  for (const student of students) {
    // Get all attendance records with session details for THIS FACULTY ONLY
    const { data: records } = await ctx.supabase
      .from("attendance_records")
      .select(`
        *,
        attendance_sessions!inner(total_periods, faculty_id, class_id)
      `)
      .eq("student_id", student.id)
      .eq("attendance_sessions.class_id", classData.id)
      .eq("attendance_sessions.faculty_id", ctx.facultyId) // CRITICAL: Filter by faculty_id

    // Calculate total periods offered and periods attended
    let totalPeriodsOffered = 0
    let periodsAttended = 0

    if (records && records.length > 0) {
      records.forEach((record: any) => {
        const sessionPeriods = record.attendance_sessions?.total_periods || 1
        totalPeriodsOffered += sessionPeriods
        
        if (record.is_present) {
          periodsAttended += record.periods_present || sessionPeriods
        }
      })
    }

    const percentage = totalPeriodsOffered > 0 
      ? Math.round((periodsAttended / totalPeriodsOffered) * 100) 
      : 0

    // If percentage filter is specified, only include students below that percentage
    // If no percentage filter, include all students
    if (data.percentage === undefined || data.percentage === null) {
      // Show all students
      studentStats.push({
        registerNumber: student.register_number,
        name: student.name,
        percentage,
        periodsAttended,
        totalPeriods: totalPeriodsOffered,
      })
    } else if (percentage < data.percentage) {
      // Show only students below the specified percentage
      studentStats.push({
        registerNumber: student.register_number,
        name: student.name,
        percentage,
        periodsAttended,
        totalPeriods: totalPeriodsOffered,
      })
    }
  }

  // EDGE CASE: No students match the percentage criteria
  // Instead of error, return CSV with all students (let them see who doesn't meet criteria)
  if (studentStats.length === 0 && data.percentage !== undefined && data.percentage !== null) {
    // Fetch all students again for the report
    const { data: allStudents } = await ctx.supabase
      .from("students")
      .select("id, register_number, name")
      .eq("class_id", classData.id)
      .eq("faculty_id", ctx.facultyId)

    const allStudentStats = []
    for (const student of allStudents || []) {
      const { data: records } = await ctx.supabase
        .from("attendance_records")
        .select(`
          *,
          attendance_sessions!inner(total_periods, faculty_id, class_id)
        `)
        .eq("student_id", student.id)
        .eq("attendance_sessions.class_id", classData.id)
        .eq("attendance_sessions.faculty_id", ctx.facultyId)

      let totalPeriodsOffered = 0
      let periodsAttended = 0

      if (records && records.length > 0) {
        records.forEach((record: any) => {
          const sessionPeriods = record.attendance_sessions?.total_periods || 1
          totalPeriodsOffered += sessionPeriods
          
          if (record.is_present) {
            periodsAttended += record.periods_present || sessionPeriods
          }
        })
      }

      const percentage = totalPeriodsOffered > 0 
        ? Math.round((periodsAttended / totalPeriodsOffered) * 100) 
        : 0

      allStudentStats.push({
        registerNumber: student.register_number,
        name: student.name,
        percentage,
        periodsAttended,
        totalPeriods: totalPeriodsOffered,
      })
    }

    allStudentStats.sort((a, b) => a.percentage - b.percentage)
    ctx.geminiResponse.data.studentStats = allStudentStats
    ctx.geminiResponse.data.classId = classData.id
    ctx.geminiResponse.data.className = classData.name
    ctx.geminiResponse.data.edgeCaseReason = "no_students_below_percentage"
    return "document"
  }

  // Sort by percentage
  studentStats.sort((a, b) => a.percentage - b.percentage)

  // Always return "document" - always send as CSV

  // Store stats in context for document generation in main webhook
  ctx.geminiResponse.data.studentStats = studentStats
  ctx.geminiResponse.data.classId = classData.id
  ctx.geminiResponse.data.className = classData.name
  return "document"
}

export async function handleEditAttendance(ctx: RouteHandlerContext): Promise<string> {
  const data = ctx.geminiResponse.data as {
    className: string
    date: string
    startTime: string
    endTime: string
    subject: string
    type: "absentees" | "presentees"
    rollNumbers: string[]
    confirmed?: boolean
  }

  // Check if user confirmed the edit
  if (!data.confirmed) {
    return `⚠️ Confirmation required to edit attendance!

You are about to edit attendance for ${data.className} on ${data.date} from ${data.startTime} to ${data.endTime}.

To confirm the edit, reply:
"Confirm edit attendance for ${data.className} on ${data.date} - ${data.type}: ${data.rollNumbers.join(", ")}"`
  }

  // Validate required fields
  if (!data.className || !data.date || !data.startTime || !data.endTime) {
    return "Missing required information to edit attendance."
  }

  // Get class
  const { data: classData } = await ctx.supabase
    .from("classes")
    .select("id")
    .eq("faculty_id", ctx.facultyId)
    .eq("name", data.className)
    .single()

  if (!classData) {
    return `Class "${data.className}" not found.`
  }

  // Find the existing session
  const { data: session } = await ctx.supabase
    .from("attendance_sessions")
    .select("id")
    .eq("class_id", classData.id)
    .eq("faculty_id", ctx.facultyId) // CRITICAL: Filter by faculty_id
    .eq("date", data.date)
    .eq("start_time", data.startTime)
    .eq("end_time", data.endTime)
    .single()

  if (!session) {
    return `No attendance record found for ${data.className} on ${data.date} from ${data.startTime} to ${data.endTime}.`
  }

  // Get all students
  const { data: students } = await ctx.supabase
    .from("students")
    .select("id, register_number")
    .eq("class_id", classData.id)
    .eq("faculty_id", ctx.facultyId) // CRITICAL: Filter by faculty_id

  if (!students || students.length === 0) {
    return "No students found in this class."
  }

  // Delete existing records for this session
  const { error: deleteError } = await ctx.supabase
    .from("attendance_records")
    .delete()
    .eq("session_id", session.id)

  if (deleteError) {
    console.error("Error deleting old attendance records:", deleteError)
    return "Failed to update attendance. Please try again."
  }

  // Create new attendance records
  const attendanceRecords = students.map((student: any) => {
    const isPresent = data.type === "presentees"
      ? data.rollNumbers.includes(student.register_number)
      : !data.rollNumbers.includes(student.register_number)

    return {
      session_id: session.id,
      student_id: student.id,
      is_present: isPresent,
    }
  })

  const { error: recordError } = await ctx.supabase.from("attendance_records").insert(attendanceRecords)

  if (recordError) {
    console.error("Record insertion error:", recordError)
    return `Failed to update attendance: ${recordError.message}`
  }

  const presentCount = data.type === "presentees" ? data.rollNumbers.length : students.length - data.rollNumbers.length
  const absentCount = students.length - presentCount

  return `✅ Attendance updated successfully!

Class: ${data.className}
Date: ${data.date}
Time: ${data.startTime} to ${data.endTime}
Subject: ${data.subject || 'Not specified'}

Present: ${presentCount} students
Absent: ${absentCount} students`
}

export async function handleHelp(): Promise<string> {
  return `*📱 WhatsApp Attendance System - Help Guide*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*🎓 CLASS MANAGEMENT*

*Create Class:*
• "Create class 3/4 CSIT"
• "New class CSE-A"

*Upload Students:*
• Send Excel file (.xlsx/.xls) with columns:
  - Register Number (required)
  - Name (required)
  - WhatsApp Number (optional)
  - Parent WhatsApp Number (optional)
• System auto-processes and adds all students

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*✅ MARK ATTENDANCE*

*Format:*
Date, Start-End Time, Class, Subject, Type: Roll Numbers

*Examples:*
"08-12-2025, 9.00am - 10.30am, 3/4CSIT, OOAD, Absentees: 23B91A0738, 27, 28"

"09-12-2025, 1.30pm - 4.30pm, CSE-A, Data Structures, Presentees: 1, 5, 12"

*No Absentees/Presentees:*
"08-12-2025, 9am - 12pm, 3/4CSIT, OOAD, Absentees: no absentees"
(Marks everyone present)

*Roll Number Shorthand:*
Same prefix? Just write last digits!
• "23B91A0738, 27, 28" → 738, 727, 728
• New prefix? New line:
  "23B91A0738, 27
   24B91A0714" → 738, 727, 714

*Period Calculation:*
45 minutes = 1 period
• 9:00-10:30 = 2 periods
• 9:00-12:00 = 4 periods
• 1:30-4:30 = 4 periods

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*✏️ EDIT ATTENDANCE*

*Modify Existing Record:*
"Edit attendance for 3/4CSIT on 08-12-2025 from 9am to 10.30am - Absentees: 23B91A0738, 40"

• System asks for confirmation
• Reply with same format to confirm
• Updates existing session

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📊 VIEW ATTENDANCE REPORTS*

*Get CSV Report:*
• "Show attendance for 3/4CSIT"
• "Get attendance for CSE-A"
• "Attendance report for 2/4 ECE"

*Filtered Reports (Below X%):*
• "Students below 75% in 3/4CSIT"
• "Show students below 80% in CSE-A"

*Report Format:*
All reports sent as CSV files with columns:
- Roll No, Name, Periods Present, Periods Absent, Attendance %
- Includes: Total/Average at bottom

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*💡 TIPS & FEATURES*

✓ Natural Language: Talk normally!
✓ Date Formats: DD-MM-YYYY, DD/MM/YYYY accepted
✓ Time Formats: 9am, 9.00am, 09:00 all work
✓ Duplicate Prevention: Can't mark same session twice
✓ Auto CSV Cleanup: Old reports deleted automatically
✓ Multiple Classes: Same class name OK for different faculties
✓ 5 API Keys: Load balanced for high availability

*Example Conversations:*
"Hi" → System greets you
"Create class 3/4CSIT" → Class created
[Send Excel file] → Students added automatically
"08-12-2025, 9am-12pm, 3/4CSIT, OOAD, Absentees: none" → Marked
"Show attendance for 3/4CSIT" → CSV report sent

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*Need Help?*
Just type "/help" anytime!

System powered by AI - understands your messages naturally! 🤖✨`
}

export async function handleCreateStudents(ctx: RouteHandlerContext): Promise<string> {
  const data = ctx.geminiResponse.data as {
    classId?: string
    className?: string
    students?: Array<{
      registerNumber: string
      name: string
      whatsappNumber?: string
      parentWhatsappNumber?: string
    }>
  }

  if (!data.students || data.students.length === 0) {
    return "No student data found. Please send an Excel file with student information."
  }

  // Get class by name or ID
  let classData
  if (data.classId) {
    const { data: cls } = await ctx.supabase
      .from("classes")
      .select("id, name")
      .eq("id", data.classId)
      .single()
    classData = cls
  } else if (data.className) {
    const { data: cls } = await ctx.supabase
      .from("classes")
      .select("id, name")
      .eq("faculty_id", ctx.facultyId)
      .ilike("name", `%${data.className}%`)
      .single()
    classData = cls
  }

  if (!classData) {
    return "Class not found. Please create the class first."
  }

  // Insert students
  const studentsToInsert = data.students.map((s) => ({
    register_number: s.registerNumber,
    name: s.name,
    whatsapp_number: s.whatsappNumber,
    parent_whatsapp_number: s.parentWhatsappNumber,
    class_id: classData.id,
    faculty_id: ctx.facultyId, // Link student to faculty
  }))

  const { error, data: inserted } = await ctx.supabase
    .from("students")
    .insert(studentsToInsert)
    .select()

  if (error) {
    console.error("Error inserting students:", error)
    return `Failed to add students. Error: ${error.message}`
  }

  return `✅ Successfully added ${inserted?.length || 0} students to class "${classData.name}"!`
}

// handleAddStudent function removed - use bulk upload via Excel instead
