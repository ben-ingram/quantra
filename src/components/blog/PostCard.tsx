import Link from "next/link";
import { formatPostDate, type BlogPost } from "@/lib/blog";

export function PostCard({
  post,
  featured = false,
}: {
  post: BlogPost;
  featured?: boolean;
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group glass relative flex flex-col overflow-hidden rounded-3xl p-6 transition-all hover:border-cyan/30 sm:p-7 ${
        featured ? "md:col-span-2 md:flex-row md:gap-10 md:p-9" : ""
      }`}
    >
      <div className="pointer-events-none absolute -top-20 -right-16 h-40 w-40 rounded-full bg-gradient-to-br from-cyan/15 to-violet/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-cyan/25 bg-cyan/5 px-2.5 py-0.5 font-mono text-[0.65rem] tracking-wider text-cyan uppercase">
            {post.category}
          </span>
          <span className="font-mono text-[0.65rem] tracking-wider text-ink-dim">
            {formatPostDate(post.date)} · {post.readingMinutes} min
          </span>
        </div>
        <h3
          className={`mt-4 font-display font-semibold tracking-tight text-ink transition-colors group-hover:text-cyan-soft ${
            featured ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
          }`}
        >
          {post.title}
        </h3>
        <p
          className={`mt-3 flex-1 leading-relaxed text-ink-muted ${
            featured ? "max-w-2xl text-base sm:text-lg" : "text-sm sm:text-base"
          }`}
        >
          {post.excerpt}
        </p>
        <span className="mt-6 inline-flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-cyan uppercase">
          Read essay
          <span className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
