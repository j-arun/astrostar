import { samplePersonMaster, sampleNatalPlacements, PersonMaster, NatalPlacement, DashaRecord } from '../data/horoscopeData';
import { getGrahaTransitPosition, calculateMonthlyMoonSpans, RASHI_LIST_META } from '../data/transitEphemeris';
import { getVimshottariDashaForDate } from '../data/dashaCalculator';
import { computeSarvashtakavarga } from '../data/parasharaCalculations';
import { analyzeVedicWindowEvents } from './vedicEventsEngine';
import { buildEventManufacturingSnapshot } from './eventManufacturingBuilder';
import { VedicHouseContext } from './llm/types';
import {
  buildOriginalSourcePrompt,
  validateOriginalSourcePrompt,
  OriginalSourcePromptResult,
  OriginalSourceVariant
} from './llm/originalSourcePrompt';

const MONTH_ALIASES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const RASHI_META = [
  { index: 1, eng: 'Mesham (Aries)' },
  { index: 2, eng: 'Rishabam (Taurus)' },
  { index: 3, eng: 'Mithunam (Gemini)' },
  { index: 4, eng: 'Katakam (Cancer)' },
  { index: 5, eng: 'Simham (Leo)' },
  { index: 6, eng: 'Kanni (Virgo)' },
  { index: 7, eng: 'Thulaam (Libra)' },
  { index: 8, eng: 'Vrischigam (Scorpio)' },
  { index: 9, eng: 'Dhanus (Sagittarius)' },
  { index: 10, eng: 'Makaram (Capricorn)' },
  { index: 11, eng: 'Kumbam (Aquarius)' },
  { index: 12, eng: 'Meenam (Pisces)' }
];

export type ParsedMonthYearResult =
  | { ok: true; year: number; monthIndex: number; monthNumber: number; monthName: string }
  | { ok: false; error: string };

function resolveMonthToken(token: string): number | null {
  const clean = token.trim().toLowerCase();
  if (!clean) return null;
  if (clean in MONTH_ALIASES) return MONTH_ALIASES[clean];
  if (/^\d{1,2}$/.test(clean)) {
    const n = parseInt(clean, 10);
    if (n >= 1 && n <= 12) return n - 1;
  }
  return null;
}

function isValidYear(y: number): boolean {
  return Number.isInteger(y) && y >= 1900 && y <= 2150;
}

/**
 * Parses flexible date/month+year inputs:
 * - "May 2026", "may-2026", "Nov 2026", "2026 May", "2026-May"
 * - "4/2026", "04/2026", "4-2026", "2026/4", "2026-04", "202604"
 * - "2026-05-15", "2026/05/15", "15-05-2026", "05/15/2026"
 * - Separate month + year params
 */
