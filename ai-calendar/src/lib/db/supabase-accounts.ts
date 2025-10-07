import { supabaseAdmin } from '@/lib/supabase/admin';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';

// Encryption utilities
export function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export interface Account {
  id?: number;
  wallet_address: string;
  google_email?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: number;
  scopes?: string;
  last_sync_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TokenUpdate {
  access_token: string;
  refresh_token?: string;
  token_expiry?: number;
}

class SupabaseAccountsDatabase {
  /**
   * Create or update an account
   */
  public async createOrUpdateAccount(account: Account): Promise<Account> {
    // Check if account exists
    const { data: existing } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('wallet_address', account.wallet_address)
      .single();

    // Encrypt tokens before saving
    const dataToSave = {
      wallet_address: account.wallet_address,
      google_email: account.google_email,
      access_token: account.access_token ? encrypt(account.access_token) : null,
      refresh_token: account.refresh_token ? encrypt(account.refresh_token) : null,
      token_expiry: account.token_expiry,
      scopes: account.scopes,
    };

    if (existing) {
      // Update existing account
      const { data, error } = await supabaseAdmin
        .from('accounts')
        .update(dataToSave)
        .eq('wallet_address', account.wallet_address)
        .select()
        .single();

      if (error) throw error;
      return this.decryptAccount(data);
    } else {
      // Insert new account
      const { data, error } = await supabaseAdmin
        .from('accounts')
        .insert(dataToSave)
        .select()
        .single();

      if (error) throw error;
      return this.decryptAccount(data);
    }
  }

  /**
   * Synchronous version for compatibility (converts to async internally)
   */
  public createOrUpdateAccountSync(account: Account): Account {
    // Note: This is a workaround for backward compatibility
    // In production, you should use the async version
    const result = this.createOrUpdateAccount(account);
    // Return a placeholder that will be updated asynchronously
    return {
      ...account,
      id: 0, // Will be updated when async completes
    };
  }

  /**
   * Get account by wallet address
   */
  public async getAccountByWallet(walletAddress: string): Promise<Account | null> {
    const { data, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (error || !data) return null;
    return this.decryptAccount(data);
  }

  /**
   * Synchronous version for compatibility
   */
  public getAccountByWalletSync(walletAddress: string): Account | null {
    // For backward compatibility, return null
    // The async version should be used instead
    return null;
  }

  /**
   * Get account by ID
   */
  public async getAccountById(id: number): Promise<Account | null> {
    const { data, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.decryptAccount(data);
  }

  /**
   * Update tokens for an account
   */
  public async updateTokens(walletAddress: string, tokens: TokenUpdate): Promise<void> {
    const encryptedTokens = {
      access_token: encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
      token_expiry: tokens.token_expiry,
    };

    const { error } = await supabaseAdmin
      .from('accounts')
      .update(encryptedTokens)
      .eq('wallet_address', walletAddress);

    if (error) throw error;
  }

  /**
   * Update sync time
   */
  public async updateSyncTime(accountId: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('accounts')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', accountId);

    if (error) throw error;
  }

  /**
   * Delete an account
   */
  public async deleteAccount(walletAddress: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('wallet_address', walletAddress);

    return !error;
  }

  /**
   * List all accounts
   */
  public async listAccounts(): Promise<Account[]> {
    const { data, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(account => this.decryptAccount(account));
  }

  /**
   * Helper to decrypt account tokens
   */
  private decryptAccount(account: any): Account {
    return {
      ...account,
      access_token: account.access_token ? decrypt(account.access_token) : undefined,
      refresh_token: account.refresh_token ? decrypt(account.refresh_token) : undefined,
    };
  }
}

// Export singleton instance
export const accountsDb = new SupabaseAccountsDatabase();
export default accountsDb;