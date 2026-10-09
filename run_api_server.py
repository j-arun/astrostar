#!/usr/bin/env python3
"""
===============================================================================
VEDIC ASTROLOGY HOROSCOPE REST API SERVER (MODEL 2)
===============================================================================
Endpoints:
  POST /api/horoscope/query
    Request Body:
      {
        "person_id": "001ME",
        "start_date": "1998-01-01",  (or "January 1998", "01.01.1998")
        "end_date": "2020-01-31"     (or "January 2020", "31.01.2020")
      }
    Response:
      {
        "unique_response_id": "Q-001ME-014-20260928182000",
        "running_number": 14,
        "person_id": "001ME",
        "timeline": {
          "requested_start": "1998-01-01",
          "requested_end": "2020-01-31",
          "span_years": 22.08
        },
        "person_profile": { ... },
        "natal_placements": {
          "D1": [ ... D1 bodies with house, sign, star, degree_sputa, is_retrograde ... ],
          "D9": [ ... D9 bodies with house, sign ... ]
        },
        "vimshottari_dasha_intervals": [
          {
            "sequence_index": 1,
            "md": "Mercury (Budha)",
            "ad": "Venus (Sukra)",
            "pd": "Mars (Sevvai)",
            "full_lord_hierarchy": "MD: Mercury (Budha) > AD: Venus (Sukra) > PD: Mars (Sevvai)",
            "start_date": "1997-10-02",
            "end_date": "1997-10-23",
            "duration_days": 21
          },
          ...
        ],
        "stored_in_user_queries": true
      }

  GET /api/user-queries/recent
    Retrieves the transaction logs from the user_queries database table.

  GET /api/health
    Database connection and server status.

Configuration:
  Reads [database] and [api] from config.ini.
===============================================================================
"""

import os
import sys
import json
import re
import configparser
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

# Ensure scripts directory is in path for modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "scripts"))

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

try:
    from vedic_ephemeris import generate_transit_timeline, get_all_grahas_transit_snapshot, parse_sign_to_index
    HAS_EPHEMERIS = True
except Exception as e:
    print(f"Notice: vedic_ephemeris import warning: {e}")
    HAS_EPHEMERIS = False


# =============================================================================
# 1. CONFIGURATION & DATABASE ACCESS
# =============================================================================

def load_config() -> Dict[str, Any]:
    cfg = configparser.ConfigParser()
    candidate_paths = [
        "config.ini",
        "scripts/config.ini",
        os.path.join(os.path.dirname(__file__), "config.ini"),
        os.path.join(os.path.dirname(__file__), "scripts", "config.ini")
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            cfg.read(p)
            break

    settings = {
        "host": "localhost",
        "port": 5432,
        "dbname": "vedic_astro",
        "user": "postgres",
        "password": "postgres",
        "api_host": "0.0.0.0",
        "api_port": 5000
    }

    if cfg.has_section("database"):
        settings["host"] = cfg.get("database", "host", fallback=settings["host"])
        settings["port"] = cfg.getint("database", "port", fallback=settings["port"])
        settings["dbname"] = cfg.get("database", "dbname", fallback=settings["dbname"])
        settings["user"] = cfg.get("database", "user", fallback=settings["user"])
        settings["password"] = cfg.get("database", "password", fallback=settings["password"])

    if cfg.has_section("api"):
        settings["api_host"] = cfg.get("api", "api_host", fallback=settings["api_host"])
        settings["api_port"] = cfg.getint("api", "api_port", fallback=settings["api_port"])

    return settings


def get_db_connection(cfg: Dict[str, Any]):
    if not HAS_PSYCOPG2:
        return None
    try:
        conn = psycopg2.connect(
            host=cfg["host"],
            port=cfg["port"],
            dbname=cfg["dbname"],
            user=cfg["user"],
            password=cfg["password"],
            connect_timeout=2
        )
        return conn
    except Exception as e:
        print(f"PostgreSQL connection error: {e}")
        return None


# =============================================================================
# 2. DATE NORMALIZATION UTILITY
# =============================================================================

MONTHS_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12
}

