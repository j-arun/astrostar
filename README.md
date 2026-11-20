# Tamil Horoscope (Jadhagam) Ingestion, REST API & Transit Ephemeris Engine 🕉️

A dual-model Vedic astrology data engineering pipeline and REST API server designed to:
1. **Model 1 (`run_ingestion.py`)**: Extract structured data from **Tamil Horoscope PDFs (ஜாதகம் / Jadhagam)** and load them directly into a normalized **PostgreSQL** schema (`person_master`, `natal_placement_detail`, `vimshottari_dasha_detail`).
2. **Model 2 (`run_api_server.py`)**: Serve a high-performance REST API that takes a `person_id` and date timeline (e.g., `January 1998` to `January 2020`), returns a **unified "One Punch" REST response** containing:
   - **Natal Chart Placements**: D1 (Rashi) and D9 (Navamsha) charts with degrees, houses relative to Lagna, nakshatras, padas, and retrograde flags.
  - **Vimshottari Dasha Intervals**: Every stored sub-period from the native's date of birth through the latest available database date, down to **Pratyantardasha (PD / Anthara)** level.
   - **Transit Ephemeris (Gochara)**: Complete planetary transit data for the **standard 9 Grahas** (Jupiter, Saturn, Mars, Rahu, Ketu, Venus, Mercury, Sun, Moon) across the requested window, including sign name, exact minute sputa degrees, nakshatra, and pada (Graha Pada Chara), plus **dual relative house positions**:
     - **Relative to Native's Lagna** (e.g. Jupiter in Katakam/Cancer = 8th house from Dhanus Lagna)
     - **Relative to Native's Janma Rashi / Moon Sign** (e.g. Jupiter in Katakam/Cancer = 9th house from Vrischigam Moon)

**Latest project branch:** `copilot-branch`.

---

## 🏗️ Architecture: Two Operational Models

| Model | Component Script | Execution | Primary Function |
| :--- | :--- | :--- | :--- |
| **Model 1** | `run_ingestion.py` | `python run_ingestion.py` | Parses `horoscope.pdf`, extracts birth metadata, D1/D9 grids, and 40 pages of Vimshottari dasha, then loads into PostgreSQL (`person_master`, `natal_placement_detail`, `vimshottari_dasha_detail`). |
| **Model 2** | `run_api_server.py` | `python run_api_server.py` | Starts REST API server on port 5000. Provides unified `POST /api/horoscope/query` (Natal + Transit in one punch) and dedicated `POST /api/transit/query`; query responses are not persisted. |
| **Ephemeris Engine** | `scripts/vedic_ephemeris.py` | Import or CLI | High-precision astronomical ephemeris (Lahiri / Chitra Paksha Ayanamsha) calculating 9 Grahas sidereal positions, minute sputa degrees, 27 nakshatras, 4 padas, retrograde motions, and relative houses from Lagna and Janma Rashi. |

---

## 📋 Features

- **Automated PDF Parsing (Model 1)**: Analyzes 54-page Tamil horoscope PDFs, extracting personal birth details, planetary positions, D1 (Rashi) and D9 (Navamsha) charts, and 40 pages of Vimshottari Dasha intervals.
- **Dual Tamil Font Encoding Engine**: Transparently handles both modern **UTF-8 Unicode Tamil** and legacy **8-bit Bamini/Vanavil ASCII glyphs** (such as `#hp` for சூரியன், `rdp` for சனி, and `jDR` for தனுசு).
- **South Indian 4×4 Grid Translation**: Dynamically maps 12 zodiac signs and calculates sequential house numbers (**House 1 to 12 clockwise**) relative to the native's Lagna.
- **Timeline Dasha Extractor (Model 2)**: Returns every stored sub-period from the native's date of birth through the latest available date, down to **Pratyantardasha (PD / Anthara)** level with duration and lord hierarchies.
- **Unified "One-Punch" Response**: Merges Natal chart placements, Vimshottari Dasha intervals, and Transit Ephemeris into a single comprehensive JSON payload.
- **Complete Gochara (Transit) Ephemeris**: Computes sidereal coordinates for all 9 Grahas using analytical Keplerian & VSOP87 orbital models with Lahiri Ayanamsha. Computes house relative to Lagna and Moon sign simultaneously.
- **Config-Driven Execution**: Control database credentials, PDF paths, and API host/port in `config.ini`.

---

## 🗄️ Core PostgreSQL Database Schema (3 Tables)

### 1. `person_master` (Primary Entity)
Stores birth coordinates, Lagna, Rashi, Star, and initial starting Dasha balance.
- `person_id VARCHAR(50) PRIMARY KEY`
- `person_name VARCHAR(100)`, `age INTEGER`, `date_of_birth DATE`, `place_of_birth VARCHAR(100)`
- `birth_lagna VARCHAR(50)`, `birth_rashi VARCHAR(50)`, `birth_star VARCHAR(50)`, `birth_star_pada INTEGER`
- `starting_dasha_lord VARCHAR(50)`, `dasha_balance_years INTEGER`, `dasha_balance_months INTEGER`, `dasha_balance_days INTEGER`
- `dasha_balance_text VARCHAR(150)`

