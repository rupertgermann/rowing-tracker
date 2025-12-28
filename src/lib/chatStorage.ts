import { ChatMessage, ChatSession } from '@/lib/cloudAI';
import { formatSessionDate } from '@/lib/dateTimeUtils';

// Helper to convert DB session to ChatSession
function dbSessionToChatSession(s: any): ChatSession {
  return {
    id: s.id,
    title: s.title,
    messages: s.messages?.map((m: any) => dbMessageToChatMessage(m, s.id)) || [],
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
    category: s.category,
    chartId: s.chartId || undefined,
  };
}

// Helper to convert DB message to ChatMessage
function dbMessageToChatMessage(m: any, sessionId: string): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
    sessionId,
  };
}

export class ChatStorageService {
  private static instance: ChatStorageService;
  private readonly CURRENT_SESSION_KEY = 'rowing_ai_current_session';

  // In-memory cache for sessions (lightweight, without messages)
  private sessionsCache: ChatSession[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): ChatStorageService {
    if (!ChatStorageService.instance) {
      ChatStorageService.instance = new ChatStorageService();
    }
    return ChatStorageService.instance;
  }

  // Invalidate the sessions cache
  invalidateCache(): void {
    this.sessionsCache = null;
    this.cacheTimestamp = 0;
  }

