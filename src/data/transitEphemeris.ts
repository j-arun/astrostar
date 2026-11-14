/**
 * Client-Side Vedic Astronomical Ephemeris & Gochara (Transit) Engine.
 * Exact analytical formulas mirroring scripts/vedic_ephemeris.py for 9 Grahas.
 */

export interface GrahaTransitPosition {
  graha_key: string;
  graha_name: string;
  graha_tamil: string;
  sidereal_longitude: number;
  transit_rashi_index: number;
  transit_rashi_name: string;
  transit_rashi_tamil: string;
  rashi_lord: string;
  degree_in_sign_float: number;
  degree_sputa: string;
  relative_to_natal_lagna: {
    house_number: number;
    house_title: string;
    description: string;
  };
  relative_to_natal_rashi: {
    house_number: number;
    house_title: string;
    description: string;
  };
  graha_pada_chara: {
    nakshatra_name: string;
    nakshatra_lord: string;
    pada: number;
    chara_summary: string;
  };
  is_retrograde: boolean;
  motion_state: string;
  motion_type: 'Normal' | 'Vakra' | 'Adisara';
  motion_description: string;
}

export interface TransitTimelineEvent {
  graha_name: string;
  graha_tamil: string;
  transit_rashi_name: string;
  transit_rashi_tamil: string;
  house_from_natal_lagna: number;
  house_from_natal_lagna_title: string;
  house_from_natal_rashi: number;
  house_from_natal_rashi_title: string;
  nakshatra_name: string;
  pada: number;
  start_date: string;
  end_date: string;
  is_retrograde: boolean;
  summary_text: string;
}

export interface TransitEphemerisPayload {
  requested_timeline: {
    start_date: string;
    end_date: string;
    span_days: number;
    span_years: number;
  };
  natal_reference: {
    natal_lagna_sign: string;
    natal_lagna_index: number;
    natal_rashi_sign: string;
    natal_rashi_index: number;
  };
  transit_snapshot_start: GrahaTransitPosition[];
  transit_snapshot_end: GrahaTransitPosition[];
  major_transits_timeline_count: number;
  major_transits_timeline: TransitTimelineEvent[];
}

export const RASHI_LIST_META = [
  { index: 1, tamil: "மேஷம்", eng: "Mesham (Aries)", lord: "Mars (Sevvai)" },
  { index: 2, tamil: "ரிஷபம்", eng: "Rishabam (Taurus)", lord: "Venus (Sukra)" },
  { index: 3, tamil: "மிதுனம்", eng: "Mithunam (Gemini)", lord: "Mercury (Budha)" },
  { index: 4, tamil: "கடகம்", eng: "Katakam (Cancer)", lord: "Moon (Chandra)" },
  { index: 5, tamil: "சிம்மம்", eng: "Simham (Leo)", lord: "Sun (Surya)" },
  { index: 6, tamil: "கன்னி", eng: "Kanni (Virgo)", lord: "Mercury (Budha)" },
  { index: 7, tamil: "துலாம்", eng: "Thulaam (Libra)", lord: "Venus (Sukra)" },
  { index: 8, tamil: "விருச்சிகம்", eng: "Vrischigam (Scorpio)", lord: "Mars (Sevvai)" },
  { index: 9, tamil: "தனுசு", eng: "Dhanus (Sagittarius)", lord: "Jupiter (Guru)" },
  { index: 10, tamil: "மகரம்", eng: "Makaram (Capricorn)", lord: "Saturn (Sani)" },
  { index: 11, tamil: "கும்பம்", eng: "Kumbam (Aquarius)", lord: "Saturn (Sani)" },
  { index: 12, tamil: "மீனம்", eng: "Meenam (Pisces)", lord: "Jupiter (Guru)" },
];

export const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

export const NAKSHATRA_LORDS = [
  "Ketu", "Venus (Sukra)", "Sun (Surya)", "Moon (Chandra)", "Mars (Sevvai)", "Rahu",
  "Jupiter (Guru)", "Saturn (Sani)", "Mercury (Budha)",
  "Ketu", "Venus (Sukra)", "Sun (Surya)", "Moon (Chandra)", "Mars (Sevvai)", "Rahu",
  "Jupiter (Guru)", "Saturn (Sani)", "Mercury (Budha)",
  "Ketu", "Venus (Sukra)", "Sun (Surya)", "Moon (Chandra)", "Mars (Sevvai)", "Rahu",
  "Jupiter (Guru)", "Saturn (Sani)", "Mercury (Budha)"
];

