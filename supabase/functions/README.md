## Supabase Edge Functions

This directory contains Supabase Edge Functions (Deno runtime) for the WhatsApp Attendance System.

### Functions

#### `whatsapp-webhook`
Handles WhatsApp Business API webhook events for processing incoming messages, managing attendance, and interacting with faculty members.

**Features:**
- Webhook verification (GET)
- Incoming message processing (POST)
- Gemini AI integration for intent recognition
- Attendance management
- Class and student management
- Parent notifications

### Environment Variables

Set these in your Supabase project (Dashboard → Edge Functions → Settings):

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token
GEMINI_API_KEY=your_gemini_key
```

### Deployment

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy the function
supabase functions deploy whatsapp-webhook

# Set environment variables
supabase secrets set WHATSAPP_ACCESS_TOKEN=your_token
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your_id
supabase secrets set WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify
supabase secrets set GEMINI_API_KEY=your_key
```

### Webhook URL

After deployment, your webhook URL will be:
```
https://your-project-ref.supabase.co/functions/v1/whatsapp-webhook
```

Configure this URL in your Meta Developer Console for WhatsApp Business API.

### Local Development

```bash
# Start local development server
supabase functions serve whatsapp-webhook --env-file .env.local

# Test the function
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{"entry": [{"changes": [{"value": {"messages": [{"from": "1234567890", "text": {"body": "hello"}}]}}]}]}'
```

### Testing

Use the Meta Developer Console's "Test" feature to send test messages, or use curl:

```bash
# Verify webhook
curl "https://your-project.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=your_token&hub.challenge=test_challenge"
```
