/**
 * Transit-Free "Original Heartbeat" Natal Master Prompt Builder & Multi-LLM Runner.
 *
 * Includes ALL natal chart layers (Rules, Conventions, Lordships, House Lords, D1, D9,
 * Shadbala, SAV/BAV, Sodhya Pindas, Yogas, Doshas, Jaimini 7-Karaka/KK/Arudhas, 6-Aspect Karakas,
 * ALL Divisional Vargas D2..D30/D60) + Selected MD -> AD -> All 9 Sequential PDs + Focus Question.
 *
 * Contains ZERO transit (Gochara) data.
 */

import {
  CALIBRATED_ASHTAKAVARGA_001ME,
  SHADBALA_STRENGTHS_001ME,
  isChartSignature001ME
} from '../data/vargaAndStrengthData';
import { persistLLMPromptLog } from '../services/llm/adapters';
import { getPreferredGeminiModel } from '../services/llm/geminiModels';
import { LLM_PROVIDERS, LLMProviderId } from '../services/llm/types';
import {
  NATAL_ASPECT_ORDER,
  NATAL_ASPECT_SPECS,
  NatalAspectId,
  NatalDashaPromiseEvaluation,
  NatalPlacementRow,
  cleanNatalPlanetName,
  cleanNatalSignName
} from './natalDashaPromiseEngine';

export type NatalDashaLevelScope = 'md' | 'ad' | 'pd' | 'all_levels';

export interface NatalDashaPromptResult {
  prompt: string;
  systemInstruction: string;
  scope: NatalDashaLevelScope;
  scopeLabel: string;
  pdIndex?: number;
  sectionSummary: Array<{ tag: string; label: string; lines: number }>;
  charCount: number;
  approxTokens: number;
  zeroTransitsVerified: boolean;
}

export interface NatalDashaAiSynthesisResult {
  success: boolean;
  answerMarkdown: string;
  providerUsed: LLMProviderId;
  modelUsed: string;
  executionTimeMs: number;
  promptSent: string;
  systemInstruction: string;
  tokenTelemetry?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  error?: string;
}

const SIGN_NAMES_EN = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const SIGN_PRIMARY_LORD: Record<number, string> = {
  1: 'Mars', 2: 'Venus', 3: 'Mercury', 4: 'Moon',
  5: 'Sun', 6: 'Mercury', 7: 'Venus', 8: 'Mars',
  9: 'Jupiter', 10: 'Saturn', 11: 'Saturn', 12: 'Jupiter'
};

