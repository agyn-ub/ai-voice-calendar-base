import { google, calendar_v3 } from 'googleapis';
import { accountsDb } from '@/lib/db/accountsDb';

export class GoogleCalendarService {
  private oauth2Client;
  
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/google/callback'
    );
  }
  
  async refreshAccessToken(walletAddress: string): Promise<string | null> {
    const account = accountsDb.getAccountByWalletSync(walletAddress);

    if (!account || !account.id || !account.refresh_token) {
      console.error('No refresh token found for wallet:', walletAddress);
      return null;
    }

    try {
      this.oauth2Client.setCredentials({
        refresh_token: account.refresh_token
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (credentials.access_token) {
        // Update tokens in database
        const tokenExpiry = credentials.expiry_date ?
          Math.floor(credentials.expiry_date / 1000) :
          Math.floor(Date.now() / 1000) + 3600;

        await accountsDb.updateTokens(
          account.id,
          {
            access_token: credentials.access_token,
            refresh_token: credentials.refresh_token || undefined,
            token_expiry: tokenExpiry
          }
        );

        return credentials.access_token;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }

    return null;
  }
  
  async getValidToken(walletAddress: string): Promise<string | null> {
    const account = accountsDb.getAccountByWalletSync(walletAddress);

    if (!account || !account.access_token) {
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5 minutes

    if (account.token_expiry && account.token_expiry - bufferTime <= now) {
      // Token is expired or about to expire, refresh it
      return await this.refreshAccessToken(walletAddress);
    }

    return account.access_token;
  }
  
  async getCalendarEvents(walletAddress: string, timeMin?: Date, timeMax?: Date, maxResults?: number) {
    const accessToken = await this.getValidToken(walletAddress);
    
    if (!accessToken) {
      throw new Error('No valid access token available');
    }
    
    this.oauth2Client.setCredentials({
      access_token: accessToken
    });
    
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin?.toISOString() || new Date().toISOString(),
        timeMax: timeMax?.toISOString(),
        maxResults: maxResults || 50,
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }
  
  async createCalendarEvent(walletAddress: string, event: calendar_v3.Schema$Event) {
    const accessToken = await this.getValidToken(walletAddress);
    
    if (!accessToken) {
      throw new Error('No valid access token available');
    }
    
    this.oauth2Client.setCredentials({
      access_token: accessToken
    });
    
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'all' // Send email invitations to all attendees
      });
      
      console.log('[Calendar] Event created with email invitations enabled');
      return response.data;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }
  
  async updateCalendarEvent(walletAddress: string, eventId: string, event: Partial<calendar_v3.Schema$Event>) {
    const accessToken = await this.getValidToken(walletAddress);
    
    if (!accessToken) {
      throw new Error('No valid access token available');
    }
    
    this.oauth2Client.setCredentials({
      access_token: accessToken
    });
    
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    try {
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: event,
        sendUpdates: 'all' // Send email notifications to all attendees about the update
      });
      
      console.log('[Calendar] Event updated with email notifications enabled');
      return response.data;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw error;
    }
  }
  
  async deleteCalendarEvent(walletAddress: string, eventId: string) {
    const accessToken = await this.getValidToken(walletAddress);
    
    if (!accessToken) {
      throw new Error('No valid access token available');
    }
    
    this.oauth2Client.setCredentials({
      access_token: accessToken
    });
    
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const googleCalendarService = new GoogleCalendarService();