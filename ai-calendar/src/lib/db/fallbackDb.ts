// Fallback to JSON database for immediate use while SQLite loads
import { getCalendarConnection as getConnectionJSON, saveCalendarConnection as saveConnectionJSON, deleteCalendarConnection as deleteConnectionJSON } from './index';
import { Account } from './accountsDb';

/**
 * Fallback database using JSON for synchronous operations
 * This is used while sql.js WebAssembly is loading
 */
export class FallbackDatabase {
  public getAccountByWallet(walletAddress: string): Account | null {
    const connection = getConnectionJSON(walletAddress);
    if (!connection) return null;

    // Use a fake ID based on wallet address hash for fallback compatibility
    // This ensures the account passes ID checks
    const fakeId = walletAddress.split('').reduce((acc, char) => acc + char.charCodeAt(0), 1);

    return {
      id: fakeId,
      wallet_address: connection.wallet_address,
      google_email: connection.google_email,
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      token_expiry: connection.token_expiry,
      created_at: connection.created_at,
      updated_at: connection.updated_at,
    };
  }

  public createOrUpdateAccount(account: Account): Account {
    const saved = saveConnectionJSON({
      wallet_address: account.wallet_address,
      google_email: account.google_email,
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      token_expiry: account.token_expiry,
      created_at: account.created_at,
      updated_at: account.updated_at,
    });

    // Use a fake ID based on wallet address hash for fallback compatibility
    const fakeId = saved.wallet_address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 1);

    return {
      id: fakeId,
      wallet_address: saved.wallet_address,
      google_email: saved.google_email,
      access_token: saved.access_token,
      refresh_token: saved.refresh_token,
      token_expiry: saved.token_expiry,
      created_at: saved.created_at,
      updated_at: saved.updated_at,
    };
  }

  public deleteAccount(walletAddress: string): boolean {
    return deleteConnectionJSON(walletAddress);
  }
}

export const fallbackDb = new FallbackDatabase();