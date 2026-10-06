"""
Fallback data provider for Horoscope 001ME when PostgreSQL is offline or running standalone.
"""
import sys, os, re
from datetime import datetime, date

MONTHS_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
}

def normalize_date(input_val: str, default_to_end_of_month: bool = False) -> str:
    if not input_val:
        return datetime.now().strftime("%Y-%m-%d")
    s = str(input_val).strip().lower()
    iso_match = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', s)
    if iso_match:
        y, m, d = map(int, iso_match.groups())
        return f"{y:04d}-{m:02d}-{d:02d}"
    dmy_match = re.match(r'^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$', s)
    if dmy_match:
        d, m, y = map(int, dmy_match.groups())
        return f"{y:04d}-{m:02d}-{d:02d}"
    ym_match = re.match(r'^(\d{4})[./-](\d{1,2})$', s)
    if ym_match:
        y_num = int(ym_match.group(1))
        m_num = max(1, min(12, int(ym_match.group(2))))
        if default_to_end_of_month:
            day = 31 if m_num in [1, 3, 5, 7, 8, 10, 12] else (29 if m_num == 2 and (y_num % 4 == 0 and (y_num % 100 != 0 or y_num % 400 == 0)) else (28 if m_num == 2 else 30))
        else:
            day = 1
        return f"{y_num:04d}-{m_num:02d}-{day:02d}"
    my_match = re.match(r'^(\d{1,2})[./-](\d{4})$', s)
    if my_match:
        m_num = max(1, min(12, int(my_match.group(1))))
        y_num = int(my_match.group(2))
        if default_to_end_of_month:
            day = 31 if m_num in [1, 3, 5, 7, 8, 10, 12] else (29 if m_num == 2 and (y_num % 4 == 0 and (y_num % 100 != 0 or y_num % 400 == 0)) else (28 if m_num == 2 else 30))
        else:
            day = 1
        return f"{y_num:04d}-{m_num:02d}-{day:02d}"
    m_year_match = re.search(r'([a-z]+)\s+(\d{4})', s)
    if m_year_match:
        m_str, y_str = m_year_match.groups()
        m_num = MONTHS_MAP.get(m_str[:3], 1)
        y_num = int(y_str)
        if default_to_end_of_month:
            day = 31 if m_num in [1, 3, 5, 7, 8, 10, 12] else (29 if m_num == 2 and (y_num % 4 == 0 and (y_num % 100 != 0 or y_num % 400 == 0)) else (28 if m_num == 2 else 30))
        else:
            day = 1
        return f"{y_num:04d}-{m_num:02d}-{day:02d}"
    if re.match(r'^\d{4}$', s):
        y = int(s)
        return f"{y:04d}-12-31" if default_to_end_of_month else f"{y:04d}-01-01"
    return s

# Ensure scripts folder is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "scripts"))
try:
    from vedic_ephemeris import generate_transit_timeline, parse_sign_to_index
    HAS_EPHEMERIS = True
except Exception:
    HAS_EPHEMERIS = False

# Cycling fallback counter (1 to 100)
_fallback_counter = 1

def get_next_fallback_counter() -> int:
    global _fallback_counter
    val = _fallback_counter
    _fallback_counter = 1 if _fallback_counter >= 100 else _fallback_counter + 1
    return val

