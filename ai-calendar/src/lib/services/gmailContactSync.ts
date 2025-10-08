import { google, gmail_v1 } from 'googleapis';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';

export class GmailContactSyncService {
  private gmail: gmail_v1.Gmail;
  private oauth2Client;

  constructor(accessToken: string, refreshToken: string) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/google/callback'
    );

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  static async createFromWallet(walletAddress: string): Promise<GmailContactSyncService | null> {
    const account = await postgresAccountsDb.getAccountByWallet(walletAddress);
    if (!account || !account.access_token || !account.refresh_token) {
      return null;
    }
    return new GmailContactSyncService(
      account.access_token,
      account.refresh_token
    );
  }

  /**
   * Extract ALL contacts from Gmail message headers with pagination
   * Only reads metadata (From, To, Cc, Bcc) without accessing message bodies
   * Implements rate limiting to avoid Google API quota errors
   */
  async extractContactsFromGmail(maxPages: number = 10, options?: {
    batchSize?: number;
    batchDelay?: number;
    pageDelay?: number;
  }): Promise<Array<{ email: string; name: string | null }>> {
    const contactMap = new Map<string, { email: string; name: string | null }>();
    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    let totalMessagesProcessed = 0;
    let rateLimitErrors = 0;

    // Configuration with safe defaults to avoid rate limits
    const pageSize = 500; // Messages per page
    const batchSize = options?.batchSize || 10; // Process 10 messages at a time (50 quota units)
    const batchDelay = options?.batchDelay || 1000; // 1 second between batches
    const pageDelay = options?.pageDelay || 2000; // 2 seconds between pages

    try {
      console.log('[Gmail] Starting contact extraction from Gmail...');
      console.log(`[Gmail] Config: ${batchSize} messages per batch, ${batchDelay}ms between batches`);

      // Continue fetching pages until no more pages or max pages reached
      do {
        pageCount++;
        console.log(`[Gmail] Fetching page ${pageCount} of max ${maxPages}...`);

        // List messages with metadata scope only
        const response = await this.gmail.users.messages.list({
          userId: 'me',
          maxResults: pageSize,
          pageToken: pageToken
        });

        if (!response.data.messages || response.data.messages.length === 0) {
          console.log('[Gmail] No more messages found');
          break;
        }

        const messagesInPage = response.data.messages.length;
        console.log(`[Gmail] Processing ${messagesInPage} messages from page ${pageCount}...`);

        // Process messages in smaller batches to avoid rate limits
        for (let i = 0; i < messagesInPage; i += batchSize) {
          const batch = response.data.messages.slice(i, Math.min(i + batchSize, messagesInPage));
          const batchNumber = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(messagesInPage / batchSize);

          console.log(`[Gmail] Processing batch ${batchNumber}/${totalBatches} of page ${pageCount}...`);

          // Batch get message metadata with retry on rate limit
          const messagePromises = batch.map(async (message) => {
            let retries = 0;
            const maxRetries = 3;
            let delay = 1000;

            while (retries < maxRetries) {
              try {
                return await this.gmail.users.messages.get({
                  userId: 'me',
                  id: message.id!,
                  format: 'METADATA',
                  metadataHeaders: ['From', 'To', 'Cc', 'Bcc'],
                });
              } catch (err: unknown) {
                // Check if it's a rate limit error
                const error = err as { code?: number; message?: string };
                if (error?.code === 429 || error?.message?.includes('quota') || error?.message?.includes('limit')) {
                  retries++;
                  rateLimitErrors++;

                  if (retries < maxRetries) {
                    console.log(`[Gmail] Rate limit hit for message ${message.id}, retrying in ${delay}ms (attempt ${retries}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                  } else {
                    console.log(`[Gmail] Failed to fetch message ${message.id} after ${maxRetries} retries`);
                    return null;
                  }
                } else {
                  // Other error, skip message
                  return null;
                }
              }
            }
            return null;
          });

          const messages = await Promise.all(messagePromises);

          // Process each message's headers
          for (const messageResponse of messages) {
            if (!messageResponse?.data?.payload?.headers) continue;

            const headers = messageResponse.data.payload.headers;

            // Extract contacts from all email fields
            const emailFields = ['From', 'To', 'Cc', 'Bcc'];

            for (const field of emailFields) {
              const header = headers.find(h => h.name === field);
              if (!header?.value) continue;

              // Parse email addresses from header
              const addresses = this.parseEmailAddresses(header.value);

              for (const { email, name } of addresses) {
                // Skip noreply and system emails
                if (this.isSystemEmail(email)) continue;

                // Store contact with name if we have it, or update name if better
                if (contactMap.has(email)) {
                  const existing = contactMap.get(email)!;
                  // Update name if we found one and didn't have it before
                  if (name && !existing.name) {
                    existing.name = name;
                  }
                } else {
                  contactMap.set(email, {
                    email,
                    name: name || null,
                  });
                }
              }
            }
          }

          // Add delay between batches to avoid rate limiting
          if (i + batchSize < messagesInPage) {
            console.log(`[Gmail] Waiting ${batchDelay}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, batchDelay));
          }
        }

        totalMessagesProcessed += messagesInPage;
        console.log(`[Gmail] Page ${pageCount} complete. Total messages processed: ${totalMessagesProcessed}, Unique contacts found: ${contactMap.size}`);

        // Get next page token
        pageToken = response.data.nextPageToken;

        // Add delay between pages to avoid rate limiting
        if (pageToken && pageCount < maxPages) {
          console.log(`[Gmail] Waiting ${pageDelay}ms before next page...`);
          await new Promise(resolve => setTimeout(resolve, pageDelay));
        }

      } while (pageToken && pageCount < maxPages);

      // Convert map to array
      const contacts = Array.from(contactMap.values());

      console.log(`[Gmail] Extraction complete! Processed ${pageCount} pages, ${totalMessagesProcessed} messages`);
      console.log(`[Gmail] Found ${contacts.length} unique contacts`);
      if (rateLimitErrors > 0) {
        console.log(`[Gmail] Encountered ${rateLimitErrors} rate limit errors (handled with retries)`);
      }

      return contacts;

    } catch (error) {
      console.error('[Gmail] Error extracting contacts:', error);
      throw error;
    }
  }

  /**
   * Parse email addresses from a header value
   * Handles formats like:
   * - "Name <email@example.com>"
   * - "email@example.com"
   * - "Name <email1@example.com>, Name2 <email2@example.com>"
   */
  private parseEmailAddresses(headerValue: string): { email: string; name?: string }[] {
    const results: { email: string; name?: string }[] = [];

    // Split by comma for multiple addresses
    const parts = headerValue.split(',');

    for (const part of parts) {
      const trimmed = part.trim();

      // Match "Name <email>" format
      const matchWithName = trimmed.match(/^"?([^"<>]+?)"?\s*<([^>]+)>$/);
      if (matchWithName) {
        const name = matchWithName[1].trim();
        const email = matchWithName[2].trim().toLowerCase();
        results.push({ email, name });
        continue;
      }

      // Match plain email format
      const matchEmail = trimmed.match(/^<?([^<>@]+@[^<>@]+)>?$/);
      if (matchEmail) {
        const email = matchEmail[1].trim().toLowerCase();
        results.push({ email });
      }
    }

    return results;
  }

  /**
   * Check if an email is a system/noreply address
   */
  private isSystemEmail(email: string): boolean {
    const systemPatterns = [
      /^no-?reply@/i,
      /^do-?not-?reply@/i,
      /^notifications?@/i,
      /^system@/i,
      /^alerts?@/i,
      /^mailer@/i,
      /^postmaster@/i,
      /^bounce@/i,
      /@noreply\./i,
    ];

    return systemPatterns.some(pattern => pattern.test(email));
  }

  /**
   * Get a summary of extracted contacts
   */
  async getContactsSummary(maxPages: number = 1): Promise<{
    totalContacts: number;
    sampleContacts: Array<{ email: string; name: string | null }>;
    withNames: number;
    withoutNames: number;
  }> {
    const contacts = await this.extractContactsFromGmail(maxPages);

    return {
      totalContacts: contacts.length,
      sampleContacts: contacts.slice(0, 20),
      withNames: contacts.filter(c => c.name !== null).length,
      withoutNames: contacts.filter(c => c.name === null).length,
    };
  }
}