"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  assumedQuestions,
  brand,
  differentiators,
  methodology,
} from "@/lib/content";

const ease = [0.22, 1, 0.36, 1] as const;

export function Platform() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section
      id="platform"
      ref={ref}
      className="relative px-5 py-28 sm:px-8 sm:py-36"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-14 lg:grid-cols-2 lg:gap-16">
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
              They can&apos;t—not reliably, not across counties, not when the
              truth is scattered across portals, PDFs, and inboxes.{" "}
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
                transition={{ duration: 0.55, delay: 0.07 * i, ease }}
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

        {/* Methodology spine */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.35, ease }}
          className="mt-20"
        >
          <p className="section-label">Shared methodology</p>
          <h3 className="mt-4 max-w-xl font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            From signal to system—across every product.
          </h3>

          <div className="mt-10 hidden lg:block">
            <div className="relative">
              <div className="absolute top-[2.15rem] right-8 left-8 h-px bg-gradient-to-r from-cyan/0 via-cyan/40 to-amber/30" />
              <ol className="relative grid grid-cols-6 gap-3">
                {methodology.map((step, i) => (
                  <li
                    key={step.id}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="relative mb-5 flex h-[4.3rem] w-[4.3rem] items-center justify-center">
                      <span
                        className="absolute inset-0 rounded-full border border-cyan/20"
                        style={{
                          animation: inView
                            ? `pulse-ring 2.8s ease-out ${i * 0.25}s infinite`
                            : undefined,
                        }}
                      />
                      <span className="pipeline-glow flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-void-elevated font-mono text-sm text-cyan-soft">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <span className="font-display text-sm font-semibold tracking-wide text-ink">
                      {step.label}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <ol className="mt-8 space-y-3 lg:hidden">
            {methodology.map((step, i) => (
              <li
                key={step.id}
                className="glass flex items-center gap-4 rounded-2xl px-4 py-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/25 bg-cyan/5 font-mono text-xs text-cyan-soft">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-display font-semibold text-ink">{step.label}</p>
              </li>
            ))}
          </ol>
        </motion.div>

        {/* Differentiators */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {differentiators.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.4 + 0.06 * i, ease }}
              className="glass rounded-2xl p-6 transition-colors hover:border-cyan/25"
            >
              <h3 className="font-display text-lg font-semibold text-ink">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {card.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
