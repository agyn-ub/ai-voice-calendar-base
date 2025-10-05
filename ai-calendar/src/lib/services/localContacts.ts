import { accountsDb } from '@/lib/db/accountsDb';
import { contactsDb } from '@/lib/db/contactsDb';

export interface ResolveResult {
  resolved: string[];  // Array of resolved email addresses
  details: string[];   // Human-readable resolution details
  ambiguous?: AmbiguousContact[]; // Contacts needing disambiguation
}

export interface AmbiguousContact {
  searchQuery: string;
  matches: ContactMatch[];
}

export interface ContactMatch {
  email: string;
  name: string;
  confidence: number;
}

class LocalContactsService {
  /**
   * Resolve attendees from names or emails using local database
   */
  async resolveAttendees(walletAddress: string, attendees: string[]): Promise<ResolveResult> {
    console.log(`[LocalContacts] Resolving ${attendees.length} attendees for wallet: ${walletAddress}`);

    // Get account ID
    const account = accountsDb.getAccountByWalletSync(walletAddress);
    if (!account || !account.id) {
      console.warn('[LocalContacts] No account found for wallet address');
      return { resolved: [], details: ['✗ No calendar connection found'] };
    }

    const resolved: string[] = [];
    const details: string[] = [];
    const ambiguous: AmbiguousContact[] = [];

    for (const attendee of attendees) {
      if (!attendee || attendee.trim() === '') {
        continue;
      }

      const trimmed = attendee.trim();

      // Check if it's an email address
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(trimmed)) {
        // It's already an email address, use it directly
        console.log(`[LocalContacts] ✓ Direct email: ${trimmed}`);
        resolved.push(trimmed.toLowerCase());
        details.push(`✓ ${trimmed} (email address)`);
      } else {
        // It's a name, search in contacts
        const searchResults = await contactsDb.searchContactsByName(account.id, trimmed);

        console.log(`[LocalContacts] Search for "${trimmed}" returned ${searchResults.length} results:`,
          searchResults.map(r => ({ name: r.name, email: r.email, confidence: r.confidence })));

        if (searchResults.length === 0) {
          // No matches found
          console.warn(`[LocalContacts] ✗ Could not find contact for: "${trimmed}"`);
          details.push(`✗ ${trimmed} (contact not found)`);
        } else if (searchResults.length === 1) {
          // Single match, use it
          const contact = searchResults[0];
          console.log(`[LocalContacts] ✓ Resolved "${trimmed}" to ${contact.name || 'Unknown'} (${contact.email})`);
          resolved.push(contact.email);
          details.push(`✓ ${contact.name || trimmed} (${contact.email})`);
        } else {
          // Multiple matches - check if we need disambiguation
          const highConfidenceMatches = searchResults.filter(r => r.confidence >= 0.8);

          console.log(`[LocalContacts] Found ${highConfidenceMatches.length} high-confidence matches (>= 0.8):`,
            highConfidenceMatches.map(m => ({ name: m.name, email: m.email, confidence: m.confidence })));

          if (highConfidenceMatches.length > 1) {
            // Multiple high-confidence matches - need disambiguation
            console.log(`[LocalContacts] ⚠ Ambiguous: "${trimmed}" matches ${highConfidenceMatches.length} contacts - DISAMBIGUATION NEEDED`);
            ambiguous.push({
              searchQuery: trimmed,
              matches: highConfidenceMatches.map(m => ({
                email: m.email,
                name: m.name || m.email,
                confidence: m.confidence
              }))
            });
            details.push(`⚠ ${trimmed} (${highConfidenceMatches.length} matches - needs clarification)`);
          } else if (highConfidenceMatches.length === 1) {
            // Single high-confidence match, use it
            const contact = highConfidenceMatches[0];
            console.log(`[LocalContacts] ✓ Resolved "${trimmed}" to ${contact.name || 'Unknown'} (${contact.email})`);
            resolved.push(contact.email);
            details.push(`✓ ${contact.name || trimmed} (${contact.email})`);
          } else {
            // Only low confidence matches - use the best one but note it
            const best = searchResults[0];
            console.log(`[LocalContacts] ~ Low confidence match: "${trimmed}" to ${best.name || 'Unknown'} (${best.email})`);
            resolved.push(best.email);
            details.push(`~ ${best.name || trimmed} (${best.email}) - low confidence match`);
          }
        }
      }
    }

    console.log(`[LocalContacts] Resolution complete. Resolved ${resolved.length}/${attendees.length} attendees, ${ambiguous.length} need disambiguation`);

    const result: ResolveResult = { resolved, details };
    if (ambiguous.length > 0) {
      result.ambiguous = ambiguous;
    }
    return result;
  }

  /**
   * Search contacts by name
   */
  async searchContactsByName(walletAddress: string, searchQuery: string) {
    const account = accountsDb.getAccountByWalletSync(walletAddress);
    if (!account || !account.id) {
      console.warn('[LocalContacts] No account found for wallet address');
      return [];
    }

    const results = contactsDb.searchContactsByNameSync(account.id, searchQuery);

    // Map to format expected by existing code
    return results.map(contact => ({
      name: contact.name || contact.email,
      email: contact.email,
      confidence: this.mapConfidenceLevel(contact.confidence)
    }));
  }

  /**
   * Get the best matching contact's email for a given name
   */
  async getContactEmail(walletAddress: string, name: string): Promise<{ email: string; displayName: string } | null> {
    const account = accountsDb.getAccountByWalletSync(walletAddress);
    if (!account || !account.id) {
      return null;
    }

    const contact = contactsDb.findBestMatchSync(account.id, name);

    if (contact) {
      return {
        email: contact.email,
        displayName: contact.name || contact.email
      };
    }

    return null;
  }

  /**
   * Get all contacts for a wallet
   */
  async listContacts(walletAddress: string, limit: number = 100) {
    const account = accountsDb.getAccountByWalletSync(walletAddress);
    if (!account || !account.id) {
      return [];
    }

    const contacts = contactsDb.getContactsSync(account.id, limit);

    // Format for compatibility with existing code
    return contacts.map(contact => ({
      name: contact.name || 'No Name',
      firstName: contact.name ? contact.name.split(' ')[0] : undefined,
      lastName: contact.name ? contact.name.split(' ').slice(1).join(' ') : undefined,
      primaryEmail: contact.email,
      emails: [{ value: contact.email, type: 'other', primary: true }]
    }));
  }

  /**
   * Get contact count
   */
  async getContactCount(walletAddress: string): number {
    const account = accountsDb.getAccountByWalletSync(walletAddress);
    if (!account || !account.id) {
      return 0;
    }

    return contactsDb.getContactCountSync(account.id);
  }

  /**
   * Map confidence score to level
   */
  private mapConfidenceLevel(score: number): 'exact' | 'high' | 'medium' | 'low' {
    if (score >= 0.95) return 'exact';
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  }
}

// Export singleton instance
export const localContactsService = new LocalContactsService();
export default localContactsService;