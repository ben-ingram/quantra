"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { brand, cycle, stats } from "@/lib/content";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] flex-col justify-center px-5 pb-20 pt-32 sm:px-8 sm:pb-28"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[75vh] bg-mesh opacity-95" />
      <div className="pointer-events-none absolute inset-0 grid-overlay" />

      {/* Orbital space motif */}
      <div
        className="pointer-events-none absolute top-[12%] left-1/2 hidden h-[520px] w-[520px] -translate-x-1/2 lg:block"
        aria-hidden
      >
        <div className="orbit-ring animate-orbit absolute inset-0 opacity-40" />
        <div className="orbit-ring animate-orbit-slow absolute inset-10 opacity-30" />
        <div className="orbit-ring absolute inset-24 opacity-20" />
        <div className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan shadow-[0_0_24px_rgba(34,211,238,0.8)]" />
        <div className="animate-orbit absolute inset-0">
          <span className="absolute top-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-cyan-soft/80 shadow-[0_0_12px_rgba(103,232,249,0.7)]" />
        </div>
        <div className="animate-orbit-slow absolute inset-10">
          <span className="absolute top-1/2 right-0 h-2 w-2 -translate-y-1/2 rounded-full bg-violet-soft/70 shadow-[0_0_12px_rgba(167,139,250,0.6)]" />
        </div>
        <div className="animate-orbit absolute inset-24" style={{ animationDuration: "36s" }}>
          <span className="absolute bottom-0 left-1/3 h-1.5 w-1.5 rounded-full bg-amber/80 shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md"
        >
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-60"
              style={{ animationDuration: "2.2s" }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
          </span>
          <span className="font-mono text-[0.68rem] tracking-[0.2em] text-ink-muted uppercase">
            Construction systems · {brand.domain}
          </span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.06, ease }}
          className="font-display text-sm font-semibold tracking-[0.42em] text-cyan-soft sm:text-base"
        >
          {brand.name.toUpperCase()}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.12, ease }}
          className="mt-5 max-w-4xl font-display text-[2.55rem] leading-[1.05] font-semibold tracking-tight sm:text-6xl lg:text-7xl"
        >
          <span className="block text-gradient">See the job before it starts.</span>
          <span className="mt-2 block text-ink">Protect it. Close it clean.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.26, ease }}
          className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-muted sm:text-xl"
        >
          {brand.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.38, ease }}
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <a href="#products" className="btn-primary">
            Explore flagship products
            <ArrowIcon />
          </a>
          <a href="#cycle" className="btn-ghost">
            The construction cycle
          </a>
          <Link href="/about" className="btn-ghost">
            About Quantra
          </Link>
        </motion.div>

        {/* Mini cycle strip */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease }}
          className="mt-14 flex flex-wrap items-center gap-2 sm:gap-3"
        >
          {cycle.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2 sm:gap-3">
              <a
                href={`#${step.productId}`}
                className="glass group flex items-center gap-2.5 rounded-full px-3.5 py-2 transition-colors hover:border-cyan/30"
              >
                <span className="font-mono text-[0.65rem] text-cyan">{step.phase}</span>
                <span className="text-sm font-medium text-ink group-hover:text-cyan-soft">
                  {step.short}
                </span>
              </a>
              {i < cycle.length - 1 && (
                <span className="hidden h-px w-6 bg-gradient-to-r from-cyan/40 to-violet/40 sm:block" />
              )}
            </div>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.6, ease }}
          className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="glass rounded-2xl px-4 py-4 sm:px-5 sm:py-5"
            >
              <p className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {s.value}
              </p>
              <p className="mt-1 text-xs text-ink-muted sm:text-sm">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Vision glass */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.7, ease }}
        className="relative z-10 mx-auto mt-16 w-full max-w-6xl sm:mt-20"
      >
        <div className="glass scanline relative overflow-hidden rounded-2xl px-6 py-7 sm:px-10 sm:py-9">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-violet/10 blur-3xl" />
          <div className="pointer-events-none absolute right-1/4 -bottom-16 h-40 w-40 rounded-full bg-amber/8 blur-3xl" />
          <p className="section-label mb-3">Mission lock</p>
          <p className="max-w-3xl font-display text-2xl leading-snug font-medium tracking-tight text-ink sm:text-3xl">
            {brand.hero}
          </p>
          <p className="mt-4 max-w-2xl text-sm text-ink-dim sm:text-base">
            {brand.slogan}
          </p>
        </div>
      </motion.div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
