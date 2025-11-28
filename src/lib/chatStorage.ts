import { ChatMessage, ChatSession } from '@/lib/cloudAI';
import { formatSessionDate } from '@/lib/dateTimeUtils';

export class ChatStorageService {
  private static instance: ChatStorageService;
  private readonly STORAGE_KEY = 'rowing_ai_chat_sessions';
  private readonly CURRENT_SESSION_KEY = 'rowing_ai_current_session';
  
  private constructor() {}
  
  static getInstance(): ChatStorageService {
    if (!ChatStorageService.instance) {
      ChatStorageService.instance = new ChatStorageService();
    }
    return ChatStorageService.instance;
  }

  // Get all chat sessions
  getSessions(): ChatSession[] {
    try {
      // Guard against SSR/non-browser environments
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return [];
      }
      
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const sessions = JSON.parse(stored);
      return sessions.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      return [];
    }
  }

  // Get current session ID
  getCurrentSessionId(): string | null {
    // Guard against SSR/non-browser environments
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(this.CURRENT_SESSION_KEY);
  }

  // Set current session ID
  setCurrentSessionId(sessionId: string): void {
    // Guard against SSR/non-browser environments
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
  }

  // Get session by ID
  getSession(sessionId: string): ChatSession | null {
    const sessions = this.getSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  // Create new session
  createSession(title?: string, category?: 'chat' | 'explanation', chartId?: string): ChatSession {
    const newSession: ChatSession = {
      id: this.generateId(),
      title: title || this.generateSessionTitle(),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      category: category || 'chat',
      chartId
    };

    const sessions = this.getSessions();
    sessions.unshift(newSession); // Add to beginning
    this.saveSessions(sessions);
    this.setCurrentSessionId(newSession.id);

    return newSession;
  }

  // Add message to session
  addMessage(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'sessionId'>): ChatMessage {
    const newMessage: ChatMessage = {
      id: this.generateId(),
      ...message,
      timestamp: new Date(),
      sessionId
    };

    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) {
      throw new Error('Session not found');
    }

    sessions[sessionIndex].messages.push(newMessage);
    sessions[sessionIndex].updatedAt = new Date();
    
    this.saveSessions(sessions);
    return newMessage;
  }

  // Update session title
  updateSessionTitle(sessionId: string, title: string): void {
    const sessions = this.getSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    
    if (sessionIndex === -1) {
      throw new Error('Session not found');
    }

    sessions[sessionIndex].title = title;
    sessions[sessionIndex].updatedAt = new Date();
    
    this.saveSessions(sessions);
  }

  // Delete session
  deleteSession(sessionId: string): void {
    const sessions = this.getSessions();
    const filteredSessions = sessions.filter(s => s.id !== sessionId);
    
    this.saveSessions(filteredSessions);

    // If deleted session was current, clear current session
    if (this.getCurrentSessionId() === sessionId) {
      // Guard against SSR/non-browser environments
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.CURRENT_SESSION_KEY);
      }
    }
  }

  // Clear all sessions
  clearAllSessions(): void {
    // Guard against SSR/non-browser environments
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.CURRENT_SESSION_KEY);
  }

  // Search through all messages
  searchMessages(query: string): { session: ChatSession; message: ChatMessage }[] {
    const sessions = this.getSessions();
    const results: { session: ChatSession; message: ChatMessage }[] = [];

    sessions.forEach(session => {
      session.messages.forEach(message => {
        if (message.content.toLowerCase().includes(query.toLowerCase())) {
          results.push({ session, message });
        }
      });
    });

    return results;
  }

  // Get session statistics
  getSessionStats(): { totalSessions: number; totalMessages: number; lastActivity: Date | null } {
    const sessions = this.getSessions();
    const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0);
    const lastActivity = sessions.length > 0 
      ? new Date(Math.max(...sessions.map(s => s.updatedAt.getTime())))
      : null;

    return {
      totalSessions: sessions.length,
      totalMessages,
      lastActivity
    };
  }

  // Export sessions for backup
  exportSessions(): string {
    const sessions = this.getSessions();
    return JSON.stringify(sessions, null, 2);
  }

  // Import sessions from backup
  importSessions(jsonData: string): { success: boolean; imported: number } {
    try {
      const sessions = JSON.parse(jsonData);
      
      if (!Array.isArray(sessions)) {
        throw new Error('Invalid data format');
      }

      // Validate session structure
      const validSessions = sessions.filter((session: any) => {
        return session.id && session.title && Array.isArray(session.messages);
      });

      if (validSessions.length === 0) {
        throw new Error('No valid sessions found');
      }

      // Merge with existing sessions (avoid duplicates)
      const existingSessions = this.getSessions();
      const existingIds = new Set(existingSessions.map(s => s.id));
      const newSessions = validSessions.filter((s: any) => !existingIds.has(s.id));
      
      const allSessions = [...newSessions, ...existingSessions];
      this.saveSessions(allSessions);

      return { success: true, imported: newSessions.length };
    } catch (error) {
      console.error('Failed to import sessions:', error);
      return { success: false, imported: 0 };
    }
  }

  // Private helper methods
  private saveSessions(sessions: ChatSession[]): void {
    try {
      // Guard against SSR/non-browser environments
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save chat sessions:', error);
    }
  }

  private generateId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionTitle(): string {
    return `Chat ${formatSessionDate(new Date())}`;
  }
}

// Export singleton instance
export const chatStorage = ChatStorageService.getInstance();
