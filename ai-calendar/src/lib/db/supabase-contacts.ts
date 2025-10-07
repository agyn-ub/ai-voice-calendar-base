import { supabaseAdmin } from '@/lib/supabase/admin';

export interface Contact {
  id?: number;
  account_id: number;
  email: string;
  name: string | null;
  phone?: string | null;
  organization?: string | null;
  created_at?: string;
}

export interface SimpleContact {
  email: string;
  name: string | null;
}

export interface ContactSearchResult {
  email: string;
  name: string;
  confidence: number;
}

class SupabaseContactsDatabase {
  /**
   * Save multiple contacts for an account
   */
  public async saveContacts(accountId: number, contacts: SimpleContact[]): Promise<number> {
    if (!contacts || contacts.length === 0) return 0;

    // Prepare contacts for insertion
    const contactsToInsert = contacts.map(contact => ({
      account_id: accountId,
      email: contact.email.toLowerCase(),
      name: contact.name,
    }));

    // Insert contacts (upsert based on account_id and email)
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .upsert(contactsToInsert, {
        onConflict: 'account_id,email',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('[Contacts] Error saving contacts:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Search contacts by name for a specific account
   */
  public async searchContactsByName(
    accountId: number,
    searchQuery: string,
    limit: number = 5
  ): Promise<ContactSearchResult[]> {
    const normalizedQuery = searchQuery.toLowerCase().trim();

    // Search for contacts where name contains the search query
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('email, name')
      .eq('account_id', accountId)
      .or(`name.ilike.%${normalizedQuery}%,email.ilike.%${normalizedQuery}%`)
      .limit(limit);

    if (error || !data) return [];

    // Calculate confidence scores and sort
    const results = data
      .map(contact => ({
        email: contact.email,
        name: contact.name || contact.email,
        confidence: this.calculateConfidence(contact.name || '', normalizedQuery)
      }))
      .sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  /**
   * Get all contacts for an account
   */
  public async getContactsByAccount(accountId: number): Promise<Contact[]> {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('account_id', accountId)
      .order('name', { ascending: true });

    if (error || !data) return [];
    return data;
  }

  /**
   * Get a single contact by email for an account
   */
  public async getContactByEmail(
    accountId: number,
    email: string
  ): Promise<Contact | null> {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('account_id', accountId)
      .eq('email', email.toLowerCase())
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Delete all contacts for an account
   */
  public async deleteContactsForAccount(accountId: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('contacts')
      .delete()
      .eq('account_id', accountId);

    return !error;
  }

  /**
   * Count contacts for an account
   */
  public async countContacts(accountId: number): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId);

    if (error || !count) return 0;
    return count;
  }

  /**
   * Calculate confidence score for a contact match
   */
  private calculateConfidence(contactName: string, searchQuery: string): number {
    if (!contactName) return 0.1;

    const name = contactName.toLowerCase();
    const query = searchQuery.toLowerCase();

    // Exact match
    if (name === query) return 1.0;

    // Name starts with query
    if (name.startsWith(query)) return 0.9;

    // Any word in name starts with query
    const words = name.split(/\s+/);
    if (words.some(word => word.startsWith(query))) return 0.8;

    // Query is contained in name
    if (name.includes(query)) return 0.6;

    // Partial match in any word
    if (words.some(word => word.includes(query))) return 0.4;

    // Fuzzy match (basic)
    const queryChars = query.split('');
    let matchCount = 0;
    let lastIndex = -1;
    
    for (const char of queryChars) {
      const index = name.indexOf(char, lastIndex + 1);
      if (index > lastIndex) {
        matchCount++;
        lastIndex = index;
      }
    }

    return matchCount / queryChars.length * 0.3;
  }

  /**
   * Batch update contacts
   */
  public async updateContacts(
    accountId: number,
    updates: Array<{ email: string; name?: string; phone?: string; organization?: string }>
  ): Promise<number> {
    let updateCount = 0;

    for (const update of updates) {
      const { error } = await supabaseAdmin
        .from('contacts')
        .update({
          name: update.name,
          phone: update.phone,
          organization: update.organization,
        })
        .eq('account_id', accountId)
        .eq('email', update.email.toLowerCase());

      if (!error) updateCount++;
    }

    return updateCount;
  }
}

// Export singleton instance
export const contactsDb = new SupabaseContactsDatabase();
export default contactsDb;