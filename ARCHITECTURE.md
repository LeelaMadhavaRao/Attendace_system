# WhatsApp Attendance System - Architecture Overview

## 🏗️ System Architecture

The system now uses **Supabase Edge Functions** for backend processing, providing better scalability, performance, and separation of concerns.

### Architecture Diagram

```
┌─────────────────┐
│  WhatsApp API   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Next.js API Route (Proxy)      │
│  /api/webhook/whatsapp/route.ts │
└────────┬────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Supabase Edge Function (Deno Runtime)   │
│  /functions/whatsapp-webhook/index.ts    │
│                                          │
│  ┌──────────────────────────────┐       │
│  │  Message Processing          │       │
│  │  - Faculty Authentication    │       │
│  │  - Media Handling            │       │
│  │  - Chat History              │       │
│  └──────────────────────────────┘       │
│                                          │
│  ┌──────────────────────────────┐       │
│  │  Gemini AI Integration       │       │
│  │  - Intent Recognition        │       │
│  │  - Route Determination       │       │
│  └──────────────────────────────┘       │
│                                          │
│  ┌──────────────────────────────┐       │
│  │  Route Handlers              │       │
│  │  - Create Class              │       │
│  │  - Add Students              │       │
│  │  - Mark Attendance           │       │
│  │  - Fetch Reports             │       │
│  │  - Parent Messaging          │       │
│  └──────────────────────────────┘       │
└────────┬─────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Supabase DB    │
│  (PostgreSQL)   │
└─────────────────┘
```

## 📁 Project Structure

```
my-app/
├── app/
│   ├── api/
│   │   └── webhook/
│   │       └── whatsapp/
│   │           └── route.ts          # Proxy to Edge Function
│   └── (dashboard)/                  # Admin/Faculty/HOD dashboards
│
├── supabase/
│   ├── functions/
│   │   ├── whatsapp-webhook/         # Main webhook handler
│   │   │   └── index.ts
│   │   ├── route-handlers/           # Business logic handlers
│   │   │   └── index.ts
│   │   ├── _shared/                  # Shared utilities
│   │   │   └── utils.ts
│   │   ├── deno.json                 # Deno configuration
│   │   ├── deploy.sh                 # Deployment script
│   │   ├── DEPLOYMENT.md             # Deployment guide
│   │   └── README.md                 # Functions overview
│   │
│   └── migrations/                   # Database migrations
│       └── ...sql files
│
├── lib/
│   ├── supabase-admin.ts            # Admin client
│   ├── server.ts                     # Server-side client
│   ├── client.ts                     # Browser client + helpers
│   └── ...
│
└── components/                       # React components
```

## 🔄 Request Flow

### 1. **WhatsApp Message Reception**

```
User (WhatsApp) → Meta API → Your Webhook URL
```

### 2. **Next.js API Route (Proxy Layer)**

```typescript
// app/api/webhook/whatsapp/route.ts
export async function POST(request: NextRequest) {
  // Simply forwards request to Edge Function
  const response = await fetch(edgeFunctionUrl, {
    method: "POST",
    headers: { /* auth headers */ },
    body: JSON.stringify(body),
  })
  return NextResponse.json(result)
}
```

**Why Proxy?**
- Provides fallback option
- Easier local development
- Can add middleware/logging
- Maintains existing webhook URL

### 3. **Edge Function Processing**

```typescript
// supabase/functions/whatsapp-webhook/index.ts
Deno.serve(async (req) => {
  // 1. Authenticate faculty by WhatsApp number
  // 2. Download & parse media (Excel files)
  // 3. Get chat history from database
  // 4. Process with Gemini AI
  // 5. Route to appropriate handler
  // 6. Send response via WhatsApp
  // 7. Save chat history
})
```

### 4. **Route Handlers**

```typescript
// supabase/functions/route-handlers/index.ts
export async function handleCreateClass(ctx) { /* ... */ }
export async function handleAssignAttendance(ctx) { /* ... */ }
export async function handleAttendanceFetch(ctx) { /* ... */ }
export async function handleCreateStudents(ctx) { /* ... */ }
export async function handleAddStudent(ctx) { /* ... */ }
export async function handleParentMessage(ctx) { /* ... */ }
export async function handleHelp() { /* ... */ }
```

## 🎯 Available Routes

