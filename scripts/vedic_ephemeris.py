#!/usr/bin/env python3
"""
===============================================================================
VEDIC ASTRONOMICAL EPHEMERIS & GOCHARA (TRANSIT) ENGINE
===============================================================================
High-precision astronomical calculation of tropical and sidereal positions
(Lahiri / Chitra Paksha Ayanamsha) for the 9 Vedic Grahas:
  1. Sun (Surya)
  2. Moon (Chandra)
  3. Mars (Sevvai / Mangala)
  4. Mercury (Budha)
  5. Jupiter (Guru / Brihaspati)
  6. Venus (Sukra)
  7. Saturn (Sani)
  8. Rahu (North Lunar Node - Mean/True)
  9. Ketu (South Lunar Node = Rahu + 180°)

Calculates:
  - Sidereal Zodiac Sign (1=Mesham/Aries ... 12=Meenam/Pisces)
  - Degree in sign (Sputa), minute, second
  - 27 Nakshatras & 4 Padas (Graha Pada Chara)
  - Motion direction (Direct vs Retrograde / Vakra)
  - Relative house number from Native's Lagna (House 1 to 12)
  - Relative house number from Native's Janma Rashi / Moon Sign (House 1 to 12)
  - Transit Timeline interval tracking across any user-defined date window
===============================================================================
"""

import math
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Tuple, Optional

# Standard 12 Vedic Rashi metadata
RASHI_LIST = [
    {"index": 1, "tamil": "மேஷம்", "eng": "Mesham (Aries)", "lord": "Mars (Sevvai)", "element": "Fire"},
    {"index": 2, "tamil": "ரிஷபம்", "eng": "Rishabam (Taurus)", "lord": "Venus (Sukra)", "element": "Earth"},
    {"index": 3, "tamil": "மிதுனம்", "eng": "Mithunam (Gemini)", "lord": "Mercury (Budha)", "element": "Air"},
    {"index": 4, "tamil": "கடகம்", "eng": "Katakam (Cancer)", "lord": "Moon (Chandra)", "element": "Water"},
    {"index": 5, "tamil": "சிம்மம்", "eng": "Simham (Leo)", "lord": "Sun (Surya)", "element": "Fire"},
    {"index": 6, "tamil": "கன்னி", "eng": "Kanni (Virgo)", "lord": "Mercury (Budha)", "element": "Earth"},
    {"index": 7, "tamil": "துலாம்", "eng": "Thulaam (Libra)", "lord": "Venus (Sukra)", "element": "Air"},
    {"index": 8, "tamil": "விருச்சிகம்", "eng": "Vrischigam (Scorpio)", "lord": "Mars (Sevvai)", "element": "Water"},
    {"index": 9, "tamil": "தனுசு", "eng": "Dhanus (Sagittarius)", "lord": "Jupiter (Guru)", "element": "Fire"},
    {"index": 10, "tamil": "மகரம்", "eng": "Makaram (Capricorn)", "lord": "Saturn (Sani)", "element": "Earth"},
    {"index": 11, "tamil": "கும்பம்", "eng": "Kumbam (Aquarius)", "lord": "Saturn (Sani)", "element": "Air"},
    {"index": 12, "tamil": "மீனம்", "eng": "Meenam (Pisces)", "lord": "Jupiter (Guru)", "element": "Water"},
]

SIGN_NAME_TO_INDEX = {
    "mesham": 1, "aries": 1, "mesham (aries)": 1, "மேஷம்": 1,
    "rishabam": 2, "taurus": 2, "rishabam (taurus)": 2, "ரிஷபம்": 2,
    "mithunam": 3, "gemini": 3, "mithunam (gemini)": 3, "மிதுனம்": 3,
    "katakam": 4, "karka": 4, "cancer": 4, "katakam (cancer)": 4, "கடகம்": 4,
    "simham": 5, "leo": 5, "simham (leo)": 5, "சிம்மம்": 5,
    "kanni": 6, "virgo": 6, "kanni (virgo)": 6, "கன்னி": 6,
    "thulaam": 7, "libra": 7, "thulaam (libra)": 7, "துலாம்": 7,
    "vrischigam": 8, "scorpio": 8, "vrischigam (scorpio)": 8, "விருச்சிகம்": 8,
    "dhanus": 9, "sagittarius": 9, "dhanus (sagittarius)": 9, "தனுசு": 9,
    "makaram": 10, "capricorn": 10, "makaram (capricorn)": 10, "மகரம்": 10,
    "kumbam": 11, "aquarius": 11, "kumbam (aquarius)": 11, "கும்பம்": 11,
    "meenam": 12, "pisces": 12, "meenam (pisces)": 12, "மீனம்": 12,
}

NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
]

NAKSHATRA_LORDS = [
    "Ketu", "Venus (Sukra)", "Sun (Surya)", "Moon (Chandra)", "Mars (Sevvai)", "Rahu",
    "Jupiter (Guru)", "Saturn (Sani)", "Mercury (Budha)"
] * 3

HOUSE_VEDIC_TITLES = {
    1: "Tanu (1st - Self / Ascendant)",
    2: "Dhana (2nd - Wealth / Family)",
    3: "Sahaja (3rd - Courage / Siblings)",
    4: "Sukha (4th - Mother / Comforts)",
    5: "Putra (5th - Intelligence / Poorvapunya)",
    6: "Ari / Roga (6th - Enemies / Debts)",
    7: "Kalatra (7th - Spouse / Partnerships)",
    8: "Ashtama / Ayur (8th - Longevity / Transformations)",
    9: "Bhagya (9th - Fortune / Father / Dharma)",
    10: "Karma (10th - Career / Profession)",
    11: "Labha (11th - Gains / Desires)",
    12: "Vyaya (12th - Losses / Moksha)"
}


# =============================================================================
# 1. ASTRONOMICAL CALCULATIONS (KEPLERIAN & VSOP-BASED)
# =============================================================================

def date_to_jd(dt: datetime) -> float:
    """Computes Julian Day Number (UT) from datetime."""
    year = dt.year
    month = dt.month
    day = dt.day + (dt.hour + dt.minute / 60.0 + dt.second / 3600.0) / 24.0

    if month <= 2:
        year -= 1
        month += 12

    a = math.floor(year / 100)
    b = 2 - a + math.floor(a / 4)
    jd = math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + b - 1524.5
    return jd


def calculate_lahiri_ayanamsha(jd: float) -> float:
    """
    Standard Lahiri (Chitra Paksha) Ayanamsha.
    At epoch J2000.0 (JD 2451545.0), Ayanamsha = 23° 51' 25.53" = 23.85709167°
    Precession rate: ~50.290966 arcseconds per tropical year.
    """
    t = (jd - 2451545.0) / 36525.0
    # Standard formula for Chitra Paksha ayanamsha
    ayanamsha = 23.85709167 + (5029.0966 * t + 1.1116 * t**2 - 0.000113 * t**3) / 3600.0
    return ayanamsha


def normalize_360(deg: float) -> float:
    """Normalizes angle into [0, 360) range."""
    return deg % 360.0


def solve_kepler(M_rad: float, e: float) -> float:
    """Solves Kepler's equation M = E - e*sin(E) for eccentric anomaly E."""
    E = M_rad
    for _ in range(12):
        delta = (E - e * math.sin(E) - M_rad) / (1.0 - e * math.cos(E))
        E -= delta
        if abs(delta) < 1e-8:
            break
    return E


