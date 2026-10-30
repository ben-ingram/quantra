"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cycle, products } from "@/lib/content";

const ease = [0.22, 1, 0.36, 1] as const;

const phaseAccent = {
  win: {
    glow: "from-cyan/25",
    ring: "border-cyan/30",
    chip: "text-cyan border-cyan/25 bg-cyan/5",
    node: "bg-cyan shadow-[0_0_20px_rgba(34,211,238,0.45)]",
  },
  protect: {
    glow: "from-violet/25",
    ring: "border-violet/30",
    chip: "text-violet-soft border-violet/25 bg-violet/5",
    node: "bg-violet shadow-[0_0_20px_rgba(139,92,246,0.45)]",
  },
  close: {
    glow: "from-amber/20",
    ring: "border-amber/30",
    chip: "text-amber border-amber/25 bg-amber/5",
    node: "bg-amber shadow-[0_0_20px_rgba(251,191,36,0.4)]",
  },
} as const;

export function ConstructionCycle() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section
      id="cycle"
      ref={ref}
      className="relative px-5 py-28 sm:px-8 sm:py-36"
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}
          className="max-w-2xl"
        >
          <p className="section-label">The construction cycle</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            One orbit.{" "}
            <span className="text-gradient-cycle">Three critical rails.</span>
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Jobs are won, rights are protected, and files are closed—or they
            aren&apos;t. Quantra builds the systems that make each phase
            reliable.
          </p>
        </motion.div>

        {/* Desktop flow beam */}
        <div className="relative mt-16 hidden lg:block">
          <div className="absolute top-[3.25rem] right-16 left-16 h-[2px] overflow-hidden rounded-full bg-white/5">
            <div className="cycle-beam h-full w-full" />
          </div>
          <ol className="relative grid grid-cols-3 gap-6">
            {cycle.map((step, i) => {
              const product = products.find((p) => p.id === step.productId);
              const a = phaseAccent[step.id as keyof typeof phaseAccent];
              return (
                <motion.li
                  key={step.id}
                  initial={{ opacity: 0, y: 28 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.65, delay: 0.12 * i, ease }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="relative mb-8 flex h-16 w-16 items-center justify-center">
                    <span
                      className={`absolute inset-0 rounded-full border ${a.ring}`}
                      style={{
                        animation: inView
                          ? `pulse-ring 2.8s ease-out ${i * 0.35}s infinite`
                          : undefined,
                      }}
                    />
                    <span
                      className={`relative h-3.5 w-3.5 rounded-full ${a.node}`}
                    />
                  </div>
                  <a
                    href={`#${step.productId}`}
                    className="group glass relative w-full overflow-hidden rounded-3xl p-7 text-left transition-colors hover:border-white/15"
                  >
                    <div
                      className={`pointer-events-none absolute -top-20 -right-12 h-40 w-40 rounded-full bg-gradient-to-br ${a.glow} to-transparent opacity-70 blur-3xl`}
                    />
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] tracking-wider uppercase ${a.chip}`}
                    >
                      Phase {step.phase}
                    </span>
                    <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-ink group-hover:text-cyan-soft">
                      {step.label}
                    </h3>
                    <p className="mt-2 text-sm font-medium text-ink/90">
                      {step.headline}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                      {step.body}
                    </p>
                    {product && (
                      <p className="mt-5 font-mono text-xs tracking-[0.14em] text-ink-dim uppercase">
                        {product.name} · {product.category}
                      </p>
                    )}
                  </a>
                </motion.li>
              );
            })}
          </ol>
        </div>

        {/* Mobile stack */}
        <ol className="mt-12 space-y-4 lg:hidden">
          {cycle.map((step, i) => {
            const product = products.find((p) => p.id === step.productId);
            const a = phaseAccent[step.id as keyof typeof phaseAccent];
            return (
              <motion.li
                key={step.id}
                initial={{ opacity: 0, x: -14 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.55, delay: 0.08 * i, ease }}
              >
                <a
                  href={`#${step.productId}`}
                  className="glass relative block overflow-hidden rounded-3xl p-6"
                >
                  <div
                    className={`pointer-events-none absolute -top-16 -right-10 h-36 w-36 rounded-full bg-gradient-to-br ${a.glow} to-transparent blur-3xl`}
                  />
                  <div className="relative flex items-start gap-4">
                    <span
                      className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${a.chip}`}
                    >
                      {step.phase}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">
                        {step.label}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-ink/90">
                        {step.headline}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                        {step.body}
                      </p>
                      {product && (
                        <p className="mt-4 font-mono text-[0.65rem] tracking-wider text-ink-dim uppercase">
                          {product.name}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
                {i < cycle.length - 1 && (
                  <div className="flex justify-center py-2">
                    <span className="text-ink-dim">↓</span>
                  </div>
                )}
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
