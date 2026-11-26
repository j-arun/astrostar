/**
 * Dedicated LLM-Compatible Plain-Text Dump Builders:
 *   1. buildNatalDumpText   — Static Complete Natal Chart Dump (zero transits, zero `as_of`, no recalculation)
 *   2. buildTransitDumpText — Pure Gochara Transit Dump correlated with all overlapping MD -> AD -> PD (+ SD) timelines (zero domain, zero D1..D144 natal charts)
 */

import {
  CALIBRATED_ASHTAKAVARGA_001ME,
  SHADBALA_STRENGTHS_001ME,
  isChartSignature001ME
} from '../data/vargaAndStrengthData';
import {
  calculateVimshottariTimelineForProfile,
  getFullVimshottariTimeline
} from '../data/dashaCalculator';
import { generateClientTransitTimeline } from '../data/transitEphemeris';
import type { DashaEvaluationRecord, DashaIntervalItem } from '../data/apiService';
import {
  NATAL_ASPECT_ORDER,
  NATAL_ASPECT_SPECS,
  NatalPersonProfileInput,
  NatalPlacementRow,
  cleanNatalPlanetName,
  cleanNatalSignName,
  evaluateNatalDashaPromise,
  getSignIdxFromAny
} from './natalDashaPromiseEngine';
import {
  ChartSourceOverride,
  buildMonthlyVedicContext
} from './originalSourceContextBuilder';
import { buildOriginalSourcePrompt } from './llm/originalSourcePrompt';

const SIGN_NAMES_EN = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const SIGN_PRIMARY_LORD: Record<number, string> = {
  1: 'Mars', 2: 'Venus', 3: 'Mercury', 4: 'Moon',
  5: 'Sun', 6: 'Mercury', 7: 'Venus', 8: 'Mars',
  9: 'Jupiter', 10: 'Saturn', 11: 'Saturn', 12: 'Jupiter'
};

const VIMSHOTTARI_LORDS = [
  { name: 'Ketu', years: 7 },
  { name: 'Venus (Sukra)', years: 20 },
  { name: 'Sun (Surya)', years: 6 },
  { name: 'Moon (Chandra)', years: 10 },
  { name: 'Mars (Sevvai)', years: 7 },
  { name: 'Rahu', years: 18 },
  { name: 'Jupiter (Guru)', years: 16 },
  { name: 'Saturn (Sani)', years: 19 },
  { name: 'Mercury (Budha)', years: 17 }
];

export type TimelineTuple = [string, string, string, string, string]; // [md, ad, pd, start_date, end_date]

export interface DumpProfileInput extends NatalPersonProfileInput {
  time_of_birth?: string;
}

function diffDaysInclusive(startIso: string, endIso: string): number {
  const s = Date.parse(`${startIso}T00:00:00Z`);
  const e = Date.parse(`${endIso}T00:00:00Z`);
  if (isNaN(s) || isNaN(e)) return 1;
  return Math.max(1, Math.round((e - s) / 86400000));
}

function clampIsoRange(aStart: string, aEnd: string, wStart: string, wEnd: string): { start: string; end: string } {
  return {
    start: aStart > wStart ? aStart : wStart,
    end: aEnd < wEnd ? aEnd : wEnd
  };
}

/**
 * Resolves exact Vimshottari [MD, AD, PD, start, end] tuples for any person:
 * prefers explicit stored DB/JSON rows when present, uses 001ME calibrated schedule for 001ME,
 * and computes profile-based timeline for all other IDs.
 */
export function resolvePersonTimelineTuples(
  personId: string,
  profile: DumpProfileInput,
  placements: NatalPlacementRow[],
  storedDashaRecords?: Array<any>
): TimelineTuple[] {
  if (Array.isArray(storedDashaRecords) && storedDashaRecords.length > 50) {
    const first = storedDashaRecords[0];
    if (Array.isArray(first) && first.length >= 5) {
      return storedDashaRecords as TimelineTuple[];
    }
    if (first && typeof first === 'object' && first.mahadasha_lord) {
      return storedDashaRecords.map((r: any) => [
        String(r.mahadasha_lord),
        String(r.antardasha_lord),
        String(r.pratyantardasha_lord),
        String(r.start_date).slice(0, 10),
        String(r.end_date).slice(0, 10)
      ]);
    }
  }

  const lagnaIdx = getSignIdxFromAny(profile.birth_lagna, 9);
  const moonIdx = getSignIdxFromAny(profile.birth_rashi, 8);
  const d1Rows = placements.filter(p => !p.chart_type || p.chart_type === 'D1');
  if (personId === '001ME' || isChartSignature001ME(lagnaIdx, moonIdx, d1Rows)) {
    return getFullVimshottariTimeline();
  }

  return calculateVimshottariTimelineForProfile(profile);
}

function tuplesToApiIntervals(tuples: TimelineTuple[]): DashaIntervalItem[] {
  return tuples.map(([md, ad, pd, s, e], idx) => ({
    sequence_index: idx + 1,
    mahadasha_lord_md: md,
    antardasha_lord_ad: ad,
    pratyantardasha_lord_pd: pd,
    full_lord_hierarchy: `MD: ${md} > AD: ${ad} > PD: ${pd}`,
    start_date: s,
    end_date: e,
    duration_days: diffDaysInclusive(s, e),
    notes: null,
    evaluation_rating: null
  }));
}