### 2. `natal_placement_detail` (Planetary Coordinates)
Planetary positions in **D1 (Rashi)** and **D9 (Navamsha)** charts with calculated house numbers relative to Lagna (**Lagna = House 1**).
- `person_id VARCHAR(50) REFERENCES person_master(person_id)`
- `chart_type VARCHAR(10)` (`'D1'` or `'D9'`)
- `body_name VARCHAR(50)` (e.g. `'Sun (Surya)'`, `'Lagna'`)
- `rashi_name VARCHAR(50)` (e.g. `'Dhanus (Sagittarius)'`)
- `house_number INTEGER` (1 to 12 clockwise relative to Lagna)
- `nakshatra_name VARCHAR(50)`, `pada INTEGER`, `degree_sputa VARCHAR(20)`, `is_retrograde BOOLEAN`
- `CONSTRAINT uq_natal_person_chart_body UNIQUE (person_id, chart_type, body_name)`

### 3. `vimshottari_dasha_detail` (Timeline Intervals)
Continuous chronological timeline of Mahadasha, Antardasha (Bukthi), and Pratyantardasha (Anthara) periods from 1976 to 2090.
- `person_id VARCHAR(50) REFERENCES person_master(person_id)`
- `mahadasha_lord VARCHAR(50)`, `antardasha_lord VARCHAR(50)`, `pratyantardasha_lord VARCHAR(50)`
- `start_date DATE`, `end_date DATE`
- `notes VARCHAR(200)` and `evaluation_rating SMALLINT` are nullable; ratings are `0` (Red/Bad), `5` (Yellow/Average), or `10` (Green/Good).

For an existing database, run `psql -d <dbname> -f scripts/add_dasha_landmark_notes.sql` to add the PD annotation columns and constraints.

---

## 🚀 How to Run

### Step 1: Install Dependencies
```bash
pip install psycopg2-binary pdfplumber requests
```

### Step 2: Configure `config.ini`
```ini
[database]
host = localhost
port = 5432
dbname = astro
user = postgres
password = postgres

[pdf]
pdf_path = horoscope.pdf

[options]
dry_run = false
export_sql = scripts/insert_001ME.sql
export_json = scripts/extracted_001ME.json

[api]
api_host = 0.0.0.0
api_port = 5000
```

---

### Step 3: Run Model 1 — PDF Ingestion Engine
```bash
python run_ingestion.py
```
This parses the PDF and ingests:
- 1 row in `person_master`
- 22 rows in `natal_placement_detail` (11 in D1 + 11 in D9)
- 720 rows in `vimshottari_dasha_detail`

---

### Step 4: Run Model 2 — Horoscope REST API Server
```bash
python run_api_server.py
```
The REST API server will start on `http://localhost:5000`.

### Private LLM for Mahadasha Narratives

The app can run without a local LLM, but generating Mahadasha narratives requires **Ollama running locally**. This feature uses a private local model; it does not send Mahadasha prompts or notes to a cloud LLM provider.

1. Install Ollama and start its local service: <https://ollama.com/download>.
2. Download the model configured by default in `astro_engine.ini`:
  ```bash
  ollama pull qwen2.5:7b-instruct
  ```
3. Keep the configured endpoint available at `http://localhost:11434/api/generate`. If you change the model or endpoint, update the `[provider_local_qwen]` section in `astro_engine.ini`; the endpoint must remain a loopback address (`localhost`, `127.0.0.1`, or `::1`).
4. Start PostgreSQL and the app's API and UI services. Open the **Dasha Reference** section, save PD notes or ratings for the Mahadasha, then use **Generate Narrative**. The narrative is generated from those saved observations, and the prompt editor's saved custom prompt is stored in the current browser.

The API's `[system] default_provider` must remain `local_qwen` for this feature. The other app features do not require Ollama.

#### Testing with cURL:

**1. Option B: High-Density LLM Markdown (Strict Zero-PII, Ready for Gemini/Claude Prompt Injection)**
```bash
curl -X POST "http://localhost:5000/api/horoscope/query?format=llm_markdown" \
  -H "Content-Type: application/json" \
  -d '{
    "person_id": "001ME",
    "start_date": "January 1998",
    "end_date": "January 2020",
    "format": "llm_markdown"
  }'
```
*Note: Returns pure `text/markdown`. Strips all PII (`person_name`, `age`, `date_of_birth`, `place_of_birth`, and Tamil prose). Compresses a 22-year footprint down to ~1,500 tokens (95% token savings).*

**2. Default Full JSON Response (All Details & Raw Dumps)**
```bash
curl -X POST http://localhost:5000/api/horoscope/query \
  -H "Content-Type: application/json" \
  -d '{
    "person_id": "001ME",
    "start_date": "January 1998",
    "end_date": "January 2020"
  }'
```

