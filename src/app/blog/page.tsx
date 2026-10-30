import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/blog/PostCard";
import { SiteShell } from "@/components/SiteShell";
import { getAllPosts, getFeaturedPosts } from "@/lib/blog";
import { brand } from "@/lib/content";

export const metadata: Metadata = {
  title: "Blog",
  description: `Essays on applied intelligence, missing systems, and building from signal to system. ${brand.slogan}`,
  openGraph: {
    title: "Quantra Blog — From signal to system.",
    description:
      "Substantive writing on notice systems, assistance timing, public-record intelligence, and how we build.",
  },
};

export default function BlogIndexPage() {
  const all = getAllPosts();
  const featured = getFeaturedPosts();
  const hero = featured[0] ?? all[0];
  const grid = all.filter((p) => p.slug !== hero?.slug);

  return (
    <SiteShell>
      <section className="relative px-5 pt-32 pb-16 sm:px-8 sm:pt-40 sm:pb-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[45vh] bg-mesh opacity-90" />
        <div className="pointer-events-none absolute inset-0 grid-overlay" />

        <div className="relative z-10 mx-auto max-w-6xl">
          <p className="section-label">Field notes</p>
          <h1 className="mt-5 max-w-3xl font-display text-[2.4rem] leading-[1.08] font-semibold tracking-tight sm:text-6xl">
            <span className="text-gradient">Ideas we build with.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
            Long-form essays on the missing layer between data and action—how
            we think about notices, assistance timing, public records,
            completion, and applied intelligence.
          </p>
          <p className="mt-4 font-mono text-xs tracking-[0.22em] text-ink-dim uppercase">
            {all.length} essays · {brand.tagline}
          </p>
        </div>
      </section>

      <section className="relative z-10 px-5 pb-28 sm:px-8 sm:pb-36">
        <div className="mx-auto max-w-6xl">
          {hero && (
            <div className="mb-6">
              <PostCard post={hero} featured />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {grid.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>

          <div className="mt-16 glass flex flex-col items-start justify-between gap-6 rounded-3xl p-8 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-xl font-semibold text-ink">
                Want the full story?
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                Read how Quantra works—and what we build across the portfolio.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/about" className="btn-primary !py-2.5 !text-sm">
                About Quantra
              </Link>
              <Link href="/#companies" className="btn-ghost !py-2.5 !text-sm">
                Companies
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
