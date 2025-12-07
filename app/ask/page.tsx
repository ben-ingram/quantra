"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/app/components/layout";
import {
  Send,
  Loader2,
  MessageSquare,
  Sparkles,
  History,
  Plus,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Table2,
  BookOpen,
  X,
  Trash2,
  Clock,
} from "lucide-react";
import {
  askCodeExpert,
  getChatSessions,
  getChatSession,
  deleteChatSession,
  type ChatSession,
  type ChatMessage,
  type Citation,
  type TableData,
} from "@/app/actions/chat";

// =============================================================================
// Ask Code Expert Page
// =============================================================================

export default function AskCodeExpertPage() {
  return (
    <DashboardShell hideHeader>
      <Suspense fallback={<LoadingFallback />}>
        <AskCodeExpertContent />
      </Suspense>
    </DashboardShell>
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-120px)]">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

function AskCodeExpertContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Load session from URL
  useEffect(() => {
    const sessionId = searchParams.get("session");
    if (sessionId && sessionId !== currentSessionId) {
      loadSession(sessionId);
    }
  }, [searchParams]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const loadSessions = async () => {
    try {
      setIsLoadingHistory(true);
      const data = await getChatSessions();
      setSessions(data);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const data = await getChatSession(sessionId);
      if (data) {
        setCurrentSessionId(sessionId);
        setMessages(data.messages);
      }
    } catch (error) {
      console.error("Failed to load session:", error);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setInputValue("");
    router.push("/ask");
  };

  const handleSelectSession = (sessionId: string) => {
    router.push(`/ask?session=${sessionId}`);
    setShowHistory(false);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;

    try {
      await deleteChatSession(sessionId);
      await loadSessions();
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = inputValue.trim();
    if (!query || isLoading) return;

    setInputValue("");
    setIsLoading(true);

    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: currentSessionId || "",
      role: "user",
      content: query,
      citations: [],
      tables: [],
      compliance_result: null,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await askCodeExpert({
        sessionId: currentSessionId || undefined,
        query,
        jurisdiction: "Florida",
      });

      // Update session ID if new
      if (response.isNewSession) {
        setCurrentSessionId(response.sessionId);
        router.replace(`/ask?session=${response.sessionId}`);
        await loadSessions();
      }

      // Replace temp message with real one and add assistant response
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.id.startsWith("temp-"));
        // Add the actual user message (from DB) and assistant response
        return [
          ...filtered,
          { ...tempUserMessage, session_id: response.sessionId },
          response.message,
        ];
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* History Sidebar - Desktop */}
      <div className="hidden lg:flex w-64 flex-col border-r border-border bg-surface">
        <div className="p-4 border-b border-border">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-foreground-muted animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-foreground-muted text-center py-8">
              No conversations yet
            </p>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={currentSessionId === session.id}
                  onSelect={() => handleSelectSession(session.id)}
                  onDelete={(e) => handleDeleteSession(session.id, e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-border">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors"
          >
            <History className="w-5 h-5" />
            History
          </button>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>

        {/* Mobile History Drawer */}
        {showHistory && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowHistory(false)}>
            <div
              className="absolute left-0 top-0 bottom-0 w-72 bg-surface border-r border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">History</h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 rounded hover:bg-surface-hover text-foreground-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-2 overflow-y-auto max-h-[calc(100vh-120px)]">
                {sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={currentSessionId === session.id}
                    onSelect={() => handleSelectSession(session.id)}
                    onDelete={(e) => handleDeleteSession(session.id, e)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onExampleClick={(q) => setInputValue(q)} />
          ) : (
            <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex items-center gap-3 text-foreground-muted">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Searching code database...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4 bg-surface">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about building code requirements..."
                rows={1}
                disabled={isLoading}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-surface-hover border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 resize-none"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="absolute right-2 bottom-2 p-2 rounded-lg bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-foreground-muted text-center">
              Powered by Florida Building Code RAG. Press Enter to send, Shift+Enter for new line.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group transition-colors
        ${isActive ? "bg-primary/10 text-primary" : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"}
      `}
    >
      <MessageSquare className="w-4 h-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{session.title}</p>
        <p className="text-xs text-foreground-muted">
          {new Date(session.updated_at).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={onDelete}
        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-danger/10 hover:text-danger transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function EmptyState({ onExampleClick }: { onExampleClick: (query: string) => void }) {
  const examples = [
    "What is the maximum riser height for stairs?",
    "Door swing requirements for rooms with 50+ occupants",
    "Minimum corridor width for egress",
    "Handrail height requirements for stairs",
    "Fire-rated door requirements for stairwells",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="max-w-2xl w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Ask Code Expert
        </h1>
        <p className="text-foreground-muted mb-8 max-w-md mx-auto">
          Get instant answers about Florida Building Code requirements. Ask any question and get citations to the exact code sections.
        </p>

        <div className="grid gap-2 max-w-md mx-auto">
          <p className="text-xs text-foreground-muted uppercase tracking-wide mb-2">
            Try asking:
          </p>
          {examples.map((example, i) => (
            <button
              key={i}
              onClick={() => onExampleClick(example)}
              className="text-left px-4 py-3 rounded-lg border border-border hover:border-primary/50 hover:bg-surface-hover text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              &ldquo;{example}&rdquo;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-primary/10" : "bg-gradient-to-br from-primary to-info"
        }`}
      >
        {isUser ? (
          <span className="text-sm font-medium text-primary">U</span>
        ) : (
          <Sparkles className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        {isUser ? (
          <div className="inline-block px-4 py-2 rounded-2xl bg-primary text-white text-sm whitespace-pre-wrap">
            {message.content}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main content with markdown-like formatting */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MessageContent content={message.content} />
            </div>

            {/* Tables */}
            {message.tables && message.tables.length > 0 && (
              <div className="space-y-3">
                {message.tables.map((table, i) => (
                  <TableCard key={i} table={table} />
                ))}
              </div>
            )}

            {/* Citations */}
            {message.citations && message.citations.length > 0 && (
              <CitationsSection citations={message.citations} />
            )}
          </div>
        )}

        <p className="text-xs text-foreground-muted mt-2">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Simple markdown-like parsing
  const lines = content.split("\n");

  return (
    <div className="text-sm text-foreground space-y-2">
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="font-semibold text-foreground mt-4 mb-2">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="font-bold text-foreground mt-4 mb-2">
              {line.slice(3)}
            </h2>
          );
        }

        // Bullet points
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-primary">•</span>
              <span>{formatInlineStyles(line.slice(2))}</span>
            </div>
          );
        }

        // Empty lines
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }

        // Regular paragraphs
        return (
          <p key={i} className="leading-relaxed">
            {formatInlineStyles(line)}
          </p>
        );
      })}
    </div>
  );
}