export function buildNatalDashaMasterPrompt(params: {
  evaluation: NatalDashaPromiseEvaluation;
  rawPlacements: NatalPlacementRow[];
  focusQuestion?: string;
  aspectFilter?: NatalAspectId | 'all';
  scope?: NatalDashaLevelScope;
  pdIndex?: number;
}): NatalDashaPromptResult {
  const {
    evaluation,
    rawPlacements,
    focusQuestion,
    aspectFilter = 'all',
    scope = 'all_levels',
    pdIndex
  } = params;

  const focusedPd =
    scope === 'pd'
      ? evaluation.pdWalkthrough.find(item => item.pdOption.index === (pdIndex ?? 1)) || evaluation.pdWalkthrough[0]
      : undefined;

  const mdLord = evaluation.selectedMd.cleanMdLord;
  const adLord = evaluation.selectedAd.cleanAdLord;
  const pdLord = focusedPd?.pdSummary.planet || '';

  const scopeLabel =
    scope === 'md'
      ? `${mdLord} Mahadasha (${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate})`
      : scope === 'ad'
      ? `${mdLord} MD > ${adLord} Antardasha (${evaluation.selectedAd.startDate} to ${evaluation.selectedAd.endDate})`
      : scope === 'pd' && focusedPd
      ? `PD #${focusedPd.pdOption.index}: ${pdLord} inside ${mdLord}–${adLord} (${focusedPd.pdOption.startDate} to ${focusedPd.pdOption.endDate})`
      : `${mdLord} MD > ${adLord} AD + All 9 PDs`;

  const cleanQuestion = (focusQuestion || '').replace(/[\r\n]+/g, ' ').trim();
  const effectiveQuestion = cleanQuestion
    ? cleanQuestion
    : scope === 'md'
    ? `Write a complete Mahadasha Natal Promise Report for ${mdLord} Mahadasha (${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate}) across Career, Finance, Love, Family, Health, and Litigations, plus how its Antardasha sub-cycles unfold (purely natal, zero transits).`
    : scope === 'ad'
    ? `Write a complete Antardasha Natal Promise Report for ${mdLord} MD > ${adLord} AD (${evaluation.selectedAd.startDate} to ${evaluation.selectedAd.endDate}) across Career, Finance, Love, Family, Health, and Litigations, summarizing the arc across its 9 Pratyantardashas (purely natal, zero transits).`
    : scope === 'pd' && focusedPd
    ? `Write a focused Pratyantardasha Natal Promise Report for PD #${focusedPd.pdOption.index} (${pdLord}, ${focusedPd.pdOption.startDate} to ${focusedPd.pdOption.endDate}, ${focusedPd.pdOption.totalDays} days) operating inside ${mdLord} MD > ${adLord} AD across Career, Finance, Love, Family, Health, and Litigations (purely natal, zero transits).`
    : aspectFilter === 'all'
    ? `Give a complete Natal + Dasha-Bhukti promise reading for ${mdLord} MD > ${adLord} AD and all 9 Pratyantardashas across Career, Finance, Love, Family, Health, and Litigations (purely natal, zero transits).`
    : `Evaluate ${NATAL_ASPECT_SPECS[aspectFilter].label} across ${mdLord} MD > ${adLord} AD and walk sequentially through all 9 Pratyantardashas using natal charts & Dasha-Bhukti only.`;

  const lagnaIdx = evaluation.lagnaIdx;
  const moonIdx = evaluation.moonIdx;
  const is001 = evaluation.personId === '001ME' || isChartSignature001ME(lagnaIdx, moonIdx, rawPlacements);

  const systemInstruction =
    'You are a Classical Parashara & Jaimini Vedic Astrologer. Evaluate ONLY the natal chart promise (D1, D9, Divisional Vargas D2..D30/D60, SAV/BAV, Shadbala, Yogas/Doshas, Jaimini) and the selected Mahadasha, Antardasha, and Pratyantardashas. Do NOT invent or assume Gochara transits—state clearly that external delivery timing/intensity depends on planetary transits elsewhere.';

  // 1. [RULES] (Transit-Free Natal Dasha Promise Laws)
  const rulesText = [
    'R0:NATAL_ONLY_LAW: Analyze strictly Natal Charts (D1, D9, Divisional Vargas D2..D30) + Vimshottari MD/AD/PD timelines provided below. ZERO Gochara transits are supplied or permitted in reasoning; explicitly note that transits govern external timing & magnitude.',
    'R1:HOUSE_NOTATION: D1 uses L#(house from D1 Lagna) and M#(house from Natal Moon) together; H# is strictly for D9 Navamsa and Divisional Charts (D2..D30).',
    'R2:DASHA_DELIVERY_CHAIN: Mahadasha (MD) sets macro karma & primary agenda; Antardasha (AD) channels MD through MD-AD Sambandha (1/5/9 harmony, 4/7/10 Kendra drive, 3/11 Upachaya, 6/8 Shadashtaka testing, 2/12 Dwirdwadasha cost) and dispositor/aspect ties; each of the 9 Pratyantardashas (PD) fires sequentially along that MD-AD corridor.',
    'R3:ASPECT_ROUTING: Route each of the 6 life aspects through both D1 Bhava/Karaka and confirming Vargas — Career(L10/L6/L11 + D10), Finance(L2/L11/L5/L9/L4 + D2/D11/D4), Love/Marriage(L7/L5/L11/L12 + D9/D7/D30), Family(L4/L2/L5/L9 + D4/D12/D7/D16), Health(L1/L6/L8/L12 + D6/D8/D27/D30), Litigations/Disputes(L6/L8/L12/L9/L7 + D6/D8/D30/D4).',
    'R4:FOCUS_QUESTION_DIRECTNESS: When a specific Focus Question is asked (e.g. marriage timing, litigation risk, career change within the chosen MD/AD/PD), answer Yes/Likely/Conditional/Unlikely directly up front with exact D1+D9+Varga proof.'
  ].join('\n');

  // 2. [CONVENTIONS]
  const conventionsText = [
    'Notation: L#=House from D1 Lagna | M#=House from Janma Rashi(Moon) | H#=Divisional House from that Varga Lagna',
    'Strengths: SAV>=28 Strong, 25-27 Neutral, <25 Friction | Shadbala>=1.00 Strong/<1.00 Weak | NB=Neecha Bhanga | R=Retrograde | Comb=Combust',
    'Calibration: Cite real planetary house seats, lordships, aspects, and Vargas directly from this dataset; never fabricate data.'
  ].join('\n');

  // 3. [PERSON] (Anonymized ID, zero personal PII name/city)
  const personBlock = [
    `RefID:${evaluation.personId} | DOB:${evaluation.profile.date_of_birth || 'N/A'} | Age:${evaluation.profile.age ?? 'N/A'}`,
    `Lagna:${evaluation.lagnaSign} (L1) | JanmaRashi:${evaluation.moonSign} (M1) | JanmaStar:${evaluation.janmaStar} | StartingDasha:${evaluation.profile.starting_dasha_lord || 'N/A'}`
  ].join('\n');

  // 4. [LORDSHIPS] & 5. [HOUSE LORDS]
  const lordshipEntries = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map(p => {
    const s = evaluation.planetsD1[p];
    return `${p}:L${s.ownedHousesL.join(',L')}(M${s.ownedHousesM.join(',M')})`;
  }).join(' | ');

  const houseLordEntries: string[] = [];
  for (let h = 1; h <= 12; h++) {
    const signIdx = ((lagnaIdx + h - 2) % 12) + 1;
    const lord = SIGN_PRIMARY_LORD[signIdx];
    const lm = evaluation.planetsD1[lord];
    const tags: string[] = [];
    if (lm?.isRetro) tags.push('R');
    if (lm?.dignity === 'Own' || lm?.dignity === 'Exalted' || lm?.dignity?.startsWith('Debil')) tags.push(lm.dignity);
    if (lm?.hasNeechaBhanga) tags.push('NB');
    if (lm?.isCombust) tags.push('Comb');
    houseLordEntries.push(`L${h}:${lord}@L${lm?.hLagna || '?'}(M${lm?.hMoon || '?'})${tags.length ? `[${tags.join(',')}]` : ''}`);
  }

  // 6. [D1]
  const d1RowsFiltered = rawPlacements.filter(r => !r.chart_type || r.chart_type === 'D1');
  const d1Lines = d1RowsFiltered.map(r => {
    const pName = cleanNatalPlanetName(r.body_name);
    const sName = cleanNatalSignName(r.rashi_name);
    if (pName === 'Lagna' || pName === 'Mandi') {
      const sIdx = SIGN_NAMES_EN.findIndex(x => x === sName) + 1 || lagnaIdx;
      const hL = r.house_number || (((sIdx - lagnaIdx + 12) % 12) + 1);
      const hM = ((sIdx - moonIdx + 12) % 12) + 1;
      return `${pName} | ${sName} | L${hL}/M${hM} | ${r.degree_sputa || '-'} | ${r.nakshatra_name || '-'} P${r.pada || 1}`;
    }
    const p = evaluation.planetsD1[pName];
    if (!p) return `${pName} | ${sName}`;
    const flags: string[] = [];
    if (p.isRetro) flags.push('R');
    if (p.dignity) flags.push(p.dignity);
    if (p.hasNeechaBhanga) flags.push(`NB(${p.neechaBhangaReasons.join('; ')})`);
    if (p.isCombust) flags.push(`Comb(${p.combustGapStr})`);
    if (p.conjunctWith.length) flags.push(`Conj:${p.conjunctWith.join(',')}`);
    if (p.aspectTargetsL.length) flags.push(`AspL:${p.aspectTargetsL.map(h => `L${h}`).join(',')}`);
    return `${p.planet} | ${p.signName} | L${p.hLagna}/M${p.hMoon} | ${p.degStr} | ${p.nakshatra} P${p.pada} | Nat:${p.functionalNature}${flags.length ? ` | ${flags.join(', ')}` : ''}`;
  });

  // 7. [D9]
  const d9Lines = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'].map(g => {
    const p = evaluation.planetsD1[g];
    const flags: string[] = [];
    if (p.d9Dignity) flags.push(p.d9Dignity);
    if (p.isVargottama) flags.push('Vargottama');
    if (p.isRetro) flags.push('R');
    return `${g} | ${p.d9Sign} | H${p.d9House}${flags.length ? ` | ${flags.join(', ')}` : ''}`;
  });

  // 8. [SHADBALA]
  const shadbalaLines = is001
    ? SHADBALA_STRENGTHS_001ME.map(
        s => `${s.planet} ${s.ratio.toFixed(2)} (${s.total.toFixed(1)}/${s.required}, ${s.percent.toFixed(1)}% ${s.status}) | Sth:${s.sthana.toFixed(1)}, Dig:${s.dig.toFixed(1)}, Kaa:${s.kaala.toFixed(1)}, Che:${s.cheshta.toFixed(1)}, Nai:${s.naisargika.toFixed(1)}, Dri:${s.drik.toFixed(1)} | Ishta:${s.ishtaPhala.toFixed(1)}, Kashta:${s.kashtaPhala.toFixed(1)} | Vimsopaka: Shadvarga ${s.shadvargaVimsopaka}(${s.shadvargaAmsa}), Shodashavarga ${s.shodashavargaVimsopaka}(${s.shodashavargaAmsa})`
      )
    : ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map(g => {
        const p = evaluation.planetsD1[g];
        return `${g} | D1:${p.dignity}${p.hasNeechaBhanga ? '+NB' : ''}${p.isCombust ? '+Comb' : ''}${p.isRetro ? '+Vakra' : ''} | D9:H${p.d9House}${p.isVargottama ? '(Vargottama)' : p.d9Dignity ? `(${p.d9Dignity})` : ''} | Nat:${p.functionalNature}`;
      });

  // 9. [SAV] & [BAV] & [PINDAS]
  const savOverview = [...evaluation.ashtakavarga.allHousesOverview].sort((a, b) => a.houseNumber - b.houseNumber);
  const savLine = `${savOverview.map(s => `L${s.houseNumber}:${s.points}`).join(', ')} | Sum:${evaluation.ashtakavarga.savTotalSum}`;

  const bavRows: string[] = [];
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
      bavRows.push(`${pl}(${total}): ${cols.join(', ')}`);
    }
  }
  const pindasLine = is001
    ? CALIBRATED_ASHTAKAVARGA_001ME.sodhyaPindas.map(p => `${p.planet}: R${p.rasiPinda}+G${p.grahaPinda}=${p.sodhyaPinda}(${p.pct}%)`).join(' | ')
    : 'Sodhya Pindas: Computed dynamically from D1 BAV when calibrated table unavailable';

  // 10. [YOGAS] & [DOSHAS]
  const yd = evaluation.yogasAndDoshas;
  const yogasLine = [
    yd.rajaYogas.length ? `Raja Yogas (${yd.rajaYogas.length}): ${yd.rajaYogas.map(y => `${y.name} [${y.participants.join(',')}] (${y.condition})`).join(' | ')}` : 'Raja Yogas: None',
    yd.generalYogas.length ? `General Yogas (${yd.generalYogas.length}): ${yd.generalYogas.map(y => `${y.name} (${y.condition})`).join(' | ')}` : 'General Yogas: None'
  ].join('\n');
  const doshasLine = yd.doshas.length
    ? yd.doshas.map(d => `${d.name} (${d.status}): ${d.reasons.join('; ')}`).join('\n')
    : 'None detected';

  // 11. [JAIMINI]
  const jaiminiLine = [
    `7-Karaka: ${evaluation.jaiminiKarakas.map(k => `${k.rank}:${k.planet}(${k.degStr} L${k.hL}/M${k.hM})`).join(' | ')}`,
    `${evaluation.karakamsa ? `KK:${evaluation.karakamsa.signName}(D1 L${evaluation.karakamsa.hL}/M${evaluation.karakamsa.hM}, D9 H${evaluation.karakamsa.hD9})` : 'KK:N/A'} | ${evaluation.arudhas.map(a => `${a.label}:${a.signName}(L${a.hL}/M${a.hM})`).join(', ')}`
  ].join('\n');

  // 12. [KARAKAS] (All 6 Aspects)
  const karakaLine = NATAL_ASPECT_ORDER.map(id => {
    const sp = NATAL_ASPECT_SPECS[id];
    return `${sp.shortLabel}: ${sp.houses.map(h => `L${h}`).join(',')}, Vargas:${sp.vargas.join('/')}, Karakas:${sp.karakas.join(',')}`;
  }).join('\n');

  // 13. ALL DIVISIONAL VARGAS (D2..D30 + D60 if present)
  const vargaCodesToEmit = ['D2', 'D3', 'D4', 'D6', 'D7', 'D8', 'D10', 'D11', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D60'];
  const vargaBlocks: string[] = [];
  for (const code of vargaCodesToEmit) {
    const vc = evaluation.vargas[code];
    if (!vc) continue;
    const occupiedRows = vc.houses
      .filter(h => h.planets.length > 0)
      .map(h => `H${h.house} ${h.sign}:${h.planets.map(p => cleanNatalPlanetName(p)).join(',')}`)
      .join(' | ');
    vargaBlocks.push(`[VARGA ${vc.code} ${vc.name.toUpperCase()}]\nLagna: ${vc.lagnaSign} ${vc.lagnaDeg} | ${occupiedRows}`);
  }

  // 14. [DASHA BHUKTI NATAL PROMISE] — ZERO TRANSITS (Scoped by MD / AD / PD / All)
  const md = evaluation.mdSummary;
  const ad = evaluation.adSummary;
  const baselineLines = NATAL_ASPECT_ORDER.map(id => {
    const b = evaluation.baselineAspects[id];
    return `- ${b.label}: ${b.score}% [${b.band}] — ${b.verdict} | ${b.focusHousesSummary}`;
  }).join('\n');

  const mdAspectLines = NATAL_ASPECT_ORDER.map(id => {
    const m = evaluation.mdAspects[id];
    return `- ${m.label}: ${m.score}% (${m.tone}) — ${m.verdict} | ${m.rationale}`;
  }).join('\n');

  const adAspectLines = NATAL_ASPECT_ORDER.map(id => {
    const a = evaluation.adAspects[id];
    return `- ${a.label}: ${a.score}% (${a.tone}) — ${a.verdict} | ${a.rationale}`;
  }).join('\n');

  const mdAdRoadmapLines = evaluation.selectedMd.antardashas
    .map(
      subAd =>
        `#${subAd.index} ${mdLord}-${subAd.cleanAdLord} AD (${subAd.startDate}..${subAd.endDate}, ${subAd.totalDays}d)`
    )
    .join('\n');

  const pdWalkLines = evaluation.pdWalkthrough
    .map(item => {
      const p = item.pdSummary;
      const aspShort = NATAL_ASPECT_ORDER.map(id => `${NATAL_ASPECT_SPECS[id].shortLabel}:${item.aspectEvaluations[id].score}%`).join(' ');
      const noteStr = item.pdOption.savedNote ? ` | RecordedNote:"${item.pdOption.savedNote}"` : '';
      return `#${item.pdOption.index} ${item.pdOption.startDate}..${item.pdOption.endDate} (${item.pdOption.totalDays}d) PD:${p.planet} [L${p.hLagna}/M${p.hMoon}, ${p.dignity || 'Neutral'}, owns L${p.ownedHousesL.join('/L') || 'Node'}] | LinkAD:${item.linkToAd.patternLabel} | LinkMD:${item.linkToMd.patternLabel} | Vargas:${item.vargaHighlights.join(', ')} | Aspects:[${aspShort}]${noteStr}`;
    })
    .join('\n');

  let dashaScopeHeader = '';
  let dashaBlock = '';
  let outputStructure = '';

  if (scope === 'md') {
    dashaScopeHeader = `SCOPE: MAHADASHA LEVEL ONLY — ${mdLord} Mahadasha (${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate})`;
    dashaBlock = [
      dashaScopeHeader,
      `Selected MD: ${mdLord} (${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate}, ${evaluation.selectedMd.totalDays} days) — Seat L${md.hLagna}/M${md.hMoon} ${md.signName}, Nat:${md.functionalNature}, Dignity:${md.dignity}${md.hasNeechaBhanga ? '+NB' : ''}${md.isCombust ? '+Comb' : ''}${md.isRetro ? ' [R]' : ''}, D9 H${md.d9House} ${md.d9Sign}, SAV:${md.savAtSeat}, Owns L${md.ownedHousesL.join('/L') || 'Node'}`,
      `Natal Baseline (6 Aspects):\n${baselineLines}`,
      `${mdLord} Mahadasha Deterministic Baseline (6 Aspects):\n${mdAspectLines}`,
      `Antardasha Roadmap Inside ${mdLord} Mahadasha:\n${mdAdRoadmapLines}`
    ].join('\n\n');

    outputStructure = [
      'Respond in clean, well-structured Markdown prose & tables (NO JSON fences). Strictly DO NOT mention or invent any Gochara transits.',
      `### 1. Executive Verdict for ${mdLord} Mahadasha (${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate})`,
      'Answer any Focus Question directly up front (Yes/Likely/Conditional/Unlikely) and summarize the core karmic agenda of this Mahadasha using D1 (L#/M#), D9 (H#), Shadbala, SAV, Yogas/Doshas, and Vargas.',
      '### 2. Six-Aspect Mahadasha Promise Report (Career, Finance, Love, Family, Health, Litigations)',
      'Dedicate a clear verdict + astrological proof (citing specific D1/D9/Varga seats and lordships) for EACH of the 6 life aspects during this Mahadasha.',
      `### 3. Key Antardasha Phases Inside ${mdLord} MD`,
      'Highlight which Antardashas within this Mahadasha act as peak delivery windows vs testing/frictional corridors based on natal Sambandha.',
      '### 4. Transit (Gochara) Delivery Disclaimer',
      'Close with a brief 2-line reminder that this reading reflects structural Natal + Mahadasha promise only, and exact external timing/amplitude is governed by Gochara transits.'
    ].join('\n');
  } else if (scope === 'ad') {
    dashaScopeHeader = `SCOPE: ANTARDASHA LEVEL — ${mdLord} MD > ${adLord} AD (${evaluation.selectedAd.startDate} to ${evaluation.selectedAd.endDate})`;
    dashaBlock = [
      dashaScopeHeader,
      `Parent MD: ${mdLord} (${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate}) — Seat L${md.hLagna}/M${md.hMoon} ${md.signName}, Nat:${md.functionalNature}, Dignity:${md.dignity}${md.hasNeechaBhanga ? '+NB' : ''}, D9 H${md.d9House}, Owns L${md.ownedHousesL.join('/L') || 'Node'}`,
      `Selected AD: ${adLord} (${evaluation.selectedAd.startDate} to ${evaluation.selectedAd.endDate}, ${evaluation.selectedAd.totalDays} days) — Seat L${ad.hLagna}/M${ad.hMoon} ${ad.signName}, Nat:${ad.functionalNature}, Dignity:${ad.dignity}${ad.hasNeechaBhanga ? '+NB' : ''}, D9 H${ad.d9House}, SAV:${ad.savAtSeat}, Owns L${ad.ownedHousesL.join('/L') || 'Node'}`,
      `MD-AD Sambandha: ${evaluation.mdAdSambandha.summary} (${evaluation.mdAdSambandha.patternLabel}, ${evaluation.mdAdSambandha.friendshipLabel})`,
      `Natal Baseline (6 Aspects):\n${baselineLines}`,
      `MD–AD Deterministic Scores (6 Aspects):\n${adAspectLines}`,
      `All 9 Sequential PDs inside ${mdLord} MD > ${adLord} AD:\n${pdWalkLines}`
    ].join('\n\n');

    outputStructure = [
      'Respond in clean, well-structured Markdown prose & tables (NO JSON fences). Strictly DO NOT mention or invent any Gochara transits.',
      `### 1. Executive Verdict for ${mdLord}–${adLord} Antardasha (${evaluation.selectedAd.startDate} to ${evaluation.selectedAd.endDate})`,
      'Answer any Focus Question directly up front and explain how the Antardasha lord channels the Mahadasha through their D1/D9 Sambandha.',
      '### 2. Six-Aspect Antardasha Promise Breakdown',
      'Provide clear verdicts and natal D1+D9+Varga reasoning for Career, Finance, Love, Family, Health, and Litigations.',
      `### 3. How the 9 Pratyantardashas Unfold Inside ${mdLord}–${adLord}`,
      'Summarize the chronological arc across all 9 PDs (peak opening/harvest PDs vs sensitive/caution PDs with exact dates).',
      '### 4. Transit (Gochara) Delivery Disclaimer',
      'Close with a brief 2-line reminder that this reading reflects structural Natal + Antardasha promise only, and exact external timing/amplitude is governed by Gochara transits.'
    ].join('\n');
  } else if (scope === 'pd' && focusedPd) {
    const p = focusedPd.pdSummary;
    const pdAspectLines = NATAL_ASPECT_ORDER.map(id => {
      const ev = focusedPd.aspectEvaluations[id];
      return `- ${NATAL_ASPECT_SPECS[id].label}: ${ev.score}% (${ev.tone}) — ${ev.verdict} | ${ev.rationale}`;
    }).join('\n');

    dashaScopeHeader = `SCOPE: PRATYANTARDASHA LEVEL — PD #${focusedPd.pdOption.index}: ${p.planet} (${focusedPd.pdOption.startDate} to ${focusedPd.pdOption.endDate}, ${focusedPd.pdOption.totalDays} days) inside ${mdLord} MD > ${adLord} AD`;
    dashaBlock = [
      dashaScopeHeader,
      `Parent Corridor: ${mdLord} MD (${evaluation.selectedMd.startDate}..${evaluation.selectedMd.endDate}) > ${adLord} AD (${evaluation.selectedAd.startDate}..${evaluation.selectedAd.endDate}) | MD-AD Sambandha: ${evaluation.mdAdSambandha.patternLabel}`,
      `Focused PD #${focusedPd.pdOption.index}: ${p.planet} (${focusedPd.pdOption.startDate} to ${focusedPd.pdOption.endDate}, ${focusedPd.pdOption.totalDays} days) — Seat L${p.hLagna}/M${p.hMoon} ${p.signName}, Nat:${p.functionalNature}, Dignity:${p.dignity || 'Neutral'}${p.hasNeechaBhanga ? '+NB' : ''}${p.isCombust ? '+Comb' : ''}${p.isRetro ? ' [R]' : ''}, D9 H${p.d9House} ${p.d9Sign}, SAV:${p.savAtSeat}, Owns L${p.ownedHousesL.join('/L') || 'Node'}`,
      `PD Ties: Link to AD(${adLord}): ${focusedPd.linkToAd.patternLabel} (${focusedPd.linkToAd.friendshipLabel}) | Link to MD(${mdLord}): ${focusedPd.linkToMd.patternLabel} (${focusedPd.linkToMd.friendshipLabel})`,
      `PD Divisional Varga Highlights: ${focusedPd.vargaHighlights.join(' | ')}`,
      focusedPd.pdOption.savedNote
        ? `Recorded Human Observation on This PD (Rating ${focusedPd.pdOption.savedRating ?? 'N/A'}/10): "${focusedPd.pdOption.savedNote}"`
        : 'Recorded Human Observation: None saved',
      `Natal Baseline (6 Aspects):\n${baselineLines}`,
      `Focused PD #${focusedPd.pdOption.index} (${p.planet}) 6-Aspect Deterministic Scores:\n${pdAspectLines}`
    ].join('\n\n');

    outputStructure = [
      'Respond in clean, well-structured Markdown prose & tables (NO JSON fences). Strictly DO NOT mention or invent any Gochara transits.',
      `### 1. Focused Verdict for PD #${focusedPd.pdOption.index}: ${p.planet} (${focusedPd.pdOption.startDate} to ${focusedPd.pdOption.endDate})`,
      `Directly state what ${p.planet} Pratyantardasha activates inside the ${mdLord}–${adLord} corridor (and answer any Focus Question directly up front), citing D1 (L#/M#), D9 (H#), PD–AD & PD–MD Sambandha, and Divisional Vargas.`,
      '### 2. Six-Aspect PD Window Report (Career, Finance, Love, Family, Health, Litigations)',
      'Deliver sharp, concrete natal-dasha expectations for EACH of the 6 aspects during these specific days.',
      '### 3. Practical Focus & Caution Markers for This PD Window',
      'List 2–3 key opportunities and 1–2 natal friction points to watch in this PD window (reminding that final external timing depends on Gochara transits).'
    ].join('\n');
  } else {
    dashaScopeHeader = `SCOPE: FULL CORRIDOR — ${mdLord} MD > ${adLord} AD + ALL 9 PDs`;
    dashaBlock = [
      dashaScopeHeader,
      `Selected MD: ${mdLord} (${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate}) — Seat L${md.hLagna}/M${md.hMoon} ${md.signName}, Nat:${md.functionalNature}, Dignity:${md.dignity}${md.hasNeechaBhanga ? '+NB' : ''}, D9 H${md.d9House}, Owns L${md.ownedHousesL.join('/L') || 'Node'}`,
      `Selected AD: ${adLord} (${evaluation.selectedAd.startDate} to ${evaluation.selectedAd.endDate}) — Seat L${ad.hLagna}/M${ad.hMoon} ${ad.signName}, Nat:${ad.functionalNature}, Dignity:${ad.dignity}${ad.hasNeechaBhanga ? '+NB' : ''}, D9 H${ad.d9House}, Owns L${ad.ownedHousesL.join('/L') || 'Node'}`,
      `MD-AD Sambandha: ${evaluation.mdAdSambandha.summary}`,
      `Natal Baseline (6 Aspects):\n${baselineLines}`,
      `MD-AD Summary (6 Aspects):\n${adAspectLines}`,
      `All 9 Sequential PDs inside ${mdLord} MD > ${adLord} AD:\n${pdWalkLines}`
    ].join('\n\n');

    outputStructure = [
      'Respond in clean, well-structured Markdown prose & tables (NO JSON fences). Strictly DO NOT mention or invent any Gochara transits.',
      '### 1. Direct Answer to Focus Question',
      'Answer the user question directly first with explicit D1 (L#/M#), D9 (H#), relevant Divisional Varga (D2..D30), Yoga/Dosha, and MD/AD/PD proof (name exact PD date windows).',
      '### 2. Natal Chart Baseline Promise (All 6 Aspects)',
      'Summarize inherent natal promise for Career, Finance, Love, Family, Health, and Litigations.',
      `### 3. ${mdLord} Mahadasha & ${adLord} Antardasha Synthesis`,
      'Explain MD agenda, MD-AD Sambandha, and deliver clear verdicts across all 6 aspects for this AD window.',
      '### 4. Sequential Pratyantardasha (PD 1–9) Natal Walkthrough',
      'Walk chronologically through ALL 9 PDs with exact date ranges, stating how each PD shifts Career, Finance, Love, Family, Health, and Litigations.',
      '### 5. Transit (Gochara) Delivery Disclaimer',
      'Close with a brief 2-line reminder that this reading reflects structural Natal + Dasha-Bhukti promise only, and exact external timing/amplitude is governed by Gochara transits.'
    ].join('\n');
  }

  const baseSections: Array<{ tag: string; label: string; body: string }> = [
    { tag: '[RULES]', label: 'Natal + Dasha-Bhukti Reasoning Rules (Zero Transits)', body: rulesText },
    { tag: '[CONVENTIONS]', label: 'House & Calibration Conventions', body: conventionsText },
    { tag: '[PERSON]', label: 'Native Identity & Birth Balance', body: personBlock },
    { tag: '[LORDSHIPS]', label: 'D1 House Lordships (L# / M#)', body: lordshipEntries },
    { tag: '[HOUSE LORDS]', label: 'L1..L12 Placement Lookup', body: houseLordEntries.join(' | ') },
    { tag: '[D1]', label: 'D1 Natal Rashi Chart', body: d1Lines.join('\n') },
    { tag: '[D9]', label: 'D9 Navamsha Chart', body: d9Lines.join('\n') },
    { tag: '[SHADBALA]', label: 'Planetary Strengths & Vimsopaka', body: shadbalaLines.join('\n') },
    { tag: '[SAV]', label: 'Sarvashtakavarga (337 Bindus)', body: savLine },
    { tag: '[BAV]', label: '7-Planet Bhinnashtakavarga', body: bavRows.join('\n') || 'BAV unavailable' },
    { tag: '[PINDAS]', label: 'Sodhya Pindas', body: pindasLine },
    { tag: '[YOGAS]', label: 'Validated D1 Yogas', body: yogasLine },
    { tag: '[DOSHAS]', label: 'D1 Doshas & Afflictions', body: doshasLine },
    { tag: '[JAIMINI]', label: 'Jaimini 7-Karaka, Karakamsa & Arudhas', body: jaiminiLine },
    { tag: '[KARAKAS]', label: '6-Aspect House, Varga & Karaka Routing', body: karakaLine },
    { tag: '[VARGAS D2..D60]', label: `All Divisional Charts (${vargaBlocks.length} Charts)`, body: vargaBlocks.join('\n') },
    { tag: '[DASHA BHUKTI NATAL PROMISE]', label: scopeLabel, body: dashaBlock }
  ];

  const sections: Array<{ tag: string; label: string; body: string }> = [
    ...baseSections,
    { tag: '[OUTPUT STRUCTURE]', label: 'Required Output Structure', body: outputStructure },
    { tag: '[FOCUS QUESTION]', label: 'User Dasha Question', body: effectiveQuestion }
  ];

  const prompt = sections.map(s => `${s.tag === '[VARGAS D2..D60]' ? '' : `${s.tag}\n`}${s.body}`).join('\n\n');

  const sectionSummary = sections.map(s => ({
    tag: s.tag,
    label: s.label,
    lines: s.body.split('\n').length
  }));

  return {
    prompt,
    systemInstruction,
    scope,
    scopeLabel,
    pdIndex: focusedPd?.pdOption.index,
    sectionSummary,
    charCount: prompt.length,
    approxTokens: Math.round(prompt.length / 4),
    zeroTransitsVerified: !prompt.includes('[LUNAR]') && !prompt.includes('[TRIGGER WINDOWS]') && !prompt.includes('GOCHARA')
  };
}

