-- Create invitation_tokens table
CREATE TABLE IF NOT EXISTS public.invitation_tokens (
  token TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  email TEXT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_by_wallet TEXT,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_meeting_id ON public.invitation_tokens(meeting_id);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_email ON public.invitation_tokens(email);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_used ON public.invitation_tokens(used);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_expires_at ON public.invitation_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read for all users" ON public.invitation_tokens
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON public.invitation_tokens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.invitation_tokens
  FOR UPDATE USING (true);