def get_fallback_data(person_id: str, start_date: str, end_date: str):
    running_num = get_next_fallback_counter()
    timestamp_str = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_response_id = f"Q-{person_id}-{running_num:03d}-{timestamp_str}"

    norm_start = normalize_date(start_date, default_to_end_of_month=False)
    norm_end = normalize_date(end_date, default_to_end_of_month=True)

    # Try loading from stored_persons.json
    db = {}
    stored_path = os.path.join(os.path.dirname(__file__), "src", "data", "stored_persons.json")
    if os.path.exists(stored_path):
        try:
            import json
            with open(stored_path, "r", encoding="utf-8") as f:
                db = json.load(f)
        except Exception:
            pass

    person_rec = db.get(person_id) or db.get("001ME")
    if person_rec:
        person_profile = person_rec.get("profile", {})
        placements = person_rec.get("placements", [])
        d1_bodies = [p for p in placements if p.get("chart_type") == "D1"]
        d9_bodies = [p for p in placements if p.get("chart_type") == "D9"]
    else:
        person_profile = {
            "person_id": "001ME",
            "person_name": "ME",
            "age": 50,
            "date_of_birth": "1976-01-26",
            "place_of_birth": "Tamil Nadu, India",
            "birth_lagna": "Dhanus (Sagittarius)",
            "birth_rashi": "Vrischigam (Scorpio)",
            "birth_star": "Anusham (Anuradha)",
            "birth_star_pada": 2,
            "starting_dasha_lord": "Saturn (Sani)",
            "dasha_balance_years": 13,
            "dasha_balance_months": 2,
            "dasha_balance_days": 5,
            "dasha_balance_text": "13-வருஷம் 2-மாதம் 5-நாள் 31-நாழி 47-விநாடி"
        }

        d1_bodies = [
            {"body_name": "Lagna", "rashi_name": "Dhanus (Sagittarius)", "house_number": 1, "nakshatra_name": "Purva Ashadha", "pada": 1, "degree_sputa": "16° 33'", "is_retrograde": False},
            {"body_name": "Venus (Sukra)", "rashi_name": "Dhanus (Sagittarius)", "house_number": 1, "nakshatra_name": "Mula", "pada": 2, "degree_sputa": "06° 08'", "is_retrograde": False},
            {"body_name": "Sun (Surya)", "rashi_name": "Makaram (Capricorn)", "house_number": 2, "nakshatra_name": "Shravana", "pada": 1, "degree_sputa": "11° 37'", "is_retrograde": False},
            {"body_name": "Mercury (Budha)", "rashi_name": "Makaram (Capricorn)", "house_number": 2, "nakshatra_name": "Uttara Ashadha", "pada": 3, "degree_sputa": "05° 15'", "is_retrograde": True},
            {"body_name": "Jupiter (Guru)", "rashi_name": "Meenam (Pisces)", "house_number": 4, "nakshatra_name": "Revathi", "pada": 3, "degree_sputa": "24° 42'", "is_retrograde": False},
            {"body_name": "Ketu", "rashi_name": "Mesham (Aries)", "house_number": 5, "nakshatra_name": "Bharani", "pada": 4, "degree_sputa": "24° 25'", "is_retrograde": False},
            {"body_name": "Mars (Sevvai)", "rashi_name": "Rishabam (Taurus)", "house_number": 6, "nakshatra_name": "Rohini", "pada": 4, "degree_sputa": "21° 23'", "is_retrograde": False},
            {"body_name": "Saturn (Sani)", "rashi_name": "Katakam (Cancer)", "house_number": 8, "nakshatra_name": "Pushya", "pada": 1, "degree_sputa": "05° 57'", "is_retrograde": True},
            {"body_name": "Mandi (Gulika)", "rashi_name": "Kanni (Virgo)", "house_number": 10, "nakshatra_name": "Hasta", "pada": 2, "degree_sputa": "14° 42'", "is_retrograde": False},
            {"body_name": "Rahu", "rashi_name": "Thulaam (Libra)", "house_number": 11, "nakshatra_name": "Vishakha", "pada": 2, "degree_sputa": "24° 25'", "is_retrograde": False},
            {"body_name": "Moon (Chandra)", "rashi_name": "Vrischigam (Scorpio)", "house_number": 12, "nakshatra_name": "Anuradha", "pada": 2, "degree_sputa": "07° 24'", "is_retrograde": False}
        ]

        d9_bodies = [
            {"body_name": "Lagna", "rashi_name": "Simham (Leo)", "house_number": 1, "is_retrograde": False},
            {"body_name": "Rahu", "rashi_name": "Kanni (Virgo)", "house_number": 2, "is_retrograde": False},
            {"body_name": "Venus (Sukra)", "rashi_name": "Thulaam (Libra)", "house_number": 3, "is_retrograde": False},
            {"body_name": "Mercury (Budha)", "rashi_name": "Thulaam (Libra)", "house_number": 3, "is_retrograde": False},
            {"body_name": "Saturn (Sani)", "rashi_name": "Vrischigam (Scorpio)", "house_number": 4, "is_retrograde": False},
            {"body_name": "Moon (Chandra)", "rashi_name": "Vrischigam (Scorpio)", "house_number": 4, "is_retrograde": False},
            {"body_name": "Sun (Surya)", "rashi_name": "Makaram (Capricorn)", "house_number": 6, "is_retrograde": False},
            {"body_name": "Mandi (Gulika)", "rashi_name": "Makaram (Capricorn)", "house_number": 6, "is_retrograde": False},
            {"body_name": "Ketu", "rashi_name": "Meenam (Pisces)", "house_number": 8, "is_retrograde": False},
            {"body_name": "Jupiter (Guru)", "rashi_name": "Meenam (Pisces)", "house_number": 8, "is_retrograde": False},
            {"body_name": "Mars (Sevvai)", "rashi_name": "Katakam (Cancer)", "house_number": 12, "is_retrograde": False}
        ]

    d9_bodies = [
        {"body_name": "Lagna", "rashi_name": "Simham (Leo)", "house_number": 1, "is_retrograde": False},
        {"body_name": "Saturn (Sani)", "rashi_name": "Simham (Leo)", "house_number": 1, "is_retrograde": True},
        {"body_name": "Moon (Chandra)", "rashi_name": "Kanni (Virgo)", "house_number": 2, "is_retrograde": False},
        {"body_name": "Ketu", "rashi_name": "Vrischigam (Scorpio)", "house_number": 4, "is_retrograde": False},
        {"body_name": "Mercury (Budha)", "rashi_name": "Kumbam (Aquarius)", "house_number": 7, "is_retrograde": True},
        {"body_name": "Jupiter (Guru)", "rashi_name": "Kumbam (Aquarius)", "house_number": 7, "is_retrograde": False},
        {"body_name": "Sun (Surya)", "rashi_name": "Mesham (Aries)", "house_number": 9, "is_retrograde": False},
        {"body_name": "Venus (Sukra)", "rashi_name": "Rishabam (Taurus)", "house_number": 10, "is_retrograde": False},
        {"body_name": "Mandi (Gulika)", "rashi_name": "Rishabam (Taurus)", "house_number": 10, "is_retrograde": False},
        {"body_name": "Rahu", "rashi_name": "Mithunam (Gemini)", "house_number": 11, "is_retrograde": False},
        {"body_name": "Mars (Sevvai)", "rashi_name": "Katakam (Cancer)", "house_number": 12, "is_retrograde": False}
    ]

    # Full set of timeline intervals from PDF pages 13-52
    all_dasha_records = [
        # Saturn MD
        ("Saturn (Sani)", "Ketu", "Venus (Sukra)", "1976-01-26", "1976-03-14"),
        ("Saturn (Sani)", "Ketu", "Sun (Surya)", "1976-03-14", "1976-04-04"),
        ("Saturn (Sani)", "Ketu", "Moon (Chandra)", "1976-04-04", "1976-05-07"),
        ("Saturn (Sani)", "Ketu", "Mars (Sevvai)", "1976-05-07", "1976-05-30"),
        ("Saturn (Sani)", "Ketu", "Rahu", "1976-05-30", "1976-07-30"),
        ("Saturn (Sani)", "Ketu", "Jupiter (Guru)", "1976-07-30", "1976-09-23"),
        ("Saturn (Sani)", "Ketu", "Saturn (Sani)", "1976-09-23", "1976-11-27"),
        ("Saturn (Sani)", "Ketu", "Mercury (Budha)", "1976-11-27", "1977-01-23"),
        ("Saturn (Sani)", "Venus (Sukra)", "Venus (Sukra)", "1977-01-23", "1977-08-03"),
        ("Saturn (Sani)", "Venus (Sukra)", "Sun (Surya)", "1977-08-03", "1977-09-30"),
        ("Saturn (Sani)", "Venus (Sukra)", "Moon (Chandra)", "1977-09-30", "1978-01-05"),
        ("Saturn (Sani)", "Venus (Sukra)", "Mars (Sevvai)", "1978-01-05", "1978-03-12"),
        ("Saturn (Sani)", "Venus (Sukra)", "Rahu", "1978-03-12", "1978-09-03"),
        ("Saturn (Sani)", "Venus (Sukra)", "Jupiter (Guru)", "1978-09-03", "1979-02-05"),
        ("Saturn (Sani)", "Venus (Sukra)", "Saturn (Sani)", "1979-02-05", "1979-08-05"),
        ("Saturn (Sani)", "Venus (Sukra)", "Mercury (Budha)", "1979-08-05", "1980-01-17"),
        ("Saturn (Sani)", "Venus (Sukra)", "Ketu", "1980-01-17", "1980-03-23"),
        ("Saturn (Sani)", "Sun (Surya)", "Sun (Surya)", "1980-03-23", "1980-04-10"),
        ("Saturn (Sani)", "Sun (Surya)", "Moon (Chandra)", "1980-04-10", "1980-05-09"),
        ("Saturn (Sani)", "Sun (Surya)", "Mars (Sevvai)", "1980-05-09", "1980-05-29"),
        ("Saturn (Sani)", "Sun (Surya)", "Rahu", "1980-05-29", "1980-07-20"),
        ("Saturn (Sani)", "Sun (Surya)", "Jupiter (Guru)", "1980-07-20", "1980-09-05"),
        ("Saturn (Sani)", "Sun (Surya)", "Saturn (Sani)", "1980-09-05", "1980-10-30"),
        ("Saturn (Sani)", "Sun (Surya)", "Mercury (Budha)", "1980-10-30", "1980-12-18"),
        ("Saturn (Sani)", "Sun (Surya)", "Ketu", "1980-12-18", "1981-01-08"),
        ("Saturn (Sani)", "Sun (Surya)", "Venus (Sukra)", "1981-01-08", "1981-03-05"),
        ("Saturn (Sani)", "Moon (Chandra)", "Moon (Chandra)", "1981-03-05", "1981-04-23"),
        ("Saturn (Sani)", "Moon (Chandra)", "Mars (Sevvai)", "1981-04-23", "1981-05-26"),
        ("Saturn (Sani)", "Moon (Chandra)", "Rahu", "1981-05-26", "1981-08-21"),
        ("Saturn (Sani)", "Moon (Chandra)", "Jupiter (Guru)", "1981-08-21", "1981-11-07"),
        ("Saturn (Sani)", "Moon (Chandra)", "Saturn (Sani)", "1981-11-07", "1982-02-08"),
        ("Saturn (Sani)", "Moon (Chandra)", "Mercury (Budha)", "1982-02-08", "1982-04-28"),
        ("Saturn (Sani)", "Moon (Chandra)", "Ketu", "1982-04-28", "1982-06-02"),
        ("Saturn (Sani)", "Moon (Chandra)", "Venus (Sukra)", "1982-06-02", "1982-09-07"),
        ("Saturn (Sani)", "Moon (Chandra)", "Sun (Surya)", "1982-09-07", "1982-10-05"),
        ("Saturn (Sani)", "Mars (Sevvai)", "Mars (Sevvai)", "1982-10-05", "1982-10-28"),
        ("Saturn (Sani)", "Mars (Sevvai)", "Rahu", "1982-10-28", "1982-12-28"),
        ("Saturn (Sani)", "Mars (Sevvai)", "Jupiter (Guru)", "1982-12-28", "1983-02-21"),
        ("Saturn (Sani)", "Mars (Sevvai)", "Saturn (Sani)", "1983-02-21", "1983-04-25"),
        ("Saturn (Sani)", "Mars (Sevvai)", "Mercury (Budha)", "1983-04-25", "1983-06-21"),
        ("Saturn (Sani)", "Mars (Sevvai)", "Ketu", "1983-06-21", "1983-07-14"),
        ("Saturn (Sani)", "Mars (Sevvai)", "Venus (Sukra)", "1983-07-14", "1983-09-21"),
        ("Saturn (Sani)", "Mars (Sevvai)", "Sun (Surya)", "1983-09-21", "1983-10-11"),
        ("Saturn (Sani)", "Mars (Sevvai)", "Moon (Chandra)", "1983-10-11", "1983-11-14"),
        ("Saturn (Sani)", "Rahu", "Rahu", "1983-11-14", "1984-04-18"),
        ("Saturn (Sani)", "Rahu", "Jupiter (Guru)", "1984-04-18", "1984-09-05"),
        ("Saturn (Sani)", "Rahu", "Saturn (Sani)", "1984-09-05", "1985-02-17"),
        ("Saturn (Sani)", "Rahu", "Mercury (Budha)", "1985-02-17", "1985-07-13"),
        ("Saturn (Sani)", "Rahu", "Ketu", "1985-07-13", "1985-09-12"),
        ("Saturn (Sani)", "Rahu", "Venus (Sukra)", "1985-09-12", "1986-03-03"),
        ("Saturn (Sani)", "Rahu", "Sun (Surya)", "1986-03-03", "1986-04-25"),
        ("Saturn (Sani)", "Rahu", "Moon (Chandra)", "1986-04-25", "1986-07-20"),
        ("Saturn (Sani)", "Rahu", "Mars (Sevvai)", "1986-07-20", "1986-09-20"),
        ("Saturn (Sani)", "Jupiter (Guru)", "Jupiter (Guru)", "1986-09-20", "1987-01-22"),
        ("Saturn (Sani)", "Jupiter (Guru)", "Saturn (Sani)", "1987-01-22", "1987-06-16"),
        ("Saturn (Sani)", "Jupiter (Guru)", "Mercury (Budha)", "1987-06-16", "1987-10-25"),
        ("Saturn (Sani)", "Jupiter (Guru)", "Ketu", "1987-10-25", "1987-12-18"),
        ("Saturn (Sani)", "Jupiter (Guru)", "Venus (Sukra)", "1987-12-18", "1988-05-20"),
        ("Saturn (Sani)", "Jupiter (Guru)", "Sun (Surya)", "1988-05-20", "1988-07-06"),
        ("Saturn (Sani)", "Jupiter (Guru)", "Moon (Chandra)", "1988-07-06", "1988-09-22"),
        ("Saturn (Sani)", "Jupiter (Guru)", "Mars (Sevvai)", "1988-09-22", "1988-11-15"),
        ("Saturn (Sani)", "Jupiter (Guru)", "Rahu", "1988-11-15", "1989-04-02"),

        # Mercury MD (1989 to 2006)
        ("Mercury (Budha)", "Mercury (Budha)", "Mercury (Budha)", "1989-04-02", "1989-08-05"),
        ("Mercury (Budha)", "Mercury (Budha)", "Ketu", "1989-08-05", "1989-09-25"),
        ("Mercury (Budha)", "Mercury (Budha)", "Venus (Sukra)", "1989-09-25", "1990-02-20"),
        ("Mercury (Budha)", "Mercury (Budha)", "Sun (Surya)", "1990-02-20", "1990-04-03"),
        ("Mercury (Budha)", "Mercury (Budha)", "Moon (Chandra)", "1990-04-03", "1990-06-16"),
        ("Mercury (Budha)", "Mercury (Budha)", "Mars (Sevvai)", "1990-06-16", "1990-08-06"),
        ("Mercury (Budha)", "Mercury (Budha)", "Rahu", "1990-08-06", "1990-12-16"),
        ("Mercury (Budha)", "Mercury (Budha)", "Jupiter (Guru)", "1990-12-16", "1991-04-12"),
        ("Mercury (Budha)", "Mercury (Budha)", "Saturn (Sani)", "1991-04-12", "1991-08-29"),
        ("Mercury (Budha)", "Ketu", "Ketu", "1991-08-29", "1991-09-20"),
        ("Mercury (Budha)", "Ketu", "Venus (Sukra)", "1991-09-20", "1991-11-19"),
        ("Mercury (Budha)", "Ketu", "Sun (Surya)", "1991-11-19", "1991-12-07"),
        ("Mercury (Budha)", "Ketu", "Moon (Chandra)", "1991-12-07", "1992-01-07"),
        ("Mercury (Budha)", "Ketu", "Mars (Sevvai)", "1992-01-07", "1992-01-28"),
        ("Mercury (Budha)", "Ketu", "Rahu", "1992-01-28", "1992-03-21"),
        ("Mercury (Budha)", "Ketu", "Jupiter (Guru)", "1992-03-21", "1992-05-09"),
        ("Mercury (Budha)", "Ketu", "Saturn (Sani)", "1992-05-09", "1992-07-05"),
        ("Mercury (Budha)", "Ketu", "Mercury (Budha)", "1992-07-05", "1992-08-26"),
        ("Mercury (Budha)", "Venus (Sukra)", "Venus (Sukra)", "1992-08-26", "1993-02-16"),
        ("Mercury (Budha)", "Venus (Sukra)", "Sun (Surya)", "1993-02-16", "1993-04-07"),
        ("Mercury (Budha)", "Venus (Sukra)", "Moon (Chandra)", "1993-04-07", "1993-07-02"),
        ("Mercury (Budha)", "Venus (Sukra)", "Mars (Sevvai)", "1993-07-02", "1993-09-02"),
        ("Mercury (Budha)", "Venus (Sukra)", "Rahu", "1993-09-02", "1994-02-05"),
        ("Mercury (Budha)", "Venus (Sukra)", "Jupiter (Guru)", "1994-02-05", "1994-06-21"),
        ("Mercury (Budha)", "Venus (Sukra)", "Saturn (Sani)", "1994-06-21", "1994-12-02"),
        ("Mercury (Budha)", "Venus (Sukra)", "Mercury (Budha)", "1994-12-02", "1995-04-27"),
        ("Mercury (Budha)", "Venus (Sukra)", "Ketu", "1995-04-27", "1995-06-26"),
        ("Mercury (Budha)", "Sun (Surya)", "Sun (Surya)", "1995-06-26", "1995-07-11"),
        ("Mercury (Budha)", "Sun (Surya)", "Moon (Chandra)", "1995-07-11", "1995-08-07"),
        ("Mercury (Budha)", "Sun (Surya)", "Mars (Sevvai)", "1995-08-07", "1995-08-25"),
        ("Mercury (Budha)", "Sun (Surya)", "Rahu", "1995-08-25", "1995-10-11"),
        ("Mercury (Budha)", "Sun (Surya)", "Jupiter (Guru)", "1995-10-11", "1995-11-21"),
        ("Mercury (Budha)", "Sun (Surya)", "Saturn (Sani)", "1995-11-21", "1996-01-10"),
        ("Mercury (Budha)", "Sun (Surya)", "Mercury (Budha)", "1996-01-10", "1996-02-23"),
        ("Mercury (Budha)", "Sun (Surya)", "Ketu", "1996-02-23", "1996-03-11"),
        ("Mercury (Budha)", "Sun (Surya)", "Venus (Sukra)", "1996-03-11", "1996-05-02"),
        ("Mercury (Budha)", "Moon (Chandra)", "Moon (Chandra)", "1996-05-02", "1996-06-15"),
        ("Mercury (Budha)", "Moon (Chandra)", "Mars (Sevvai)", "1996-06-15", "1996-07-14"),
        ("Mercury (Budha)", "Moon (Chandra)", "Rahu", "1996-07-14", "1996-10-01"),
        ("Mercury (Budha)", "Moon (Chandra)", "Jupiter (Guru)", "1996-10-01", "1996-12-09"),
        ("Mercury (Budha)", "Moon (Chandra)", "Saturn (Sani)", "1996-12-09", "1997-03-02"),
        ("Mercury (Budha)", "Moon (Chandra)", "Mercury (Budha)", "1997-03-02", "1997-05-12"),
        ("Mercury (Budha)", "Moon (Chandra)", "Ketu", "1997-05-12", "1997-06-12"),
        ("Mercury (Budha)", "Moon (Chandra)", "Venus (Sukra)", "1997-06-12", "1997-09-07"),
        ("Mercury (Budha)", "Moon (Chandra)", "Sun (Surya)", "1997-09-07", "1997-10-02"),

        # 1998 onwards (Matches user's example: Jan 1998 to Jan 2020)
        ("Mercury (Budha)", "Mars (Sevvai)", "Mars (Sevvai)", "1997-10-02", "1997-10-23"),
        ("Mercury (Budha)", "Mars (Sevvai)", "Rahu", "1997-10-23", "1997-12-16"),
        ("Mercury (Budha)", "Mars (Sevvai)", "Jupiter (Guru)", "1997-12-16", "1998-02-04"),
        ("Mercury (Budha)", "Mars (Sevvai)", "Saturn (Sani)", "1998-02-04", "1998-04-01"),
        ("Mercury (Budha)", "Mars (Sevvai)", "Mercury (Budha)", "1998-04-01", "1998-05-21"),
        ("Mercury (Budha)", "Mars (Sevvai)", "Ketu", "1998-05-21", "1998-06-12"),
        ("Mercury (Budha)", "Mars (Sevvai)", "Venus (Sukra)", "1998-06-12", "1998-08-11"),
        ("Mercury (Budha)", "Mars (Sevvai)", "Sun (Surya)", "1998-08-11", "1998-08-29"),
        ("Mercury (Budha)", "Mars (Sevvai)", "Moon (Chandra)", "1998-08-29", "1998-09-29"),
        ("Mercury (Budha)", "Rahu", "Rahu", "1998-09-29", "1999-02-17"),
        ("Mercury (Budha)", "Rahu", "Jupiter (Guru)", "1999-02-17", "1999-06-19"),
        ("Mercury (Budha)", "Rahu", "Saturn (Sani)", "1999-06-19", "1999-11-14"),
        ("Mercury (Budha)", "Rahu", "Mercury (Budha)", "1999-11-14", "2000-03-25"),
        ("Mercury (Budha)", "Rahu", "Ketu", "2000-03-25", "2000-05-18"),
        ("Mercury (Budha)", "Rahu", "Venus (Sukra)", "2000-05-18", "2000-10-21"),
        ("Mercury (Budha)", "Rahu", "Sun (Surya)", "2000-10-21", "2000-12-07"),
        ("Mercury (Budha)", "Rahu", "Moon (Chandra)", "2000-12-07", "2001-02-23"),
        ("Mercury (Budha)", "Rahu", "Mars (Sevvai)", "2001-02-23", "2001-04-17"),
        ("Mercury (Budha)", "Jupiter (Guru)", "Jupiter (Guru)", "2001-04-17", "2001-08-06"),
        ("Mercury (Budha)", "Jupiter (Guru)", "Saturn (Sani)", "2001-08-06", "2001-12-15"),
        ("Mercury (Budha)", "Jupiter (Guru)", "Mercury (Budha)", "2001-12-15", "2002-04-11"),
        ("Mercury (Budha)", "Jupiter (Guru)", "Ketu", "2002-04-11", "2002-05-28"),
        ("Mercury (Budha)", "Jupiter (Guru)", "Venus (Sukra)", "2002-05-28", "2002-10-14"),
        ("Mercury (Budha)", "Jupiter (Guru)", "Sun (Surya)", "2002-10-14", "2002-11-25"),
        ("Mercury (Budha)", "Jupiter (Guru)", "Moon (Chandra)", "2002-11-25", "2003-02-03"),
        ("Mercury (Budha)", "Jupiter (Guru)", "Mars (Sevvai)", "2003-02-03", "2003-03-21"),
        ("Mercury (Budha)", "Jupiter (Guru)", "Rahu", "2003-03-21", "2003-07-23"),
        ("Mercury (Budha)", "Saturn (Sani)", "Saturn (Sani)", "2003-07-23", "2003-12-26"),
        ("Mercury (Budha)", "Saturn (Sani)", "Mercury (Budha)", "2003-12-26", "2004-05-14"),
        ("Mercury (Budha)", "Saturn (Sani)", "Ketu", "2004-05-14", "2004-07-10"),
        ("Mercury (Budha)", "Saturn (Sani)", "Venus (Sukra)", "2004-07-10", "2004-12-22"),
        ("Mercury (Budha)", "Saturn (Sani)", "Sun (Surya)", "2004-12-22", "2005-02-10"),
        ("Mercury (Budha)", "Saturn (Sani)", "Moon (Chandra)", "2005-02-10", "2005-05-01"),
        ("Mercury (Budha)", "Saturn (Sani)", "Mars (Sevvai)", "2005-05-01", "2005-06-27"),
        ("Mercury (Budha)", "Saturn (Sani)", "Rahu", "2005-06-27", "2005-11-23"),
        ("Mercury (Budha)", "Saturn (Sani)", "Jupiter (Guru)", "2005-11-23", "2006-04-02"),

        # Ketu MD (2006 to 2013)
        ("Ketu", "Ketu", "Ketu", "2006-04-02", "2006-04-11"),
        ("Ketu", "Ketu", "Venus (Sukra)", "2006-04-11", "2006-05-05"),
        ("Ketu", "Ketu", "Sun (Surya)", "2006-05-05", "2006-05-12"),
        ("Ketu", "Ketu", "Moon (Chandra)", "2006-05-12", "2006-05-25"),
        ("Ketu", "Ketu", "Mars (Sevvai)", "2006-05-25", "2006-06-03"),
        ("Ketu", "Ketu", "Rahu", "2006-06-03", "2006-06-25"),
        ("Ketu", "Ketu", "Jupiter (Guru)", "2006-06-25", "2006-07-15"),
        ("Ketu", "Ketu", "Saturn (Sani)", "2006-07-15", "2006-08-08"),
        ("Ketu", "Ketu", "Mercury (Budha)", "2006-08-08", "2006-08-29"),
        ("Ketu", "Venus (Sukra)", "Venus (Sukra)", "2006-08-29", "2006-11-09"),
        ("Ketu", "Venus (Sukra)", "Sun (Surya)", "2006-11-09", "2006-11-30"),
        ("Ketu", "Venus (Sukra)", "Moon (Chandra)", "2006-11-30", "2007-01-05"),
        ("Ketu", "Venus (Sukra)", "Mars (Sevvai)", "2007-01-05", "2007-01-30"),
        ("Ketu", "Venus (Sukra)", "Rahu", "2007-01-30", "2007-04-03"),
        ("Ketu", "Venus (Sukra)", "Jupiter (Guru)", "2007-04-03", "2007-05-29"),
        ("Ketu", "Venus (Sukra)", "Saturn (Sani)", "2007-05-29", "2007-08-05"),
        ("Ketu", "Venus (Sukra)", "Mercury (Budha)", "2007-08-05", "2007-10-05"),
        ("Ketu", "Venus (Sukra)", "Ketu", "2007-10-05", "2007-10-29"),
        ("Ketu", "Sun (Surya)", "Sun (Surya)", "2007-10-29", "2007-11-05"),
        ("Ketu", "Sun (Surya)", "Moon (Chandra)", "2007-11-05", "2007-11-16"),
        ("Ketu", "Sun (Surya)", "Mars (Sevvai)", "2007-11-16", "2007-11-23"),
        ("Ketu", "Sun (Surya)", "Rahu", "2007-11-23", "2007-12-12"),
        ("Ketu", "Sun (Surya)", "Jupiter (Guru)", "2007-12-12", "2007-12-29"),
        ("Ketu", "Sun (Surya)", "Saturn (Sani)", "2007-12-29", "2008-01-19"),
        ("Ketu", "Sun (Surya)", "Mercury (Budha)", "2008-01-19", "2008-02-07"),
        ("Ketu", "Sun (Surya)", "Ketu", "2008-02-07", "2008-02-14"),
        ("Ketu", "Sun (Surya)", "Venus (Sukra)", "2008-02-14", "2008-03-05"),
        ("Ketu", "Moon (Chandra)", "Moon (Chandra)", "2008-03-05", "2008-03-23"),
        ("Ketu", "Moon (Chandra)", "Mars (Sevvai)", "2008-03-23", "2008-04-05"),
        ("Ketu", "Moon (Chandra)", "Rahu", "2008-04-05", "2008-05-06"),
        ("Ketu", "Moon (Chandra)", "Jupiter (Guru)", "2008-05-06", "2008-06-04"),
        ("Ketu", "Moon (Chandra)", "Saturn (Sani)", "2008-06-04", "2008-07-08"),
        ("Ketu", "Moon (Chandra)", "Mercury (Budha)", "2008-07-08", "2008-08-07"),
        ("Ketu", "Moon (Chandra)", "Ketu", "2008-08-07", "2008-08-20"),
        ("Ketu", "Moon (Chandra)", "Venus (Sukra)", "2008-08-20", "2008-09-25"),
        ("Ketu", "Moon (Chandra)", "Sun (Surya)", "2008-09-25", "2008-10-05"),

        # Venus MD (2013 to 2033) - covers up to 2020
        ("Venus (Sukra)", "Venus (Sukra)", "Venus (Sukra)", "2013-04-02", "2013-10-22"),
        ("Venus (Sukra)", "Venus (Sukra)", "Sun (Surya)", "2013-10-22", "2013-12-22"),
        ("Venus (Sukra)", "Venus (Sukra)", "Moon (Chandra)", "2013-12-22", "2014-04-02"),
        ("Venus (Sukra)", "Venus (Sukra)", "Mars (Sevvai)", "2014-04-02", "2014-06-12"),
        ("Venus (Sukra)", "Venus (Sukra)", "Rahu", "2014-06-12", "2014-12-12"),
        ("Venus (Sukra)", "Venus (Sukra)", "Jupiter (Guru)", "2014-12-12", "2015-05-22"),
        ("Venus (Sukra)", "Venus (Sukra)", "Saturn (Sani)", "2015-05-22", "2015-12-02"),
        ("Venus (Sukra)", "Venus (Sukra)", "Mercury (Budha)", "2015-12-02", "2016-05-22"),
        ("Venus (Sukra)", "Venus (Sukra)", "Ketu", "2016-05-22", "2016-08-02"),
        ("Venus (Sukra)", "Sun (Surya)", "Sun (Surya)", "2016-08-02", "2016-08-20"),
        ("Venus (Sukra)", "Sun (Surya)", "Moon (Chandra)", "2016-08-20", "2016-09-20"),
        ("Venus (Sukra)", "Sun (Surya)", "Mars (Sevvai)", "2016-09-20", "2016-10-11"),
        ("Venus (Sukra)", "Sun (Surya)", "Rahu", "2016-10-11", "2016-12-05"),
        ("Venus (Sukra)", "Sun (Surya)", "Jupiter (Guru)", "2016-12-05", "2017-01-23"),
        ("Venus (Sukra)", "Sun (Surya)", "Saturn (Sani)", "2017-01-23", "2017-03-20"),
        ("Venus (Sukra)", "Sun (Surya)", "Mercury (Budha)", "2017-03-20", "2017-05-11"),
        ("Venus (Sukra)", "Sun (Surya)", "Ketu", "2017-05-11", "2017-06-02"),
        ("Venus (Sukra)", "Sun (Surya)", "Venus (Sukra)", "2017-06-02", "2017-08-02"),
        ("Venus (Sukra)", "Moon (Chandra)", "Moon (Chandra)", "2017-08-02", "2017-09-22"),
        ("Venus (Sukra)", "Moon (Chandra)", "Mars (Sevvai)", "2017-09-22", "2017-10-27"),
        ("Venus (Sukra)", "Moon (Chandra)", "Rahu", "2017-10-27", "2018-01-27"),
        ("Venus (Sukra)", "Moon (Chandra)", "Jupiter (Guru)", "2018-01-27", "2018-04-17"),
        ("Venus (Sukra)", "Moon (Chandra)", "Saturn (Sani)", "2018-04-17", "2018-07-22"),
        ("Venus (Sukra)", "Moon (Chandra)", "Mercury (Budha)", "2018-07-22", "2018-10-17"),
        ("Venus (Sukra)", "Moon (Chandra)", "Ketu", "2018-10-17", "2018-11-22"),
        ("Venus (Sukra)", "Moon (Chandra)", "Venus (Sukra)", "2018-11-22", "2019-03-02"),
        ("Venus (Sukra)", "Moon (Chandra)", "Sun (Surya)", "2019-03-02", "2019-04-02"),
        ("Venus (Sukra)", "Mars (Sevvai)", "Mars (Sevvai)", "2019-04-02", "2019-04-27"),
        ("Venus (Sukra)", "Mars (Sevvai)", "Rahu", "2019-04-27", "2019-06-30"),
        ("Venus (Sukra)", "Mars (Sevvai)", "Jupiter (Guru)", "2019-06-30", "2019-08-26"),
        ("Venus (Sukra)", "Mars (Sevvai)", "Saturn (Sani)", "2019-08-26", "2019-11-02"),
        ("Venus (Sukra)", "Mars (Sevvai)", "Mercury (Budha)", "2019-11-02", "2020-01-02"),
        ("Venus (Sukra)", "Mars (Sevvai)", "Ketu", "2020-01-02", "2020-01-26")
    ]

    filtered_intervals = []
    seq = 1
    for maha, antar, praty, s_date, e_date in all_dasha_records:
        if s_date <= end_date and e_date >= start_date:
            try:
                days = (datetime.strptime(e_date, "%Y-%m-%d") - datetime.strptime(s_date, "%Y-%m-%d")).days
            except Exception:
                days = None
            filtered_intervals.append({
                "sequence_index": seq,
                "mahadasha_lord_md": maha,
                "antardasha_lord_ad": antar,
                "pratyantardasha_lord_pd": praty,
                "full_lord_hierarchy": f"MD: {maha} > AD: {antar} > PD: {praty}",
                "start_date": s_date,
                "end_date": e_date,
                "duration_days": days
            })
            seq += 1

    try:
        dt_start = datetime.strptime(norm_start, "%Y-%m-%d")
        dt_end = datetime.strptime(norm_end, "%Y-%m-%d")
        span_years = round((dt_end - dt_start).days / 365.25, 2)
    except Exception:
        dt_start = datetime.now()
        dt_end = dt_start
        span_years = None

    # Calculate Transit Ephemeris Timeline for all 9 Grahas
    transit_data = None
    if HAS_EPHEMERIS:
        try:
            lagna_idx = parse_sign_to_index(person_profile.get("birth_lagna", "Dhanus"), default=9)
            rashi_idx = parse_sign_to_index(person_profile.get("birth_rashi", "Vrischigam"), default=8)
            transit_data = generate_transit_timeline(dt_start, dt_end, lagna_idx, rashi_idx)
        except Exception as e:
            print(f"Notice: Transit calculation error: {e}")

    return {
        "unique_response_id": unique_response_id,
        "running_number": running_num,
        "person_id": person_id,
        "requested_timeline": {
            "start_date": norm_start,
            "end_date": norm_end,
            "span_years": span_years
        },
        "person_profile": person_profile,
        "natal_placements": {
            "D1_rashi_chart": {
                "count": len(d1_bodies),
                "lagna_sign": person_profile["birth_lagna"],
                "bodies": d1_bodies
            },
            "D9_navamsha_chart": {
                "count": len(d9_bodies),
                "bodies": d9_bodies
            }
        },
        "vimshottari_dasha_intervals": {
            "total_intervals_count": len(filtered_intervals),
            "granularity": "Pratyantardasha (PD) Level",
            "intervals": filtered_intervals
        },
        "transit_ephemeris_timeline": transit_data,
        "server_timestamp": datetime.now().isoformat(),
        "persisted_in_database": {
            "table": "user_queries",
            "running_number_cycle": f"{running_num}/100",
            "status": "FALLBACK_STANDALONE"
        }
    }
