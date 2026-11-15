# SOFTWARE REQUIREMENTS SPECIFICATION (SRS v1.0)
**Project Title:** Vedic Brain Exporter & Private Companion Reasoning Application  
**System Scope:** Complete JSON Brain Export (Astro Engine) + Standalone Multi-Device Private Reasoning & Investigation Companion App  
**Document Status:** Approved Architecture & Requirements Baseline  

---

## 1. EXECUTIVE PURPOSE & PROBLEM STATEMENT

The primary **Astro Engine** already computes deterministic Vedic parameters (D1, D9, Vimshottari MD/AD/PD, SAV, Same-Sign Stations, Parivartana Yogas, Neecha Bhanga, Antardasha Pressure Chamber, 3 Nakshatra Delivering-Hand Gates, and Strict In-Window Moon Transit / 7th-Aspect Triggers) and synthesizes predictions using Public LLMs (**Claude Fable / Sonnet / Haiku**, **Gemini Flash / Pro**, **OpenAI**).

This specification defines **two linked capabilities**:
1. **Upgraded "Export JSON" Brain Capsule (in Astro Engine):** Every monthly, house, or multi-year generation must export a complete, self-contained **Monthly Brain JSON** capturing the exact prompt sent, the exact Public LLM response (raw + parsed + thinking), complete execution telemetry, real API token counts, and calculated INR usage cost (**Usage Paisa**).
2. **Separate Private Brain Companion App (Desktop / Web / Mobile PWA):** A standalone private application that loads any exported Monthly Brain JSON into memory, uses a **deterministic JSON parser + Private LLM Ingestion Prompt** to categorize the entire month cleanly into evidence-backed **Life Buckets** (`Career`, `Finance`, `Love`, `Family`, `Health`, `Special Yogas`, `Moon Timing Windows`), layers the user's confidential **Personal Life Dossier**, and runs **deep astrological investigation Q&A** completely offline/privately using Local LLM (e.g., Qwen 7B / 14B via Ollama).

---

## 2. MODULE A — UPGRADED "EXPORT JSON" BRAIN CAPSULE SPECIFICATION

### 2.1 Functional Requirement
When the user clicks **Export JSON** (or auto-saves a monthly report), the generated `.json` file (`Vedic_Brain_<Scope>_<Period>_<Engine>_<YYYY-MM-DD>.json`) must contain **100% of the prompt, response, astronomical input, exact report generation date/time, and usage telemetry** so it can serve as a standalone knowledge brain for external applications.

Specifically, the JSON MUST distinguish between:
- **Report Generation Date (`reportGeneratedDate` / `reportGeneratedIso` / `reportGeneratedLocal`):** Exact date & timestamp when the Public LLM (Claude / Gemini / OpenAI / Qwen) actually generated the prediction report.
- **JSON Export Date (`exportedDate` / `exportedAtIso`):** Exact date & timestamp when the user downloaded/exported the `.json` artifact (preserving the original `reportGeneratedDate` even if exported weeks later from cache).

### 2.2 API Usage & "Usage Paisa" Reality Check
* **What LLM APIs return directly:**
  * **Anthropic Claude (`Fable`, `Sonnet`, `Haiku`):** Returns `usage.input_tokens`, `usage.output_tokens`, `usage.output_tokens_details.thinking_tokens`, `usage.cache_read_input_tokens`, `usage.cache_creation_input_tokens`. Does **not** return money/paisa.
  * **Google Gemini (`2.5 Flash`, `2.5 Pro`, etc.):** Returns `usageMetadata.promptTokenCount`, `usageMetadata.candidatesTokenCount`, `usageMetadata.thoughtsTokenCount`, `usageMetadata.cachedContentTokenCount`, `usageMetadata.totalTokenCount`. Does **not** return money/paisa (Free Tier keys effectively cost ₹0, while Paid Tier keys bill per 1M tokens).
  * **OpenAI (`GPT-4o`, `o3`, `GPT-4.1`):** Returns `usage.prompt_tokens`, `usage.completion_tokens`, `usage.completion_tokens_details.reasoning_tokens`, `usage.total_tokens`. Does **not** return money/paisa.
  * **Local Ollama (`Qwen`):** Returns `prompt_eval_count`, `eval_count`, `load_duration`, `total_duration`. Cost is always ₹0 (`0 paise`).
