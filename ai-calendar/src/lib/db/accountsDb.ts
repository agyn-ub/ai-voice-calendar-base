import db, { encrypt, decrypt } from './sqlite';
import { fallbackDb } from './fallbackDb';

export interface Account {
  id?: number;
  wallet_address: string;
  google_email?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: number;
  scopes?: string;
  last_sync_at?: number;
  created_at?: number;
  updated_at?: number;
}

export interface TokenUpdate {
  access_token: string;
  refresh_token?: string;
  token_expiry?: number;
}

class AccountsDatabase {
  /**
   * Create or update an account (async)
   */
  public async createOrUpdateAccountAsync(account: Account): Promise<Account> {
    const stmt = await db.prepare(`
      SELECT * FROM accounts WHERE wallet_address = ?
    `);
    const existing = stmt.get(account.wallet_address) as Account | undefined;

    // Encrypt tokens before saving
    const encryptedAccount = {
      ...account,
      access_token: account.access_token ? encrypt(account.access_token) : undefined,
      refresh_token: account.refresh_token ? encrypt(account.refresh_token) : undefined,
    };

    if (existing) {
      // Update existing account
      const updateStmt = await db.prepare(`
        UPDATE accounts
        SET google_email = @google_email,
            access_token = @access_token,
            refresh_token = @refresh_token,
            token_expiry = @token_expiry,
            scopes = @scopes,
            updated_at = unixepoch()
        WHERE wallet_address = @wallet_address
      `);
      updateStmt.run(encryptedAccount);
      return (await this.getAccountByWallet(account.wallet_address))!;
    } else {
      // Create new account
      const createStmt = await db.prepare(`
        INSERT INTO accounts (wallet_address, google_email, access_token, refresh_token, token_expiry, scopes)
        VALUES (@wallet_address, @google_email, @access_token, @refresh_token, @token_expiry, @scopes)
      `);
      const result = createStmt.run(encryptedAccount);
      return (await this.getAccountById(result.lastInsertRowid as number))!;
    }
  }

  /**
   * Get account by wallet address (async)
   */
  public async getAccountByWallet(walletAddress: string): Promise<Account | null> {
    const stmt = await db.prepare(`
      SELECT * FROM accounts WHERE wallet_address = ?
    `);
    const account = stmt.get(walletAddress) as Account | undefined;

    if (!account) return null;

    // Decrypt tokens before returning
    return {
      ...account,
      access_token: account.access_token ? decrypt(account.access_token) : undefined,
      refresh_token: account.refresh_token ? decrypt(account.refresh_token) : undefined,
    };
  }

  /**
   * Get account by ID
   */
  public async getAccountById(id: number): Promise<Account | null> {
    const stmt = await db.prepare(`
      SELECT * FROM accounts WHERE id = ?
    `);
    const account = stmt.get(id) as Account | undefined;

    if (!account) return null;

    // Decrypt tokens before returning
    return {
      ...account,
      access_token: account.access_token ? decrypt(account.access_token) : undefined,
      refresh_token: account.refresh_token ? decrypt(account.refresh_token) : undefined,
    };
  }

  /**
   * Update account tokens
   */
  public async updateTokens(accountId: number, tokens: TokenUpdate): Promise<boolean> {
    const encryptedTokens = {
      id: accountId,
      access_token: encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
      token_expiry: tokens.token_expiry,
    };

    const stmt = await db.prepare(`
      UPDATE accounts
      SET access_token = @access_token,
          refresh_token = COALESCE(@refresh_token, refresh_token),
          token_expiry = @token_expiry,
          updated_at = unixepoch()
      WHERE id = @id
    `);
    const result = stmt.run(encryptedTokens);
    return result.changes > 0;
  }

  /**
   * Update last sync timestamp
   */
  public async updateSyncTime(accountId: number): Promise<boolean> {
    const stmt = await db.prepare(`
      UPDATE accounts
      SET last_sync_at = unixepoch(),
          updated_at = unixepoch()
      WHERE id = ?
    `);
    const result = stmt.run(accountId);
    return result.changes > 0;
  }

  /**
   * Delete account by wallet address (async)
   */
  public async deleteAccountAsync(walletAddress: string): Promise<boolean> {
    const stmt = await db.prepare(`
      DELETE FROM accounts WHERE wallet_address = ?
    `);
    const result = stmt.run(walletAddress);
    return result.changes > 0;
  }

  /**
   * Get valid access token, refreshing if needed
   */
  public async getValidAccessToken(accountId: number): Promise<string | null> {
    const account = await this.getAccountById(accountId);
    if (!account || !account.access_token || !account.refresh_token) {
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    if (account.token_expiry && account.token_expiry > now + 300) {
      return account.access_token;
    }

    // Token needs refresh - this would need to be implemented
    // For now, return the existing token
    // In production, this should call Google's OAuth2 refresh endpoint
    console.log('[Accounts] Token refresh needed for account', accountId);
    return account.access_token;
  }

  // Synchronous compatibility wrappers using JSON fallback
  // These use the old JSON database for immediate access
  // while sql.js is loading asynchronously
  public getAccountByWalletSync(walletAddress: string): Account | null {
    // Use JSON fallback for sync calls
    return fallbackDb.getAccountByWallet(walletAddress);
  }

  public createOrUpdateAccountSync(account: Account): Account {
    // Use JSON fallback for sync calls
    const result = fallbackDb.createOrUpdateAccount(account);
    // Also trigger async SQLite save in background
    this.createOrUpdateAccountAsync(account).catch(err => {
      console.error('Background SQLite save failed:', err);
    });
    return result;
  }

  public deleteAccountSync(walletAddress: string): boolean {
    // Use JSON fallback for sync calls
    const result = fallbackDb.deleteAccount(walletAddress);
    // Also trigger async SQLite delete in background
    this.deleteAccountAsync(walletAddress).catch(err => {
      console.error('Background SQLite delete failed:', err);
    });
    return result;
  }
}

// Export singleton instance
export const accountsDb = new AccountsDatabase();
export default accountsDb;