export interface NatalDashaFollowUpContext {
  targetProviderLabel: string;
  priorPredictionMarkdown: string;
  alternatePrediction?: {
    providerLabel: string;
    markdown: string;
  };
  priorFollowUps?: Array<{
    question: string;
    answerMarkdown: string;
  }>;
}

export function buildNatalDashaFollowUpPrompt(params: {
  evaluation: NatalDashaPromiseEvaluation;
  rawPlacements: NatalPlacementRow[];
  followUpQuestion: string;
  aspectFilter?: NatalAspectId | 'all';
  scope?: NatalDashaLevelScope;
  pdIndex?: number;
  followUpContext: NatalDashaFollowUpContext;
}): NatalDashaPromptResult {
  const {
    evaluation,
    rawPlacements,
    followUpQuestion,
    aspectFilter = 'all',
    scope = 'ad',
    pdIndex,
    followUpContext
  } = params;

  const baseResult = buildNatalDashaMasterPrompt({
    evaluation,
    rawPlacements,
    focusQuestion: followUpQuestion,
    aspectFilter,
    scope,
    pdIndex
  });

  // Preserve all natal + dasha sections up to [DASHA BHUKTI NATAL PROMISE], replacing [OUTPUT STRUCTURE] & [FOCUS QUESTION]
  const outputMarker = '\n\n[OUTPUT STRUCTURE]\n';
  const markerIdx = baseResult.prompt.indexOf(outputMarker);
  const coreNatalAndDashaPrompt = markerIdx >= 0 ? baseResult.prompt.slice(0, markerIdx) : baseResult.prompt;

  const extraBlocks: Array<{ tag: string; label: string; body: string }> = [
    {
      tag: `[PRIOR DELIVERED PREDICTION — ${followUpContext.targetProviderLabel.toUpperCase()}]`,
      label: `Prior ${followUpContext.targetProviderLabel} Prediction`,
      body: followUpContext.priorPredictionMarkdown.trim()
    }
  ];

  if (followUpContext.alternatePrediction?.markdown?.trim()) {
    extraBlocks.push({
      tag: `[COMPANION PREDICTION — ${followUpContext.alternatePrediction.providerLabel.toUpperCase()}]`,
      label: `Companion ${followUpContext.alternatePrediction.providerLabel} Prediction`,
      body: followUpContext.alternatePrediction.markdown.trim()
    });
  }

  if (followUpContext.priorFollowUps && followUpContext.priorFollowUps.length > 0) {
    const historyBody = followUpContext.priorFollowUps
      .map((turn, idx) => `Follow-Up #${idx + 1} Q: ${turn.question}\nFollow-Up #${idx + 1} A:\n${turn.answerMarkdown.trim()}`)
      .join('\n\n---\n\n');
    extraBlocks.push({
      tag: '[PRIOR FOLLOW-UP CONVERSATION]',
      label: `Prior Follow-Up Turns (${followUpContext.priorFollowUps.length})`,
      body: historyBody
    });
  }

  const followUpOutputStructure = [
    'Respond in clean, well-structured Markdown prose & comparison tables (NO JSON fences). Strictly DO NOT mention or invent any Gochara transits.',
    '### 1. Direct Answer & Relative Impact Verdict',
    'Directly answer the follow-up question in the context of the Prior Delivered Prediction above. Explicitly quantify or rank relative impact (e.g., High / Moderate / Minor / Negligible, and Net Gain vs Friction %) across the relevant aspects or placements.',
    '### 2. Why the Chart Weights This Way (Natal & Dasha Evidence)',
    'Trace exact D1 (L#/M#), D9 (H#), Shadbala/SAV, Yoga/Dosha, and Divisional Varga (D2..D30) drivers explaining why one factor outweighs another in this period.',
    '### 3. Practical Relative Comparison & Takeaways',
    'Summarize what matters most vs least during this Dasha window (and note briefly that Gochara transits govern final external trigger timing).'
  ].join('\n');

  extraBlocks.push(
    { tag: '[OUTPUT STRUCTURE]', label: 'Follow-Up Impact Structure', body: followUpOutputStructure },
    { tag: '[FOLLOW-UP QUESTION]', label: 'User Follow-Up Question', body: followUpQuestion.trim() }
  );

  const fullPrompt = [
    coreNatalAndDashaPrompt,
    ...extraBlocks.map(b => `${b.tag}\n${b.body}`)
  ].join('\n\n');

  const baseCoreSummary = baseResult.sectionSummary.filter(
    s => s.tag !== '[OUTPUT STRUCTURE]' && s.tag !== '[FOCUS QUESTION]'
  );

  const sectionSummary = [
    ...baseCoreSummary,
    ...extraBlocks.map(b => ({
      tag: b.tag,
      label: b.label,
      lines: b.body.split('\n').length
    }))
  ];

  return {
    ...baseResult,
    prompt: fullPrompt,
    sectionSummary,
    charCount: fullPrompt.length,
    approxTokens: Math.round(fullPrompt.length / 4),
    zeroTransitsVerified:
      !fullPrompt.includes('[LUNAR]') && !fullPrompt.includes('[TRIGGER WINDOWS]') && !fullPrompt.includes('GOCHARA')
  };
}