export function parseMonthYearQuery(
  dateInput?: string | null,
  monthInput?: string | null,
  yearInput?: string | null
): ParsedMonthYearResult {
  const rawDate = (dateInput || '').trim();
  const rawMonth = (monthInput || '').trim();
  const rawYear = (yearInput || '').trim();

  if (!rawDate && !rawMonth && !rawYear) {
    const now = new Date();
    const y = now.getFullYear();
    const mIdx = now.getMonth();
    return { ok: true, year: y, monthIndex: mIdx, monthNumber: mIdx + 1, monthName: FULL_MONTH_NAMES[mIdx] };
  }

  // Handle explicit separate month + year params
  if (!rawDate && (rawMonth || rawYear)) {
    const mIdx = resolveMonthToken(rawMonth);
    const yNum = /^\d{4}$/.test(rawYear) ? parseInt(rawYear, 10) : NaN;
    if (mIdx !== null && isValidYear(yNum)) {
      return { ok: true, year: yNum, monthIndex: mIdx, monthNumber: mIdx + 1, monthName: FULL_MONTH_NAMES[mIdx] };
    }
    return {
      ok: false,
      error: `Invalid month/year query ("month=${rawMonth}", "year=${rawYear}"). Examples: ?date=May 2026, ?date=4/2026, ?date=2026-05, or ?month=5&year=2026.`
    };
  }

  // 1. YYYYMM compact (e.g. "202605")
  const yyyymm = rawDate.match(/^(\d{4})(\d{2})$/);
  if (yyyymm) {
    const y = parseInt(yyyymm[1], 10);
    const m = parseInt(yyyymm[2], 10);
    if (isValidYear(y) && m >= 1 && m <= 12) {
      return { ok: true, year: y, monthIndex: m - 1, monthNumber: m, monthName: FULL_MONTH_NAMES[m - 1] };
    }
  }

  // 2. Named month + 4-digit year in either order ("May 2026", "May-2026", "May, 2026", "2026 May", "2026-November")
  const wordFirst = rawDate.match(/^([A-Za-z]+)[\s,./-]+(\d{4})$/);
  if (wordFirst) {
    const mIdx = resolveMonthToken(wordFirst[1]);
    const y = parseInt(wordFirst[2], 10);
    if (mIdx !== null && isValidYear(y)) {
      return { ok: true, year: y, monthIndex: mIdx, monthNumber: mIdx + 1, monthName: FULL_MONTH_NAMES[mIdx] };
    }
  }
  const yearFirstWord = rawDate.match(/^(\d{4})[\s,./-]+([A-Za-z]+)$/);
  if (yearFirstWord) {
    const y = parseInt(yearFirstWord[1], 10);
    const mIdx = resolveMonthToken(yearFirstWord[2]);
    if (mIdx !== null && isValidYear(y)) {
      return { ok: true, year: y, monthIndex: mIdx, monthNumber: mIdx + 1, monthName: FULL_MONTH_NAMES[mIdx] };
    }
  }

  // 3. Named month with day + year ("15 May 2026", "May 15, 2026")
  const dmyWord = rawDate.match(/^\d{1,2}[\s,./-]+([A-Za-z]+)[\s,./-]+(\d{4})$/);
  if (dmyWord) {
    const mIdx = resolveMonthToken(dmyWord[1]);
    const y = parseInt(dmyWord[2], 10);
    if (mIdx !== null && isValidYear(y)) {
      return { ok: true, year: y, monthIndex: mIdx, monthNumber: mIdx + 1, monthName: FULL_MONTH_NAMES[mIdx] };
    }
  }
  const mdyWord = rawDate.match(/^([A-Za-z]+)[\s,./-]+\d{1,2}[\s,./-]+(\d{4})$/);
  if (mdyWord) {
    const mIdx = resolveMonthToken(mdyWord[1]);
    const y = parseInt(mdyWord[2], 10);
    if (mIdx !== null && isValidYear(y)) {
      return { ok: true, year: y, monthIndex: mIdx, monthNumber: mIdx + 1, monthName: FULL_MONTH_NAMES[mIdx] };
    }
  }

  // 4. Numeric M/YYYY or MM-YYYY ("4/2026", "04/2026", "11-2026")
  const mYear = rawDate.match(/^(\d{1,2})[\s/.\-]+(\d{4})$/);
  if (mYear) {
    const m = parseInt(mYear[1], 10);
    const y = parseInt(mYear[2], 10);
    if (m >= 1 && m <= 12 && isValidYear(y)) {
      return { ok: true, year: y, monthIndex: m - 1, monthNumber: m, monthName: FULL_MONTH_NAMES[m - 1] };
    }
  }

  // 5. Numeric YYYY-MM or YYYY/M ("2026-04", "2026/4")
  const yMonth = rawDate.match(/^(\d{4})[\s/.\-]+(\d{1,2})$/);
  if (yMonth) {
    const y = parseInt(yMonth[1], 10);
    const m = parseInt(yMonth[2], 10);
    if (isValidYear(y) && m >= 1 && m <= 12) {
      return { ok: true, year: y, monthIndex: m - 1, monthNumber: m, monthName: FULL_MONTH_NAMES[m - 1] };
    }
  }

  // 6. Full ISO YYYY-MM-DD or YYYY/MM/DD ("2026-05-15")
  const ymd = rawDate.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})(?:T.*)?$/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10);
    const d = parseInt(ymd[3], 10);
    if (isValidYear(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { ok: true, year: y, monthIndex: m - 1, monthNumber: m, monthName: FULL_MONTH_NAMES[m - 1] };
    }
  }

  // 7. Full DD-MM-YYYY or MM/DD/YYYY ("15-05-2026", "05/15/2026")
  const dmyOrMdy = rawDate.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (dmyOrMdy) {
    const a = parseInt(dmyOrMdy[1], 10);
    const b = parseInt(dmyOrMdy[2], 10);
    const y = parseInt(dmyOrMdy[3], 10);
    if (isValidYear(y)) {
      // If second part > 12, it must be MM/DD/YYYY; otherwise treat DD/MM/YYYY if first > 12, or default MM/DD for "/" and DD-MM for "-"
      let m = -1;
      if (b > 12 && a >= 1 && a <= 12) m = a;
      else if (a > 12 && b >= 1 && b <= 12) m = b;
      else if (a >= 1 && a <= 12 && b >= 1 && b <= 12) {
        m = rawDate.includes('/') ? a : b;
      }
      if (m >= 1 && m <= 12) {
        return { ok: true, year: y, monthIndex: m - 1, monthNumber: m, monthName: FULL_MONTH_NAMES[m - 1] };
      }
    }
  }

  return {
    ok: false,
    error: `Unrecognized date format "${rawDate}". Accepted formats: "May 2026", "4/2026", "04/2026", "2026-05", "2026-05-15", "Nov 2026", or ?month=5&year=2026.`
  };
}

