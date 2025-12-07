# Understanding Quantra's SUPER RAG System
## A Plain-Language Guide to Our AI-Powered Compliance Analysis

**For:** Non-Technical Stakeholders, Business Partners, Investors
**Version:** 2.0
**Last Updated:** December 2024

---

## What is SUPER RAG?

**SUPER RAG** stands for **Structured Understanding with Prioritized Evidence Retrieval and Augmented Generation**.

In simple terms, it's Quantra's intelligent system that can instantly determine whether a building element meets BOTH:
1. **Your project's specifications** (what you designed)
2. **Building code requirements** (what the law requires)

Think of it as a tireless, expert building inspector who has memorized every page of your project specs AND the Florida Building Code, and can instantly tell you which limit governs.

---

## The Problem We Solve

### Traditional Code Compliance Review

Before SUPER RAG, checking building code compliance required:

1. **Manual Lookup** - Inspectors flipping through thousands of pages
2. **Expert Interpretation** - Understanding complex legal language
3. **Cross-Referencing** - Finding related sections and exceptions
4. **Documentation** - Writing up findings with proper citations
5. **Time** - Hours or days for thorough analysis

**Result:** Slow, expensive, and prone to human error

### With SUPER RAG

1. **Ask a question** in plain English
2. **Get an instant answer** checking BOTH your specs AND the code
3. **See which limit governs** (design spec or code minimum)
4. **Get risk assessment** and recommendations
5. **Review supporting evidence** from both sources

**Result:** Seconds instead of hours, checks both sources, reports governing limit

---

## How It Works: The Complete Picture

SUPER RAG has two main parts:
1. **Getting documents into the system** (project specs + building codes)
2. **Answering your questions** (checking both sources)

### Part 1: Loading Documents Into the System

Before SUPER RAG can answer questions, it needs to "learn" BOTH your project specs AND the building codes:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   THE DUAL-SOURCE LEARNING PROCESS                                 │
│                                                                     │
│   ══════════════════════════════════════════════════════════════   │
│   SOURCE 1: YOUR PROJECT SPECIFICATIONS (The Design Target)        │
│   ══════════════════════════════════════════════════════════════   │
│                                                                     │
│   ┌─────────────────┐                                              │
│   │ Project Spec    │                                              │
│   │ PDFs (CSI)      │                                              │
│   │ (50-500 pages)  │                                              │
│   └────────┬────────┘                                              │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │ UPLOAD IN "DEFINE" PHASE                                │      │
│   │                                                         │      │
│   │ The system extracts:                                    │      │
│   │ • CSI Division (e.g., "05 51 00 - Metal Stairs")       │      │
│   │ • Parameter Name (e.g., "Riser Height")                │      │
│   │ • Min/Max/Target Values (e.g., "4-7 inches")           │      │
│   │ • Units (e.g., "inches", "psi")                        │      │
│   └─────────────────────────────────────────────────────────┘      │
│            │                                                        │
│            ▼                                                        │
│   ┌────────────────────────┐                                       │
│   │ project_specs TABLE    │  ← Stored PER PROJECT                 │
│   │                        │                                       │
│   │ Your specific design   │                                       │
│   │ requirements that may  │                                       │
│   │ be STRICTER than code  │                                       │
│   └────────────────────────┘                                       │
│                                                                     │
│   ══════════════════════════════════════════════════════════════   │
│   SOURCE 2: BUILDING CODES (The Legal Minimum)                     │
│   ══════════════════════════════════════════════════════════════   │
│                                                                     │
│   ┌─────────────────┐                                              │
│   │ Florida Building│                                              │
│   │ Code PDF        │                                              │
│   │ (2,000+ pages)  │                                              │
│   └────────┬────────┘                                              │
│            │                                                        │
│            ▼                                                        │
│   ┌────────────────────────┐                                       │
│   │ code_sections TABLE    │  ← Shared across projects             │
│   │                        │                                       │
│   │ The legal baseline     │                                       │
│   │ that EVERY building    │                                       │
│   │ must meet at minimum   │                                       │
│   └────────────────────────┘                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Part 2: Answering Your Questions (Dual-Source Retrieval)

