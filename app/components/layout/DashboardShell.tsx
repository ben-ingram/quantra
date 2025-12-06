"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";

// Header Icons
const Icons = {
  search: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  bell: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  menu: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
};

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function DashboardShell({
  children,
  title,
  description,
  actions,
}: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div
        className={`
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[280px]"}
        `}
      >
        {/* Glass Header */}
        <header className="sticky top-0 z-20 h-16 glass border-b border-border-subtle">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            {/* Left Section - Mobile Menu + Title */}
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <Icons.menu />
              </button>

              {/* Page Title (optional) */}
              {title && (
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {title}
                  </h1>
                  {description && (
                    <p className="text-sm text-foreground-muted hidden sm:block">
                      {description}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Center Section - Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                  <Icons.search />
                </span>
                <input
                  type="text"
                  placeholder="Search projects, scans, issues..."
                  className="w-full pl-10 pr-4 py-2 bg-surface/50 border border-border rounded-lg text-sm placeholder:text-foreground-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-xs text-foreground-muted bg-surface rounded border border-border">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>

            {/* Right Section - Actions */}
            <div className="flex items-center gap-2">
              {/* Mobile Search Button */}
              <button className="md:hidden p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors">
                <Icons.search />
              </button>

              {/* Notifications */}
              <button className="relative p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors">
                <Icons.bell />
                {/* Notification Badge */}
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full animate-pulse-status" />
              </button>

              {/* User Avatar */}
              <button className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-surface-hover transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center text-white text-sm font-semibold">
                  JD
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-foreground">John Doe</p>
                  <p className="text-xs text-foreground-muted">Project Manager</p>
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* Page Header with Actions */}
        {(title || actions) && (
          <div className="border-b border-border bg-background-secondary/50">
            <div className="px-4 lg:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  {title && (
                    <h1 className="text-2xl font-bold text-foreground">
                      {title}
                    </h1>
                  )}
                  {description && (
                    <p className="mt-1 text-foreground-secondary">
                      {description}
                    </p>
                  )}
                </div>
                {actions && (
                  <div className="flex items-center gap-3">
                    {actions}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