export async function runNatalDashaAISynthesis(params: {
  providerId: LLMProviderId;
  prompt: string;
  systemInstruction: string;
}): Promise<NatalDashaAiSynthesisResult> {
  const { providerId, prompt, systemInstruction } = params;
  const startMs = Date.now();
  const provMeta = LLM_PROVIDERS[providerId] || LLM_PROVIDERS.gemini_pro;

  const geminiKey =
    (typeof window !== 'undefined' ? localStorage.getItem('astro_gemini_api_key') : null) || '';
  const anthropicKey =
    (typeof window !== 'undefined' ? localStorage.getItem('astro_anthropic_api_key') : null) || '';
  const thinkingMode =
    (typeof window !== 'undefined'
      ? (localStorage.getItem('astro_anthropic_thinking_mode') as 'disabled' | 'enabled' | 'auto')
      : null) || 'disabled';

  try {
    if (providerId === 'gemini_pro') {
      const model = getPreferredGeminiModel();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (geminiKey.trim()) headers['x-goog-api-key'] = geminiKey.trim();

      const res = await fetch('/api/llm/gemini', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          prompt,
          systemInstruction,
          responseMimeType: 'text/plain',
          apiKey: geminiKey.trim() || undefined
        })
      });
      const json = await res.json().catch(() => ({}));
      const elapsed = Date.now() - startMs;
      if (!res.ok || !json.text) {
        const err = json.error || `Gemini HTTP ${res.status}`;
        await persistLLMPromptLog({
          engine: 'NatalDashaPromise',
          model_name: model,
          fired_at: new Date().toISOString(),
          prompt_text: prompt,
          response_text: err,
          time_taken_ms: elapsed,
          status: 'ERROR'
        }).catch(() => {});
        return {
          success: false,
          answerMarkdown: '',
          providerUsed: providerId,
          modelUsed: model,
          executionTimeMs: elapsed,
          promptSent: prompt,
          systemInstruction,
          error: err
        };
      }

      const usage = json.usageMetadata;
      const telemetry = usage
        ? {
            inputTokens: Number(usage.promptTokenCount ?? Math.round(prompt.length / 4)),
            outputTokens: Number(usage.candidatesTokenCount ?? Math.round(json.text.length / 4)),
            totalTokens: Number(usage.totalTokenCount ?? 0)
          }
        : undefined;

      await persistLLMPromptLog({
        engine: 'NatalDashaPromise',
        model_name: json.model || model,
        fired_at: new Date().toISOString(),
        prompt_text: prompt,
        response_text: json.text,
        time_taken_ms: elapsed,
        status: 'SUCCESS'
      }).catch(() => {});

      return {
        success: true,
        answerMarkdown: json.text.trim(),
        providerUsed: providerId,
        modelUsed: json.model || model,
        executionTimeMs: elapsed,
        promptSent: prompt,
        systemInstruction,
        tokenTelemetry: telemetry
      };
    }

    if (
      providerId === 'claude_sonnet' ||
      providerId === 'claude_haiku' ||
      providerId === 'claude_fable' ||
      providerId === 'claude'
    ) {
      const model = provMeta.model;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (anthropicKey.trim()) headers['x-api-key'] = anthropicKey.trim();

      const res = await fetch('/api/llm/claude', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          system: systemInstruction,
          prompt,
          thinkingMode,
          maxTokens: 16000,
          apiKey: anthropicKey.trim() || undefined
        })
      });
      const json = await res.json().catch(() => ({}));
      const elapsed = Date.now() - startMs;
      if (!res.ok || !json.text) {
        const err = json.error || `Claude HTTP ${res.status}`;
        await persistLLMPromptLog({
          engine: 'NatalDashaPromise',
          model_name: model,
          fired_at: new Date().toISOString(),
          prompt_text: prompt,
          response_text: err,
          time_taken_ms: elapsed,
          status: 'ERROR'
        }).catch(() => {});
        return {
          success: false,
          answerMarkdown: '',
          providerUsed: providerId,
          modelUsed: model,
          executionTimeMs: elapsed,
          promptSent: prompt,
          systemInstruction,
          error: err
        };
      }

      const telemetry = json.usage
        ? {
            inputTokens: Number(json.usage.input_tokens ?? 0),
            outputTokens: Number(json.usage.output_tokens ?? 0),
            totalTokens: Number(json.usage.input_tokens ?? 0) + Number(json.usage.output_tokens ?? 0)
          }
        : undefined;

      await persistLLMPromptLog({
        engine: 'NatalDashaPromise',
        model_name: json.model || model,
        fired_at: new Date().toISOString(),
        prompt_text: prompt,
        response_text: json.text,
        time_taken_ms: elapsed,
        status: 'SUCCESS'
      }).catch(() => {});

      return {
        success: true,
        answerMarkdown: json.text.trim(),
        providerUsed: providerId,
        modelUsed: json.model || model,
        executionTimeMs: elapsed,
        promptSent: prompt,
        systemInstruction,
        tokenTelemetry: telemetry
      };
    }

    // Local Ollama Qwen 14B
    const localModel =
      (typeof window !== 'undefined' ? localStorage.getItem('astro_local_ollama_model') : null) ||
      provMeta.model;
    const localEndpoint =
      (typeof window !== 'undefined' ? localStorage.getItem('astro_ollama_endpoint') : null) ||
      'http://localhost:11434';

    const res = await fetch('/api/llm/ollama-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: localEndpoint,
        model: localModel,
        system: systemInstruction,
        prompt,
        options: { temperature: 0.25, num_predict: 3200, num_ctx: 12288 }
      })
    });
    const json = await res.json().catch(() => ({}));
    const elapsed = Date.now() - startMs;
    const text = (json.response || json.text || '').trim();
    if (!res.ok || !text) {
      return {
        success: false,
        answerMarkdown: '',
        providerUsed: providerId,
        modelUsed: localModel,
        executionTimeMs: elapsed,
        promptSent: prompt,
        systemInstruction,
        error: json.error || `Ollama proxy HTTP ${res.status}`
      };
    }

    await persistLLMPromptLog({
      engine: 'NatalDashaPromise',
      model_name: json.model || localModel,
      fired_at: new Date().toISOString(),
      prompt_text: prompt,
      response_text: text,
      time_taken_ms: elapsed,
      status: 'SUCCESS'
    }).catch(() => {});

    return {
      success: true,
      answerMarkdown: text,
      providerUsed: providerId,
      modelUsed: json.model || localModel,
      executionTimeMs: elapsed,
      promptSent: prompt,
      systemInstruction
    };
  } catch (err: any) {
    return {
      success: false,
      answerMarkdown: '',
      providerUsed: providerId,
      modelUsed: provMeta.model,
      executionTimeMs: Date.now() - startMs,
      promptSent: prompt,
      systemInstruction,
      error: err?.message || 'Unexpected network error during Natal Dasha synthesis.'
    };
  }
}
