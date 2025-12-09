import { createClient } from "jsr:@supabase/supabase-js@2"
import * as XLSX from "https://esm.sh/xlsx@0.18.5"

export interface SupabaseClientOptions {
  supabaseUrl: string
  supabaseKey: string
}

export function createSupabaseClient({ supabaseUrl, supabaseKey }: SupabaseClientOptions) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export interface WhatsAppMessage {
  to: string
  message: string
}

export async function sendWhatsAppMessage(
  { to, message }: WhatsAppMessage,
  accessToken: string,
  phoneNumberId: string,
) {
  console.log("=== SENDING WHATSAPP MESSAGE ===")
  console.log("To:", to)
  console.log("Message:", message)
  console.log("Phone Number ID:", phoneNumberId)
  console.log("Access Token exists:", !!accessToken)
  
  // Validate message is not empty
  if (!message || message.trim() === "") {
    console.error("Attempted to send empty message, using fallback")
    message = "I received your message. Please try again."
  }
  
  try {
    // Use v22.0 API (v17.0 is deprecated)
    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`
    console.log("API URL:", url)
    
    const body = {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: message },
    }
    console.log("Request body:", JSON.stringify(body))
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    console.log("Response status:", response.status)
    const responseText = await response.text()
    console.log("Response body:", responseText)

    if (!response.ok) {
      const error = JSON.parse(responseText)
      console.error("WhatsApp API error:", error)
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`)
    }

    return JSON.parse(responseText)
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    throw error
  }
}