#### Testing with Python:

**Option B: Direct Markdown Injection into LLM**
```python
import requests

res = requests.post("http://localhost:5000/api/horoscope/query", json={
    "person_id": "001ME",
    "start_date": "January 1998",
    "end_date": "January 2020",
    "format": "llm_markdown"   # Automatically sanitizes all PII
})

markdown_prompt = res.text
print(f"Sanitized Prompt Length: {len(markdown_prompt)} characters (~{len(markdown_prompt)//4} tokens)")

# Pass directly to Gemini Pro or Claude:
# gemini_response = client.models.generate_content(
#     model="gemini-2.5-flash",
#     contents=[f"Astrological Data:\\n{markdown_prompt}\\n\\nTask: Analyze major career shifts between 2005 and 2010."]
# )
```

**Default: Standard Full JSON Payload**
```python
import requests

res = requests.post("http://localhost:5000/api/horoscope/query", json={
    "person_id": "001ME",
    "start_date": "January 1998",
    "end_date": "January 2020"
})
data = res.json()

print(f"Unique Tag:    {data['unique_response_id']}")
print(f"Total PDs:     {data['vimshottari_dasha_intervals']['total_intervals_count']} intervals")
```

---

## 📦 Standardized JSON Response Structure

```json
{
  "unique_response_id": "Q-001ME-20260928182000123456",
  "person_id": "001ME",
  "requested_timeline": {
    "start_date": "1998-01-01",
    "end_date": "2020-01-31",
    "span_years": 22.08
  },
  "person_profile": {
    "person_id": "001ME",
    "person_name": "ME",
    "age": 50,
    "date_of_birth": "1976-01-26",
    "birth_lagna": "Dhanus (Sagittarius)",
    "birth_rashi": "Vrischigam (Scorpio)",
    "birth_star": "Anusham (Anuradha)",
    "birth_star_pada": 2,
    "starting_dasha_lord": "Saturn (Sani)",
    "dasha_balance_text": "13-வருஷம் 2-மாதம் 5-நாள் 31-நாழி 47-விநாடி"
  },
  "natal_placements": {
    "D1_rashi_chart": {
      "count": 11,
      "lagna_sign": "Dhanus (Sagittarius)",
      "bodies": [
        {
          "body_name": "Lagna",
          "rashi_name": "Dhanus (Sagittarius)",
          "house_number": 1,
          "nakshatra_name": "Purva Ashadha",
          "pada": 1,
          "degree_sputa": "16° 33'",
          "is_retrograde": false
        },
        {
          "body_name": "Sun (Surya)",
          "rashi_name": "Makaram (Capricorn)",
          "house_number": 2,
          "nakshatra_name": "Shravana",
          "pada": 1,
          "degree_sputa": "11° 37'",
          "is_retrograde": false
        }
      ]
    },
    "D9_navamsha_chart": {
      "count": 11,
      "bodies": [
        {
          "body_name": "Lagna",
          "rashi_name": "Simham (Leo)",
          "house_number": 1,
          "is_retrograde": false
        }
      ]
    }
  },
  "vimshottari_dasha_intervals": {
    "total_intervals_count": 103,
    "granularity": "Pratyantardasha (PD) Level",
    "intervals": [
      {
        "sequence_index": 1,
        "mahadasha_lord_md": "Mercury (Budha)",
        "antardasha_lord_ad": "Mars (Sevvai)",
        "pratyantardasha_lord_pd": "Jupiter (Guru)",
        "full_lord_hierarchy": "MD: Mercury (Budha) > AD: Mars (Sevvai) > PD: Jupiter (Guru)",
        "start_date": "1997-12-16",
        "end_date": "1998-02-04",
        "duration_days": 50
      }
    ]
  },
  "transit_ephemeris_timeline": {
    "requested_timeline": { "start_date": "1998-01-01", "end_date": "2020-01-31", "span_years": 22.08 },
    "natal_reference": {
      "natal_lagna_sign": "Dhanus (Sagittarius)",
      "natal_rashi_sign": "Vrischigam (Scorpio)"
    },
    "transit_snapshot_start": [
      {
        "graha_name": "Jupiter (Guru)",
        "graha_tamil": "குரு",
        "transit_rashi_name": "Makaram (Capricorn)",
        "degree_sputa": "28° 31' 41\"",
        "graha_pada_chara": { "nakshatra_name": "Dhanishta", "pada": 2 },
        "relative_to_natal_lagna": {
          "house_number": 2,
          "house_title": "Dhana (2nd - Wealth / Family)",
          "description": "2nd house from Natal Lagna (Dhanus)"
        },
        "relative_to_natal_rashi": {
          "house_number": 3,
          "house_title": "Sahaja (3rd - Courage / Siblings)",
          "description": "3rd house from Janma Rashi (Vrischigam)"
        },
        "is_retrograde": false,
        "motion_state": "Direct (நேர்கதி)"
      }
    ],
    "transit_snapshot_end": [ ... ],
    "major_transits_timeline": [
      {
        "graha_name": "Jupiter (Guru)",
        "transit_rashi_name": "Katakam (Cancer)",
        "start_date": "2002-07-06",
        "end_date": "2003-07-30",
        "house_from_natal_lagna": 8,
        "house_from_natal_rashi": 9,
        "nakshatra_name": "Pushya",
        "pada": 3,
        "summary_text": "Jupiter in Katakam (8th from Lagna, 9th from Moon)"
      },
      ...
    ]
  },
  "server_timestamp": "2026-09-28T18:20:00.123456"
}
```