function resolveSignIdx(signName: string, fallback = 9): number {
  const s = (signName || '').toLowerCase();
  const keys = [
    ['mesham', 'aries'],
    ['rishab', 'taurus'],
    ['mithun', 'gemini'],
    ['katak', 'kadag', 'cancer'],
    ['simha', 'leo'],
    ['kanni', 'virgo'],
    ['thula', 'libra'],
    ['vrisch', 'scorpio'],
    ['dhanu', 'sagittarius'],
    ['makar', 'capricorn'],
    ['kumbh', 'aquarius'],
    ['meen', 'pisces']
  ];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].some(k => s.includes(k))) return i + 1;
  }
  return fallback;
}

export interface ChartSourceOverride {
  person?: PersonMaster;
  placements?: NatalPlacement[];
  dashaRecords?: DashaRecord[];
}

export function buildMonthlyVedicContext(
  year: number,
  monthIndex: number,
  chartSource?: ChartSourceOverride
): VedicHouseContext {
  const person = chartSource?.person || samplePersonMaster;
  const placements = (chartSource?.placements && chartSource.placements.length > 0)
    ? chartSource.placements
    : sampleNatalPlacements;

  const natalLagnaIdx = resolveSignIdx(person.birth_lagna, 9);
  const natalRashiIdx = resolveSignIdx(person.birth_rashi, 8);

  const flattenedD1 = placements
    .filter(p => p.chart_type === 'D1')
    .map(p => {
      const sIdx = resolveSignIdx(p.rashi_name, natalLagnaIdx);
      return {
        body_name: p.body_name,
        rashi_name: p.rashi_name,
        degree_sputa: p.degree_sputa,
        nakshatra_name: p.nakshatra_name,
        pada: p.pada,
        house_number: ((sIdx - natalLagnaIdx + 12) % 12) + 1,
        is_retrograde: p.is_retrograde
      };
    });

  const flattenedD9 = placements
    .filter(p => p.chart_type === 'D9')
    .map(p => ({
      body_name: p.body_name,
      rashi_name: p.rashi_name,
      degree_sputa: p.degree_sputa,
      house_number: p.house_number,
      is_retrograde: p.is_retrograde
    }));

  const savResult = computeSarvashtakavarga(natalLagnaIdx, undefined, flattenedD1);

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthStr = String(monthIndex + 1).padStart(2, '0');
  const startDateStr = `${year}-${monthStr}-01`;
  const endDateStr = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
  const evalDate = new Date(Date.UTC(year, monthIndex, 15, 12, 0, 0));
  const evalDateStr = evalDate.toISOString().slice(0, 10);

  let activeDasha: VedicHouseContext['activeDasha'] = getVimshottariDashaForDate(evalDateStr);
  if (chartSource?.dashaRecords && chartSource.dashaRecords.length > 0) {
    const match = chartSource.dashaRecords.find(r => evalDateStr >= r.start_date && evalDateStr <= r.end_date);
    if (match) {
      const mdRows = chartSource.dashaRecords.filter(r => r.mahadasha_lord === match.mahadasha_lord);
      const adRows = mdRows.filter(r => r.antardasha_lord === match.antardasha_lord);
      activeDasha = {
        mahadasha: match.mahadasha_lord,
        antardasha: match.antardasha_lord,
        pratyantardasha: match.pratyantardasha_lord,
        startDate: match.start_date,
        endDate: match.end_date,
        mdStartDate: mdRows.length > 0 ? mdRows[0].start_date : undefined,
        mdEndDate: mdRows.length > 0 ? mdRows[mdRows.length - 1].end_date : undefined,
        adStartDate: adRows.length > 0 ? adRows[0].start_date : undefined,
        adEndDate: adRows.length > 0 ? adRows[adRows.length - 1].end_date : undefined
      };
    }
  }

  const grahaKeys = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const transitPlacements = grahaKeys.map(k =>
    getGrahaTransitPosition(k, evalDate, natalLagnaIdx, natalRashiIdx)
  );

  const monthlyMoonSpans = calculateMonthlyMoonSpans(year, monthIndex, natalLagnaIdx);

  const monthlyGrahaSpans: NonNullable<Parameters<typeof buildEventManufacturingSnapshot>[0]['monthlyGrahaSpans']> = [];
  for (const gKey of grahaKeys) {
    let currSign = -1;
    let currRetro = false;
    let currMotion: 'Normal' | 'Vakra' | 'Adisara' = 'Normal';
    let spanStart = 1;
    let samplePos: ReturnType<typeof getGrahaTransitPosition> | null = null;
    const trackAdisaraSplit = gKey === 'Jupiter' || gKey === 'Saturn';

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(year, monthIndex, d, 12, 0, 0));
      const pos = getGrahaTransitPosition(gKey, dt, natalLagnaIdx, natalRashiIdx);
      const posMotion: 'Normal' | 'Vakra' | 'Adisara' =
        pos.motion_type || (pos.is_retrograde ? 'Vakra' : 'Normal');
      const motionChanged = trackAdisaraSplit
        ? posMotion !== currMotion
        : !!pos.is_retrograde !== currRetro;
      if (currSign === -1) {
        currSign = pos.transit_rashi_index;
        currRetro = !!pos.is_retrograde;
        currMotion = posMotion;
        spanStart = 1;
        samplePos = pos;
      } else if (pos.transit_rashi_index !== currSign || motionChanged) {
        const signDef = RASHI_LIST_META.find(s => s.index === currSign) || RASHI_LIST_META[0];
        monthlyGrahaSpans.push({
          graha_key: gKey,
          graha_name: samplePos?.graha_name || gKey,
          graha_tamil: samplePos?.graha_tamil || gKey,
          sign_index: currSign,
          sign_name: signDef.eng,
          sign_tamil: signDef.tamil,
          start_day: spanStart,
          end_day: d - 1,
          is_retrograde: currRetro,
          motion_type: currMotion,
          is_exalted: false,
          is_own_sign: false,
          is_custom: false
        });
        currSign = pos.transit_rashi_index;
        currRetro = !!pos.is_retrograde;
        currMotion = posMotion;
        spanStart = d;
        samplePos = pos;
      }
    }
    if (currSign !== -1) {
      const signDef = RASHI_LIST_META.find(s => s.index === currSign) || RASHI_LIST_META[0];
      monthlyGrahaSpans.push({
        graha_key: gKey,
        graha_name: samplePos?.graha_name || gKey,
        graha_tamil: samplePos?.graha_tamil || gKey,
        sign_index: currSign,
        sign_name: signDef.eng,
        sign_tamil: signDef.tamil,
        start_day: spanStart,
        end_day: daysInMonth,
        is_retrograde: currRetro,
        motion_type: currMotion,
        is_exalted: false,
        is_own_sign: false,
        is_custom: false
      });
    }
  }

  const vedicSpecialEvents = analyzeVedicWindowEvents({
    startDateStr,
    endDateStr,
    natalLagnaIdx,
    natalRashiIdx,
    flattenedNatalD1: flattenedD1.map(np => ({
      body_name: np.body_name,
      rashi_name: np.rashi_name
    })),
    overrides: {},
    priorTailDays: 3
  });

  const eventManufacturingSuperset = buildEventManufacturingSnapshot({
    selectedMonth: monthIndex,
    selectedYear: year,
    natalLagnaIdx,
    natalRashiIdx,
    activeDashaHierarchy: activeDasha,
    flattenedD1,
    transitPlacements,
    monthlyMoonSpans,
    monthlyGrahaSpans,
    vedicSpecialEvents
  });

  return {
    isComprehensiveMonthly: true,
    activeDomainFilter: 'all',
    isEventActive: false,
    activationScore: 0,
    matchedRules: [],
    natalOccupants: [],
    transitOccupants: [],
    allTransitPlacements: transitPlacements.map(t => ({
      graha_key: t.graha_key,
      graha_name: t.graha_name,
      graha_tamil: t.graha_tamil,
      transit_rashi_index: t.transit_rashi_index,
      transit_rashi_name: t.transit_rashi_name,
      transit_rashi_tamil: t.transit_rashi_tamil,
      house_from_lagna: ((t.transit_rashi_index - natalLagnaIdx + 12) % 12) + 1,
      house_from_moon: ((t.transit_rashi_index - natalRashiIdx + 12) % 12) + 1,
      degree_sputa: t.degree_sputa,
      degree_in_sign_float: t.degree_in_sign_float,
      nakshatra_name: t.graha_pada_chara?.nakshatra_name || 'N/A',
      nakshatra_lord: t.graha_pada_chara?.nakshatra_lord || '',
      pada: t.graha_pada_chara?.pada || 1,
      is_retrograde: t.is_retrograde,
      motion_type: t.motion_type || (t.is_retrograde ? 'Vakra' : 'Normal'),
      motion_description: t.motion_description,
      sav_points: savResult.savTotalPoints[t.transit_rashi_index] || 28,
      is_custom: false
    })),
    natalLagnaSignName: RASHI_META[natalLagnaIdx - 1].eng,
    natalMoonSignName: RASHI_META[natalRashiIdx - 1].eng,
    activeDasha,
    selectedMonth: monthIndex,
    selectedYear: year,
    flattenedNatalD1: flattenedD1,
    flattenedNatalD9: flattenedD9,
    monthlyMoonSpans,
    vedicSpecialEvents,
    natalJanmaStar: {
      nakshatra_name: person.birth_star,
      pada: person.birth_star_pada,
      rashi_name: RASHI_META[natalRashiIdx - 1].eng,
      rashi_index: natalRashiIdx
    },
    ashtakavargaPayload: {
      targetHousePoints: 0,
      targetHouseStrength: 'All-House Distribution',
      savPointsDistribution: savResult.allHousesOverview
    },
    eventManufacturingSuperset
  };
}