function computeSookshmaForPdTuples(
  overlappingPds: TimelineTuple[],
  windowStart: string,
  windowEnd: string
): Array<{
  md: string;
  ad: string;
  pd: string;
  sd: string;
  startUtc: string;
  endUtc: string;
}> {
  const rangeStartMs = Date.parse(`${windowStart}T00:00:00Z`);
  const rangeEndMs = Date.parse(`${windowEnd}T23:59:59Z`);
  if (isNaN(rangeStartMs) || isNaN(rangeEndMs)) return [];

  const out: Array<{
    md: string;
    ad: string;
    pd: string;
    sd: string;
    startUtc: string;
    endUtc: string;
  }> = [];

  for (const [md, ad, pd, s, e] of overlappingPds) {
    const pdStartMs = Date.parse(`${s}T00:00:00Z`);
    const pdEndMs = Date.parse(`${e}T00:00:00Z`);
    if (isNaN(pdStartMs) || isNaN(pdEndMs)) continue;
    const pdDurMs = Math.max(86400000, pdEndMs - pdStartMs);
    const cleanPd = cleanNatalPlanetName(pd);
    const pdIdx = VIMSHOTTARI_LORDS.findIndex(l => cleanNatalPlanetName(l.name) === cleanPd);
    const startIdx = pdIdx === -1 ? 0 : pdIdx;

    let cursorMs = pdStartMs;
    for (let k = 0; k < 9; k++) {
      const sdLord = VIMSHOTTARI_LORDS[(startIdx + k) % 9];
      const sdDurMs = pdDurMs * (sdLord.years / 120.0);
      const sdEndMs = k === 8 ? pdEndMs : cursorMs + sdDurMs;
      if (sdEndMs >= rangeStartMs && cursorMs <= rangeEndMs) {
        const cStart = Math.max(cursorMs, rangeStartMs);
        const cEnd = Math.min(sdEndMs, rangeEndMs);
        out.push({
          md: cleanNatalPlanetName(md),
          ad: cleanNatalPlanetName(ad),
          pd: cleanPd,
          sd: cleanNatalPlanetName(sdLord.name),
          startUtc: `${new Date(cStart).toISOString().slice(0, 16)}Z`,
          endUtc: `${new Date(cEnd).toISOString().slice(0, 16)}Z`
        });
      }
      cursorMs = sdEndMs;
    }
  }

  return out;
}

/**
 * 1. COMPLETE NATAL DUMP (/api/natal/dump)
 * Pure static birth record (zero transits, zero `as_of`, no recalculation of stored charts).
 * Includes full Birth Profile, Birth Dasha Balance, D1, D9, ALL Divisional Vargas (D2..D144),
 * Shadbala, SAV/BAV/Sodhya Pindas, Yogas/Doshas, Jaimini, 6-Aspect Baseline Scores,
 * and Complete Lifetime Vimshottari MD -> AD -> PD Timeline.
 */