Once the documents are loaded, here's what happens when you ask a question:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   YOUR QUESTION                                                     │
│   "A 500 sq ft standing assembly room has 50 occupants.            │
│    Is this compliant?"                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   STEP 1: UNDERSTAND THE QUESTION                                   │
│                                                                     │
│   The system recognizes:                                            │
│   • This is about a CONDITION (50 occupants exist)                 │
│   • NOT about what the maximum should be                           │
│   • The user wants to know: is 50 within the allowed limit?        │
│                                                                     │
│   This is important! The system knows you're describing what       │
│   EXISTS, not asking what the code REQUIRES.                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   STEP 2: SEARCH THE CODE LIBRARY (Two Ways at Once!)              │
│                                                                     │
│   🔍 MEANING SEARCH                 🔍 KEYWORD SEARCH               │
│   Finds sections about             Finds exact matches like        │
│   similar topics (even if          "assembly", "occupant",         │
│   different words are used)        "standing", "500"               │
│                                                                     │
│   Results from BOTH searches are combined.                         │
│   Keyword matches get a 50% bonus (exact terms matter in codes!)   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   STEP 3: GATHER EVIDENCE (Following the Priority Rules)           │
│                                                                     │
│   The system finds and organizes evidence in priority order:       │
│                                                                     │
│   🥇 FIRST PRIORITY: Tables with Exact Numbers                     │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │ Table 1004.5 found!                                     │      │
│   │ Standing assembly = 5 sq ft per person                  │      │
│   │                                                         │      │
│   │ These numbers are TRUSTED. The AI must use them.       │      │
│   └─────────────────────────────────────────────────────────┘      │
│                                                                     │
│   🥈 SECOND PRIORITY: Specific Rules                               │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │ If asking about "spiral stairs", use the spiral stair   │      │
│   │ section - NOT the general stairway section.            │      │
│   └─────────────────────────────────────────────────────────┘      │
│                                                                     │
│   🥉 THIRD PRIORITY: General Text                                  │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │ Background information and context from the code.       │      │
│   └─────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   STEP 4: AI ANALYSIS                                               │
│                                                                     │
│   Our AI analyst reviews all the evidence:                         │
│                                                                     │
│   📋 "I found Table 1004.5 with exact numbers."                    │
│   📋 "Standing assembly = 5 sq ft per person"                      │
│   📋 "Room is 500 sq ft, so max = 500 ÷ 5 = 100 occupants"        │
│   📋 "User says there are 50 occupants"                            │
│   📋 "50 is LESS than 100 maximum"                                 │
│   📋 "Therefore: COMPLIANT ✓"                                      │
│                                                                     │
│   The AI follows strict rules:                                      │
│   • Only use data from the retrieved context                       │
│   • Never make things up                                           │
│   • When unsure, say "Needs Review" not "Pass"                    │
│   • Always show the math and cite sources                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   STEP 5: YOUR RESULTS                                              │
│                                                                     │
│   ✅ STATUS: Compliant                                              │
│                                                                     │
│   📖 CITATION: Table 1004.5                                        │
│                                                                     │
│   📝 EXPLANATION: "The 500 sq ft standing assembly room has a      │
│      maximum occupant load of 100 (500 ÷ 5 = 100). With 50        │
│      occupants, the room is operating at 50% of capacity and       │
│      is compliant with the Florida Building Code."                 │
│                                                                     │
│   ⚡ RISK SCORE: 1/10 (Very Low)                                   │
│                                                                     │
│   📊 DATA SOURCE: Structured Table (highest confidence)            │
│                                                                     │
│   🎯 CONFIDENCE: 100%                                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What Makes SUPER RAG Special?

### 1. The "Smart Priority System"

Not all information is equal. SUPER RAG knows this and follows a strict priority order:

| Priority | Data Type | Example | Why It's Important |
|----------|-----------|---------|-------------------|
| 🥇 **First** | Tables with Numbers | "Table 1004.5: Assembly = 5 sq ft/person" | Exact values, no interpretation needed |
| 🥈 **Second** | Specific Rules | "Section 1011.10: Spiral Stairways" | Purpose-built for the exact situation |
| 🥉 **Third** | General Rules | "Section 1011.5: Stairway Construction" | Applies when no specific rule exists |

**Real Example:**
- Question: "What's the occupant load for a 500 sq ft standing room?"
- Table says: 5 sq ft per person for standing assembly
- Calculation: 500 ÷ 5 = **100 occupants** ✓
- Confidence: **100%** (because we used verified table data)

### 2. The "Smart Question Understanding"