* **Required Pricing Calculation Engine:**
  * Because no Public LLM API returns INR paisa directly, the exporter must maintain an internal **Configurable Model Rate Card** (`inputUsdPer1M`, `outputUsdPer1M`, `thinkingUsdPer1M`, `cachedInputUsdPer1M`, `isFreeTierFlag`, `fxUsdToInr`) and deterministically calculate:
    * `estimatedCostUsd = (inputTokens * inRate + outputTokens * outRate + thinkingTokens * thinkRate + cachedTokens * cacheRate) / 1_000_000`
    * `estimatedCostInr = estimatedCostUsd * fxUsdToInr`
    * `estimatedUsagePaisa = Math.round(estimatedCostInr * 100 * 100) / 100` (precise to 2 decimal paise; `0` if Local Ollama or user marks Gemini key as Free Tier).

### 2.3 Canonical Export JSON Schema (`vedic_brain_v1`)

```json
{
  "schemaVersion": "vedic_brain_v1",
  "brainId": "brain_monthly_november_2026_claude_fable_20261114T221737",
  "reportGeneratedDate": "2026-11-14",
  "reportGeneratedLocal": "2026-11-14 22:17:37 -08:00",
  "reportGeneratedIso": "2026-11-15T06:17:37.000Z",
  "exportedDate": "2026-11-14",
  "exportedAtIso": "2026-11-15T06:17:37.000Z",

  "targetScope": {
    "scopeType": "monthly | multi_year | house",
    "monthIndex": 10,
    "monthName": "November",
    "year": 2026,
    "dateRange": "2026-11-01 to 2026-11-30",
    "personName": "Native",
    "natalLagnaSign": "Sagittarius",
    "natalRashiSign": "Scorpio",
    "activeDasha": {
      "mahadasha": "Venus",
      "antardasha": "Saturn",
      "pratyantardasha": "Mercury"
    }
  },

  "engineMetadata": {
    "providerId": "claude_fable | claude_sonnet | claude_haiku | gemini_pro | openai | local_qwen",
    "displayEngineName": "Claude Fable 5.1",
    "exactModelId": "claude-fable-5-1",
    "reportGeneratedDate": "2026-11-14",
    "reportGeneratedIso": "2026-11-15T06:17:37.000Z",
    "timeTakenMs": 18450,
    "timeTakenSeconds": 18.45,
    "connectionStatus": "connected_live | connection_failed_fallback"
  },

  "tokenTelemetry": {
    "promptTokens": 6713,
    "completionTokens": 3420,
    "thinkingTokens": 1250,
    "cachedTokens": 0,
    "totalTokens": 11383,
    "telemetrySource": "api_reported | char_estimated",
    "rawUsageObject": {}
  },

  "costTelemetry": {
    "currency": "INR",
    "fxRateUsdToInr": 84.50,
    "pricingTier": "paid_api | free_tier | local_zero_cost",
    "estimatedCostUsd": 0.0714,
    "estimatedCostInr": 6.03,
    "usagePaisa": 603.33,
    "pricingNotes": "Computed from exact API token counts and model rate card."
  },

  "promptArtifact": {
    "promptVersion": "v2",
    "charLength": 26853,
    "fullPromptText": "<EXACT COMPLETE PROMPT SENT TO PUBLIC LLM>"
  },

  "publicLlmResponse": {
    "rawResponseText": "<EXACT RAW TEXT / JSON STRING RETURNED BY MODEL>",
    "extendedThinkingText": "<CLAUDE THINKING BLOCK OR GEMINI THOUGHT SUMMARY IF PRESENT>",
    "rawProviderEnvelope": {},
    "parsedStructuredNarrative": {
      "summarySentence": "...",
      "natalPromiseVsTransitDelivery": {},
      "part1_probabilityAndScope": "...",
      "part2_financialAndResources": "...",
      "part3_microTimingWindow": "...",
      "supplementaryScenarios": [],
      "predictedSpecificEvents": [],
      "supersetSynthesisNote": "...",
      "correlatedGateEvents": []
    }
  },

  "deterministicAstroContext": {
    "flattenedNatalD1": [],
    "allTransitPlacements": [],
    "monthlyMoonSpans": [],
    "ashtakavargaSav": {},
    "vedicSpecialEvents": {},
    "eventManufacturingSuperset": {}
  }
}
```

