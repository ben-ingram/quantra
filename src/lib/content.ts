export const brand = {
  name: "Quantra",
  legal: "Quantra Technology & Innovation",
  domain: "quantratech.io",
  url: "https://quantratech.io",
  tagline: "Intelligence for the construction cycle.",
  slogan: "See the job before it starts. Protect it while it runs. Close it clean.",
  hero: "Software for every phase of the construction cycle—from first signal to final signature.",
  description:
    "Quantra builds the operating layer for construction: win the work, protect the right to get paid, and close the project file without the chase.",
  ambitious:
    "Quantra is an applied intelligence company for construction. We turn fragmented public records, statutes, and project paperwork into systems that move real jobs forward.",
  email: "hello@quantratech.io",
};

/** The construction cycle — primary narrative spine */
export const cycle = [
  {
    id: "win",
    phase: "01",
    label: "Win the work",
    short: "Win",
    productId: "parcovi",
    headline: "See demand before the market does.",
    body: "Public records become exclusive territories, early owner signals, and action systems—so the right operator shows up first.",
  },
  {
    id: "protect",
    phase: "02",
    label: "Protect the right",
    short: "Protect",
    productId: "certovi",
    headline: "Never lose a lien right to a missed notice.",
    body: "Statute-aware deadlines, certified mail, and sealed proof—so busy jobs do not quietly expire your ability to get paid.",
  },
  {
    id: "close",
    phase: "03",
    label: "Close the file",
    short: "Close",
    productId: "acuria",
    headline: "Collect every document without chasing all day.",
    body: "W-9s, COIs, releases, warranties, and closeout packages flow into one append-only project timeline until the file is complete.",
  },
] as const;

export const methodology = [
  { id: "signal", label: "Fragmented data", short: "Signal" },
  { id: "intel", label: "Intelligence", short: "Intel" },
  { id: "decision", label: "Decision", short: "Decision" },
  { id: "workflow", label: "Workflow", short: "Workflow" },
  { id: "product", label: "Product", short: "Product" },
  { id: "outcome", label: "Outcome", short: "Outcome" },
] as const;

export const assumedQuestions = [
  "Which properties just changed hands in a way that predicts contractor demand?",
  "What notice is due—and by when—before lien rights are lost?",
  "Where is the COI, the release, the warranty package for this project?",
  "Who owns this territory, and who is already working the block?",
  "Can I prove what was mailed, delivered, and timely if anyone challenges it?",
];

export type ProductAccent = "cyan" | "violet" | "amber";

export type Product = {
  id: string;
  name: string;
  category: string;
  phase: string;
  blurb: string;
  long: string;
  signal: string;
  accent: ProductAccent;
  href?: string;
  features: string[];
  outcomes: string[];
};

export const products: Product[] = [
  {
    id: "parcovi",
    name: "Parcovi",
    category: "Territory intelligence",
    phase: "Win the work",
    blurb:
      "Luxury construction and home-service intelligence. Early ownership signals, exclusive territories, and action systems that put the right operator first.",
    long: "Parcovi turns deeds, notices of commencement, property context, and spatial demand into exclusive lanes and high-intent leads. Built for high-end contractors, remodelers, and home-service operators who win by arriving first—not by buying the same list everyone else already called.",
    signal: "Public records → demand → territory",
    accent: "cyan",
    href: "https://parcovi.com",
    features: [
      "Early owner & deed signals",
      "Exclusive ZIP / trade territories",
      "Cascade & neighbor workflows",
      "SmartMailer outreach with proof",
    ],
    outcomes: [
      "Own the grid before competitors",
      "Reach new owners first",
      "Turn signals into booked work",
    ],
  },
  {
    id: "certovi",
    name: "Certovi",
    category: "Construction notices",
    phase: "Protect the right",
    blurb:
      "Statute-aware construction notices, certified delivery, and hash-chained proof. When written notice is required—or rights are lost—Certovi is the rail.",
    long: "Certovi computes Florida construction notice deadlines from first furnishing, prepares the letter, sends USPS Certified Mail® with return receipt, and keeps a court-ready proof packet. Self-help software for contractors, subs, and suppliers—not a law firm, but a system that never forgets the clock.",
    signal: "Rules → deadlines → sealed proof",
    accent: "violet",
    features: [
      "Notice to Owner deadlines",
      "Certified mail dispatch",
      "Delivery & timeliness tracking",
      "Exportable proof packets",
    ],
    outcomes: [
      "Protect lien rights on time",
      "Mail what you approved",
      "Pull proof when challenged",
    ],
  },
  {
    id: "acuria",
    name: "Acuria",
    category: "Document completion",
    phase: "Close the file",
    blurb:
      "Bounded document requests become durable completion loops—evidence, follow-up, escalation, and an append-only timeline until the project file is closed.",
    long: "Acuria collects, checks, and tracks W-9s, COIs, licenses, payment releases, warranties, O&M manuals, as-builts, and closeout packages from subcontractors and vendors. AI organizes each item; your team accepts or corrects; email and mail escalation keep the package moving without heroics.",
    signal: "Request → evidence → done",
    accent: "amber",
    features: [
      "Project document checklists",
      "AI-assisted review flags",
      "Email + mail escalation",
      "Append-only project timeline",
    ],
    outcomes: [
      "Stop chasing subs all day",
      "Closeout packages that complete",
      "One source of truth per job",
    ],
  },
];

