"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  about,
  brand,
  cycle,
  methodology,
  products,
} from "@/lib/content";

const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-8% 0px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AboutContent() {
  return (
    <>
      <section className="relative px-5 pt-32 pb-20 sm:px-8 sm:pt-40 sm:pb-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] bg-mesh opacity-90" />
        <div className="pointer-events-none absolute inset-0 grid-overlay" />

        <div className="relative z-10 mx-auto max-w-6xl">
          <Reveal>
            <p className="section-label">About Quantra</p>
            <h1 className="mt-5 max-w-4xl font-display text-[2.4rem] leading-[1.08] font-semibold tracking-tight sm:text-6xl">
              <span className="text-gradient">We build the rails</span>
              <span className="mt-1 block text-ink">
                construction already assumes exist.
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink-muted sm:text-xl">
              {about.mission}
            </p>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-dim">
              {brand.ambitious}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Construction cycle on about */}
      <section className="relative px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="section-label">Our space</p>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              The construction cycle is the product surface.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {cycle.map((step, i) => (
              <Reveal key={step.id} delay={0.06 * i}>
                <div className="glass h-full rounded-3xl p-6">
                  <p className="font-mono text-xs text-cyan">{step.phase}</p>
                  <h3 className="mt-3 font-display text-xl font-semibold text-ink">
                    {step.label}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {step.headline}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-4">
            <p className="section-label">Origin</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Why we exist
            </h2>
          </Reveal>
          <div className="space-y-6 lg:col-span-8">
            {about.story.map((para, i) => (
              <Reveal key={i} delay={0.06 * i}>
                <p className="text-lg leading-relaxed text-ink-muted">{para}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="section-label">Principles</p>
            <h2 className="mt-4 max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              How we decide what ships
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {about.principles.map((p, i) => (
              <Reveal key={p.title} delay={0.05 * i}>
                <article className="glass group h-full rounded-3xl p-7 transition-colors hover:border-cyan/25">
                  <span className="font-mono text-xs text-cyan">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-display text-xl font-semibold text-ink">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
                    {p.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="section-label">Build system</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Ingest. Compile. Ship.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {about.howWeBuild.map((step, i) => (
              <Reveal key={step.title} delay={0.07 * i}>
                <div className="glass relative h-full overflow-hidden rounded-3xl p-7">
                  <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-cyan via-violet to-amber opacity-50" />
                  <p className="font-mono text-xs tracking-widest text-violet-soft">
                    0{i + 1}
                  </p>
                  <h3 className="mt-4 font-display text-xl font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15} className="mt-10">
            <div className="glass scanline rounded-3xl px-6 py-8 sm:px-10">
              <p className="section-label mb-4">Methodology spine</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                {methodology.map((m, i) => (
                  <span key={m.id} className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-display text-sm font-medium text-ink">
                      {m.label}
                    </span>
                    {i < methodology.length - 1 && (
                      <span className="text-ink-dim">→</span>
                    )}
                  </span>
                ))}
              </div>
              <p className="mt-6 max-w-2xl text-sm text-ink-muted">
                One pipeline across Parcovi, Certovi, and Acuria—technical
                without being cold, and always terminating in outcomes operators
                can run.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="section-label">Portfolio</p>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Products we ship
              </h2>
            </div>
            <Link href="/#products" className="btn-ghost !py-2.5 !text-sm">
              View on homepage
            </Link>
          </Reveal>
          <div className="mt-12 space-y-3">
            {products.map((c, i) => (
              <Reveal key={c.id} delay={0.04 * i}>
                <Link
                  href={`/products/${c.id}`}
                  className="glass flex flex-col gap-4 rounded-2xl px-5 py-5 transition-colors hover:border-white/15 sm:flex-row sm:items-center sm:justify-between sm:px-7"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-display text-lg font-semibold text-ink">
                        {c.name}
                      </h3>
                      <span className="font-mono text-[0.65rem] tracking-wider text-ink-dim uppercase">
                        {c.phase} · {c.category}
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm text-ink-muted">
                      {c.blurb}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-[0.7rem] tracking-wide text-ink-dim sm:text-right">
                    {c.signal}
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-5 pt-10 pb-28 sm:px-8 sm:pb-36">
        <Reveal>
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.06] via-void-elevated to-void px-7 py-14 sm:px-14 sm:py-16">
            <div className="pointer-events-none absolute -top-24 left-1/3 h-64 w-64 rounded-full bg-cyan/15 blur-[100px]" />
            <div className="pointer-events-none absolute right-0 -bottom-20 h-56 w-56 rounded-full bg-violet/20 blur-[90px]" />
            <div className="relative max-w-xl">
              <p className="section-label">Work with us</p>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                <span className="text-gradient">See what others miss.</span>
              </h2>
              <p className="mt-4 text-ink-muted">
                Partnerships, domain collaborations, and conversations about
                systems the construction cycle should already have.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={`mailto:${brand.email}`} className="btn-primary">
                  {brand.email}
                </a>
                <Link href="/blog" className="btn-ghost">
                  Read the blog
                </Link>
              </div>
              <p className="mt-10 font-mono text-xs tracking-[0.28em] text-ink-dim uppercase">
                {brand.tagline}
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