export type PromptPart = 'full' | 'month' | 'static';
export type ApiVariantParam = OriginalSourceVariant | 'both';

function selectPartText(res: OriginalSourcePromptResult, part: PromptPart): string {
  if (part === 'month') return res.monthSlice;
  if (part === 'static') return res.staticBlock;
  return res.fullPrompt;
}

export function generateOriginalSourceApiPayload(options: {
  year: number;
  monthIndex: number;
  variant?: ApiVariantParam;
  part?: PromptPart;
  chartSource?: ChartSourceOverride;
}) {
  const { year, monthIndex, variant = 'baseline', part = 'full', chartSource } = options;
  const context = buildMonthlyVedicContext(year, monthIndex, chartSource);

  if (variant === 'both') {
    const baseRes = buildOriginalSourcePrompt(context, 'baseline');
    const compRes = buildOriginalSourcePrompt(context, 'compact');
    const baseVal = validateOriginalSourcePrompt(baseRes, context, 'baseline');
    const compVal = validateOriginalSourcePrompt(compRes, context, 'compact');
    return {
      success: baseVal.valid && compVal.valid,
      variant: 'both' as const,
      part,
      monthLabel: baseRes.meta.monthLabel,
      year,
      month: monthIndex + 1,
      dateRange: baseRes.meta.dateRange,
      validated: baseVal.valid && compVal.valid,
      validationErrors: [...baseVal.errors, ...compVal.errors],
      tokenSavings: Math.max(0, baseRes.meta.estTokens - compRes.meta.estTokens),
      baseline: {
        content: selectPartText(baseRes, part),
        staticBlock: baseRes.staticBlock,
        monthSlice: baseRes.monthSlice,
        fullPrompt: baseRes.fullPrompt,
        meta: baseRes.meta,
        validated: baseVal.valid
      },
      compact: {
        content: selectPartText(compRes, part),
        staticBlock: compRes.staticBlock,
        monthSlice: compRes.monthSlice,
        fullPrompt: compRes.fullPrompt,
        meta: compRes.meta,
        validated: compVal.valid
      }
    };
  }

  const singleRes = buildOriginalSourcePrompt(context, variant);
  const singleVal = validateOriginalSourcePrompt(singleRes, context, variant);
  return {
    success: singleVal.valid,
    variant,
    part,
    monthLabel: singleRes.meta.monthLabel,
    year,
    month: monthIndex + 1,
    dateRange: singleRes.meta.dateRange,
    validated: singleVal.valid,
    validationErrors: singleVal.errors,
    content: selectPartText(singleRes, part),
    staticBlock: singleRes.staticBlock,
    monthSlice: singleRes.monthSlice,
    fullPrompt: singleRes.fullPrompt,
    meta: singleRes.meta
  };
}
