// Database types for Supabase
// You can generate these types automatically from your Supabase project
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts

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
          event_data: string;
          stake_amount: number;
          status: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled';
          google_event_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organizer_wallet: string;
          event_data: string;
          stake_amount: number;
          status?: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled';
          google_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organizer_wallet?: string;
          event_data?: string;
          stake_amount?: number;
          status?: 'pending' | 'stake_confirmed' | 'scheduled' | 'cancelled';
          google_event_id?: string | null;
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