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
  for (let i = 0; i < 12; i++) {
    const delta = (E - e * Math.sin(E) - M_rad) / (1.0 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-8) break;
  }
  return E;
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

  // Earth's heliocentric position
  const L_e = normalize360(100.466449 + 36000.769785 * T);
  const M_e = normalize360(357.529109 + 35999.050291 * T);
  const e_e = 0.0167086 - 0.000042037 * T;
  const v_e = M_e + (2 * e_e - 0.25 * Math.pow(e_e, 3)) * Math.sin(toRad(M_e)) * (180 / Math.PI);
  const l_earth = toRad(normalize360(L_e + v_e - M_e));
  const r_e = (1.000001018 * (1 - e_e * e_e)) / (1 + e_e * Math.cos(toRad(M_e)));
  const Xe = r_e * Math.cos(l_earth);
  const Ye = r_e * Math.sin(l_earth);

  // NASA JPL Keplerian Elements for major planets
  // [a (AU), e, L (mean long), peri (long of perihelion)]
  const JPL_ORBITS: Record<string, [number, number, number, number]> = {
    Mercury: [0.38709893, 0.20563069 + 0.00002527 * T, normalize360(252.25084 + 149472.67411 * T), normalize360(77.45645 + 1.55648 * T)],
    Venus:   [0.72333199, 0.00677323 - 0.00004938 * T, normalize360(181.97973 + 58517.81539 * T), normalize360(131.57294 + 1.40222 * T)],
    Mars:    [1.52366231, 0.09341233 + 0.00011902 * T, normalize360(355.45332 + 19140.30268 * T), normalize360(336.04084 + 1.84104 * T)],
    Jupiter: [5.20336301, 0.04839266 - 0.00012880 * T, normalize360(34.40438 + 3034.79203 * T),  normalize360(14.75385 + 1.61263 * T)],
    Saturn:  [9.53707032, 0.05415060 - 0.00036762 * T, normalize360(49.94424 + 1222.49362 * T),  normalize360(92.43194 - 0.81997 * T)]
  };

  if (JPL_ORBITS[planet]) {
    const [a, e, L, peri] = JPL_ORBITS[planet];
    const M_deg = normalize360(L - peri);
    const M_rad = toRad(M_deg);
    const v_deg = M_deg + (2 * e - 0.25 * Math.pow(e, 3)) * Math.sin(M_rad) * (180 / Math.PI);
    const l_planet = toRad(normalize360(peri + v_deg));
    const r_planet = (a * (1 - e * e)) / (1 + e * Math.cos(M_rad));

    const Xp = r_planet * Math.cos(l_planet);
    const Yp = r_planet * Math.sin(l_planet);

    // Geocentric vector (planet - earth)
    const Xg = Xp - Xe;
    const Yg = Yp - Ye;

    return normalize360(toDeg(Math.atan2(Yg, Xg)));
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
    motion_state: isRetrograde ? "Retrograde (வக்ரம்)" : "Direct (நேர்கதி)"
  };
}

export function generateClientTransitTimeline(
  startDateStr: string,
  endDateStr: string,
  natalLagnaIdx: number = 9,
  natalRashiIdx: number = 8
): TransitEphemerisPayload {
  const dStart = new Date(startDateStr);
  const dEnd = new Date(endDateStr);
  const totalDays = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)));

  const planets = ["Jupiter", "Saturn", "Mars", "Rahu", "Ketu", "Venus", "Mercury", "Sun", "Moon"];
  const snapshotStart = planets.map(p => getGrahaTransitPosition(p, dStart, natalLagnaIdx, natalRashiIdx));
  const snapshotEnd = planets.map(p => getGrahaTransitPosition(p, dEnd, natalLagnaIdx, natalRashiIdx));

  const stepDays = totalDays > 1800 ? 15 : (totalDays > 365 ? 7 : (totalDays > 90 ? 3 : 1));
  const tracked = ["Jupiter", "Saturn", "Rahu", "Ketu", "Mars", "Sun", "Venus", "Mercury", ...(totalDays <= 365 ? ["Moon"] : [])];
  const timelineEvents: TransitTimelineEvent[] = [];

  for (const p of tracked) {
    let curr = new Date(dStart);
    let prevPos = getGrahaTransitPosition(p, curr, natalLagnaIdx, natalRashiIdx);
    let intervalStartStr = curr.toISOString().slice(0, 10);

    while (curr.getTime() < dEnd.getTime()) {
      const nextTime = Math.min(dEnd.getTime(), curr.getTime() + stepDays * 24 * 60 * 60 * 1000);
      const nextDate = new Date(nextTime);
      const currPos = getGrahaTransitPosition(p, nextDate, natalLagnaIdx, natalRashiIdx);

      if (currPos.transit_rashi_index !== prevPos.transit_rashi_index || nextTime === dEnd.getTime()) {
        const nextDateStr = nextDate.toISOString().slice(0, 10);
        timelineEvents.push({
          graha_name: prevPos.graha_name,
          graha_tamil: prevPos.graha_tamil,
          transit_rashi_name: prevPos.transit_rashi_name,
          transit_rashi_tamil: prevPos.transit_rashi_tamil,
          house_from_natal_lagna: prevPos.relative_to_natal_lagna.house_number,
          house_from_natal_lagna_title: prevPos.relative_to_natal_lagna.house_title,
          house_from_natal_rashi: prevPos.relative_to_natal_rashi.house_number,
          house_from_natal_rashi_title: prevPos.relative_to_natal_rashi.house_title,
          nakshatra_name: prevPos.graha_pada_chara.nakshatra_name,
          pada: prevPos.graha_pada_chara.pada,
          start_date: intervalStartStr,
          end_date: nextDateStr,
          is_retrograde: prevPos.is_retrograde,
          summary_text: `${prevPos.graha_name} in ${prevPos.transit_rashi_name} (${prevPos.relative_to_natal_lagna.house_number}th from Lagna, ${prevPos.relative_to_natal_rashi.house_number}th from Moon)`
        });
        intervalStartStr = nextDateStr;
        prevPos = currPos;
      }
      curr = nextDate;
    }
  }

  timelineEvents.sort((a, b) => a.start_date.localeCompare(b.start_date));

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