/** @deprecated use products — kept as alias for gradual migration */
export const companies = products;

/** Primary site navigation (works from any page). */
export const nav = [
  { href: "/#cycle", label: "Cycle" },
  { href: "/#products", label: "Products" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/#contact", label: "Contact" },
] as const;

export const stats = [
  { value: "3", label: "Flagship systems" },
  { value: "1", label: "Construction cycle" },
  { value: "∞", label: "Jobs that need rails" },
  { value: "0", label: "Generic dashboards" },
] as const;

export const differentiators = [
  {
    title: "Built for operators",
    body: "Contractors, GCs, subs, and suppliers who cannot wait for perfect centralization. The clock is already running.",
  },
  {
    title: "Evidence over narrative",
    body: "Deeds, statutes, mail events, and document timestamps—not slideware. Structure and cadence beat labels.",
  },
  {
    title: "Action is the product",
    body: "Territories claimed. Notices mailed. Packages closed. Intelligence only counts when something moves in the real world.",
  },
  {
    title: "One spine, three systems",
    body: "Win → protect → close. Shared methodology across the portfolio so each product compounds the others.",
  },
] as const;

export const about = {
  mission:
    "We close the gaps between what construction assumes software can do and what it actually does—then we build the missing rails.",
  principles: [
    {
      title: "Evidence over narrative",
      body: "A signal is only live when detectors fire on real records. Labels lie; structure and cadence tell the truth. When a heuristic and the evidence disagree, the evidence wins.",
    },
    {
      title: "Rules that run",
      body: "Statutes, contracts, and project checklists are not blog posts—they are executable constraints. We encode them as versioned logic with deadlines, methods, and proof.",
    },
    {
      title: "Action is the product",
      body: "Dashboards without workflows are expensive wallpaper. Intelligence must terminate in mail, territories, obligations, or closed project files—something a human can do next.",
    },
    {
      title: "One cycle, many systems",
      body: "Win the work. Protect the right. Close the file. Different products. Same construction spine. We do not invent a new philosophy for every vertical.",
    },
  ],
  story: [
    "Construction generates more public data, more statutory clocks, and more project paperwork than any previous era—and still fails basic questions. Which properties just flipped in a way that predicts remodel demand? What notice is due before rights expire? Where is the COI that was “emailed last week”?",
    "Those failures are not primarily a “big data” problem. They are a missing-rail problem: no system owns the path from raw signal to reliable action across the full construction cycle. Spreadsheets, county portals, certified mail stubs, and inbox threads sit adjacent but never compose.",
    "Quantra exists to compose them. We are an applied intelligence company for construction: we discover what others overlook and turn it into systems—Parcovi, Certovi, Acuria—that did not exist as a unified cycle before.",
    "We build for operators who cannot wait for perfect centralization—GCs, specialty trades, suppliers, and home-service companies who need the right next step when the job, the clock, and the file are already live.",
  ],
  howWeBuild: [
    {
      title: "Ingest reality",
      body: "County deeds, notices of commencement, statutes, project packages, and messy tables—ingested as they exist, not as a data vendor wishes they did.",
    },
    {
      title: "Compile intelligence",
      body: "Entity resolution, rules engines, deadline math, territory ranking, and document checklists—so judgment is measured from evidence, not guessed from labels.",
    },
    {
      title: "Ship systems",
      body: "Products with rails: exclusive territories, proof ledgers, completion loops. Not demos. Not slideware. Software the field can run.",
    },
  ],
};