export function buildNatalDumpText(params: {
  personId: string;
  profile: DumpProfileInput;
  placements: NatalPlacementRow[];
  storedDashaRecords?: Array<any>;
  savedNotes?: DashaEvaluationRecord[];
}): string {
  const { personId, profile, placements, storedDashaRecords, savedNotes = [] } = params;

  const tuples = resolvePersonTimelineTuples(personId, profile, placements, storedDashaRecords);
  const apiIntervals = tuplesToApiIntervals(tuples);

  const { dashaTree, evaluation } = evaluateNatalDashaPromise({
    personId,
    profile,
    placements,
    apiIntervals,
    savedNotes
  });

  const lagnaIdx = evaluation.lagnaIdx;
  const moonIdx = evaluation.moonIdx;
  const d1Rows = placements.filter(r => !r.chart_type || r.chart_type === 'D1');
  const d9Rows = placements.filter(r => r.chart_type === 'D9');
  const is001 = personId === '001ME' || isChartSignature001ME(lagnaIdx, moonIdx, d1Rows);

  const lines: string[] = [];

  lines.push('=== COMPLETE NATAL HOROSCOPE DUMP (STATIC BIRTH RECORD — ZERO TRANSITS) ===');
  lines.push(`DumpFormat: LLM_COMPATIBLE_TEXT | Scope: STATIC_NATAL_ONLY | AsOfRequired: false | GocharaTransitsIncluded: false`);
  lines.push('');

  // 1. Birth Profile & Metadata
  lines.push('[BIRTH PROFILE & METADATA]');
  lines.push(`PersonID: ${personId}`);
  lines.push(`Name: ${profile.person_name || 'Not stored'}`);
  lines.push(`DateOfBirth: ${profile.date_of_birth || 'Not stored'}`);
  lines.push(`TimeOfBirth: ${profile.time_of_birth || 'Not stored in person_master'}`);
  lines.push(`PlaceOfBirth: ${profile.place_of_birth || 'Not stored'}`);
  lines.push(`Age: ${profile.age ?? 'Not stored'}`);
  lines.push(`BirthLagna: ${profile.birth_lagna || evaluation.lagnaSign} (Sign #${lagnaIdx}: ${evaluation.lagnaSign})`);
  lines.push(`BirthRashi (Moon Sign): ${profile.birth_rashi || evaluation.moonSign} (Sign #${moonIdx}: ${evaluation.moonSign})`);
  lines.push(`BirthStar (Janma Nakshatra): ${profile.birth_star || evaluation.janmaStar} | Pada: ${profile.birth_star_pada ?? 'N/A'}`);
  lines.push('');

  // 2. Birth Dasha Balance
  lines.push('[BIRTH DASHA BALANCE]');
  lines.push(`StartingMahadashaLordAtBirth: ${profile.starting_dasha_lord || dashaTree[0]?.mdLord || 'N/A'}`);
  lines.push(
    `RemainingBalanceAtBirth: ${profile.dasha_balance_years ?? 0}y ${profile.dasha_balance_months ?? 0}m ${profile.dasha_balance_days ?? 0}d`
  );
  if (profile.dasha_balance_text) {
    lines.push(`TraditionalBalanceNotation: ${profile.dasha_balance_text}`);
  }
  lines.push('');

  // 3. Conventions
  lines.push('[CONVENTIONS]');
  lines.push('L# = House counted from D1 Natal Lagna | M# = House counted from D1 Janma Rashi (Natal Moon)');
  lines.push('H# = House counted from the specific Divisional Chart (D9 / D2..D144) Lagna');
  lines.push('R = Retrograde (Vakra) | NB = Neecha Bhanga | Comb = Combust | SAV >= 28 Strong, 25-27 Neutral, < 25 Friction');
  lines.push('');

  // 4. Lordships & House Lords
  lines.push('[LORDSHIPS]');
  lines.push(
    ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']
      .map(p => {
        const s = evaluation.planetsD1[p];
        return `${p}: owns L${s.ownedHousesL.join(',L')} (M${s.ownedHousesM.join(',M')})`;
      })
      .join(' | ')
  );
  lines.push('');

  lines.push('[HOUSE LORDS]');
  const houseLordRows: string[] = [];
  for (let h = 1; h <= 12; h++) {
    const signIdx = ((lagnaIdx + h - 2) % 12) + 1;
    const signName = SIGN_NAMES_EN[signIdx - 1];
    const lord = SIGN_PRIMARY_LORD[signIdx];
    const lm = evaluation.planetsD1[lord];
    const tags: string[] = [];
    if (lm?.isRetro) tags.push('R');
    if (lm?.dignity) tags.push(lm.dignity);
    if (lm?.hasNeechaBhanga) tags.push('NB');
    if (lm?.isCombust) tags.push('Comb');
    houseLordRows.push(
      `L${h} (${signName}): Lord ${lord} -> sits L${lm?.hLagna || '?'}/M${lm?.hMoon || '?'} ${lm?.signName || '?'}${tags.length ? ` [${tags.join(', ')}]` : ''}`
    );
  }
  lines.push(...houseLordRows);
  lines.push('');

  // 5. D1 Rashi Chart (Complete Stored Rows)
  lines.push('[D1 RASHI CHART]');
  lines.push(`ChartCount: ${d1Rows.length} bodies | Lagna: ${evaluation.lagnaSign} | JanmaMoon: ${evaluation.moonSign}`);
  for (const r of d1Rows) {
    const pName = cleanNatalPlanetName(r.body_name);
    const sName = cleanNatalSignName(r.rashi_name);
    if (pName === 'Lagna' || pName === 'Mandi') {
      const sIdx = getSignIdxFromAny(sName, lagnaIdx);
      const hL = r.house_number || (((sIdx - lagnaIdx + 12) % 12) + 1);
      const hM = ((sIdx - moonIdx + 12) % 12) + 1;
      lines.push(
        `${pName} (${r.body_name}) | Sign: ${sName} | L${hL}/M${hM} | Deg: ${r.degree_sputa || '-'} | Nakshatra: ${r.nakshatra_name || '-'} P${r.pada ?? '-'}${r.is_retrograde ? ' | R' : ''}`
      );
      continue;
    }
    const p = evaluation.planetsD1[pName];
    if (!p) {
      lines.push(`${r.body_name} | Sign: ${sName} | House: L${r.house_number || '-'} | Deg: ${r.degree_sputa || '-'}`);
      continue;
    }
    const flags: string[] = [];
    if (p.isRetro) flags.push('R');
    if (p.dignity) flags.push(p.dignity);
    if (p.hasNeechaBhanga) flags.push(`NB(${p.neechaBhangaReasons.join('; ')})`);
    if (p.isCombust) flags.push(`Comb(${p.combustGapStr})`);
    flags.push(`SAV:${p.savAtSeat}${p.bavSelfAtSeat !== null ? `/BAV:${p.bavSelfAtSeat}` : ''}`);
    if (p.conjunctWith.length) flags.push(`Conj:${p.conjunctWith.join(',')}`);
    if (p.aspectTargetsL.length) flags.push(`AspectsL:${p.aspectTargetsL.map(h => `L${h}`).join(',')}`);
    lines.push(
      `${p.planet} | Sign: ${p.signName} | L${p.hLagna}/M${p.hMoon} | Deg: ${p.degStr} | Nakshatra: ${p.nakshatra} P${p.pada} | Owns: L${p.ownedHousesL.join(',L') || 'Node'} | Nat: ${p.functionalNature} | ${flags.join(' | ')}`
    );
  }
  lines.push('');

  // 6. D9 Navamsa Chart (Complete Stored Rows + Enriched Dignity)
  lines.push('[D9 NAVAMSA CHART]');
  const d9LagnaRow = d9Rows.find(r => cleanNatalPlanetName(r.body_name) === 'Lagna');
  const d9LagnaIdx = getSignIdxFromAny(d9LagnaRow?.rashi_name, 1);
  const d9LagnaSign = d9LagnaRow ? cleanNatalSignName(d9LagnaRow.rashi_name) : 'N/A';
  lines.push(`D9 Lagna: ${d9LagnaSign} (H1) | StoredRows: ${d9Rows.length}`);
  if (d9Rows.length > 0) {
    for (const r of d9Rows) {
      const pName = cleanNatalPlanetName(r.body_name);
      const sName = cleanNatalSignName(r.rashi_name);
      const sIdx = getSignIdxFromAny(sName, d9LagnaIdx);
      const hNum = r.house_number || (((sIdx - d9LagnaIdx + 12) % 12) + 1);
      if (pName === 'Lagna' || pName === 'Mandi') {
        lines.push(`${pName} | Sign: ${sName} | H${hNum}${r.is_retrograde ? ' | R' : ''}`);
        continue;
      }
      const p = evaluation.planetsD1[pName];
      const flags: string[] = [];
      if (p?.d9Dignity) flags.push(p.d9Dignity);
      if (p?.isVargottama) flags.push('Vargottama');
      if (r.is_retrograde || p?.isRetro) flags.push('R');
      lines.push(`${pName} | Sign: ${sName} | H${hNum}${flags.length ? ` | ${flags.join(', ')}` : ''}`);
    }
  } else {
    for (const g of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
      const p = evaluation.planetsD1[g];
      const flags: string[] = [];
      if (p.d9Dignity) flags.push(p.d9Dignity);
      if (p.isVargottama) flags.push('Vargottama');
      if (p.isRetro) flags.push('R');
      lines.push(`${g} | Sign: ${p.d9Sign} | H${p.d9House}${flags.length ? ` | ${flags.join(', ')}` : ''}`);
    }
  }
  lines.push('');

  // 7. ALL Divisional Vargas (Sorted Numerically D2..D144)
  const vargaCodes = Object.keys(evaluation.vargas).sort((a, b) => {
    const na = parseInt(a.replace(/[^\d]/g, ''), 10) || 0;
    const nb = parseInt(b.replace(/[^\d]/g, ''), 10) || 0;
    return na - nb;
  });
  lines.push(`[ALL DIVISIONAL VARGAS (${vargaCodes.length} CHARTS: ${vargaCodes.join(', ')})]`);
  for (const code of vargaCodes) {
    const vc = evaluation.vargas[code];
    if (!vc) continue;
    const occupied = vc.houses
      .filter(h => h.planets.length > 0)
      .map(h => `H${h.house} ${h.sign}: ${h.planets.join(', ')}`)
      .join(' | ');
    lines.push(`[VARGA ${vc.code} - ${vc.name.toUpperCase()}] Lagna: ${vc.lagnaSign} ${vc.lagnaDeg} | ${occupied}`);
  }
  lines.push('');

  // 8. Shadbala & Vimsopaka Strengths
  lines.push('[SHADBALA & VIMSOPAKA STRENGTHS]');
  if (is001) {
    for (const s of SHADBALA_STRENGTHS_001ME) {
      lines.push(
        `${s.planet}: Ratio ${s.ratio.toFixed(2)} (${s.total.toFixed(2)}/${s.required} Virupas, ${s.percent.toFixed(1)}% ${s.status}) | Sth:${s.sthana.toFixed(2)}, Dig:${s.dig.toFixed(2)}, Kaa:${s.kaala.toFixed(2)}, Che:${s.cheshta.toFixed(2)}, Nai:${s.naisargika.toFixed(2)}, Dri:${s.drik.toFixed(2)} | Ishta:${s.ishtaPhala.toFixed(2)}, Kashta:${s.kashtaPhala.toFixed(2)} | Vimsopaka: Shadvarga ${s.shadvargaVimsopaka}(${s.shadvargaAmsa}), Dashavarga ${s.dashavargaVimsopaka}(${s.dashavargaAmsa}), Shodashavarga ${s.shodashavargaVimsopaka}(${s.shodashavargaAmsa})`
      );
    }
  } else {
    for (const g of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']) {
      const p = evaluation.planetsD1[g];
      lines.push(
        `${g}: D1=${p.dignity || 'Neutral'}${p.hasNeechaBhanga ? '+NB' : ''}${p.isCombust ? '+Comb' : ''}${p.isRetro ? '+R' : ''} | D9=H${p.d9House} ${p.d9Sign}${p.isVargottama ? ' (Vargottama)' : p.d9Dignity ? ` (${p.d9Dignity})` : ''} | Nat=${p.functionalNature}`
      );
    }
  }
  lines.push('');

  // 9. SAV, BAV & Sodhya Pindas
  lines.push('[ASHTAKAVARGA: SAV & BAV & SODHYA PINDAS]');
  const savOverview = [...evaluation.ashtakavarga.allHousesOverview].sort((a, b) => a.houseNumber - b.houseNumber);
  lines.push(
    `SAV (Sum=${evaluation.ashtakavarga.savTotalSum}): ${savOverview.map(s => `L${s.houseNumber}(${cleanNatalSignName(s.signName)}):${s.points}`).join(' | ')}`
  );
  if (evaluation.ashtakavarga.bavByPlanet) {
    for (const pl of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']) {
      const pMap = evaluation.ashtakavarga.bavByPlanet[pl];
      if (!pMap) continue;
      let total = 0;
      const cols: string[] = [];
      for (let h = 1; h <= 12; h++) {
        const sIdx = ((lagnaIdx + h - 2) % 12) + 1;
        const pts = pMap[sIdx] ?? 0;
        total += pts;
        cols.push(`L${h}:${pts}`);
      }
      lines.push(`BAV ${pl} (Sum=${total}): ${cols.join(' | ')}`);
    }
  }
  if (is001) {
    const lCols: string[] = [];
    let lSum = 0;
    for (let h = 1; h <= 12; h++) {
      const sIdx = ((lagnaIdx + h - 2) % 12) + 1;
      const pts = CALIBRATED_ASHTAKAVARGA_001ME.lagnaBav[sIdx] ?? 0;
      lSum += pts;
      lCols.push(`L${h}:${pts}`);
    }
    lines.push(`BAV Lagna (Excluded from SAV, Sum=${lSum}): ${lCols.join(' | ')}`);
    lines.push(
      `Sodhya Pindas: ${CALIBRATED_ASHTAKAVARGA_001ME.sodhyaPindas
        .map(p => `${p.planet}: Rasi=${p.rasiPinda} + Graha=${p.grahaPinda} = Sodhya ${p.sodhyaPinda} (${p.pct}%)`)
        .join(' | ')}`
    );
  }
  lines.push('');

  // 10. Yogas & Doshas
  lines.push('[YOGAS & DOSHAS]');
  const yd = evaluation.yogasAndDoshas;
  if (yd.rajaYogas.length > 0) {
    lines.push(`Raja Yogas (${yd.rajaYogas.length}):`);
    for (const y of yd.rajaYogas) {
      lines.push(`- ${y.name} [${y.participants.join(', ')}]: ${y.condition}`);
    }
  } else {
    lines.push('Raja Yogas: None');
  }
  if (yd.generalYogas.length > 0) {
    lines.push(`General Yogas (${yd.generalYogas.length}):`);
    for (const y of yd.generalYogas) {
      lines.push(`- ${y.name}: ${y.condition}`);
    }
  } else {
    lines.push('General Yogas: None');
  }
  if (yd.doshas.length > 0) {
    lines.push(`Doshas (${yd.doshas.length}):`);
    for (const d of yd.doshas) {
      lines.push(`- ${d.name} (${d.status}): ${d.reasons.join('; ')}`);
    }
  } else {
    lines.push('Doshas: None detected');
  }
  lines.push('');

  // 11. Jaimini
  lines.push('[JAIMINI KARAKAS, KARAKAMSA & ARUDHAS]');
  lines.push(
    `Chara Karakas (7-Karaka): ${evaluation.jaiminiKarakas.map(k => `${k.rank}:${k.planet}(${k.degStr}, L${k.hL}/M${k.hM})`).join(' | ')}`
  );
  lines.push(
    evaluation.karakamsa
      ? `Karakamsa (KK): ${evaluation.karakamsa.signName} (D1 L${evaluation.karakamsa.hL}/M${evaluation.karakamsa.hM}, D9 H${evaluation.karakamsa.hD9})`
      : 'Karakamsa (KK): N/A'
  );
  lines.push(`Arudha Padas: ${evaluation.arudhas.map(a => `${a.label}=${a.signName}(L${a.hL}/M${a.hM})`).join(' | ')}`);
  lines.push('');

  // 12. 6-Aspect Structural Natal Promise & Karaka Map
  lines.push('[NATAL PROMISE BASELINE (6 LIFE ASPECTS — ZERO TRANSITS)]');
  for (const id of NATAL_ASPECT_ORDER) {
    const sp = NATAL_ASPECT_SPECS[id];
    const b = evaluation.baselineAspects[id];
    lines.push(
      `- ${b.label}: ${b.score}% [${b.band}] | ${b.verdict} | Houses: ${sp.houses.map(h => `L${h}`).join(',')} | Vargas: ${sp.vargas.join('/')} | Karakas: ${sp.karakas.join(',')} | Detail: ${b.focusHousesSummary}`
    );
  }
  lines.push('');

  // 13. Complete Lifetime Vimshottari MD -> AD -> PD Timeline
  const totalPdCount = dashaTree.reduce((acc, md) => acc + md.antardashas.reduce((a2, ad) => a2 + ad.pds.length, 0), 0);
  const firstStart = dashaTree[0]?.startDate || profile.date_of_birth || 'N/A';
  const lastEnd = dashaTree[dashaTree.length - 1]?.endDate || 'N/A';
  lines.push(`[COMPLETE VIMSHOTTARI DASHA TIMELINE (MD -> AD -> PD): ${firstStart} to ${lastEnd} | ${dashaTree.length} MDs, ${totalPdCount} PDs]`);
  for (const md of dashaTree) {
    lines.push(`MD #${md.index}: ${md.cleanMdLord} (${md.mdLord}) | ${md.startDate}..${md.endDate} (${md.totalDays}d)`);
    for (const ad of md.antardashas) {
      lines.push(`  AD #${md.index}.${ad.index}: ${md.cleanMdLord}-${ad.cleanAdLord} | ${ad.startDate}..${ad.endDate} (${ad.totalDays}d)`);
      for (const pd of ad.pds) {
        const extra: string[] = [];
        if (pd.savedRating !== null && pd.savedRating !== undefined) extra.push(`Rating:${pd.savedRating}`);
        if (pd.savedNote) extra.push(`Note:"${pd.savedNote}"`);
        lines.push(
          `    PD #${pd.index}: ${md.cleanMdLord} > ${ad.cleanAdLord} > ${pd.cleanPdLord} | ${pd.startDate}..${pd.endDate} (${pd.totalDays}d)${extra.length ? ` | ${extra.join(' | ')}` : ''}`
        );
      }
    }
  }

  return lines.join('\n');
}

