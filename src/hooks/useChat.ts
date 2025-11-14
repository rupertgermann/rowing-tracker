import { useState, useEffect, useCallback } from 'react';
import { useRowingStore } from '@/lib/store';
import { cloudAI, ChatMessage, ChatSession } from '@/lib/cloudAI';
import { chatStorage } from '@/lib/chatStorage';

export interface ChatState {
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  searchResults: { session: ChatSession; message: ChatMessage }[];
  isSearching: boolean;
}

export function useChat() {
  const { getSessions } = useRowingStore();
  const [state, setState] = useState<ChatState>({
    currentSession: null,
    sessions: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    searchResults: [],
    isSearching: false
  });

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = useCallback(() => {
    try {
      const sessions = chatStorage.getSessions();
      const currentSessionId = chatStorage.getCurrentSessionId();
      const currentSession = currentSessionId ? chatStorage.getSession(currentSessionId) : null;

      setState(prev => ({
        ...prev,
        sessions,
        currentSession
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to load chat sessions'
      }));
    }
  }, []);

  // Create new session
  const createSession = useCallback((title?: string) => {
    try {
      const newSession = chatStorage.createSession(title);
      setState(prev => ({
        ...prev,
        sessions: [newSession, ...prev.sessions],
        currentSession: newSession,
        error: null
      }));
      return newSession;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to create new session'
      }));
      return null;
    }
  }, []);

  // Switch to existing session
  const switchSession = useCallback((sessionId: string) => {
    try {
      const session = chatStorage.getSession(sessionId);
      if (session) {
        chatStorage.setCurrentSessionId(sessionId);
        setState(prev => ({
          ...prev,
          currentSession: session,
          error: null
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to switch session'
      }));
    }
  }, []);

  // Send message to AI
  const sendMessage = useCallback(async (content: string) => {
    if (!state.currentSession || !content.trim()) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Add user message
      const userMessage = chatStorage.addMessage(state.currentSession.id, {
        role: 'user',
        content: content.trim()
      });

      // Update state with user message
      setState(prev => ({
        ...prev,
        currentSession: prev.currentSession ? {
          ...prev.currentSession,
          messages: [...prev.currentSession.messages, userMessage]
        } : null
      }));

      // Get AI response
      const userSessions = getSessions();
      const conversationHistory = state.currentSession.messages;
      
      const aiResponse = await cloudAI.sendChatMessage(
        content.trim(),
        conversationHistory,
        userSessions
      );

      // Add AI response
      const assistantMessage = chatStorage.addMessage(state.currentSession.id, {
        role: 'assistant',
        content: aiResponse
      });

      // Update state with AI response
      setState(prev => ({
        ...prev,
        currentSession: prev.currentSession ? {
          ...prev.currentSession,
          messages: [...prev.currentSession.messages, assistantMessage]
        } : null,
        isLoading: false
      }));

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
    try {
      chatStorage.updateSessionTitle(sessionId, title);
      setState(prev => ({
        ...prev,
        sessions: prev.sessions.map(session =>
          session.id === sessionId ? { ...session, title } : session
        ),
        currentSession: prev.currentSession?.id === sessionId
          ? { ...prev.currentSession, title }
          : prev.currentSession
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to update session title'
      }));
    }
  }, []);

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    try {
      chatStorage.deleteSession(sessionId);
      setState(prev => {
        const newSessions = prev.sessions.filter(s => s.id !== sessionId);
        const newCurrentSession = prev.currentSession?.id === sessionId ? null : prev.currentSession;
        
        return {
          ...prev,
          sessions: newSessions,
          currentSession: newCurrentSession
        };
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to delete session'
      }));
    }
  }, []);

  // Search messages
  const searchMessages = useCallback((query: string) => {
    setState(prev => ({ ...prev, isSearching: true }));

    try {
      const results = chatStorage.searchMessages(query);
      setState(prev => ({
        ...prev,
        searchQuery: query,
        searchResults: results,
        isSearching: false,
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSearching: false,
        error: 'Failed to search messages'
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
  const clearAllSessions = useCallback(() => {
    try {
      chatStorage.clearAllSessions();
      setState(prev => ({
        ...prev,
        sessions: [],
        currentSession: null,
        searchResults: []
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to clear sessions'
      }));
    }
  }, []);

  // Export sessions
  const exportSessions = useCallback(() => {
    try {
      return chatStorage.exportSessions();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to export sessions'
      }));
      return null;
    }
  }, []);

  // Import sessions
  const importSessions = useCallback((jsonData: string) => {
    try {
      const result = chatStorage.importSessions(jsonData);
      if (result.success) {
        loadSessions(); // Reload sessions
        setState(prev => ({ ...prev, error: null }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Failed to import sessions'
        }));
      }
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to import sessions'
      }));
      return { success: false, imported: 0 };
    }
  }, [loadSessions]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Check if AI is configured
  const isAIConfigured = cloudAI.isConfigured();

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
    sessionStats: chatStorage.getSessionStats()
  };
}
