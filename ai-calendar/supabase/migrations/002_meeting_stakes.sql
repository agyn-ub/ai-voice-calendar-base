-- Create meeting_stakes table for storing staking information
CREATE TABLE IF NOT EXISTS meeting_stakes (
  meeting_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  organizer TEXT NOT NULL,
  required_stake DECIMAL(10, 4) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  attendance_code TEXT,
  code_generated_at TIMESTAMP WITH TIME ZONE,
  is_settled BOOLEAN DEFAULT FALSE,
  stakes JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for meeting_stakes
CREATE INDEX IF NOT EXISTS idx_meeting_stakes_organizer ON meeting_stakes(organizer);
CREATE INDEX IF NOT EXISTS idx_meeting_stakes_event_id ON meeting_stakes(event_id);
CREATE INDEX IF NOT EXISTS idx_meeting_stakes_settled ON meeting_stakes(is_settled);

-- Add GIN index for JSONB stakes column for efficient searching
CREATE INDEX IF NOT EXISTS idx_meeting_stakes_stakes ON meeting_stakes USING GIN (stakes);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_meeting_stakes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_meeting_stakes_updated_at BEFORE UPDATE ON meeting_stakes
  FOR EACH ROW EXECUTE FUNCTION update_meeting_stakes_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE meeting_stakes ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for meeting_stakes
CREATE POLICY "Service role can manage meeting stakes" ON meeting_stakes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE meeting_stakes IS 'Stores meeting stake information including attendance codes and participant stakes';
COMMENT ON COLUMN meeting_stakes.meeting_id IS 'Unique identifier for the meeting';
COMMENT ON COLUMN meeting_stakes.event_id IS 'Google Calendar event ID';
COMMENT ON COLUMN meeting_stakes.organizer IS 'Wallet address of the meeting organizer';
COMMENT ON COLUMN meeting_stakes.required_stake IS 'Required stake amount in ETH';
COMMENT ON COLUMN meeting_stakes.attendance_code IS 'Generated code for attendance verification';
COMMENT ON COLUMN meeting_stakes.stakes IS 'JSON array of stake records for participants';