import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

const DB_FILE = process.env.DATABASE_PATH || './calendar-connections.json';
const ENCRYPTION_KEY = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';

export interface CalendarConnection {
  id?: number;
  wallet_address: string;
  google_email?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: number;
  created_at?: number;
  updated_at?: number;
}

export interface MeetingStake {
  meetingId: string;
  eventId: string;
  organizer: string;
  requiredStake: number;
  startTime: string;
  endTime: string;
  attendanceCode?: string;
  codeGeneratedAt?: string;
  isSettled: boolean;
  stakes: {
    walletAddress: string;
    amount: number;
    stakedAt: string;
    hasCheckedIn: boolean;
    checkInTime?: string;
    isRefunded: boolean;
  }[];
}

export interface SimpleContact {
  email: string;
  name: string | null;
}

interface Database {
  connections: { [walletAddress: string]: CalendarConnection };
  meetingStakes?: { [meetingId: string]: MeetingStake };
  extractedContacts?: { [walletAddress: string]: SimpleContact[] };
}

function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function loadDatabase(): Database {
  if (!existsSync(DB_FILE)) {
    const emptyDb: Database = { connections: {}, meetingStakes: {} };
    saveDatabase(emptyDb);
    return emptyDb;
  }
  
  try {
    const data = readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(data) as Database;
    // Ensure meetingStakes exists
    if (!db.meetingStakes) {
      db.meetingStakes = {};
    }
    return db;
  } catch (error) {
    console.error('Error loading database:', error);
    const emptyDb: Database = { connections: {}, meetingStakes: {} };
    return emptyDb;
  }
}

function saveDatabase(db: Database): void {
  try {
    writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

export function saveCalendarConnection(connection: CalendarConnection): CalendarConnection {
  const db = loadDatabase();
  
  // Encrypt tokens before saving
  const encryptedConnection: CalendarConnection = {
    ...connection,
    access_token: connection.access_token ? encrypt(connection.access_token) : undefined,
    refresh_token: connection.refresh_token ? encrypt(connection.refresh_token) : undefined,
    created_at: connection.created_at || Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000)
  };
  
  // Store in database
  db.connections[connection.wallet_address] = encryptedConnection;
  
  // Save to file
  saveDatabase(db);
  
  // Return decrypted version
  return getCalendarConnection(connection.wallet_address)!;
}

export function getCalendarConnection(walletAddress: string): CalendarConnection | null {
  const db = loadDatabase();
  const connection = db.connections[walletAddress];
  
  if (!connection) return null;
  
  // Decrypt tokens before returning
  return {
    ...connection,
    access_token: connection.access_token ? decrypt(connection.access_token) : undefined,
    refresh_token: connection.refresh_token ? decrypt(connection.refresh_token) : undefined
  };
}

export function deleteCalendarConnection(walletAddress: string): boolean {
  const db = loadDatabase();
  
  if (!db.connections[walletAddress]) {
    return false;
  }
  
  delete db.connections[walletAddress];
  saveDatabase(db);
  return true;
}

export function updateTokens(
  walletAddress: string, 
  accessToken: string, 
  refreshToken?: string,
  tokenExpiry?: number
): boolean {
  const db = loadDatabase();
  const connection = db.connections[walletAddress];
  
  if (!connection) {
    return false;
  }
  
  // Update tokens with encryption
  connection.access_token = encrypt(accessToken);
  if (refreshToken) {
    connection.refresh_token = encrypt(refreshToken);
  }
  if (tokenExpiry) {
    connection.token_expiry = tokenExpiry;
  }
  connection.updated_at = Math.floor(Date.now() / 1000);
  
  // Save to database
  saveDatabase(db);
  return true;
}

// Export database utilities for staking
export const db = {
  read: loadDatabase,
  write: saveDatabase
};

// Extracted contacts functions
export function saveExtractedContacts(walletAddress: string, contacts: SimpleContact[]): boolean {
  try {
    const db = loadDatabase();

    // Initialize extractedContacts if it doesn't exist
    if (!db.extractedContacts) {
      db.extractedContacts = {};
    }

    // Save contacts for this wallet address
    db.extractedContacts[walletAddress] = contacts;

    saveDatabase(db);
    return true;
  } catch (error) {
    console.error('Error saving extracted contacts:', error);
    return false;
  }
}

export function getExtractedContacts(walletAddress: string): SimpleContact[] {
  try {
    const db = loadDatabase();

    if (!db.extractedContacts || !db.extractedContacts[walletAddress]) {
      return [];
    }

    return db.extractedContacts[walletAddress];
  } catch (error) {
    console.error('Error getting extracted contacts:', error);
    return [];
  }
}

export function clearExtractedContacts(walletAddress: string): boolean {
  try {
    const db = loadDatabase();

    if (!db.extractedContacts) {
      return true;
    }

    delete db.extractedContacts[walletAddress];
    saveDatabase(db);
    return true;
  } catch (error) {
    console.error('Error clearing extracted contacts:', error);
    return false;
  }
}

// Get total count of extracted contacts for a wallet
export function getExtractedContactsCount(walletAddress: string): number {
  const contacts = getExtractedContacts(walletAddress);
  return contacts.length;
}

// Cleanup function - no longer needed but kept for compatibility
export function getDb() {
  // This function is no longer used but kept to avoid breaking imports
  return null;
}