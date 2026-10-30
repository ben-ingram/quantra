# Quantra Technology & Innovation

Corporate site for **Quantra** (`quantratech.io`) — intelligence for the construction cycle.

**See the job before it starts. Protect it while it runs. Close it clean.**

## Flagship products

| Product | Phase | Focus |
|---------|-------|--------|
| **Parcovi** | Win the work | Territory & early-owner intelligence |
| **Certovi** | Protect the right | Construction notices, certified mail, proof |
| **Acuria** | Close the file | Document collection & project completion |

## Stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4** custom design tokens
- **Framer Motion** scroll / entrance motion
- Canvas **SignalField** constellation background
- **Syne** + **Geist** typography

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Homepage — hero, construction cycle, products, platform, contact |
| `/about` | Company story, principles, build system, portfolio |
| `/products/[slug]` | Parcovi, Certovi, Acuria detail pages |
| `/blog` | Essay index |
| `/blog/[slug]` | Long-form posts (`src/lib/blog.ts`) |

## Messaging

Source of truth: `src/lib/content.ts`

- Tagline: *Intelligence for the construction cycle.*
- Cycle spine: Win → Protect → Close
- Contact: `hello@quantratech.io`
