import { createBrowserClient } from "@supabase/ssr"
import type { GeminiResponse, GeminiRoute } from "@/lib/database"

// Create Supabase client for browser
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// WhatsApp API functions
interface SendWhatsAppMessageParams {
  to: string
  message: string
}

export async function sendWhatsAppMessage({ to, message }: SendWhatsAppMessageParams) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) {
    console.error("WhatsApp credentials not configured")
    return { success: false, error: "WhatsApp not configured" }
  }

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

    const data = await response.json()

    if (!response.ok) {
      console.error("WhatsApp API error:", data)
      return { success: false, error: data.error?.message || "Failed to send message" }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    return { success: false, error: "Network error" }
  }
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error("WhatsApp access token not configured")
  }

  try {
    // First, get the media URL
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

    // Download the actual media
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    })

    if (!mediaResponse.ok) {
      throw new Error("Failed to download media")
    }

    const arrayBuffer = await mediaResponse.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error("Error downloading WhatsApp media:", error)
    throw error
  }
}

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
   Example: User says "Hello" → {"route": "general", "message": "Hello! How can I help you today?", "data": {}}

2. "createClass" - Create a new class for managing students
   Use when: "create class [name]", "new class [name]", "make class [name]"
   data: {"className": "string", "semester": "optional", "academicYear": "optional"}
   Example: "create class 3/4 CSIT" → {"route": "createClass", "message": "Creating class...", "data": {"className": "3/4 CSIT"}}

3. "createStudents" - Process Excel file with student data
   Use when: User uploads document/Excel after creating a class OR sends file with student list
   data: {"classId": "optional", "students": [{"registerNumber": "string", "name": "string", "whatsappNumber": "optional", "parentWhatsappNumber": "optional"}]}
   Example: Excel file uploaded → {"route": "createStudents", "message": "Processing student data...", "data": {"students": [...]}}

4. "assignAttendance" - Mark student attendance for a session
   Use when: Message has date, time, class, subject, and absent/present students
   Format: "[date], [time-time], [class], [subject], Absentees/Presentees: [numbers]"
   data: {"className": "string", "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "subject": "string", "type": "absentees|presentees", "rollNumbers": [1,2,3]}
   Example: "06-12-2025, 9.00am - 12.00pm, 3/4 CSIT, OOAD, Absentees: 1,2,3" → Parse and extract all fields
   
5. "attendanceFetch" - Get attendance reports/statistics
   Use when: "get attendance", "show attendance", "students below 75%", "attendance report for [class]"
   data: {"className": "string", "percentage": number or null}
   Example: "show students below 75% in 3/4 CSIT" → {"route": "attendanceFetch", "data": {"className": "3/4 CSIT", "percentage": 75}}

6. "parentMessage" - Send WhatsApp notifications to parents
   Use when: "send message to parents", "notify parents", "message parents of [class]"
   data: {"className": "string", "percentage": number or null, "message": "optional custom text"}
   Example: "notify parents of students below 75%" → Include threshold in data

7. "addStudent" - Add a single student to a class
   Use when: "add student [details]", "new student [name] [regNo]"
   data: {"className": "string", "registerNumber": "string", "name": "string", "whatsappNumber": "optional", "parentWhatsappNumber": "optional"}
   Example: "add student John, reg no 101, to 3/4 CSIT" → Extract all provided details

8. "help" - Show available commands and usage instructions
   Use when: "help", "/help", "what can you do", "commands", "how to use"
   data: {}

9. "askClassName" - Request class name when not provided
   Use when: User wants to create class but didn't provide the name
   data: {"pendingAction": "createClass"}
   Example: "I want to create a class" (no name) → Ask for class name

10. "askStudentData" - Waiting for Excel file after class creation
    Use when: Class was just created successfully, now waiting for student data upload
    data: {"classId": "string", "className": "string"}

11. "clarify" - Need more information to proceed
    Use when: Intent unclear, ambiguous message, document without context, missing required info
    data: {"question": "specific question to ask user"}
    Example: User sends Excel without context → {"route": "clarify", "message": "What would you like to do with this file?", "data": {"question": "Is this student data for a new or existing class?"}}

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

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ProcessMessageInput {
  message: string
  chatHistory: ChatMessage[]
  mediaType?: string
  extractedData?: unknown
}

export async function processWithGemini({
  message,
  chatHistory,
  mediaType,
  extractedData,
}: ProcessMessageInput): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return {
      route: "general",
      message: "I apologize, but I am currently unavailable. Please try again later.",
    }
  }

  try {
    // Build conversation context
    let contextMessage = message

    if (mediaType) {
      contextMessage += `\n[User sent a ${mediaType} file]`
    }

    if (extractedData) {
      contextMessage += `\n[Extracted data from file: ${JSON.stringify(extractedData)}]`
    }

    // Build the messages array for Gemini
    const messages = [
      {
        role: "user",
        parts: [{ text: GEMINI_SYSTEM_PROMPT }],
      },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I will analyze messages and respond with JSON containing route, message, and data fields.",
          },
        ],
      },
      // Add chat history
      ...chatHistory.flatMap((msg) => [
        {
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        },
      ]),
      // Current message
      {
        role: "user",
        parts: [{ text: contextMessage }],
      },
    ]

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

    const data = await response.json()

    if (!response.ok) {
      console.error("Gemini API error:", data)
      return {
        route: "general",
        message: "I encountered an error processing your request. Please try again.",
      }
    }

    // Extract the text response
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

    // Parse JSON from response
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          route: parsed.route as GeminiRoute,
          message: parsed.message || "",
          data: parsed.data || {},
        }
      } catch {
        // If JSON parsing fails, return as general message
        return {
          route: "general",
          message: textResponse,
        }
      }
    }

    return {
      route: "general",
      message: textResponse,
    }
  } catch (error) {
    console.error("Gemini processing error:", error)
    return {
      route: "general",
      message: "I apologize, but I encountered an error. Please try again.",
    }
  }
}