SUPER RAG knows the difference between:
- **Describing what exists**: "The room has 50 occupants" → Check if that's OK
- **Asking what's required**: "What's the maximum?" → Tell you the limit

**Why This Matters:**

Old AI systems might say:
> "You're wrong! The maximum is 100, not 50!"

SUPER RAG correctly says:
> "The 50 occupants you have is within the 100 maximum. COMPLIANT."

### 3. The "Dual Search" Approach

Two search methods work together:

| Search Type | What It Finds | Example |
|-------------|---------------|---------|
| **Meaning Search** | Conceptually related content | "helical stairs" when you asked about "spiral stairways" |
| **Keyword Search** | Exact terms and section numbers | "1011.10" when you mention that section |

Keyword matches get a 50% bonus because exact terminology matters in legal codes.

### 4. The "Show Your Work" Principle

Every answer includes:
- **Which code section** was used
- **Why it was chosen** over other sections
- **What data source** (table vs. text) informed the decision
- **The actual calculation** or comparison made
- **What it's uncertain about** (if anything)

### 5. Graceful Handling of Uncertainty

When there's not enough information, SUPER RAG doesn't guess:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Question: "Is my stairway compliant?"                            │
│                                                                     │
│   ⚠️ STATUS: Needs Review                                          │
│                                                                     │
│   EXPLANATION: "The query does not provide specific details        │
│   about the stairway's characteristics such as width, riser        │
│   height, or tread depth. Please provide these measurements        │
│   for an accurate compliance analysis."                            │
│                                                                     │
│   RECOMMENDATION: "Provide specific dimensions including           │
│   width, riser height, and tread depth."                           │
│                                                                     │
│   CONFIDENCE: 50% (insufficient information)                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Understanding the Results

### Status Indicators

| Status | Meaning | What To Do |
|--------|---------|------------|
| ✅ **Compliant** | Meets all requirements found | Document and proceed |
| ❌ **Non-Compliant** | Violates one or more requirements | Requires correction |
| ⚠️ **Needs Review** | Borderline, incomplete info, or uncertain | Human verification needed |

### Risk Score (1-10)

| Score | Level | What It Means |
|-------|-------|---------------|
| 1-2 | Minor | Paperwork issues, cosmetic concerns |
| 3-4 | Low | Small code deviation, easy fix |
| 5-6 | Moderate | Significant work needed, possible safety concern |
| 7-8 | Serious | Major rework, direct safety implications |
| 9-10 | Critical | Immediate hazard, stop work recommended |

### Risk Factors

- **Life Safety**: Could this hurt someone?
- **Rework Cost**: How expensive to fix?
- **Schedule Impact**: Will this delay the project?

### Data Source

Shows where the answer came from:
- **Structured Table**: Highest confidence - exact numbers from code tables
- **Text Context**: Code section text - good confidence
- **Both**: Used tables for numbers, text for context

### Confidence Level

- **90-100%**: Very certain (usually when tables provide exact numbers)
- **70-89%**: Confident (clear text requirements found)
- **50-69%**: Moderate (some interpretation required)
- **Below 50%**: Low (consider human expert review)

---

## Real-World Examples

### Example 1: Simple Occupancy Check (PASS)

**Question:** "A 500 sq ft standing assembly room has 50 occupants"

**What SUPER RAG Does:**
1. Understands this is a CONDITION (50 exists), not a claim about the limit
2. Finds Table 1004.5 (occupant load factors)
3. Extracts: Standing assembly = 5 sq ft per person
4. Calculates maximum: 500 ÷ 5 = 100 occupants
5. Compares: 50 < 100
6. Returns: **PASS - within capacity, 100% confidence**

---

### Example 2: Occupancy Violation (FAIL)

**Question:** "A 500 sq ft standing assembly room has 150 occupants"

**What SUPER RAG Does:**
1. Same process as above
2. Calculates maximum: 100 occupants
3. Compares: 150 > 100
4. Returns: **FAIL - over capacity by 50 people**

---

### Example 3: Specific vs. General Rule

**Question:** "Is a 30-inch wide spiral stairway compliant?"

**What SUPER RAG Does:**
1. Finds BOTH Section 1011.5 (general stairs) and Section 1011.10 (spiral stairs)
2. Recognizes: "Spiral stairway" is MORE SPECIFIC
3. Uses Section 1011.10: Minimum width = 26 inches for spiral stairs
4. Compares: 30" > 26" ✓
5. Notes: Other requirements (tread, riser) not specified
6. Returns: **PASS for width, but flags other specs to verify**