---

## 3. MODULE B — SEPARATE PRIVATE COMPANION APPLICATION SPECIFICATION

### 3.1 Core Architectural Flow
```
[Exported Brain JSON File(s)]
        │
        ▼
(1) Deterministic JSON Unpacker & Validator
    • Reads engine, month, tokens, paisa, prompt sections, parsed narrative & special yogas
    • Stores raw + unpacked sections in In-Memory Store (plus local SQLite / IndexedDB)
        │
        ▼
(2) Private LLM Ingestion & Bucketing Pass (Prompt #1 — Author-Engineered System Prompt)
    • Summarizes: Who reasoned it, Month/Dasha, Top Astronomical Drivers & Overall Verdict
    • Maps & locks evidence into Canonical Life Buckets WITHOUT deviating from source data
        │
        ▼
(3) In-Memory Bucketed Knowledge Store + Personal Life Dossier
    • Buckets: [Career] [Finance] [Love] [Family] [Health] [Special Yogas] [Moon Windows]
    • Personal Dossier: User's confidential life timeline (e.g., "Quit job in Saturn PD due to ego")
        │
        ▼
(4) Private LLM Deep Investigator Q&A (Prompt #2 — Interactive Query Loop)
    • Retrieves only relevant Buckets + D1/Dasha facts + Personal Dossier entries
    • Conducts secondary Vedic investigation on top of Public LLM's baseline conclusions
```

### 3.2 Feature Requirements

#### FR-1: Multi-Brain Loader & Comparison Switcher
* User can upload/select one or more exported `vedic_brain_v1` JSON files (e.g., *November 2026 — Claude Fable 5.1* and *November 2026 — Gemini 2.5 Pro*), or import legacy JSON/HTML files from `/docs`.
* Immediately displays a **Brain Provenance Strip**:
  * Generated By (`Claude Fable 5.1`, `Gemini 2.5 Pro`, `OpenAI`, etc.)
  * Target Month & Active Dasha (`MD > AD > PD`)
  * Generated Timestamp & Time Taken (`18.45s`)
  * Prompt Tokens / Output Tokens / Thinking Tokens / **Usage Paisa (`603.33 paise / ₹6.03`)**

#### FR-2: Automatic Load-Time Briefing & Canonical Bucketing (Private LLM Ingestion)
* Immediately upon loading a Brain JSON into memory, the app runs a deterministic pre-extraction followed by **Private LLM Prompt #1 (Ingestion & Bucket Synthesizer)**:
  * **Zero-Deviation Rule:** Every bucket item MUST link back to explicit `astrologicalEvidence` (houses, lords, Parivartana, Stations, Neecha Bhanga, Nakshatra Gates, Moon windows) present in the loaded JSON—no fabricated planets or dates.
  * **Mandatory Output Buckets stored in In-Memory State:**
    1. **`monthBriefing`**: 4–6 line executive overview stating period, Dasha, model, overall tone, and top planetary reasons.
    2. **`career` (Work / Authority / Role / Ego Dynamics)**
    3. **`finance` (Money / Cashflow / Debts / Gains / Assets)**
    4. **`love` (Romance / Relationship / Interpersonal Expectations)**
    5. **`family` (Domestic Sanctuary / Mother / Property / Peace)**
    6. **`health` (Somatic Stress / Vulnerable Zones / Sleep / Vitality)**
    7. **`specialYogasAndStations` (Parivartana / Same-Sign Stations / Neecha Bhanga before-vs-after timelines)**
    8. **`moonTimingCalendar` (Strict In-Window Moon Conjunctions & 7th Aspects sorted at top vs Background Non-Moon windows)**
  * **Per-Bucket Schema:**
    ```json
    {
      "bucketId": "career",
      "headlineVerdict": "...",
      "probabilityRating": 85,
      "supportingEvidence": ["Sun<->Mars Parivartana Nov 17-30", "Mercury Direct Libra Nov 14"],
      "keyTimingWindows": ["Nov 17-19 (Moon in Aquarius 7th-Aspect to Leo)", "Nov 22-23"],
      "cautionaryFactors": ["Ego friction with superiors during Mars activation"],
      "sourceNarrativeQuotes": ["<exact excerpt from public LLM response>"]
    }
    ```

