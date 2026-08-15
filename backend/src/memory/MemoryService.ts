import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface Memory {
  id: number;
  content: string;
  category: 'fact' | 'preference' | 'goal' | 'project' | 'event' | 'relationship';
  importance: number;
  source: 'inferred' | 'explicit';
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export class MemoryService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    // Default to a local database file in the project directory if not specified
    const defaultDbPath = path.resolve(process.cwd(), 'ada_memory.sqlite');
    const finalPath = dbPath || defaultDbPath;
    
    const dbDir = path.dirname(finalPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(finalPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('fact', 'preference', 'goal', 'project', 'event', 'relationship')),
        importance INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'inferred',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      this.db.exec(`ALTER TABLE memories ADD COLUMN source TEXT NOT NULL DEFAULT 'inferred'`);
    } catch (e) {
      // Column likely already exists
    }
  }

  /**
   * Saves a message into a conversation. Creates the conversation if it doesn't exist.
   */
  public saveConversationMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string): void {
    const checkStmt = this.db.prepare('SELECT id FROM conversations WHERE id = ?');
    const conversation = checkStmt.get(conversationId);

    if (!conversation) {
      const insertConv = this.db.prepare('INSERT INTO conversations (id) VALUES (?)');
      insertConv.run(conversationId);
    } else {
      const updateConv = this.db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      updateConv.run(conversationId);
    }

    const insertMsg = this.db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)');
    insertMsg.run(conversationId, role, content);
  }

  /**
   * Retrieves messages for a conversation
   */
  public getConversationMessages(conversationId: string): ConversationMessage[] {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC');
    return stmt.all(conversationId) as ConversationMessage[];
  }

  /**
   * Creates a new memory.
   */
  public createMemory(content: string, category: Memory['category'], importance: number = 1, source: Memory['source'] = 'inferred'): Memory {
    const stmt = this.db.prepare(
      'INSERT INTO memories (content, category, importance, source) VALUES (?, ?, ?, ?) RETURNING *'
    );
    return stmt.get(content, category, importance, source) as Memory;
  }

  /**
   * Searches memories using simple exact or partial matches (LIKE).
   * Note: Vector embeddings are deferred to future steps.
   */
  public searchMemories(query: string, limit: number = 10): Memory[] {
    const stmt = this.db.prepare(
      'SELECT * FROM memories WHERE content LIKE ? ORDER BY importance DESC, updated_at DESC LIMIT ?'
    );
    return stmt.all(`%${query}%`, limit) as Memory[];
  }

  /**
   * Retrieves all memories, optionally filtered by category.
   */
  public getMemories(category?: Memory['category']): Memory[] {
    if (category) {
      const stmt = this.db.prepare('SELECT * FROM memories WHERE category = ? ORDER BY importance DESC');
      return stmt.all(category) as Memory[];
    } else {
      const stmt = this.db.prepare('SELECT * FROM memories ORDER BY importance DESC');
      return stmt.all() as Memory[];
    }
  }

  /**
   * Deletes a memory by ID.
   */
  public deleteMemory(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  /**
   * Safely closes the database connection.
   */
  public close(): void {
    this.db.close();
  }
}
