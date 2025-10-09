import { supabaseAdmin } from '@/lib/supabase/admin';
import crypto from 'crypto';

export interface InvitationToken {
  token: string;
  meeting_id: string;
  email: string;
  used: boolean;
  used_by_wallet?: string | null;
  used_at?: string | null;
  expires_at: string;
  created_at?: string;
}

class InvitationTokensDatabase {
  private tableName = 'invitation_tokens';

  /**
   * Generate a unique token
   */
  private generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create invitation tokens for multiple emails
   */
  public async createInvitationTokens(
    meetingId: string,
    emails: string[]
  ): Promise<Map<string, string>> {
    try {
      const tokenMap = new Map<string, string>();
      const tokens: Omit<InvitationToken, 'used' | 'used_by_wallet' | 'used_at' | 'created_at'>[] = [];
      
      // Generate tokens for each email
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Tokens expire in 7 days

      for (const email of emails) {
        const token = this.generateToken();
        tokenMap.set(email, token);
        
        tokens.push({
          token,
          meeting_id: meetingId,
          email: email.toLowerCase(),
          expires_at: expiresAt.toISOString()
        });
      }

      // Bulk insert tokens
      const { error } = await supabaseAdmin
        .from(this.tableName)
        .insert(tokens);

      if (error) {
        console.error('[InvitationTokens] Error creating tokens:', error);
        throw error;
      }

      console.log(`[InvitationTokens] Created ${tokens.length} tokens for meeting ${meetingId}`);
      return tokenMap;
    } catch (error) {
      console.error('[InvitationTokens] Failed to create invitation tokens:', error);
      return new Map();
    }
  }

  /**
   * Get token details
   */
  public async getToken(token: string): Promise<InvitationToken | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('token', token)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Token not found
        }
        console.error('[InvitationTokens] Error fetching token:', error);
        throw error;
      }

      return data as InvitationToken;
    } catch (error) {
      console.error('[InvitationTokens] Failed to get token:', error);
      return null;
    }
  }

  /**
   * Mark token as used
   */
  public async useToken(token: string, walletAddress: string): Promise<InvitationToken | null> {
    try {
      // First check if token exists and is valid
      const tokenData = await this.getToken(token);
      
      if (!tokenData) {
        console.warn('[InvitationTokens] Token not found:', token);
        return null;
      }

      if (tokenData.used) {
        console.warn('[InvitationTokens] Token already used:', token);
        return tokenData;
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        console.warn('[InvitationTokens] Token expired:', token);
        return null;
      }

      // Mark token as used
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .update({
          used: true,
          used_by_wallet: walletAddress.toLowerCase(),
          used_at: new Date().toISOString()
        })
        .eq('token', token)
        .select()
        .single();

      if (error) {
        console.error('[InvitationTokens] Error using token:', error);
        throw error;
      }

      console.log(`[InvitationTokens] Token used by wallet ${walletAddress} for email ${tokenData.email}`);
      return data as InvitationToken;
    } catch (error) {
      console.error('[InvitationTokens] Failed to use token:', error);
      return null;
    }
  }

  /**
   * Get tokens for a meeting
   */
  public async getTokensForMeeting(meetingId: string): Promise<InvitationToken[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('meeting_id', meetingId);

      if (error) {
        console.error('[InvitationTokens] Error fetching meeting tokens:', error);
        throw error;
      }

      return data as InvitationToken[];
    } catch (error) {
      console.error('[InvitationTokens] Failed to get meeting tokens:', error);
      return [];
    }
  }
}

// Export singleton instance
export const invitationTokensDb = new InvitationTokensDatabase();
export default invitationTokensDb;