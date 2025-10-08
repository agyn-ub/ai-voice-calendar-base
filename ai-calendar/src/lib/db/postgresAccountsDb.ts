import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';

// Encryption utilities
function encrypt(text: string): string {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('[AccountsDB] Encryption failed:', error);
    console.error('[AccountsDB] ENCRYPTION_KEY length:', ENCRYPTION_KEY.length);
    throw error;
  }
}

function decrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

type AccountRow = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

export interface Account {
  id: number;
  wallet_address: string;
  google_email?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expiry?: number | null;
  scopes?: string | null;
  last_sync_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

class AccountsDatabase {
  /**
   * Get account by wallet address
   */
  public async getAccountByWallet(walletAddress: string): Promise<Account | null> {
    try {
      console.log('[AccountsDB] Getting account for wallet:', walletAddress, '(lowercase:', walletAddress.toLowerCase(), ')');
      
      const { data, error } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('[AccountsDB] Error fetching account:', error);
        throw error;
      }

      if (!data) return null;

      // Decrypt tokens if present
      if (data.access_token) {
        data.access_token = decrypt(data.access_token);
      }
      if (data.refresh_token) {
        data.refresh_token = decrypt(data.refresh_token);
      }

      return data as Account;
    } catch (error) {
      console.error('[AccountsDB] Failed to get account:', error);
      return null;
    }
  }

  /**
   * Sync version for compatibility (triggers async in background)
   */
  public getAccountByWalletSync(walletAddress: string): Account | null {
    console.warn('[AccountsDB] Using sync method - no results available until database loads');
    // Trigger async operation in background
    this.getAccountByWallet(walletAddress).catch(err => {
      console.error('[AccountsDB] Background fetch failed:', err);
    });
    return null;
  }

  /**
   * Save or update account
   */
  public async saveAccount(account: {
    wallet_address: string;
    google_email?: string | null;
    access_token?: string | null;
    refresh_token?: string | null;
    token_expiry?: number | null;
    scopes?: string | null;
  }): Promise<Account | null> {
    try {
      console.log('[AccountsDB] Saving account for wallet:', account.wallet_address);
      console.log('[AccountsDB] Account data:', {
        wallet: account.wallet_address,
        email: account.google_email,
        hasAccessToken: !!account.access_token,
        hasRefreshToken: !!account.refresh_token,
        tokenExpiry: account.token_expiry,
        scopes: account.scopes
      });
      
      const accountData: AccountInsert = {
        wallet_address: account.wallet_address.toLowerCase(),
        google_email: account.google_email,
        access_token: account.access_token ? encrypt(account.access_token) : null,
        refresh_token: account.refresh_token ? encrypt(account.refresh_token) : null,
        token_expiry: account.token_expiry,
        scopes: account.scopes
      };

      console.log('[AccountsDB] Upserting to database with wallet_address:', accountData.wallet_address);

      const { data, error } = await supabaseAdmin
        .from('accounts')
        .upsert(accountData, {
          onConflict: 'wallet_address'
        })
        .select()
        .single();

      if (error) {
        console.error('[AccountsDB] Error saving account:', error);
        console.error('[AccountsDB] Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log('[AccountsDB] Save successful, returned data:', {
        id: data?.id,
        wallet: data?.wallet_address,
        email: data?.google_email
      });

      // Return with decrypted tokens
      if (data) {
        if (data.access_token) {
          data.access_token = decrypt(data.access_token);
        }
        if (data.refresh_token) {
          data.refresh_token = decrypt(data.refresh_token);
        }
      }

      return data as Account;
    } catch (error) {
      console.error('[AccountsDB] Failed to save account:', error);
      return null;
    }
  }

  /**
   * Update tokens for an account
   */
  public async updateTokens(
    accountId: number,
    accessToken: string,
    refreshToken?: string,
    expiryTime?: number
  ): Promise<boolean> {
    try {
      const updateData: AccountUpdate = {
        access_token: encrypt(accessToken),
        token_expiry: expiryTime
      };

      if (refreshToken) {
        updateData.refresh_token = encrypt(refreshToken);
      }

      const { error } = await supabaseAdmin
        .from('accounts')
        .update(updateData)
        .eq('id', accountId);

      if (error) {
        console.error('[AccountsDB] Error updating tokens:', error);
        throw error;
      }

      console.log(`[AccountsDB] Updated tokens for account ${accountId}`);
      return true;
    } catch (error) {
      console.error('[AccountsDB] Failed to update tokens:', error);
      return false;
    }
  }

  /**
   * Update last sync time
   */
  public async updateSyncTime(accountId: number): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('accounts')
        .update({
          last_sync_at: new Date().toISOString()
        })
        .eq('id', accountId);

      if (error) {
        console.error('[AccountsDB] Error updating sync time:', error);
        throw error;
      }

      console.log(`[AccountsDB] Updated sync time for account ${accountId}`);
    } catch (error) {
      console.error('[AccountsDB] Failed to update sync time:', error);
    }
  }

  /**
   * Delete account and all related data
   */
  public async deleteAccount(walletAddress: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('accounts')
        .delete()
        .eq('wallet_address', walletAddress.toLowerCase());

      if (error) {
        console.error('[AccountsDB] Error deleting account:', error);
        throw error;
      }

      console.log(`[AccountsDB] Deleted account for wallet ${walletAddress}`);
      return true;
    } catch (error) {
      console.error('[AccountsDB] Failed to delete account:', error);
      return false;
    }
  }

  /**
   * Check if an account exists
   */
  public async accountExists(walletAddress: string): Promise<boolean> {
    try {
      const { count, error } = await supabaseAdmin
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress.toLowerCase());

      if (error) {
        console.error('[AccountsDB] Error checking account existence:', error);
        throw error;
      }

      return (count || 0) > 0;
    } catch (error) {
      console.error('[AccountsDB] Failed to check account existence:', error);
      return false;
    }
  }

  /**
   * Get all accounts (for admin/debugging)
   */
  public async getAllAccounts(limit: number = 100): Promise<Account[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[AccountsDB] Error fetching all accounts:', error);
        throw error;
      }

      // Note: We don't decrypt tokens for bulk operations
      // Tokens remain encrypted for security
      return (data || []).map(account => ({
        ...account,
        access_token: account.access_token ? '[ENCRYPTED]' : null,
        refresh_token: account.refresh_token ? '[ENCRYPTED]' : null
      })) as Account[];
    } catch (error) {
      console.error('[AccountsDB] Failed to get all accounts:', error);
      return [];
    }
  }
}

// Export singleton instance
export const postgresAccountsDb = new AccountsDatabase();
export default postgresAccountsDb;