export async function downloadWhatsAppMedia(mediaId: string, accessToken: string): Promise<ArrayBuffer> {
  try {
    // Get media URL
    const urlResponse = await fetch(`https://graph.facebook.com/v17.0/${mediaId}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    })

    if (!urlResponse.ok) {
      throw new Error("Failed to get media URL")
    }

    const urlData = await urlResponse.json()
    const mediaUrl = urlData.url

    // Download media
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    })

    if (!mediaResponse.ok) {
      throw new Error("Failed to download media")
    }

    return await mediaResponse.arrayBuffer()
  } catch (error) {
    console.error("Error downloading WhatsApp media:", error)
    throw error
  }
}

export async function parseExcelFile(buffer: ArrayBuffer): Promise<any[]> {
  try {
    console.log("=== PARSING EXCEL FILE ===")
    console.log("Buffer size:", buffer.byteLength)
    
    // Convert ArrayBuffer to Uint8Array
    const data = new Uint8Array(buffer)
    
    // Read the workbook
    const workbook = XLSX.read(data, { type: "array" })
    console.log("Workbook sheets:", workbook.SheetNames)
    
    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,  // Use array of arrays format
      defval: ""  // Default value for empty cells
    })
    
    console.log("Total rows:", jsonData.length)
    console.log("First 3 rows:", JSON.stringify(jsonData.slice(0, 3)))
    
    // Assume first row is header
    const headers = jsonData[0] as string[]
    const rows = jsonData.slice(1)
    
    // Convert to objects
    const students = rows.map((row: any[]) => {
      const student: any = {}
      headers.forEach((header, index) => {
        // Normalize header names
        const normalizedHeader = header.toString().toLowerCase().trim()
        student[normalizedHeader] = row[index] || ""
      })
      return student
    }).filter(student => {
      // Filter out empty rows
      return Object.values(student).some(val => val !== "")
    })
    
    console.log("Parsed students count:", students.length)
    console.log("Sample student:", students[0] ? JSON.stringify(students[0]) : "none")
    
    return students
  } catch (error) {
    console.error("Error parsing Excel file:", error)
    throw error
  }
}

export async function processWithGemini(
  message: string,
  chatHistory: Array<{ role: string; content: string }>,
  geminiApiKey: string,
  mediaType?: string,
  extractedData?: unknown,
  geminiApiKeys?: string[], // Array of all API keys
) {
  // Default API keys array (will be overridden if geminiApiKeys is provided)
  const allApiKeys = geminiApiKeys || [geminiApiKey]
  
  const GEMINI_SYSTEM_PROMPT = `You are an AI assistant for the WhatsApp Attendance System. You help faculty manage classes and attendance.

Response format (ALWAYS valid JSON):
{
  "route": "<route_name>",
  "message": "<response_to_user>",
  "data": { <route_data> }
}

🚨 CRITICAL: ATTENDANCE PERCENTAGE RULES (READ FIRST):
- DEFAULT: percentage = null (shows ALL students)
- ONLY set percentage = number if CURRENT message has "below X%" or "less than X%"
- IGNORE chat history for percentage - analyze ONLY current message
- Examples:
  ✅ "show attendance for 3/4CSIT" → percentage: null
  ✅ "get attendance CSE-A" → percentage: null
  ❌ "students below 75% in 3/4CSIT" → percentage: 75

📋 ROUTES:

1. "general" - Greetings, chitchat, questions
   data: {}

2. "createClass" - Create new class
   data: {"className": "string", "semester": "optional", "academicYear": "optional"}

3. "createStudents" - Process Excel with student data
   Use when: User uploads Excel/document file OR extracted student data is available
   IMPORTANT: Check if extractedData contains students array - if yes, use this route
   data: {"classId": "optional", "className": "optional", "students": [{"registerNumber": "string", "name": "string", "whatsappNumber": "optional", "parentWhatsappNumber": "optional"}]}

4. "assignAttendance" - Mark attendance for session
   Format: "[date], [time-time], [class], [subject], Absentees/Presentees: [numbers]"
   data: {"className": "string", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "subject": "string", "type": "absentees|presentees", "rollNumbers": ["string"]}
   
   IMPORTANT - Handling "no absentees" or "no presentees":
   - If user says "no absentees", "no one absent", "all present" → type: "absentees", rollNumbers: []
   - If user says "no presentees", "no one present", "all absent" → type: "presentees", rollNumbers: []
   - Empty rollNumbers array means: if type="absentees" then everyone was present, if type="presentees" then everyone was absent
   
   Examples:
   ✅ "Absentees: no absentees" → type: "absentees", rollNumbers: []
   ✅ "Presentees: all present" → type: "presentees", rollNumbers: []
   ✅ "Absentees: none" → type: "absentees", rollNumbers: []
   
   Note: Blocked if duplicate session exists - must use editAttendance instead

5. "editAttendance" - Edit existing attendance
   data: {"className": "string", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "type": "absentees|presentees", "rollNumbers": ["string"], "confirmed": false}
   First ask confirmation (confirmed: false), then edit (confirmed: true)

6. "attendanceFetch" - Get attendance reports
   Use when: "show attendance", "get attendance", "students below X%"
   data: {"className": "string", "percentage": null or number, "format": "csv" or "excel" or null}
   
   Percentage rules (CRITICAL):
   - NULL = Show all students (default for "show attendance", "get attendance", "attendance report")
   - NUMBER = Filter below X% (only if current message says "below X%" or "less than X%")
   - IGNORE chat history - each request is independent
   
   Format: Set "csv" or "excel" if user says "send file", "download", "export"

7. "parentMessage" - Send notifications to parents
   data: {"className": "string", "percentage": number or null, "message": "optional"}

8. "addStudent" - Add single student
   data: {"className": "string", "registerNumber": "string", "name": "string", "whatsappNumber": "optional", "parentWhatsappNumber": "optional"}

9. "help" - Show commands
   data: {}

10. "askClassName" - Request class name
    data: {"pendingAction": "createClass"}

11. "askStudentData" - Waiting for Excel after class creation
    data: {"classId": "string", "className": "string"}

12. "clarify" - Need more info
    data: {"question": "specific question"}

🔧 PARSING:
- Dates: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD → YYYY-MM-DD
- Times: "9.00am", "9:00 AM", "09:00" → HH:mm (24-hour)
- Roll shorthand: 
  * "23B91A0738, 27" → ["23B91A0738", "23B91A0727"]
  * "23B91A0738, 27, 24B91A0714" → ["23B91A0738", "23B91A0727", "24B91A0714"]
- Class names: Keep original format

⚠️ EDGE CASES:
- Missing data → "clarify" route
- Class doesn't exist → "general" route to inform
- Excel file uploaded → Check [Extracted data] in message for students array → Use "createStudents" route
- Document with students → ALWAYS use "createStudents" route if extractedData contains students field

💡 IMPORTANT - DOCUMENT HANDLING:
If you see "[Extracted data: {... students: [...]}]" in the message:
→ Use "createStudents" route
→ Copy the students array from extractedData to your response data
→ Ask for class name if not provided

💡 BEHAVIOR:
- Be conversational and professional
- Extract all relevant information
- Use chat history for context (but NOT for percentage in attendanceFetch)
- Confirm actions in messages

Example:
"08-12-2025, 9.00am - 10.30am, 3/4CSIT, OOAD, Absentees: 23B91A0738, 27"
→ {"className": "3/4CSIT", "date": "2025-12-08", "startTime": "09:00", "endTime": "10:30", "subject": "OOAD", "type": "absentees", "rollNumbers": ["23B91A0738", "23B91A0727"]}

ALWAYS return valid JSON with route, message, and data fields.`

  try {
    let contextMessage = message
    if (mediaType) {
      contextMessage += `\n[User sent a ${mediaType} file]`
    }
    if (extractedData) {
      contextMessage += `\n[Extracted data: ${JSON.stringify(extractedData)}]`
    }

    const messages = [
      {
        role: "user",
        parts: [{ text: GEMINI_SYSTEM_PROMPT }],
      },
      {
        role: "model",
        parts: [{ text: "Understood. I will analyze messages and respond with JSON." }],
      },
      ...chatHistory.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
      {
        role: "user",
        parts: [{ text: contextMessage }],
      },
    ]

    console.log("=== CALLING GEMINI API ===")
    console.log(`Available API keys: ${allApiKeys.length}`)
    console.log("Message to process:", contextMessage)
    
    // FALLBACK STRATEGY: Try 2.5-flash with all 5 API keys, then 2.0-flash with all 5 API keys
    
    let response: Response | null = null
    
    // Phase 1: Try gemini-2.5-flash with all API keys
    for (let i = 0; i < allApiKeys.length; i++) {
      const apiKey = allApiKeys[i]
      console.log(`[2.5-flash] Trying API key ${i + 1}/${allApiKeys.length}`)
      
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: messages,
            generationConfig: {
              temperature: 0.1,
              topK: 1,
              topP: 1,
              maxOutputTokens: 2048,
            },
          }),
        },
      )

      console.log(`[2.5-flash] API key ${i + 1} response status: ${response.status}`)
      
      if (response.ok) {
        console.log(`✅ Success with 2.5-flash using API key ${i + 1}`)
        break
      } else if (response.status !== 429 && response.status !== 404) {
        // If error is not quota/not found, stop trying
        console.log(`❌ Non-quota error (${response.status}), stopping attempts`)
        break
      }
    }
    
    // Phase 2: If all 2.5-flash attempts failed, try 2.0-flash with all API keys
    if (!response || (!response.ok && (response.status === 429 || response.status === 404))) {
      console.log("All 2.5-flash API keys exhausted, switching to 2.0-flash")
      
      for (let i = 0; i < allApiKeys.length; i++) {
        const apiKey = allApiKeys[i]
        console.log(`[2.0-flash] Trying API key ${i + 1}/${allApiKeys.length}`)
        
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: messages,
              generationConfig: {
                temperature: 0.1,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
              },
            }),
          },
        )

        console.log(`[2.0-flash] API key ${i + 1} response status: ${response.status}`)
        
        if (response.ok) {
          console.log(`✅ Success with 2.0-flash using API key ${i + 1}`)
          break
        } else if (response.status !== 429 && response.status !== 404) {
          console.log(`❌ Non-quota error (${response.status}), stopping attempts`)
          break
        }
      }
    }
    
    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "No response"
      console.error("Gemini API error response:", errorText)
      console.error(`All ${allApiKeys.length * 2} fallback attempts exhausted (5 keys × 2 models)`)
      throw new Error(`Gemini API error: ${response?.status || 'unknown'} - ${errorText}`)
    }

    const data = await response.json()
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

    const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const responseMessage = parsed.message || textResponse || "I received your message. How can I help you?"
      return {
        route: parsed.route || "general",
        message: responseMessage,
        data: parsed.data || {},
      }
    }

    return {
      route: "general",
      message: textResponse || "I'm ready to help you with attendance management. What would you like to do?",
      data: {},
    }
  } catch (error) {
    console.error("Gemini processing error:", error)
    return {
      route: "general",
      message: "I apologize, but I encountered an error. Please try again.",
      data: {},
    }
  }
}

// Generate CSV content from attendance data
export function generateAttendanceCSV(
  className: string,
  studentStats: Array<{
    registerNumber: string
    name: string
    percentage: number
    periodsAttended: number
    totalPeriods: number
  }>,
): string {
  const headers = ["Register Number", "Name", "Attendance %", "Periods Attended", "Total Periods"]
  
  // Calculate column widths for better formatting
  const colWidths = [18, 30, 15, 18, 15]
  
  // Format header row
  const headerRow = headers
    .map((h, i) => h.padEnd(colWidths[i]))
    .join(" | ")
  
  // Format separator
  const separator = colWidths.map(w => "-".repeat(w)).join("-+-")
  
  // Format data rows
  const dataRows = studentStats.map((s) => {
    const row = [
      s.registerNumber.padEnd(colWidths[0]),
      s.name.substring(0, 28).padEnd(colWidths[1]),
      `${s.percentage}%`.padEnd(colWidths[2]),
      `${s.periodsAttended}/${s.totalPeriods}`.padEnd(colWidths[3]),
      s.totalPeriods.toString().padEnd(colWidths[4]),
    ]
    return row.join(" | ")
  })

  const csvContent = [
    `Attendance Report - ${className}`,
    `Generated on: ${new Date().toLocaleString()}`,
    ``,
    headerRow,
    separator,
    ...dataRows,
    separator,
    `Total Students: ${studentStats.length}`,
    `Average Attendance: ${Math.round(studentStats.reduce((sum, s) => sum + s.percentage, 0) / studentStats.length)}%`,
  ].join("\n")

  return csvContent
}

// Upload file to Supabase storage and return public URL
export async function uploadAttendanceReport(
  supabase: any,
  fileName: string,
  fileContent: string,
  contentType: string = "text/csv",
): Promise<string | null> {
  try {
    const bucket = "attendance-reports"
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("Z")[0] // Format: 2025-12-09T11-10-27-148
    const uniqueFileName = `${timestamp}-${fileName}`
    const path = `${uniqueFileName}`

    // Check if bucket exists, if not create it
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucketExists = buckets?.some((b: any) => b.name === bucket)

    if (!bucketExists) {
      console.log("Creating bucket:", bucket)
      await supabase.storage.createBucket(bucket, { public: true })
    }

    console.log("Uploading file:", uniqueFileName)
    const { error } = await supabase.storage.from(bucket).upload(path, fileContent, {
      contentType,
      upsert: true,
    })

    if (error) {
      console.error("Upload error:", error)
      return null
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    console.log("File uploaded successfully:", publicUrl.publicUrl)
    return publicUrl.publicUrl
  } catch (error) {
    console.error("Error uploading report:", error)
    return null
  }
}

// Clean up old attendance report files (delete all files)
export async function cleanupOldReports(
  supabase: any,
): Promise<void> {
  try {
    const bucket = "attendance-reports"
    
    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucketExists = buckets?.some((b: any) => b.name === bucket)
    
    if (!bucketExists) {
      console.log("Bucket does not exist, skipping cleanup")
      return
    }

    // Recursive function to list all files and folders
    async function listAllFiles(path = ""): Promise<string[]> {
      const { data: items, error: listError } = await supabase.storage
        .from(bucket)
        .list(path, {
          limit: 1000,
          offset: 0,
        })

      if (listError) {
        console.error(`Error listing path ${path}:`, listError)
        return []
      }

      const allPaths: string[] = []

      for (const item of items || []) {
        const itemPath = path ? `${path}/${item.name}` : item.name
        
        // If it's a folder (has id property but no metadata), recurse into it
        if (item.id === null || item.metadata === null) {
          // It's a folder, get its contents
          const subItems = await listAllFiles(itemPath)
          allPaths.push(...subItems)
        } else {
          // It's a file
          allPaths.push(itemPath)
        }
      }

      return allPaths
    }

    // Get all files recursively
    console.log("Scanning bucket for all files and folders...")
    const allFiles = await listAllFiles()
    
    console.log(`Found ${allFiles.length} files to delete`)

    // Delete all files
    if (allFiles.length > 0) {
      // Delete in batches of 100 (Supabase limit)
      const batchSize = 100
      for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize)
        console.log(`Deleting batch ${Math.floor(i / batchSize) + 1}: ${batch.length} files`)
        
        const { error: deleteError } = await supabase.storage
          .from(bucket)
          .remove(batch)
        
        if (deleteError) {
          console.error(`Error deleting batch:`, deleteError)
        } else {
          console.log(`Successfully deleted ${batch.length} files`)
        }
      }
      
      console.log(`Cleanup complete: deleted ${allFiles.length} files total`)
    } else {
      console.log("No files to delete")
    }
  } catch (error) {
    console.error("Error cleaning up reports:", error)
    // Don't throw - cleanup failure shouldn't block the main operation
  }
}

// Generate unique filename with timestamp and random ID
export function generateUniqueFileName(className: string): string {
  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, "-").split("-").slice(0, -1).join("-") // Format: 2025-12-09T11-10-27
  const randomId = Math.random().toString(36).substring(2, 8).toUpperCase() // Random 6-char ID
  return `${timestamp}-${randomId}-${className.replace(/\//g, "-").replace(/\s+/g, "_")}-attendance.csv`
}

// Send document via WhatsApp (media message)
export async function sendWhatsAppDocument(
  { to, documentUrl, caption }: { to: string; documentUrl: string; caption: string },
  accessToken: string,
  phoneNumberId: string,
) {
  console.log("=== SENDING WHATSAPP DOCUMENT ===")
  console.log("To:", to)
  console.log("Document URL:", documentUrl)
  console.log("Caption:", caption)

  try {
    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`
    const body = {
      messaging_product: "whatsapp",
      to: to,
      type: "document",
      document: {
        link: documentUrl,
        caption: caption,
      },
    }

    console.log("Request body:", JSON.stringify(body))

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })

    const responseData = await response.json()
    console.log("WhatsApp API response:", responseData)

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`)
    }

    return responseData
  } catch (error) {
    console.error("Error sending WhatsApp document:", error)
    throw error
  }
}

// Send CSV as text file via WhatsApp using document type with base64
export async function sendWhatsAppCSVAsDocument(
  { to, csvContent, fileName, caption }: { to: string; csvContent: string; fileName: string; caption: string },
  accessToken: string,
  phoneNumberId: string,
) {
  console.log("=== SENDING CSV AS WHATSAPP DOCUMENT ===")
  console.log("To:", to)
  console.log("File name:", fileName)
  console.log("CSV size:", csvContent.length, "bytes")

  try {
    // Create a data URL for the CSV file
    const encoder = new TextEncoder()
    const csvBytes = encoder.encode(csvContent)
    
    // Convert to base64
    let binaryString = ""
    for (let i = 0; i < csvBytes.length; i++) {
      binaryString += String.fromCharCode(csvBytes[i])
    }
    const base64Content = btoa(binaryString)
    
    // Create data URL
    const dataUrl = `data:text/csv;base64,${base64Content}`
    
    console.log("Data URL created, length:", dataUrl.length)
    
    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`
    
    // Try sending as document with data URL
    const body = {
      messaging_product: "whatsapp",
      to: to,
      type: "document",
      document: {
        link: dataUrl,
        caption: caption,
        filename: fileName,
      },
    }

    console.log("Sending document request with data URL")

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })

    const responseData = await response.json()
    console.log("WhatsApp API response:", responseData)

    if (!response.ok) {
      console.error("Document send failed, trying alternative method...")
      throw new Error(`WhatsApp API error: ${response.status}`)
    }

    return responseData
  } catch (error) {
    console.error("Error sending CSV as WhatsApp document:", error)
    throw error
  }
}
