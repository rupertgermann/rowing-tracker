'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Chat } from '@/components/ui/chat';
import { type Message } from '@/components/ui/chat-message';
import { useChat } from '@/hooks/useChat';
import { formatChartDate } from '@/lib/dateTimeUtils';
import {
  MessageCircle,
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  Edit2,
  Check,
  X,
  Bot,
  Clock,
  Brain,
} from 'lucide-react';
import { MemoryManager } from '@/components/MemoryManager';
import { useMemory } from '@/hooks/useMemory';
import { MemoryDocument, memoryStorage } from '@/lib/memoryStorage';
import { FileAttachment } from '@/lib/cloudAI';
import { blobToDataUrl } from '@/lib/documentProcessor';
import { settings } from '@/lib/settings';

export default function ChatPage() {
  const {
    currentSession,
    sessions,
    isLoading,
    error,
    searchQuery,
    searchResults,
    isSearching,
    sendMessage,
    createSession,
    switchSession,
    updateSessionTitle,
    deleteSession,
    searchMessages,
    clearSearch,
    clearAllSessions,
    exportSessions,
    importSessions,
    clearError,
    isAIConfigured
  } = useChat();

  const [messageInput, setMessageInput] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [attachedDocs, setAttachedDocs] = useState<MemoryDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(true);

  // Memory hook for document count badge and uploading attachments
  const { documents: memoryDocuments, uploadDocument } = useMemory();

  // Load prompt suggestions setting from settings
  useEffect(() => {
    setShowPromptSuggestions(settings.getUserPreferences().showPromptSuggestions);
  }, []);

  // Check if there are any suggestions to show (custom prompts always count, default prompts depend on toggle)
  const hasAnySuggestions = useMemo(() => {
    const userPreferences = settings.getUserPreferences();
    const hasCustomPrompts = userPreferences.customPrompts.length > 0;
    const showDefaultPrompts = userPreferences.showPromptSuggestions;
    return hasCustomPrompts || showDefaultPrompts;
  }, [settings]);

  // Convert our ChatMessage format to the kit's Message format
  const chatMessages: Message[] = useMemo(() => {
    if (!currentSession?.messages) return [];
    return currentSession.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: new Date(msg.timestamp),
    }));
  }, [currentSession?.messages]);

  // Handle input change for the Chat component
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
  }, []);

  // Helper function to convert a File to FileAttachment
  const fileToAttachment = useCallback(async (file: File): Promise<FileAttachment> => {
    const dataUrl = await blobToDataUrl(file);
    return {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      data: dataUrl
    };
  }, []);

  // Helper function to convert a MemoryDocument to FileAttachment (for images/PDFs with binary data)
  const memoryDocToAttachment = useCallback(async (doc: MemoryDocument): Promise<FileAttachment | null> => {
    // Only convert image/PDF documents that have binary data stored
    if (doc.type === 'image' || doc.type === 'pdf') {
      try {
        const arrayBuffer = await memoryStorage.getDocumentBlob(doc.id);
        if (arrayBuffer) {
          // Determine the correct MIME type
          // If mimeType is missing or generic, try to infer from document type
          let mimeType = doc.mimeType;
          if (!mimeType || mimeType === 'application/octet-stream') {
            if (doc.type === 'image') {
              // Try to infer from file extension
              const ext = doc.name.split('.').pop()?.toLowerCase();
              const imageTypes: Record<string, string> = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
              };
              mimeType = imageTypes[ext || ''] || 'image/jpeg'; // Default to jpeg for images
            } else if (doc.type === 'pdf') {
              mimeType = 'application/pdf';
            }
          }
          
          // Convert ArrayBuffer to Blob with correct MIME type
          const blob = new Blob([arrayBuffer], { type: mimeType });
          const dataUrl = await blobToDataUrl(blob);
          return {
            name: doc.name,
            mimeType: mimeType,
            data: dataUrl
          };
        }
      } catch (error) {
        console.error('Failed to get document blob:', error);
      }
    }
    return null;
  }, []);

  // Handle form submit for the Chat component
  const handleSubmit = useCallback(async (
    e?: { preventDefault?: () => void },
    options?: { experimental_attachments?: FileList }
  ) => {
    e?.preventDefault?.();
    
    const hasDirectAttachments = options?.experimental_attachments && options.experimental_attachments.length > 0;
    const hasMemoryDocs = attachedDocs.length > 0;
    
    if (!messageInput.trim() && !hasDirectAttachments && !hasMemoryDocs) return;
    if (!currentSession || isLoading) return;

    // Collect all file attachments
    const fileAttachments: FileAttachment[] = [];
    let textContext = '';

    // Process direct file attachments (from paperclip button)
    if (hasDirectAttachments) {
      const files = Array.from(options!.experimental_attachments!);
      for (const file of files) {
        try {
          const attachment = await fileToAttachment(file);
          fileAttachments.push(attachment);
          
          // Save to memory in the background (don't block sending)
          uploadDocument(file, { 
            description: `Attached in chat on ${new Date().toLocaleDateString()}` 
          }).catch(err => {
            console.warn('Failed to save attachment to memory:', err);
          });
        } catch (error) {
          console.error('Failed to process file attachment:', error);
        }
      }
    }

    // Process memory documents
    if (hasMemoryDocs) {
      for (const doc of attachedDocs) {
        // Try to get binary data for images/PDFs
        const attachment = await memoryDocToAttachment(doc);
        if (attachment) {
          fileAttachments.push(attachment);
        } else {
          // For text-based documents or if binary not available, include as text context
          const textContent = doc.extractedText || doc.description || '';
          if (textContent) {
            textContext += `\n\n[Attached: ${doc.name}]\n${textContent}`;
          }
        }
      }
    }

    // Build final message
    let fullMessage = messageInput.trim();
    if (textContext) {
      fullMessage = fullMessage ? `${fullMessage}\n\n---${textContext}` : textContext.trim();
    }

    // Send message with attachments
    sendMessage(fullMessage, fileAttachments.length > 0 ? fileAttachments : undefined);
    setMessageInput('');
    setAttachedDocs([]);
  }, [messageInput, attachedDocs, currentSession, isLoading, sendMessage, fileToAttachment, memoryDocToAttachment, uploadDocument]);

  // Handle append for prompt suggestions
  const handleAppend = useCallback((message: { role: 'user'; content: string }) => {
    if (!currentSession) return;
    sendMessage(message.content);
  }, [currentSession, sendMessage]);

  // Handle editing a suggestion (populate input without sending)
  const handleEditSuggestion = useCallback((suggestion: string) => {
    setMessageInput(suggestion);
  }, []);

  // Handle attaching document from memory
  const handleAttachDocument = (doc: MemoryDocument) => {
    if (!attachedDocs.find(d => d.id === doc.id)) {
      setAttachedDocs(prev => [...prev, doc]);
    }
    setShowMemory(false);
  };

  // Convert MemoryDocument to File for Chat component
  const attachedFiles = useMemo(() => {
    return attachedDocs.map(doc => {
      // Create a dummy file object that mimics the File interface
      // This is enough for the Chat component to display it
      const file = new File([""], doc.name, { type: 'application/octet-stream' });
      // We can attach extra metadata if needed, but for now name is enough
      return file;
    });
  }, [attachedDocs]);

  // Start editing session title
  const startEditingTitle = (session: any) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  // Save edited title
  const saveEditedTitle = () => {
    if (editingSessionId && editingTitle.trim()) {
      updateSessionTitle(editingSessionId, editingTitle.trim());
      setEditingSessionId(null);
      setEditingTitle('');
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // Handle search
  const handleSearch = (query: string) => {
    searchMessages(query);
  };

  // Handle export
  const handleExport = () => {
    const data = exportSessions();
    if (data) {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rowing-chat-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Handle import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        importSessions(data);
      };
      reader.readAsText(file);
    }
  };

  // Prompt suggestions for empty chat - custom prompts always shown, default prompts controlled by toggle
  const promptSuggestions = useMemo(() => {
    const defaultPrompts = [
      "How can I improve my rowing technique?",
      "What's next on the training plan?",
      "Read your memory and rate my progress",
      "Analyze my recent training sessions",
      "Create a 4-week training plan for me",
      "What's my average pace trend?",
      "Show me my training history",
      "give me the Detailed stroke analysis for my latest session.",
    ];
    
    const userPreferences = settings.getUserPreferences();
    const customPrompts = userPreferences.customPrompts;
    
    // Always show custom prompts, default prompts only if toggle is enabled
    const suggestions = userPreferences.showPromptSuggestions 
      ? [...defaultPrompts, ...customPrompts]
      : customPrompts;
    
    return suggestions;
  }, [settings]);

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return formatChartDate(date);
    }
  };

  return (
    <div className="container mx-auto p-4 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">AI Rowing Coach</h1>
            <p className="text-muted-foreground">
              Your personal trainer for performance optimization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showMemory ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMemory(!showMemory)}
            className="relative"
          >
            <Brain className="h-4 w-4 mr-2" />
            Memory
            {memoryDocuments.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                {memoryDocuments.length > 9 ? '9+' : memoryDocuments.length}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={sessions.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={clearError}>
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      {showSearch && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search through your conversations..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="flex-1"
              />
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                <div className="text-sm font-medium text-muted-foreground">
                  Found {searchResults.length} results
                </div>
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="p-2 bg-muted rounded text-sm cursor-pointer hover:bg-muted/80"
                    onClick={() => switchSession(result.session.id)}
                  >
                    <div className="font-medium">{result.session.title}</div>
                    <div className="text-muted-foreground truncate">
                      {result.message.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Memory Panel Slide-out */}
      {showMemory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMemory(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-md h-full bg-background shadow-xl animate-in slide-in-from-right duration-300">
            <MemoryManager
              onClose={() => setShowMemory(false)}
              onAttachToChat={handleAttachDocument}
            />
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sessions Sidebar */}
        <Card className="w-80 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Conversations</CardTitle>
              <Button
                size="sm"
                onClick={() => createSession()}
                disabled={!isAIConfigured}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {!isAIConfigured ? (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">AI Not Configured</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your OpenAI API key to start chatting with your AI coach.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/settings">Configure AI</a>
                </Button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Conversations Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Start your first chat with your AI rowing coach.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${currentSession?.id === session.id
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted'
                      }`}
                    onClick={() => switchSession(session.id)}
                  >
                    <div className="flex items-center justify-between">
                      {editingSessionId === session.id ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="h-6 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditedTitle();
                              if (e.key === 'Escape') cancelEditing();
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              saveEditedTitle();
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelEditing();
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {session.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {session.messages.length} messages • {formatDate(session.updatedAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingTitle(session);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {currentSession ? (
            <>
              <CardHeader className="pb-3 border-b flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{currentSession.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      Created {formatDate(currentSession.createdAt)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isAIConfigured ? "default" : "secondary"}>
                      {isAIConfigured ? "AI Ready" : "AI Offline"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <div className="flex-1 overflow-hidden">
                {hasAnySuggestions ? (
                  <Chat
                    messages={chatMessages}
                    input={messageInput}
                    handleInputChange={handleInputChange}
                    handleSubmit={handleSubmit}
                    isGenerating={isLoading}
                    append={handleAppend}
                    suggestions={promptSuggestions}
                    className="h-full"
                    externalAttachments={attachedFiles}
                    onEditSuggestion={handleEditSuggestion}
                  />
                ) : (
                  <Chat
                    messages={chatMessages}
                    input={messageInput}
                    handleInputChange={handleInputChange}
                    handleSubmit={handleSubmit}
                    isGenerating={isLoading}
                    className="h-full"
                    externalAttachments={attachedFiles}
                  />
                )}
              </div>

              {!isAIConfigured && (
                <div className="p-4 border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    Configure your OpenAI API key to start chatting
                  </p>
                </div>
              )}
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {isAIConfigured ? 'Select a Conversation' : 'AI Coach Not Ready'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {isAIConfigured
                    ? 'Choose an existing conversation or start a new one.'
                    : 'Configure your OpenAI API key to begin chatting with your AI coach.'
                  }
                </p>
                {isAIConfigured && (
                  <Button onClick={() => createSession()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Start New Chat
                  </Button>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