---

## 🤖 Option B: LLM Markdown Prompt Specification (Zero PII)

When requesting `format=llm_markdown` (or `markdown=true`), the REST API automatically converts the heavy JSON structure into a clean, tabular Markdown format specifically engineered for **Gemini 1.5 Pro, Claude 3.5 Sonnet, and GPT-4o**:

### Key Advantages:
1. **Zero PII Exposure**: Completely removes human personal identifiers (`person_name`, `age`, `date_of_birth`, `place_of_birth`, and Tamil prose). Only astronomical coordinates and anonymous IDs (`001ME`) are included.
2. **95% Prompt Window Savings**: Drops a 22-year footprint from **~38,000 tokens** down to **~1,450 tokens**, preserving valuable context window space and reducing API cost.
3. **Optimized for LLM Attention**: High-density tables allow the model's self-attention mechanism to seamlessly cross-reference Dasha period lords with transit house activations.

### Sample Output (`format=llm_markdown`):

```markdown
# VEDIC ASTROLOGICAL REASONING MATRIX (ANONYMIZED)
**Reference:** `001ME` | **Analysis Window:** `1998-01-01` to `2020-01-31` (22.08 years)
**Lagna (Ascendant):** Dhanus (Sagittarius) | **Janma Rashi (Moon Sign):** Vrischigam (Scorpio) | **Birth Nakshatra:** Anusham (Anuradha) (Pada 2) | **Starting Dasha:** Saturn (Sani)

## 1. NATAL CHART PLACEMENTS (D1 Rashi & D9 Navamsha)
| Graha | D1 Sign | D1 House (Lagna=1) | Sputa Degree | Nakshatra & Pada | Motion | D9 Sign | D9 House |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- | :---: |
| Lagna | Dhanus (Sagittarius) | 1 | 16° 33' | Purva Ashadha (P1) | Direct | Simham (Leo) | 1 |
| Sun (Surya) | Makaram (Capricorn) | 2 | 11° 37' | Shravana (P1) | Direct | Mesham (Aries) | 9 |
| Moon (Chandra) | Vrischigam (Scorpio) | 12 | 07° 24' | Anuradha (P2) | Direct | Kanni (Virgo) | 2 |
| Mars (Sevvai) | Rishabam (Taurus) | 6 | 21° 23' | Rohini (P4) | Direct | Katakam (Cancer) | 12 |
| Mercury (Budha)| Makaram (Capricorn) | 2 | 05° 15' | Uttara Ashadha (P3) | Retrograde | Kumbam (Aquarius) | 7 |
| Jupiter (Guru) | Meenam (Pisces) | 4 | 24° 42' | Revati (P3) | Direct | Kumbam (Aquarius) | 7 |
| Venus (Sukra) | Dhanus (Sagittarius) | 1 | 06° 08' | Mula (P2) | Direct | Rishabam (Taurus) | 10 |
| Saturn (Sani) | Katakam (Cancer) | 8 | 05° 57' | Pushya (P1) | Retrograde | Simham (Leo) | 1 |
| Rahu | Thulaam (Libra) | 11 | 24° 25' | Vishakha (P2) | Retrograde | Rishabam (Taurus) | 10 |
| Ketu | Mesham (Aries) | 5 | 24° 25' | Bharani (P4) | Retrograde | Vrischigam (Scorpio) | 4 |

## 2. ACTIVE VIMSHOTTARI DASHA TIMELINE (103 Sub-Intervals down to PD Level)
| # | Period Interval | Mahadasha (MD) | Antardasha (AD) | Pratyantardasha (PD) | Duration |
| -: | :--- | :--- | :--- | :--- | -: |
| 1 | 1997-12-16 to 1998-02-04 | Mercury (Budha) | Mars (Sevvai) | Jupiter (Guru) | 50d |
| 2 | 1998-02-04 to 1998-03-30 | Mercury (Budha) | Mars (Sevvai) | Saturn (Sani) | 54d |
| 3 | 1998-03-30 to 1998-05-20 | Mercury (Budha) | Mars (Sevvai) | Mercury (Budha) | 51d |
...

## 3. GOCHARA (TRANSIT) SNAPSHOT (At Window Start: 1998-01-01)
| Graha | Transit Sign | House from Lagna (H_L) | House from Moon (H_M) | Sputa Degree | Nakshatra & Pada | Motion |
| :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| Jupiter (Guru) | Makaram (Capricorn) | House 2 | House 3 | 28° 31' 41" | Dhanishta-2 (Mars) | Direct |
| Saturn (Sani) | Meenam (Pisces) | House 4 | House 5 | 20° 48' 14" | Revati-2 (Mercury) | Direct |
| Rahu | Simham (Leo) | House 9 | House 10 | 20° 05' 32" | Purva Phalguni-3 (Venus) | Retrograde |
| Ketu | Kumbam (Aquarius) | House 3 | House 4 | 20° 05' 32" | Purva Bhadrapada-1 (Jupiter) | Retrograde |
...

## 4. MAJOR PLANETARY TRANSIT INGRESSES ACROSS TIMELINE (82 Transitions)
| Graha | Ingress Sign | From Lagna | From Moon | Active Period | Star Occupied |
| :--- | :--- | :---: | :---: | :--- | :--- |
| Jupiter (Guru) | Kumbam (Aquarius) | House 3 | House 4 | 1998-01-08 to 1999-01-11 | Shatabhisha (P1) |
| Saturn (Sani) | Mesham (Aries) | House 5 | House 6 | 1998-04-17 to 2000-06-07 | Bharani (P2) |
| Jupiter (Guru) | Katakam (Cancer) | House 8 | House 9 | 2002-07-06 to 2003-07-30 | Pushya (P3) |
...
```

