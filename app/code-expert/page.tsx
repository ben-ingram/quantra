"use client";

import { DashboardShell } from "@/app/components/layout";
import { ComplianceAnalyzer } from "@/app/components/dashboard";

// =============================================================================
// Ask Code Expert Page - Standalone SUPER RAG Chat
// =============================================================================

export default function CodeExpertPage() {
  return (
    <DashboardShell
      title="Ask Code Expert"
      description="AI-powered Florida Building Code compliance assistant"
    >
      <div className="max-w-4xl mx-auto">
        {/* Intro Card */}
        <div className="rounded-xl border border-border bg-surface p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <SparklesIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                SUPER RAG Compliance Engine
              </h2>
              <p className="text-foreground-muted mt-1">
                Ask questions about Florida Building Code requirements. The AI will search
                through the complete FBC code sections using hybrid semantic and keyword search
                to provide accurate, cited answers.
              </p>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1.5 text-foreground-muted">
                  <BookIcon className="w-4 h-4" />
                  <span>Full FBC Chapters 1-35</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground-muted">
                  <SearchIcon className="w-4 h-4" />
                  <span>Hybrid Search</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground-muted">
                  <LinkIcon className="w-4 h-4" />
                  <span>Code Citations</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Example Queries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <ExampleQuery query="What are the minimum stair tread depth requirements?" />
          <ExampleQuery query="Fire door clearance requirements for egress corridors" />
          <ExampleQuery query="Handrail height requirements for ramps" />
          <ExampleQuery query="Maximum riser height for spiral stairs" />
        </div>

        {/* Compliance Analyzer - Full Width */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <ComplianceAnalyzer
            jurisdiction="Florida"
            inline
          />
        </div>
      </div>
    </DashboardShell>
  );
}

// =============================================================================
// Components
// =============================================================================

function ExampleQuery({ query }: { query: string }) {
  return (
    <button className="text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-surface-hover transition-colors">
      <p className="text-sm text-foreground-muted">
        <span className="text-primary font-medium">Try:</span> "{query}"
      </p>
    </button>
  );
}

// =============================================================================
// Icons
// =============================================================================

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}
