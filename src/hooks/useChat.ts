import { useState, useEffect, useCallback } from 'react';
import { useRowingStore } from '@/lib/store';
import { cloudAI, ChatMessage, ChatSession, FileAttachment } from '@/lib/cloudAI';
import { initializeCloudAIFromSettings, isAIAvailable, getAIConfigurationErrorMessage } from '@/lib/aiConfig';

export interface ChatState {
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  searchResults: { session: ChatSession; message: ChatMessage }[];
  isSearching: boolean;
}

const CURRENT_SESSION_KEY = 'rowing_ai_current_session';

function getStoredCurrentSessionId(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  return localStorage.getItem(CURRENT_SESSION_KEY);
}

function setStoredCurrentSessionId(sessionId: string | null): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  if (!sessionId) {
    localStorage.removeItem(CURRENT_SESSION_KEY);
    return;
  }
  localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
}

function dbSessionToChatSession(s: any): ChatSession {
  return {
    id: s.id,
    title: s.title,
    messages: [],
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
    category: s.category,
    chartId: s.chartId || undefined,
    messageCount: s.messageCount ?? 0,
  };
}

function dbMessageToChatMessage(m: any, sessionId: string): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
    sessionId,
  };
}

export function useChat() {
  const { getSessions, removeChartExplanationsBySessionId, clearAllChartExplanations } = useRowingStore();
  const [state, setState] = useState<ChatState>({
    currentSession: null,
    sessions: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    searchResults: [],
    isSearching: false
  });

  // Load sessions on mount and initialize AI
  useEffect(() => {
    loadSessions();
    // Initialize AI from settings on mount
    initializeCloudAIFromSettings();
  }, []);

  const loadSessions = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch('/api/chat');
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to load chat sessions');
      }

      const data = await res.json();
      const sessions = (data.chatSessions || []).map(dbSessionToChatSession);

      const storedId = getStoredCurrentSessionId();
      const nextCurrent = storedId ? sessions.find((s: ChatSession) => s.id === storedId) || null : null;

      setState(prev => ({
        ...prev,
        sessions,
        currentSession: nextCurrent,
        isLoading: false,
      }));

      if (nextCurrent) {
        const messagesRes = await fetch(`/api/chat?sessionId=${encodeURIComponent(nextCurrent.id)}&limit=200`);
        if (messagesRes.ok) {
          const msgData = await messagesRes.json();
          const msgs = (msgData.messages || []).map((m: any) => dbMessageToChatMessage(m, nextCurrent.id));
          setState(prev => ({
            ...prev,
            currentSession: prev.currentSession ? { ...prev.currentSession, messages: msgs } : prev.currentSession,
          }));
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load chat sessions'
      }));
    }
  }, []);

  // Create new session
  const createSession = useCallback(async (title?: string, category?: 'chat' | 'explanation' | 'plan_analysis' | 'insight_discussion', chartId?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createSession',
          title,
          category,
          chartId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to create new session');
      }

      const data = await res.json();
      const newSession = dbSessionToChatSession(data.session);

      setStoredCurrentSessionId(newSession.id);
      setState(prev => ({
        ...prev,
        sessions: [newSession, ...prev.sessions],
        currentSession: { ...newSession, messages: [] },
        isLoading: false,
        error: null,
      }));

      return newSession;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create new session'
      }));
      return null;
    }
  }, []);

  // Switch to existing session
  const switchSession = useCallback(async (sessionId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const found = state.sessions.find(s => s.id === sessionId);
      if (!found) {
        throw new Error('Session not found');
      }

      setStoredCurrentSessionId(sessionId);

      const res = await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}&limit=200`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to load messages');
      }

      const data = await res.json();
      const messages = (data.messages || []).map((m: Record<string, unknown>) => dbMessageToChatMessage(m, sessionId));

      setState(prev => ({
        ...prev,
        currentSession: { ...found, messages },
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to switch session'
      }));
    }
  }, [state.sessions]);

  // Send message to AI
  const sendMessage = useCallback(async (content: string, attachments?: FileAttachment[]) => {
    if (!state.currentSession || (!content.trim() && (!attachments || attachments.length === 0))) return;

    // Ensure AI is configured before sending
    if (!isAIAvailable()) {
      const errorMessage = getAIConfigurationErrorMessage();
      setState(prev => ({
        ...prev,
        error: errorMessage || 'Cloud AI is not configured. Please configure your OpenAI API key in Settings.'
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Append user message (DB)
      const userMsgRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'appendMessage',
          sessionId: state.currentSession.id,
          message: {
            role: 'user',
            content: content.trim(),
          },
        }),
      });

      if (!userMsgRes.ok) {
        const data = await userMsgRes.json().catch(() => null);
        throw new Error(data?.error || 'Failed to save message');
      }

      const userMsgData = await userMsgRes.json();
      const userMessage = dbMessageToChatMessage(userMsgData.message, state.currentSession.id);

      setState(prev => ({
        ...prev,
        currentSession: prev.currentSession
          ? {
              ...prev.currentSession,
              messages: [...prev.currentSession.messages, userMessage],
            }
          : null
      }));

      // Create placeholder assistant message
      const placeholderId = crypto.randomUUID();
      const placeholderMessage: ChatMessage = {
        id: placeholderId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        sessionId: state.currentSession.id
      };

      // Add placeholder to state immediately
      setState(prev => ({
        ...prev,
        currentSession: prev.currentSession ? {
          ...prev.currentSession,
          messages: [...prev.currentSession.messages, placeholderMessage]
        } : null
      }));

      let streamedContent = '';

      // Get AI response with conversation chaining
      const userSessions = getSessions();
      const conversationHistory = state.currentSession.messages;

      // Get the last AI response ID for conversation chaining
      const lastAIMessage = conversationHistory
        .filter(msg => msg.role === 'assistant' && msg.responseId)
        .pop();
      const previousResponseId = lastAIMessage?.responseId;

      const aiResponse = await cloudAI.sendChatMessage(
        content.trim(),
        conversationHistory,
        userSessions,
        previousResponseId,
        (token) => {
          streamedContent += token;
          setState(prev => {
            if (!prev.currentSession) return prev;

            const updatedMessages = prev.currentSession.messages.map(msg =>
              msg.id === placeholderId
                ? { ...msg, content: streamedContent }
                : msg
            );

            return {
              ...prev,
              currentSession: {
                ...prev.currentSession,
                messages: updatedMessages
              }
            };
          });
        },
        attachments
      );

      // Add AI response (only if not empty)
      if (aiResponse.content && aiResponse.content.trim()) {
        const assistantMsgRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'appendMessage',
            sessionId: state.currentSession.id,
            message: {
              role: 'assistant',
              content: aiResponse.content,
            },
          }),
        });

        if (!assistantMsgRes.ok) {
          const data = await assistantMsgRes.json().catch(() => null);
          throw new Error(data?.error || 'Failed to save assistant message');
        }

        const assistantMsgData = await assistantMsgRes.json();
        const assistantMessage = dbMessageToChatMessage(assistantMsgData.message, state.currentSession.id);

        // Update state with AI response (replace placeholder)
        setState(prev => ({
          ...prev,
          currentSession: prev.currentSession ? {
            ...prev.currentSession,
            messages: prev.currentSession.messages.map(msg =>
              msg.id === placeholderId ? assistantMessage : msg
            )
          } : null,
          isLoading: false
        }));
      } else {
        // Remove placeholder if response is empty
        setState(prev => ({
          ...prev,
          currentSession: prev.currentSession ? {
            ...prev.currentSession,
            messages: prev.currentSession.messages.filter(msg => msg.id !== placeholderId)
          } : null,
          isLoading: false
        }));
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to send message'
      }));
    }
  }, [state.currentSession, getSessions]);

  // Update session title
  const updateSessionTitle = useCallback((sessionId: string, title: string) => {
    setState(prev => ({
      ...prev,
      sessions: prev.sessions.map(session =>
        session.id === sessionId ? { ...session, title } : session
      ),
      currentSession: prev.currentSession?.id === sessionId
        ? { ...prev.currentSession, title }
        : prev.currentSession
    }));

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateSession', sessionId, title }),
    }).catch(() => {
      setState(prev => ({
        ...prev,
        error: 'Failed to update session title'
      }));
    });
  }, []);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatSessionId: sessionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete session');
      }

      removeChartExplanationsBySessionId(sessionId);
      setState(prev => {
        const newSessions = prev.sessions.filter(s => s.id !== sessionId);
        const newCurrentSession = prev.currentSession?.id === sessionId ? null : prev.currentSession;
        if (prev.currentSession?.id === sessionId) {
          setStoredCurrentSessionId(null);
        }
        return {
          ...prev,
          sessions: newSessions,
          currentSession: newCurrentSession
        };
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to delete session'
      }));
    }
  }, [removeChartExplanationsBySessionId]);

  // Search messages
  const searchMessages = useCallback(async (query: string) => {
    setState(prev => ({ ...prev, isSearching: true, searchQuery: query }));

    try {
      if (!query.trim()) {
        setState(prev => ({
          ...prev,
          isSearching: false,
          searchResults: [],
          error: null,
        }));
        return;
      }

      const res = await fetch(`/api/chat?search=${encodeURIComponent(query.trim())}&limit=50`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to search messages');
      }

      const data = await res.json();
      const results = (data.results || []).map((r: any) => ({
        session: dbSessionToChatSession(r.session),
        message: dbMessageToChatMessage(r.message, r.session.id),
      }));

      setState(prev => ({
        ...prev,
        searchResults: results,
        isSearching: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSearching: false,
        error: error instanceof Error ? error.message : 'Failed to search messages'
      }));
    }
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      searchQuery: '',
      searchResults: [],
      isSearching: false
    }));
  }, []);

  // Clear all sessions
  const clearAllSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to clear sessions');
      }

      setStoredCurrentSessionId(null);
      clearAllChartExplanations();
      setState(prev => ({
        ...prev,
        sessions: [],
        currentSession: null,
        searchResults: []
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to clear sessions'
      }));
    }
  }, [clearAllChartExplanations]);

  // Export sessions
  const exportSessions = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: 'Export is not available in DB-backed mode'
    }));
    return null;
  }, []);

  // Import sessions
  const importSessions = useCallback((jsonData: string) => {
    setState(prev => ({
      ...prev,
      error: 'Import is not available (DB is the source of truth)'
    }));
    return { success: false, imported: 0 };
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Check if AI is configured and available
  const isAIConfigured = isAIAvailable();

  return {
    // State
    ...state,

    // Actions
    createSession,
    switchSession,
    sendMessage,
    updateSessionTitle,
    deleteSession,
    searchMessages,
    clearSearch,
    clearAllSessions,
    exportSessions,
    importSessions,
    clearError,
    loadSessions,

    // Computed
    isAIConfigured,
    hasSessions: state.sessions.length > 0,
    currentSessionMessages: state.currentSession?.messages || [],
    sessionStats: {
      totalSessions: state.sessions.length,
      totalMessages: state.sessions.reduce((sum, s) => sum + (s.messages?.length || 0), 0),
      lastActivity: state.sessions.length > 0
        ? new Date(Math.max(...state.sessions.map(s => s.updatedAt.getTime())))
        : null
    }
  };
}
