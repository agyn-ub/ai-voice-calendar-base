import { supabaseAdmin } from '@/lib/supabase/admin';

export interface WalletEmailAssociation {
  wallet_address: string;
  email: string;
  verified_at?: string;
  created_from_stake?: boolean;
  created_at?: string;
  updated_at?: string;
}

class WalletEmailAssociationsDatabase {
  private tableName = 'wallet_email_associations';

  /**
   * Create or update a wallet-email association
   */
  public async createAssociation(
    walletAddress: string,
    email: string,
    createdFromStake: boolean = false
  ): Promise<WalletEmailAssociation | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .upsert({
          wallet_address: walletAddress.toLowerCase(),
          email: email.toLowerCase(),
          created_from_stake: createdFromStake,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[WalletEmailAssociations] Error creating association:', error);
        throw error;
      }

      console.log(`[WalletEmailAssociations] Associated wallet ${walletAddress} with email ${email}`);
      return data as WalletEmailAssociation;
    } catch (error) {
      console.error('[WalletEmailAssociations] Failed to create association:', error);
      return null;
    }
  }

  /**
   * Get association by wallet address
   */
  public async getAssociationByWallet(walletAddress: string): Promise<WalletEmailAssociation | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No association found
        }
        console.error('[WalletEmailAssociations] Error fetching association:', error);
        throw error;
      }

      return data as WalletEmailAssociation;
    } catch (error) {
      console.error('[WalletEmailAssociations] Failed to get association by wallet:', error);
      return null;
    }
  }

  /**
   * Get associations by email
   */
  public async getAssociationsByEmail(email: string): Promise<WalletEmailAssociation[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.tableName)
        .select('*')
        .eq('email', email.toLowerCase());

      if (error) {
        console.error('[WalletEmailAssociations] Error fetching associations by email:', error);
        throw error;
      }

      return data as WalletEmailAssociation[];
    } catch (error) {
      console.error('[WalletEmailAssociations] Failed to get associations by email:', error);
      return [];
    }
  }

  /**
   * Check if wallet is associated with an email
   */
  public async isWalletAssociated(walletAddress: string): Promise<boolean> {
    const association = await this.getAssociationByWallet(walletAddress);
    return association !== null;
  }

  /**
   * Update association
   */
  public async updateAssociation(
    walletAddress: string,
    updates: Partial<Omit<WalletEmailAssociation, 'wallet_address'>>
  ): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from(this.tableName)
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress.toLowerCase());

      if (error) {
        console.error('[WalletEmailAssociations] Error updating association:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('[WalletEmailAssociations] Failed to update association:', error);
      return false;
    }
  }
}

// Export singleton instance
export const walletEmailAssociationsDb = new WalletEmailAssociationsDatabase();
export default walletEmailAssociationsDb;