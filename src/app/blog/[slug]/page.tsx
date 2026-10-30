import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostBody } from "@/components/blog/PostBody";
import { PostCard } from "@/components/blog/PostCard";
import { SiteShell } from "@/components/SiteShell";
import {
  formatPostDate,
  getAllPosts,
  getPost,
  getRelatedPosts,
} from "@/lib/blog";
import { brand } from "@/lib/content";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Not found" };

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      tags: post.tags,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = getRelatedPosts(slug, 2);

  return (
    <SiteShell>
      <article className="relative px-5 pt-32 pb-20 sm:px-8 sm:pt-40">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-mesh opacity-80" />

        <div className="relative z-10 mx-auto max-w-3xl">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.16em] text-ink-dim uppercase transition-colors hover:text-cyan"
          >
            ← Blog
          </Link>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-violet/25 bg-violet/5 px-2.5 py-0.5 font-mono text-[0.65rem] tracking-wider text-violet-soft uppercase">
              {post.category}
            </span>
            <span className="font-mono text-[0.65rem] tracking-wider text-ink-dim">
              {formatPostDate(post.date)} · {post.readingMinutes} min read
            </span>
          </div>

          <h1 className="mt-6 font-display text-[2.1rem] leading-[1.12] font-semibold tracking-tight text-ink sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-muted sm:text-xl">
            {post.excerpt}
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 px-3 py-1 font-mono text-[0.65rem] tracking-wide text-ink-dim"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="my-12 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <PostBody body={post.body} />

          <div className="mt-16 glass rounded-3xl p-7 sm:p-8">
            <p className="font-display text-lg font-semibold text-ink">
              {brand.name}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {brand.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/about" className="btn-primary !py-2.5 !text-sm">
                About Quantra
              </Link>
              <Link href="/#contact" className="btn-ghost !py-2.5 !text-sm">
                Get in touch
              </Link>
            </div>
            <p className="mt-8 font-mono text-[0.65rem] tracking-[0.22em] text-ink-dim uppercase">
              {brand.tagline}
            </p>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="relative z-10 px-5 pb-28 sm:px-8 sm:pb-36">
          <div className="mx-auto max-w-6xl">
            <p className="section-label">Continue reading</p>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Related essays
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </SiteShell>
  );
}
