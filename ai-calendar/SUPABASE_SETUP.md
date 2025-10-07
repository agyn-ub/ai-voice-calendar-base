# Supabase Setup Guide

This guide will help you set up Supabase for the AI Voice Calendar application.

## 🚀 Quick Start

### 1. Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New project"
3. Enter project details:
   - Name: `ai-voice-calendar` (or your preferred name)
   - Database Password: Choose a strong password
   - Region: Select closest to your location
4. Click "Create new project" and wait for setup to complete

### 2. Get Your API Keys

Once your project is created:

1. Go to Settings → API
2. Copy these values to your `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 3. Run Database Migrations

#### Option A: Using Supabase Dashboard (Recommended for beginners)

1. In Supabase Dashboard, go to SQL Editor
2. Click "New query"
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the SQL editor
5. Click "Run" to execute the migration

#### Option B: Using Supabase CLI

1. Install Supabase CLI:
```bash
brew install supabase/tap/supabase
```

2. Link your project:
```bash
supabase link --project-ref your-project-id
```

3. Run migrations:
```bash
supabase db push
```

### 4. Configure Row Level Security (Optional but Recommended)

For production, update the RLS policies in the SQL editor:

```sql
-- Example: Users can only access their own accounts
CREATE POLICY "Users can access own account" ON accounts
  FOR ALL
  USING (wallet_address = current_setting('app.current_wallet')::text);
```

### 5. Test the Connection

Start your development server:
```bash
pnpm dev
```

Visit http://localhost:3000 and try connecting your Google Calendar.

## 📊 Database Schema

The application uses three main tables:

### accounts
- Stores wallet addresses and Google OAuth tokens
- Tokens are encrypted before storage
- Links to contacts via account_id

### contacts
- Stores Gmail contacts for each account
- Enables name-to-email resolution for meeting invites
- Indexed for fast searching

### pending_meetings
- Tracks meetings awaiting stake confirmation
- Stores event data as JSONB
- Links to Google Calendar once confirmed

## 🔒 Security Considerations

### Token Encryption
- All OAuth tokens are encrypted using AES-256-CBC
- Encryption key is derived from `JWT_SECRET` environment variable
- Never commit real tokens to version control

### Row Level Security
- Enable RLS on all tables in production
- Use service role key only on server-side
- Client-side should use anon key with proper RLS policies

### Environment Variables
- Never commit `.env.local` to git
- Use different Supabase projects for dev/staging/production
- Rotate service role key if compromised

## 🔄 Migration from SQLite/JSON

If you have existing data in the old format:

1. Keep `calendar-connections.json` file in place
2. Run the migration helper:
```bash
pnpm tsx src/lib/db/migrate-to-supabase.ts
```

3. Verify data in Supabase dashboard
4. Delete old files once confirmed working

## 🛠️ Troubleshooting

### Connection Issues

**Problem**: "Failed to connect to database"
**Solution**: 
- Check your Supabase project is running
- Verify environment variables are correct
- Ensure no typos in URLs or keys

### Authentication Errors

**Problem**: "Invalid API key"
**Solution**:
- Double-check you're using the correct keys
- Anon key for client-side, service role for server-side
- Regenerate keys if needed in Supabase dashboard

### Migration Failures

**Problem**: "Table already exists"
**Solution**:
- Check if tables were partially created
- Drop existing tables and re-run migration
- Or modify migration to use `IF NOT EXISTS` clauses

### Google Calendar Connection

**Problem**: "Failed to save calendar connection"
**Solution**:
- Ensure database migrations have run successfully
- Check browser console for specific error messages
- Verify Google OAuth credentials are correct

## 📈 Monitoring

### View Database Activity

1. Go to Supabase Dashboard → Database
2. Check Tables to see data
3. Use Logs to monitor queries
4. Set up alerts for errors

### Performance Monitoring

1. Enable query performance insights
2. Add indexes for frequently searched columns
3. Monitor slow queries in dashboard

## 🎉 Next Steps

Once Supabase is set up:

1. **Test Google Calendar Integration**: Connect your calendar and create events
2. **Test Contact Sync**: Import contacts from Gmail
3. **Test Staking Flow**: Create meetings with ETH stakes
4. **Add Realtime Features**: Subscribe to stake updates
5. **Deploy to Production**: Use Vercel with Supabase integration

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime Subscriptions](https://supabase.com/docs/guides/realtime)