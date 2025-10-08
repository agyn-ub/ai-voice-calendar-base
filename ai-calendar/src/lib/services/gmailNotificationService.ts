import { google, gmail_v1 } from 'googleapis';
import { postgresAccountsDb } from '@/lib/db/postgresAccountsDb';

export interface StakeInvitationData {
  title: string;
  startTime: Date;
  endTime: Date;
  stakeAmount: number;
  meetingId: string;
  organizerName?: string;
  location?: string;
}

export class GmailNotificationService {
  private gmail: gmail_v1.Gmail;
  private oauth2Client;
  private userEmail: string | null = null;

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

  /**
   * Create service instance from wallet address
   */
  static async createFromWallet(walletAddress: string): Promise<GmailNotificationService | null> {
    const account = await postgresAccountsDb.getAccountByWallet(walletAddress);
    if (!account || !account.access_token || !account.refresh_token) {
      console.error('[GmailNotification] No valid tokens for wallet:', walletAddress);
      return null;
    }

    const service = new GmailNotificationService(
      account.access_token,
      account.refresh_token
    );
    service.userEmail = account.google_email || null;
    return service;
  }

  /**
   * Send stake invitation email to attendees
   */
  async sendStakeInvitation(
    toEmails: string[],
    meetingData: StakeInvitationData
  ): Promise<boolean> {
    try {
      const subject = `Action Required: Stake ${meetingData.stakeAmount} ETH for "${meetingData.title}"`;

      // Format date and time
      const dateStr = meetingData.startTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeStr = meetingData.startTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      // Calculate deadline (1 hour before meeting)
      const stakeDeadline = new Date(meetingData.startTime.getTime() - 60 * 60 * 1000);
      const deadlineStr = `${stakeDeadline.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })} at ${stakeDeadline.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })}`;

      // Build HTML body
      const htmlBody = this.buildStakeInvitationHTML({
        ...meetingData,
        dateStr,
        timeStr,
        deadlineStr,
        stakeLink: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/stake/${meetingData.meetingId}`
      });

      // Compose the email message
      const message = this.createMimeMessage(
        toEmails.join(', '),
        subject,
        htmlBody
      );

      // Send the email
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(message).toString('base64url')
        }
      });

      console.log('[GmailNotification] Stake invitation sent:', response.data.id);
      return true;
    } catch (error) {
      console.error('[GmailNotification] Error sending stake invitation:', error);
      return false;
    }
  }

  /**
   * Send stake confirmation email
   */
  async sendStakeConfirmation(
    toEmail: string,
    meetingTitle: string,
    stakeAmount: number
  ): Promise<boolean> {
    try {
      const subject = `✅ Stake Confirmed: ${stakeAmount} ETH for "${meetingTitle}"`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00D4FF;">Stake Confirmed!</h2>
          <p>Your stake of <strong>${stakeAmount} ETH</strong> has been successfully recorded for:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${meetingTitle}</h3>
          </div>
          <p><strong>What's next?</strong></p>
          <ul>
            <li>Attend the meeting on time</li>
            <li>Get the attendance code from the organizer</li>
            <li>Submit the code to reclaim your stake</li>
          </ul>
          <p style="color: #666; font-size: 14px;">
            If you miss the meeting without valid reason, your stake will be forfeited and distributed among attendees.
          </p>
        </div>
      `;

      const message = this.createMimeMessage(toEmail, subject, htmlBody);

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(message).toString('base64url')
        }
      });

      return true;
    } catch (error) {
      console.error('[GmailNotification] Error sending stake confirmation:', error);
      return false;
    }
  }

  /**
   * Send attendance code to organizer
   */
  async sendAttendanceCode(
    organizerEmail: string,
    meetingTitle: string,
    attendanceCode: string
  ): Promise<boolean> {
    try {
      const subject = `Attendance Code for "${meetingTitle}": ${attendanceCode}`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00D4FF;">Your Meeting Has Started</h2>
          <p>Share this attendance code with attendees:</p>
          <div style="background: #f0f9ff; border: 2px solid #00D4FF; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h1 style="color: #00D4FF; margin: 0; font-size: 36px; letter-spacing: 4px;">${attendanceCode}</h1>
          </div>
          <p><strong>Instructions:</strong></p>
          <ol>
            <li>Share this code with all attendees at the meeting</li>
            <li>Attendees must submit this code to reclaim their stake</li>
            <li>Code expires 15 minutes after meeting ends</li>
          </ol>
        </div>
      `;

      const message = this.createMimeMessage(organizerEmail, subject, htmlBody);

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(message).toString('base64url')
        }
      });

      return true;
    } catch (error) {
      console.error('[GmailNotification] Error sending attendance code:', error);
      return false;
    }
  }

  /**
   * Create MIME message for Gmail API
   */
  private createMimeMessage(to: string, subject: string, htmlBody: string): string {
    const boundary = '----=_Part_0_' + Date.now();

    const message = [
      `From: ${this.userEmail || 'me'}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      this.htmlToPlainText(htmlBody),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
      '',
      `--${boundary}--`
    ].join('\r\n');

    return message;
  }

  /**
   * Build HTML for stake invitation email
   */
  private buildStakeInvitationHTML(data: {
    title: string;
    dateStr: string;
    timeStr: string;
    stakeAmount: number;
    deadlineStr: string;
    stakeLink: string;
    organizerName?: string;
    location?: string;
  }): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Staking Required</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.95;">Confirm your attendance with ETH</p>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px; padding: 30px;">
          <h2 style="color: #2d3748; margin-top: 0;">${data.title}</h2>

          <div style="background: #f7fafc; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${data.dateStr}</p>
            <p style="margin: 5px 0;"><strong>⏰ Time:</strong> ${data.timeStr}</p>
            ${data.location ? `<p style="margin: 5px 0;"><strong>📍 Location:</strong> ${data.location}</p>` : ''}
            ${data.organizerName ? `<p style="margin: 5px 0;"><strong>👤 Organizer:</strong> ${data.organizerName}</p>` : ''}
          </div>

          <div style="background: #fff5f5; border: 1px solid #feb2b2; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; color: #c53030; font-size: 14px; font-weight: 600;">REQUIRED STAKE</p>
            <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #2d3748;">${data.stakeAmount} ETH</p>
            <p style="margin: 10px 0 0 0; color: #718096; font-size: 14px;">Deadline: ${data.deadlineStr}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.stakeLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Stake Now →
            </a>
          </div>

          <div style="background: #edf2f7; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2d3748;">How it works:</h3>
            <ol style="color: #4a5568; line-height: 1.8;">
              <li>Stake ${data.stakeAmount} ETH to confirm your attendance</li>
              <li>Attend the meeting and receive an attendance code</li>
              <li>Submit the code to reclaim your stake</li>
              <li>Miss the meeting? Your stake is forfeited to attendees</li>
            </ol>
          </div>

          <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
            Questions? Reply to this email or contact the meeting organizer.
          </p>
        </div>

        <p style="color: #a0aec0; font-size: 12px; text-align: center; margin-top: 20px;">
          Powered by AI Voice Calendar | Built on Base
        </p>
      </div>
    `;
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  private htmlToPlainText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}