---

---

## 📁 Repository Structure

```text
├── config.ini                    # Central configuration file (DB credentials & options)
├── run_ingestion.py              # Single-command execution runner (Model 1)
├── run_api_server.py             # REST API server (Model 2) on port 5000
├── horoscope_fallback_data.py    # Fallback dataset when PostgreSQL is offline
├── README.md                     # Documentation & setup guide
├── scripts/
│   ├── config.ini                # Secondary config backup
│   ├── extract_tamil_horoscope.py# Core extraction & PostgreSQL ingestion engine
│   ├── schema.sql                # PostgreSQL DDL for native, placement, dasha, and LLM log data
│   ├── extracted_001ME.sql       # Pre-generated complete SQL insert dump for 001ME
│   ├── extracted_001ME.json      # Structured JSON export of all extracted data
│   └── requirements.txt          # Python dependency list
└── src/                          # Interactive visualizer & REST API workbench
```

---

## 📄 License
Vedic astrology calculation, database ingestion, and REST API engine developed for Tamil Jadhagam processing. Open source under the MIT License.

---

## 🧠 Original Source Architecture: Master Prompt + 4 Domain Sub-Prompts

One **unified deterministic engine** (`src/services/llm/originalSourcePrompt.ts` + `src/services/originalSourceContextBuilder.ts` + `src/data/vargaAndStrengthData.ts`) powers **both the React UI and the `GET /api/content` REST API** in **readable LLM-compact format** (spaces enabled between pipes/commas for clean tokenization, zero underscores, zero blank lines).

Instead of sending a single generic prompt or dumping all 22 Varga charts at once, the system separates:
1. **The Master Prompt (`domain=master`)** — contains complete foundational natal data (**only `D1` and `D9` charts**), **Shadbala**, **full 7-Planet + Lagna (`As`) Ashtakavarga + Sodhya Pindas**, **21 Yogas & Pitru Dosha**, **Jaimini Karakamsa/Arudhas**, plus the **9-section Monthly Transit & Dasha Ephemeris**.
2. **4 Domain Sub-Prompts (`Career`, `Finance`, `Love`, `Family`)** — dynamically attach a targeted `[SUB-PROMPT: <DOMAIN>]`, `[DOMAIN STRENGTHS]` spotlight, and **only the Divisional Varga charts (`D2..D144`) relevant to that domain** on top of the Master Prompt.

> Note: Existing `v1`, `v2`, and `v3` app prompts are untouched.

---

### 1. What is Inside the **Master Prompt** (`domain=master`)

The Master Prompt has two blocks (**Static Chart Block** + **Monthly Ephemeris Slice**) and **strictly excludes `D2..D144`** so context stays clean:

