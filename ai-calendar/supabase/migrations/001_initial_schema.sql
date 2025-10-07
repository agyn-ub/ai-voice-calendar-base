-- Create accounts table for storing wallet addresses and Google OAuth tokens
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT UNIQUE NOT NULL,
  google_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry BIGINT,
  scopes TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on wallet_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounts_wallet_address ON accounts(wallet_address);

-- Create contacts table for storing Gmail contacts
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  organization TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);

-- Create unique constraint for account_id + email combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_account_email ON contacts(account_id, email);

-- Create enum for meeting status
CREATE TYPE meeting_status AS ENUM ('pending', 'stake_confirmed', 'scheduled', 'cancelled');

-- Create pending_meetings table for meetings awaiting stake confirmation
CREATE TABLE IF NOT EXISTS pending_meetings (
  id TEXT PRIMARY KEY,
  organizer_wallet TEXT NOT NULL,
  event_data JSONB NOT NULL,
  stake_amount DECIMAL(10, 4) NOT NULL,
  status meeting_status DEFAULT 'pending',
  google_event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for pending_meetings
CREATE INDEX IF NOT EXISTS idx_pending_meetings_organizer ON pending_meetings(organizer_wallet);
CREATE INDEX IF NOT EXISTS idx_pending_meetings_status ON pending_meetings(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to auto-update updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_meetings_updated_at BEFORE UPDATE ON pending_meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_meetings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for accounts table
-- For now, we'll use service role key for all operations
-- In production, you'd want to tie this to authenticated users
CREATE POLICY "Service role can manage accounts" ON accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for contacts table
CREATE POLICY "Service role can manage contacts" ON contacts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for pending_meetings table
CREATE POLICY "Service role can manage pending meetings" ON pending_meetings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE accounts IS 'Stores wallet addresses and Google OAuth tokens for calendar connections';
COMMENT ON TABLE contacts IS 'Stores Gmail contacts extracted from users Google accounts';
COMMENT ON TABLE pending_meetings IS 'Stores meetings that are pending stake confirmation before being added to Google Calendar';

COMMENT ON COLUMN accounts.wallet_address IS 'Ethereum wallet address (primary identifier)';
COMMENT ON COLUMN accounts.google_email IS 'Google account email associated with this wallet';
COMMENT ON COLUMN accounts.access_token IS 'Encrypted Google OAuth access token';
COMMENT ON COLUMN accounts.refresh_token IS 'Encrypted Google OAuth refresh token';
COMMENT ON COLUMN accounts.token_expiry IS 'Unix timestamp when the access token expires';

COMMENT ON COLUMN pending_meetings.event_data IS 'JSON data containing event details (summary, description, attendees, etc)';
COMMENT ON COLUMN pending_meetings.stake_amount IS 'Required stake amount in ETH';
COMMENT ON COLUMN pending_meetings.google_event_id IS 'Google Calendar event ID once created';