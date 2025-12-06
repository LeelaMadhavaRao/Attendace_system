# 🚀 WhatsApp Attendance System - Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Environment Setup

#### Supabase Project
- [ ] Supabase project created
- [ ] Database migrations executed (001-004.sql)
- [ ] RLS policies enabled
- [ ] Admin user created
- [ ] Service role key obtained

#### WhatsApp Business API
- [ ] Meta Developer account created
- [ ] WhatsApp Business App configured
- [ ] Test phone number added
- [ ] Access token generated
- [ ] Phone number ID obtained

#### Google Gemini AI
- [ ] Google AI Studio account created
- [ ] API key generated
- [ ] API quota checked

### 2. Database Setup

```bash
# Execute SQL scripts in order:
1. scripts/001_create_schema.sql
2. scripts/002_enable_rls.sql
3. scripts/003_create_functions.sql
4. scripts/004_create_admin_user.sql
```

- [ ] All tables created
- [ ] RLS policies active
- [ ] Functions and triggers working
- [ ] Admin profile exists

### 3. Environment Variables

#### Next.js (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
WHATSAPP_ACCESS_TOKEN=EAAXXxxx
WHATSAPP_PHONE_NUMBER_ID=123456
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_custom_token
GEMINI_API_KEY=AIzaXxx
```

- [ ] All variables set
- [ ] Keys validated
- [ ] File not committed to git

#### Supabase Edge Functions
```bash
supabase secrets set WHATSAPP_ACCESS_TOKEN=xxx
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=xxx
supabase secrets set WHATSAPP_WEBHOOK_VERIFY_TOKEN=xxx
supabase secrets set GEMINI_API_KEY=xxx
```

- [ ] All secrets configured
- [ ] Secrets verified

### 4. Edge Functions Deployment

```bash
cd supabase/functions
chmod +x deploy.sh
./deploy.sh
```

- [ ] Supabase CLI installed
- [ ] Logged into Supabase
- [ ] Project linked
- [ ] Edge function deployed
- [ ] Deployment verified

### 5. Next.js Application Deployment

#### Option A: Vercel (Recommended)
```bash
vercel --prod
```

- [ ] Vercel project created
- [ ] Environment variables set in Vercel
- [ ] Build successful
- [ ] Deployment live

#### Option B: Other Platforms
- [ ] Platform configured
- [ ] Environment variables set
- [ ] Build successful
- [ ] Deployment live

### 6. WhatsApp Webhook Configuration

1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Navigate to your WhatsApp Business App
3. Go to WhatsApp → Configuration

#### Option A: Edge Function Direct (Recommended)
```
Callback URL: https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook
Verify Token: [Your WHATSAPP_WEBHOOK_VERIFY_TOKEN]
```

#### Option B: Via Next.js Proxy
```
Callback URL: https://your-app.vercel.app/api/webhook/whatsapp
Verify Token: [Your WHATSAPP_WEBHOOK_VERIFY_TOKEN]
```

- [ ] Callback URL configured
- [ ] Verify token set
- [ ] Webhook verified (green checkmark)
- [ ] Subscribed to `messages` field

### 7. Faculty Registration

For each faculty member:
1. Create auth user in Supabase Auth
2. Create profile in `profiles` table
3. Create faculty record in `faculty` table with WhatsApp number

```sql
-- Example SQL for creating faculty
INSERT INTO profiles (id, email, name, role, department)
VALUES ('user-uuid', 'faculty@university.edu', 'Dr. John Doe', 'faculty', 'Computer Science');

