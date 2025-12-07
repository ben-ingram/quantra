"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { performSuperRAGAnalysis } from "@/app/actions/performSuperRAGAnalysis";
import type { BimElementData } from "@/app/components/dashboard/BimViewer";
import type { ProjectContext } from "../page";
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  User,
  Bot,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Trash2,
  Building2,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  result?: ComplianceResult;
  isLoading?: boolean;
}

interface ComplianceResult {
  status: "PASS" | "FAIL" | "WARNING";
  citation: string;
  reasoning: string;
  riskScore: number;
  recommendations?: string[];
  confidence: number;
}

// =============================================================================
// Code Assistant Tab
// =============================================================================

export function CodeAssistantTab({
  projectId,
  projectContext,
  selectedElement,
  initialQuery,
  onQueryConsumed,
}: {
  projectId: string;
  projectContext: ProjectContext;
  selectedElement: BimElementData | null;
  initialQuery: string | null;
  onQueryConsumed?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedQueryRef = useRef<string | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle initial query from BIM element selection
  useEffect(() => {
    if (initialQuery && initialQuery !== processedQueryRef.current) {
      processedQueryRef.current = initialQuery;
      handleSubmit(initialQuery);
      onQueryConsumed?.();
    }
  }, [initialQuery, onQueryConsumed]);

  // Build context prefix for queries based on project occupancy/construction
  const buildQueryWithContext = (query: string): string => {
    const contextParts: string[] = [];

    if (projectContext.occupancyGroup) {
      contextParts.push(`Occupancy Group: ${projectContext.occupancyGroup}`);
    }
    if (projectContext.constructionType) {
      contextParts.push(`Construction Type: ${projectContext.constructionType}`);
    }

    if (contextParts.length === 0) return query;

    // Prefix the query with project context for more relevant RAG results
    return `[Project Context: ${contextParts.join(", ")}] ${query}`;
  };

  // Submit a query
  const handleSubmit = async (query?: string) => {
    const queryText = query || inputValue.trim();
    if (!queryText || isLoading) return;

    // Add user message (show original query to user)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: queryText,
      timestamp: new Date(),
    };

    // Add loading assistant message
    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Add project context prefix to the query for more relevant results
      const contextualQuery = buildQueryWithContext(queryText);

      const response = await performSuperRAGAnalysis({
        query: contextualQuery,
        jurisdiction: "Florida",
        textMatchCount: 8,
        tableMatchThreshold: 0.82,
      });

      // Update the loading message with the result
      setMessages(prev =>
        prev.map(msg =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                isLoading: false,
                content: response.result.reasoning,
                result: {
                  status: response.result.status,
                  citation: response.result.citation,
                  reasoning: response.result.reasoning,
                  riskScore: response.result.riskScore,
                  recommendations: response.result.recommendations,
                  confidence: response.result.confidence,
                },
              }
            : msg
        )
      );
    } catch (error) {
      // Update with error message
      setMessages(prev =>
        prev.map(msg =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                isLoading: false,
                content: "Sorry, I encountered an error while analyzing. Please try again.",
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Clear chat
  const handleClear = () => {
    setMessages([]);
    processedQueryRef.current = null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Code Assistant</h3>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Project Context Banner */}
      {(projectContext.occupancyGroup || projectContext.constructionType) && (
        <div className="px-4 py-2 bg-accent/5 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <Building2 className="w-3 h-3" />
            <span>Project Context (auto-applied to queries)</span>
          </div>
          <div className="flex gap-3 mt-1">
            {projectContext.occupancyGroup && (
              <span className="text-xs font-medium text-accent">
                {projectContext.occupancyGroup}
              </span>
            )}
            {projectContext.constructionType && (
              <span className="text-xs font-medium text-foreground-secondary">
                {projectContext.constructionType}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Selected Element Banner */}
      {selectedElement && (
        <div className="px-4 py-2 bg-primary/5 border-b border-border">
          <p className="text-xs text-foreground-muted">Selected Element</p>
          <p className="text-sm font-medium text-primary">{selectedElement.name}</p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyState onExampleClick={handleSubmit} />
        ) : (
          messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about building code requirements..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-surface-hover border border-border text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function EmptyState({ onExampleClick }: { onExampleClick: (query: string) => void }) {
  const examples = [
    "What are the minimum stair tread depth requirements?",
    "Maximum riser height for spiral stairs?",
    "Door swing direction requirements for 50+ occupants",
    "Minimum corridor width for egress",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">Code Assistant</h3>
      <p className="text-sm text-foreground-muted mb-6 max-w-xs">
        Ask questions about Florida Building Code requirements. Click an element in the 3D viewer to auto-generate queries.
      </p>

      <div className="space-y-2 w-full max-w-xs">
        <p className="text-xs text-foreground-muted uppercase tracking-wide">Try asking:</p>
        {examples.map((example, i) => (
          <button
            key={i}
            onClick={() => onExampleClick(example)}
            className="w-full text-left px-3 py-2 text-sm rounded-lg border border-border hover:border-primary/50 hover:bg-surface-hover text-foreground-muted hover:text-foreground transition-colors"
          >
            "{example}"
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-primary/10" : "bg-accent/10"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary" />
        ) : (
          <Bot className="w-4 h-4 text-accent" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        {message.isLoading ? (
          <div className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-hover">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-sm text-foreground-muted">Analyzing...</span>
          </div>
        ) : isUser ? (
          <div className="inline-block px-4 py-2 rounded-xl bg-primary text-white text-sm">
            {message.content}
          </div>
        ) : message.result ? (
          <ComplianceResultCard result={message.result} />
        ) : (
          <div className="inline-block px-4 py-2 rounded-xl bg-surface-hover text-foreground text-sm">
            {message.content}
          </div>
        )}

        <p className="text-xs text-foreground-muted mt-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

function ComplianceResultCard({ result }: { result: ComplianceResult }) {
  const statusConfig = {
    PASS: {
      bg: "bg-success/10",
      border: "border-success/30",
      text: "text-success",
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: "Compliant",
    },
    WARNING: {
      bg: "bg-warning/10",
      border: "border-warning/30",
      text: "text-warning",
      icon: <AlertTriangle className="w-4 h-4" />,
      label: "Needs Review",
    },
    FAIL: {
      bg: "bg-danger/10",
      border: "border-danger/30",
      text: "text-danger",
      icon: <XCircle className="w-4 h-4" />,
      label: "Non-Compliant",
    },
  };

  const config = statusConfig[result.status];

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden text-left">
      {/* Status Header */}
      <div className={`flex items-center gap-2 px-4 py-2 ${config.bg} border-b ${config.border}`}>
        <div className={config.text}>{config.icon}</div>
        <span className={`font-semibold ${config.text}`}>{config.label}</span>
        <span className="ml-auto text-xs text-foreground-muted">
          Risk: {result.riskScore}/10
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Citation */}
        <div>
          <p className="text-xs text-foreground-muted uppercase tracking-wide mb-1">Citation</p>
          <p className="text-sm font-mono text-primary">{result.citation}</p>
        </div>

        {/* Reasoning */}
        <div>
          <p className="text-xs text-foreground-muted uppercase tracking-wide mb-1">Analysis</p>
          <p className="text-sm text-foreground">{result.reasoning}</p>
        </div>

        {/* Recommendations */}
        {result.recommendations && result.recommendations.length > 0 && (
          <div>
            <p className="text-xs text-foreground-muted uppercase tracking-wide mb-1">
              Recommendations
            </p>
            <ul className="space-y-1">
              {result.recommendations.slice(0, 3).map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground-secondary">
                  <span className="text-primary">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-foreground-muted">
          <span>Confidence: {Math.round(result.confidence * 100)}%</span>
          <span>SUPER RAG Analysis</span>
        </div>
      </div>
    </div>
  );
}