#### FR-3: Author-Engineered Private LLM Ingestion Prompt (System Template)
* The Private LLM receives clean structured sections (not noisy raw strings) with the following author-level contract:
  * *"You are the Private Astrological Brain Analyst inside the Companion App. You have been handed a pre-solved Monthly Prediction Brain generated by [EngineName] for [Month Year] under [MD > AD > PD]."*
  * *"Step 1: Briefly explain what this month is about and WHY [EngineName] reached its conclusions based strictly on the planetary evidence in the Brain."*
  * *"Step 2: Aggregate every prediction, scenario, correlated gate event, station, Parivartana, and Moon window into exact canonical JSON buckets (`career`, `finance`, `love`, `family`, `health`, `specialYogasAndStations`, `moonTimingCalendar`) without dropping facts or inventing external transits."*

#### FR-4: Confidential Personal Life Dossier (Local-Only Memory)
* A dedicated **My Personal Dossier** editor allowing the user to log private events tagged by **Dasha period & domain** (never uploaded to any cloud LLM):
  * Example: *"Event: Resigned/quit job over ego conflict with leadership | Period: Venus MD > Saturn AD > Saturn PD | Domain: Career | Goal: Want to know if recovery happens in Mercury PD or slips beyond."*
* Stored strictly locally (IndexedDB / local encrypted JSON / local SQLite).

#### FR-5: Deep Astrological Investigation Mode (Private LLM Prompt #2)
* When the user asks a personal follow-up question:
  1. **Context Router** pulls:
     * Matching Life Bucket(s) (e.g., `career` + `specialYogasAndStations` + `moonTimingCalendar`),
     * Raw D1 Natal Placements + Active MD/AD/PD + Pratyantardasha lord natal house/lordships + 3 Delivering Hand Gates from `deterministicAstroContext`,
     * Matching `Personal Life Dossier` entries (especially comparing past **Saturn PD** vs upcoming **Mercury PD**).
  2. **Investigator Prompt Instructions to Private LLM:**
     * *Step A (Audit Public Baseline):* Cite what the Public LLM (`Claude` / `Gemini`) already predicted for this bucket.
     * *Step B (Secondary Astrological Investigation):* Inspect why the user's past event happened under **Saturn PD** (e.g., Saturn's natal condition, ego/10th house pressure, Retrograde vs Direct factors) and evaluate **Mercury PD** (Mercury's natal sign/house, ownership of Lagna houses, Mercury's Direct station inside Libra on Nov 14, Dainya/Karmic Parivartana with Venus, and Revati/Jyeshtha/Ashlesha gates).
     * *Step C (Actionable Personal Verdict & Timing):* Give a direct, honest answer—will recovery happen inside Mercury PD (with specific Moon transit/7th-aspect dates to act) or get postponed to the next PD, and what behavioral/ego posture is required.

#### FR-6: Multi-Report Compare Mode & Cross-Device Access
* **Compare Claude vs Gemini:** Load two Brain JSONs for the same month and let the Private LLM highlight consensus vs disagreement on a specific personal question.
* **Mobile / Multi-Device Architecture:**
  * Run the Private Brain Companion server locally (Node/Express or Python FastAPI) serving a responsive **Mobile PWA** connected over **Tailscale / WireGuard** to the user's desktop running **Ollama**.
  * Zero public cloud exposure for personal life questions.

---

## 4. IMPLEMENTATION ROADMAP (PHASED)
1. **Phase 1 — Astro Engine Export Upgrade:** Update `Export JSON` & `predictionCacheService` + backend token/cost calculators (`usagePaisa`) for Gemini, Claude, OpenAI, and Ollama so every saved/downloaded JSON matches `vedic_brain_v1`.
2. **Phase 2 — Companion Ingestion Engine:** Build deterministic `vedic_brain_v1` parser + Private LLM Prompt #1 to populate the in-memory Buckets (`career`, `finance`, `love`, `family`, `health`, `specialYogasAndStations`, `moonTimingCalendar`).
3. **Phase 3 — Personal Dossier + Investigator Q&A + Mobile PWA:** Build the local Dossier store, Private LLM Prompt #2 (Deep Astrological Investigator), Multi-Model Compare view, and Tailscale-ready mobile PWA interface.
