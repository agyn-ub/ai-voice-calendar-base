-- Create wallet_email_associations table
CREATE TABLE IF NOT EXISTS public.wallet_email_associations (
  wallet_address TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_from_stake BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wallet_email_associations_email ON public.wallet_email_associations(email);
CREATE INDEX IF NOT EXISTS idx_wallet_email_associations_created_from_stake ON public.wallet_email_associations(created_from_stake);

-- Enable RLS
ALTER TABLE public.wallet_email_associations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read for all users" ON public.wallet_email_associations
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.wallet_email_associations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.wallet_email_associations
  FOR UPDATE USING (true);