#### Static Natal Block (`S1–S7`)
| Section | Contents & Recent Upgrades |
| :--- | :--- |
| `[RULES]` | Strict deterministic reading rules `R0..R8`: `25–27 = neutral` SAV, `CB:- = unfavorable`, glossary (`H#`, `d#`, `P#`, `R`, `N:/T:/Asp:`, `ADISARA`, `VAKRA`, `Prior3d`, `Kendra(...)` from Lagna & Moon), `AD CHAMBER/GATES` definition, and Sub-Prompt Varga synthesis protocol. |
| `[LORDSHIPS]` | Lagna (Sagittarius), Janma Rashi (Scorpio), Janma Star (Anuradha P2), and planetary sign lordships (`Sun..Saturn`) mapped to both Lagna (`L#`) and Moon (`M#`). |
| `[HOUSE LORDS]` | Exact H1–H12 lord placement lookup table showing natal house, dignity, retrograde `(R)`, and solar combustion `(Combust)`. |
| `[D1]` | All 11 Rashi placements with degree, Nakshatra/Pada, dignity (`Own/Exalt/Debil`), **natal Combustion** (e.g. `Mercury | Capricorn | H2 | 05°15' | ... | Comb(6°22')`), **conjunctions**, and **Parashara aspects**. |
| `[D9]` | Navamsa chart (Leo Lagna) with strict 180° node opposition verified: **`Rahu | Taurus | H10`** (conjunct Venus & Mandi) opposite **`Ketu | Scorpio | H4`** — with Vargottama / Own / Exalt / Debil flags and zero invented node exaltation. |
| `[SHADBALA]` | **Newly Added** from `planet_strengths.json`: all 7 planets (`Sun..Saturn`) with Ratio, Total/Required Virupas, `%`, `Strong/Weak` status, all 6 Balas (`Sthana`, `Dig`, `Kaala`, `Cheshta`, `Naisargika`, `Drik`), `Harsha`, `IshtaPhala`, `KashtaPhala`, and `Shadvarga / Dashavarga / Shodashavarga` Vimsopaka scores & Amsas. |
| `[SAV]` | **Calibrated to `Sum:337`** matching Vedic software: `H1:26, H2:30, H3:27, H4:31, H5:24, H6:31, H7:22, H8:22, H9:27, H10:32, H11:35, H12:30` (`Avg:28.1 | Max:H11(35) | Min:H7,H8(22)`). |
| `[BAV]` | **Newly Expanded** from `ashtakavarga_prompt.txt`: full 12-house Bhinnashtakavarga distributions for **all 7 planets** (`Sun 48`, `Moon 49`, `Mars 39`, `Mercury 54`, `Jupiter 56`, `Venus 52`, `Saturn 39`) **plus Lagna (`As`) BAV (49 bindus)** (noted excluded from 337 SAV sum). |
| `[PINDAS]` | **Newly Added**: `Rasi Pinda`, `Graha Pinda`, `Sodhya Pinda`, and `%` strength for all 7 planets (e.g., `Mars: R94+G79=173 (100%)`, `Mercury: R91+G69=160 (92%)`, `Jupiter: R78+G55=133 (77%)`, `Saturn: R91+G15=106 (61%)`). |
| `[YOGAS]` | **Newly Added** from `d1_yogas_doshas_prompt.txt`: **2 Raja Yogas** (*Dharma Karmadhipati Raja Yoga*, *Vipareetha Raja Yoga*) + **19 General Yogas** (*Vosi*, *Nipuna*, *Sunaphaa*, *Hamsa*, *Daama*, *Subha*, *Harihara Brahma*, *Saraswathi*, *Parijatha*, *Swaveeryaddhana*, *Matrumooladdhana*, *Maathru Sneha*, *Bandhu Pujya*, *Vaahana*, *Bhaagya*, etc.). |
| `[DOSHAS]` | **Newly Added**: **`Pitru Dosha (Present)`** — Sun (Pitri Karaka & L9) plus H9 Leo & L9 afflicted by malefics; ancestral lineage obligations & potential friction with father/paternal continuity. |
| `[JAIMINI]` | **Newly Added**: Deterministic 7-Karaka scheme (`AK: Jupiter 24°42'`, `AmK: Mars 21°23'`, `BK: Sun 11°37'`, `MK: Moon 07°24'`, `PK: Venus 06°08'`, `GK: Saturn 05°57'`, `DK: Mercury 05°15'`), `Karakamsa (KK)`, `AL (A1)`, `A5`, `A7`, `A10`, `A11`, and `UL (A12)`. |
| `[KARAKAS]` | Domain focus legend (`Career: H10/Sun/Mercury/Mars`, `Wealth: H2/H11/Jupiter`, `Home: H4/Moon`, `Love/Progeny: H5/H7/Venus`, `Health: H1/H6/Saturn`). |

