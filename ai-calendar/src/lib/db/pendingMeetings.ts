import db from './sqlite';

export interface PendingMeeting {
  id?: number;
  meeting_id: string;
  organizer_wallet: string;
  organizer_email?: string;
  event_data: string; // JSON stringified event data
  stake_amount: number;
  status: 'pending_stake' | 'stake_confirmed' | 'scheduled' | 'cancelled';
  google_event_id?: string;
  created_at?: number;
  updated_at?: number;
}

export interface PendingEventData {
  summary: string;
  startDateTime: string;
  endDateTime: string;
  attendees: string[];
  description?: string;
  location?: string;
  stakeRequired?: number;
  timezone?: string;
}

class PendingMeetingsDatabase {
  /**
   * Create a new pending meeting
   */
  public async createPendingMeeting(
    meetingId: string,
    organizerWallet: string,
    eventData: PendingEventData,
    stakeAmount: number,
    organizerEmail?: string
  ): Promise<number> {
    await db.initialize();

    const stmt = await db.prepare(`
      INSERT INTO pending_meetings (
        meeting_id,
        organizer_wallet,
        organizer_email,
        event_data,
        stake_amount,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'pending_stake', unixepoch(), unixepoch())
    `);

    const result = stmt.run([
      meetingId,
      organizerWallet,
      organizerEmail || null,
      JSON.stringify(eventData),
      stakeAmount
    ]);

    console.log(`[PendingMeetings] Created pending meeting ${meetingId} for wallet ${organizerWallet}`);
    return result.lastInsertRowid as number;
  }

  /**
   * Get pending meeting by ID
   */
  public async getPendingMeeting(meetingId: string): Promise<PendingMeeting | null> {
    await db.initialize();

    const stmt = await db.prepare(`
      SELECT * FROM pending_meetings
      WHERE meeting_id = ?
    `);

    const result = stmt.get(meetingId) as PendingMeeting | undefined;
    return result || null;
  }

  /**
   * Update meeting status
   */
  public async updateMeetingStatus(
    meetingId: string,
    status: PendingMeeting['status'],
    googleEventId?: string
  ): Promise<boolean> {
    await db.initialize();

    const stmt = await db.prepare(`
      UPDATE pending_meetings
      SET status = ?,
          google_event_id = COALESCE(?, google_event_id),
          updated_at = unixepoch()
      WHERE meeting_id = ?
    `);

    const result = stmt.run([status, googleEventId || null, meetingId]);

    console.log(`[PendingMeetings] Updated meeting ${meetingId} status to ${status}`);
    return result.changes > 0;
  }

  /**
   * Get pending meetings for organizer
   */
  public async getPendingMeetingsForOrganizer(organizerWallet: string): Promise<PendingMeeting[]> {
    await db.initialize();

    const stmt = await db.prepare(`
      SELECT * FROM pending_meetings
      WHERE organizer_wallet = ?
      AND status IN ('pending_stake', 'stake_confirmed')
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return stmt.all(organizerWallet) as PendingMeeting[];
  }

  /**
   * Mark meeting as scheduled with Google Event ID
   */
  public async markAsScheduled(meetingId: string, googleEventId: string): Promise<boolean> {
    return this.updateMeetingStatus(meetingId, 'scheduled', googleEventId);
  }

  /**
   * Cancel pending meeting
   */
  public async cancelPendingMeeting(meetingId: string): Promise<boolean> {
    return this.updateMeetingStatus(meetingId, 'cancelled');
  }

  /**
   * Clean up old pending meetings
   */
  public async cleanupOldMeetings(daysOld: number = 7): Promise<number> {
    await db.initialize();

    const cutoffTime = Math.floor(Date.now() / 1000) - (daysOld * 24 * 60 * 60);

    const stmt = await db.prepare(`
      DELETE FROM pending_meetings
      WHERE created_at < ?
      AND status IN ('cancelled', 'scheduled')
    `);

    const result = stmt.run(cutoffTime);

    console.log(`[PendingMeetings] Cleaned up ${result.changes} old meetings`);
    return result.changes;
  }
}

// Export singleton instance
export const pendingMeetingsDb = new PendingMeetingsDatabase();
export default pendingMeetingsDb;