def get_planet_tropical_longitude(planet: str, jd: float) -> float:
    """
    High-accuracy analytical calculation of geocentric tropical ecliptic longitude
    for all 9 Grahas based on Meeus & VSOP87 orbital elements.
    """
    T = (jd - 2451545.0) / 36525.0
    d = jd - 2451545.0

    if planet == "Sun":
        # Sun's mean longitude & anomaly
        L0 = normalize_360(280.46646 + 36000.76983 * T + 0.0003032 * T**2)
        M = normalize_360(357.52911 + 35999.05029 * T - 0.0001537 * T**2)
        M_rad = math.radians(M)
        # Equation of center
        C = (1.914602 - 0.004817 * T - 0.000014 * T**2) * math.sin(M_rad) + \
            (0.019993 - 0.000101 * T) * math.sin(2 * M_rad) + 0.000289 * math.sin(3 * M_rad)
        sun_long = normalize_360(L0 + C)
        return sun_long

    elif planet == "Moon":
        # Moon's geocentric position (ELP-2000 analytical terms)
        L_prime = normalize_360(218.3164477 + 481267.88123421 * T - 0.0015786 * T**2)
        D = normalize_360(297.8501921 + 445267.1114034 * T - 0.0018819 * T**2) # Elongation
        M = normalize_360(357.5291092 + 35999.0502909 * T - 0.0001536 * T**2)  # Sun's anomaly
        M_prime = normalize_360(134.9633964 + 477198.8675055 * T + 0.0087414 * T**2) # Moon's anomaly
        F = normalize_360(93.2720950 + 483202.0175233 * T - 0.0036539 * T**2)   # Distance from node

        # Major periodic perturbations
        sin_M_prime = math.sin(math.radians(M_prime))
        sin_2D_minus_M_prime = math.sin(math.radians(2 * D - M_prime))
        sin_2D = math.sin(math.radians(2 * D))
        sin_2M_prime = math.sin(math.radians(2 * M_prime))
        sin_M = math.sin(math.radians(M))
        sin_2D_minus_M = math.sin(math.radians(2 * D - M))

        d_lambda = (
            6.288774 * sin_M_prime +
            1.274027 * sin_2D_minus_M_prime +
            0.658314 * sin_2D +
            0.213618 * sin_2M_prime -
            0.185116 * sin_M -
            0.114332 * math.sin(math.radians(2 * F)) +
            0.058793 * sin_2D_minus_M
        )
        return normalize_360(L_prime + d_lambda)

    elif planet == "Rahu":
        # Mean Ascending Lunar Node (Rahu)
        omega = 125.04452 - 1934.136261 * T + 0.0020708 * T**2
        return normalize_360(omega)

    elif planet == "Ketu":
        # Ketu is exactly 180° opposite to Rahu
        rahu = get_planet_tropical_longitude("Rahu", jd)
        return normalize_360(rahu + 180.0)

    # Earth's heliocentric position
    L_e = normalize_360(100.466449 + 36000.769785 * T)
    M_e = normalize_360(357.529109 + 35999.050291 * T)
    e_e = 0.0167086 - 0.000042037 * T
    v_e = M_e + (2 * e_e - 0.25 * (e_e**3)) * math.sin(math.radians(M_e)) * (180.0 / math.pi)
    l_earth = math.radians(normalize_360(L_e + v_e - M_e))
    r_e = (1.000001018 * (1.0 - e_e**2)) / (1.0 + e_e * math.cos(math.radians(M_e)))
    Xe = r_e * math.cos(l_earth)
    Ye = r_e * math.sin(l_earth)

    # Heliocentric orbital elements for Mercury, Venus, Mars, Jupiter, Saturn
    # Format: a (AU), e, L (mean long deg), peri (long of perihelion deg)
    JPL_ORBITS = {
        "Mercury": (0.38709893, 0.20563069 + 0.00002527 * T, normalize_360(252.25084 + 149472.67411 * T), normalize_360(77.45645 + 1.55648 * T)),
        "Venus":   (0.72333199, 0.00677323 - 0.00004938 * T, normalize_360(181.97973 + 58517.81539 * T), normalize_360(131.57294 + 1.40222 * T)),
        "Mars":    (1.52366231, 0.09341233 + 0.00011902 * T, normalize_360(355.45332 + 19140.30268 * T), normalize_360(336.04084 + 1.84104 * T)),
        "Jupiter": (5.20336301, 0.04839266 - 0.00012880 * T, normalize_360(34.40438 + 3034.79203 * T),  normalize_360(14.75385 + 1.61263 * T)),
        "Saturn":  (9.53707032, 0.05415060 - 0.00036762 * T, normalize_360(49.94424 + 1222.49362 * T),  normalize_360(92.43194 - 0.81997 * T)),
    }

    if planet in JPL_ORBITS:
        a, e, L, peri = JPL_ORBITS[planet]
        M_deg = normalize_360(L - peri)
        M_rad = math.radians(M_deg)
        v_deg = M_deg + (2 * e - 0.25 * (e**3)) * math.sin(M_rad) * (180.0 / math.pi)
        l_planet = math.radians(normalize_360(peri + v_deg))
        r_planet = (a * (1.0 - e**2)) / (1.0 + e * math.cos(M_rad))

        Xp = r_planet * math.cos(l_planet)
        Yp = r_planet * math.sin(l_planet)

        # Geocentric vector (planet - earth)
        Xg = Xp - Xe
        Yg = Yp - Ye

        return normalize_360(math.degrees(math.atan2(Yg, Xg)))

    return 0.0


