"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { brand, nav } from "@/lib/content";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/#")) return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled ? "py-3" : "py-5"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className={`flex items-center gap-3 rounded-full px-3 py-2 transition-colors ${
            scrolled ? "glass-strong" : ""
          }`}
        >
          <span className="relative flex h-8 w-8 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan/40 via-violet/35 to-amber/30 blur-[6px]" />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-void-elevated font-display text-xs font-bold tracking-tight text-cyan-soft">
              Q
            </span>
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[0.95rem] font-semibold tracking-[0.18em] text-ink">
              {brand.name.toUpperCase()}
            </span>
            <span className="mt-1 hidden font-mono text-[0.58rem] tracking-[0.1em] text-ink-dim sm:block">
              {brand.domain}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-1.5 ${
              scrolled ? "glass-strong" : "glass"
            }`}
          >
            {nav.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-white/8 text-ink"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/#contact"
              className="btn-primary ml-1 !px-4 !py-1.5 !text-sm"
            >
              Get in touch
            </Link>
          </div>
        </nav>

        <button
          type="button"
          className="glass flex h-10 w-10 items-center justify-center rounded-full md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menu</span>
          <div className="flex w-4 flex-col gap-1">
            <span
              className={`h-px w-full bg-ink transition-transform ${
                open ? "translate-y-[2.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-px w-full bg-ink transition-opacity ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`h-px w-full bg-ink transition-transform ${
                open ? "-translate-y-[2.5px] -rotate-45" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {open && (
        <div className="glass-strong mx-5 mt-3 rounded-2xl p-4 md:hidden">
          <div className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-3 text-sm text-ink-muted hover:bg-white/5 hover:text-ink"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/#contact"
              className="btn-primary mt-2"
              onClick={() => setOpen(false)}
            >
              Get in touch
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
