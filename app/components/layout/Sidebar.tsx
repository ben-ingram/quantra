"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Icon components (inline SVGs for zero dependencies)
const Icons = {
  logo: () => (
    <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
      <rect x="2" y="2" width="28" height="28" rx="4" className="fill-primary" />
      <path
        d="M8 16L14 22L24 10"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  dashboard: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  codeExpert: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  profile: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  collapse: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
    </svg>
  ),
  expand: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
    </svg>
  ),
};

interface NavItem {
  name: string;
  href: string;
  icon: keyof typeof Icons;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { name: "Projects", href: "/", icon: "dashboard" },
  { name: "Code Expert", href: "/ask", icon: "codeExpert" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = Icons[item.icon];

    return (
      <Link
        href={item.href}
        className={`
          group flex items-center gap-3 px-3 py-2.5 rounded-lg
          transition-all duration-200 relative
          ${isActive
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover border border-transparent"
          }
        `}
        title={collapsed ? item.name : undefined}
      >
        <span className={`flex-shrink-0 ${isActive ? "text-primary" : ""}`}>
          <Icon />
        </span>

        {!collapsed && (
          <>
            <span className="flex-1 text-sm font-medium truncate">
              {item.name}
            </span>

            {item.badge && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-accent text-white">
                {item.badge}
              </span>
            )}
          </>
        )}

        {collapsed && item.badge && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-accent text-white">
            {item.badge > 9 ? "9+" : item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`
        fixed top-0 left-0 z-40 h-screen
        bg-background-secondary border-r border-border
        transition-all duration-300 ease-in-out
        flex flex-col
        ${collapsed ? "w-[72px]" : "w-[280px]"}
      `}
    >
      {/* Logo Section */}
      <div className={`
        flex items-center h-16 px-4 border-b border-border
        ${collapsed ? "justify-center" : "justify-between"}
      `}>
        <Link href="/" className="flex items-center gap-3">
          <Icons.logo />
          {!collapsed && (
            <span className="text-xl font-bold tracking-tight">
              Quantra
            </span>
          )}
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {mainNavItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-border p-3 space-y-1">
        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
            text-foreground-muted hover:text-foreground hover:bg-surface-hover
            transition-all duration-200
            ${collapsed ? "justify-center" : ""}
          `}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Icons.expand /> : <Icons.collapse />}
          {!collapsed && (
            <span className="text-sm font-medium">Collapse</span>
          )}
        </button>
      </div>
    </aside>
  );
}
