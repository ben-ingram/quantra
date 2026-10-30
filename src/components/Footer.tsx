import Link from "next/link";
import { brand, nav, products } from "@/lib/content";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 px-5 pt-16 pb-10 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="font-display text-sm font-semibold tracking-[0.22em] text-ink">
            {brand.name.toUpperCase()}
          </p>
          <p className="mt-2 font-mono text-xs tracking-[0.12em] text-ink-dim">
            {brand.domain}
          </p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink-muted">
            {brand.legal}. Intelligence for every phase of the construction
            cycle—win, protect, close.
          </p>
        </div>

        <div>
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-ink-dim uppercase">
            Navigate
          </p>
          <ul className="mt-4 space-y-2">
            <li>
              <Link
                href="/"
                className="text-sm text-ink-muted transition-colors hover:text-ink"
              >
                Home
              </Link>
            </li>
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-ink-dim uppercase">
            Products
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/products/${p.id}`}
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  {p.name}
                  <span className="ml-2 font-mono text-[0.6rem] tracking-wider text-ink-dim uppercase">
                    {p.phase}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-3 border-t border-white/5 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-dim">
          © {year} {brand.legal}. All rights reserved.
        </p>
        <p className="font-mono text-[0.65rem] tracking-[0.18em] text-ink-dim uppercase">
          {brand.tagline}
        </p>
      </div>
    </footer>
  );
}