INSERT INTO faculty (profile_id, department, whatsapp_number)
VALUES ('user-uuid', 'Computer Science', '+1234567890');
```

- [ ] Admin account created
- [ ] HOD accounts created
- [ ] Faculty accounts created with WhatsApp numbers
- [ ] WhatsApp numbers format: +[country code][number]

## 🧪 Testing Checklist

### WhatsApp Integration Tests

- [ ] Send "hello" → Receive greeting
- [ ] Send "help" → Receive commands list
- [ ] Send "Create class Test Class" → Class created
- [ ] Send Excel file → Students imported
- [ ] Send attendance message → Attendance recorded
- [ ] Send "Get attendance for Test Class" → Receive report

### Dashboard Tests

#### Admin Dashboard
- [ ] Can create HODs
- [ ] Can create faculty
- [ ] Can view all classes
- [ ] Can view reports
- [ ] Can delete users

#### HOD Dashboard
- [ ] Can create faculty
- [ ] Can view department classes
- [ ] Can view department reports
- [ ] Can view faculty list

#### Faculty Dashboard
- [ ] Can view own classes
- [ ] Can view class details
- [ ] Can mark attendance manually
- [ ] Can view student list
- [ ] Can view attendance reports

### Authentication Tests
- [ ] Login works for all roles
- [ ] Role-based access working
- [ ] Logout works
- [ ] Session persistence

## 📊 Monitoring Setup

### Supabase Dashboard
- [ ] Enable realtime monitoring
- [ ] Set up alerts for errors
- [ ] Monitor database performance
- [ ] Check edge function logs

### WhatsApp Business Manager
- [ ] Monitor message delivery rates
- [ ] Check webhook success rate
- [ ] Review error messages

### Application Monitoring
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure uptime monitoring
- [ ] Set up performance monitoring

## 🔧 Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Test with real faculty member
- [ ] Create first class via WhatsApp
- [ ] Import students
- [ ] Mark attendance
- [ ] Send test parent message

### Week 1
- [ ] Train faculty members
- [ ] Create documentation for users
- [ ] Set up backup procedures
- [ ] Monitor for issues

### Month 1
- [ ] Review usage analytics
- [ ] Gather user feedback
- [ ] Optimize performance
- [ ] Plan feature enhancements

## 🐛 Troubleshooting

### WhatsApp Messages Not Received
1. Check webhook configuration in Meta Developer Console
2. Verify webhook URL is accessible
3. Check edge function logs: `supabase functions logs whatsapp-webhook`
4. Verify faculty WhatsApp number in database
5. Check access token validity

### Gemini AI Not Responding
1. Verify GEMINI_API_KEY is set
2. Check API quota in Google AI Studio
3. Review edge function logs for errors
4. Test API key with curl

### Database Connection Issues
1. Check SUPABASE_URL and keys
2. Verify RLS policies
3. Check service role key permissions
4. Review database logs in Supabase Dashboard

### Build Failures
1. Run `npm run build` locally
2. Check all environment variables
3. Verify TypeScript types
4. Review build logs

## 📞 Support Contacts

- **Supabase Support**: [support.supabase.com](https://support.supabase.com)
- **Meta Developer Support**: [developers.facebook.com/support](https://developers.facebook.com/support)
- **Google AI Studio**: [ai.google.dev](https://ai.google.dev)

## 🎯 Success Criteria

- [ ] All faculty can send WhatsApp messages
- [ ] Classes created successfully
- [ ] Students imported via Excel
- [ ] Attendance marked and recorded
- [ ] Reports generated correctly
- [ ] Parent messages delivered
- [ ] Dashboard accessible for all roles
- [ ] System stable with no critical errors

---

## 🚀 Ready to Deploy!

Once all checkboxes are marked, your WhatsApp Attendance System is ready for production use!

**Deployment Command:**
```bash
# Deploy Edge Functions
cd supabase/functions && ./deploy.sh

# Deploy Next.js
vercel --prod
```

**Webhook URLs:**
- Edge Function: `https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp-webhook`
- Next.js Proxy: `https://your-app.vercel.app/api/webhook/whatsapp`

**First Steps After Deployment:**
1. Configure WhatsApp webhook
2. Register first faculty member
3. Send test message: "hello"
4. Create first class
5. Celebrate! 🎉