export function getNakshatraAndPadaFromLongitude(totalSiderealLongitude: number) {
  const norm = normalize360(totalSiderealLongitude);
  const nakSpan = 40.0 / 3.0; // 13° 20' = 13.3333°
  const nakIdx = Math.floor(norm / nakSpan) % 27;
  const nakName = NAKSHATRAS[nakIdx];
  const nakLord = NAKSHATRA_LORDS[nakIdx];
  const padaSpan = 10.0 / 3.0; // 3° 20' = 3.3333°
  const pada = Math.floor((norm % nakSpan) / padaSpan) + 1;
  return {
    nakshatra_name: nakName,
    nakshatra_lord: nakLord,
    pada,
    chara_summary: `${nakName} (Pada ${pada})`
  };
}

const HOUSE_TITLES: Record<number, string> = {
  1: "1st - Tanu (Self)",
  2: "2nd - Dhana (Wealth)",
  3: "3rd - Sahaja (Courage)",
  4: "4th - Sukha (Mother)",
  5: "5th - Putra (Wisdom)",
  6: "6th - Roga / Ari (Enemies)",
  7: "7th - Kalatra (Spouse)",
  8: "8th - Ashtama (Longevity)",
  9: "9th - Bhagya (Fortune)",
  10: "10th - Karma (Career)",
  11: "11th - Labha (Gains)",
  12: "12th - Vyaya (Moksha)"
};

