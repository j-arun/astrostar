# SOFTWARE REQUIREMENTS SPECIFICATION (SRS v2.0)
**Project Title:** Astro Engine – D1 Monthly Transit & Multi-LLM Reasoning System  
**System Module:** 5th Main Navigation Menu — `Monthly View`  
**Architecture Pattern:** Dual-Layer Reactive South Indian Grid + Pluggable Multi-LLM Provider Adapter + Persisted Declarative Rule Engine  
**Document Status:** Approved Baseline for Implementation  

---

## 1. PURPOSE & ARCHITECTURAL SCOPE

The **Monthly View** module expands the Astro Engine platform by introducing a predictive, bi-directional monthly transit evaluation workspace. It correlates three distinct Vedic astrological dimensions:
1. **Permanent Natal Archetype:** Natal D1 Rashi placements & Lagna coordinates (e.g., from PDF `001ME`).
2. **Dynamic Ephemeris Transits (Gochara):** 30-day time-window planetary ingress and coordinate overlay.
3. **Vimshottari Dasha Hierarchy:** Active Maha Dasha (MD), Antar Dasha (AD), and Pratyantar Dasha (PD) lords.

These three streams are synthesized by an **in-memory & persisted Rule Engine** that computes activation scores ($0.0 \le \text{Score} \le 1.0$) for each of the 12 houses. High-scoring houses emit life events, pulsate visually, and can be queried via an **interactive audio/voice inspector** driven by a **pluggable Multi-LLM Reasoning Engine** (Local Qwen 14B, Google Gemini Pro, Anthropic Claude).

---

## 2. FUNCTIONAL SPECIFICATIONS BY COMPONENT

### Component 1: South Indian D1 Grid & Visual Engine
* **Fixed Spatial Geometry:**
  * Must conform strictly to classical South Indian cartography (4×4 outer perimeter ring with a 2×2 hollow center).
  * Sign assignments are immutable:
    * Row 0: `Meenam / Pisces` (Col 0), `Mesham / Aries` (Col 1), `Rishabam / Taurus` (Col 2), `Mithunam / Gemini` (Col 3).
    * Row 1: `Kumbam / Aquarius` (Col 0), Center Hollow (Cols 1–2), `Katakam / Cancer` (Col 3).
    * Row 2: `Makaram / Capricorn` (Col 0), Center Hollow (Cols 1–2), `Simham / Leo` (Col 3).
    * Row 3: `Dhanus / Sagittarius` (Col 0), `Vrischigam / Scorpio` (Col 1), `Thulaam / Libra` (Col 2), `Kanni / Virgo` (Col 3).
* **Zodiac Representation Iconography:**
  * Each house cell must render an evocative, high-contrast astrological archetype icon:
    * 🏹 **Dhanus (Sagittarius)**: Archer / Bow
    * 🐐 **Makaram (Capricorn)**: Sea-Goat
    * 🏺 **Kumbam (Aquarius)**: Water Bearer Pot
    * 🐟 **Meenam (Pisces)**: Two Fishes
    * 🐏 **Mesham (Aries)**: Ram Horns
    * 🐂 **Rishabam (Taurus)**: Bull
    * 👥 **Mithunam (Gemini)**: Divine Twins
    * 🦀 **Katakam (Cancer)**: Crab
    * 🦁 **Simham (Leo)**: Lion
    * 🌾 **Kanni (Virgo)**: Maiden / Sheaf of Grain
    * ⚖️ **Thulaam (Libra)**: Balance Scales
    * 🦂 **Vrischigam (Scorpio)**: Scorpion
* **Relative House Numbering:**
  * Dynamically computes and displays the Bhava number ($1..12$) clockwise relative to the birth Lagna (e.g., if Lagna is Dhanus, Dhanus = House 1, Makaram = House 2, ..., Vrischigam = House 12).
* **Dual-Layer Planetary Presentation:**
  * **Base Layer (Natal):** High-contrast, solid badges (Gold/Amber border) displaying birth Grahas and Lagna indicator (`L`).
  * **Overlay Layer (Transit):** Semi-transparent, distinct color badges (Cyan/Indigo) with a `[Tr]` or `T-` prefix indicating real-time Gochara positions for the active month.
* **Graha Drishti Raycaster (OnClick Trigger):**
  * Clicking any planet (Natal or Transit) dynamically illuminates its target aspect houses:
    * All Grahas: 7th house aspect.
    * Special Grahas:
      * **Saturn (Sani):** 3rd, 7th, 10th houses.
      * **Mars (Sevvai):** 4th, 7th, 8th houses.
      * **Jupiter (Guru):** 5th, 7th, 9th houses.
      * **Rahu / Ketu:** 5th, 7th, 9th trinal aspects.
  * Raycast targets illuminate with a distinctive colored glow and connection badges indicating the aspecting Graha.

---

### Component 2: Time Navigation & Backtesting Controller
* **Temporal Navigation Controller:**
  * Scrubber / Month-Year stepper supporting infinite past backtesting (e.g., verifying 1998, 2015 events) and future projections (up to 2050+).
  * Quick jump presets: `[ -1 Year ]`, `[ -1 Month ]`, `[ Current Month ]`, `[ +1 Month ]`, `[ +1 Year ]`.
