import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/types';

export interface Contact {
  id?: number;
  account_id: number;
  email: string;
  name?: string | null;
  created_at?: string;
}

export interface ContactSearchResult {
  email: string;
  name: string | null;
  confidence: number;
}

type ContactRow = Database['public']['Tables']['contacts']['Row'];
type ContactInsert = Database['public']['Tables']['contacts']['Insert'];

class ContactsDatabase {
  /**
   * Save contacts for an account (batch operation)
   */
  public async saveContacts(accountId: number, contacts: Array<{ email: string; name?: string | null }>): Promise<number> {
    try {
      // Prepare batch insert data
      const contactsToInsert: ContactInsert[] = contacts.map(contact => ({
        account_id: accountId,
        email: contact.email.toLowerCase(),
        name: contact.name || null
      }));

      // Batch insert with upsert (ON CONFLICT DO NOTHING)
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .upsert(contactsToInsert, {
          onConflict: 'account_id,email',
          ignoreDuplicates: true
        })
        .select();

      if (error) {
        console.error('[ContactsDB] Error inserting contacts:', error);
        throw error;
      }

      const inserted = data?.length || 0;
      console.log(`[ContactsDB] Inserted ${inserted} new contacts for account ${accountId}`);
      return inserted;
    } catch (error) {
      console.error('[ContactsDB] Failed to save contacts:', error);
      throw error;
    }
  }

  /**
   * Clear all contacts for an account
   */
  public async clearContacts(accountId: number): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('contacts')
        .delete()
        .eq('account_id', accountId);

      if (error) {
        console.error('[ContactsDB] Error clearing contacts:', error);
        throw error;
      }

