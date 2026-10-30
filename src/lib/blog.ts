export type ContentBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; title?: string; text: string };

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readingMinutes: number;
  category: string;
  tags: string[];
  featured?: boolean;
  body: ContentBlock[];
};

export const posts: BlogPost[] = [
  {
    slug: "the-missing-layer",
    title: "The Missing Layer Between Data and Action",
    excerpt:
      "Institutions are drowning in public data and still cannot answer basic operational questions. The problem is not volume—it is the missing layer that turns fragments into systems.",
    date: "2026-06-12",
    readingMinutes: 9,
    category: "Thesis",
    tags: ["methodology", "systems", "applied intelligence"],
    featured: true,
    body: [
      {
        type: "p",
        text: "Ask a sophisticated operator a simple question and watch the room go quiet. What notice is legally required before this right expires? What assistance programs opened this week for a household at this address? Which properties changed hands in a way that predicts renovation demand next quarter?",
      },
      {
        type: "p",
        text: "None of these questions are philosophical. They have answers in the world. Statutes exist. Program pages exist. Deeds and notices of commencement are recorded every day. The answers live in fragments—county portals, PDFs, federal feeds, eligibility matrices, tribal knowledge inside a firm—and never quite become a system.",
      },
      {
        type: "quote",
        text: "People naturally assume modern systems should already be able to answer these questions. Quantra builds the missing layer.",
      },
      {
        type: "h2",
        text: "Data abundance is not the same as capability",
      },
      {
        type: "p",
        text: "The last two decades optimized for capture and storage. We got warehouses, lakes, lakehouses, and dashboards that can slice anything that was already cleaned for a prior use case. That stack is excellent at answering questions it was designed for. It is fragile when the question is time-sensitive, jurisdiction-specific, or dependent on rules that change faster than schema reviews.",
      },
      {
        type: "p",
        text: "Operational reality looks different. A Florida Notice to Owner clock is not a BI problem. A housing waitlist that opens at 9:00 a.m. local time and closes when funding is exhausted is not a static directory problem. A luxury remodeler who needs exclusive territory before competitors buy the same deed list is not served by a generic “insights” export.",
      },
      {
        type: "callout",
        title: "The pattern",
        text: "Fragmented sources → partial understanding → human heroics → missed deadlines, missed leads, missed aid. The gap between “we have data” and “we can act” is where institutions quietly fail.",
      },
      {
        type: "h2",
        text: "What the missing layer actually does",
      },
      {
        type: "p",
        text: "The missing layer is not another chatbot on top of a pile of PDFs. It is an applied path that preserves structure end to end:",
      },
      {
        type: "ol",
        items: [
          "Ingest signals as the world publishes them—messy, partial, multi-format.",
          "Compile intelligence: entities, rules, timing, confidence, ranking measured from evidence.",
          "Surface decisions a human or automated policy can accept or reject.",
          "Bind decisions to workflows: mail, alerts, obligations, territory claims, completion loops.",
          "Ship products that operators live in, not decks that describe what operators should do.",
          "Measure outcomes so the system compounds instead of performing once.",
        ],
      },
      {
        type: "p",
        text: "That sequence is our methodology in one line: fragmented data → intelligence → decision → workflow → product → outcome. We call the signature shorter still: from signal to system.",
      },
      {
        type: "h2",
        text: "Why “AI features” keep missing",
      },
      {
        type: "p",
        text: "Generative models are extraordinary at language and pattern completion. They are not substitutes for statute math, delivery proof, or exclusive inventory. When companies paste an LLM onto a domain without encoding rules, identity, and action rails, they get fluent answers that cannot be trusted under audit—and operators learn not to trust the product.",
      },
      {
        type: "p",
        text: "Applied intelligence at Quantra means models and heuristics are subordinate to evidence. A field is a key when it behaves like a key in the data, not when a column is named id. A source’s cadence is what the publisher declares and what the records show. A signal is live when a detector fires on real records. When a heuristic and the evidence disagree, the evidence wins—and the heuristic gets fixed.",
      },
      {
        type: "h2",
        text: "Building what should already exist",
      },
      {
        type: "p",
        text: "Our portfolio is not a random set of apps. Each company is a concrete answer to a question the future assumes is already solved. NoticeRail encodes notice rules, deadlines, certified delivery, and proof. Assistance Intelligence turns the social safety net into a timing-aware event stream. Parcovi turns public property signals into territory and action for trades. Acuria closes the loop on bounded requests with evidence and escalation. Vertical Intelligence compiles ranked opportunity libraries from messy public data.",
      },
      {
        type: "p",
        text: "Different markets. Same missing layer. See what others miss. Build what should exist.",
      },
    ],
  },
  {
    slug: "from-signal-to-system",
    title: "From Signal to System: How We Build",
    excerpt:
      "A practical walkthrough of Quantra’s methodology—what each stage means in production, what we refuse to skip, and why workflow is not an afterthought.",
    date: "2026-06-18",
    readingMinutes: 11,
    category: "Methodology",
    tags: ["methodology", "product", "engineering"],
    featured: true,
    body: [
      {
        type: "p",
        text: "Slogans collapse under contact with shipping code. “From signal to system” only matters if every stage has a definition, an owner, and a failure mode you can observe. This is how we operationalize the pipeline across the Quantra portfolio.",
      },
      {
        type: "h2",
        text: "1. Fragmented data (signal)",
      },
      {
        type: "p",
        text: "We start where the world actually publishes: county recorder exports, program homepages, Federal Register notices, statutes, Sunbiz filings, shapefiles, deed batches, LLM-extracted deltas from crawl hashes. The point is not to wait for a clean vendor API. The point is to respect the native shape of the source long enough to detect what changed.",
      },
      {
        type: "ul",
        items: [
          "Prefer primary sources over secondary scrapes when both exist.",
          "Hash salient content so “no change” is a first-class outcome.",
          "Record provenance: when fetched, from where, under which parser version.",
        ],
      },
      {
        type: "p",
        text: "If you skip provenance, you will eventually ship a confident answer you cannot defend. If you skip change detection, you will reprocess noise forever and still miss the one line that opened a waitlist.",
      },
      {
        type: "h2",
        text: "2. Intelligence",
      },
      {
        type: "p",
        text: "Intelligence is structured judgment measured from evidence. That includes entity resolution (which LLC is the same buyer?), rule evaluation (which statute version applies?), timing models (business-day math, local timezones, expiry), and ranking (which signal is actionable for this persona?).",
      },
      {
        type: "callout",
        title: "Quality bar",
        text: "Palantir-level smart is not a brand claim—it is a refusal to guess from labels. Keys, dates, cadence, and “live” status must be proven from the data itself.",
      },
      {
        type: "p",
        text: "Models help extraction and classification. They do not get to invent a deadline. Deadlines come from pure functions over versioned rules. Confidence scores decide auto-publish versus human review. That separation is non-negotiable in legal and eligibility domains.",
      },
      {
        type: "h2",
        text: "3. Decision",
      },
      {
        type: "p",
        text: "A decision is a discrete commit: open this obligation, claim this territory lane, alert this subscriber, request this evidence packet, rank this opportunity above that one. Decisions need a subject, a policy, and an audit trail. Without those three, “AI recommended” is theater.",
      },
      {
        type: "h2",
        text: "4. Workflow",
      },
      {
        type: "p",
        text: "Workflow is where most intelligence products die. They render a card and hope a human opens twelve other tools. We design for rails: certified mail via Lob, reminder ladders via Resend, cron stages that advance state, append-only event timelines, Stripe-gated inventory, operator review queues.",
      },
      {
        type: "p",
        text: "The workflow must be idempotent where the world is flaky. Webhooks retry. Crons overlap. Users double-click. If your obligation dispatcher cannot tolerate that, you do not have a system—you have a demo that works on good days.",
      },
      {
        type: "h2",
        text: "5. Product",
      },
      {
        type: "p",
        text: "Product is the surface operators trust under pressure. Personas matter: a trade contractor and a home-services route operator are not the same buyer even when they share a deed feed. Status boards for residents are not the same as counsel dashboards for notice proof. We ship distinct products with shared infrastructure, not one portal with twelve half-features.",
      },
      {
        type: "h2",
        text: "6. Outcome",
      },
      {
        type: "p",
        text: "Outcomes are measurable: notice mailed and sealed in a hash chain; subscriber alerted before a window closed; exclusive lane claimed; request closed with complete evidence; vertical signal package refreshed on schedule. If you cannot name the outcome, you are optimizing engagement metrics that do not survive contact with the domain.",
      },
      {
        type: "h3",
        text: "What we refuse to skip",
      },
      {
        type: "ol",
        items: [
          "Versioned rules with counsel-review flags where law is involved.",
          "Human gates for high-stakes auto-actions until confidence is earned.",
          "Proof artifacts that can be regenerated and re-verified later.",
          "Operational runbooks: migrations, crons, failure modes, ownership.",
        ],
      },
      {
        type: "p",
        text: "From signal to system is not a tagline under the logo. It is the acceptance test for everything we ship.",
      },
    ],
  },
  {
    slug: "notice-systems-that-hold-up",
    title: "Why Notice Software Fails—and What Holds Up Under Audit",
    excerpt:
      "Written notice is where rights are won or lost. Most tools treat it as mail merge. Real systems encode statutes, method, deadlines, and proof as first-class objects.",
    date: "2026-06-25",
    readingMinutes: 10,
    category: "NoticeRail",
    tags: ["NoticeRail", "legal ops", "proof"],
    body: [
      {
        type: "p",
        text: "If a statute or contract says written notice, prescribed method, hard deadline—or you lose the right—it does not belong in a shared inbox and a calendar reminder. It belongs on rails.",
      },
      {
        type: "p",
        text: "That is the design thesis behind NoticeRail: a statute-aware deadline engine, certified-mail dispatch, and an append-only hash-chained proof ledger behind one dashboard and one API. The product is not “letters.” The product is obligations that complete with evidence.",
      },
      {
        type: "h2",
        text: "The four failures we keep seeing",
      },
      {
        type: "h3",
        text: "1. Calendar math that ignores the statute",
      },
      {
        type: "p",
        text: "Business-day counting, weekend and holiday rules, “within X days of recording,” claim-of-lien windows, COBRA clocks, WARN floors—these are not interchangeable “due dates.” Generic task apps collapse distinct legal regimes into the same due_at column and call it done. When challenged, nobody can reconstruct which rule version produced the date.",
      },
      {
        type: "h3",
        text: "2. Method is an afterthought",
      },
      {
        type: "p",
        text: "Certified mail, personal delivery, electronic methods where allowed, posting—method is often substantive, not administrative. A system that only tracks “sent” without encoding prescribed method is a liability generator with a friendly UI.",
      },
      {
        type: "h3",
        text: "3. Content drift",
      },
      {
        type: "p",
        text: "If the letter body can be edited freely after deadlines are computed, the content hash of what was mailed diverges from what counsel thought was approved. Deterministic templates and content hashes are not pedantry; they are how you prove sameness later.",
      },
      {
        type: "h3",
        text: "4. No sealed history",
      },
      {
        type: "p",
        text: "Screenshots of a USPS page are not a system of record. Webhooks fire out of order. Operators re-send. Vendors change payload shapes. Without an append-only ledger that seals events and can detect chain breaks, you have stories instead of proof.",
      },
      {
        type: "h2",
        text: "A better object model",
      },
      {
        type: "p",
        text: "Every notice type reduces to a pattern: trigger event → versioned pure rule computes deadlines and recipients → prescribed-method delivery → sealed proof. Rule sets carry a verified flag until counsel review. That keeps product velocity without pretending software is legal advice.",
      },
      {
        type: "ul",
        items: [
          "Construction: Florida Notice to Owner, claim-of-lien windows, multi-state prelim notices on the roadmap.",
          "Property management: security deposit claims, pay-or-quit with business-day math.",
          "HOA/condo: hearing notices, intent-to-lien timelines.",
          "Contracts, receivables, insurance, employment: parameterized clocks where the domain allows.",
        ],
      },
      {
        type: "callout",
        title: "Moat note",
        text: "The long-term advantage is not a prettier letter UI. It is opening obligations before the customer logs in—from county recorder feeds, permits, and operational systems—so the clock starts when the world moves, not when someone remembers to type.",
      },
      {
        type: "h2",
        text: "What “holds up” means",
      },
      {
        type: "p",
        text: "Holding up means a proof packet can be regenerated, the chain re-verified, the template version identified, the delivery method documented, and the deadline computation explained from pure inputs. If your notice stack cannot do that, it may still “send mail.” It will not protect rights when it matters.",
      },
    ],
  },
  {
    slug: "assistance-is-an-event-stream",
    title: "Assistance Is an Event Stream, Not a Directory",
    excerpt:
      "Program pages go stale the moment they are published. The social safety net needs timing intelligence: waitlists, funding windows, and eligibility change as first-class events.",
    date: "2026-07-02",
    readingMinutes: 9,
    category: "Assistance Intelligence",
    tags: ["Assistance Intelligence", "civic tech", "events"],
    body: [
      {
        type: "p",
        text: "Government assistance data—Section 8, LIHEAP, SNAP, TANF, WIC, local aid—lives across thousands of sites with no central event bus. Residents and caseworkers still navigate as if a phone number and a PDF were a system. The result is predictable: people learn about openings after they close, and directories burn staff time answering questions a live status board should answer.",
      },
      {
        type: "quote",
        text: "The product is the event, not the program page.",
      },
      {
        type: "h2",
        text: "Directories answer the wrong question",
      },
      {
        type: "p",
        text: "A directory answers “what programs exist?” That is necessary and insufficient. The operational questions are temporal: What is open now? What is opening soon? What just changed eligibility? What deadline is real versus aspirational copy on a homepage last updated in 2019?",
      },
      {
        type: "p",
        text: "Assistance Intelligence treats those as events: WAITLIST_OPENED, FUNDING_AVAILABLE, ELIGIBILITY_CHANGED, DEADLINE_ANNOUNCED, and related types. Monitoring crawls produce deltas; extraction yields structured candidates; multi-factor confidence decides auto-publish versus review; materialization builds per-program status and cadence (“opened N times · roughly every M months”).",
      },
      {
        type: "h2",
        text: "Timing is a first-class primitive",
      },
      {
        type: "p",
        text: "Events carry time-of-day and per-state timezone semantics. They are expiry-aware so past windows do not alert as if they were still live. Income limits and fair market rents are not static footnotes—they become ELIGIBILITY_CHANGED when the underlying tables move. Federal Register notices become feed items with agency scope, not buried PDFs.",
      },
      {
        type: "callout",
        title: "Scale with discipline",
        text: "National directory coverage and local monitoring are different cost curves. Crawl and LLM budgets demand staged rollout—monitor where you can verify quality, expand when the pipeline earns trust.",
      },
      {
        type: "h2",
        text: "What residents actually need",
      },
      {
        type: "p",
        text: "The public product should feel municipal, not Silicon Valley-cute: location, need, and timing in; open now, opening soon, who to contact, what we are watching out. Alerts should fire when an event matches a subscription—not when a marketer wants engagement.",
      },
      {
        type: "p",
        text: "That is applied intelligence in a civic register: fragmented program web → intelligence about change → decisions to alert or display → workflows of subscription and review → a product people can check under stress → outcomes measured as timely access, not pageviews.",
      },
      {
        type: "h2",
        text: "Why this belongs in the Quantra portfolio",
      },
      {
        type: "p",
        text: "The same missing-layer problem shows up in legal notice, contractor demand, and completion ops. Assistance is simply the domain where the cost of missing a window is borne by people with the least slack. Building the timing layer is not charity branding—it is systems work the future already assumes exists.",
      },
    ],
  },
  {
    slug: "public-records-into-territory",
    title: "Turning Public Records into Territory—Without Becoming a Lead Mill",
    excerpt:
      "Deeds and notices of commencement are raw signal. The product is exclusive action: personas, scarcity, early outreach, and systems competitors cannot casually copy.",
    date: "2026-07-07",
    readingMinutes: 10,
    category: "Parcovi",
    tags: ["Parcovi", "property data", "GTM"],
    body: [
      {
        type: "p",
        text: "South Florida’s luxury trades do not lack data vendors. They lack a system that turns early ownership and construction signals into exclusive territory and a next action before the same list hits everyone else. That distinction is the difference between a lead mill and territory intelligence.",
      },
      {
        type: "h2",
        text: "Raw records are not product",
      },
      {
        type: "p",
        text: "County deed batches, notices of commencement, property characteristics, LLC filings, permit histories—these are inputs. Left alone, they produce CSV fatigue and race-to-the-bottom calling. Productization requires persona-aware scoring, spatial inventory, and workflow rails that make exclusivity meaningful.",
      },
      {
        type: "ul",
        items: [
          "Trade personas care about high-ticket renovation demand and neighbor effects.",
          "Services personas care about recurring routes and ZIP economics.",
          "Interior/condo lanes have different unit economics and acquisition paths.",
        ],
      },
      {
        type: "p",
        text: "If your UI treats those personas as the same table with a filter chip, you will train users to ignore the product.",
      },
      {
        type: "h2",
        text: "Scarcity is a feature when it is real",
      },
      {
        type: "p",
        text: "Exclusive ZIP/lane inventory only works if claim, waitlist, and coverage rules are enforced in the data model—not promised in marketing. Grid search, checkout, and dashboard states must agree: available, scarce, claimed, gated. Free users seeing full competitor-ready lists is not generosity; it is self-sabotage.",
      },
      {
        type: "h2",
        text: "Cascade from signal to action",
      },
      {
        type: "p",
        text: "The valuable systems chain signals into actions: early owner outreach, SmartMailer campaigns with response rails, neighbor/domino effects, deal desk flows, and operational queues that tell a contractor what to do Tuesday morning—not merely what happened last month in a chart.",
      },
      {
        type: "callout",
        title: "Intelligence before opportunity",
        text: "Predicting home-improvement demand before it is obvious is useless without exclusive capacity to act. Ranking without inventory is a tease. Inventory without workflow is a spreadsheet with a logo.",
      },
      {
        type: "h2",
        text: "Ethics and durability",
      },
      {
        type: "p",
        text: "Public records products sit next to privacy, solicitation rules, and reputation risk. Durable companies design for compliant outreach, clear homeowner response paths, and data quality that does not invent facts about people or properties. Lead quality measurement, backtests, and coverage audits are product work—not optional analytics side quests.",
      },
      {
        type: "p",
        text: "Parcovi is Quantra’s proof that public signal can become a market system: fragmented county data → intelligence → claim decisions → mail and queue workflows → a product trades live in → outcomes measured in territory owned and work won.",
      },
    ],
  },
  {
    slug: "completion-loops-and-proof",
    title: "Completion Loops: When “We Asked” Is Not the Same as “It’s Done”",
    excerpt:
      "Organizations lose months in the gap between a request and verified completion. Bounded loops with evidence, review, and escalation turn hope into an operating system.",
    date: "2026-07-11",
    readingMinutes: 8,
    category: "Acuria",
    tags: ["Acuria", "operations", "evidence"],
    body: [
      {
        type: "p",
        text: "Every organization runs on incomplete loops: we asked for the certificate, the form, the photo, the attestation. Email threads sprawl. Attachments vanish. Someone swears it was sent. Nobody can prove the evidence was complete—or when the request should have escalated.",
      },
      {
        type: "p",
        text: "Acuria’s design is deliberately boring in the best way: a bounded request becomes a durable completion loop. Outcome, evidence requirements, recipient, and deadline are defined up front. Delivery uses unique reply addresses and a secure portal. Replies and files are preserved. Structured classification separates complete, incomplete, and uncertain. Only operators close loops. Incomplete submissions get precise follow-ups; cron continues reminders and can escalate to physical mail.",
      },
      {
        type: "h2",
        text: "Why chat is the wrong abstraction",
      },
      {
        type: "p",
        text: "Chat optimizes for conversation. Completion optimizes for state. State needs transitions: created → delivered → responded → under review → correction requested → escalated → closed. Every transition belongs on an append-only timeline. If your tool cannot answer “what was true last Tuesday at 3:12 p.m.?”, it will fail the first serious dispute.",
      },
      {
        type: "h2",
        text: "Humans where judgment is expensive",
      },
      {
        type: "p",
        text: "Models can classify evidence. They should not quietly close high-stakes loops. Uncertain and apparently complete submissions pause for operator review. Inaccurate evidence generates correction requests that are themselves logged. That is not a lack of automation—it is correct automation boundaries.",
      },
      {
        type: "callout",
        title: "Commercial honesty",
        text: "Usage metering for loops and physical mail, trials with caps, and clear plan economics force product discipline. If completion is the unit of value, bill the unit—not vanity seats that encourage spam requests.",
      },
      {
        type: "h2",
        text: "The Quantra rhyme",
      },
      {
        type: "p",
        text: "NoticeRail seals proof of notice. Assistance Intelligence seals timing of openings. Acuria seals completion of requests. Different verbs; same insistence that the system of record is not a folder of screenshots. From signal to system ends in outcomes you can defend.",
      },
    ],
  },
  {
    slug: "applied-intelligence-means",
    title: "What “Applied Intelligence” Actually Means",
    excerpt:
      "A clear definition of applied intelligence—what it is, what it is not, and how Quantra uses it as a build standard rather than a buzzword.",
    date: "2026-07-15",
    readingMinutes: 8,
    category: "Thesis",
    tags: ["applied intelligence", "definition", "standards"],
    featured: true,
    body: [
      {
        type: "p",
        text: "“Applied intelligence” is easy to empty out. So here is a definition we use as an engineering and product standard—not a slogan for the homepage alone.",
      },
      {
        type: "quote",
        text: "Applied intelligence is the disciplined conversion of messy real-world signals into ranked, rule-aware judgments that terminate in workflows and verified outcomes.",
      },
      {
        type: "h2",
        text: "What it is not",
      },
      {
        type: "ul",
        items: [
          "Not a thin chat wrapper over PDFs with no provenance.",
          "Not a dashboard that stops at “insight” when the user needed a mailed letter, an alert, or a closed loop.",
          "Not unbounded autonomy in domains where statutes and eligibility require review gates.",
          "Not generic “AI for X” that ignores how X actually publishes data and fails in production.",
        ],
      },
      {
        type: "h2",
        text: "What it requires",
      },
      {
        type: "ol",
        items: [
          "Primary-source fidelity and change detection.",
          "Structured extraction with confidence and human review paths.",
          "Executable rules for time, method, and eligibility where they exist.",
          "Action rails: APIs, crons, mail, payments, inventories, portals.",
          "Auditability: events, hashes, versions, regenerable proof.",
          "Outcome metrics tied to the domain’s real success criteria.",
        ],
      },
      {
        type: "h2",
        text: "Why we build a portfolio",
      },
      {
        type: "p",
        text: "A single mega-app that “does intelligence” for every industry becomes a consulting firm in product clothing. Vertical products force contact with real operators and real failure modes. Shared methodology and internal compilers (including our intelligence compiler for vertical opportunity libraries) let us transfer learning without diluting product focus.",
      },
      {
        type: "p",
        text: "We sell intelligence products and systems. We do not confuse the internal compiler with the customer-facing package. Domain-agnostic machinery, domain-specific delivery.",
      },
      {
        type: "h2",
        text: "The standard we hold ourselves to",
      },
      {
        type: "p",
        text: "If a feature cannot point to a stage in fragmented data → intelligence → decision → workflow → product → outcome, it is probably decoration. If a claim cannot survive evidence, it does not ship as fact. If an action cannot be proven later, it is not finished.",
      },
      {
        type: "p",
        text: "See what others miss. Build what should exist. From signal to system.",
      },
    ],
  },
];

export function getAllPosts(): BlogPost[] {
  return [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getFeaturedPosts(): BlogPost[] {
  return getAllPosts().filter((p) => p.featured);
}

export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  const current = getPost(slug);
  if (!current) return getAllPosts().slice(0, limit);

  const scored = getAllPosts()
    .filter((p) => p.slug !== slug)
    .map((p) => {
      let score = 0;
      if (p.category === current.category) score += 3;
      score += p.tags.filter((t) => current.tags.includes(t)).length;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || b.p.date.localeCompare(a.p.date));

  return scored.slice(0, limit).map((s) => s.p);
}

export function formatPostDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
