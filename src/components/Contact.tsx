"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { brand } from "@/lib/content";

const ease = [0.22, 1, 0.36, 1] as const;

export function Contact() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section
      id="contact"
      ref={ref}
      className="relative px-5 py-28 sm:px-8 sm:py-36"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease }}
          className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.06] via-void-elevated to-void px-7 py-14 sm:px-14 sm:py-20"
        >
          <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-cyan/15 blur-[100px]" />
          <div className="pointer-events-none absolute right-0 -bottom-24 h-64 w-64 rounded-full bg-violet/20 blur-[90px]" />
          <div className="pointer-events-none absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-amber/10 blur-[80px]" />
          <div className="pointer-events-none absolute inset-0 grid-overlay opacity-60" />

          <div className="relative mx-auto max-w-2xl text-center">
            <p className="section-label">Next signal</p>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              <span className="text-gradient">Build what the cycle needs.</span>
            </h2>
            <p className="mt-6 text-lg text-ink-muted">
              Partnerships, domain collaborations, and conversations about
              systems construction already assumes should exist. If the job,
              the clock, or the file is failing—let&apos;s talk.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={`mailto:${brand.email}`}
                className="btn-primary min-w-[220px]"
              >
                {brand.email}
              </a>
              <a href="#products" className="btn-ghost min-w-[220px]">
                View products
              </a>
            </div>
            <p className="mt-12 font-mono text-xs tracking-[0.28em] text-ink-dim uppercase">
              {brand.tagline}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