      console.log(`[ContactsDB] Cleared contacts for account ${accountId}`);
      return true;
    } catch (error) {
      console.error('[ContactsDB] Failed to clear contacts:', error);
      return false;
    }
  }

  /**
   * Get contacts for display
   */
  public async getContacts(accountId: number, limit: number = 100): Promise<Contact[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('account_id', accountId)
        .order('name', { ascending: true })
        .order('email', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('[ContactsDB] Error fetching contacts:', error);
        throw error;
      }

      return (data || []) as Contact[];
    } catch (error) {
      console.error('[ContactsDB] Failed to get contacts:', error);
      return [];
    }
  }

  /**
   * Get contact count
   */
  public async getContactCount(accountId: number): Promise<number> {
    try {
      const { count, error } = await supabaseAdmin
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId);

      if (error) {
        console.error('[ContactsDB] Error counting contacts:', error);
        throw error;
      }

      return count || 0;
    } catch (error) {
      console.error('[ContactsDB] Failed to count contacts:', error);
      return 0;
    }
  }

  /**
   * Search contacts by name
   */
  public async searchContactsByName(accountId: number, searchQuery: string): Promise<ContactSearchResult[]> {
    try {
      // Use ILIKE for case-insensitive pattern matching
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .select('email, name')
        .eq('account_id', accountId)
        .or(`name.eq.${searchQuery},name.ilike.${searchQuery}%,name.ilike.%${searchQuery}%`)
        .order('name', { ascending: true })
        .order('email', { ascending: true })
        .limit(50);

      if (error) {
        console.error('[ContactsDB] Error searching contacts:', error);
        throw error;
      }

      const results = (data || []) as Array<{ email: string; name: string | null }>;

      // Sort by confidence and add confidence scores
      return results
        .map(contact => ({
          ...contact,
          confidence: this.calculateConfidence(contact.name, searchQuery)
        }))
        .sort((a, b) => {
          // Sort by confidence first
          if (b.confidence !== a.confidence) {
            return b.confidence - a.confidence;
          }
          // Then by name
          if (a.name && b.name) {
            return a.name.localeCompare(b.name);
          }
          // Then by email
          return a.email.localeCompare(b.email);
        });
    } catch (error) {
      console.error('[ContactsDB] Failed to search contacts:', error);
      return [];
    }
  }

  /**
   * Find best matching contact
   */
  public async findBestMatch(accountId: number, searchQuery: string): Promise<Contact | null> {
    const results = await this.searchContactsByName(accountId, searchQuery);

    if (results.length === 0) {
      // Try email search as fallback
      const emailResults = await this.searchByEmail(accountId, searchQuery);
      if (emailResults.length > 0) {
        return {
          account_id: accountId,
          email: emailResults[0].email,
          name: emailResults[0].name
        };
      }
      return null;
    }

    // Return the highest confidence match
    const best = results.reduce((prev, current) =>
      current.confidence > prev.confidence ? current : prev
    );

    return {
      account_id: accountId,
      email: best.email,
      name: best.name
    };
  }

  /**
   * Search by email
   */
  private async searchByEmail(accountId: number, email: string): Promise<ContactSearchResult[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('contacts')
        .select('email, name')
        .eq('account_id', accountId)
        .ilike('email', `%${email}%`)
        .order('email', { ascending: true })
        .limit(50);

      if (error) {
        console.error('[ContactsDB] Error searching by email:', error);
        throw error;
      }

      const results = (data || []) as Array<{ email: string; name: string | null }>;

      return results.map(contact => ({
        ...contact,
        confidence: contact.email.toLowerCase() === email.toLowerCase() ? 1.0 : 0.5
      }));
    } catch (error) {
      console.error('[ContactsDB] Failed to search by email:', error);
      return [];
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(contactName: string | null, searchQuery: string): number {
    if (!contactName) return 0.1;

    const nameLower = contactName.toLowerCase();
    const queryLower = searchQuery.toLowerCase();

    // Exact match
    if (nameLower === queryLower) return 1.0;

    // First name exact match
    const firstName = nameLower.split(' ')[0];
    if (firstName === queryLower) return 0.95;

    // Starts with query
    if (nameLower.startsWith(queryLower)) return 0.8;
    if (firstName.startsWith(queryLower)) return 0.75;

    // Contains query
    if (nameLower.includes(queryLower)) return 0.6;

    // Partial match
    const queryWords = queryLower.split(' ');
    const nameWords = nameLower.split(' ');
    const matchingWords = queryWords.filter(qw =>
      nameWords.some(nw => nw.includes(qw))
    );

    if (matchingWords.length > 0) {
      return 0.4 * (matchingWords.length / queryWords.length);
    }

    return 0.1;
  }

  // ===== SYNCHRONOUS FALLBACK METHODS =====
  // These methods provide immediate responses while async operations are processing
  // They return empty/default values and should only be used when absolutely necessary

  /**
   * Sync wrapper for saveContacts - triggers async save in background
   */
  public saveContactsSync(accountId: number, contacts: Array<{ email: string; name?: string | null }>): number {
    // Trigger async save in background
    this.saveContacts(accountId, contacts).catch(err => {
      console.error('[ContactsDB] Background save failed:', err);
    });

    // Return approximate count for immediate feedback
    return contacts.length;
  }

  /**
   * Sync wrapper for clearContacts
   */
  public clearContactsSync(accountId: number): boolean {
    // Trigger async clear in background
    this.clearContacts(accountId).catch(err => {
      console.error('[ContactsDB] Background clear failed:', err);
    });

    return true;
  }

  /**
   * Sync wrapper for searchContactsByName - returns empty array
   */
  public searchContactsByNameSync(): ContactSearchResult[] {
    console.warn('[ContactsDB] Using sync search - no results available until database loads');
    return [];
  }

  /**
   * Sync wrapper for findBestMatch - returns null
   */
  public findBestMatchSync(): Contact | null {
    console.warn('[ContactsDB] Using sync match - no results available until database loads');
    return null;
  }

  /**
   * Sync wrapper for getContactCount
   */
  public getContactCountSync(): number {
    console.warn('[ContactsDB] Using sync count - returning 0 until database loads');
    return 0;
  }

  /**
   * Sync wrapper for getContacts
   */
  public getContactsSync(): Contact[] {
    console.warn('[ContactsDB] Using sync get - returning empty until database loads');
    return [];
  }
}

// Export singleton instance
export const postgresContactsDb = new ContactsDatabase();
export default postgresContactsDb;