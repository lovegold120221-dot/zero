import Dexie, { Table } from 'dexie';

export interface ChatMessage {
  id?: number;
  userId: string;
  sessionId?: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface UserSettings {
  userId: string;
  googleToken?: string;
  googleRefreshToken?: string;
  avatarUrl?: string;
  whatsappPaired?: boolean;
  whatsappPhone?: string | null;
  whatsappPermissions?: any;
  knowledgeDomains?: string[];
  updatedAt?: string;
}

export interface Session {
  id: string;
  userId: string;
  lastActive: string;
}

export interface KnowledgeFile {
  id: string;
  userId: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  opfsPath: string;
}

export class BeatriceDatabase extends Dexie {
  messages!: Table<ChatMessage, number>;
  settings!: Table<UserSettings, string>;
  sessions!: Table<Session, string>;
  knowledgeFiles!: Table<KnowledgeFile, string>;

  constructor() {
    super('BeatriceDB');
    this.version(1).stores({
      messages: '++id, userId, sessionId, role, timestamp',
      settings: 'userId',
      sessions: 'id, userId, lastActive',
      knowledgeFiles: 'id, userId, name, uploadedAt'
    });
  }
}

export const db = new BeatriceDatabase();
