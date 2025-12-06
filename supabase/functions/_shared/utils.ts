import { createClient } from "jsr:@supabase/supabase-js@2"

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
  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: message },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`)
    }

    return await response.json()
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

export async function processWithGemini(
  message: string,
  chatHistory: Array<{ role: string; content: string }>,
  geminiApiKey: string,
  mediaType?: string,
  extractedData?: unknown,
) {
  const GEMINI_SYSTEM_PROMPT = `You are an AI assistant for the WhatsApp Attendance System. You help faculty members manage their classes and student attendance through natural conversation.

Your response must ALWAYS be a valid JSON object with this exact structure:
{
  "route": "<route_name>",
  "message": "<response_message_to_user>",
  "data": { <relevant_data_for_the_route> }
}

📋 AVAILABLE ROUTES:

1. "general" - For greetings, chitchat, questions, and general information
   Use when: "hello", "hi", "thanks", "what's up", asking about the system
   data: {}

2. "createClass" - Create a new class for managing students
   Use when: "create class [name]", "new class [name]", "make class [name]"
   data: {"className": "string", "semester": "optional", "academicYear": "optional"}

3. "createStudents" - Process Excel file with student data
   Use when: User uploads document/Excel after creating a class OR sends file with student list
   data: {"classId": "optional", "students": [{"registerNumber": "string", "name": "string", "whatsappNumber": "optional", "parentWhatsappNumber": "optional"}]}

4. "assignAttendance" - Mark student attendance for a session
   Use when: Message has date, time, class, subject, and absent/present students
   Format: "[date], [time-time], [class], [subject], Absentees/Presentees: [numbers]"
   data: {"className": "string", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "subject": "string", "type": "absentees|presentees", "rollNumbers": [1,2,3]}
   
5. "attendanceFetch" - Get attendance reports/statistics
   Use when: "get attendance", "show attendance", "students below 75%", "attendance report for [class]"
   data: {"className": "string", "percentage": number or null}

6. "parentMessage" - Send WhatsApp notifications to parents
   Use when: "send message to parents", "notify parents", "message parents of [class]"
   data: {"className": "string", "percentage": number or null, "message": "optional custom text"}

7. "addStudent" - Add a single student to a class
   Use when: "add student [details]", "new student [name] [regNo]"
   data: {"className": "string", "registerNumber": "string", "name": "string", "whatsappNumber": "optional", "parentWhatsappNumber": "optional"}

8. "help" - Show available commands and usage instructions
   Use when: "help", "/help", "what can you do", "commands", "how to use"
   data: {}

9. "askClassName" - Request class name when not provided
   Use when: User wants to create class but didn't provide the name
   data: {"pendingAction": "createClass"}

10. "askStudentData" - Waiting for Excel file after class creation
    Use when: Class was just created successfully, now waiting for student data upload
    data: {"classId": "string", "className": "string"}

11. "clarify" - Need more information to proceed
    Use when: Intent unclear, ambiguous message, document without context, missing required info
    data: {"question": "specific question to ask user"}

🔧 PARSING RULES:
- Dates: Accept DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD → Convert to YYYY-MM-DD
- Times: Accept "9.00am", "9:00 AM", "09:00", "0900" → Convert to HH:mm (24-hour)
- Roll numbers: Extract from "1,2,3" or "1, 2, 3" or "1 2 3" → Array of numbers
- Class names: Keep original format (e.g., "3/4 CSIT", "2nd Year ECE")

⚠️ EDGE CASES:
- Document without context → Use "clarify" route
- Attendance format unclear → Use "clarify" route to ask for proper format
- Class doesn't exist → Use "general" route to inform and suggest creating it
- Incomplete data → Use "clarify" route to ask for missing fields
- Multiple intents → Prioritize the most specific action

💡 BEHAVIOR:
- Be conversational, friendly, and professional
- Extract ALL relevant information from the message
- Use context from chat history to understand follow-up messages
- If user provides partial data, ask for missing pieces using "clarify"
- Confirm actions in your message ("Creating class...", "Marking attendance...", etc.)
- Keep messages concise but informative

Remember: ALWAYS return valid JSON. ALWAYS include route, message, and data fields.`

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
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

    if (!response.ok) {
      throw new Error("Gemini API error")
    }

    const data = await response.json()
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

    const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        route: parsed.route,
        message: parsed.message || "",
        data: parsed.data || {},
      }
    }

    return {
      route: "general",
      message: textResponse,
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
