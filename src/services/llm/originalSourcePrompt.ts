import originalSourceRulesRaw from './originalSourceRules.txt?raw';
import { VedicHouseContext } from './types';
import { getGrahaTransitPosition, GrahaTransitPosition } from '../../data/transitEphemeris';
import { calculateTaraBala } from '../../data/parasharaCalculations';
import {
  getCleanSignIndex,
  getParasharaAspectEntries
} from './vedicPromptHelpers';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SIGN_LIST_EN = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const SIGN_ABBR_EN: Record<string, string> = {
  Aries: 'Ari',
  Taurus: 'Tau',
  Gemini: 'Gem',
  Cancer: 'Can',
  Leo: 'Leo',
  Virgo: 'Vir',
  Libra: 'Lib',
  Scorpio: 'Sco',
  Sagittarius: 'Sag',
  Capricorn: 'Cap',
  Aquarius: 'Aqu',
  Pisces: 'Pis'
};

const OWNED_SIGN_INDICES: Record<string, number[]> = {
  Sun: [5],
  Moon: [4],
  Mars: [1, 8],
  Mercury: [3, 6],
  Jupiter: [9, 12],
  Venus: [2, 7],
  Saturn: [10, 11]
};

const EXALT_SIGNS: Record<string, number> = {
  Sun: 1,
  Moon: 2,
  Mars: 10,
  Mercury: 6,
  Jupiter: 4,
  Venus: 12,
  Saturn: 7,
  Rahu: 2,
  Ketu: 8
};

const DEBIL_SIGNS: Record<string, number> = {
  Sun: 7,
  Moon: 8,
  Mars: 4,
  Mercury: 12,
  Jupiter: 10,
  Venus: 6,
  Saturn: 1,
  Rahu: 8,
  Ketu: 2
};

const COMBUSTION_ORBS: Record<string, number> = {
  Moon: 12,
  Mars: 17,
  Mercury: 14,
  Jupiter: 11,
  Venus: 10,
  Saturn: 15
};