* **Vimshottari Dasha Hierarchy Resolver:**
  * Resolves the active 3-tier hierarchy (`Maha Dasha > Antar Dasha > Pratyantar Dasha`) for any selected date in real time from the 720 pre-computed person intervals.
  * Displays active lords and remaining validity dates directly in the top controller bar.
* **Ephemeris Ingress Calculation:**
  * Computes the mean zodiac positions of all 9 transiting Grahas for the selected month window.

---

### Component 3: The Persisted Rule Engine & Event Emission Scoring
* **Decoupled Architecture:**
  * Rule configurations stored in an extensible declarative schema (`astro_rules.json` / PostgreSQL).
* **Default Astrological Rules Matrix:**
  * **Rule 1 — PD Lord Domain Focus (Weight: 0.35):** House owned or occupied by the active Pratyantar Dasha lord.
  * **Rule 2 — Double Transit Sanction (Weight: 0.40):** House jointly transited or aspected by BOTH Saturn (Sani) and Jupiter (Guru).
  * **Rule 3 — Natal Overlay Trigger (Weight: 0.25):** Transiting benefic or malefic conjunct a sensitive natal planet.
  * **Rule 4 — Karaka Activation (Weight: 0.20):** Specific house karaka (Venus for 7th, Mars/Saturn for 4th, Sun for 10th) receiving Gochara stimulation.
* **House Activation Threshold & Visual Pulsing:**
  * Total Score $= \sum (\text{Rule Weight} \times \text{Condition Match})$.
  * If $\text{Score} \ge 0.60$, the house is flagged as **`Active Event Emitting`**.
  * The house box triggers a soft glowing animation (amber/gold border pulse) with an `Event Active` badge.
* **Interactive Bottom-Pane Configurator:**
  * Positioned directly below the full D1 chart grid.
  * Displays every active rule, its conditions, weight slider ($0.0 \dots 1.0$), and an active toggle switch.
  * Supports adding custom interpretation rules (e.g., *Rahu-Ketu transit over Lagna/7th axis*).
  * Changes recalculate scores instantly across the entire grid without page reload.

---

### Component 4: Multi-LLM Reasoning Engine & Audio Inspector
* **The On-Screen Provider Selector:**
  * Interactive 3-way dropdown positioned in the top control bar:
    1. **`🖥️ Local (Qwen 2.5 14B via Ollama)`** — Default selection.
    2. **`♊ Google Gemini Pro (gemini-2.5-pro)`**
    3. **`🧠 Anthropic Claude (claude-3-5-sonnet)`**
* **The Provider Adapter Pattern (`ILLMAdapter`):**
  * Strict abstraction layer ensuring uniform prompt delivery and structured response parsing:
    * `QwenLocalAdapter`: Communicates with `http://localhost:11434/api/generate` using ChatML formatting.
    * `GeminiStudioAdapter`: Communicates via `@google/genai` SDK using `gemini-2.5-pro` with system instructions.
    * `ClaudeAdapter`: Formats payload into Anthropic Messages API specification.
* **The INI Configuration File (`astro_engine.ini`):**
  * Centralizes model identifiers, temperatures, token limits, and local endpoints.
* **Audio Voice-Over & 3-Part Synthesized Narrative:**
  * Hovering/clicking an active house reveals the **Audio Mic / Voice Inspector**.
  * User can click the speaker to auto-synthesize, or press-to-speak a custom query (e.g., *"Will I buy a house or change jobs this month?"*).
  * The LLM synthesizes a strict 3-part narrative:
    1. **Event Probability & Scope:** Clear verification based on house significations (Bhavas) and PD lord authority.
    2. **Financial & Resource Sources:** Identifies capital origin (2nd savings, 4th loans, 9th inheritance, 11th gains).
    3. **Micro-Timing Window:** Specifies the 3–7 day peak activation interval within the 30-day month.
  * Built-in Web Speech Synthesis voice playback with an interactive transcript drawer.

---

# ITERATIVE EXECUTION ROADMAP

| Phase | Milestone Name | Scope & Deliverables | Acceptance Gate |
|---|---|---|---|
| **Milestone 1** | **D1 Dual-Layer Visualizer & Sign Iconography** | 5th main menu tab `Monthly View`, full-screen South Indian 4×4 grid, 12 zodiac archetypal icons, dual-layer badges (solid Natal + semi-transparent Transit), Graha Drishti aspect raycaster. | **Gate 1: User Review & Sign-Off** |
| **Milestone 2** | **Timeline Scrubber & Ephemeris Backtesting Engine** | Month/Year scrubber, live Vimshottari MD > AD > PD resolver, instant ephemeris transit calculator for any month (1970–2050+). | **Gate 2: User Review & Sign-Off** |
| **Milestone 3** | **Persisted Astrological Rule Engine & Bottom Pane** | Rule Engine data model & scoring algorithm, pulsing event-emitting house boxes, interactive bottom configurator with toggles and weight sliders. | **Gate 3: User Review & Sign-Off** |
| **Milestone 4** | **Multi-LLM Adapters & Audio Voice Inspector** | `astro_engine.ini`, 3-way dropdown (Local Qwen 14B, Gemini, Claude), backend adapter proxy, 3-part narrative synthesis and voiceover. | **Gate 4: User Review & Final Validation** |