#### Monthly Ephemeris Slice (`C1–C9`)
| Section | Contents |
| :--- | :--- |
| `[PERIOD]` | Target month/year, date bounds, `TZ: UTC (IST=+05:30)`, daily snapshot (`12:00 UTC`), and `Prior3d` boundary. |
| `[DASHA]` | Exact MD/AD/PD date windows (`start..end`), natal house, per-segment transit sign & dignity (never conflated across signs), `Vakra`, and solar `Combust`. |
| `[SLOW PLANETS]` | Prior-3-day ingress/motion boundary (`Jupiter`, `Saturn`, etc.), full monthly paths for `Jupiter`, `Saturn`, `Rahu`, `Ketu` with calibrated `SAV`, `ADISARA/VAKRA/DIRECT`, degree span, per-pada `Tara`, and Parashara aspects. |
| `[DOUBLE TRANSIT]` | Co-activation windows where Jupiter + Saturn touch/aspect the same sign simultaneously. |
| `[FAST PLANETS]` | `Sun`, `Mars`, `Mercury`, `Venus` sign segments, exact solar combustion dates (e.g., `Combust d1-9`), retrograde/direct spans, and Taras (no redundant Moon row). |
| `[EVENTS]` | Exact stations (`STA`), ingresses, and `Neechabhanga` (`NB`) windows with clarified `Kendra[L#/M#]` frame. |
| `[HOUSE MAP]` | Unified 12-house grid `L#/M#` merging Natal (`N:`), Transit (`T:`), Aspects (`Asp:`), and Moon day spans (`Moon:`). |
| `[LUNAR]` | Continuous UTC hour/minute precision Moon path covering **every traversed Nakshatra** (no skipped stars like `Ardra`), Tara tags, `CB:Fav / CB:-`, and `CHANDRASHTAMA (M8)`. |
| `[AD CHAMBER/GATES]` | Antardasha lord's natal chamber (`natal Saturn @ Cancer L8/M9`) + ruled houses (`T:` transits & `Asp:`) + 3 lunar Nakshatra gates. |

---

### 2. What is Added in Each of the **4 Domain Sub-Prompts**

When you select **Career**, **Finance**, **Love**, or **Family** in the UI or pass `&domain=...` in `GET /api/content`, the engine appends `[SUB-PROMPT: <DOMAIN>]`, `[DOMAIN STRENGTHS]` (karaka Shadbala + focus house SAV/BAV + filtered Yogas & Doshas), and **only that domain's Divisional Varga charts** from `charts_by_house.json` / PostgreSQL `natal_placement_detail`:

| Prompt Type | Master Charts | Divisional Charts Attached | Focus Houses & Karakas | What Gets Highlighted in `[DOMAIN STRENGTHS]` |
| :--- | :--- | :--- | :--- | :--- |
| **Master** (`master`) | **`D1`, `D9`** only | *None* (`D2..D144` omitted) | All H1–H12 baseline | Full foundational chart + monthly ephemeris for all-domain overview. |
| **Career** (`career`) | `D1`, `D9` | **`D10` (Dasamsa)** | **H10, H6, H11, H2, H9, H1** · *Mercury, Sun, Saturn, Mars, Jupiter* | Career Shadbala (`Dig`/`Shodashavarga`), H10(`32`)/H6(`31`)/H11(`35`) SAV/BAV, *Dharma Karmadhipati Raja*, *Vipareetha Raja*, *Nipuna*, *Hamsa*, *Saraswathi* yogas + full 12-house **D10 Dasamsa** placements (Virgo Lagna, Exalted Saturn H2, Vakra Mercury, etc.). |
| **Finance** (`finance`) | `D1`, `D9` | **`D2` (Hora)**, **`D11` (Ekadasamsa)**, **`D4` (Chaturthamsa)** | **H2, H11, H5, H9, H4, H8** · *Jupiter, Venus, Mercury, Saturn, Mars* | Wealth/Pinda strength, H2(`30`)/H11(`35`)/H4(`31`)/H9(`27`) SAV/BAV, *Swaveeryaddhana*, *Anthya Vayasi Dhana*, *Vipareetha Raja*, *Matrumooladdhana* yogas + **D2 Hora** (Solar/Lunar wealth), **D11 Ekadasamsa** (gains), & **D4 Chaturthamsa** (fixed assets). |
| **Love** (`love`) | `D1`, **`D9` (Navamsa)** | **`D7` (Saptamsa)**, **`D30` (Trimsamsa)** | **H5, H7, H12, H11, H1** · *Venus, Jupiter, Mercury, Moon* | Explicitly anchors on Master **`[D9]` Navamsa** (including fixed `Rahu Taurus H10` + `Venus` / `Mandi` opposite `Ketu Scorpio H4`) & Jaimini **`UL (A12)`, `A7`, `DK (Mercury)`**, flags H7(`22`)/H5(`24`) SAV vs H11(`35`)/H12(`30`) SAV + Venus(`52`) & Jupiter(`56`) BAV, *Saraswathi*, *Subha*, *Nishkapata* yogas + **D7 Saptamsa** (intimacy/progeny/creative bond) & **D30 Trimsamsa** (relationship vulnerabilities/friction). |
| **Family** (`family`) | `D1`, `D9` | **`D4` (Chaturthamsa)**, **`D12` (Dwadasamsa)**, **`D7` (Saptamsa)**, **`D16` (Shodasamsa)** | **H4, H2, H5, H9, H3** · *Moon, Jupiter, Sun, Venus, Mars* | Spotlights **`Pitru Dosha (Present)`** (ancestral/paternal obligation & Sun/H9 affliction), *Maathru Sneha*, *Matrumooladdhana*, *Bandhu Pujya*, *Hamsa*, *Vaahana* yogas, H4(`31`)/H2(`30`)/H5(`24`)/H9(`27`) SAV/BAV, **D4 Chaturthamsa** (home/domestic peace), **D12 Dwadasamsa** (parents & lineage), **D7 Saptamsa** (children/family expansion), & **D16 Shodasamsa** (vehicles, comforts, property happiness). |