function cleanSign(s?: string): string {
  if (!s) return '';
  const map: Record<string, string> = {
    mesham: 'Aries', mesha: 'Aries',
    rishabam: 'Taurus', rishaba: 'Taurus', vrishabha: 'Taurus',
    mithunam: 'Gemini', mithuna: 'Gemini',
    kadagam: 'Cancer', katakam: 'Cancer', kadaga: 'Cancer', karkataka: 'Cancer', karka: 'Cancer',
    simham: 'Leo', simha: 'Leo',
    kanni: 'Virgo', kanya: 'Virgo',
    thulaam: 'Libra', thulam: 'Libra', tula: 'Libra',
    vrischigam: 'Scorpio', viruchigam: 'Scorpio', vrischika: 'Scorpio', vruschikam: 'Scorpio',
    dhanus: 'Sagittarius', dhanusu: 'Sagittarius', dhanu: 'Sagittarius',
    makaram: 'Capricorn', makara: 'Capricorn',
    kumbam: 'Aquarius', kumbha: 'Aquarius',
    meenam: 'Pisces', meena: 'Pisces'
  };
  const out = String(s).replace(/[\u0B80-\u0BFF]+/g, '').trim();
  const paren = out.match(/\((Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\)/i);
  if (paren) return paren[1];
  for (const [k, v] of Object.entries(map)) {
    if (out.toLowerCase() === k || out.toLowerCase().startsWith(k)) return v;
  }
  return out;
}

function cleanPlanet(p?: string): string {
  if (!p) return '';
  const raw = String(p).replace(/[\u0B80-\u0BFF]+/g, '').split('(')[0].trim();
  const low = raw.toLowerCase();
  if (low === 'surya' || low === 'suryan' || low === 'suriyan' || low === 'ravi') return 'Sun';
  if (low === 'chandra' || low === 'chandran' || low === 'soma') return 'Moon';
  if (low === 'sevvai' || low === 'chevvai' || low === 'mangal' || low === 'angaraka') return 'Mars';
  if (low === 'budha' || low === 'budhan') return 'Mercury';
  if (low === 'guru' || low === 'brihaspati') return 'Jupiter';
  if (low === 'sukra' || low === 'shukra' || low === 'velli') return 'Venus';
  if (low === 'sani' || low === 'shani' || low === 'shaneeshwara') return 'Saturn';
  return raw;
}

function cleanDegree(deg?: string): string {
  if (!deg) return '';
  const m = String(deg).match(/(\d{1,2})\s*°\s*(\d{1,2})?/);
  if (m) return `${m[1].padStart(2, '0')}°${(m[2] || '00').padStart(2, '0')}'`;
  return String(deg).trim();
}

function cleanStar(star?: string, pada?: number): string {
  if (!star) return '';
  let clean = String(star).replace(/[\u0B80-\u0BFF]+/g, '').trim();
  const paren = clean.match(/^[^(]+\(([^)]+)\)/);
  if (paren && paren[1]) clean = paren[1].trim();
  return pada ? `${clean} P${pada}` : clean;
}

function signAbbr(signName?: string): string {
  const s = cleanSign(signName);
  return SIGN_ABBR_EN[s] || s.slice(0, 3);
}

function shortDate(isoDate: string): string {
  const m = isoDate.match(/^\d{4}-(\d{2}-\d{2})$/);
  return m ? m[1] : isoDate;
}

function formatDayRangesCompact(days: number[]): string {
  if (days.length === 0) return '';
  const sorted = Array.from(new Set(days)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `d${start}` : `d${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `d${start}` : `d${start}-${end}`);
  return ranges.join(',');
}

function formatContinuousRanges(items: Array<{ day: number; label: string }>): string {
  if (items.length === 0) return '';
  const groups: Array<{ label: string; start: number; end: number }> = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.label === it.label && it.day === last.end + 1) {
      last.end = it.day;
    } else {
      groups.push({ label: it.label, start: it.day, end: it.day });
    }
  }
  if (groups.length === 1) {
    const g = groups[0];
    return `${g.label} ${g.start === g.end ? `d${g.start}` : `d${g.start}-${g.end}`}`;
  }
  return groups
    .map(g => `${g.label} ${g.start === g.end ? `d${g.start}` : `d${g.start}-${g.end}`}`)
    .join(', ');
}

function shortTaraTag(janmaStar: string, transitStar: string): string {
  if (!transitStar) return '';
  const tb = calculateTaraBala(janmaStar || 'Anuradha', transitStar);
  const shortName = tb.taraName.replace(/\s+Tara$/i, '').trim();
  return `Tara ${shortName} T${tb.taraNumber}`;
}

function getDignityTag(planetClean: string, signIdx: number): string {
  if (!signIdx) return '';
  if (EXALT_SIGNS[planetClean] === signIdx) return 'Uchha';
  if (DEBIL_SIGNS[planetClean] === signIdx) return 'Neecha';
  if ((OWNED_SIGN_INDICES[planetClean] || []).includes(signIdx)) return 'Swakshetra';
  return '';
}

function isCombustAgainstSun(
  planetClean: string,
  planetLon: number,
  sunLon: number,
  isRetro: boolean
): boolean {
  const baseOrb = COMBUSTION_ORBS[planetClean];
  if (!baseOrb) return false;
  const orb =
    planetClean === 'Mercury'
      ? (isRetro ? 12 : 14)
      : planetClean === 'Venus'
      ? (isRetro ? 8 : 10)
      : baseOrb;
  const diff = Math.abs(planetLon - sunLon);
  const sep = Math.min(diff, 360 - diff);
  return sep <= orb;
}

function compactNeechaBhangaFactor(rawReason: string): string {
  const r = rawReason.replace(/\s*\(H\d+ from (Moon|Lagna)\)/g, '').trim();
  const low = r.toLowerCase();
  if (low.includes('neecha-vakra') || low.includes('is retrograde')) return 'Neecha-Vakra';
  if (low.includes('parivartana')) return 'Parivartana active';
  if (low.includes('conjunction')) {
    const m = r.match(/dispositor\s+([A-Za-z]+)/i);
    return m ? `dispositor conjunct (${m[1]})` : 'dispositor conjunct';
  }
  if (low.includes('7th aspect')) {
    const m = r.match(/dispositor\s+([A-Za-z]+)/i);
    return m ? `dispositor 7th-aspect (${m[1]})` : 'dispositor 7th-aspect';
  }
  if (low.includes('debilitation sign lord') && low.includes('kendra')) {
    const m = r.match(/lord\s+([A-Za-z]+)/i);
    return m ? `transit dispositor (${m[1]}) in Kendra` : 'transit dispositor in Kendra';
  }
  if (low.includes('natal') && low.includes('dispositor') && low.includes('kendra')) {
    const m = r.match(/Natal\s+([A-Za-z]+)/i);
    return m ? `natal dispositor (${m[1]}) in Kendra` : 'natal dispositor in Kendra';
  }
  if (low.includes('exaltation lord') && low.includes('transits kendra')) {
    const m = r.match(/lord\s+([A-Za-z]+)/i);
    return m ? `transit exalt-lord (${m[1]}) in Kendra` : 'transit exalt-lord in Kendra';
  }
  if (low.includes('natal') && low.includes('exalted in') && low.includes('kendra')) {
    const m = r.match(/Natal\s+([A-Za-z]+)/i);
    return m ? `natal exalt-lord (${m[1]}) in Kendra` : 'natal exalt-lord in Kendra';
  }
  if (low.includes('exaltation sign') && low.includes('kendra')) {
    const m = r.match(/\(([A-Za-z]+)\)/);
    return m ? `exalt-sign lord (${m[1]}) in Kendra` : 'exalt-sign lord in Kendra';
  }
  return r;
}

interface DailyPlanetRecord {
  day: number;
  dateStr: string;
  signIdx: number;
  signName: string;
  hLagna: number;
  hMoon: number;
  degStr: string;
  siderealLon: number;
  nakshatra: string;
  pada: number;
  isRetro: boolean;
  motionTag: 'ADISARA' | 'VAKRA' | 'DIRECT';
  isCombust: boolean;
}

export interface OriginalSourcePromptResult {
  staticBlock: string;
  monthSlice: string;
  fullPrompt: string;
  meta: {
    monthLabel: string;
    dateRange: string;
    charCount: number;
    lineCount: number;
    estTokens: number;
  };
}

/**
 * Builds the "Original Source" (Original Heartbeat) holistic raw-data prompt.
 * Completely independent of existing v1/v2/v3 prompts.
 * Zero outcome prose, zero percentages, zero invented scores, zero JSON contracts.
 */
export function buildOriginalSourcePrompt(context: VedicHouseContext): OriginalSourcePromptResult {
  const lagna = cleanSign(context.natalLagnaSignName) || 'Sagittarius';
  const moon = cleanSign(context.natalMoonSignName || context.natalJanmaStar?.rashi_name) || 'Scorpio';
  const lagnaIdx = getCleanSignIndex(lagna) || 9;
  const moonIdx = getCleanSignIndex(moon) || 8;
  const janmaStarName = cleanStar(context.natalJanmaStar?.nakshatra_name || 'Anuradha');
  const janmaPada = context.natalJanmaStar?.pada || 2;

  // =========================================================================
  // STATIC BLOCK (byte-identical across months/sessions for the same chart)
  // =========================================================================
  const rulesText = originalSourceRulesRaw.trim();

  // S2 [LORDSHIPS] — one line per planet: "planet: L-houses (M-houses)"
  const lordshipLines = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map(p => {
    const signs = OWNED_SIGN_INDICES[p] || [];
    const lHouses = signs.map(s => `L${((s - lagnaIdx + 12) % 12) + 1}`).join(',');
    const mHouses = signs.map(s => `M${((s - moonIdx + 12) % 12) + 1}`).join(',');
    return `${p}: ${lHouses} (${mHouses})`;
  });

  // S3 [D1] — planet | sign | house | degree | nakshatra-pada | [R] flag
  const d1Lines = (context.flattenedNatalD1 && context.flattenedNatalD1.length > 0)
    ? context.flattenedNatalD1.map(p => {
        const pName = cleanPlanet(p.body_name);
        const sName = cleanSign(p.rashi_name);
        const sIdx = getCleanSignIndex(sName);
        const hNum = p.house_number || (sIdx ? ((sIdx - lagnaIdx + 12) % 12) + 1 : '?');
        const deg = cleanDegree(p.degree_sputa) || '-';
        const star = cleanStar(p.nakshatra_name, p.pada) || '-';
        const rFlag = p.is_retrograde ? ' | [R]' : '';
        return `${pName} | ${sName} | H${hNum} | ${deg} | ${star}${rFlag}`;
      })
    : ['D1 placements not provided'];

  // S4 [D9] — planet | sign | house | flags (Exalted/Own/Debilitated/Vargottama/R)
  const computeFallbackD9 = (): NonNullable<VedicHouseContext['flattenedNatalD9']> => {
    const d1 = context.flattenedNatalD1 || [];
    if (d1.length === 0) return [];
    const rawItems: Array<{ body_name: string; d9SignIdx: number; rashi_name: string; is_retrograde?: boolean }> = [];
    for (const p of d1) {
      const sIdx = getCleanSignIndex(p.rashi_name);
      if (!sIdx) continue;
      const degM = String(p.degree_sputa || '').match(/(\d{1,2})\s*[°:]\s*(\d{1,2})?/);
      const totalMins = degM ? parseInt(degM[1], 10) * 60 + (degM[2] ? parseInt(degM[2], 10) : 0) : 0;
      const clampedMins = Math.max(0, Math.min(1799, totalMins));
      const navPada = Math.min(8, Math.floor(clampedMins / 200));
      const mod4 = (sIdx - 1) % 4;
      const startIdx = mod4 === 0 ? 1 : mod4 === 1 ? 10 : mod4 === 2 ? 7 : 4;
      const d9SignIdx = ((startIdx - 1 + navPada) % 12) + 1;
      rawItems.push({
        body_name: p.body_name,
        d9SignIdx,
        rashi_name: SIGN_LIST_EN[d9SignIdx - 1],
        is_retrograde: p.is_retrograde
      });
    }
    const lagnaItem = rawItems.find(x => cleanPlanet(x.body_name).toLowerCase() === 'lagna');
    const d9LagnaIdx = lagnaItem ? lagnaItem.d9SignIdx : 0;
    return rawItems.map(item => ({
      body_name: item.body_name,
      rashi_name: item.rashi_name,
      house_number: d9LagnaIdx ? ((item.d9SignIdx - d9LagnaIdx + 12) % 12) + 1 : undefined,
      is_retrograde: item.is_retrograde
    }));
  };

  const d9Source = (context.flattenedNatalD9 && context.flattenedNatalD9.length > 0)
    ? context.flattenedNatalD9
    : computeFallbackD9();

  let d9Lines: string[] = [];
  if (d9Source.length > 0) {
    const d1SignMap = new Map<string, number>();
    (context.flattenedNatalD1 || []).forEach(p => {
      const k = cleanPlanet(p.body_name).toLowerCase();
      const s = getCleanSignIndex(p.rashi_name);
      if (k && s) d1SignMap.set(k, s);
    });
    const lagnaRow = d9Source.find(p => cleanPlanet(p.body_name).toLowerCase() === 'lagna');
    const d9LagnaIdx = lagnaRow ? getCleanSignIndex(lagnaRow.rashi_name) : 0;
    d9Lines = d9Source.map(p => {
      const pName = cleanPlanet(p.body_name);
      const sIdx = getCleanSignIndex(p.rashi_name);
      const sName = sIdx ? SIGN_LIST_EN[sIdx - 1] : cleanSign(p.rashi_name);
      const hNum = p.house_number || (d9LagnaIdx && sIdx ? ((sIdx - d9LagnaIdx + 12) % 12) + 1 : '?');
      const flags: string[] = [];
      if (pName.toLowerCase() !== 'lagna') {
        if (EXALT_SIGNS[pName] === sIdx) flags.push('Exalted');
        else if (DEBIL_SIGNS[pName] === sIdx) flags.push('Debilitated');
        if ((OWNED_SIGN_INDICES[pName] || []).includes(sIdx)) flags.push('Own');
        if (d1SignMap.get(pName.toLowerCase()) === sIdx) flags.push('Vargottama');
        if (p.is_retrograde) flags.push('R');
      }
      return `${pName} | ${sName} | H${hNum}${flags.length > 0 ? ` | ${flags.join(',')}` : ''}`;
    });
  } else {
    d9Lines = ['D9 placements not provided'];
  }

  // S5 [SAV] — H1..H12 values, one line
  const savDist = context.ashtakavargaPayload?.savPointsDistribution || [];
  const savLine = savDist.length > 0
    ? [...savDist].sort((a, b) => a.houseNumber - b.houseNumber).map(s => `H${s.houseNumber}:${s.points}`).join(' | ')
    : 'SAV not provided';

  const savBySignIdx = new Map<number, number>();
  savDist.forEach(s => savBySignIdx.set(s.signIndex, s.points));

  // S6 [KARAKAS] — one line per domain
  const karakaLines = [
    'Career: H10, Sun, Mercury, Mars',
    'Wealth: H2, H11, Jupiter',
    'Home: H4, Moon',
    'Love/Progeny: H5, H7, Venus',
    'Health: H1, H6, Saturn'
  ];

  const staticBlock = [
    `[RULES]\n${rulesText}`,
    `[LORDSHIPS]\nLagna: ${lagna} | JanmaRashi: ${moon} | JanmaStar: ${janmaStarName} P${janmaPada}\n${lordshipLines.join('\n')}`,
    `[D1]\n${d1Lines.join('\n')}`,
    `[D9]\n${d9Lines.join('\n')}`,
    `[SAV]\n${savLine}`,
    `[KARAKAS]\n${karakaLines.join('\n')}`
  ].join('\n\n');

  // =========================================================================
  // MONTH SLICE (rebuilt per month)
  // =========================================================================
  const year = context.selectedYear;
  const monthIdx = context.selectedMonth;
  const monthName = MONTH_NAMES[monthIdx] || 'Month';
  const monthShort = monthName.slice(0, 3);
  const mNumStr = String(monthIdx + 1).padStart(2, '0');
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const rangeStr = `${year}-${mNumStr}-01..${year}-${mNumStr}-${String(daysInMonth).padStart(2, '0')}`;

  const day1Utc = new Date(Date.UTC(year, monthIdx, 1, 12, 0, 0));
  const DAY_MS = 24 * 60 * 60 * 1000;
  const priorDates = [-3, -2, -1].map(off => new Date(day1Utc.getTime() + off * DAY_MS));
  const priorRangeStr = `${priorDates[0].toISOString().slice(0, 10)}..${priorDates[2].toISOString().slice(0, 10)}`;

  // C1 [PERIOD]
  const c1Period = `[PERIOD]\nMonth: ${monthName} ${year} | Range: ${rangeStr} | Prior-3-Day Boundary: ${priorRangeStr}`;

  // Build daily ephemeris records for all 9 planets across days 1..daysInMonth (respecting custom overrides)
  type TransitPlacementItem = NonNullable<VedicHouseContext['allTransitPlacements']>[number];
  const customOverrideMap = new Map<string, TransitPlacementItem>();
  (context.allTransitPlacements || []).forEach(tp => {
    if (tp.is_custom) {
      customOverrideMap.set(cleanPlanet(tp.graha_key), tp);
    }
  });

  const allGrahas = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const sunLonByDay = new Map<number, number>();
  const rawDailyByGraha = new Map<string, DailyPlanetRecord[]>();

  // First pass: Sun longitude per day so combustion is exact
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, monthIdx, d, 12, 0, 0));
    const customSun = customOverrideMap.get('Sun');
    if (customSun) {
      const sLon = (customSun.transit_rashi_index - 1) * 30 + (customSun.degree_in_sign_float ?? 15);
      sunLonByDay.set(d, sLon);
    } else {
      const sunPos = getGrahaTransitPosition('Sun', dt, lagnaIdx, moonIdx);
      sunLonByDay.set(d, sunPos.sidereal_longitude);
    }
  }

  for (const g of allGrahas) {
    const list: DailyPlanetRecord[] = [];
    const customTp = customOverrideMap.get(g);
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(year, monthIdx, d, 12, 0, 0));
      const dateStr = dt.toISOString().slice(0, 10);
      if (customTp) {
        const sIdx = customTp.transit_rashi_index;
        const sLon = (sIdx - 1) * 30 + (customTp.degree_in_sign_float ?? 15);
        const sunLon = sunLonByDay.get(d) ?? sLon;
        const mTag: 'ADISARA' | 'VAKRA' | 'DIRECT' =
          customTp.motion_type === 'Adisara' ? 'ADISARA' : customTp.is_retrograde ? 'VAKRA' : 'DIRECT';
        list.push({
          day: d,
          dateStr,
          signIdx: sIdx,
          signName: SIGN_LIST_EN[sIdx - 1] || cleanSign(customTp.transit_rashi_name),
          hLagna: ((sIdx - lagnaIdx + 12) % 12) + 1,
          hMoon: ((sIdx - moonIdx + 12) % 12) + 1,
          degStr: cleanDegree(customTp.degree_sputa) || '15°00\'',
          siderealLon: sLon,
          nakshatra: cleanStar(customTp.nakshatra_name),
          pada: customTp.pada || 1,
          isRetro: !!customTp.is_retrograde,
          motionTag: mTag,
          isCombust: g !== 'Sun' && isCombustAgainstSun(g, sLon, sunLon, !!customTp.is_retrograde)
        });
      } else {
        const pos: GrahaTransitPosition = getGrahaTransitPosition(g, dt, lagnaIdx, moonIdx);
        const sunLon = sunLonByDay.get(d) ?? pos.sidereal_longitude;
        const mTag: 'ADISARA' | 'VAKRA' | 'DIRECT' =
          pos.motion_type === 'Adisara' ? 'ADISARA' : pos.is_retrograde ? 'VAKRA' : 'DIRECT';
        list.push({
          day: d,
          dateStr,
          signIdx: pos.transit_rashi_index,
          signName: SIGN_LIST_EN[pos.transit_rashi_index - 1] || cleanSign(pos.transit_rashi_name),
          hLagna: pos.relative_to_natal_lagna.house_number,
          hMoon: pos.relative_to_natal_rashi.house_number,
          degStr: cleanDegree(pos.degree_sputa),
          siderealLon: pos.sidereal_longitude,
          nakshatra: cleanStar(pos.graha_pada_chara.nakshatra_name),
          pada: pos.graha_pada_chara.pada,
          isRetro: pos.is_retrograde,
          motionTag: mTag,
          isCombust: g !== 'Sun' && isCombustAgainstSun(g, pos.sidereal_longitude, sunLon, pos.is_retrograde)
        });
      }
    }
    rawDailyByGraha.set(g, list);
  }

  // Helper to format planet lines per sign segment (merging same-sign motion phases onto 1 line)
  const formatPlanetLines = (gKey: string): string[] => {
    const daily = rawDailyByGraha.get(gKey) || [];
    if (daily.length === 0) return [];

    // Split ONLY on sign change (same-sign motion/nakshatra changes merge onto one line with dates!)
    const signSegments: DailyPlanetRecord[][] = [];
    for (const rec of daily) {
      const lastSeg = signSegments[signSegments.length - 1];
      if (!lastSeg || lastSeg[0].signIdx !== rec.signIdx) {
        signSegments.push([rec]);
      } else {
        lastSeg.push(rec);
      }
    }

    const refDayIdx = Math.min(14, daily.length - 1);
    const refRec = daily[refDayIdx] || daily[0];
    const isMultiSign = signSegments.length > 1;

    return signSegments.map(seg => {
      const first = seg[0];
      const last = seg[seg.length - 1];
      const sIdx = first.signIdx;
      const sName = first.signName;
      const coord = `L${first.hLagna}/M${first.hMoon}`;
      const sav = savBySignIdx.get(sIdx);
      const savStr = sav ? ` SAV${sav}` : '';

      // Motion tags with day ranges
      const motionStr = formatContinuousRanges(
        seg.map(r => ({ day: r.day, label: r.motionTag }))
      );

      // Combustion tag with exact day range if any
      const combustDays = seg.filter(r => r.isCombust).map(r => r.day);
      const combustStr = combustDays.length > 0 ? `Combust ${formatDayRangesCompact(combustDays)}` : '';

      const motionAndCombust = [motionStr, combustStr].filter(Boolean).join(', ');

      // Degree range & exact degrees
      const degSpan = first.degStr === last.degStr ? first.degStr : `${first.degStr}..${last.degStr}`;
      const nakPadas = formatContinuousRanges(
        seg.map(r => ({ day: r.day, label: `${r.nakshatra} P${r.pada}` }))
      );

      // Aspects (Ex. asp 5th Sag L1/M2, 7th Aqu L3/M4, 9th Ari L5/M6)
      const aspEntries = getParasharaAspectEntries(gKey, sIdx, lagnaIdx, moonIdx);
      const aspStr = aspEntries
        .map(e => `${e.label} ${signAbbr(e.targetSign)} L${e.hLagna}/M${e.hMoon}`)
        .join(', ');

      // Tara Bala (pick mid-segment or segment start star)
      const taraSource = seg.includes(refRec) ? refRec : first;
      const taraStr = shortTaraTag(janmaStarName, taraSource.nakshatra);

      const segPrefix = isMultiSign
        ? `${gKey} (${first.day === last.day ? `d${first.day}` : `d${first.day}-${last.day}`})`
        : gKey;

      return `${segPrefix} | ${sName} ${coord}${savStr} | ${motionAndCombust} | ${degSpan} | ${nakPadas} | asp ${aspStr} | ${taraStr}`;
    });
  };

  // C2 [DASHA] — MD/AD/PD lords, PD date range, natal house of each lord, retrograde or combust, transit placement. No scores, no labels.
  const formatDashaLordLine = (roleLabel: string, lordNameRaw: string): string => {
    const lord = cleanPlanet(lordNameRaw);
    const natalRow = (context.flattenedNatalD1 || []).find(p => cleanPlanet(p.body_name) === lord);
    const natalSign = natalRow ? cleanSign(natalRow.rashi_name) : '';
    const natalSignIdx = getCleanSignIndex(natalSign);
    const natalH = natalRow?.house_number || (natalSignIdx ? ((natalSignIdx - lagnaIdx + 12) % 12) + 1 : undefined);
    const natalPart = natalH ? `natal H${natalH}${natalSign ? ` (${natalSign})` : ''}${natalRow?.is_retrograde ? ' [R]' : ''}` : 'natal not provided';

    const daily = rawDailyByGraha.get(lord) || [];
    if (daily.length === 0) {
      return `${roleLabel} ${lord} | ${natalPart} | transit not provided`;
    }

    // Build sign transitions for the month
    const signSpans: Array<{ signName: string; signIdx: number; hL: number; hM: number; start: number; end: number }> = [];
    for (const rec of daily) {
      const last = signSpans[signSpans.length - 1];
      if (!last || last.signIdx !== rec.signIdx) {
        signSpans.push({ signName: rec.signName, signIdx: rec.signIdx, hL: rec.hLagna, hM: rec.hMoon, start: rec.day, end: rec.day });
      } else {
        last.end = rec.day;
      }
    }
    const transitPart = signSpans.length === 1
      ? `transit ${signSpans[0].signName} L${signSpans[0].hL}/M${signSpans[0].hM}`
      : `transit ${signSpans.map(sp => `${sp.signName} L${sp.hL}/M${sp.hM} d${sp.start}-${sp.end}`).join('; ')}`;

    const flags: string[] = [];
    // Dignity (factual only: Uchha / Swakshetra / Neecha)
    const dignities = Array.from(new Set(signSpans.map(sp => getDignityTag(lord, sp.signIdx)).filter(Boolean)));
    if (dignities.length > 0) flags.push(dignities.join('/'));

    // Retrograde / Motion
    const retroDays = daily.filter(r => r.isRetro).map(r => r.day);
    if (retroDays.length === daily.length) {
      flags.push('Vakra');
    } else if (retroDays.length > 0) {
      flags.push(`Vakra ${formatDayRangesCompact(retroDays)}`);
    }

    // Combustion
    const combustDays = daily.filter(r => r.isCombust).map(r => r.day);
    if (combustDays.length === daily.length) {
      flags.push('Combust');
    } else if (combustDays.length > 0) {
      flags.push(`Combust ${formatDayRangesCompact(combustDays)}`);
    }

    return `${roleLabel} ${lord} | ${natalPart} | ${transitPart}${flags.length > 0 ? ` | ${flags.join(' | ')}` : ''}`;
  };

  const c2Dasha = [
    `[DASHA]`,
    `PD Window: ${context.activeDasha.startDate}..${context.activeDasha.endDate}`,
    formatDashaLordLine('MD', context.activeDasha.mahadasha),
    formatDashaLordLine('AD', context.activeDasha.antardasha),
    formatDashaLordLine('PD', context.activeDasha.pratyantardasha)
  ].join('\n');

  // C3 [SLOW PLANETS] — Prior-3-day boundary rows + Jupiter, Saturn, Rahu, Ketu
  const priorBoundaryRows: string[] = [];
  for (const g of ['Jupiter', 'Saturn', 'Mars', 'Sun', 'Mercury', 'Venus']) {
    if (customOverrideMap.has(g)) continue;
    const pts = priorDates.map(dt => {
      const ds = shortDate(dt.toISOString().slice(0, 10));
      const pos = getGrahaTransitPosition(g, dt, lagnaIdx, moonIdx);
      const tag = pos.motion_type === 'Adisara' ? 'ADISARA' : pos.is_retrograde ? 'VAKRA' : 'DIRECT';
      return { ds, sign: cleanSign(pos.transit_rashi_name), deg: cleanDegree(pos.degree_sputa), tag, sIdx: pos.transit_rashi_index };
    });
    const day1Pos = getGrahaTransitPosition(g, day1Utc, lagnaIdx, moonIdx);
    const hadChange = pts.some((p, i) => i > 0 && (p.sIdx !== pts[i - 1].sIdx || p.tag !== pts[i - 1].tag))
      || pts[pts.length - 1].sIdx !== day1Pos.transit_rashi_index
      || pts[pts.length - 1].tag !== (day1Pos.motion_type === 'Adisara' ? 'ADISARA' : day1Pos.is_retrograde ? 'VAKRA' : 'DIRECT');
    if (hadChange || g === 'Jupiter' || g === 'Saturn') {
      priorBoundaryRows.push(`${g}: ${pts.map(p => `${p.ds}: ${p.sign} ${p.deg} ${p.tag}`).join(' | ')}`);
    }
  }

  const slowPlanetLines = ['Jupiter', 'Saturn', 'Rahu', 'Ketu'].flatMap(formatPlanetLines);
  const c3SlowPlanets = [
    `[SLOW PLANETS]`,
    priorBoundaryRows.length > 0 ? `Prior-3-Day Boundary:\n${priorBoundaryRows.join('\n')}` : '',
    ...slowPlanetLines
  ].filter(Boolean).join('\n');

  // C4 [DOUBLE TRANSIT] — sign, L#/M#, date range, which planets and which aspect
  const jupDaily = rawDailyByGraha.get('Jupiter') || [];
  const satDaily = rawDailyByGraha.get('Saturn') || [];
  const getTouchesForSign = (planet: 'Jupiter' | 'Saturn', sIdx: number): Array<{ signIdx: number; rel: string }> => {
    const out: Array<{ signIdx: number; rel: string }> = [{ signIdx: sIdx, rel: 'Occ' }];
    for (const asp of getParasharaAspectEntries(planet, sIdx, lagnaIdx, moonIdx)) {
      out.push({ signIdx: asp.targetSignIdx, rel: `${asp.label}-Asp` });
    }
    return out;
  };
  const dtBySignDay = new Map<string, { signIdx: number; jRel: string; sRel: string; days: number[] }>();
  for (let d = 1; d <= daysInMonth; d++) {
    const jr = jupDaily.find(r => r.day === d);
    const sr = satDaily.find(r => r.day === d);
    if (!jr || !sr) continue;
    const jTouches = getTouchesForSign('Jupiter', jr.signIdx);
    const sTouches = getTouchesForSign('Saturn', sr.signIdx);
    for (const jt of jTouches) {
      const st = sTouches.find(x => x.signIdx === jt.signIdx);
      if (!st) continue;
      const key = `${jt.signIdx}|${jt.rel}|${st.rel}`;
      const existing = dtBySignDay.get(key);
      if (existing) {
        existing.days.push(d);
      } else {
        dtBySignDay.set(key, { signIdx: jt.signIdx, jRel: jt.rel, sRel: st.rel, days: [d] });
      }
    }
  }
  const dtFormatted: string[] = [];
  for (const entry of dtBySignDay.values()) {
    const sName = SIGN_LIST_EN[entry.signIdx - 1];
    const hL = ((entry.signIdx - lagnaIdx + 12) % 12) + 1;
    const hM = ((entry.signIdx - moonIdx + 12) % 12) + 1;
    const rangeStrDt = formatDayRangesCompact(entry.days);
    dtFormatted.push(`${sName} L${hL}/M${hM} | ${rangeStrDt} | Jupiter ${entry.jRel} + Saturn ${entry.sRel}`);
  }
  const c4DoubleTransit = [
    `[DOUBLE TRANSIT]`,
    ...(dtFormatted.length > 0 ? dtFormatted : ['None'])
  ].join('\n');

  // C5 [FAST PLANETS] — Sun, Mars, Mercury, Venus, same format as C3 + Moon reference line
  const fastLines = ['Sun', 'Mars', 'Mercury', 'Venus'].flatMap(formatPlanetLines);
  const moonDaily = rawDailyByGraha.get('Moon') || [];
  const moonRef = moonDaily[Math.min(14, Math.max(0, moonDaily.length - 1))] || moonDaily[0];
  const moonRefLine = moonRef
    ? `Moon [Day-15 Ref Only — see LUNAR for 2.25d progression]: ${moonRef.signName}(L${moonRef.hLagna}/M${moonRef.hMoon}) ${moonRef.degStr} ${moonRef.nakshatra} P${moonRef.pada} | ${shortTaraTag(janmaStarName, moonRef.nakshatra)}`
    : `Moon [Day-15 Ref Only — see LUNAR for 2.25d progression]: not provided`;

  const c5FastPlanets = [
    `[FAST PLANETS]`,
    ...fastLines,
    moonRefLine
  ].join('\n');

  // C6 [EVENTS] — bare facts only, one line each, with dates (Tier 3 source of truth)
  const vse = context.vedicSpecialEvents;
  const eventLines: string[] = [];
  if (vse) {
    if (vse.boundaryIngresses && vse.boundaryIngresses.length > 0) {
      for (const ing of vse.boundaryIngresses) {
        const g = cleanPlanet(ing.grahaKey);
        const fromS = cleanSign(ing.fromSignName);
        const toS = cleanSign(ing.toSignName);
        const tags: string[] = [];
        if (ing.isPriorMonthBoundary) tags.push('PRIOR_BOUNDARY');
        if (ing.motionType !== 'Normal') tags.push(ing.motionType.toUpperCase());
        const tagStr = tags.length > 0 ? ` [${tags.join(',')}]` : '';
        eventLines.push(`INGRESS ${g} ${fromS}->${toS} ${ing.ingressDate} L${ing.toHouseFromLagna}/M${ing.toHouseFromMoon}${tagStr}`);
      }
    }
    if (vse.sameSignStations && vse.sameSignStations.length > 0) {
      for (const st of vse.sameSignStations) {
        const g = cleanPlanet(st.grahaKey);
        const turnShort = st.turnType === 'Retrograde -> Direct' ? 'R->D' : 'D->R';
        const beforeParts = st.beforeRange.split(' to ').map(x => shortDate(x.trim())).join('..');
        const afterParts = st.afterRange.split(' to ').map(x => shortDate(x.trim())).join('..');
        eventLines.push(`STATION ${g} ${turnShort} ${cleanSign(st.signName)} L${st.houseFromLagna}/M${st.houseFromMoon} ${st.stationDate} | before ${beforeParts} | after ${afterParts}`);
      }
    } else {
      eventLines.push('STATION None');
    }

    if (vse.parivartanaYogas && vse.parivartanaYogas.length > 0) {
      for (const p of vse.parivartanaYogas) {
        const gA = cleanPlanet(p.grahaA);
        const gB = cleanPlanet(p.grahaB);
        const sA = cleanSign(p.signAName);
        const sB = cleanSign(p.signBName);
        eventLines.push(`PARIVARTANA ${gA}<->${gB} ${sA}<->${sB} L${p.lagnaHouseA}<->L${p.lagnaHouseB} M${p.moonHouseA}<->M${p.moonHouseB} ${p.startDate}..${shortDate(p.endDate)}`);
      }
    } else {
      eventLines.push('PARIVARTANA None');
    }

    if (vse.debilitationEvents && vse.debilitationEvents.length > 0) {
      for (const d of vse.debilitationEvents) {
        const g = cleanPlanet(d.grahaKey);
        const s = cleanSign(d.signName);
        const mShort = d.motionState.includes('Retrograde') ? 'Vakra' : 'Direct';
        const factors = Array.from(new Set(d.cancellationReasons.map(compactNeechaBhangaFactor)));
        const factorStr = factors.length > 0 ? factors.join(', ') : 'none';
        eventLines.push(`NEECHA_BHANGA ${g} ${s} L${d.houseFromLagna}/M${d.houseFromMoon} ${d.startDate}..${shortDate(d.endDate)} | ${mShort} | factors: ${factorStr}`);
      }
    } else {
      eventLines.push('NEECHA_BHANGA None');
    }
  } else {
    eventLines.push('None');
  }
  const c6Events = [`[EVENTS]`, ...eventLines].join('\n');

  // C8 [LUNAR] — compute from exact daily Moon positions (plus Chandrashtama days)
  interface MoonSpan {
    signIdx: number;
    signName: string;
    hMoon: number;
    days: DailyPlanetRecord[];
  }
  const moonSpans: MoonSpan[] = [];
  for (const rec of moonDaily) {
    const last = moonSpans[moonSpans.length - 1];
    if (!last || last.signIdx !== rec.signIdx) {
      moonSpans.push({ signIdx: rec.signIdx, signName: rec.signName, hMoon: rec.hMoon, days: [rec] });
    } else {
      last.days.push(rec);
    }
  }

  const moonDatesBySignIdx = new Map<number, string[]>();
  const lunarLines: string[] = [];
  const chandrashtamaWindows: string[] = [];

  for (const ms of moonSpans) {
    const d1 = ms.days[0];
    const dLast = ms.days[ms.days.length - 1];
    const dRange = d1.day === dLast.day ? `Day ${d1.day}` : `Day ${d1.day}-${dLast.day}`;
    const shortRange = d1.day === dLast.day ? `${monthShort} ${d1.day}` : `${monthShort} ${d1.day}-${dLast.day}`;

    const arr = moonDatesBySignIdx.get(ms.signIdx) || [];
    arr.push(shortRange);
    moonDatesBySignIdx.set(ms.signIdx, arr);

    const uniqueStars = Array.from(new Set(ms.days.map(x => `${x.nakshatra} P${x.pada}`))).join(' -> ');
    const degRange = d1.degStr === dLast.degStr ? d1.degStr : `${d1.degStr}..${dLast.degStr}`;
    const midDay = ms.days[Math.floor(ms.days.length / 2)] || d1;
    const tara = shortTaraTag(janmaStarName, midDay.nakshatra);
    const chandraFlag = ms.hMoon === 8 ? ' | [CHANDRASHTAMA]' : '';
    if (ms.hMoon === 8) {
      chandrashtamaWindows.push(`${ms.signName} (${dRange})`);
    }
    lunarLines.push(`${dRange} | ${ms.signName} M${ms.hMoon} | ${degRange} | ${uniqueStars} | ${tara}${chandraFlag}`);
  }

  const c8Lunar = [
    `[LUNAR]`,
    ...lunarLines,
    `Chandrashtama Days (M8): ${chandrashtamaWindows.length > 0 ? chandrashtamaWindows.join('; ') : 'None'}`
  ].join('\n');

  // C7 [HOUSE MAP] — one line per house: sign | occupants natal | occupants transit | aspects received (with day ranges) | Moon dates (L#/M#)
  const natalBySignIdx = new Map<number, string[]>();
  (context.flattenedNatalD1 || []).forEach(p => {
    const sIdx = getCleanSignIndex(p.rashi_name);
    if (!sIdx) return;
    const arr = natalBySignIdx.get(sIdx) || [];
    arr.push(`${cleanPlanet(p.body_name)}${p.is_retrograde ? '(R)' : ''}`);
    natalBySignIdx.set(sIdx, arr);
  });

  const transitBySignIdx = new Map<number, string[]>();
  const aspectsReceivedBySignIdx = new Map<number, string[]>();

  for (const g of ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
    const daily = rawDailyByGraha.get(g) || [];
    const spans: Array<{ signIdx: number; start: number; end: number }> = [];
    for (const rec of daily) {
      const last = spans[spans.length - 1];
      if (!last || last.signIdx !== rec.signIdx) {
        spans.push({ signIdx: rec.signIdx, start: rec.day, end: rec.day });
      } else {
        last.end = rec.day;
      }
    }
    for (const sp of spans) {
      const dr = sp.start === 1 && sp.end === daysInMonth
        ? ''
        : (sp.start === sp.end ? ` d${sp.start}` : ` d${sp.start}-${sp.end}`);
      const tArr = transitBySignIdx.get(sp.signIdx) || [];
      tArr.push(`${g}${dr}`);
      transitBySignIdx.set(sp.signIdx, tArr);

      for (const asp of getParasharaAspectEntries(g, sp.signIdx, lagnaIdx, moonIdx)) {
        const aArr = aspectsReceivedBySignIdx.get(asp.targetSignIdx) || [];
        aArr.push(`${g} ${asp.label}${dr}`);
        aspectsReceivedBySignIdx.set(asp.targetSignIdx, aArr);
      }
    }
  }

  const houseMapLines: string[] = [];
  for (let hL = 1; hL <= 12; hL++) {
    const sIdx = ((lagnaIdx - 1 + (hL - 1)) % 12) + 1;
    const sName = SIGN_LIST_EN[sIdx - 1];
    const hM = ((sIdx - moonIdx + 12) % 12) + 1;
    const natalOcc = (natalBySignIdx.get(sIdx) || []).join(', ') || '-';
    const transitOcc = (transitBySignIdx.get(sIdx) || []).join(', ') || '-';
    const aspRec = Array.from(new Set(aspectsReceivedBySignIdx.get(sIdx) || [])).join(', ') || '-';
    const moonD = (moonDatesBySignIdx.get(sIdx) || []).join(', ') || '-';
    houseMapLines.push(`L${hL}/M${hM} ${sName} | N: ${natalOcc} | T: ${transitOcc} | Asp: ${aspRec} | Moon: ${moonD}`);
  }
  const c7HouseMap = [`[HOUSE MAP]`, ...houseMapLines].join('\n');

  // C9 [AD CHAMBER / GATES] — AD chamber facts + 3 gates (drop Seat, Themes, PeakGate, polarity, score, CANDIDATE_TRIGGERS)
  let c9AdGates = `[AD CHAMBER / GATES]\nNot provided`;
  if (context.eventManufacturingSuperset) {
    const ss = context.eventManufacturingSuperset;
    const ad = ss.adChamberSummary;
    const adCoord = `L${ad.adNatalHouseFromLagna}/M${ad.adNatalHouseFromRashi}`;
    const ruledStr = ad.ruledHouses.length > 0
      ? ad.ruledHouses.map(rh => `L${rh.houseFromLagna}/M${rh.houseFromRashi} ${cleanSign(rh.rashiName)} (N:${rh.occupants.join(',') || '-'}, Asp:${rh.aspectingGrahas.join(',') || '-'})`).join('; ')
      : '-';

    const gateLines = ss.gates.map(g => {
      const grahas = g.activeGrahasInGate.length > 0
        ? g.activeGrahasInGate.map(ag => `${cleanPlanet(ag.name)}${ag.passageWindow ? ` (${ag.passageWindow})` : ''}`).join(', ')
        : '-';
      const gSignIdx = getCleanSignIndex(g.rashiName);
      const exactMoonDates = (gSignIdx ? moonDatesBySignIdx.get(gSignIdx)?.join(', ') : '') || g.moonIngressWindow || '-';
      return `G${g.gateIndex} | ${cleanStar(g.nakshatraName)} | ${cleanSign(g.rashiName)} | L${g.houseFromLagna}/M${g.houseFromRashi} | Moon: ${exactMoonDates} | Grahas: ${grahas}`;
    });

    c9AdGates = [
      `[AD CHAMBER / GATES]`,
      `AD_CHAMBER: ${cleanPlanet(ad.adCleanName)} @ ${cleanSign(ad.adNatalRashiName)} (${adCoord}) | Ruled: ${ruledStr}`,
      ...gateLines
    ].join('\n');
  }

  const monthSlice = [
    c1Period,
    c2Dasha,
    c3SlowPlanets,
    c4DoubleTransit,
    c5FastPlanets,
    c6Events,
    c7HouseMap,
    c8Lunar,
    c9AdGates
  ].join('\n\n');

  const fullPrompt = `${staticBlock}\n\n${monthSlice}`;
  const lineCount = fullPrompt.split('\n').length;

  return {
    staticBlock,
    monthSlice,
    fullPrompt,
    meta: {
      monthLabel: `${monthName} ${year}`,
      dateRange: rangeStr,
      charCount: fullPrompt.length,
      lineCount,
      estTokens: Math.ceil(fullPrompt.length / 4)
    }
  };
}