/**
 * Splits `monthSlice` (from `buildOriginalSourcePrompt`) by top-level `[TAG]` blocks.
 */
function parseMonthSliceSections(monthSlice: string): Map<string, string> {
  const sections = new Map<string, string>();
  let currentTag = '';
  let buffer: string[] = [];

  for (const line of monthSlice.split('\n')) {
    const m = line.match(/^(\[[A-Z0-9 /:-]+\])$/);
    if (m) {
      if (currentTag) {
        sections.set(currentTag, buffer.join('\n'));
      }
      currentTag = m[1];
      buffer = [line];
    } else if (currentTag) {
      buffer.push(line);
    }
  }
  if (currentTag) {
    sections.set(currentTag, buffer.join('\n'));
  }
  return sections;
}

function enumerateCalendarMonths(startDate: string, endDate: string): Array<{ year: number; monthIndex: number }> {
  const [sy, sm] = startDate.split('-').map(Number);
  const [ey, em] = endDate.split('-').map(Number);
  if (!sy || !sm || !ey || !em) return [];

  const out: Array<{ year: number; monthIndex: number }> = [];
  let y = sy;
  let m = sm - 1;
  while (y < ey || (y === ey && m <= em - 1)) {
    out.push({ year: y, monthIndex: m });
    m += 1;
    if (m >= 12) {
      m = 0;
      y += 1;
    }
    if (out.length >= 24) break;
  }
  return out;
}