function dateToJD(date: Date): number {
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  const day = date.getUTCDate() + (date.getUTCHours() + date.getUTCMinutes() / 60) / 24;

  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

function calculateLahiriAyanamsha(jd: number): number {
  const t = (jd - 2451545.0) / 36525.0;
  return 23.85709167 + (5029.0966 * t + 1.1116 * t * t) / 3600.0;
}

function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function formatSputa(degInSign: number): string {
  const d = Math.floor(degInSign);
  const mFloat = (degInSign - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.floor((mFloat - m) * 60);
  return `${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}' ${String(s).padStart(2, '0')}"`;
}

function solveKepler(M_rad: number, e: number): number {
  let E = M_rad;
  for (let i = 0; i < 15; i++) {
    const delta = (E - e * Math.sin(E) - M_rad) / (1.0 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return E;
}

// NASA JPL J2000 Keplerian Elements & Centennial Rates (1800-2050 AD)
// [a0, da, e0, de, I0, dI, L0, dL, wbar0, dwbar, O0, dO]
const JPL_3D_ELEMENTS: Record<string, [number, number, number, number, number, number, number, number, number, number, number, number]> = {
  Earth:   [1.00000261,  0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166,  35999.37244981, 102.93768193,  0.32327364,   0.0,         0.0],
  Mercury: [0.38709927,  0.00000037, 0.20563593,  0.00001906,  7.00497902, -0.00594749, 252.25032350, 149472.67411175,  77.45779628,  0.16047689,  48.33076593, -0.12534081],
  Venus:   [0.72333566,  0.00000390, 0.00677672, -0.00004107,  3.39467605, -0.00078890, 181.97909950,  58517.81538729, 131.60246718,  0.00268329,  76.67984255, -0.27769418],
  Mars:    [1.52371034,  0.00001847, 0.09339410,  0.00007882,  1.84969142, -0.00813131,  -4.55343205,  19140.30268499, -23.94362959,  0.44441088,  49.55953891, -0.29257343],
  Jupiter: [5.20288700, -0.00011607, 0.04838624, -0.00013253,  1.30439695, -0.00183714,  34.39644051,   3034.74612775,  14.72847983,  0.21252668, 100.47390909,  0.20469106],
  Saturn:  [9.53667594, -0.00125060, 0.05386179, -0.00050991,  2.48599187,  0.00193609,  49.95424423,   1222.49362201,  92.59887831, -0.41897216, 113.66242448, -0.28867794]
};

function getHeliocentricEclipticXY(planet: string, T: number): { x: number; y: number } {
  const el = JPL_3D_ELEMENTS[planet];
  const [a0, da, e0, de, I0, dI, L0, dL, w0, dw, O0, dO] = el;
  const a = a0 + da * T;
  const e = e0 + de * T;
  const I = toRad(I0 + dI * T);
  const L = L0 + dL * T;
  const wbar = w0 + dw * T;
  const O = toRad(O0 + dO * T);
  const w = toRad(wbar - (O0 + dO * T));
  const M_rad = toRad(normalize360(L - wbar));
  const E = solveKepler(M_rad, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(Math.max(0, 1.0 - e * e)) * Math.sin(E);

  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(O), sO = Math.sin(O);
  const cI = Math.cos(I);

  return {
    x: (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    y: (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp
  };
}

function getPlanetTropicalLongitude(planet: string, jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;

  if (planet === "Sun") {
    const L0 = normalize360(280.46646 + 36000.76983 * T);
    const M = normalize360(357.52911 + 35999.05029 * T);
    const C = (1.914602 - 0.004817 * T) * Math.sin(toRad(M)) + 0.019993 * Math.sin(toRad(2 * M));
    return normalize360(L0 + C);
  }

  if (planet === "Moon") {
    const L_prime = normalize360(218.3164477 + 481267.88123421 * T);
    const D = normalize360(297.8501921 + 445267.1114034 * T);
    const M = normalize360(357.5291092 + 35999.0502909 * T);
    const M_prime = normalize360(134.9633964 + 477198.8675055 * T);
    const d_lambda = 6.288774 * Math.sin(toRad(M_prime)) + 1.274027 * Math.sin(toRad(2 * D - M_prime)) + 0.658314 * Math.sin(toRad(2 * D)) - 0.185116 * Math.sin(toRad(M));
    return normalize360(L_prime + d_lambda);
  }

  if (planet === "Rahu") {
    return normalize360(125.04452 - 1934.136261 * T);
  }

  if (planet === "Ketu") {
    const rahu = getPlanetTropicalLongitude("Rahu", jd);
    return normalize360(rahu + 180.0);
  }

  if (JPL_3D_ELEMENTS[planet]) {
    const pe = getHeliocentricEclipticXY("Earth", T);
    const pp = getHeliocentricEclipticXY(planet, T);
    const Xg = pp.x - pe.x;
    const Yg = pp.y - pe.y;
    const j2000Lon = normalize360(toDeg(Math.atan2(Yg, Xg)));
    // Precess from J2000 ecliptic frame to mean equinox of date (so subtracting Lahiri(jd) yields true sidereal longitude)
    const precessionDeg = (5029.0966 * T + 1.1116 * T * T) / 3600.0;
    return normalize360(j2000Lon + precessionDeg);
  }

  return 0.0;
}

export function getGrahaTransitPosition(
  planetKey: string,
  date: Date,
  natalLagnaIdx: number = 9,
  natalRashiIdx: number = 8
): GrahaTransitPosition {
  const jd = dateToJD(date);
  const ayanamsha = calculateLahiriAyanamsha(jd);

  const trop = getPlanetTropicalLongitude(planetKey, jd);
  const sidereal = normalize360(trop - ayanamsha);

  // Speed
  const jdNext = jd + 0.25;
  const tropNext = getPlanetTropicalLongitude(planetKey, jdNext);
  const sidNext = normalize360(tropNext - calculateLahiriAyanamsha(jdNext));
  let diff = sidNext - sidereal;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  const isRetrograde = planetKey === "Rahu" || planetKey === "Ketu" ? true : diff < 0;

  const signIndex = Math.floor(sidereal / 30.0) + 1;
  const degInSign = sidereal % 30.0;
  const rashiMeta = RASHI_LIST_META[signIndex - 1];

  const houseFromLagna = (((signIndex - natalLagnaIdx) % 12) + 12) % 12 + 1;
  const houseFromRashi = (((signIndex - natalRashiIdx) % 12) + 12) % 12 + 1;

  const nakSpan = 40.0 / 3.0;
  const nakIdx = Math.floor(sidereal / nakSpan) % 27;
  const nakName = NAKSHATRAS[nakIdx];
  const nakLord = NAKSHATRA_LORDS[nakIdx];

  const padaSpan = 10.0 / 3.0;
  const pada = Math.floor((sidereal % nakSpan) / padaSpan) + 1;

  const names: Record<string, string> = {
    Sun: "Sun (Surya)", Moon: "Moon (Chandra)", Mars: "Mars (Sevvai)",
    Mercury: "Mercury (Budha)", Jupiter: "Jupiter (Guru)", Venus: "Venus (Sukra)",
    Saturn: "Saturn (Sani)", Rahu: "Rahu", Ketu: "Ketu"
  };

  const tamils: Record<string, string> = {
    Sun: "சூரியன்", Moon: "சந்திரன்", Mars: "செவ்வாய்",
    Mercury: "புதன்", Jupiter: "குரு", Venus: "சுக்கிரன்",
    Saturn: "சனி", Rahu: "ராகு", Ketu: "கேது"
  };

  let motionType: 'Normal' | 'Vakra' | 'Adisara' = 'Normal';
  let motionDescription = 'Normal Direct Motion — Steady, organic unfolding.';

  if (isRetrograde) {
    motionType = 'Vakra';
    if (planetKey === 'Saturn') {
      motionDescription = 'Vakra (Retrograde) — Behaving abnormal to the normal; taking a contrarian direction against the standard flow/expectations; unconventional karmic settlement.';
    } else if (planetKey === 'Jupiter') {
      motionDescription = 'Vakra (Retrograde) — Introspective reassessment of dharma, wisdom, and beliefs; inner recalibration before external fruition.';
    } else {
      motionDescription = 'Vakra (Retrograde) — Non-linear, introspective transit motion.';
    }
  } else if (planetKey === 'Jupiter' && (diff * 4) > 0.12) {
    motionType = 'Adisara';
    motionDescription = 'Adisara (Accelerated / Fast Ingress) — Guru ceases gentle advising and forcefully pushes native to execute; impatient forward momentum to get the job done.';
  } else if (planetKey === 'Saturn' && (diff * 4) > 0.055) {
    motionType = 'Adisara';
    motionDescription = 'Adisara (Accelerated Motion) — Rapid sign transit forcing urgent structural adjustments.';
  }

  return {
    graha_key: planetKey,
    graha_name: names[planetKey] || planetKey,
    graha_tamil: tamils[planetKey] || planetKey,
    sidereal_longitude: parseFloat(sidereal.toFixed(4)),
    transit_rashi_index: signIndex,
    transit_rashi_name: rashiMeta.eng,
    transit_rashi_tamil: rashiMeta.tamil,
    rashi_lord: rashiMeta.lord,
    degree_in_sign_float: parseFloat(degInSign.toFixed(4)),
    degree_sputa: formatSputa(degInSign),
    relative_to_natal_lagna: {
      house_number: houseFromLagna,
      house_title: HOUSE_TITLES[houseFromLagna] || `House ${houseFromLagna}`,
      description: `${houseFromLagna}th house from Natal Lagna (${RASHI_LIST_META[natalLagnaIdx - 1]?.eng || 'Lagna'})`
    },
    relative_to_natal_rashi: {
      house_number: houseFromRashi,
      house_title: HOUSE_TITLES[houseFromRashi] || `House ${houseFromRashi}`,
      description: `${houseFromRashi}th house from Janma Rashi (${RASHI_LIST_META[natalRashiIdx - 1]?.eng || 'Rashi'})`
    },
    graha_pada_chara: {
      nakshatra_name: nakName,
      nakshatra_lord: nakLord,
      pada: pada,
      chara_summary: `${nakName} (Pada ${pada})`
    },
    is_retrograde: isRetrograde,
    motion_state: isRetrograde ? "Retrograde (வக்ரம்)" : (motionType === 'Adisara' ? "Accelerated (அதிசாரம்)" : "Direct (நேர்கதி)"),
    motion_type: motionType,
    motion_description: motionDescription
  };
}

export function generateClientTransitTimeline(
  startDateStr: string,
  endDateStr: string,
  natalLagnaIdx: number = 9,
  natalRashiIdx: number = 8
): TransitEphemerisPayload {
  const parseMiddayUtc = (ds: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(ds.trim()) ? new Date(`${ds.trim()}T12:00:00Z`) : new Date(ds);
  const dStart = parseMiddayUtc(startDateStr);
  const dEnd = parseMiddayUtc(endDateStr);

  if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime()) || dStart >= dEnd) {
    return {
      requested_timeline: {
        start_date: startDateStr || '2026-01-01',
        end_date: endDateStr || '2028-01-01',
        span_days: 0,
        span_years: 0
      },
      natal_reference: {
        natal_lagna_sign: RASHI_LIST_META[natalLagnaIdx - 1]?.eng || "Dhanus (Sagittarius)",
        natal_lagna_index: natalLagnaIdx,
        natal_rashi_sign: RASHI_LIST_META[natalRashiIdx - 1]?.eng || "Vrischigam (Scorpio)",
        natal_rashi_index: natalRashiIdx
      },
      transit_snapshot_start: [],
      transit_snapshot_end: [],
      major_transits_timeline_count: 0,
      major_transits_timeline: []
    };
  }

  const totalDays = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)));

  const planets = ["Jupiter", "Saturn", "Mars", "Rahu", "Ketu", "Venus", "Mercury", "Sun", "Moon"];
  const snapshotStart = planets.map(p => getGrahaTransitPosition(p, dStart, natalLagnaIdx, natalRashiIdx));
  const snapshotEnd = planets.map(p => getGrahaTransitPosition(p, dEnd, natalLagnaIdx, natalRashiIdx));

  const DAY_MS = 24 * 60 * 60 * 1000;
  const stepDays = totalDays > 3650 ? 5 : (totalDays > 365 ? 2 : 1);
  const tracked = ["Jupiter", "Saturn", "Rahu", "Ketu", "Mars", "Sun", "Venus", "Mercury", ...(totalDays <= 365 ? ["Moon"] : [])];
  const timelineEvents: TransitTimelineEvent[] = [];

  for (const p of tracked) {
    let curr = new Date(dStart);
    let prevPos = getGrahaTransitPosition(p, curr, natalLagnaIdx, natalRashiIdx);
    let intervalStartStr = curr.toISOString().slice(0, 10);

    const pushSegment = (pos: GrahaTransitPosition, startStr: string, endStr: string) => {
      timelineEvents.push({
        graha_name: pos.graha_name,
        graha_tamil: pos.graha_tamil,
        transit_rashi_name: pos.transit_rashi_name,
        transit_rashi_tamil: pos.transit_rashi_tamil,
        house_from_natal_lagna: pos.relative_to_natal_lagna.house_number,
        house_from_natal_lagna_title: pos.relative_to_natal_lagna.house_title,
        house_from_natal_rashi: pos.relative_to_natal_rashi.house_number,
        house_from_natal_rashi_title: pos.relative_to_natal_rashi.house_title,
        nakshatra_name: pos.graha_pada_chara.nakshatra_name,
        pada: pos.graha_pada_chara.pada,
        start_date: startStr,
        end_date: endStr,
        is_retrograde: pos.is_retrograde,
        summary_text: `${pos.graha_name} in ${pos.transit_rashi_name} (${pos.relative_to_natal_lagna.house_number}th from Lagna, ${pos.relative_to_natal_rashi.house_number}th from Moon)${pos.is_retrograde ? ' [Retrograde / வக்ரம்]' : ' [Direct / நேர்கதி]'}`
      });
    };

    while (curr.getTime() < dEnd.getTime()) {
      const nextTime = Math.min(dEnd.getTime(), curr.getTime() + stepDays * DAY_MS);
      const nextDate = new Date(nextTime);
      const currPos = getGrahaTransitPosition(p, nextDate, natalLagnaIdx, natalRashiIdx);

      const stateChanged =
        currPos.transit_rashi_index !== prevPos.transit_rashi_index ||
        currPos.is_retrograde !== prevPos.is_retrograde;

      if (stateChanged) {
        // Pinpoint the exact day of sign ingress or retrograde/direct station
        let transitionTime = nextTime;
        let transitionPos = currPos;
        if (stepDays > 1) {
          for (let probeTime = curr.getTime() + DAY_MS; probeTime <= nextTime; probeTime += DAY_MS) {
            const probePos = getGrahaTransitPosition(p, new Date(probeTime), natalLagnaIdx, natalRashiIdx);
            if (
              probePos.transit_rashi_index !== prevPos.transit_rashi_index ||
              probePos.is_retrograde !== prevPos.is_retrograde
            ) {
              transitionTime = probeTime;
              transitionPos = probePos;
              break;
            }
          }
        }

        const transitionDateStr = new Date(transitionTime).toISOString().slice(0, 10);
        const dayBeforeMs = transitionTime - DAY_MS;
        const dayBeforeStr = new Date(dayBeforeMs).toISOString().slice(0, 10);
        const segmentEndStr = dayBeforeStr >= intervalStartStr ? dayBeforeStr : transitionDateStr;

        pushSegment(prevPos, intervalStartStr, segmentEndStr);

        intervalStartStr = transitionDateStr;
        prevPos = transitionPos;
        curr = new Date(transitionTime);

        if (transitionTime >= dEnd.getTime()) {
          pushSegment(prevPos, intervalStartStr, dEnd.toISOString().slice(0, 10));
        }
      } else if (nextTime === dEnd.getTime()) {
        pushSegment(prevPos, intervalStartStr, nextDate.toISOString().slice(0, 10));
        curr = nextDate;
      } else {
        curr = nextDate;
      }
    }
  }

  timelineEvents.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date));

  return {
    requested_timeline: {
      start_date: startDateStr,
      end_date: endDateStr,
      span_days: totalDays,
      span_years: parseFloat((totalDays / 365.25).toFixed(2))
    },
    natal_reference: {
      natal_lagna_sign: RASHI_LIST_META[natalLagnaIdx - 1]?.eng || "Dhanus (Sagittarius)",
      natal_lagna_index: natalLagnaIdx,
      natal_rashi_sign: RASHI_LIST_META[natalRashiIdx - 1]?.eng || "Vrischigam (Scorpio)",
      natal_rashi_index: natalRashiIdx
    },
    transit_snapshot_start: snapshotStart,
    transit_snapshot_end: snapshotEnd,
    major_transits_timeline_count: timelineEvents.length,
    major_transits_timeline: timelineEvents
  };
}

export const buildTransitEphemerisTimeline = generateClientTransitTimeline;


export interface MonthlyMoonSpan {
  startDay: number;
  endDay: number;
  signIndex: number;
  signName: string;
  signTamil: string;
  houseNumber: number;
  label: string;
}

/**
 * Calculates Moon's (Chandra's) ~2.25-day sign progression across the selected month.
 * Chandra is the mental trigger and immediate day-to-day fruition manifestor.
 */
export function calculateMonthlyMoonSpans(
  year: number,
  month: number, // 0..11
  natalLagnaIdx: number = 9
): MonthlyMoonSpan[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyPositions: Array<{ day: number; signIndex: number }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, month, d, 12, 0, 0));
    const pos = getGrahaTransitPosition('Moon', dt, natalLagnaIdx);
    dailyPositions.push({ day: d, signIndex: pos.transit_rashi_index });
  }

  const spans: MonthlyMoonSpan[] = [];
  let currentSpan: { startDay: number; endDay: number; signIndex: number } | null = null;

  for (const dp of dailyPositions) {
    if (!currentSpan) {
      currentSpan = { startDay: dp.day, endDay: dp.day, signIndex: dp.signIndex };
    } else if (currentSpan.signIndex === dp.signIndex) {
      currentSpan.endDay = dp.day;
    } else {
      const meta = RASHI_LIST_META.find(r => r.index === currentSpan!.signIndex) || RASHI_LIST_META[0];
      const hNum = ((currentSpan!.signIndex - natalLagnaIdx + 12) % 12) + 1;
      spans.push({
        startDay: currentSpan!.startDay,
        endDay: currentSpan!.endDay,
        signIndex: currentSpan!.signIndex,
        signName: meta.eng,
        signTamil: meta.tamil,
        houseNumber: hNum,
        label: `Day ${currentSpan!.startDay}–${currentSpan!.endDay}: Moon in ${meta.eng.split(' ')[0]} (${meta.tamil}) [House ${hNum}]`
      });
      currentSpan = { startDay: dp.day, endDay: dp.day, signIndex: dp.signIndex };
    }
  }

  if (currentSpan) {
    const meta = RASHI_LIST_META.find(r => r.index === currentSpan.signIndex) || RASHI_LIST_META[0];
    const hNum = ((currentSpan.signIndex - natalLagnaIdx + 12) % 12) + 1;
    spans.push({
      startDay: currentSpan.startDay,
      endDay: currentSpan.endDay,
      signIndex: currentSpan.signIndex,
      signName: meta.eng,
      signTamil: meta.tamil,
      houseNumber: hNum,
      label: `Day ${currentSpan.startDay}–${currentSpan.endDay}: Moon in ${meta.eng.split(' ')[0]} (${meta.tamil}) [House ${hNum}]`
    });
  }

  return spans;
}

