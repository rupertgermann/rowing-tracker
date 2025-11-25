'use client';

import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useChat } from '@/hooks/useChat';
import { formatChartDate, formatTime as formatTimeUtil } from '@/lib/dateTimeUtils';
import {
  MessageCircle,
  Send,
  Search,
  Plus,
  MoreHorizontal,
  Trash2,
  Download,
  Upload,
  Edit2,
  Check,
  X,
  Bot,
  User,
  Clock,
  Settings,
  Loader2
} from 'lucide-react';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // Handle sending message
  const handleSendMessage = () => {
    if (messageInput.trim() && currentSession && !isLoading) {
      sendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  // Handle Enter key in message input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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

  // Format timestamp - uses user preferences from dateTimeUtils
  const formatTime = (date: Date) => formatTimeUtil(date);

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
        <Card className="flex-1 flex flex-col">
          {currentSession ? (
            <>
              <CardHeader className="pb-3 border-b">
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

              <CardContent className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {currentSession.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-blue-600" />
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                          }`}
                      >
                        <div className="text-sm">
                          {message.role === 'assistant' ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  // Custom styling for common markdown elements
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  code: ({ className, children }) => {
                                    const isInline = !className;
                                    return isInline
                                      ? <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                                      : <pre className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto mb-2"><code>{children}</code></pre>;
                                  },
                                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                  em: ({ children }) => <em className="italic">{children}</em>,
                                  h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                                  blockquote: ({ children }) => <blockquote className="border-l-4 border-muted-foreground pl-3 italic">{children}</blockquote>,
                                  table: ({ children }) => <div className="overflow-x-auto mb-4"><table className="min-w-full divide-y divide-border border rounded-md">{children}</table></div>,
                                  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                                  tbody: ({ children }) => <tbody className="divide-y divide-border bg-card">{children}</tbody>,
                                  tr: ({ children }) => <tr className="hover:bg-muted/50 transition-colors">{children}</tr>,
                                  th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{children}</th>,
                                  td: ({ children }) => <td className="px-3 py-2 whitespace-nowrap text-sm">{children}</td>,
                                }}
                                disallowedElements={['script', 'iframe', 'object', 'embed']}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          )}
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="text-sm text-muted-foreground">
                          AI coach is thinking...
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </CardContent>

              <div className="p-4 border-t">
                <div className="flex gap-2 items-end">
                  <Textarea
                    placeholder="Ask your AI rowing coach anything... (Shift+Enter for new line)"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={!isAIConfigured || isLoading}
                    className="flex-1 min-h-[44px] max-h-[200px] resize-y"
                    rows={1}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || !isAIConfigured || isLoading}
                    className="h-[44px]"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {!isAIConfigured && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Configure your OpenAI API key to start chatting
                  </p>
                )}
              </div>
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