  // Get all chat sessions from database
  async getSessions(): Promise<ChatSession[]> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.sessionsCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
        return this.sessionsCache;
      }

      const response = await fetch('/api/chat');
      if (!response.ok) {
        console.error('[CHAT STORAGE] Failed to fetch sessions:', response.status);
        return this.sessionsCache || [];
      }

      const data = await response.json();
      const sessions = (data.chatSessions || []).map(dbSessionToChatSession);

      // Update cache
      this.sessionsCache = sessions;
      this.cacheTimestamp = now;

      return sessions;
    } catch (error) {
      console.error('[CHAT STORAGE] Failed to load chat sessions:', error);
      return this.sessionsCache || [];
    }
  }

  // Get current session ID (UI state - stays in localStorage)
  getCurrentSessionId(): string | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(this.CURRENT_SESSION_KEY);
  }

  // Set current session ID (UI state - stays in localStorage)
  setCurrentSessionId(sessionId: string): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
  }

  // Get session by ID from database
  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      // First check if session exists in our list
      const sessions = await this.getSessions();
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return null;

      // Fetch messages for this session
      const response = await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}&limit=200`);
      if (!response.ok) {
        console.error('[CHAT STORAGE] Failed to fetch session messages:', response.status);
        return session; // Return session without messages
      }

      const data = await response.json();
      const messages = (data.messages || []).map((m: any) => dbMessageToChatMessage(m, sessionId));

      return { ...session, messages };
    } catch (error) {
      console.error('[CHAT STORAGE] Failed to load session:', error);
      return null;
    }
  }

  // Create new session via API
  async createSession(title?: string, category?: 'chat' | 'explanation' | 'plan_analysis' | 'insight_discussion', chartId?: string): Promise<ChatSession> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createSession',
          title: title || this.generateSessionTitle(),
          category: category || 'chat',
          chartId,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create session');
      }

      const data = await response.json();
      const newSession = dbSessionToChatSession(data.session);
      newSession.messages = [];

      // Invalidate cache and update current session
      this.invalidateCache();
      this.setCurrentSessionId(newSession.id);

      return newSession;
    } catch (error) {
      console.error('[CHAT STORAGE] Failed to create session:', error);
      throw error;
    }
  }

  // Add message to session via API
  async addMessage(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'sessionId'>): Promise<ChatMessage> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'appendMessage',
          sessionId,
          message: {
            role: message.role,
            content: message.content,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to add message');
      }

      const data = await response.json();
      const newMessage = dbMessageToChatMessage(data.message, sessionId);

      // Invalidate cache
      this.invalidateCache();

      return newMessage;
    } catch (error) {
      console.error('[CHAT STORAGE] Failed to add message:', error);
      throw error;
    }
  }

  // Update session title via API
  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateSession',
          sessionId,
          title,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update session title');
      }

      // Invalidate cache
      this.invalidateCache();
    } catch (error) {
      console.error('[CHAT STORAGE] Failed to update session title:', error);
      throw error;
    }
  }

  // Delete session via API
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch('/api/chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatSessionId: sessionId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to delete session');
      }

      // Invalidate cache
      this.invalidateCache();

      // If deleted session was current, clear current session
      if (this.getCurrentSessionId() === sessionId) {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.removeItem(this.CURRENT_SESSION_KEY);
        }
      }
    } catch (error) {
      console.error('[CHAT STORAGE] Failed to delete session:', error);
      throw error;
    }
  }

  // Clear all sessions via API
  async clearAllSessions(): Promise<void> {
    try {
      const response = await fetch('/api/chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to clear sessions');
      }

      // Invalidate cache and clear localStorage
      this.invalidateCache();
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.CURRENT_SESSION_KEY);
      }
    } catch (error) {
      console.error('[CHAT STORAGE] Failed to clear sessions:', error);
      throw error;
    }
  }

  // Search through all messages via API
  async searchMessages(query: string): Promise<{ session: ChatSession; message: ChatMessage }[]> {
    try {
      if (!query.trim()) return [];

      const response = await fetch(`/api/chat?search=${encodeURIComponent(query.trim())}&limit=50`);
      if (!response.ok) {
        console.error('[CHAT STORAGE] Failed to search messages:', response.status);
        return [];
      }

      const data = await response.json();
      return (data.results || []).map((r: any) => ({
        session: dbSessionToChatSession(r.session),
        message: dbMessageToChatMessage(r.message, r.session.id),
      }));
    } catch (error) {
      console.error('[CHAT STORAGE] Failed to search messages:', error);
      return [];
    }
  }

  // Get session statistics (computed from cached sessions)
  async getSessionStats(): Promise<{ totalSessions: number; totalMessages: number; lastActivity: Date | null }> {
    const sessions = await this.getSessions();
    const lastActivity = sessions.length > 0
      ? new Date(Math.max(...sessions.map(s => s.updatedAt.getTime())))
      : null;

    return {
      totalSessions: sessions.length,
      totalMessages: 0, // Messages are not loaded in list view
      lastActivity
    };
  }

  // Export sessions (deprecated - use API directly for backups)
  async exportSessions(): Promise<string> {
    console.warn('[CHAT STORAGE] Export is deprecated in DB-backed mode');
    const sessions = await this.getSessions();
    return JSON.stringify(sessions, null, 2);
  }

  // Import sessions (deprecated - DB is source of truth)
  async importSessions(_jsonData: string): Promise<{ success: boolean; imported: number }> {
    console.warn('[CHAT STORAGE] Import is not supported in DB-backed mode');
    return { success: false, imported: 0 };
  }

  // Get plan analysis sessions for a specific plan
  async getPlanAnalysisSessions(planId?: string): Promise<ChatSession[]> {
    const sessions = await this.getSessions();
    const planAnalysisSessions = sessions.filter(s => s.category === 'plan_analysis');

    if (planId) {
      return planAnalysisSessions.filter(s => s.chartId === planId);
    }

    return planAnalysisSessions;
  }

  // Get insight discussion sessions for a specific insight
  async getInsightDiscussionSessions(insightId?: string): Promise<ChatSession[]> {
    const sessions = await this.getSessions();
    const insightDiscussionSessions = sessions.filter(s => s.category === 'insight_discussion');

    if (insightId) {
      return insightDiscussionSessions.filter(s => s.chartId === insightId);
    }

    return insightDiscussionSessions;
  }

  // Private helper methods
  private generateSessionTitle(): string {
    return `Chat ${formatSessionDate(new Date())}`;
  }
}

// Export singleton instance
export const chatStorage = ChatStorageService.getInstance();