export interface MultiYearMoonSpan {
  startDate: string;
  endDate: string;
  signIndex: number;
  signName: string;
  signTamil: string;
  houseFromLagna: number;
  houseFromMoon: number;
  isChandrashtama: boolean;
  nakshatraName?: string;
  pada?: number;
}

/**
 * Calculates Moon's (Chandra's) continuous ~2.25-day sign progression across any 1 to 2 year window.
 * For a 2-year window (730 days), this computes approximately 312 high-precision Moon sign ingresses.
 * This precision payload is packed into the LLM prompt for acute micro-timing of life events.
 */
export function calculateMultiYearMoonSpans(
  startDateStr: string,
  endDateStr: string,
  natalLagnaIdx: number = 9,
  natalRashiIdx: number = 8
): MultiYearMoonSpan[] {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const spans: MultiYearMoonSpan[] = [];

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return spans;
  }

  let currentSpan: {
    startDate: string;
    endDate: string;
    signIndex: number;
    nakshatraName?: string;
    pada?: number;
  } | null = null;

  // Step through by 12 hours (0.5 day) to accurately detect ingress boundaries across the 730 days
  const stepMs = 12 * 60 * 60 * 1000;
  for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
    const dt = new Date(t);
    const dateStr = dt.toISOString().slice(0, 10);
    const pos = getGrahaTransitPosition('Moon', dt, natalLagnaIdx, natalRashiIdx);
    const sIdx = pos.transit_rashi_index;

    if (!currentSpan) {
      currentSpan = {
        startDate: dateStr,
        endDate: dateStr,
        signIndex: sIdx,
        nakshatraName: pos.graha_pada_chara?.nakshatra_name,
        pada: pos.graha_pada_chara?.pada
      };
    } else if (currentSpan.signIndex === sIdx) {
      currentSpan.endDate = dateStr;
    } else {
      const meta = RASHI_LIST_META.find(r => r.index === currentSpan!.signIndex) || RASHI_LIST_META[0];
      const hFromLagna = ((currentSpan!.signIndex - natalLagnaIdx + 12) % 12) + 1;
      const hFromMoon = ((currentSpan!.signIndex - natalRashiIdx + 12) % 12) + 1;
      spans.push({
        startDate: currentSpan!.startDate,
        endDate: currentSpan!.endDate,
        signIndex: currentSpan!.signIndex,
        signName: meta.eng.split(' ')[0],
        signTamil: meta.tamil,
        houseFromLagna: hFromLagna,
        houseFromMoon: hFromMoon,
        isChandrashtama: hFromMoon === 8,
        nakshatraName: currentSpan!.nakshatraName,
        pada: currentSpan!.pada
      });
      currentSpan = {
        startDate: dateStr,
        endDate: dateStr,
        signIndex: sIdx,
        nakshatraName: pos.graha_pada_chara?.nakshatra_name,
        pada: pos.graha_pada_chara?.pada
      };
    }
  }

  if (currentSpan) {
    const meta = RASHI_LIST_META.find(r => r.index === currentSpan.signIndex) || RASHI_LIST_META[0];
    const hFromLagna = ((currentSpan.signIndex - natalLagnaIdx + 12) % 12) + 1;
    const hFromMoon = ((currentSpan.signIndex - natalRashiIdx + 12) % 12) + 1;
    spans.push({
      startDate: currentSpan.startDate,
      endDate: currentSpan.endDate,
      signIndex: currentSpan.signIndex,
      signName: meta.eng.split(' ')[0],
      signTamil: meta.tamil,
      houseFromLagna: hFromLagna,
      houseFromMoon: hFromMoon,
      isChandrashtama: hFromMoon === 8,
      nakshatraName: currentSpan.nakshatraName,
      pada: currentSpan.pada
    });
  }

  return spans;
}