function formatInlineStyles(text: string): React.ReactNode {
  // Bold text: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Code references like FBC 1011.5.2
    const codeRefRegex = /(FBC\s*\d+\.?\d*\.?\d*)/g;
    const subParts = part.split(codeRefRegex);

    return subParts.map((subPart, j) => {
      if (codeRefRegex.test(subPart)) {
        return (
          <code
            key={`${i}-${j}`}
            className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs"
          >
            {subPart}
          </code>
        );
      }
      return subPart;
    });
  });
}

function TableCard({ table }: { table: TableData }) {
  const [expanded, setExpanded] = useState(false);

  // Try to render as HTML table if data is array of objects
  const renderTable = () => {
    if (Array.isArray(table.data) && table.data.length > 0) {
      const firstRow = table.data[0] as Record<string, unknown>;
      if (typeof firstRow === "object" && firstRow !== null) {
        const headers = Object.keys(firstRow);

        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2 text-left font-medium text-foreground-muted"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.data.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {headers.map((header) => (
                      <td key={header} className="px-3 py-2 text-foreground">
                        {String((row as Record<string, unknown>)[header] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }

    // Fallback to JSON
    return (
      <pre className="text-xs bg-surface-hover p-3 rounded overflow-x-auto">
        {JSON.stringify(table.data, null, 2)}
      </pre>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors"
      >
        <Table2 className="w-4 h-4 text-primary" />
        <div className="flex-1 text-left">
          <p className="font-medium text-foreground text-sm">
            {table.title || table.tableId}
          </p>
          {table.sectionReference && (
            <p className="text-xs text-foreground-muted">{table.sectionReference}</p>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-foreground-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-foreground-muted" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          {table.summary && (
            <p className="text-xs text-foreground-muted mb-3">{table.summary}</p>
          )}
          {renderTable()}
        </div>
      )}
    </div>
  );
}

function CitationsSection({ citations }: { citations: Citation[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Only show top citations by score
  const topCitations = citations
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-xs text-foreground-muted uppercase tracking-wide mb-2">
        Sources
      </p>
      <div className="flex flex-wrap gap-2">
        {topCitations.map((citation, i) => (
          <div key={i} className="relative">
            <button
              onClick={() =>
                setExpanded(expanded === citation.section ? null : citation.section)
              }
              className={`
                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                ${
                  expanded === citation.section
                    ? "bg-primary text-white"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }
              `}
            >
              <BookOpen className="w-3 h-3" />
              {citation.section}
            </button>

            {/* Expanded citation content */}
            {expanded === citation.section && (
              <div className="absolute left-0 top-full mt-2 z-10 w-80 p-4 rounded-lg border border-border bg-surface shadow-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {citation.section}
                    </p>
                    {citation.title && (
                      <p className="text-xs text-foreground-muted">{citation.title}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setExpanded(null)}
                    className="p-1 rounded hover:bg-surface-hover text-foreground-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-foreground leading-relaxed max-h-48 overflow-y-auto">
                  {citation.content}
                </div>
                {citation.source && (
                  <p className="mt-2 text-xs text-foreground-muted">
                    Source: {citation.source}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
