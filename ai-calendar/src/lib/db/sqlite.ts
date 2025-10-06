import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'calendar.db');
const ENCRYPTION_KEY = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';

// Encryption utilities
export function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

class SqliteDatabase {
  private db: Database | null = null;
  private static instance: SqliteDatabase;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    // Constructor is now empty, initialization happens in initialize()
  }

  public static getInstance(): SqliteDatabase {
    if (!SqliteDatabase.instance) {
      SqliteDatabase.instance = new SqliteDatabase();
    }
    return SqliteDatabase.instance;
  }

  // Initialize database asynchronously
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initializeDatabase();
    await this.initPromise;
    this.initialized = true;
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Initialize sql.js
      const SQL = await initSqlJs({
        locateFile: file => {
          // For Node.js environment, use the node_modules path
          return path.join(process.cwd(), 'node_modules/sql.js/dist/', file);
        }
      });

      // Check if database file exists
      let data: Uint8Array | undefined;
      if (fs.existsSync(DB_PATH)) {
        data = new Uint8Array(fs.readFileSync(DB_PATH));
      }

      // Create or load database
      this.db = new SQL.Database(data);

      // Enable foreign keys
      this.db.run('PRAGMA foreign_keys = ON');

      // Initialize schema
      this.initializeSchema();

      // Set up auto-save on process exit
      process.on('exit', () => this.saveToFile());
      process.on('SIGINT', () => {
        this.saveToFile();
        process.exit();
      });

    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private initializeSchema() {
    if (!this.db) throw new Error('Database not initialized');

    // Create accounts table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT UNIQUE NOT NULL,
        google_email TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expiry INTEGER,
        scopes TEXT,
        last_sync_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create contacts table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        UNIQUE(account_id, email)
      )
    `);

    // Create meeting_stakes table (for future use)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS meeting_stakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id TEXT UNIQUE NOT NULL,
        event_id TEXT,
        organizer TEXT,
        required_stake REAL,
        start_time TEXT,
        end_time TEXT,
        attendance_code TEXT,
        code_generated_at TEXT,
        is_settled INTEGER DEFAULT 0,
        stakes TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create pending_meetings table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS pending_meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id TEXT UNIQUE NOT NULL,
        organizer_wallet TEXT NOT NULL,
        organizer_email TEXT,
        event_data TEXT NOT NULL,
        stake_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending_stake',
        google_event_id TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create indexes
    this.createIndexes();

    // Save after schema creation
    this.saveToFile();
  }

  private createIndexes() {
    if (!this.db) throw new Error('Database not initialized');

    // Account indexes
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_wallet_address
      ON accounts(wallet_address);
    `);

    // Contact indexes for fast searching
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_account_contacts
      ON contacts(account_id, name COLLATE NOCASE);
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_account_email
      ON contacts(account_id, email);
    `);

    // Meeting stakes index
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_meeting_organizer
      ON meeting_stakes(organizer);
    `);

    // Pending meetings indexes
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_pending_meeting_id
      ON pending_meetings(meeting_id);
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_pending_organizer
      ON pending_meetings(organizer_wallet, status);
    `);
  }

  // Save database to file
  public saveToFile(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  // Ensure database is initialized before use
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public async getDb(): Promise<Database> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database initialization failed');
    return this.db;
  }

  // Prepared statement wrapper for sql.js
  public async prepare(sql: string): Promise<{
    run: (params: unknown[] | Record<string, unknown> | undefined) => { changes: number; lastInsertRowid: number };
    get: (params: unknown[] | Record<string, unknown> | undefined) => Record<string, unknown> | undefined;
    all: (params: unknown[] | Record<string, unknown> | undefined) => Record<string, unknown>[];
  }> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const db = this.db;
    const saveToFile = () => this.saveToFile();

    return {
      run: (params: unknown[] | Record<string, unknown> | undefined) => {
        const stmt = db.prepare(sql);

        // Convert object params to array if necessary
        let paramArray: unknown[];
        if (Array.isArray(params)) {
          paramArray = params;
        } else if (params && typeof params === 'object') {
          // Extract values based on named parameters in SQL
          const matches = sql.match(/@\w+/g) || [];
          paramArray = matches.map(match => {
            const key = match.substring(1); // Remove @ prefix
            return params[key];
          });
        } else if (params !== undefined) {
          paramArray = [params];
        } else {
          paramArray = [];
        }

        stmt.run(paramArray);
        stmt.free();

        // Save after write operations
        saveToFile();

        return {
          changes: db.getRowsModified(),
          lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] || 0
        };
      },
      get: (params: unknown[] | Record<string, unknown> | undefined) => {
        const stmt = db.prepare(sql);

        // Convert params similar to run()
        let paramArray: unknown[];
        if (Array.isArray(params)) {
          paramArray = params;
        } else if (params && typeof params === 'object') {
          const matches = sql.match(/@\w+/g) || [];
          paramArray = matches.map(match => {
            const key = match.substring(1);
            return params[key];
          });
        } else if (params !== undefined) {
          paramArray = [params];
        } else {
          paramArray = [];
        }

        stmt.bind(paramArray);
        if (stmt.step()) {
          const result = stmt.getAsObject();
          stmt.free();
          return result;
        }
        stmt.free();
        return undefined;
      },
      all: (params: unknown[] | Record<string, unknown> | undefined) => {
        const stmt = db.prepare(sql);

        // Convert params similar to run()
        let paramArray: unknown[];
        if (Array.isArray(params)) {
          paramArray = params;
        } else if (params && typeof params === 'object') {
          const matches = sql.match(/@\w+/g) || [];
          paramArray = matches.map(match => {
            const key = match.substring(1);
            return params[key];
          });
        } else if (params !== undefined) {
          paramArray = [params];
        } else {
          paramArray = [];
        }

        stmt.bind(paramArray);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  // Transaction support
  public async transaction<T>(fn: () => T): Promise<T> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    this.db.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      this.db.run('COMMIT');
      this.saveToFile();
      return result;
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  // Close database connection (for cleanup)
  public close() {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

// Export singleton instance
export const db = SqliteDatabase.getInstance();
export default db;