import db from './sqlite';

export interface Contact {
  id?: number;
  account_id: number;
  email: string;
  name?: string | null;
  created_at?: number;
}

export interface ContactSearchResult {
  email: string;
  name: string | null;
  confidence: number;
}

class ContactsDatabase {
  /**
   * Save contacts for an account (batch operation) - ASYNC
   */
  public async saveContacts(accountId: number, contacts: Array<{ email: string; name?: string | null }>): Promise<number> {
    let inserted = 0;

    // Ensure database is initialized
    await db.initialize();

    // Use transaction for batch insert
    await db.transaction(async () => {
      const stmt = await db.prepare(`
        INSERT OR IGNORE INTO contacts (account_id, email, name)
        VALUES (?, ?, ?)
      `);

      for (const contact of contacts) {
        const result = stmt.run([
          accountId,
          contact.email.toLowerCase(),
          contact.name || null
        ]);
        if (result.changes > 0) inserted++;
      }
    });

    console.log(`[ContactsDB] Inserted ${inserted} new contacts for account ${accountId}`);
    return inserted;
  }

  /**
   * Clear all contacts for an account - ASYNC
   */
  public async clearContacts(accountId: number): Promise<boolean> {
    await db.initialize();
    const stmt = await db.prepare(`
      DELETE FROM contacts WHERE account_id = ?
    `);
    const result = stmt.run(accountId);
    return result.changes > 0;
  }

  /**
   * Update last sync time - ASYNC
   */
  public async updateSyncTime(accountId: number): Promise<void> {
    await db.initialize();
    const stmt = await db.prepare(`
      UPDATE accounts
      SET last_sync_at = unixepoch(),
          updated_at = unixepoch()
      WHERE id = ?
    `);
    stmt.run(accountId);
  }

  /**
   * Get contacts for display - ASYNC
   */
  public async getContacts(accountId: number, limit: number = 100): Promise<Contact[]> {
    await db.initialize();
    const stmt = await db.prepare(`
      SELECT * FROM contacts
      WHERE account_id = ?
      ORDER BY name, email
      LIMIT ?
    `);
    return stmt.all([accountId, limit]) as Contact[];
  }

  /**
   * Get contact count - ASYNC
   */
  public async getContactCount(accountId: number): Promise<number> {
    await db.initialize();
    const stmt = await db.prepare(`
      SELECT COUNT(*) as count FROM contacts
      WHERE account_id = ?
    `);
    const result = stmt.get(accountId) as { count: number };
    return result?.count || 0;
  }

  /**
   * Search contacts by name - ASYNC
   */
  public async searchContactsByName(accountId: number, searchQuery: string): Promise<ContactSearchResult[]> {
    await db.initialize();
    const stmt = await db.prepare(`
      SELECT email, name FROM contacts
      WHERE account_id = ?
      AND (
        name = ?                  -- Exact match
        OR name LIKE ?            -- Starts with
        OR name LIKE ?            -- Contains
      )
      ORDER BY
        CASE
          WHEN name = ? THEN 1    -- Exact match (using = for precision)
          WHEN name LIKE ? THEN 2 -- Starts with
          ELSE 3                  -- Contains
        END,
        name,
        email                     -- Secondary sort by email for consistent ordering
      LIMIT 50
    `);

    const exactMatch = searchQuery;
    const startsWithPattern = `${searchQuery}%`;
    const containsPattern = `%${searchQuery}%`;

    const results = stmt.all([
      accountId,
      exactMatch,
      startsWithPattern,
      containsPattern,
      exactMatch,
      startsWithPattern
    ]) as Array<{ email: string; name: string | null }>;

    return results.map(contact => ({
      ...contact,
      confidence: this.calculateConfidence(contact.name, searchQuery)
    }));
  }

  /**
   * Find best matching contact - ASYNC
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
   * Search by email - ASYNC
   */
  private async searchByEmail(accountId: number, email: string): Promise<ContactSearchResult[]> {
    await db.initialize();
    const stmt = await db.prepare(`
      SELECT email, name FROM contacts
      WHERE account_id = ?
      AND email LIKE ?
      ORDER BY email
      LIMIT 50
    `);

    const results = stmt.all([accountId, `%${email}%`]) as Array<{ email: string; name: string | null }>;

    return results.map(contact => ({
      ...contact,
      confidence: contact.email.toLowerCase() === email.toLowerCase() ? 1.0 : 0.5
    }));
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
  public searchContactsByNameSync(accountId: number, searchQuery: string): ContactSearchResult[] {
    console.warn('[ContactsDB] Using sync search - no results available until database loads');
    return [];
  }

  /**
   * Sync wrapper for findBestMatch - returns null
   */
  public findBestMatchSync(accountId: number, searchQuery: string): Contact | null {
    console.warn('[ContactsDB] Using sync match - no results available until database loads');
    return null;
  }

  /**
   * Sync wrapper for getContactCount
   */
  public getContactCountSync(accountId: number): number {
    console.warn('[ContactsDB] Using sync count - returning 0 until database loads');
    return 0;
  }

  /**
   * Sync wrapper for getContacts
   */
  public getContactsSync(accountId: number, limit: number = 100): Contact[] {
    console.warn('[ContactsDB] Using sync get - returning empty until database loads');
    return [];
  }
}

// Export singleton instance
export const contactsDb = new ContactsDatabase();
export default contactsDb;