---

### Example 4: Insufficient Information

**Question:** "Is my stairway compliant?"

**What SUPER RAG Does:**
1. Searches for stairway requirements
2. Finds multiple applicable sections
3. Realizes: No dimensions provided - can't determine compliance
4. Returns: **NEEDS REVIEW - please provide dimensions**

---

## Key Benefits

### For Quality Assurance Teams
- **Speed**: Answers in 4-6 seconds, not hours
- **Consistency**: Same question always gets same answer
- **Documentation**: Automatic citation and evidence trail
- **Coverage**: Never miss an obscure code section

### For Project Managers
- **Risk Visibility**: Immediate understanding of issue severity
- **Prioritization**: Risk scores help triage problems
- **Cost Awareness**: Rework cost estimates included
- **Schedule Protection**: Early identification of blockers

### For Compliance Officers
- **Audit Trail**: Complete record of all analyses
- **Citation Accuracy**: Proper code references every time
- **Defensibility**: Evidence-based determinations
- **Confidence Levels**: Know when human review is needed

### For Executives
- **Reduced Liability**: Consistent, documented compliance checks
- **Cost Savings**: Faster reviews, fewer errors
- **Scalability**: Handle more projects without more staff
- **Competitive Advantage**: Faster turnaround than competitors

---

## Frequently Asked Questions

### Q: Can SUPER RAG replace human inspectors?

**A:** No - and it's not designed to. SUPER RAG is a tool that makes human inspectors MORE effective. It handles the tedious lookup and cross-referencing work, freeing experts to focus on judgment calls and physical inspections. When SUPER RAG is uncertain, it explicitly flags the need for human review.

### Q: What building codes does it support?

**A:** Currently optimized for the **Florida Building Code (8th Edition, 2023)**. The system architecture supports adding additional codes (IBC, California, etc.) as the database grows.

### Q: How accurate is it?

**A:** In our testing:
- **100% accuracy** on table-based calculations
- **95%+ accuracy** on specific rule identification
- **85%+ accuracy** on complex interpretive questions

When uncertain, the system says so - which is a feature, not a bug.

### Q: What happens if I don't provide enough information?

**A:** SUPER RAG will return "Needs Review" and tell you exactly what information is missing. It never guesses.

### Q: How fast is it?

**A:** Typical response time is **4-6 seconds**, including:
- Understanding your question
- Searching the database
- AI analysis
- Generating the response

### Q: Can it handle complex questions?

**A:** Yes, though it works best with focused questions. For complex scenarios, breaking into specific questions yields better results:

**Instead of:** "Is my entire stairwell compliant?"

**Ask:**
1. "Is a 44-inch stair width compliant for assembly occupancy?"
2. "Are 7-inch risers compliant for egress stairs?"
3. "Is 26-inch spiral stairway width compliant?"

---

## The Technology Behind It (Simplified)

### PDF Processing
Building codes are loaded page by page, split into searchable chunks, and tagged with section numbers and titles.

### Vector Embeddings
Your question is converted into a mathematical "fingerprint" (1,536 numbers) that captures its meaning. Similar questions have similar fingerprints.

### Hybrid Search
Two search methods run simultaneously - one for meaning, one for keywords. Results are combined with keywords getting a 50% boost.

### Structured Tables
Important tables from the building code are stored in a special format (JSONB) that allows precise numeric lookups, not just text matching.

### Large Language Model (GPT-4o)
The AI "analyst" that reads all the evidence and produces the final determination. It follows strict rules and never invents information.

### Robust Error Handling
When the AI returns incomplete information, the system fills in sensible defaults and flags uncertainty.

---

## Security & Privacy

- **Data Isolation**: Each analysis is independent
- **No Training on Your Data**: Your queries don't train the AI
- **Audit Logging**: All analyses recorded for compliance
- **Encryption**: Data encrypted in transit and at rest

---

## Getting Started

1. **Navigate** to the Compliance Analyzer in your Quantra dashboard
2. **Enter** your compliance question in plain English
3. **Click** "Analyze" and wait a few seconds
4. **Review** the results, citations, and recommendations
5. **Document** findings in your project records

---

**Document Version:** 2.0
**Classification:** External - Business Stakeholders
**Copyright:** Quantra, Inc. All Rights Reserved.