def normalize_date(input_val: str, default_to_end_of_month: bool = False) -> str:
    """
    Parses flexible human inputs like:
      - "1998-01-01" -> "1998-01-01"
      - "January 1998" -> "1998-01-01" (or "1998-01-31" if default_to_end_of_month=True)
      - "01.01.1998" -> "1998-01-01"
      - "1998" -> "1998-01-01"
    """
    if not input_val:
        return datetime.now().strftime("%Y-%m-%d")

    s = input_val.strip().lower()

    # Match YYYY-MM-DD
    iso_match = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', s)
    if iso_match:
        y, m, d = map(int, iso_match.groups())
        return f"{y:04d}-{m:02d}-{d:02d}"

    # Match DD.MM.YYYY or DD/MM/YYYY
    dmy_match = re.match(r'^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$', s)
    if dmy_match:
        d, m, y = map(int, dmy_match.groups())
        return f"{y:04d}-{m:02d}-{d:02d}"

    # Match YYYY-MM, YYYY/MM, YYYY.MM (e.g. "2028-01", "2028-04", "2028/1", "2028-6")
    ym_match = re.match(r'^(\d{4})[./-](\d{1,2})$', s)
    if ym_match:
        y_num = int(ym_match.group(1))
        m_num = max(1, min(12, int(ym_match.group(2))))
        if default_to_end_of_month:
            if m_num in [1, 3, 5, 7, 8, 10, 12]:
                day = 31
            elif m_num == 2:
                day = 29 if (y_num % 4 == 0 and (y_num % 100 != 0 or y_num % 400 == 0)) else 28
            else:
                day = 30
        else:
            day = 1
        return f"{y_num:04d}-{m_num:02d}-{day:02d}"

    # Match MM/YYYY, MM-YYYY, MM.YYYY (e.g. "01/2028", "04-2028", "4/2028")
    my_match = re.match(r'^(\d{1,2})[./-](\d{4})$', s)
    if my_match:
        m_num = max(1, min(12, int(my_match.group(1))))
        y_num = int(my_match.group(2))
        if default_to_end_of_month:
            if m_num in [1, 3, 5, 7, 8, 10, 12]:
                day = 31
            elif m_num == 2:
                day = 29 if (y_num % 4 == 0 and (y_num % 100 != 0 or y_num % 400 == 0)) else 28
            else:
                day = 30
        else:
            day = 1
        return f"{y_num:04d}-{m_num:02d}-{day:02d}"

    # Match Month Name + Year (e.g. "January 1998", "jan 1998")
    m_year_match = re.search(r'([a-z]+)\s+(\d{4})', s)
    if m_year_match:
        m_str, y_str = m_year_match.groups()
        m_num = MONTHS_MAP.get(m_str[:3], 1)
        y_num = int(y_str)
        if default_to_end_of_month:
            # End of month
            if m_num in [1, 3, 5, 7, 8, 10, 12]:
                day = 31
            elif m_num == 2:
                day = 29 if (y_num % 4 == 0 and (y_num % 100 != 0 or y_num % 400 == 0)) else 28
            else:
                day = 30
        else:
            day = 1
        return f"{y_num:04d}-{m_num:02d}-{day:02d}"

    # Year only
    if re.match(r'^\d{4}$', s):
        y = int(s)
        return f"{y:04d}-12-31" if default_to_end_of_month else f"{y:04d}-01-01"

    # Default fallback
    return s


# =============================================================================
# 3. SCHEMA INITIALIZER (INCLUDING user_queries TABLE & 1-100 SEQUENCE)
# =============================================================================

