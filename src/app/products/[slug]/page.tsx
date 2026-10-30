import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { brand, products } from "@/lib/content";

const accentStyles = {
  cyan: {
    chip: "text-cyan border-cyan/25 bg-cyan/5",
    bar: "from-cyan to-violet",
    glow: "bg-cyan/15",
    check: "text-cyan",
  },
  violet: {
    chip: "text-violet-soft border-violet/25 bg-violet/5",
    bar: "from-violet to-cyan",
    glow: "bg-violet/15",
    check: "text-violet-soft",
  },
  amber: {
    chip: "text-amber border-amber/25 bg-amber/5",
    bar: "from-amber to-violet",
    glow: "bg-amber/12",
    check: "text-amber",
  },
} as const;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return products.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = products.find((p) => p.id === slug);
  if (!product) return { title: "Product" };
  return {
    title: product.name,
    description: product.blurb,
    openGraph: {
      title: `${product.name} · Quantra`,
      description: product.blurb,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = products.find((p) => p.id === slug);
  if (!product) notFound();

  const a = accentStyles[product.accent];
  const others = products.filter((p) => p.id !== product.id);

  return (
    <SiteShell>
      <article className="relative px-5 pt-32 pb-20 sm:px-8 sm:pt-40 sm:pb-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[50vh] bg-mesh opacity-90" />
        <div className="pointer-events-none absolute inset-0 grid-overlay" />

        <div className="relative z-10 mx-auto max-w-6xl">
          <Link
            href="/#products"
            className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.16em] text-ink-dim uppercase transition-colors hover:text-cyan"
          >
            ← All products
          </Link>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 font-mono text-[0.68rem] tracking-wider uppercase ${a.chip}`}
            >
              {product.phase}
            </span>
            <span className="font-mono text-[0.68rem] tracking-wider text-ink-dim uppercase">
              {product.category}
            </span>
          </div>

          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            {product.name}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted sm:text-xl">
            {product.long}
          </p>
          <p className="mt-4 font-mono text-sm tracking-[0.12em] text-ink-dim">
            {product.signal}
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            {product.href && (
              <a
                href={product.href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Visit {product.name}
              </a>
            )}
            <a href={`mailto:${brand.email}?subject=${product.name}`} className="btn-ghost">
              Talk to Quantra
            </a>
          </div>
        </div>
      </article>

      <section className="relative px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
          <div className="glass relative overflow-hidden rounded-3xl p-8">
            <div
              className={`pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full ${a.glow} blur-3xl`}
            />
            <div
              className={`absolute top-0 left-0 h-px w-full bg-gradient-to-r ${a.bar} opacity-50`}
            />
            <p className="section-label">Capabilities</p>
            <ul className="mt-6 space-y-3">
              {product.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-ink-muted">
                  <span className={`mt-1 ${a.check}`}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass relative overflow-hidden rounded-3xl p-8">
            <div
              className={`pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full ${a.glow} blur-3xl`}
            />
            <div
              className={`absolute top-0 left-0 h-px w-full bg-gradient-to-r ${a.bar} opacity-50`}
            />
            <p className="section-label">Outcomes</p>
            <ul className="mt-6 space-y-3">
              {product.outcomes.map((o) => (
                <li key={o} className="flex items-start gap-3 text-ink-muted">
                  <span className={`mt-1 ${a.check}`}>✓</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="relative px-5 pb-28 sm:px-8 sm:pb-36">
        <div className="mx-auto max-w-6xl">
          <p className="section-label">Also in the cycle</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {others.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="glass group rounded-2xl p-6 transition-colors hover:border-white/15"
              >
                <p className="font-mono text-[0.65rem] tracking-wider text-ink-dim uppercase">
                  {p.phase}
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold text-ink group-hover:text-cyan-soft">
                  {p.name}
                </h2>
                <p className="mt-2 text-sm text-ink-muted">{p.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