/**
 * 2. PURE TRANSIT + ACTIVE MD/AD/PD CORRELATION DUMP (/api/transit/dump)
 * Always LLM-compatible plain text.
 * - Zero `domain` filtering
 * - Zero natal charts (`D1..D144`, `SHADBALA`, `SAV/BAV`, `YOGAS`, `DOSHAS`, `JAIMINI` omitted)
 * - Explicitly correlates ALL overlapping Vimshottari MD -> AD -> PD timelines across the window
 *   (crucial when a month or date range crosses two ADs and multiple PDs).
 */
export function buildTransitDumpText(params: {
  personId: string;
  profile: DumpProfileInput;
  placements: NatalPlacementRow[];
  startDate: string;
  endDate: string;
  storedDashaRecords?: Array<any>;
  savedNotes?: DashaEvaluationRecord[];
  periodLabel?: string;
}): string {
  const { personId, profile, placements, startDate, endDate, storedDashaRecords, savedNotes = [], periodLabel } = params;

  const lagnaIdx = getSignIdxFromAny(profile.birth_lagna, 9);
  const moonIdx = getSignIdxFromAny(profile.birth_rashi, 8);
  const lagnaSign = SIGN_NAMES_EN[lagnaIdx - 1];
  const moonSign = SIGN_NAMES_EN[moonIdx - 1];
  const d1Rows = placements.filter(r => !r.chart_type || r.chart_type === 'D1');
  const is001 = personId === '001ME' || isChartSignature001ME(lagnaIdx, moonIdx, d1Rows);

  const tuples = resolvePersonTimelineTuples(personId, profile, placements, storedDashaRecords);
  const dashaRecordsForCtx = tuples.map(([md, ad, pd, s, e]) => ({
    person_id: personId,
    mahadasha_lord: md,
    antardasha_lord: ad,
    pratyantardasha_lord: pd,
    start_date: s,
    end_date: e
  }));

  const noteLookup = new Map<string, DashaEvaluationRecord>();
  for (const rec of savedNotes) {
    const key = [
      cleanNatalPlanetName(rec.mahadasha_lord_md),
      cleanNatalPlanetName(rec.antardasha_lord_ad),
      cleanNatalPlanetName(rec.pratyantardasha_lord_pd),
      String(rec.start_date).slice(0, 10)
    ].join('|');
    noteLookup.set(key, rec);
  }

  // Group full timeline so we know exact full MD and AD start/end dates alongside window overlaps
  const mdSpans = new Map<string, { mdLord: string; start: string; end: string }>();
  const adSpans = new Map<string, { mdLord: string; adLord: string; start: string; end: string }>();
  for (const [md, ad, , s, e] of tuples) {
    const cMd = cleanNatalPlanetName(md);
    const cAd = cleanNatalPlanetName(ad);
    const existingMd = mdSpans.get(cMd);
    if (!existingMd) {
      mdSpans.set(cMd, { mdLord: cMd, start: s, end: e });
    } else {
      if (s < existingMd.start) existingMd.start = s;
      if (e > existingMd.end) existingMd.end = e;
    }
    const adKey = `${cMd}|${cAd}`;
    const existingAd = adSpans.get(adKey);
    if (!existingAd) {
      adSpans.set(adKey, { mdLord: cMd, adLord: cAd, start: s, end: e });
    } else {
      if (s < existingAd.start) existingAd.start = s;
      if (e > existingAd.end) existingAd.end = e;
    }
  }

  const overlappingTuples = tuples.filter(([, , , s, e]) => s <= endDate && e >= startDate);
  const uniqueActiveMds: Array<{ mdLord: string; fullStart: string; fullEnd: string; ovStart: string; ovEnd: string }> = [];
  const uniqueActiveAds: Array<{ mdLord: string; adLord: string; fullStart: string; fullEnd: string; ovStart: string; ovEnd: string }> = [];

  for (const [md, ad, , s, e] of overlappingTuples) {
    const cMd = cleanNatalPlanetName(md);
    const cAd = cleanNatalPlanetName(ad);
    const fullMd = mdSpans.get(cMd);
    const fullAd = adSpans.get(`${cMd}|${cAd}`);
    const ov = clampIsoRange(s, e, startDate, endDate);

    if (!uniqueActiveMds.some(m => m.mdLord === cMd)) {
      const mOv = clampIsoRange(fullMd?.start || s, fullMd?.end || e, startDate, endDate);
      uniqueActiveMds.push({
        mdLord: cMd,
        fullStart: fullMd?.start || s,
        fullEnd: fullMd?.end || e,
        ovStart: mOv.start,
        ovEnd: mOv.end
      });
    }

    const lastAd = uniqueActiveAds[uniqueActiveAds.length - 1];
    if (!lastAd || lastAd.mdLord !== cMd || lastAd.adLord !== cAd) {
      const aOv = clampIsoRange(fullAd?.start || s, fullAd?.end || e, startDate, endDate);
      uniqueActiveAds.push({
        mdLord: cMd,
        adLord: cAd,
        fullStart: fullAd?.start || s,
        fullEnd: fullAd?.end || e,
        ovStart: aOv.start,
        ovEnd: aOv.end
      });
    } else if (ov.end > lastAd.ovEnd) {
      lastAd.ovEnd = ov.end;
    }
  }

  const totalSpanDays = diffDaysInclusive(startDate, endDate) + 1;
  const sdSubPeriods = totalSpanDays <= 65 ? computeSookshmaForPdTuples(overlappingTuples, startDate, endDate) : [];

  const lines: string[] = [];

  lines.push('=== PURE GOCHARA TRANSIT & ACTIVE DASHA-BHUKTI DUMP (NO NATAL CHARTS / NO DOMAIN FILTER) ===');
  lines.push('DumpFormat: LLM_COMPATIBLE_TEXT | DomainFilter: NONE | NatalChartsIncluded: NONE (D1..D144 omitted)');
  lines.push('');

  lines.push('[TRANSIT DUMP HEADER]');
  lines.push(`PersonID: ${personId}`);
  lines.push(`TransitWindow: ${startDate}..${endDate} (${totalSpanDays} days)${periodLabel ? ` | Label: ${periodLabel}` : ''}`);
  lines.push(`CoordinateAnchor: Lagna=${lagnaSign} (L1) | JanmaRashi=${moonSign} (M1) | JanmaStar=${profile.birth_star || 'Anuradha'} P${profile.birth_star_pada ?? 1}`);
  lines.push('Notation: L#=House from Natal Lagna | M#=House from Natal Moon | SAV=Sarvashtakavarga Bindus | CB=ChandraBala | Vakra=Retrograde');
  lines.push('');

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatCoveredMonthLabels = (sIso: string, eIso: string): string => {
    const ms = enumerateCalendarMonths(sIso, eIso);
    if (ms.length === 0) return `${sIso}..${eIso}`;
    return ms.map(m => `${MONTH_NAMES[m.monthIndex]} ${m.year}`).join(', ');
  };

  // Multi-MD / Multi-AD / Multi-PD Correlation Block
  lines.push('[CORRELATED DASHA-BHUKTI TIMELINE (MD > AD > PD)]');
  lines.push(
    `CorrelationSummary: All transit movements during ${startDate}..${endDate} occur across ${uniqueActiveMds.length} Mahadasha(s), ${uniqueActiveAds.length} Antardasha(s), and ${overlappingTuples.length} Pratyantardasha(s).`
  );
  if (uniqueActiveAds.length > 1) {
    lines.push(
      `AntardashaTransitionAlert: Window spans ${uniqueActiveAds.length} distinct Antardashas (${uniqueActiveAds.map(a => `${a.mdLord}/${a.adLord} [${a.ovStart}..${a.ovEnd}]`).join(' -> ')}).`
    );
  }
  if (overlappingTuples.length > 0) {
    lines.push('Sequential Timeline Summary (MD > AD > PD):');
    overlappingTuples.forEach(([md, ad, pd, s, e], idx) => {
      const cMd = cleanNatalPlanetName(md);
      const cAd = cleanNatalPlanetName(ad);
      const cPd = cleanNatalPlanetName(pd);
      const ov = clampIsoRange(s, e, startDate, endDate);
      const coveredMonths = formatCoveredMonthLabels(ov.start, ov.end);
      lines.push(
        `- Phase ${idx + 1}: ${ov.start} to ${ov.end} (${diffDaysInclusive(ov.start, ov.end) + 1}d) -> ${cMd} MD > ${cAd} AD > ${cPd} PD [Covers: ${coveredMonths} | Full PD Span: ${s}..${e}]`
      );
    });
  }
  lines.push('Active Mahadasha(s):');
  for (const m of uniqueActiveMds) {
    lines.push(`- MD: ${m.mdLord} | FullSpan: ${m.fullStart}..${m.fullEnd} | WindowOverlap: ${m.ovStart}..${m.ovEnd}`);
  }
  lines.push('Active Antardasha(s):');
  uniqueActiveAds.forEach((a, idx) => {
    lines.push(
      `- AD #${idx + 1}: ${a.mdLord} MD > ${a.adLord} AD | FullSpan: ${a.fullStart}..${a.fullEnd} | WindowOverlap: ${a.ovStart}..${a.ovEnd}`
    );
  });
  lines.push('Active Pratyantardasha Timeline (MD > AD > PD):');
  if (overlappingTuples.length === 0) {
    lines.push('- None resolved in date window');
  } else {
    overlappingTuples.forEach(([md, ad, pd, s, e], idx) => {
      const cMd = cleanNatalPlanetName(md);
      const cAd = cleanNatalPlanetName(ad);
      const cPd = cleanNatalPlanetName(pd);
      const ov = clampIsoRange(s, e, startDate, endDate);
      const rec = noteLookup.get(`${cMd}|${cAd}|${cPd}|${s}`);
      const extra: string[] = [];
      if (rec?.evaluation_rating !== null && rec?.evaluation_rating !== undefined) extra.push(`Rating:${rec.evaluation_rating}`);
      if (rec?.notes) extra.push(`Note:"${rec.notes}"`);
      lines.push(
        `- PD #${idx + 1}: MD:${cMd} > AD:${cAd} > PD:${cPd} | FullPD: ${s}..${e} (${diffDaysInclusive(s, e)}d) | WindowOverlap: ${ov.start}..${ov.end}${extra.length ? ` | ${extra.join(' | ')}` : ''}`
      );
    });
  }
  if (sdSubPeriods.length > 0) {
    lines.push(`Active Sookshmadasha (SD) Sub-Periods (${sdSubPeriods.length} switches inside ${startDate}..${endDate}):`);
    for (const sd of sdSubPeriods) {
      lines.push(`- SD: ${sd.md} > ${sd.ad} > ${sd.pd} > ${sd.sd} | ${sd.startUtc}..${sd.endUtc}`);
    }
  } else if (totalSpanDays > 65) {
    lines.push('Sookshmadasha (SD): Query a single-month window (<= 65 days) for full hourly SD breakdown.');
  }
  lines.push('');

  // Exact Start / End Snapshots & Ingresses for the arbitrary [startDate..endDate] window
  const ephemerisTimeline = generateClientTransitTimeline(startDate, endDate, lagnaIdx, moonIdx);
  lines.push(`[GOCHARA WINDOW SNAPSHOTS & INGRESSES (${startDate}..${endDate})]`);
  lines.push(`Window Start Snapshot (${startDate} 12:00 UTC):`);
  for (const p of ephemerisTimeline.transit_snapshot_start) {
    const nak = p.graha_pada_chara?.nakshatra_name || '-';
    const pada = p.graha_pada_chara?.pada ?? '-';
    const hL = p.relative_to_natal_lagna?.house_number ?? '-';
    const hM = p.relative_to_natal_rashi?.house_number ?? '-';
    const mot = p.motion_type || (p.is_retrograde ? 'Vakra' : 'Normal');
    lines.push(
      `  ${cleanNatalPlanetName(p.graha_name)} | ${cleanNatalSignName(p.transit_rashi_name)} | L${hL}/M${hM} | ${p.degree_sputa} | ${nak} P${pada} | Motion:${mot}`
    );
  }
  lines.push(`Window End Snapshot (${endDate} 12:00 UTC):`);
  for (const p of ephemerisTimeline.transit_snapshot_end) {
    const nak = p.graha_pada_chara?.nakshatra_name || '-';
    const pada = p.graha_pada_chara?.pada ?? '-';
    const hL = p.relative_to_natal_lagna?.house_number ?? '-';
    const hM = p.relative_to_natal_rashi?.house_number ?? '-';
    const mot = p.motion_type || (p.is_retrograde ? 'Vakra' : 'Normal');
    lines.push(
      `  ${cleanNatalPlanetName(p.graha_name)} | ${cleanNatalSignName(p.transit_rashi_name)} | L${hL}/M${hM} | ${p.degree_sputa} | ${nak} P${pada} | Motion:${mot}`
    );
  }
  lines.push(`Planetary Ingresses & Motion Spans Within Window (${ephemerisTimeline.major_transits_timeline.length}):`);
  for (const ev of ephemerisTimeline.major_transits_timeline) {
    lines.push(
      `  ${cleanNatalPlanetName(ev.graha_name)}: ${ev.start_date}..${ev.end_date} | ${cleanNatalSignName(ev.transit_rashi_name)} | L${ev.house_from_natal_lagna}/M${ev.house_from_natal_rashi} | ${ev.nakshatra_name} P${ev.pada} | ${ev.is_retrograde ? 'Vakra' : 'Direct'}`
    );
  }
  lines.push('');

  // Rich Monthly Gochara Telemetry (Sequential Months One After Another + Per-Month MD>AD>PD Below Each Month)
  const months = enumerateCalendarMonths(startDate, endDate);
  const maxMonths = 24;
  const chartSource: ChartSourceOverride = {
    person: profile as any,
    placements: placements as any,
    dashaRecords: dashaRecordsForCtx
  };

  for (let i = 0; i < Math.min(months.length, maxMonths); i++) {
    const { year, monthIndex } = months[i];
    const ctx = buildMonthlyVedicContext(year, monthIndex, chartSource, 'master');
    const promptRes = buildOriginalSourcePrompt(ctx, 'compact', 'master');
    const secMap = parseMonthSliceSections(promptRes.monthSlice);

    const lastDayNum = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const mStr = String(monthIndex + 1).padStart(2, '0');
    const calStart = `${year}-${mStr}-01`;
    const calEnd = `${year}-${mStr}-${String(lastDayNum).padStart(2, '0')}`;
    const effMonthStart = calStart > startDate ? calStart : startDate;
    const effMonthEnd = calEnd < endDate ? calEnd : endDate;

    lines.push(
      `=== MONTH ${i + 1} OF ${Math.min(months.length, maxMonths)}: ${promptRes.meta.monthLabel} (${effMonthStart}..${effMonthEnd}) ===`
    );
    const tagsToKeep = [
      '[PERIOD]',
      '[SLOW PLANETS]',
      '[DOUBLE TRANSIT]',
      '[FAST PLANETS]',
      '[EVENTS]',
      '[HOUSE MAP]',
      '[LUNAR]',
      '[AD CHAMBER/GATES]',
      '[TRIGGER WINDOWS]'
    ];

    for (const tag of tagsToKeep) {
      const secText = secMap.get(tag);
      if (!secText) continue;
      if (tag === '[TRIGGER WINDOWS]' && !is001) {
        const filteredRows = secText
          .split('\n')
          .filter(l => !l.includes('|SD:'))
          .join('\n');
        lines.push(filteredRows);
      } else {
        lines.push(secText);
      }
    }

    // Per-month active MD > AD > PD summary directly below each month's transit details
    const monthPds = tuples.filter(([, , , s, e]) => s <= effMonthEnd && e >= effMonthStart);
    lines.push(`[ACTIVE DASHA-BHUKTI (MD > AD > PD) IN ${promptRes.meta.monthLabel.toUpperCase()} (${effMonthStart}..${effMonthEnd})]`);
    if (monthPds.length === 0) {
      lines.push('- None resolved for this month');
    } else {
      monthPds.forEach(([md, ad, pd, s, e], idx) => {
        const cMd = cleanNatalPlanetName(md);
        const cAd = cleanNatalPlanetName(ad);
        const cPd = cleanNatalPlanetName(pd);
        const mOv = clampIsoRange(s, e, effMonthStart, effMonthEnd);
        const isFullMonth = mOv.start === effMonthStart && mOv.end === effMonthEnd;
        const spanTag = isFullMonth ? 'full month' : 'partial month';
        const rec = noteLookup.get(`${cMd}|${cAd}|${cPd}|${s}`);
        const extra: string[] = [];
        if (rec?.evaluation_rating !== null && rec?.evaluation_rating !== undefined) extra.push(`Rating:${rec.evaluation_rating}`);
        if (rec?.notes) extra.push(`Note:"${rec.notes}"`);
        lines.push(
          `- ${mOv.start}..${mOv.end} (${spanTag}) -> MD:${cMd} > AD:${cAd} > PD:${cPd} | FullPD:${s}..${e}${monthPds.length > 1 ? ` [Segment ${idx + 1}/${monthPds.length}]` : ''}${extra.length ? ` | ${extra.join(' | ')}` : ''}`
        );
      });
    }
    lines.push('');
  }

  if (months.length > maxMonths) {
    lines.push(
      `[NOTE] Detailed per-month transit breakdown emitted for the first ${maxMonths} months (${months.length} months spanned).`
    );
  }

  return lines.join('\n');
}