def ensure_tables_exist(conn):
    if not conn:
        return
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS person_master (
            person_id VARCHAR(50) PRIMARY KEY,
            person_name VARCHAR(100),
            age INTEGER,
            date_of_birth DATE,
            place_of_birth VARCHAR(100),
            birth_lagna VARCHAR(50),
            birth_rashi VARCHAR(50),
            birth_star VARCHAR(50),
            birth_star_pada INTEGER,
            starting_dasha_lord VARCHAR(50),
            dasha_balance_years INTEGER,
            dasha_balance_months INTEGER,
            dasha_balance_days INTEGER,
            dasha_balance_text VARCHAR(150),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS natal_placement_detail (
            id SERIAL PRIMARY KEY,
            person_id VARCHAR(50) NOT NULL REFERENCES person_master(person_id) ON DELETE CASCADE,
            chart_type VARCHAR(10) NOT NULL,
            body_name VARCHAR(50) NOT NULL,
            rashi_name VARCHAR(50) NOT NULL,
            house_number INTEGER NOT NULL,
            nakshatra_name VARCHAR(50),
            pada INTEGER,
            degree_sputa VARCHAR(20),
            is_retrograde BOOLEAN DEFAULT FALSE,
            CONSTRAINT uq_natal_person_chart_body UNIQUE (person_id, chart_type, body_name)
        );

        CREATE TABLE IF NOT EXISTS vimshottari_dasha_detail (
            id SERIAL PRIMARY KEY,
            person_id VARCHAR(50) NOT NULL REFERENCES person_master(person_id) ON DELETE CASCADE,
            mahadasha_lord VARCHAR(50) NOT NULL,
            antardasha_lord VARCHAR(50) NOT NULL,
            pratyantardasha_lord VARCHAR(50) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            rating_score VARCHAR(10),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE SEQUENCE IF NOT EXISTS user_query_seq
            MINVALUE 1
            MAXVALUE 100
            START WITH 1
            INCREMENT BY 1
            CYCLE;

        CREATE TABLE IF NOT EXISTS user_queries (
            id SERIAL PRIMARY KEY,
            query_id VARCHAR(50) UNIQUE NOT NULL,
            running_number INTEGER NOT NULL,
            person_id VARCHAR(50) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            response_payload JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE SEQUENCE IF NOT EXISTS llm_prompt_log_seq
            MINVALUE 1
            MAXVALUE 100
            START WITH 1
            INCREMENT BY 1
            CYCLE;

        CREATE TABLE IF NOT EXISTS llm_prompt_logs (
            id SERIAL PRIMARY KEY,
            log_id VARCHAR(64) UNIQUE NOT NULL,
            running_number INTEGER NOT NULL,
            engine VARCHAR(50) NOT NULL,
            model_name VARCHAR(100),
            fired_at TIMESTAMP WITH TIME ZONE NOT NULL,
            prompt_text TEXT NOT NULL,
            response_text TEXT NOT NULL,
            time_taken_ms INTEGER NOT NULL,
            status VARCHAR(30) DEFAULT 'SUCCESS',
            response_json JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    cur.close()


def save_person_to_db(cfg: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection(cfg)
    if not conn:
        return {"success": True, "notice": "Saved in memory cache (PostgreSQL connection offline)"}
    try:
        ensure_tables_exist(conn)
        cur = conn.cursor()
        pm = data.get("person", {}) or data.get("person_master", {})
        pid = pm.get("person_id")
        if not pid:
            return {"success": False, "error": "Missing person_id in payload"}

        cur.execute("""
            INSERT INTO person_master (
                person_id, person_name, age, date_of_birth, place_of_birth,
                birth_lagna, birth_rashi, birth_star, birth_star_pada,
                starting_dasha_lord, dasha_balance_years, dasha_balance_months,
                dasha_balance_days, dasha_balance_text
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (person_id) DO UPDATE SET
                person_name = EXCLUDED.person_name,
                age = EXCLUDED.age,
                date_of_birth = EXCLUDED.date_of_birth,
                place_of_birth = EXCLUDED.place_of_birth,
                birth_lagna = EXCLUDED.birth_lagna,
                birth_rashi = EXCLUDED.birth_rashi,
                birth_star = EXCLUDED.birth_star,
                birth_star_pada = EXCLUDED.birth_star_pada,
                starting_dasha_lord = EXCLUDED.starting_dasha_lord,
                dasha_balance_years = EXCLUDED.dasha_balance_years,
                dasha_balance_months = EXCLUDED.dasha_balance_months,
                dasha_balance_days = EXCLUDED.dasha_balance_days,
                dasha_balance_text = EXCLUDED.dasha_balance_text;
        """, (
            pid, pm.get("person_name"), pm.get("age", 40),
            pm.get("date_of_birth"), pm.get("place_of_birth"),
            pm.get("birth_lagna"), pm.get("birth_rashi"),
            pm.get("birth_star"), pm.get("birth_star_pada", 1),
            pm.get("starting_dasha_lord"), pm.get("dasha_balance_years", 0),
            pm.get("dasha_balance_months", 0), pm.get("dasha_balance_days", 0),
            pm.get("dasha_balance_text", "")
        ))

        # Placements
        placements = data.get("placements", []) or (data.get("d1Placements", []) + data.get("d9Placements", []))
        if placements:
            for p in placements:
                cur.execute("""
                    INSERT INTO natal_placement_detail (
                        person_id, chart_type, body_name, rashi_name, house_number,
                        nakshatra_name, pada, degree_sputa, is_retrograde
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (person_id, chart_type, body_name) DO UPDATE SET
                        rashi_name = EXCLUDED.rashi_name,
                        house_number = EXCLUDED.house_number,
                        nakshatra_name = EXCLUDED.nakshatra_name,
                        pada = EXCLUDED.pada,
                        degree_sputa = EXCLUDED.degree_sputa,
                        is_retrograde = EXCLUDED.is_retrograde;
                """, (
                    pid, p.get("chart_type", "D1"),
                    p.get("body_name"), p.get("rashi_name"),
                    p.get("house_number", 1), p.get("nakshatra_name"),
                    p.get("pada"), p.get("degree_sputa"),
                    bool(p.get("is_retrograde", False))
                ))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "message": f"Person '{pid}' committed to PostgreSQL database successfully!"}
    except Exception as e:
        if conn: conn.close()
        return {"success": False, "error": str(e)}


def save_llm_prompt_log_to_db(cfg: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    engine = data.get("engine", "Gemini")
    model_name = data.get("model_name", "")
    fired_at = data.get("fired_at") or datetime.now().isoformat()
    prompt_text = data.get("prompt_text") or data.get("prompt", "")
    response_text = data.get("response_text") or data.get("response", "")
    time_taken_ms = int(data.get("time_taken_ms") or data.get("duration_ms") or 0)
    status = data.get("status", "SUCCESS")
    response_json = data.get("response_json") or data.get("rawResponseBody")

    now_str = datetime.now().strftime("%Y%m%d%H%M%S")
    engine_clean = re.sub(r'[^A-Za-z0-9]', '', engine).upper()[:8] or "LLM"

    conn = get_db_connection(cfg)
    if conn:
        try:
            ensure_tables_exist(conn)
            cur = conn.cursor()
            cur.execute("SELECT nextval('llm_prompt_log_seq');")
            running_num = int(cur.fetchone()[0])
            log_id = f"LOG-{engine_clean}-{running_num:03d}-{now_str}"

            cur.execute("""
                INSERT INTO llm_prompt_logs (
                    log_id, running_number, engine, model_name, fired_at,
                    prompt_text, response_text, time_taken_ms, status, response_json
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                log_id, running_num, engine, model_name, fired_at,
                prompt_text, response_text, time_taken_ms, status,
                json.dumps(response_json) if response_json is not None else None
            ))
            conn.commit()
            cur.close()
            conn.close()
            return {
                "success": True,
                "log_id": log_id,
                "running_number": running_num,
                "persisted_in": "postgresql.llm_prompt_logs"
            }
        except Exception as e:
            if conn:
                conn.rollback()
                conn.close()
            print(f"Error persisting LLM log to DB: {e}")

    # Fallback storage if PostgreSQL is offline
    fallback_path = os.path.join(os.path.dirname(__file__), "scripts", "stored_prompt_logs.json")
    try:
        logs = []
        if os.path.exists(fallback_path):
            with open(fallback_path, "r", encoding="utf-8") as f:
                logs = json.load(f)
        running_num = (len(logs) % 100) + 1
        log_id = f"LOG-{engine_clean}-{running_num:03d}-{now_str}"
        entry = {
            "log_id": log_id,
            "running_number": running_num,
            "engine": engine,
            "model_name": model_name,
            "fired_at": fired_at,
            "prompt_text": prompt_text,
            "response_text": response_text,
            "time_taken_ms": time_taken_ms,
            "status": status,
            "response_json": response_json,
            "created_at": datetime.now().isoformat()
        }
        logs.insert(0, entry)
        if len(logs) > 200:
            logs = logs[:200]
        with open(fallback_path, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=2)
        return {
            "success": True,
            "log_id": log_id,
            "running_number": running_num,
            "persisted_in": "scripts/stored_prompt_logs.json (DB offline fallback)"
        }
    except Exception as e2:
        return {"success": False, "error": str(e2)}


def get_llm_prompt_logs_from_db(cfg: Dict[str, Any], limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db_connection(cfg)
    if conn:
        try:
            ensure_tables_exist(conn)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT id, log_id, running_number, engine, model_name,
                       fired_at, prompt_text, response_text, time_taken_ms, status, created_at
                FROM llm_prompt_logs
                ORDER BY id DESC
                LIMIT %s;
            """, (limit,))
            rows = cur.fetchall()
            for r in rows:
                if r.get("fired_at"): r["fired_at"] = str(r["fired_at"])
                if r.get("created_at"): r["created_at"] = str(r["created_at"])
            cur.close()
            conn.close()
            return rows
        except Exception:
            if conn: conn.close()

    fallback_path = os.path.join(os.path.dirname(__file__), "scripts", "stored_prompt_logs.json")
    if os.path.exists(fallback_path):
        try:
            with open(fallback_path, "r", encoding="utf-8") as f:
                return json.load(f)[:limit]
        except Exception:
            pass
    return []



# =============================================================================
# 4. QUERY EXECUTION & RESPONSE BUILDER
# =============================================================================

# Fallback in-memory dataset if PostgreSQL is not currently running locally
from horoscope_fallback_data import get_fallback_data

def query_horoscope_and_timeline(cfg: Dict[str, Any], person_id: str, start_date_str: str, end_date_str: str) -> Dict[str, Any]:
    norm_start = normalize_date(start_date_str, default_to_end_of_month=False)
    norm_end = normalize_date(end_date_str, default_to_end_of_month=True)

    conn = get_db_connection(cfg)
    
    if conn:
        try:
            ensure_tables_exist(conn)
            cur = conn.cursor(cursor_factory=RealDictCursor)

            # 1. Fetch Person Master
            cur.execute("""
                SELECT person_id, person_name, age, date_of_birth, place_of_birth,
                       birth_lagna, birth_rashi, birth_star, birth_star_pada,
                       starting_dasha_lord, dasha_balance_years, dasha_balance_months,
                       dasha_balance_days, dasha_balance_text
                FROM person_master
                WHERE person_id = %s;
            """, (person_id,))
            person_row = cur.fetchone()

            if not person_row:
                cur.close()
                conn.close()
                return {"error": f"Person '{person_id}' not found in database person_master table."}

            # Convert date objects to strings
            if person_row.get("date_of_birth"):
                person_row["date_of_birth"] = str(person_row["date_of_birth"])

            # 2. Fetch Natal Placements (D1 & D9)
            cur.execute("""
                SELECT chart_type, body_name, rashi_name, house_number,
                       nakshatra_name, pada, degree_sputa, is_retrograde
                FROM natal_placement_detail
                WHERE person_id = %s
                ORDER BY chart_type ASC, house_number ASC;
            """, (person_id,))
            placement_rows = cur.fetchall()

            d1_placements = []
            d9_placements = []
            for p in placement_rows:
                entry = {
                    "body_name": p["body_name"],
                    "rashi_name": p["rashi_name"],
                    "house_number": p["house_number"],
                    "nakshatra_name": p.get("nakshatra_name"),
                    "pada": p.get("pada"),
                    "degree_sputa": p.get("degree_sputa"),
                    "is_retrograde": bool(p.get("is_retrograde"))
                }
                if p["chart_type"] == "D1":
                    d1_placements.append(entry)
                elif p["chart_type"] == "D9":
                    d9_placements.append(entry)

            # 3. Fetch Vimshottari Dasha intervals overlapping the requested timeline
            # Interval overlap: (start_date <= requested_end) AND (end_date >= requested_start)
            cur.execute("""
                SELECT mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date
                FROM vimshottari_dasha_detail
                WHERE person_id = %s
                  AND start_date <= %s
                  AND end_date >= %s
                ORDER BY start_date ASC;
            """, (person_id, norm_end, norm_start))
            dasha_rows = cur.fetchall()

            dasha_intervals = []
            for idx, d in enumerate(dasha_rows, 1):
                s_d = d["start_date"]
                e_d = d["end_date"]
                days = (e_d - s_d).days if isinstance(s_d, date) and isinstance(e_d, date) else None
                dasha_intervals.append({
                    "sequence_index": idx,
                    "mahadasha_lord_md": d["mahadasha_lord"],
                    "antardasha_lord_ad": d["antardasha_lord"],
                    "pratyantardasha_lord_pd": d["pratyantardasha_lord"],
                    "full_lord_hierarchy": f"MD: {d['mahadasha_lord']} > AD: {d['antardasha_lord']} > PD: {d['pratyantardasha_lord']}",
                    "start_date": str(s_d),
                    "end_date": str(e_d),
                    "duration_days": days
                })

            # 4. Generate next 1-100 cycling sequence number from PostgreSQL
            cur.execute("SELECT nextval('user_query_seq') AS running_num;")
            running_num = cur.fetchone()["running_num"]

            timestamp_str = datetime.now().strftime("%Y%m%d%H%M%S")
            unique_response_id = f"Q-{person_id}-{running_num:03d}-{timestamp_str}"

            # Calculate span in years
            try:
                dt_start = datetime.strptime(norm_start, "%Y-%m-%d")
                dt_end = datetime.strptime(norm_end, "%Y-%m-%d")
                span_years = round((dt_end - dt_start).days / 365.25, 2)
            except Exception:
                dt_start = datetime.now()
                dt_end = dt_start
                span_years = None

            # Compute Transit Ephemeris & Gochara Timeline for the window
            transit_data = None
            if HAS_EPHEMERIS and dt_start and dt_end:
                try:
                    lagna_idx = parse_sign_to_index(person_row.get("birth_lagna", "Dhanus"), default=9)
                    rashi_idx = parse_sign_to_index(person_row.get("birth_rashi", "Vrischigam"), default=8)
                    transit_data = generate_transit_timeline(dt_start, dt_end, lagna_idx, rashi_idx)
                except Exception as ex:
                    print(f"Notice: Transit calculation error: {ex}")

            # Build final Response Payload ("One Punch" Natal + Transit)
            response_payload = {
                "unique_response_id": unique_response_id,
                "running_number": running_num,
                "person_id": person_id,
                "requested_timeline": {
                    "start_date": norm_start,
                    "end_date": norm_end,
                    "span_years": span_years
                },
                "person_profile": person_row,
                "natal_placements": {
                    "D1_rashi_chart": {
                        "count": len(d1_placements),
                        "lagna_sign": person_row.get("birth_lagna"),
                        "bodies": d1_placements
                    },
                    "D9_navamsha_chart": {
                        "count": len(d9_placements),
                        "bodies": d9_placements
                    }
                },
                "vimshottari_dasha_intervals": {
                    "total_intervals_count": len(dasha_intervals),
                    "granularity": "Pratyantardasha (PD) Level",
                    "intervals": dasha_intervals
                },
                "transit_ephemeris_timeline": transit_data,
                "server_timestamp": datetime.now().isoformat()
            }

            # 5. Persist into user_queries transaction table
            cur.execute("""
                INSERT INTO user_queries (
                    query_id, running_number, person_id, start_date, end_date, response_payload
                ) VALUES (%s, %s, %s, %s, %s, %s);
            """, (
                unique_response_id,
                running_num,
                person_id,
                norm_start,
                norm_end,
                json.dumps(response_payload)
            ))
            conn.commit()

            cur.close()
            conn.close()
            response_payload["persisted_in_database"] = {
                "table": "user_queries",
                "running_number_cycle": f"{running_num}/100",
                "status": "SAVED"
            }
            return response_payload

        except Exception as e:
            if conn:
                conn.rollback()
                conn.close()
            print(f"Error querying database: {e}")
            # Fall through to fallback engine

    # Fallback to structured dataset if PostgreSQL is not currently running
    print(f"Notice: PostgreSQL offline. Serving query from internal dataset for {person_id}...")
    return get_fallback_data(person_id, norm_start, norm_end)


def build_llm_markdown_prompt(payload: Dict[str, Any]) -> str:
    """
    Transforms the full unified response into Option B: High-Density Markdown
    specifically sanitized for LLM prompt ingestion.
    STRICT SANITIZATION:
      - Strips person_name, age, date_of_birth, place_of_birth
      - Strips Tamil dasha balance text and verbose prose
      - Condenses D1 & D9 natal charts into a unified matrix
      - Preserves every sequential PD interval and dual-relative transit positions
    """
    profile = payload.get("person_profile", {})
    ref_id = payload.get("person_id", "ANON_NATIVE")
    timeline = payload.get("requested_timeline", {})
    start_d = timeline.get("start_date", "")
    end_d = timeline.get("end_date", "")
    span_yrs = timeline.get("span_years", "")

    # Native Astrological Baseline (NO PII)
    lagna = profile.get("birth_lagna", "Dhanus (Sagittarius)")
    rashi = profile.get("birth_rashi", "Vrischigam (Scorpio)")
    star = profile.get("birth_star", "Anusham (Anuradha)")
    pada = profile.get("birth_star_pada", 2)
    start_lord = profile.get("starting_dasha_lord", "Saturn (Sani)")

    md_lines = []
    md_lines.append("# VEDIC ASTROLOGICAL REASONING MATRIX (ANONYMIZED)")
    md_lines.append(f"**Reference:** `{ref_id}` | **Analysis Window:** `{start_d}` to `{end_d}` ({span_yrs} years)")
    md_lines.append(f"**Lagna (Ascendant):** {lagna} | **Janma Rashi (Moon Sign):** {rashi} | **Birth Nakshatra:** {star} (Pada {pada}) | **Starting Dasha:** {start_lord}")
    md_lines.append("")

    # 1. Combined Natal Placements (D1 Rashi & D9 Navamsha)
    d1_list = payload.get("natal_placements", {}).get("D1_rashi_chart", {}).get("bodies", [])
    d9_list = payload.get("natal_placements", {}).get("D9_navamsha_chart", {}).get("bodies", [])
    d9_map = {b.get("body_name"): b for b in d9_list}

    md_lines.append("## 1. NATAL CHART PLACEMENTS (D1 Rashi & D9 Navamsha)")
    md_lines.append("| Graha | D1 Sign | D1 House (Lagna=1) | Sputa Degree | Nakshatra & Pada | Motion | D9 Sign | D9 House |")
    md_lines.append("| :--- | :--- | :---: | :---: | :--- | :---: | :--- | :---: |")

    for p in d1_list:
        b_name = p.get("body_name", "")
        d1_sign = p.get("rashi_name", "")
        d1_house = p.get("house_number", "")
        deg = p.get("degree_sputa", "-")
        nak = p.get("nakshatra_name", "")
        pada_val = p.get("pada")
        nak_pada = f"{nak} (P{pada_val})" if nak else "-"
        motion = "Retrograde" if p.get("is_retrograde") else "Direct"
        d9_match = d9_map.get(b_name, {})
        d9_sign = d9_match.get("rashi_name", "-")
        d9_house = d9_match.get("house_number", "-")
        md_lines.append(f"| {b_name} | {d1_sign} | {d1_house} | {deg} | {nak_pada} | {motion} | {d9_sign} | {d9_house} |")

    md_lines.append("")

    # 2. Vimshottari Dasha Intervals (MD > AD > PD)
    dashas = payload.get("vimshottari_dasha_intervals", {}).get("intervals", [])
    md_lines.append(f"## 2. ACTIVE VIMSHOTTARI DASHA TIMELINE ({len(dashas)} Sub-Intervals down to PD Level)")
    md_lines.append("| # | Period Interval | Mahadasha (MD) | Antardasha (AD) | Pratyantardasha (PD) | Duration |")
    md_lines.append("| -: | :--- | :--- | :--- | :--- | -: |")
    for d in dashas:
        seq = d.get("sequence_index", "")
        s = d.get("start_date", "")
        e = d.get("end_date", "")
        md = d.get("mahadasha_lord_md", "")
        ad = d.get("antardasha_lord_ad", "")
        pd = d.get("pratyantardasha_lord_pd", "")
        dur = f"{d.get('duration_days', '')}d" if d.get('duration_days') else "-"
        md_lines.append(f"| {seq} | {s} to {e} | {md} | {ad} | {pd} | {dur} |")

    md_lines.append("")

    # 3. Transit Gochara Snapshot
    transits = payload.get("transit_ephemeris_timeline", {})
    if transits:
        snap_start = transits.get("transit_snapshot_start", [])
        if snap_start:
            md_lines.append(f"## 3. GOCHARA (TRANSIT) SNAPSHOT (At Window Start: {start_d})")
            md_lines.append("| Graha | Transit Sign | House from Lagna (H_L) | House from Moon (H_M) | Sputa Degree | Nakshatra & Pada | Motion |")
            md_lines.append("| :--- | :--- | :---: | :---: | :---: | :--- | :---: |")
            for g in snap_start:
                g_name = g.get("graha_name", "")
                sign = g.get("transit_rashi_name", "")
                h_l = g.get("relative_to_natal_lagna", {}).get("house_number", "")
                h_m = g.get("relative_to_natal_rashi", {}).get("house_number", "")
                deg = g.get("degree_sputa", "-")
                chara = g.get("graha_pada_chara", {}).get("chara_summary", "-")
                motion = "Retrograde" if g.get("is_retrograde") else "Direct"
                md_lines.append(f"| {g_name} | {sign} | House {h_l} | House {h_m} | {deg} | {chara} | {motion} |")
            md_lines.append("")

        # 4. Major Ingresses & Sign Transitions
        ingresses = transits.get("major_transits_timeline", [])
        if ingresses:
            md_lines.append(f"## 4. MAJOR TRANSIT SIGN INGRESSES ACROSS TIMELINE ({len(ingresses)} Events)")
            md_lines.append("| Graha | Ingress Sign | From Lagna | From Moon | Active Period | Star Occupied |")
            md_lines.append("| :--- | :--- | :---: | :---: | :--- | :--- |")
            for ev in ingresses:
                g_name = ev.get("graha_name", "")
                sign = ev.get("transit_rashi_name", "")
                h_l = f"House {ev.get('house_from_natal_lagna', '')}"
                h_m = f"House {ev.get('house_from_natal_rashi', '')}"
                period = f"{ev.get('start_date', '')} to {ev.get('end_date', '')}"
                star_p = f"{ev.get('nakshatra_name', '')} (P{ev.get('pada', '')})"
                md_lines.append(f"| {g_name} | {sign} | {h_l} | {h_m} | {period} | {star_p} |")
            md_lines.append("")

    md_lines.append("---")
    md_lines.append("*(Astrological inference instructions: Analyze active MD/AD/PD lords, examine their natal house rulerships from Lagna and Janma Rashi, and cross-reference with contemporaneous Gochara transits.)*")

    return "\n".join(md_lines)


def query_transit_only(cfg: Dict[str, Any], person_id: str, start_date_str: str, end_date_str: str) -> Dict[str, Any]:
    """
    Dedicated Transit Ephemeris query for the 9 Grahas across the requested timeline.
    Calculates sidereal signs, minute sputa degrees, nakshatra & pada, retrograde,
    and relative houses from native's natal Lagna and Janma Rashi.
    """
    norm_start = normalize_date(start_date_str, default_to_end_of_month=False)
    norm_end = normalize_date(end_date_str, default_to_end_of_month=True)
    try:
        dt_start = datetime.strptime(norm_start, "%Y-%m-%d")
        dt_end = datetime.strptime(norm_end, "%Y-%m-%d")
    except Exception:
        dt_start = datetime.now()
        dt_end = dt_start

    natal_lagna = "Dhanus (Sagittarius)"
    natal_rashi = "Vrischigam (Scorpio)"

    conn = get_db_connection(cfg)
    if conn:
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT birth_lagna, birth_rashi FROM person_master WHERE person_id = %s;", (person_id,))
            row = cur.fetchone()
            if row:
                natal_lagna = row.get("birth_lagna") or natal_lagna
                natal_rashi = row.get("birth_rashi") or natal_rashi
            cur.close()
            conn.close()
        except Exception:
            if conn: conn.close()

    lagna_idx = parse_sign_to_index(natal_lagna, 9) if HAS_EPHEMERIS else 9
    rashi_idx = parse_sign_to_index(natal_rashi, 8) if HAS_EPHEMERIS else 8

    if HAS_EPHEMERIS:
        transit_result = generate_transit_timeline(dt_start, dt_end, lagna_idx, rashi_idx)
    else:
        transit_result = {"error": "Vedic ephemeris calculation module not available"}

    transit_result["person_id"] = person_id
    transit_result["server_timestamp"] = datetime.now().isoformat()
    return transit_result


# =============================================================================
# 5. HTTP REST API HANDLER
# =============================================================================

class HoroscopeApiHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        cfg = load_config()

        if parsed.path == "/api/health":
            conn = get_db_connection(cfg)
            db_status = "connected" if conn else "offline (fallback mode available)"
            if conn:
                conn.close()
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "status": "healthy",
                "service": "Vedic Astrology REST API (Natal + Transit)",
                "database_status": db_status,
                "ephemeris_engine": "active" if HAS_EPHEMERIS else "unavailable",
                "timestamp": datetime.now().isoformat()
            }, indent=2).encode())
            return

        elif parsed.path == "/api/persons":
            conn = get_db_connection(cfg)
            persons = []
            if conn:
                try:
                    ensure_tables_exist(conn)
                    cur = conn.cursor(cursor_factory=RealDictCursor)
                    cur.execute("""
                        SELECT person_id, person_name, date_of_birth, place_of_birth,
                               birth_lagna, birth_rashi, birth_star, birth_star_pada
                        FROM person_master
                        ORDER BY created_at ASC;
                    """)
                    for r in cur.fetchall():
                        if r.get("date_of_birth"):
                            r["date_of_birth"] = str(r["date_of_birth"])
                        persons.append(r)
                    cur.close()
                    conn.close()
                except Exception:
                    if conn: conn.close()
            self._set_headers(200)
            self.wfile.write(json.dumps({"persons": persons}).encode())
            return

        elif parsed.path.startswith("/api/llm/logs"):
            params = urllib.parse.parse_qs(parsed.query)
            limit = int(params.get("limit", [50])[0])
            logs = get_llm_prompt_logs_from_db(cfg, limit=limit)
            self._set_headers(200)
            self.wfile.write(json.dumps({"logs": logs}, indent=2).encode())
            return

        elif parsed.path == "/api/user-queries/recent":
            # Fetch recent queries from user_queries table
            conn = get_db_connection(cfg)
            if conn:
                try:
                    cur = conn.cursor(cursor_factory=RealDictCursor)
                    cur.execute("""
                        SELECT query_id, running_number, person_id, start_date, end_date, created_at
                        FROM user_queries
                        ORDER BY id DESC
                        LIMIT 20;
                    """)
                    rows = cur.fetchall()
                    for r in rows:
                        r["start_date"] = str(r["start_date"])
                        r["end_date"] = str(r["end_date"])
                        r["created_at"] = str(r["created_at"])
                    cur.close()
                    conn.close()
                    self._set_headers(200)
                    self.wfile.write(json.dumps({"recent_queries": rows}, indent=2).encode())
                    return
                except Exception as e:
                    if conn:
                        conn.close()
            # If DB offline
            self._set_headers(200)
            self.wfile.write(json.dumps({"recent_queries": [], "notice": "DB offline"}, indent=2).encode())
            return

        elif parsed.path.startswith("/api/horoscope/query"):
            # Complete unified ("one punch") Natal + Transit payload
            params = urllib.parse.parse_qs(parsed.query)
            person_id = params.get("person_id", ["001ME"])[0]
            start_date = params.get("start_date", ["1998-01-01"])[0]
            end_date = params.get("end_date", ["2020-01-31"])[0]
            format_opt = params.get("format", ["full"])[0].lower()
            is_markdown = format_opt in ["markdown", "llm_markdown"] or "markdown" in params

            result = query_horoscope_and_timeline(cfg, person_id, start_date, end_date)
            status = 200 if "error" not in result else 404

            if is_markdown and "error" not in result:
                md_text = build_llm_markdown_prompt(result)
                self._set_headers(200, content_type="text/markdown; charset=utf-8")
                self.wfile.write(md_text.encode("utf-8"))
                return

            self._set_headers(status)
            self.wfile.write(json.dumps(result, indent=2, ensure_ascii=False).encode())
            return

        elif parsed.path.startswith("/api/transit/query"):
            # Dedicated transit ephemeris query
            params = urllib.parse.parse_qs(parsed.query)
            person_id = params.get("person_id", ["001ME"])[0]
            start_date = params.get("start_date", ["1998-01-01"])[0]
            end_date = params.get("end_date", ["2020-01-31"])[0]

            result = query_transit_only(cfg, person_id, start_date, end_date)
            self._set_headers(200)
            self.wfile.write(json.dumps(result, indent=2, ensure_ascii=False).encode())
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        cfg = load_config()

        if parsed.path == "/api/horoscope/query":
            # Complete unified ("one punch") Natal + Transit payload
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            try:
                data = json.loads(body_bytes.decode()) if body_bytes else {}
            except Exception:
                data = {}

            person_id = data.get("person_id", "001ME")
            start_date = data.get("start_date", "1998-01-01")
            end_date = data.get("end_date", "2020-01-31")
            format_opt = (data.get("format") or "").lower()
            is_markdown = format_opt in ["markdown", "llm_markdown"] or data.get("markdown") is True

            result = query_horoscope_and_timeline(cfg, person_id, start_date, end_date)
            status = 200 if "error" not in result else 404

            if is_markdown and "error" not in result:
                md_text = build_llm_markdown_prompt(result)
                self._set_headers(200, content_type="text/markdown; charset=utf-8")
                self.wfile.write(md_text.encode("utf-8"))
                return

            self._set_headers(status)
            self.wfile.write(json.dumps(result, indent=2, ensure_ascii=False).encode())
            return

        elif parsed.path == "/api/transit/query":
            # Dedicated transit ephemeris query
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            try:
                data = json.loads(body_bytes.decode()) if body_bytes else {}
            except Exception:
                data = {}

            person_id = data.get("person_id", "001ME")
            start_date = data.get("start_date", "1998-01-01")
            end_date = data.get("end_date", "2020-01-31")

            result = query_transit_only(cfg, person_id, start_date, end_date)
            self._set_headers(200)
            self.wfile.write(json.dumps(result, indent=2, ensure_ascii=False).encode())
            return

        elif parsed.path == "/api/llm/gemini":
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            try:
                data = json.loads(body_bytes.decode()) if body_bytes else {}
            except Exception:
                data = {}

            prompt = data.get("prompt", "")
            api_key = os.environ.get("GEMINI_API_KEY", "")

            if not api_key:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": "GEMINI_API_KEY not configured"}).encode())
                return

            import urllib.request
            req_data = json.dumps({
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
            }).encode('utf-8')

            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={api_key}"
            req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"}, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    resp_json = json.loads(resp.read().decode('utf-8'))
                    text = resp_json.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    self._set_headers(200)
                    self.wfile.write(json.dumps({
                        "text": text,
                        "model": "gemini-3.8-flash",
                        "usageMetadata": resp_json.get("usageMetadata", {})
                    }).encode())
                    return
            except Exception as e:
                url2 = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={api_key}"
                req2 = urllib.request.Request(url2, data=req_data, headers={"Content-Type": "application/json"}, method="POST")
                try:
                    with urllib.request.urlopen(req2, timeout=15) as resp2:
                        resp_json2 = json.loads(resp2.read().decode('utf-8'))
                        text2 = resp_json2.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        self._set_headers(200)
                        self.wfile.write(json.dumps({
                            "text": text2,
                            "model": "gemini-3.1-flash-lite",
                            "usageMetadata": resp_json2.get("usageMetadata", {})
                        }).encode())
                        return
                except Exception as e2:
                    self._set_headers(500)
                    self.wfile.write(json.dumps({"error": str(e2)}).encode())
                    return

        elif parsed.path == "/api/llm/log":
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            try:
                data = json.loads(body_bytes.decode()) if body_bytes else {}
            except Exception:
                data = {}
            res = save_llm_prompt_log_to_db(cfg, data)
            status = 200 if res.get("success") else 500
            self._set_headers(status)
            self.wfile.write(json.dumps(res, indent=2).encode())
            return

        elif parsed.path == "/api/horoscope/save-person":
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            try:
                data = json.loads(body_bytes.decode()) if body_bytes else {}
            except Exception:
                data = {}
            res = save_person_to_db(cfg, data)
            self._set_headers(200)
            self.wfile.write(json.dumps(res, indent=2).encode())
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode())


# =============================================================================
# 6. SERVER RUNNER
# =============================================================================

def run_server(port: int = 5000):
    cfg = load_config()
    server_address = (cfg.get("api_host", "0.0.0.0"), port)
    HTTPServer.allow_reuse_address = True
    httpd = HTTPServer(server_address, HoroscopeApiHandler)
    print("=" * 75)
    print(f" 🚀 VEDIC ASTROLOGY REST API SERVER STARTED (NATAL + TRANSIT)")
    print("=" * 75)
    print(f" URL:                   http://localhost:{port}")
    print(f" Unified API (1-Punch): POST http://localhost:{port}/api/horoscope/query")
    print(f" Transit API (Gochara): POST http://localhost:{port}/api/transit/query")
    print(f" History:               http://localhost:{port}/api/user-queries/recent")
    print(f" PostgreSQL:            {cfg['user']}@{cfg['host']}:{cfg['port']}/{cfg['dbname']}")
    print(f" Audit Table:           user_queries (running_number cycle 1..100)")
    print(f" Ephemeris Engine:      Lahiri / Chitra Paksha (9 Grahas)")
    print("=" * 75)
    print("Press Ctrl+C to terminate.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping API server...")
        httpd.server_close()


if __name__ == "__main__":
    port = 5000
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port)