> All 22 Varga charts (`D1`–`D144`, `001ME`) stored in PostgreSQL `natal_placement_detail` are embedded in `src/data/vargaAndStrengthData.ts` so the frontend & REST endpoint run identically with zero extra database roundtrips.

---

## 🌐 Original Source Monthly Prompt REST API (`GET /api/content`)

Serves the deterministic **Master Prompt** or any of the **4 Domain Prompts** (`Career`, `Finance`, `Love`, `Family`) over HTTP (CORS enabled) for external apps or scripts.

- **Endpoint:** `GET /api/content` (aliases: `/api/original-source`, `/api/original-source/content`)
- **Default dev host:** `http://localhost:3000`

### Supported Query Parameters

| Parameter | Values | Default | Description |
| :--- | :--- | :--- | :--- |
| `date` | `"May 2026"`, `"may-2026"`, `"4/2026"`, `"2026-04"`, `"202605"`, `"Nov 2026"` | Current month | Target month & year (or `?month=11&year=2026`). |
| `domain` | `master` \| `career` (`work`) \| `finance` (`wealth`) \| `love` (`romance`) \| `family` (`home`) | `master` | Selects Master Base (`D1+D9`) or Master + Domain Sub-Prompt + Divisional Varga charts. |
| `variant` | `compact` \| `baseline` \| `both` | `compact` | `compact` (readable LLM-compact with spaces), `baseline` (full verbose 14B labels), or `both`. |
| `part` | `full` \| `static` \| `month` \| `subprompt` | `full` | `full` (complete prompt), `static` (`[RULES]..[KARAKAS]`), `month` (`[PERIOD]..[AD CHAMBER/GATES]`), or `subprompt` (`[SUB-PROMPT: ...]` + Vargas only). |
| `format` | `json` \| `text` | `json` | `json` (metadata + prompt strings + `vargaChartsAttached`) or `text` (raw `text/plain`). |
| `personId` | Stored profile ID | `001ME` | Optional profile override from `stored_persons.json`. |

### Invocation Examples (All Domains & Formats)

#### Option 1: Master Prompt (Default Readable Compact JSON)
```bash
curl "http://localhost:3000/api/content?date=Nov+2026&domain=master&variant=compact"
```

#### Option 2: Domain Prompts (Career / Finance / Love / Family) — Raw Text Ready to Paste
```bash
# Career Prompt (Master + D10 Dasamsa)
curl "http://localhost:3000/api/content?date=Nov+2026&domain=career&variant=compact&format=text"

# Finance Prompt (Master + D2 Hora, D11 Ekadasamsa, D4 Chaturthamsa)
curl "http://localhost:3000/api/content?date=Nov+2026&domain=finance&variant=compact&format=text"

# Love Prompt (Master D9 Navamsa + D7 Saptamsa, D30 Trimsamsa)
curl "http://localhost:3000/api/content?date=Nov+2026&domain=love&variant=compact&format=text"

# Family Prompt (Master + D4, D12 Dwadasamsa, D7, D16 Shodasamsa + Pitru Dosha)
curl "http://localhost:3000/api/content?date=Nov+2026&domain=family&variant=compact&format=text"
```

#### Option 3: Sub-Prompt Block Only (`part=subprompt`)
```bash
curl "http://localhost:3000/api/content?date=4/2026&domain=family&part=subprompt&format=text"
```

#### Option 4: Baseline vs Compact Comparison (`variant=both`)
```bash
curl "http://localhost:3000/api/content?date=2026-11&domain=love&variant=both"
```

### UI Usage (Unified Implementation)
In the Monthly Transit View top toolbar, the segmented **Master | Career | Finance | Love | Family** button group opens the **Original Source Prompt Builder** modal directly on the chosen prompt type for the currently selected month/year. Inside the modal you can:
- Switch seamlessly between **Master**, **Career**, **Finance**, **Love**, and **Family** (all powered by `buildOriginalSourcePrompt`)
- Toggle **Compact (LLM Readable)** *(default)* vs **Baseline (14B Private)**
- Inspect tabs (**Full Prompt**, **Master Static**, **Month Slice**, and **`<Domain>` Sub-Prompt**)
- One-click **Copy** or **Download `.txt`**

---

## GEMINI Setup
to run the gemini , you have create the .env file with the below content and get the api key from gemini ai studio

 touch .env
arun@Aruns-MacBook-Pro astrostar % vi .env
arun@Aruns-MacBook-Pro astrostar % cat .env
GEMINI_API_KEY=""
arun@Aruns-MacBook-Pro astrostar %



