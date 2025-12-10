# Vercel Deployment Guide

## Prerequisites
- Vercel account (free at https://vercel.com)
- GitHub repository with your code
- Supabase project with proper RLS policies configured

## Environment Variables Required

Before deploying, ensure these environment variables are set in Vercel:

1. **NEXT_PUBLIC_SUPABASE_URL**
   - Get from: Supabase Dashboard → Settings → General
   - Looks like: `https://xxxxx.supabase.co`

2. **NEXT_PUBLIC_SUPABASE_ANON_KEY**
   - Get from: Supabase Dashboard → Settings → API
   - This is public and safe to expose (starts with `eyJ...`)

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Get from: Supabase Dashboard → Settings → API
   - ⚠️ KEEP THIS SECRET - Never commit to Git
   - Used only on server-side (only in server components and API routes)

## Deployment Steps

### 1. Connect to Vercel
```bash
# Option A: Using Vercel CLI
npm i -g vercel
vercel

# Option B: Via GitHub
# Go to https://vercel.com/new
# Select your GitHub repository
# Click "Import"
```

### 2. Configure Environment Variables
In Vercel Dashboard:
1. Go to Project → Settings → Environment Variables
2. Add all three environment variables above
3. Make sure they're available in all environments (Production, Preview, Development)

### 3. Deploy
The app will automatically build and deploy. Build settings should be:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Development Command**: `npm run dev`

## Post-Deployment Checks

### 1. Test the Application
- Visit your Vercel URL
- Test login with different roles (admin, faculty, HOD, student)
- Verify data loading works correctly

### 2. Check Server Logs
In Vercel Dashboard:
- Go to Deployments → Click latest deployment
- View Function Logs to see server-side errors
- Check Runtime Logs in real-time while testing

### 3. Verify Supabase Connection
- Check Supabase Dashboard for any RLS policy violations
- Confirm admin client requests are working (server-side only)
- Test student login flow with localStorage

## Troubleshooting

### 404 on Detail Pages
- Check if dynamic routes are properly configured
- Ensure Supabase data exists before clicking "View Details"
- Check server logs for query errors

### Missing Data on Pages
- Verify Supabase RLS policies are correct
- Confirm environment variables are set
- Check that service role key is available on server components

### WhatsApp Webhook Issues
- Update webhook URL in WhatsApp Business settings to point to your Vercel URL
- Webhook endpoint: `https://your-vercel-url.vercel.app/api/webhook/whatsapp`
- Test webhook delivery in WhatsApp Business Dashboard

## Database Backup

Before production:
1. Export your Supabase database backup
2. Test on staging environment first
3. Keep Supabase backups enabled (available on paid plans)

## Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is kept secret (not in .env.example or Git)
- [ ] RLS policies are properly configured in Supabase
- [ ] Middleware is protecting sensitive routes
- [ ] All user inputs are validated server-side
- [ ] CORS is properly configured if needed

## Performance Optimization

For better performance on Vercel:
- Images are optimized automatically via Next.js Image component
- API routes are edge-cached where appropriate
- Database queries use indexes (check Supabase Dashboard)
- Consider adding caching headers for static assets

## Custom Domain (Optional)

1. In Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records according to Vercel's instructions
4. SSL certificate is automatic