| Route | Description | Example Message |
|-------|-------------|-----------------|
| `createClass` | Create a new class | "Create class 3/4 CSIT" |
| `createStudents` | Add multiple students via Excel | [Sends Excel file] |
| `addStudent` | Add single student | "Add student John, Reg:101 to 3/4 CSIT" |
| `assignAttendance` | Mark attendance | "06-12-2025, 9am-12pm, 3/4 CSIT, OOAD, Absentees: 1,2,3" |
| `attendanceFetch` | Get attendance report | "Get attendance for 3/4 CSIT" |
| `parentMessage` | Send notifications to parents | "Send message to parents below 75%" |
| `help` | Show available commands | "help" or "/help" |
| `general` | General conversation | "Hello" |

## 🚀 Deployment Options

### Option 1: Edge Functions Only (Recommended)

**Advantages:**
- Better performance (closer to users)
- Lower cost (only pay for usage)
- Auto-scaling
- No cold starts

**Setup:**
```bash
cd supabase/functions
./deploy.sh
```

**Webhook URL:**
```
https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook
```

### Option 2: Next.js API + Edge Functions (Current)

**Advantages:**
- Easier local development
- Familiar Next.js patterns
- Can add custom middleware
- Gradual migration path

**Webhook URL:**
```
https://your-app.vercel.app/api/webhook/whatsapp
```

## 🔧 Configuration

### Environment Variables

**Next.js (.env.local)**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
WHATSAPP_ACCESS_TOKEN=EAAXXxxx
WHATSAPP_PHONE_NUMBER_ID=123456
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_token
GEMINI_API_KEY=AIzaXxx
```

**Supabase Edge Functions (Secrets)**
```bash
supabase secrets set WHATSAPP_ACCESS_TOKEN=xxx
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=xxx
supabase secrets set WHATSAPP_WEBHOOK_VERIFY_TOKEN=xxx
supabase secrets set GEMINI_API_KEY=xxx
```

## 📊 Data Flow

### Creating a Class

```
1. User → "Create class 3/4 CSIT"
2. Edge Function → Gemini AI
3. Gemini AI → { route: "createClass", data: { className: "3/4 CSIT" } }
4. handleCreateClass() → Insert into database
5. Edge Function → Send confirmation to WhatsApp
6. User ← "Class created! Send Excel with students"
```

### Marking Attendance

```
1. User → "06-12-2025, 9am-12pm, 3/4 CSIT, OOAD, Absentees: 1,2,3"
2. Edge Function → Gemini AI (parses date, time, class, subject, roll numbers)
3. Gemini AI → { route: "assignAttendance", data: { ... } }
4. handleAssignAttendance() → Create session + records
5. Edge Function → Send confirmation
6. User ← "✅ Attendance recorded! Present: 37, Absent: 3"
```

## 🔍 Monitoring & Debugging

### View Edge Function Logs

```bash
supabase functions logs whatsapp-webhook
```

### Local Testing

```bash
# Start local Edge Functions
supabase functions serve whatsapp-webhook --env-file ../../.env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{...webhook_payload...}'
```

### Dashboard Monitoring

1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Select `whatsapp-webhook`
4. View Logs, Invocations, and Performance metrics

## 🛠️ Development Workflow

### Adding a New Route

1. **Add route to Gemini prompt** (`_shared/utils.ts`)
2. **Create handler** (`route-handlers/index.ts`)
3. **Add to switch statement** (`whatsapp-webhook/index.ts`)
4. **Test locally**
5. **Deploy**: `supabase functions deploy whatsapp-webhook`

### Example: Adding "Delete Student" Route

```typescript
// 1. In route-handlers/index.ts
export async function handleDeleteStudent(ctx: RouteHandlerContext) {
  // Implementation
}

// 2. In whatsapp-webhook/index.ts
case "deleteStudent":
  responseMessage = await handleDeleteStudent(routeContext)
  break
```

## 🔒 Security

- ✅ Service Role Key never exposed to client
- ✅ RLS policies enforce data access
- ✅ Faculty authenticated by WhatsApp number
- ✅ Webhook verification token
- ✅ HTTPS only
- ✅ Secrets managed by Supabase

## 📈 Performance

- **Edge Functions**: ~50-100ms response time
- **Global CDN**: Deployed to regions worldwide
- **Auto-scaling**: Handles traffic spikes
- **Cold starts**: < 100ms (Deno is fast!)

## 🎓 Next Steps

1. ✅ Deploy Edge Functions
2. ✅ Configure WhatsApp Webhook URL
3. ✅ Test with faculty WhatsApp number
4. 📝 Add Excel parsing library for student imports
5. 📊 Implement analytics dashboard
6. 🔔 Add scheduled reports
7. 🌐 Multi-language support

---

**Built with:**
- Next.js 15
- Supabase Edge Functions (Deno)
- WhatsApp Business API
- Google Gemini AI
- TypeScript