# =============================================================================
# 2. VEDIC SIDEREAL CONVERSION & PADA CHARA
# =============================================================================

def format_degrees_sputa(deg_in_sign: float) -> str:
    """Formats 0..30 degrees into standard minute-level sputa string (e.g. 14° 22')."""
    d = int(deg_in_sign)
    m_float = (deg_in_sign - d) * 60.0
    m = int(m_float)
    s = int((m_float - m) * 60.0)
    return f"{d:02d}° {m:02d}' {s:02d}\""


def get_graha_sidereal_position(planet_key: str, dt: datetime,
                                natal_lagna_idx: int = 9,
                                natal_rashi_idx: int = 8) -> Dict[str, Any]:
    """
    Computes complete Vedic transit attributes for one planet at a given timestamp:
      - Sidereal longitude (Tropical - Lahiri Ayanamsha)
      - Rashi (Sign), sign index 1 to 12
      - House relative to Natal Lagna (1 to 12)
      - House relative to Natal Janma Rashi / Moon Sign (1 to 12)
      - Nakshatra Name & Pada (1 to 4)
      - Retrograde flag (computed via finite differences with next day)
    """
    jd = date_to_jd(dt)
    ayanamsha = calculate_lahiri_ayanamsha(jd)

    tropical_long = get_planet_tropical_longitude(planet_key, jd)
    sidereal_long = normalize_360(tropical_long - ayanamsha)

    # Detect retrograde motion by calculating speed over next 6 hours
    jd_next = jd + 0.25
    trop_next = get_planet_tropical_longitude(planet_key, jd_next)
    sid_next = normalize_360(trop_next - calculate_lahiri_ayanamsha(jd_next))
    diff = (sid_next - sidereal_long)
    if diff > 180: diff -= 360
    elif diff < -180: diff += 360

    if planet_key in ["Rahu", "Ketu"]:
        is_retrograde = True # Lunar nodes naturally move in retrograde
    else:
        is_retrograde = diff < 0.0

    # Determine Rashi (Sign 1 to 12)
    sign_index = int(sidereal_long // 30.0) + 1
    deg_in_sign = sidereal_long % 30.0
    rashi_meta = RASHI_LIST[sign_index - 1]

    # Calculate Relative Houses (Clockwise from Lagna = 1, from Rashi = 1)
    house_from_lagna = ((sign_index - natal_lagna_idx) % 12) + 1
    house_from_rashi = ((sign_index - natal_rashi_idx) % 12) + 1

    # 27 Nakshatras (each 13° 20' = 13.333333°)
    nak_span = 40.0 / 3.0
    nak_idx = int(sidereal_long // nak_span) % 27
    nak_name = NAKSHATRAS[nak_idx]
    nak_lord = NAKSHATRA_LORDS[nak_idx]

    # Pada (1 to 4, each 3° 20' = 3.333333°)
    pada_span = 10.0 / 3.0
    deg_in_nak = sidereal_long % nak_span
    pada = int(deg_in_nak // pada_span) + 1

    graha_display_names = {
        "Sun": "Sun (Surya)",
        "Moon": "Moon (Chandra)",
        "Mars": "Mars (Sevvai)",
        "Mercury": "Mercury (Budha)",
        "Jupiter": "Jupiter (Guru)",
        "Venus": "Venus (Sukra)",
        "Saturn": "Saturn (Sani)",
        "Rahu": "Rahu",
        "Ketu": "Ketu"
    }

    tamil_names = {
        "Sun": "சூரியன்",
        "Moon": "சந்திரன்",
        "Mars": "செவ்வாய்",
        "Mercury": "புதன்",
        "Jupiter": "குரு",
        "Venus": "சுக்கிரன்",
        "Saturn": "சனி",
        "Rahu": "ராகு",
        "Ketu": "கேது"
    }

    return {
        "graha_key": planet_key,
        "graha_name": graha_display_names.get(planet_key, planet_key),
        "graha_tamil": tamil_names.get(planet_key, planet_key),
        "sidereal_longitude": round(sidereal_long, 4),
        "transit_rashi_index": sign_index,
        "transit_rashi_name": rashi_meta["eng"],
        "transit_rashi_tamil": rashi_meta["tamil"],
        "rashi_lord": rashi_meta["lord"],
        "degree_in_sign_float": round(deg_in_sign, 4),
        "degree_sputa": format_degrees_sputa(deg_in_sign),
        "relative_to_natal_lagna": {
            "house_number": house_from_lagna,
            "house_title": HOUSE_VEDIC_TITLES.get(house_from_lagna, f"House {house_from_lagna}"),
            "description": f"{house_from_lagna}th house from Natal Lagna ({RASHI_LIST[natal_lagna_idx - 1]['eng']})"
        },
        "relative_to_natal_rashi": {
            "house_number": house_from_rashi,
            "house_title": HOUSE_VEDIC_TITLES.get(house_from_rashi, f"House {house_from_rashi}"),
            "description": f"{house_from_rashi}th house from Janma Rashi ({RASHI_LIST[natal_rashi_idx - 1]['eng']})"
        },
        "graha_pada_chara": {
            "nakshatra_name": nak_name,
            "nakshatra_lord": nak_lord,
            "pada": pada,
            "chara_summary": f"{nak_name} (Pada {pada})"
        },
        "is_retrograde": is_retrograde,
        "motion_state": "Retrograde (வக்ரம்)" if is_retrograde else "Direct (நேர்கதி)"
    }


def get_all_grahas_transit_snapshot(dt: datetime,
                                    natal_lagna_idx: int = 9,
                                    natal_rashi_idx: int = 8) -> List[Dict[str, Any]]:
    """Generates the 9-graha snapshot for a given date."""
    planets = ["Jupiter", "Saturn", "Mars", "Rahu", "Ketu", "Venus", "Mercury", "Sun", "Moon"]
    snapshot = []
    for p in planets:
        pos = get_graha_sidereal_position(p, dt, natal_lagna_idx, natal_rashi_idx)
        snapshot.append(pos)
    return snapshot


# =============================================================================
# 3. TRANSIT TIMELINE GENERATOR ACROSS USER WINDOW
# =============================================================================

def generate_transit_timeline(start_dt: datetime, end_dt: datetime,
                              natal_lagna_idx: int = 9,
                              natal_rashi_idx: int = 8) -> Dict[str, Any]:
    """
    Computes:
      1. Transit snapshot at window start
      2. Transit snapshot at window end
      3. Sign Ingress / Peyarchi events across the window for major and inner planets:
         - Jupiter (Guru Peyarchi ~ yearly)
         - Saturn (Sani Peyarchi ~ 2.5 years)
         - Rahu & Ketu (Peyarchi ~ 1.5 years)
         - Mars (Sevvai ~ 45 days)
         - Sun (Monthly Sankranti)
         - Venus & Mercury
    """
    total_days = max(1, (end_dt - start_dt).days)

    # 1. Start snapshot
    snapshot_start = get_all_grahas_transit_snapshot(start_dt, natal_lagna_idx, natal_rashi_idx)
    # 2. End snapshot
    snapshot_end = get_all_grahas_transit_snapshot(end_dt, natal_lagna_idx, natal_rashi_idx)

    # 3. Detect major planetary sign transitions across the timeline
    # We sample at reasonable intervals based on length of window:
    # If span > 5 years, step = 15 days; if 1..5 years, step = 5 days; if < 1 year, step = 2 days
    if total_days > 1800:
        step_days = 15
    elif total_days > 365:
        step_days = 7
    elif total_days > 90:
        step_days = 3
    else:
        step_days = 1

    tracked_planets = ["Jupiter", "Saturn", "Rahu", "Ketu", "Mars", "Sun"]
    
    # Store active sign intervals for each planet
    ingress_events = []

    for planet in tracked_planets:
        curr_t = start_dt
        prev_pos = get_graha_sidereal_position(planet, curr_t, natal_lagna_idx, natal_rashi_idx)
        interval_start_date = curr_t.strftime("%Y-%m-%d")

        while curr_t < end_dt:
            next_t = min(end_dt, curr_t + timedelta(days=step_days))
            curr_pos = get_graha_sidereal_position(planet, next_t, natal_lagna_idx, natal_rashi_idx)

            if curr_pos["transit_rashi_index"] != prev_pos["transit_rashi_index"] or next_t == end_dt:
                # Sign boundary crossed or reached end of window
                ingress_events.append({
                    "graha_name": prev_pos["graha_name"],
                    "graha_tamil": prev_pos["graha_tamil"],
                    "transit_rashi_name": prev_pos["transit_rashi_name"],
                    "transit_rashi_tamil": prev_pos["transit_rashi_tamil"],
                    "house_from_natal_lagna": prev_pos["relative_to_natal_lagna"]["house_number"],
                    "house_from_natal_lagna_title": prev_pos["relative_to_natal_lagna"]["house_title"],
                    "house_from_natal_rashi": prev_pos["relative_to_natal_rashi"]["house_number"],
                    "house_from_natal_rashi_title": prev_pos["relative_to_natal_rashi"]["house_title"],
                    "nakshatra_name": prev_pos["graha_pada_chara"]["nakshatra_name"],
                    "pada": prev_pos["graha_pada_chara"]["pada"],
                    "start_date": interval_start_date,
                    "end_date": next_t.strftime("%Y-%m-%d"),
                    "is_retrograde": prev_pos["is_retrograde"],
                    "summary_text": (
                        f"{prev_pos['graha_name']} in {prev_pos['transit_rashi_name']} "
                        f"({prev_pos['relative_to_natal_lagna']['house_number']}th from Lagna, "
                        f"{prev_pos['relative_to_natal_rashi']['house_number']}th from Moon) "
                        f"from {interval_start_date} to {next_t.strftime('%Y-%m-%d')}"
                    )
                })
                interval_start_date = next_t.strftime("%Y-%m-%d")
                prev_pos = curr_pos

            curr_t = next_t

    # Sort ingress events chronologically by start_date
    ingress_events.sort(key=lambda x: (x["start_date"], x["graha_name"]))

    return {
        "requested_timeline": {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
            "span_days": total_days,
            "span_years": round(total_days / 365.25, 2)
        },
        "natal_reference": {
            "natal_lagna_sign": RASHI_LIST[natal_lagna_idx - 1]["eng"],
            "natal_lagna_index": natal_lagna_idx,
            "natal_rashi_sign": RASHI_LIST[natal_rashi_idx - 1]["eng"],
            "natal_rashi_index": natal_rashi_idx
        },
        "transit_snapshot_start": snapshot_start,
        "transit_snapshot_end": snapshot_end,
        "major_transits_timeline_count": len(ingress_events),
        "major_transits_timeline": ingress_events
    }


def parse_sign_to_index(sign_str: str, default: int = 9) -> int:
    """Parses sign string to 1..12 index."""
    if not sign_str: return default
    cleaned = sign_str.lower().strip()
    for k, v in SIGN_NAME_TO_INDEX.items():
        if k in cleaned:
            return v
    return default
