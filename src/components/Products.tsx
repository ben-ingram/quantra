"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { products, type ProductAccent } from "@/lib/content";

const ease = [0.22, 1, 0.36, 1] as const;

const accentMap: Record<
  ProductAccent,
  {
    ring: string;
    glow: string;
    chip: string;
    bar: string;
    check: string;
  }
> = {
  cyan: {
    ring: "group-hover:border-cyan/35",
    glow: "from-cyan/20",
    chip: "text-cyan border-cyan/25 bg-cyan/5",
    bar: "accent-cyan-bar",
    check: "text-cyan",
  },
  violet: {
    ring: "group-hover:border-violet/35",
    glow: "from-violet/20",
    chip: "text-violet-soft border-violet/25 bg-violet/5",
    bar: "accent-violet-bar",
    check: "text-violet-soft",
  },
  amber: {
    ring: "group-hover:border-amber/35",
    glow: "from-amber/15",
    chip: "text-amber border-amber/25 bg-amber/5",
    bar: "accent-amber-bar",
    check: "text-amber",
  },
};

export function Products() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  return (
    <section
      id="products"
      ref={ref}
      className="relative px-5 py-28 sm:px-8 sm:py-36"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}
          className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"
        >
          <div>
            <p className="section-label">Flagship products</p>
            <h2 className="mt-4 max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Parcovi. Certovi. Acuria.
            </h2>
          </div>
          <p className="max-w-sm text-ink-muted">
            Three products. One construction cycle. Each turns a failure mode
            operators already know into a system they can run.
          </p>
        </motion.div>

        <div className="mt-14 space-y-5">
          {products.map((p, i) => {
            const a = accentMap[p.accent];
            return (
              <motion.article
                key={p.id}
                id={p.id}
                initial={{ opacity: 0, y: 28 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.65, delay: 0.1 * i, ease }}
                className={`group glass relative scroll-mt-28 overflow-hidden rounded-[1.75rem] p-7 transition-colors sm:p-9 ${a.ring}`}
              >
                <div
                  className={`pointer-events-none absolute -top-28 -right-16 h-56 w-56 rounded-full bg-gradient-to-br ${a.glow} to-transparent opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100`}
                />
                <div className={`absolute top-0 left-0 h-px w-full ${a.bar} opacity-50`} />

                <div className="relative grid gap-8 lg:grid-cols-12 lg:gap-10">
                  <div className="lg:col-span-7">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[0.65rem] tracking-wider uppercase ${a.chip}`}
                      >
                        {p.phase}
                      </span>
                      <span className="font-mono text-[0.65rem] tracking-wider text-ink-dim uppercase">
                        {p.category}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                      {p.name}
                    </h3>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
                      {p.long}
                    </p>
                    <p className="mt-5 font-mono text-xs tracking-[0.12em] text-ink-dim">
                      {p.signal}
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                      <Link
                        href={`/products/${p.id}`}
                        className="btn-primary !px-5 !py-2.5 !text-sm"
                      >
                        Product details
                      </Link>
                      {p.href && (
                        <a
                          href={p.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost !px-5 !py-2.5 !text-sm"
                        >
                          Visit site
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                      <p className="font-mono text-[0.65rem] tracking-[0.18em] text-ink-dim uppercase">
                        Capabilities
                      </p>
                      <ul className="mt-3 space-y-2.5">
                        {p.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-start gap-2.5 text-sm text-ink-muted"
                          >
                            <CheckIcon className={a.check} />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                      <p className="font-mono text-[0.65rem] tracking-[0.18em] text-ink-dim uppercase">
                        Outcomes
                      </p>
                      <ul className="mt-3 space-y-2.5">
                        {p.outcomes.map((o) => (
                          <li
                            key={o}
                            className="flex items-start gap-2.5 text-sm text-ink-muted"
                          >
                            <CheckIcon className={a.check} />
                            <span>{o}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`mt-0.5 h-4 w-4 shrink-0 ${className}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
