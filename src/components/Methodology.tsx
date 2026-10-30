"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { methodology } from "@/lib/content";

const ease = [0.22, 1, 0.36, 1] as const;

export function Methodology() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section
      id="method"
      ref={ref}
      className="relative px-5 py-28 sm:px-8 sm:py-36"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}
        >
          <p className="section-label">Methodology</p>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            From signal to system.
          </h2>
          <p className="mt-5 max-w-xl text-lg text-ink-muted">
            A single pipeline that holds across the entire portfolio—how raw
            fragments become products that move the real world.
          </p>
        </motion.div>

        {/* Desktop pipeline */}
        <div className="mt-16 hidden lg:block">
          <div className="relative">
            <div className="absolute top-[2.15rem] right-8 left-8 h-px bg-gradient-to-r from-cyan/0 via-cyan/40 to-violet/0" />
            <ol className="relative grid grid-cols-6 gap-3">
              {methodology.map((step, i) => (
                <motion.li
                  key={step.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.55, delay: 0.08 * i, ease }}
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
                  {i < methodology.length - 1 && (
                    <span className="mt-3 font-mono text-[0.65rem] tracking-widest text-ink-dim">
                      →
                    </span>
                  )}
                </motion.li>
              ))}
            </ol>
          </div>
        </div>

        {/* Mobile / tablet stack */}
        <ol className="mt-12 space-y-3 lg:hidden">
          {methodology.map((step, i) => (
            <motion.li
              key={step.id}
              initial={{ opacity: 0, x: -12 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.06 * i, ease }}
              className="glass flex items-center gap-4 rounded-2xl px-4 py-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan/25 bg-cyan/5 font-mono text-xs text-cyan-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-display font-semibold text-ink">
                  {step.label}
                </p>
                <p className="font-mono text-[0.65rem] tracking-widest text-ink-dim uppercase">
                  Stage {i + 1}
                </p>
              </div>
              {i < methodology.length - 1 && (
                <span className="ml-auto text-ink-dim">↓</span>
              )}
            </motion.li>
          ))}
        </ol>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.45, ease }}
          className="mt-16 grid gap-4 sm:grid-cols-3"
        >
          {[
            {
              title: "Technical, not cold",
              body: "Precision without jargon theater. Systems that practitioners actually run.",
            },
            {
              title: "Portfolio-wide",
              body: "One methodology. Many products. Notice, assistance, territory, completion.",
            },
            {
              title: "Outcome-bound",
              body: "Intelligence only counts when it becomes workflow, product, and real-world action.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="glass rounded-2xl p-6 transition-colors hover:border-cyan/25"
            >
              <h3 className="font-display text-lg font-semibold text-ink">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {card.body}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
