"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { assumedQuestions, brand } from "@/lib/content";

const ease = [0.22, 1, 0.36, 1] as const;

export function Layer() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });

  return (
    <section
      id="layer"
      ref={ref}
      className="relative px-5 py-28 sm:px-8 sm:py-36"
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.75, ease }}
          >
            <p className="section-label">The missing layer</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              People assume modern systems can already answer these.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-ink-muted">
              They can&apos;t—not reliably, not across jurisdictions, not when
              the truth is scattered.{" "}
              <span className="text-ink">Quantra builds the missing layer.</span>
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-dim">
              {brand.ambitious}
            </p>
          </motion.div>

          <ul className="space-y-3">
            {assumedQuestions.map((q, i) => (
              <motion.li
                key={q}
                initial={{ opacity: 0, x: 20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.55, delay: 0.08 * i, ease }}
                className="group glass flex gap-4 rounded-2xl p-5 transition-all hover:border-violet/30 hover:bg-white/[0.04]"
              >
                <span className="mt-0.5 font-mono text-xs text-violet-soft">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[1.05rem] leading-snug text-ink/95 group-hover:text-ink">
                  {q}
                </p>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
