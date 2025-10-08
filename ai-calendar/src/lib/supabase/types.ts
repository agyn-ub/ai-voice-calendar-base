// Database types for Supabase
// Generated based on the migration files

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: number;
          wallet_address: string;
          google_email: string | null;
          access_token: string | null;
          refresh_token: string | null;
          token_expiry: number | null;
          scopes: string | null;
          last_sync_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          wallet_address: string;
          google_email?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expiry?: number | null;
          scopes?: string | null;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          wallet_address?: string;
          google_email?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expiry?: number | null;
          scopes?: string | null;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      contacts: {
        Row: {
          id: number;
          account_id: number;
          email: string;
          name: string | null;
          phone: string | null;
          organization: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          account_id: number;
          email: string;
          name?: string | null;
          phone?: string | null;
          organization?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          account_id?: number;
          email?: string;
          name?: string | null;
          phone?: string | null;
          organization?: string | null;
          created_at?: string;
        };
      };
      pending_meetings: {
        Row: {
          id: string;
          organizer_wallet: string;
          event_data: any; // JSONB type
          stake_amount: number;
          status: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled';
          google_event_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organizer_wallet: string;
          event_data: any; // JSONB type
          stake_amount: number;
          status?: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled';
          google_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organizer_wallet?: string;
          event_data?: any; // JSONB type
          stake_amount?: number;
          status?: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled';
          google_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      meeting_stakes: {
        Row: {
          meeting_id: string;
          event_id: string;
          organizer: string;
          required_stake: number;
          start_time: string;
          end_time: string;
          attendance_code: string | null;
          code_generated_at: string | null;
          is_settled: boolean;
          stakes: any; // JSONB type
          created_at: string;
          updated_at: string;
        };
        Insert: {
          meeting_id: string;
          event_id: string;
          organizer: string;
          required_stake: number;
          start_time: string;
          end_time: string;
          attendance_code?: string | null;
          code_generated_at?: string | null;
          is_settled?: boolean;
          stakes?: any; // JSONB type
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          meeting_id?: string;
          event_id?: string;
          organizer?: string;
          required_stake?: number;
          start_time?: string;
          end_time?: string;
          attendance_code?: string | null;
          code_generated_at?: string | null;
          is_settled?: boolean;
          stakes?: any; // JSONB type
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      meeting_status: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled';
    };
  };
}