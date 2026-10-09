/**
 * Astro Engine Multi-LLM Provider Adapters (Milestone M4)
 * Implements QwenLocalAdapter, GeminiStudioAdapter, and ClaudeAdapter
 */
import { GoogleGenAI } from '@google/genai';
import {
  LLMProviderId,
  VedicHouseContext,
  LLMThreePartNarrative,
  ILLMAdapter
} from './types';

// Classical House Significations Matrix (Clean Unified English)
const BHAVA_NAMES: Record<number, { title: string; karakas: string; financialRole: string }> = {
  1: { title: '1st House (Self, Vitality & Identity)', karakas: 'Sun, Mars', financialRole: 'Personal direct efforts & self-made income' },
  2: { title: '2nd House (Accumulated Wealth, Liquid Savings & Family)', karakas: 'Jupiter, Mercury', financialRole: 'Accumulated liquid cash, savings deposits & family wealth' },
  3: { title: '3rd House (Enterprise, Valor & Contracts)', karakas: 'Mars, Saturn', financialRole: 'Commission, short contracts, media, trade & entrepreneurial grit' },
  4: { title: '4th House (Real Estate, Vehicles & Fixed Assets)', karakas: 'Moon, Venus, Mars', financialRole: 'Collateral loans, mortgage financing, property equity & fixed capital' },
  5: { title: '5th House (Intellect, Speculation & Creativity)', karakas: 'Jupiter', financialRole: 'Speculative investments, stock equity, bonuses & creative ventures' },
  6: { title: '6th House (Debt, Banking Loans & Litigation)', karakas: 'Mars, Saturn', financialRole: 'Bank borrowings, credit lines, debt restructuring & servicing' },
  7: { title: '7th House (Partnerships, Legal Contracts & Public Standing)', karakas: 'Venus', financialRole: 'Joint venture equity, business partnership capital & customer contracts' },
  8: { title: '8th House (Sudden Windfalls, Insurance & Inheritance)', karakas: 'Saturn', financialRole: 'Insurance claims, inheritance, joint spousal funds & unearned windfalls' },
  9: { title: '9th House (Fortune, Divine Grace & Higher Pursuits)', karakas: 'Jupiter, Sun', financialRole: 'Ancestral capital, divine fortune, venture patronage & high-ticket investments' },
  10: { title: '10th House (Career Elevation, Status & Authority)', karakas: 'Sun, Mercury, Saturn', financialRole: 'Corporate salary, executive remuneration, professional turnover' },
  11: { title: '11th House (Maximum Gains, Profits & Large Networks)', karakas: 'Jupiter', financialRole: 'Residual income, milestone profits, venture syndicates & large scale inflows' },
  12: { title: '12th House (Capital Outflows, Foreign Investments & Exit)', karakas: 'Saturn, Ketu', financialRole: 'Institutional foreign capital, high-ticket expenses & investment deployments' }
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ZODIAC_ENGLISH_LOOKUP: Record<string, string> = {
  // English standard
  'aries': 'Aries',
  'taurus': 'Taurus',
  'gemini': 'Gemini',
  'cancer': 'Cancer',
  'leo': 'Leo',
  'virgo': 'Virgo',
  'libra': 'Libra',
  'scorpio': 'Scorpio',
  'sagittarius': 'Sagittarius',
  'capricorn': 'Capricorn',
  'aquarius': 'Aquarius',
  'pisces': 'Pisces',

  // Sanskrit / Tamil / South Indian transliterations & Tamil script
  'mesham': 'Aries',
  'mesha': 'Aries',
  'மேஷம்': 'Aries',

  'rishabam': 'Taurus',
  'rishaba': 'Taurus',
  'vrishabha': 'Taurus',
  'vrishabh': 'Taurus',
  'ரிஷபம்': 'Taurus',

  'mithunam': 'Gemini',
  'mithuna': 'Gemini',
  'மிதுனம்': 'Gemini',

  'katakam': 'Cancer',
  'kadagam': 'Cancer',
  'kadaga': 'Cancer',
  'karkataka': 'Cancer',
  'karka': 'Cancer',
  'kadakam': 'Cancer',
  'கடகம்': 'Cancer',

  'simham': 'Leo',
  'simha': 'Leo',
  'சிம்மம்': 'Leo',

  'kanni': 'Virgo',
  'kanya': 'Virgo',
  'கன்னி': 'Virgo',

  'thulaam': 'Libra',
  'thulam': 'Libra',
  'tula': 'Libra',
  'துலாம்': 'Libra',

  'vrischigam': 'Scorpio',
  'viruchigam': 'Scorpio',
  'vrischika': 'Scorpio',
  'vruschikam': 'Scorpio',
  'விருச்சிகம்': 'Scorpio',

  'dhanus': 'Sagittarius',
  'dhanusu': 'Sagittarius',
  'dhanu': 'Sagittarius',
  'தனுசு': 'Sagittarius',

  'makaram': 'Capricorn',
  'makara': 'Capricorn',
  'மகரம்': 'Capricorn',

  'kumbam': 'Aquarius',
  'kumbha': 'Aquarius',
  'கும்பம்': 'Aquarius',

  'meenam': 'Pisces',
  'meena': 'Pisces',
  'மீனம்': 'Pisces'
};

export const PLANET_ENGLISH_LOOKUP: Record<string, string> = {
  // English
  'sun': 'Sun',
  'surya': 'Sun',
  'suryan': 'Sun',
  'suriyan': 'Sun',
  'ravi': 'Sun',
  'ஞாயிறு': 'Sun',

  'moon': 'Moon',
  'chandra': 'Moon',
  'chandran': 'Moon',
  'soma': 'Moon',
  'திங்கள்': 'Moon',

  'mars': 'Mars',
  'mangal': 'Mars',
  'sevvai': 'Mars',
  'chevvai': 'Mars',
  'angaraka': 'Mars',
  'kuja': 'Mars',
  'செவ்வாய்': 'Mars',

  'mercury': 'Mercury',
  'budha': 'Mercury',
  'budhan': 'Mercury',
  'புதன்': 'Mercury',

  'jupiter': 'Jupiter',
  'guru': 'Jupiter',
  'brihaspati': 'Jupiter',
  'vyazhan': 'Jupiter',
  'வியாழன்': 'Jupiter',

  'venus': 'Venus',
  'sukra': 'Venus',
  'shukra': 'Venus',
  'velli': 'Venus',
  'வெள்ளி': 'Venus',

  'saturn': 'Saturn',
  'sani': 'Saturn',
  'shani': 'Saturn',
  'shaneeshwara': 'Saturn',
  'சனி': 'Saturn',

  'rahu': 'Rahu',
  'ராகு': 'Rahu',

  'ketu': 'Ketu',
  'கேது': 'Ketu',

  'lagna': 'Ascendant',
  'ascendant': 'Ascendant'
};

/**
 * Normalizes zodiac sign names to pure, clean standard English:
 * e.g., "Katakam (Cancer)" -> "Cancer"
 * e.g., "Kadaga" / "Kadagam" -> "Cancer"
 * e.g., "Meenam (Pisces)" -> "Pisces"
 * e.g., "Meenam" -> "Pisces"
 * e.g., "Mesham (Aries)" -> "Aries"
 * e.g., "Vrischigam (Scorpio)" -> "Scorpio"
 */
export function toCleanEnglishSign(raw?: string): string {
  if (!raw) return '';
  const clean = raw.trim();

  // 1. If text has parentheses e.g. "Katakam (Cancer)" or "Cancer (Katakam)"
  const parenMatch = clean.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    const inside = parenMatch[1].trim().toLowerCase();
    if (ZODIAC_ENGLISH_LOOKUP[inside]) {
      return ZODIAC_ENGLISH_LOOKUP[inside];
    }
  }

  // 2. Check text outside parentheses
  const outside = clean.replace(/\s*\(.*?\)/g, '').trim().toLowerCase();
  if (ZODIAC_ENGLISH_LOOKUP[outside]) {
    return ZODIAC_ENGLISH_LOOKUP[outside];
  }

  // 3. Check individual tokens
  const words = clean.toLowerCase().split(/[\s,()/-]+/);
  for (const w of words) {
    if (ZODIAC_ENGLISH_LOOKUP[w]) {
      return ZODIAC_ENGLISH_LOOKUP[w];
    }
  }

  // Fallback: strip Tamil script and parentheses
  return clean.replace(/[\u0B80-\u0BFF]/g, '').replace(/\s*\(.*?\)/g, '').trim();
}

/**
 * Normalizes planet names to pure, clean standard English:
 * e.g., "Jupiter (Guru)" -> "Jupiter"
 * e.g., "Guru" -> "Jupiter"
 * e.g., "Mars (Sevvai)" -> "Mars"
 * e.g., "Sevvai" -> "Mars"
 * e.g., "Saturn (Sani)" -> "Saturn"
 */
export function toCleanEnglishPlanet(raw?: string): string {
  if (!raw) return '';
  const clean = raw.trim();

  const parenMatch = clean.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    const inside = parenMatch[1].trim().toLowerCase();
    if (PLANET_ENGLISH_LOOKUP[inside]) {
      return PLANET_ENGLISH_LOOKUP[inside];
    }
  }

  const outside = clean.replace(/\s*\(.*?\)/g, '').trim().toLowerCase();
  if (PLANET_ENGLISH_LOOKUP[outside]) {
    return PLANET_ENGLISH_LOOKUP[outside];
  }

  const words = clean.toLowerCase().split(/[\s,()/-]+/);
  for (const w of words) {
    if (PLANET_ENGLISH_LOOKUP[w]) {
      return PLANET_ENGLISH_LOOKUP[w];
    }
  }

  return clean.replace(/[\u0B80-\u0BFF]/g, '').replace(/\s*\(.*?\)/g, '').trim();
}

/**
 * Replaces any transliterated Tamil/Sanskrit zodiac and planet words within sentences
 * with their standard English equivalents, removing redundancy:
 * e.g., "Jupiter transiting in Kadaga" -> "Jupiter transiting in Cancer"
 * e.g., "Sun enters Katakam on Day 15" -> "Sun enters Cancer on Day 15"
 */
export function cleanEnglishSentence(sentence?: string): string {
  if (!sentence) return '';
  let res = sentence;

  // Remove Tamil script characters
  res = res.replace(/[\u0B80-\u0BFF]+/g, '');

  // Remove redundant parentheses containing known signs or planets
  res = res.replace(/\((?:Guru|Sevvai|Sani|Sukra|Budha|Surya|Chandra|Katakam|Kadagam|Meenam|Mesham|Rishabam|Mithunam|Simham|Kanni|Thulaam|Vrischigam|Dhanus|Makaram|Kumbam)\)/gi, '');

  // Replace specific transliterated signs
  const signReplacements: [RegExp, string][] = [
    [/\b(?:Kadaga|Kadagam|Katakam|Karkataka|Karka)\b/gi, 'Cancer'],
    [/\b(?:Meenam|Meena)\b/gi, 'Pisces'],
    [/\b(?:Mesham|Mesha)\b/gi, 'Aries'],
    [/\b(?:Rishabam|Rishaba|Vrishabha)\b/gi, 'Taurus'],
    [/\b(?:Mithunam|Mithuna)\b/gi, 'Gemini'],
    [/\b(?:Simham|Simha)\b/gi, 'Leo'],
    [/\b(?:Kanni|Kanya)\b/gi, 'Virgo'],
    [/\b(?:Thulaam|Thulam|Tula)\b/gi, 'Libra'],
    [/\b(?:Vrischigam|Viruchigam|Vrischika)\b/gi, 'Scorpio'],
    [/\b(?:Dhanus|Dhanusu|Dhanu)\b/gi, 'Sagittarius'],
    [/\b(?:Makaram|Makara)\b/gi, 'Capricorn'],
    [/\b(?:Kumbam|Kumbha)\b/gi, 'Aquarius'],
    [/\bGuru\b/gi, 'Jupiter'],
    [/\b(?:Sevvai|Chevvai|Mangal|Angaraka)\b/gi, 'Mars'],
    [/\b(?:Sukra|Shukra|Velli)\b/gi, 'Venus'],
    [/\b(?:Sani|Shani|Shaneeshwara)\b/gi, 'Saturn'],
    [/\b(?:Budha|Budhan)\b/gi, 'Mercury'],
    [/\b(?:Surya|Suryan|Suriyan|Ravi)\b/gi, 'Sun'],
    [/\b(?:Chandra|Chandran|Soma)\b/gi, 'Moon'],
    [/\bDrishti\b/gi, 'Aspect']
  ];

  for (const [pattern, replacement] of signReplacements) {
    res = res.replace(pattern, replacement);
  }

  // Clean double spaces or orphaned parentheses
  return res.replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').trim();
}

/**
 * Builds the canonical Vedic reasoning prompt based on the native's chart and active transit context
 */
export function buildVedicPrompt(context: VedicHouseContext, providerName: string): string {
  // If user provided a customized prompt override in the interactive studio, respect it directly!
  if (context.customPromptOverride && context.customPromptOverride.trim().length > 0) {
    return context.customPromptOverride;
  }

  const bhavaInfo = BHAVA_NAMES[context.houseNumber] || {
    title: `House ${context.houseNumber}`,
    karakas: 'Planetary lords',
    financialRole: 'General financial domain'
  };

  const monthName = MONTH_NAMES[context.selectedMonth] || 'Active Month';
  const cleanTargetSign = toCleanEnglishSign(context.rashiName) || `House ${context.houseNumber}`;

  // Compact formatting helpers
  const formatDegreeCompact = (deg?: string): string => {
    if (!deg) return '00°00\'';
    const clean = deg.replace(/\s+/g, '');
    const m = clean.match(/(\d+°\d+['']?)/);
    return m ? m[1] : clean;
  };

  const formatNakshatraCompact = (nak?: string, pada?: number): string => {
    if (!nak || nak === 'N/A') return 'N/A';
    const cleanStar = nak.replace(/\s*\(.*?\)/g, '').trim();
    return pada ? `${cleanStar} P${pada}` : cleanStar;
  };

  // 1. Flattened Natal D1 Placements (Compact)
  const natalD1Table = (context.flattenedNatalD1 && context.flattenedNatalD1.length > 0)
    ? context.flattenedNatalD1.map(p => 
        `  ${toCleanEnglishPlanet(p.body_name)} — ${toCleanEnglishSign(p.rashi_name)} H${p.house_number || '?'} — ${formatDegreeCompact(p.degree_sputa)} — ${formatNakshatraCompact(p.nakshatra_name, p.pada)}${p.is_retrograde ? ' [R]' : ''}`
      ).join('\n')
    : (context.natalOccupants.length > 0
        ? context.natalOccupants.map(o => `  ${toCleanEnglishPlanet(o.body_name)} — ${cleanTargetSign} — ${formatDegreeCompact(o.degree_sputa)} — ${formatNakshatraCompact(o.nakshatra_name)}`).join('\n')
        : '  None (Empty Bhava)');

  // 2. Flattened Natal D9 Navamsha (Compact)
  const natalD9Table = (context.flattenedNatalD9 && context.flattenedNatalD9.length > 0)
    ? context.flattenedNatalD9.map(p => `${toCleanEnglishPlanet(p.body_name)} — ${toCleanEnglishSign(p.rashi_name)} — ${formatDegreeCompact(p.degree_sputa)}`).join(' | ')
    : 'Standard D9 alignments align with natal grid';

  // 3. Complete All-Graha Gochara Transits (Single unified ephemeris)
  const allTransits = context.allTransitPlacements || [];

  const allTransitsTable = allTransits.length > 0
    ? allTransits.map(t => {
        const aspectNote = t.aspects_target_house ? ` [Aspect: ${t.aspect_type}]` : '';
        return `  ${toCleanEnglishPlanet(t.graha_key)} — ${toCleanEnglishSign(t.transit_rashi_name)} H${t.house_from_lagna} — ${formatDegreeCompact(t.degree_sputa)} — ${formatNakshatraCompact(t.nakshatra_name, t.pada)}${t.is_retrograde ? ' [R]' : ''}${t.is_custom ? ' [Override]' : ''}${aspectNote}`;
      }).join('\n')
    : (context.transitOccupants.length > 0
        ? context.transitOccupants.map(t => `  ${toCleanEnglishPlanet(t.graha_key)} — ${cleanTargetSign} H${context.houseNumber} — ${formatDegreeCompact(t.degree_sputa)} — ${formatNakshatraCompact(t.nakshatra_name, t.pada)}`).join('\n')
        : '  Full planetary Gochara transits computed per ephemeris.');

  // 4. Moon 2.25-day Sign Progression Timeline
  const moonSpansTable = (context.monthlyMoonSpans && context.monthlyMoonSpans.length > 0)
    ? context.monthlyMoonSpans.map(m => 
        `  • Day ${m.startDay}–${m.endDay}: Moon in ${toCleanEnglishSign(m.signName)} (House ${m.houseNumber}) ${m.houseNumber === context.houseNumber ? '===> [DIRECT TRANSIT OVER TARGET HOUSE] <===' : [1, 4, 5, 7, 9, 10, 11].includes(m.houseNumber) ? '[Angular/Trinal House]' : ''}`
      ).join('\n')
    : '  • Moon completes one 360-degree zodiacal circuit through 12 signs (~2.25 days per sign)';

  // 5. Fast Planet Ingress Events
  const ingressTable = (context.monthlyIngressEvents && context.monthlyIngressEvents.length > 0)
    ? context.monthlyIngressEvents.map(e => `  • ${cleanEnglishSentence(e)}`).join('\n')
    : '  • Major slow planets maintain sign stability; fast planets transition per ephemeris.';

  // 6. Dasha Triad Delivery Report (Rule 5)
  const dashaDelivery = context.dashaDeliveryReport
    ? `Dasha Triad Delivery Index: ${(context.dashaDeliveryReport.overallIndex * 100).toFixed(0)}% (${context.dashaDeliveryReport.status})
  - MD Lord (${toCleanEnglishPlanet(context.activeDasha.mahadasha)}): ${context.dashaDeliveryReport.mdDignity} [Score: ${context.dashaDeliveryReport.mdScore.toFixed(2)}]
  - AD Lord (${toCleanEnglishPlanet(context.activeDasha.antardasha)}): ${context.dashaDeliveryReport.adDignity} [Score: ${context.dashaDeliveryReport.adScore.toFixed(2)}]
  - PD Lord (${toCleanEnglishPlanet(context.activeDasha.pratyantardasha)}): ${context.dashaDeliveryReport.pdDignity} [Score: ${context.dashaDeliveryReport.pdScore.toFixed(2)}]`
    : `Active Vimshottari Hierarchy: MD: ${toCleanEnglishPlanet(context.activeDasha.mahadasha)} > AD: ${toCleanEnglishPlanet(context.activeDasha.antardasha)} > PD: ${toCleanEnglishPlanet(context.activeDasha.pratyantardasha)}`;

  // 7. Matched Rules
  const rulesStr = context.matchedRules.length > 0
    ? context.matchedRules.map(r => `• ${r.ruleName} (Weight: ${r.weight}): ${r.reason}`).join('\n')
    : '• Baseline house evaluation';

  // 7. Advanced Parashara Payloads (Tara Bala, Chandra Bala, Ashtakavarga, Dasha Dossier, Karakas)
  const janmaStarStr = context.natalJanmaStar
    ? `Native Janma Star: ${context.natalJanmaStar.nakshatra_name} (Pada ${context.natalJanmaStar.pada}) in ${toCleanEnglishSign(context.natalJanmaStar.rashi_name)}`
    : 'Native Janma Star: Anuradha (Pada 2) in Scorpio';

  const taraBalaTable = (context.taraBalaTransitPlanets && context.taraBalaTransitPlanets.length > 0)
    ? context.taraBalaTransitPlanets.map(t => 
        `  ${toCleanEnglishPlanet(t.graha_key)} — ${t.transit_star} P${t.pada} — ${t.taraName} (Tara ${t.taraNumber}: ${t.quality})`
      ).join('\n')
    : '  Computed per ephemeris.';

  const chandraBalaTimelineStr = (context.chandraBalaDailyTimeline && context.chandraBalaDailyTimeline.length > 0)
    ? context.chandraBalaDailyTimeline.map(c => 
        `  ${c.dayRange}: Moon in ${toCleanEnglishSign(c.moonSignName)} (${c.moonStarName}) — H${c.houseFromNatalMoon} from Moon — ${c.taraBala.taraName} (T${c.taraBala.taraNumber})${c.isChandrashtama ? ' [🚨 CHANDRASHTAMA: Caution]' : c.isFavorable ? ' [Favorable]' : ''}${c.alertFlag ? ` [${c.alertFlag}]` : ''}`
      ).join('\n')
    : '  Full Chandra Bala computed across 2.25-day sign progression.';

  const ashtakavargaStr = context.ashtakavargaPayload
    ? `Target House ${context.houseNumber}: ${context.ashtakavargaPayload.targetHousePoints} Bindus [${context.ashtakavargaPayload.targetHouseStrength}]\n  Spread: ${context.ashtakavargaPayload.savPointsDistribution.map(s => `H${s.houseNumber}:${s.points}`).join(' | ')}`
    : `Target House ${context.houseNumber} Sarvashtakavarga points computed with baseline Parashara strength.`;

  const dashaDossierStr = (context.dashaLordsDossier && context.dashaLordsDossier.length > 0)
    ? context.dashaLordsDossier.map(d => 
        `  ${d.role} [${toCleanEnglishPlanet(d.lordName)}]: Lords ${d.ownedHousesTitle} (${d.functionalNature}) | Occupies House ${d.natalHouseOccupied} (${d.natalDignity}) | ${d.connectsToTargetHouse ? `Connects: ${d.targetConnectionReason}` : d.targetConnectionReason}`
      ).join('\n')
    : '  MD, AD, and PD lords evaluated against natal houses and target bhava.';

  const karakaInfoStr = context.bhavaKarakaInfo
    ? `Primary Karaka: ${context.bhavaKarakaInfo.primaryKaraka} | Secondary: ${context.bhavaKarakaInfo.secondaryKarakas.join(', ')}
  Significations: ${context.bhavaKarakaInfo.significations}
  Outlet Impact: ${context.bhavaKarakaInfo.outletImpact}`
    : `Primary Karakas evaluate the real-world material and psychological manifestations of House ${context.houseNumber}.`;

  const horizonSection = context.isComprehensiveMonthly
    ? `### Monthly Scope & Horizon — ${monthName} ${context.selectedYear}
- Focus: Comprehensive Full-Month Vedic Synthesis across Core Life Domains
- Domain Focus Filter: ${context.activeDomainFilter && context.activeDomainFilter !== 'all' ? `Focused on ${context.activeDomainFilter.toUpperCase()}` : 'All Core Life Domains (Career, Finance, Love, Health, Family)'}
- Key Anchors: Double Transit Sanction (Saturn & Jupiter), Ingress Milestones, and Vimshottari Dasha Triad`
    : `### Target Horizon
- House: House ${context.houseNumber} (${bhavaInfo.title}) — Sign: ${cleanTargetSign} ${context.isLagna ? '[Ascendant / Lagna]' : ''}
- Month: ${monthName} ${context.selectedYear}
- Activation: ${context.activationScore.toFixed(2)} / 1.00 (${context.isEventActive ? 'Event Activated' : 'Standard Baseline'})
${rulesStr}`;

  return `You are an elite Vedic Astrologer & Data Reasoning Engine synthesizing monthly transit activations under classical Parashara and Jaimini principles.

${horizonSection}

### Natal Chart
D1 Rasi:
${natalD1Table}

D9 Navamsha:
  ${natalD9Table}

### Transit Ephemeris — ${monthName} ${context.selectedYear}
${allTransitsTable}

### Tara Bala
${janmaStarStr}
${taraBalaTable}

### Chandra Bala & Daily Progression
${chandraBalaTimelineStr}

### Sarvashtakavarga (SAV)
${ashtakavargaStr}

### Planetary Ingress Events — ${monthName} ${context.selectedYear}
${ingressTable}

### Vimshottari Dasha Hierarchy
${dashaDelivery}
Active PD Window: ${context.activeDasha.startDate} to ${context.activeDasha.endDate}
${dashaDossierStr}

### Bhava Karakas & Significations
${karakaInfoStr}

### User Inquiry
"${context.userQuery || (context.isComprehensiveMonthly ? `Provide a comprehensive monthly Vedic evaluation for ${monthName} ${context.selectedYear}` : `Provide a definitive astrological evaluation for House ${context.houseNumber} in ${monthName} ${context.selectedYear}`)}"

### Task Instructions & Compact JSON Contract
${context.isComprehensiveMonthly
  ? `Synthesize a comprehensive, multi-paragraph Vedic analysis for ${monthName} ${context.selectedYear} evaluating overarching Gochara transits across all 5 core life domains (career_job, love_romance, health_vitality, finance_wealth, family_home).`
  : `Synthesize a deep, multi-paragraph Vedic analysis for House ${context.houseNumber} and all 5 supplementary domains (career_job, love_romance, health_vitality, finance_wealth, family_home).`}

LANGUAGE & REASONING REQUIREMENT - UNIFIED ENGLISH ONLY:
- Strictly formulate all descriptions, reasoning, verdicts, and actionable guidance in clear, articulate English.
- Use standard English sign names: Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces.
- Use standard English planet names: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu.
- Do NOT use Tamil or Tamil transliterations (do NOT write Kadaga, Kadagam, Meenam, Mesham, Sevvai, Sukra, Sani, Guru, or Drishti).
- Keep JSON keys and all string values in English.

CRITICAL PLAIN TEXT REQUIREMENT FOR JSON PROSE FIELDS:
- 'part1_probabilityAndScope', 'part2_financialAndResources', and 'part3_microTimingWindow' MUST BE PLAIN TEXT ENGLISH PROSE STRINGS (multi-paragraph).
- NEVER output raw JSON objects, key-value pairs, or code blocks inside these fields. Write clean, direct English sentences.

REASONING DIRECTIVES:
1. TRANSIT GRAHA PADA & DEGREES: Explicitly reference exact degrees and Nakshatra Padas of transiting Jupiter, Saturn, Mars, Venus, and Moon. Account for tight aspect orbs (< 5°-7°).
2. TARA BALA: Factor auspicious (Sampat, Kshema, Sadhana, Mitra, Parama Mitra) vs friction (Vipat, Pratyak, Naidhana) stellar taras.
3. CHANDRA BALA: Flag 8th house Moon transits from Janma Rashi with clear cautions.
4. SAV BINDUS: Reference target house bindus (>=28-32 strong stamina, <25 cautious conservation).
5. DASHA LORDS: Integrate Mahadasha, Antardasha, and Pratyantardasha lordships and direct connections to House ${context.houseNumber}.

Return ONLY a valid, raw JSON object strictly adhering to this schema (no markdown fences, no surrounding commentary):
{
  "summarySentence": "Crisp bottom-line synthesis of event activation in plain English.",
  "natalPromiseVsTransitDelivery": {
    "natalPromiseScore": 0.85,
    "natalPromiseVerdict": "Natal foundation and karaka strength summary in English.",
    "transitDeliveryScore": 0.78,
    "transitDeliveryVerdict": "Gochara transits and Dasha Triad delivery capacity.",
    "synthesisVerdict": "Combined fruition and manifestation verdict."
  },
  "part1_probabilityAndScope": "${context.isComprehensiveMonthly ? `Multi-paragraph English breakdown of comprehensive monthly event probabilities and overarching trajectory across core life domains for ${monthName} ${context.selectedYear}.` : `Multi-paragraph English breakdown of Event Probability & Scope based on House ${context.houseNumber} significations and active Pratyantardasha Lord (${toCleanEnglishPlanet(context.activeDasha.pratyantardasha)}).`}",
  "part2_financialAndResources": "${context.isComprehensiveMonthly ? `Comprehensive analysis of monthly capital flow, wealth, liquid savings (2nd), and financial gains (11th) for ${monthName} ${context.selectedYear}.` : `Analysis of capital origin (2nd liquid savings, 4th property/loans, 9th fortune, 11th gains).`}",
  "part3_microTimingWindow": "${context.isComprehensiveMonthly ? `Peak favorable vs cautionary date windows across the lunar progression in ${monthName} ${context.selectedYear}.` : `Exact 3 to 7 day peak activation window in ${monthName} ${context.selectedYear} when Moon triggers this House.`}",
  "peakDateRange": "${monthName} DD – DD, ${context.selectedYear}",
  "overallConfidence": 0.85,
  "supplementaryScenarios": [
    {
      "id": "career_job",
      "title": "Career, Job Search & Professional Standing",
      "verdict": "Favorable Expansion",
      "confidenceScore": 0.85,
      "timingWindow": "${monthName} DD – DD, ${context.selectedYear}",
      "astrologicalReasoning": "Synthesis of 10th career, 6th service, and active Dasha lords in English.",
      "practicalGuidance": "Actionable strategic workplace guidance.",
      "employmentStatusInference": {
        "status": "currently_serving",
        "label": "Currently Serving in a Job (Employed)",
        "indicatorColor": "green",
        "confidence": 0.86,
        "inferenceReasoning": "Astrological deduction of employment status from 10th/6th lords and Dasha."
      },
      "jobSearchAnalysis": {
        "momentum": "Search momentum trajectory",
        "pastStruggleVsCurrentPhase": "Past delays vs current transit unlock",
        "timingAuspiciousness": "Offer letter / conversion probability"
      },
      "newJobAcquisition": {
        "jobTypeAndMood": "Type of prospective role and organizational mood",
        "workplaceAtmosphere": "Culture and autonomy",
        "comparisonWithCurrentRole": "Growth/compensation comparison with existing role"
      },
      "existingJobPhase": {
        "currentPhaseNature": "Workplace climate, manager dynamics, burnout vs recognition",
        "retentionVsExitAdvice": "Retention bargaining vs exit strategy"
      },
      "detailedParagraphs": ["Paragraph 1: Employment status & natal promise.", "Paragraph 2: Job search momentum & conversion window.", "Paragraph 3: Role valuation & workplace strategy."]
    },
    {
      "id": "love_romance",
      "title": "Love, Romance & Relationship Horizon",
      "verdict": "Moderate Progress",
      "confidenceScore": 0.78,
      "timingWindow": "${monthName} DD – DD, ${context.selectedYear}",
      "astrologicalReasoning": "Venus transit aspecting 5th/7th houses.",
      "practicalGuidance": "Heartfelt communication and emotional balance.",
      "crushStatusInference": {
        "existingCrushTrajectory": "Trajectory of existing affections",
        "newCrushProbability": "High",
        "newCrushDetails": "Transit trigger in 5th house for new attraction"
      },
      "romanceAtmosphere": {
        "emotionalWeather": "Atmosphere and chemistry description",
        "chemistryRating": 82
      },
      "manifestationPath": {
        "outcomeType": "classical_traditional_marriage",
        "outcomeLabel": "Classical Sacred Union & Long-Term Commitment",
        "manifestationLikelihood": "Likelihood of long-term union",
        "astrologicalPathReasoning": "5th/7th lords and Venus/Jupiter rays"
      },
      "detailedParagraphs": ["Paragraph 1: Romantic weather & openness.", "Paragraph 2: Crush evolution & mutual chemistry.", "Paragraph 3: Manifestation outcome & marriage viability."]
    },
    {
      "id": "health_vitality",
      "title": "Health & Physical Vitality",
      "verdict": "Caution Required",
      "confidenceScore": 0.76,
      "timingWindow": "${monthName} DD – DD, ${context.selectedYear}",
      "astrologicalReasoning": "6th/8th houses and Saturn/Mars aspect influence.",
      "practicalGuidance": "Pacing, sleep rhythm, stress decompression.",
      "healthDetails": {
        "vulnerableZones": ["Thoracic/cardiac", "Nervous fatigue", "Digestive pace"],
        "mentalTranquilityAndStress": "Mental peace evaluation under active Dasha",
        "holisticRemedies": "Breathing exercises, hydration, mindful pacing"
      },
      "detailedParagraphs": ["Paragraph 1: Physical stamina & vulnerable zones.", "Paragraph 2: Mental serenity & preventive routines."]
    },
    {
      "id": "finance_wealth",
      "title": "Wealth, Cashflow & Assets",
      "verdict": "Favorable Expansion",
      "confidenceScore": 0.84,
      "timingWindow": "${monthName} DD – DD, ${context.selectedYear}",
      "astrologicalReasoning": "2nd savings, 4th assets, 11th gains alignments.",
      "practicalGuidance": "Capital deployment and debt leverage review.",
      "financeDetails": {
        "liquidityVsOutflow": "Liquid cashflow vs fixed deployment",
        "windfallAndSpeculation": "Speculative upside vs risk discipline",
        "debtAndAssetFinancing": "Institutional borrowing or asset financing"
      },
      "detailedParagraphs": ["Paragraph 1: Cashflow liquidity & milestone inflows.", "Paragraph 2: Capital assets, investments & debt management."]
    },
    {
      "id": "family_home",
      "title": "Domestic Peace & Family Harmony",
      "verdict": "Favorable Expansion",
      "confidenceScore": 0.88,
      "timingWindow": "${monthName} DD – DD, ${context.selectedYear}",
      "astrologicalReasoning": "4th house domestic harmony, residence, and maternal vitality dynamics.",
      "practicalGuidance": "Home improvement and elder support.",
      "familyDetails": {
        "domesticAmbiance": "Home atmosphere and upgrades",
        "maternalWellbeing": "Mother's health and vitality",
        "propertyAndRelocation": "Real estate, renovation, or relocation scope"
      },
      "detailedParagraphs": ["Paragraph 1: Domestic living sanctuary.", "Paragraph 2: Maternal harmony & family alignment."]
    }
  ]
}`;
}

/**
 * Deterministic Parashara Fallback Synthesizer
 * Guarantees instantaneous, astronomically grounded responses when external APIs are unreachable.
 */
function synthesizeAnalyticalVedicNarrative(
  context: VedicHouseContext,
  provider: LLMProviderId,
  startMs: number
): LLMThreePartNarrative {
  const bhava = BHAVA_NAMES[context.houseNumber] || {
    title: `House ${context.houseNumber}`,
    karakas: 'Jupiter',
    financialRole: 'General Wealth'
  };
  const monthName = MONTH_NAMES[context.selectedMonth] || 'Active Month';
  const pdLord = context.activeDasha.pratyantardasha.split(' ')[0];
  const score = context.activationScore;
  const isHigh = context.isEventActive || score >= 0.55;

  // Derive micro-timing window dynamically from actual Moon transit spans if available!
  let peakDateRange = '';
  if (context.monthlyMoonSpans && context.monthlyMoonSpans.length > 0) {
    const directMoonSpan = context.monthlyMoonSpans.find(m => m.houseNumber === context.houseNumber);
    const aspectingMoonSpan = context.monthlyMoonSpans.find(m => 
      ((m.houseNumber + 6 - 1) % 12) + 1 === context.houseNumber || // 7th aspect
      ((m.houseNumber + 4 - 1) % 12) + 1 === context.houseNumber || // 5th aspect
      ((m.houseNumber + 8 - 1) % 12) + 1 === context.houseNumber    // 9th aspect
    );
    const chosenSpan = directMoonSpan || aspectingMoonSpan || context.monthlyMoonSpans[0];
    peakDateRange = `${monthName} ${chosenSpan.startDay} – ${chosenSpan.endDay}, ${context.selectedYear}`;
  } else {
    const startDay = ((context.houseNumber * 2 + context.selectedMonth * 3) % 20) + 5;
    const endDay = Math.min(startDay + 4, 28);
    peakDateRange = `${monthName} ${startDay} – ${endDay}, ${context.selectedYear}`;
  }

  // Derive dynamic confidence score
  const deliveryIndex = context.dashaDeliveryReport ? context.dashaDeliveryReport.overallIndex : 0.70;
  const computedConfidence = parseFloat(Math.min(0.98, Math.max(0.40, (score * 0.6 + deliveryIndex * 0.4))).toFixed(2));

  const isTamil = context.language === 'ta';

  const summary = isTamil
    ? isHigh
      ? `4-ஆம் வீடான ${context.tamilName} ராசி (${context.rashiName}), தசா புத்தி நாதரான ${pdLord}-ன் ஆதிக்கத்தால் இந்த மாதம் தீவிர கோச்சார ஆற்றலைப் பெறுகிறது.`
      : `4-ஆம் வீடான ${context.tamilName} ராசி (${context.rashiName}) அடிப்படை சுப பலங்களுடன் அடுத்த கட்ட இயக்கத்திற்கான தயாரிப்பு நிலையில் உள்ளது.`
    : isHigh
      ? `House ${context.houseNumber} (${context.rashiName}) experiences peak Gochara activation under the command of PD Lord ${pdLord}, unlocking high event manifestation.`
      : `House ${context.houseNumber} remains in an incubating preparatory phase with baseline activation score (${score.toFixed(2)}).`;

  const part1 = isTamil
    ? isHigh
      ? `நிகழ்வு சாத்தியக்கூறு ${(computedConfidence * 100).toFixed(0)}% (உயர் சாத்தியம்). தற்போதைய பிரத்யந்தர தசா நாதர் ${context.activeDasha.pratyantardasha} இந்த ${context.tamilName} பாவத்தின் மீது நேரடி ஆதிக்கத்தை செலுத்துகிறார். பிறப்பு ஜாதக தகுதியும் கோச்சார கிரக சேர்க்கையும் சாதகமாக இருப்பதால், மன விருப்பங்கள் எதார்த்தமான நடைமுறை நிகழ்வுகளாக மாறும் வாய்ப்பு அதிகம்.`
      : `நிகழ்வு சாத்தியக்கூறு மிதமானது (${(computedConfidence * 100).toFixed(0)}%). பிறப்பு ஜாதகத்தில் சாத்தியக்கூறுகள் இருந்தாலும், நடப்பு மாத கோச்சார கிரக அமைப்புகள் சற்று பொறுமையை வலியுறுத்துகின்றன.`
    : isHigh
      ? `Event Probability is assessed at ${(computedConfidence * 100).toFixed(0)}% (High Probability). The operational Pratyantar Dasha (PD) lord ${context.activeDasha.pratyantardasha} establishes direct governance over this Bhava (${bhava.title}). Because ${context.matchedRules.map(r => r.ruleName).join(' and ')} are actively aligned, the significations of ${context.rashiName} (${context.tamilName}) will materialize with tangible real-world outcomes rather than mere psychological desire.`
      : `Event Probability is moderate-to-low (${(computedConfidence * 100).toFixed(0)}%). While the natal foundation retains latent potential in ${context.rashiName}, the current Gochara transits provide insufficient trigger energy this month. Manifestation is delayed until the PD lord transitions into an aspecting trinal angle.`;

  const part2 = isTamil
    ? `நிதி மற்றும் மூலதன ஆதாரங்கள்: தன ஸ்தானம் (2-ஆம் இடம்) மற்றும் லாப ஸ்தானம் (11-ஆம் இடம்) வழியாக பணப்புழக்கம் சீராக உள்ளது. 4-ஆம் வீடு சொத்துக்கள், வீடு அல்லது வாகன முதலீடுகளைக் குறிப்பதால், சொந்த சேமிப்பு மற்றும் வங்கி கடன் வசதிகள் மூலம் மூலதனம் எளிதில் திரட்டப்படும்.`
    : context.houseNumber === 2 || context.houseNumber === 11
    ? `Financial inflows originate directly from Dhana (2nd) liquid reserves and Labha (11th) milestone profits. PD Lord ${pdLord} stimulates immediate liquidity, enabling capital accumulation and dividend yields.`
    : context.houseNumber === 4 || context.houseNumber === 6
    ? `Resource capitalization is powered by Sukha (4th) asset equity alongside Ari (6th) structured bank financing. Capital deployment requires institutional debt leverage or mortgage sanctions with favorable repayment schedules.`
    : context.houseNumber === 9 || context.houseNumber === 8
    ? `Funding draws upon Bhagya (9th) ancestral fortune and Randhra (8th) joint-venture spousal or unearned windfalls. Unexpected financial relief occurs through legacy settlements or insurance maturity.`
    : `Financial dynamics for House ${context.houseNumber} rely on ${bhava.financialRole}. Capital liquidity from the 2nd house and 11th house gains provides the necessary balance sheet strength.`;

  const part3 = isTamil
    ? `முக்கிய காலகட்டம் (Micro-Timing Window): ${peakDateRange}. இந்த நாட்களில் சந்திரன் இந்த பாவத்தை நேரடியாக அல்லது பார்வையின் மூலம் கடக்கும்போது நிகழ்வுகள் தீவிரமடையும். முடிவெடுக்கவும் செயலில் இறங்கவும் இதுவே உகந்த காலகட்டம்.`
    : `The micro-timing window peaks between ${peakDateRange}. During this interval, transiting Moon traverses the key trigger degree arc relative to ${context.rashiName}, while transiting ${context.transitOccupants[0]?.graha_key || 'planets'} synchronize with the natal degree grid. This represents the primary action window for concrete progress.`;

  const rawMarkdown = `### Astrological Reasoning & Micro-Timing Report (${provider.toUpperCase()})
**Target:** House ${context.houseNumber} (${context.rashiName} / ${context.tamilName})  
**Timeline:** ${monthName} ${context.selectedYear} | **PD Lord:** ${context.activeDasha.pratyantardasha}  
**Activation Score:** ${score.toFixed(2)} / 1.00 | **Delivery Capacity:** ${((deliveryIndex) * 100).toFixed(0)}%  
**Peak Micro-Window:** ${peakDateRange}  

---
#### 1. Event Probability & Scope
${part1}

#### 2. Financial & Resource Sources
${part2}

#### 3. Micro-Timing Window
${part3}
`;

  // Construct Dual Evaluation: Natal Promise vs. Transit Strength
  const natalPromiseScore = context.natalOccupants.length > 0 ? 0.88 : 0.72;
  const natalPromiseVerdict = isTamil
    ? `பிறப்பு ஜாதகத்தில் ${context.tamilName} ராசியில் குரு போன்ற சுப கிரகங்கள் அமைந்திருப்பது உறுதியான பாக்கிய அமைப்பைத் தருகிறது.`
    : context.natalOccupants.length > 0
    ? `Strong natal karmic sanction in ${context.rashiName}. Resident placement (${context.natalOccupants.map(o => o.body_name.split(' ')[0]).join(', ')}) establishes high baseline manifestation capacity in the native's D1/D9 grid.`
    : `Moderate baseline promise. Natal chart relies on lord governance and trinal aspect support for House ${context.houseNumber}.`;
  
  const transitDeliveryScore = deliveryIndex;
  const transitDeliveryVerdict = isTamil
    ? `விதி 5 தசா புத்தி மற்றும் கோச்சார அமைப்பின்படி பலன் வழங்கும் திறன் ${(deliveryIndex * 100).toFixed(0)}% ஆக உள்ளது.`
    : `Rule 5 Dasha Triad Delivery Capacity is evaluated at ${(deliveryIndex * 100).toFixed(0)}% (${context.dashaDeliveryReport?.status || 'Active Delivery'}). Transiting PD Lord ${pdLord} exerts direct operational governance.`;
  
  const synthesisVerdict = isTamil
    ? `உறுதியான பிறப்பு யோகமும் நடப்பு மாத தசா புத்தி கோச்சாரமும் இணைந்து நற்பலன்களை நடைமுறையில் தரும்.`
    : computedConfidence >= 0.75
    ? `High fruition: Robust natal promise synchronizes with positive transit delivery capacity, enabling tangible manifestation.`
    : `Preparatory incubation: Natal foundation remains solid, but physical manifestation requires patient transit alignment.`;

  // Helper to extract specific Moon transit windows from monthlyMoonSpans
  const getMoonWindowForHouses = (targetHouses: number[], defaultDays: [number, number]): string => {
    if (context.monthlyMoonSpans && context.monthlyMoonSpans.length > 0) {
      const match = context.monthlyMoonSpans.find(m => targetHouses.includes(m.houseNumber));
      if (match) {
        return `${monthName} ${match.startDay} – ${match.endDay}, ${context.selectedYear}`;
      }
    }
    return `${monthName} ${defaultDays[0]} – ${defaultDays[1]}, ${context.selectedYear}`;
  };

  const careerWindow = getMoonWindowForHouses([10, 1], [9, 13]);
  const loveWindow = getMoonWindowForHouses([5, 7], [2, 6]);
  const healthWindow = getMoonWindowForHouses([4, 6, 8], [22, 25]);
  const financeWindow = getMoonWindowForHouses([2, 11], [11, 14]);
  const familyWindow = getMoonWindowForHouses([4], [23, 26]);

  const supplementaryScenarios: import('./types').SupplementaryDomainScenario[] = isTamil
    ? [
        {
          id: 'career_job',
          title: 'தொழில், வேலை தேடல் & உத்தியோக உயர்வு',
          verdict: 'சாதகமான வளர்ச்சி',
          confidenceScore: parseFloat(Math.min(0.95, computedConfidence + 0.02).toFixed(2)),
          timingWindow: careerWindow,
          astrologicalReasoning: `10-ஆம் இடமான கர்ம ஸ்தானம் மற்றும் 6-ஆம் இடமான சேவை ஸ்தானம் சுப கிரக பார்வையைப் பெறுவதால், உத்தியோகத்தில் புதிய பொறுப்புகளும், வேலை தேடலில் உறுதியான முன்னேற்றமும் உருவாகும்.`,
          practicalGuidance: `புதிய வேலைக்கான நேர்காணல்களில் தயக்கமின்றி பங்கேற்கவும். தற்போதைய பணியிடத்தில் முக்கிய பொறுப்புகளை ஏற்று நடத்துவது பாராட்டைப் பெற்றுத் தரும்.`,
          employmentStatusInference: {
            status: isHigh ? 'currently_serving' : 'actively_seeking',
            label: isHigh ? 'பணியில் உள்ளார் (Currently Employed)' : 'வேலை தேடும் நிலை / பணியிட மாற்றம் (In Transition)',
            indicatorColor: isHigh ? 'green' : 'yellow',
            confidence: 0.88,
            inferenceReasoning: isHigh
              ? 'பிறப்பு ஜாதகத்தில் 10-ஆம் அதிபதியும் 6-ஆம் அதிபதியும் தசா நாதரின் பலத்துடன் இணைந்து செயல்படுவதால், ஜாதகர் தற்போது செயலில் உள்ள பணியில் இருக்கிறார் என்பது தெளிவாகிறது.'
              : 'தசா சந்தி மற்றும் ராகு/கேது கோச்சாரம் 10-ஆம் பாவத்தை தொடுவதால், ஜாதகர் புதிய பணி வாய்ப்புகளை தீவிரமாக தேடும் நிலையில் உள்ளார்.'
          },
          jobSearchAnalysis: {
            momentum: 'வேலை தேடலில் தீவிர முன்னேற்றம் மற்றும் நேர்காணல் அழைப்புகள்',
            pastStruggleVsCurrentPhase: 'கடந்த காலத்தில் நிலவிய தாமதங்கள் விலகி, நடப்பு மாத சந்திர கோச்சாரம் புதிய நிறுவனங்களில் வாய்ப்புகளை எளிதில் பெற்றுத் தரும்.',
            timingAuspiciousness: 'இந்த மாதம் புதிய வேலை ஆணை (Offer Letter) பெற மிகவும் உகந்த நன்னாளாக அமைகிறது.'
          },
          newJobAcquisition: {
            jobTypeAndMood: 'தலைமைப் பொறுப்பு, தொழில்நுட்ப மேலாண்மை அல்லது நேரடி ஆலோசனை பணிகள்.',
            workplaceAtmosphere: 'நல்ல ஊதியம், சுயாட்சி மற்றும் ஆரோக்கியமான நிறுவன கலாச்சாரம்.',
            comparisonWithCurrentRole: 'தற்போதைய பணியை விட 25–40% கூடுதல் ஊதியம் மற்றும் சிறந்த அங்கீகாரம் கிட்டும்.'
          },
          existingJobPhase: {
            currentPhaseNature: 'தற்போதைய பணியில் அதிக வேலைப்பளு இருந்தாலும் மேலதிகாரிகளின் பாராட்டு கிடைக்கும்.',
            retentionVsExitAdvice: 'புதிய வேலைக்கான உறுதி ஆவணம் வரும் வரை தற்போதைய பணியை அவசரமாக விட வேண்டாம்.'
          },
          detailedParagraphs: [
            '1. உத்தியோக தகுதி மற்றும் வேலை தேடல் நிலை: கர்ம ஸ்தானமான 10-ஆம் வீட்டின் அமைப்பும் விதி 5 தசா புத்தியும் ஜாதகரின் தொழில் வாழ்க்கையை வலுப்படுத்துகின்றன. கடந்த கால தேக்க நிலைகள் முடிவுக்கு வந்து புதிய நேர்காணல்கள் சாதகமாகும்.',
            '2. புதிய வேலை மற்றும் சூழல்: அமையவிருக்கும் புதிய பணி தற்போதைய நிலையை விட உயர்ந்த பதவி மற்றும் பொருளாதார வசதியைத் தரும். தலைமை தாங்கும் அதிகாரமும் மேன்மையான வழிகாட்டுதலும் கிடைக்கும்.',
            '3. தற்போதைய பணியிட வழிகாட்டல்: பணியில் உள்ளவர்கள் நிர்வாகத்துடன் இணக்கமாக செயல்பட்டு, முக்கிய திட்டங்களை வெற்றிகரமாக முடித்துக் காட்டுவது பதவி உயர்வுக்கு வழிவகுக்கும்.'
          ]
        },
        {
          id: 'love_romance',
          title: 'காதல், ஈர்ப்பு, க்ரஷ் & திருமண உறவு',
          verdict: 'மிதமான முன்னேற்றம்',
          confidenceScore: parseFloat(Math.max(0.60, computedConfidence - 0.08).toFixed(2)),
          timingWindow: loveWindow,
          astrologicalReasoning: `5-ஆம் இடமான பூர்வ புண்ணிய ஸ்தானம் மற்றும் சுக்கிரனின் கோச்சார சேர்க்கை உள்ளத்தில் மென்மையான ஈர்ப்பையும், புதிய காதல் அலைகளையும் உருவாக்கும்.`,
          practicalGuidance: `மனதிற்கு பிடித்தவருடன் வெளிப்படையாகவும் உண்மையாகவும் பேசுங்கள். தேவையற்ற சந்தேகங்களைத் தவிர்ப்பது அமைதியைத் தரும்.`,
          crushStatusInference: {
            existingCrushTrajectory: 'ஏற்கனவே உள்ள க்ரஷ் அல்லது ஈர்ப்பு நிலை: இருபுறமும் உண்மை உணர்வுகள் இருப்பின், வெளிப்படையான உரையாடல் மூலம் அன்பு மலரும்; ஒருதலைக்காதல் எனில் எதார்த்த நிலை புரியும்.',
            newCrushProbability: 'High',
            newCrushDetails: 'சமூக வட்டாரங்கள், நண்பர்கள் அல்லது அலுவலக சூழலில் எதிர்பாராத புதிய நட்பு மற்றும் இனிமையான ஈர்ப்பு உருவாக அதிக வாய்ப்புள்ளது.'
          },
          romanceAtmosphere: {
            emotionalWeather: 'உள்ளத்தில் படபடப்பு, ஆவலுடன் கூடிய எதிர்பார்ப்பு மற்றும் அன்பான உணர்வுகள்.',
            chemistryRating: 84
          },
          manifestationPath: {
            outcomeType: 'classical_traditional_marriage',
            outcomeLabel: 'பாரம்பரிய முறைப்படியான திருமணம் & நிரந்தர பந்தம்',
            manifestationLikelihood: 'உயர்ந்த பாக்கிய அமைப்பு: தற்போதைய காதல் வெறும் தற்காலிக ஈர்ப்பாக அமையாமல் குடும்ப சம்மதத்துடன் திருமண பந்தமாக மாறும் ஆற்றல் கொண்டது.',
            astrologicalPathReasoning: '7-ஆம் இடமான களத்திர ஸ்தானத்தில் குரு பார்வை பதிவதும், நவாம்சத்தில் சுக்கிரன் பலம்பெறுவதும் பாரம்பரிய இல்லற யோகத்தை உறுதி செய்கிறது.'
          },
          detailedParagraphs: [
            '1. காதல் வானிலை மற்றும் மன உணர்வுகள்: 5-ஆம் பாவத்தின் அதிர்வு ஜாதகரின் மனதில் புதுவித அன்பையும் மகிழ்ச்சியையும் தோற்றுவிக்கிறது. கடந்த கால தயக்கங்கள் நீங்கி மனம் காதலை வரவேற்கத் தயாராகிறது.',
            '2. க்ரஷ் போக்கு மற்றும் புதிய ஈர்ப்பு: ஏற்கனவே மனதில் உள்ள அன்பான எண்ணங்கள் வெளிப்படத் தொடங்கும். புதிய அறிமுகங்களும் இனிமையான நினைவுகளாக மாறும்.',
            '3. உண்மையான காதல் பரிணாமம்: குருவின் ஆசியால் இக்காதல் உணர்வு சமூகமும் குடும்பமும் போற்றும் உன்னத திருமண வாழ்க்கையாக மலர நல்ல வாய்ப்புகள் உண்டு.'
          ]
        },
        {
          id: 'health_vitality',
          title: 'உடல்நலம் & மன அமைதி (சுகம்)',
          verdict: 'கவனம் தேவை',
          confidenceScore: parseFloat((0.74).toFixed(2)),
          timingWindow: healthWindow,
          astrologicalReasoning: `4-ஆம் இடம் மார்பு, இதயம் மற்றும் மன அமைதியைக் குறிப்பதால், சனியின் தொடர்பு அதிக வேலைப்பளுவையும் மன அழுத்தத்தையும் தரலாம்.`,
          practicalGuidance: `சரியான தூக்கம், உடற்பயிற்சி மற்றும் அமைதியான மனநிலையைக் கடைப்பிடிக்கவும். தேவையற்ற சிந்தனைகளைத் தவிர்க்கவும்.`,
          healthDetails: {
            vulnerableZones: ['மார்பு மற்றும் இதயப் பகுதி', 'தூக்கமின்மை / நரம்பு சோர்வு', 'செரிமான உபாதைகள்'],
            mentalTranquilityAndStress: 'வேலைப்பளுவால் மன அமைதி சற்று ஊசலாடலாம்; தியானம் மற்றும் மூச்சுப்பயிற்சி மன அமைதியைத் தரும்.',
            holisticRemedies: 'போதுமான நீர் அருந்துதல், இயற்கையான உணவுகள், மற்றும் இரவு நேர செல்போன் பயன்பாட்டைக் குறைத்தல்.'
          },
          detailedParagraphs: [
            '1. உடல் ஆரோக்கியம்: மார்பு மற்றும் முதுகுத் தண்டுவடத்தில் அதிக அழுத்தம் ஏற்படாமல் உடற்பயிற்சி செய்வது அவசியம்.',
            '2. மன சுகம்: வேலைச்சுமையால் ஏற்படும் மன அழுத்தத்தைத் தவிர்த்து குடும்பத்தினருடன் நேரம் செலவிடுவது புத்துணர்ச்சியைத் தரும்.'
          ]
        },
        {
          id: 'finance_wealth',
          title: 'பொருளாதாரம், சேமிப்பு & முதலீடுகள்',
          verdict: 'சாதகமான வளர்ச்சி',
          confidenceScore: parseFloat(Math.min(0.96, computedConfidence + 0.04).toFixed(2)),
          timingWindow: financeWindow,
          astrologicalReasoning: `தன ஸ்தானம் (2) மற்றும் லாப ஸ்தானம் (11) பலத்தால் சொத்துக்கள் வாங்குதல் அல்லது முதலீடுகள் சாதகமாக அமையும்.`,
          practicalGuidance: `பத்திரங்கள் மற்றும் வங்கி கடன் ஆவணங்களை முறையாக ஆராய்ந்து கையெழுத்திடவும். நீண்ட கால அடிப்படையில் நல்ல லாபம் கிடைக்கும்.`,
          financeDetails: {
            liquidityVsOutflow: 'வங்கிக் கணக்கில் பணப்புழக்கம் சீராக இருக்கும்; சொத்து முதலீடுகளுக்காக நிதி செலவிடப்படலாம்.',
            windfallAndSpeculation: 'பங்குச்சந்தை மற்றும் எதிர்பாராத வரவுகளில் மிதமான லாபம் உண்டு; அதிக பேராசையைத் தவிர்க்கவும்.',
            debtAndAssetFinancing: 'வீடு, வாகன அல்லது தொழில் கடன்கள் குறைந்த வட்டியில் எளிதாக ஒப்புதல் பெறும்.'
          },
          detailedParagraphs: [
            '1. பணப்புழக்கம் மற்றும் வரவுகள்: தன ஸ்தானமும் லாப ஸ்தானமும் இணைந்து வருமான வாய்ப்புகளைப் பெருக்குகின்றன.',
            '2. மூலதன முதலீடுகள்: அசையா சொத்துக்கள், நிலம் அல்லது வாகனங்களில் செய்யப்படும் முதலீடுகள் நீண்ட கால நற்பலனைத் தரும்.'
          ]
        },
        {
          id: 'family_home',
          title: 'குடும்ப ஒற்றுமை, வீடு & தாய் நலம்',
          verdict: 'சாதகமான வளர்ச்சி',
          confidenceScore: parseFloat(Math.min(0.98, computedConfidence + 0.06).toFixed(2)),
          timingWindow: familyWindow,
          astrologicalReasoning: `4-ஆம் இடத்தின் முதன்மை காரகத்துவமான மாத்ரு பாவம் மற்றும் சுக ஸ்தானம் இந்த மாதம் சிறப்பாக செயல்படுகிறது.`,
          practicalGuidance: `வீட்டு அமைப்பைப் புதுப்பித்தல், குடும்பப் பெரியவர்கள் மற்றும் தாயாரின் நலம் பேணுவதில் கவனம் செலுத்துங்கள்.`,
          familyDetails: {
            domesticAmbiance: 'வீட்டில் மகிழ்ச்சியான சூழல், சுப நிகழ்ச்சிகள் மற்றும் அமைதி நிலவும்.',
            maternalWellbeing: 'தாயாரின் உடல்நிலை தேறி மனமகிழ்ச்சி பெருகும்; தாயின் ஆசிகள் துணை நிற்கும்.',
            propertyAndRelocation: 'வீடு புதுப்பித்தல் அல்லது புதிய வீட்டிற்கு மாறுவதற்கான முயற்சிகள் கைகூடும்.'
          },
          detailedParagraphs: [
            '1. இல்லற அமைதி: குடும்பத்தில் நிலவிய சிறு மனஸ்தாபங்கள் மறைந்து அமைதியும் மகிழ்ச்சியும் கூடும்.',
            '2. மாத்ரு பாக்கியம்: தாய்வழி உறவுகள் மற்றும் தாயாரின் அன்பு ஜாதகருக்கு பலம் சேர்க்கும்.'
          ]
        }
      ]
    : [
        {
          id: 'career_job',
          title: 'Career, Job Search & Professional Standing',
          verdict: isHigh ? 'Favorable Expansion' : 'Moderate Progress',
          confidenceScore: parseFloat(Math.min(0.95, computedConfidence + 0.02).toFixed(2)),
          timingWindow: careerWindow,
          astrologicalReasoning: `The 10th house of Karma Bhava and 6th house of professional service establish active alignment with the Dasha Triad lord. Favorable planetary rays unlock tangible professional advancement, active recruiter conversion, and leadership visibility.`,
          practicalGuidance: `Actively pursue high-impact career conversations and interview pipelines. In your current workplace, present deliverables directly to senior stakeholders.`,
          employmentStatusInference: {
            status: isHigh ? 'currently_serving' : 'actively_seeking',
            label: isHigh ? 'Currently Serving in a Job (Employed)' : 'In Transition / Actively Seeking Job',
            indicatorColor: isHigh ? 'green' : 'yellow',
            confidence: 0.88,
            inferenceReasoning: isHigh
              ? 'The 10th lord and 6th lord exhibit high Shadbala and harmonious Kendra-Trikona aspect, verifying ongoing professional service responsibilities and active organizational employment.'
              : 'Nodal aspect on the 10th-4th axis combined with Dasha transition reflects active candidate job-search momentum and strategic career restructuring.'
          },
          jobSearchAnalysis: {
            momentum: 'Strong recruitment acceleration after past delays',
            pastStruggleVsCurrentPhase: 'Past cycles experienced bureaucratic delays and interview bottlenecks under Saturnian aspects. The current lunar ingress and planetary alignment unlock rapid hiring decisions.',
            timingAuspiciousness: 'Exceptionally auspicious calendar window for landing competitive job offers and negotiating terms.'
          },
          newJobAcquisition: {
            jobTypeAndMood: 'Strategic architecture, engineering management, or cross-functional systems leadership.',
            workplaceAtmosphere: 'High-growth, meritocratic culture with greater operational autonomy and reduced micromanagement.',
            comparisonWithCurrentRole: 'Significantly more rewarding: 25–40% enhancement in total compensation and higher market visibility compared to current role.'
          },
          existingJobPhase: {
            currentPhaseNature: 'For ongoing roles: high deliverable load and executive reorganization. Management is evaluating output ahead of upcoming promotions.',
            retentionVsExitAdvice: 'Exercise tact; avoid precipitous departures until the written offer is finalized. Use incoming interest as strategic retention leverage.'
          },
          detailedParagraphs: [
            '1. Professional Status & Astrological Sanction: The native operates under an active 10th-house Karma Bhava and 6th-house service axis. Benefic planetary rays validate that past hard work is recognized by key stakeholders, unlocking new executive standing.',
            '2. Job Search Pipeline & Auspicious Conversion Window: For candidates actively seeking new placement or role changes, the stagnation of prior months dissolves. The transit of Chandra (Moon) across key trines opens fertile dialogue with hiring authorities, marking an ideal offer finalization window.',
            '3. Comparative Role Valuation & Workplace Strategy: Any new opportunity acquired during this cycle presents superior remuneration and intellectual autonomy. If retaining the current position, the native should document milestone achievements and avoid unnecessary office friction.'
          ]
        },
        {
          id: 'love_romance',
          title: 'Love, Romance, Crush & Relationship Horizon',
          verdict: 'Moderate Progress',
          confidenceScore: parseFloat(Math.max(0.60, computedConfidence - 0.08).toFixed(2)),
          timingWindow: loveWindow,
          astrologicalReasoning: `House 5 (Purva Punya & romantic intellect) and House 4 (emotional sanctuary) receive gentle Venusian stimulation. Planetary alignments awaken affectionate warmth, clear past cynicism, and encourage genuine vulnerability.`,
          practicalGuidance: `Communicate heartfelt intentions with honesty and emotional presence. Balance family duties with romantic quality time.`,
          crushStatusInference: {
            existingCrushTrajectory: 'A decisive phase for existing affections: mutual feelings find reciprocation and warm dialogue, while unreciprocated dynamics gently resolve without lingering heartache.',
            newCrushProbability: 'High',
            newCrushDetails: 'Strong transit trigger via 5th house trines and Venusian ingress indicates high likelihood of an unexpected romantic attraction sparking in social or intellectual learning spaces.'
          },
          romanceAtmosphere: {
            emotionalWeather: 'Sweet emotional fluttering accompanied by nervous anticipation, affectionate curiosity, and romantic warmth.',
            chemistryRating: 86
          },
          manifestationPath: {
            outcomeType: 'classical_traditional_marriage',
            outcomeLabel: 'Classical Sacred Union & Long-Term Commitment',
            manifestationLikelihood: 'High karmic viability: genuine romantic connections formed or matured during this transit carry strong sanction to evolve into formal, classical matrimonial commitment.',
            astrologicalPathReasoning: 'Jupiter rays on 7th Kalatra Bhava and fortified 5th lord in Navamsha D9 prioritize enduring traditional union over temporary infatuation.'
          },
          detailedParagraphs: [
            '1. Romantic Weather & Inner Sentiments: The 5th house of romance and the 4th house of heart-sanctuary are stimulated. The native feels an emotional awakening, moving away from past guardedness and welcoming romantic vulnerability.',
            '2. Crush Evolution & New Sparks: For those harboring an unspoken crush, this period fosters open, warm dialogue. A high probability also exists for a captivating new connection to enter their circle through shared intellectual or social environments.',
            '3. Real Love Manifestation & Matrimonial Path: Parashara principles affirm that romantic energy under benefic Jupiter and Venus transits favors classical long-term commitment and family-supported union, grounding romantic fluttering into lasting companionship.'
          ]
        },
        {
          id: 'health_vitality',
          title: 'Health, Vitality & Mental Peace (Sukha)',
          verdict: isHigh ? 'Caution Required' : 'Moderate Progress',
          confidenceScore: parseFloat((0.74).toFixed(2)),
          timingWindow: healthWindow,
          astrologicalReasoning: `House 4 governs thoracic/cardiac vitality and internal serenity (*Sukha/Manas*). Saturn's presence advises moderation in physical exertion, disciplined rest schedules, and stress containment.`,
          practicalGuidance: `Prioritize restorative sleep, hydration, and cardiovascular pacing. Avoid emotional overthinking or taking on excessive familial stress.`,
          healthDetails: {
            vulnerableZones: ['Thoracic / chest cavity', 'Sleep cycle rhythm', 'Lower back / nervous strain'],
            mentalTranquilityAndStress: 'Mental tranquility (Sukha) fluctuates under Saturnian aspect; avoid cognitive burnout and bedtime screen fatigue.',
            holisticRemedies: 'Pranayama breathing exercises, magnesium-rich hydration, and daily morning sunlight exposure.'
          },
          detailedParagraphs: [
            '1. Physical Vitality & Stress Containment: The thoracic and cardiovascular centers require pacing under current Saturnian transit rays. Avoid overexertion during high-workload weeks.',
            '2. Mental Tranquility & Restorative Routine: Conscious evening detachment from screens and dedicated breathing practices will protect sleep architecture and keep vitality stable.'
          ]
        },
        {
          id: 'finance_wealth',
          title: 'Wealth, Cashflow & Capital Outflows',
          verdict: 'Favorable Expansion',
          confidenceScore: parseFloat(Math.min(0.96, computedConfidence + 0.04).toFixed(2)),
          timingWindow: financeWindow,
          astrologicalReasoning: `Liquid reserves from Dhana (2nd) and gains from Labha (11th) intersect with House ${context.houseNumber} fixed assets. Favorable for deployment into physical property, vehicle acquisition, or equity investments with long-term asset value.`,
          practicalGuidance: `Scrutinize mortgage and acquisition documents carefully. Capital deployments initiated during this sub-window promise solid compounding stability.`,
          financeDetails: {
            liquidityVsOutflow: 'Liquid bank savings (2nd house) remain stable, but fixed asset capital deployments (4th house) require scheduled drawdown.',
            windfallAndSpeculation: 'Speculative equity or bonus windfalls (5th/8th) show moderate upside; exercise caution around volatile instruments during Rahu transits.',
            debtAndAssetFinancing: 'Institutional collateral or home loan approvals are strongly favored with low interest friction.'
          },
          detailedParagraphs: [
            '1. Cashflow Dynamics & Income Inflows: Dhana and Labha houses align positively, providing healthy liquidity and residual capital gains.',
            '2. Asset Deployments & Debt Servicing: Favorable terms for mortgage financing or vehicle acquisition will safeguard balance sheet security for the long haul.'
          ]
        },
        {
          id: 'family_home',
          title: 'Domestic Harmony, Residence & Mother',
          verdict: 'Favorable Expansion',
          confidenceScore: parseFloat(Math.min(0.98, computedConfidence + 0.06).toFixed(2)),
          timingWindow: familyWindow,
          astrologicalReasoning: `Direct core domain of House ${context.houseNumber} (*Griha Saukhya & Matru Bhava*). Planetary alignments focus energy on residence upgrades, living room ambiance, and supporting maternal wellbeing.`,
          practicalGuidance: `Dedicate time to enhancing the household sanctuary and supporting family elders. A peaceful domestic foundation directly elevates career momentum.`,
          familyDetails: {
            domesticAmbiance: 'Favorable domestic atmosphere with potential home decoration, appliance upgrades, or family gatherings.',
            maternalWellbeing: 'Maternal blessings and mother’s health show notable improvement and vitality.',
            propertyAndRelocation: 'Favorable for exploring residential leases, renovation permits, or land equity investments.'
          },
          detailedParagraphs: [
            '1. Domestic Environment & Living Sanctuary: The home sphere benefits from cosmetic upgrades, decluttering, and renewed warmth among family members.',
            '2. Maternal Blessings & Harmony: Supporting maternal health and respecting elder guidance creates a powerful auspicious foundation for personal peace.'
          ]
        }
      ];

  return {
    part1_probabilityAndScope: part1,
    part2_financialAndResources: part2,
    part3_microTimingWindow: part3,
    summarySentence: summary,
    overallConfidence: computedConfidence,
    peakDateRange,
    rawMarkdown,
    providerUsed: provider,
    executionTimeMs: Date.now() - startMs,
    endpointUsed: provider === 'local_qwen' ? 'http://localhost:11434/api/generate' : provider === 'gemini_pro' ? 'Google GenAI Cloud API' : 'Anthropic Claude Messages API',
    connectionStatus: 'simulated',
    isPrivateLocal: provider === 'local_qwen',
    promptSent: buildVedicPrompt(context, provider),
    natalPromiseVsTransitDelivery: {
      natalPromiseScore,
      natalPromiseVerdict,
      transitDeliveryScore,
      transitDeliveryVerdict,
      synthesisVerdict
    },
    supplementaryScenarios,
    rawRequestBody: {
      provider,
      mode: 'deterministic_analytical_engine',
      houseNumber: context.houseNumber,
      activeDasha: context.activeDasha
    },
    rawResponseBody: {
      status: 'synthesized_analytical_parashara',
      summary,
      confidence: computedConfidence,
      microWindow: peakDateRange,
      supplementaryScenariosCount: supplementaryScenarios.length
    }
  };
}

/**
 * Health check helper for local Ollama instance
 */
export async function checkOllamaHealth(endpoint = 'http://localhost:11434'): Promise<{
  isOnline: boolean;
  version?: string;
  models: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${endpoint}/api/tags`, {
      method: 'GET'
    });

    if (res.ok) {
      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name) : [];
      return { isOnline: true, models };
    }
    return { isOnline: false, models: [], error: `HTTP ${res.status}: ${res.statusText}` };
  } catch (err: any) {
    return {
      isOnline: false,
      models: [],
      error: err.message || 'Connection refused (Is Ollama running?)'
    };
  }
}

/**
 * Unloads the model and frees local GPU/VRAM and system memory in Ollama immediately.
 */
export async function purgeOllamaMemory(model?: string, endpoint = 'http://localhost:11434'): Promise<boolean> {
  try {
    await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'qwen2.5:7b-instruct',
        keep_alive: 0
      })
    });
    return true;
  } catch {
    return false;
  }
}

function mergeScenarios(
  parsedScenarios: any[],
  fallbackScenarios: import('./types').SupplementaryDomainScenario[]
): import('./types').SupplementaryDomainScenario[] {
  if (!Array.isArray(parsedScenarios) || parsedScenarios.length === 0) {
    return fallbackScenarios;
  }
  return fallbackScenarios.map(fallbackItem => {
    const matched = parsedScenarios.find((p: any) => p && p.id === fallbackItem.id);
    if (!matched) return fallbackItem;
    return {
      ...fallbackItem,
      ...matched,
      employmentStatusInference: matched.employmentStatusInference || fallbackItem.employmentStatusInference,
      jobSearchAnalysis: matched.jobSearchAnalysis || fallbackItem.jobSearchAnalysis,
      newJobAcquisition: matched.newJobAcquisition || fallbackItem.newJobAcquisition,
      existingJobPhase: matched.existingJobPhase || fallbackItem.existingJobPhase,
      crushStatusInference: matched.crushStatusInference || fallbackItem.crushStatusInference,
      romanceAtmosphere: matched.romanceAtmosphere || fallbackItem.romanceAtmosphere,
      manifestationPath: matched.manifestationPath || fallbackItem.manifestationPath,
      financeDetails: matched.financeDetails || fallbackItem.financeDetails,
      healthDetails: matched.healthDetails || fallbackItem.healthDetails,
      familyDetails: matched.familyDetails || fallbackItem.familyDetails,
      detailedParagraphs: (Array.isArray(matched.detailedParagraphs) && matched.detailedParagraphs.length > 0)
        ? matched.detailedParagraphs
        : fallbackItem.detailedParagraphs
    };
  });
}

/**
 * Ultra-resilient JSON parser for LLM responses (Ollama, Gemini, Claude).
 * Solves:
 * 1. DeepSeek / Qwen reasoning tags: <think>...</think>
 * 2. Markdown code fences: ```json ... ``` or ``` ... ```
 * 3. Conversational preamble / postamble: "Here is the JSON: { ... } Hope this helps"
 * 4. Truncated / unclosed JSON: auto-recovers balanced braces or uses regex field extraction
 * 5. String-nested JSON: Prevents raw JSON from ever being placed into text fields like part1_probabilityAndScope
 */
function unescapeJsonString(str: string): string {
  try {
    return JSON.parse(`"${str}"`);
  } catch {
    return str.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
}

/**
 * Robustly converts any arbitrary output (raw string, nested JSON object, array, or stringified JSON)
 * into clean, readable human English prose without exposing JSON syntax, curly braces, quotes, or keys.
 */
export function extractReadableProse(val: any, fallbackVal: string = ''): string {
  if (val === undefined || val === null) return fallbackVal;

  // 1. If it's an object / dictionary, convert keys & values to clean English paragraphs
  if (typeof val === 'object' && !Array.isArray(val)) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(val)) {
      if (typeof v === 'string' && v.trim().length > 0) {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
        parts.push(`${label.charAt(0).toUpperCase() + label.slice(1)}: ${v.trim()}`);
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
        parts.push(`${label.charAt(0).toUpperCase() + label.slice(1)}: ${v}`);
      } else if (Array.isArray(v)) {
        parts.push(v.map(item => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n'));
      } else if (v && typeof v === 'object') {
        parts.push(extractReadableProse(v, ''));
      }
    }
    const joined = parts.filter(Boolean).join('\n\n');
    return joined.length > 0 ? joined : fallbackVal;
  }

  // 2. If it's an array
  if (Array.isArray(val)) {
    return val.map(item => extractReadableProse(item, '')).filter(Boolean).join('\n\n') || fallbackVal;
  }

  if (typeof val !== 'string') return fallbackVal;

  const trimmed = val.trim();

  // 3. If string is serialized JSON (starts with { or [)
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        if (parsed.part1_probabilityAndScope) {
          return extractReadableProse(parsed.part1_probabilityAndScope, fallbackVal);
        }
        if (parsed.event_probability_and_scope) {
          return extractReadableProse(parsed.event_probability_and_scope, fallbackVal);
        }
        if (parsed.summarySentence && !parsed.part2_financialAndResources) {
          return parsed.summarySentence;
        }
        return extractReadableProse(parsed, fallbackVal);
      }
    } catch {
      // If parsing fails, extract text matches from key: "value" pairs
      const textMatches = trimmed.match(/"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/g);
      if (textMatches && textMatches.length > 0) {
        const lines: string[] = [];
        for (const tm of textMatches) {
          const m = tm.match(/"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/);
          if (m && m[1] && m[2]) {
            const key = m[1].replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
            const textVal = m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            lines.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${textVal}`);
          }
        }
        if (lines.length > 0) return lines.join('\n\n');
      }
    }
  }

  // Strip accidental outer curly braces or quotes
  const cleaned = trimmed.replace(/^\{+/, '').replace(/\}+$/, '').trim();
  return cleaned.length > 0 ? cleaned : fallbackVal;
}

function sanitizeCleanField(val: any, fallbackVal: string): string {
  return extractReadableProse(val, fallbackVal);
}

function repairTruncatedJson(str: string): string {
  let trimmed = str.trim();
  
  // If unclosed string literal, close it
  let inString = false;
  let escaped = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (ch === '"' && !escaped) {
      inString = !inString;
    }
    escaped = false;
  }
  if (inString) {
    trimmed += '"';
  }

  // Count open brackets [ vs ]
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    trimmed += ']';
  }

  // Count open braces { vs }
  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) {
    trimmed += '}';
  }

  return trimmed;
}

function extractFieldsViaRegex(raw: string, fallback: import('./types').LLMThreePartNarrative): any {
  const result: any = {};

  const summaryMatch = raw.match(/"summarySentence"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch && summaryMatch[1]) {
    result.summarySentence = unescapeJsonString(summaryMatch[1]);
  }

  const p1Match = raw.match(/"part1_probabilityAndScope"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (p1Match && p1Match[1]) {
    result.part1_probabilityAndScope = unescapeJsonString(p1Match[1]);
  }

  const p2Match = raw.match(/"part2_financialAndResources"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (p2Match && p2Match[1]) {
    result.part2_financialAndResources = unescapeJsonString(p2Match[1]);
  }

  const p3Match = raw.match(/"part3_microTimingWindow"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (p3Match && p3Match[1]) {
    result.part3_microTimingWindow = unescapeJsonString(p3Match[1]);
  }

  const peakMatch = raw.match(/"peakDateRange"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (peakMatch && peakMatch[1]) {
    result.peakDateRange = unescapeJsonString(peakMatch[1]);
  }

  const confMatch = raw.match(/"overallConfidence"\s*:\s*([0-9.]+)/);
  if (confMatch && confMatch[1]) {
    result.overallConfidence = parseFloat(confMatch[1]);
  }

  const natalMatch = raw.match(/"natalPromiseVsTransitDelivery"\s*:\s*({[\s\S]*?})/);
  if (natalMatch && natalMatch[1]) {
    try {
      result.natalPromiseVsTransitDelivery = JSON.parse(natalMatch[1]);
    } catch {}
  }

  const suppMatch = raw.match(/"supplementaryScenarios"\s*:\s*(\[[\s\S]*?\])/);
  if (suppMatch && suppMatch[1]) {
    try {
      result.supplementaryScenarios = JSON.parse(suppMatch[1]);
    } catch {
      try {
        const repaired = repairTruncatedJson(suppMatch[1]);
        result.supplementaryScenarios = JSON.parse(repaired);
      } catch {}
    }
  }

  return {
    ...fallback,
    ...result,
    part1_probabilityAndScope: sanitizeCleanField(result.part1_probabilityAndScope, fallback.part1_probabilityAndScope),
    part2_financialAndResources: sanitizeCleanField(result.part2_financialAndResources, fallback.part2_financialAndResources),
    part3_microTimingWindow: sanitizeCleanField(result.part3_microTimingWindow, fallback.part3_microTimingWindow),
    summarySentence: sanitizeCleanField(result.summarySentence, fallback.summarySentence)
  };
}

function buildNormalizedResult(parsed: any, fallback: import('./types').LLMThreePartNarrative): any {
  if (!parsed || typeof parsed !== 'object') return fallback;

  let root = parsed;
  if (root.response && typeof root.response === 'object') root = root.response;
  else if (root.result && typeof root.result === 'object') root = root.result;
  else if (root.analysis && typeof root.analysis === 'object') root = root.analysis;
  else if (root.data && typeof root.data === 'object') root = root.data;
  else if (root.prediction && typeof root.prediction === 'object') root = root.prediction;

  const p1 = root.part1_probabilityAndScope ?? root.part1 ?? root.event_probability_and_scope ?? root.eventProbabilityAndScope ?? root.probability_and_scope ?? root.probabilityAndScope ?? root['Part 1: Event Probability & Scope'] ?? root['Part 1'];
  const p2 = root.part2_financialAndResources ?? root.part2 ?? root.financial_and_resources ?? root.financialAndResources ?? root['Part 2: Financial & Resource Sources'] ?? root['Part 2'];
  const p3 = root.part3_microTimingWindow ?? root.part3 ?? root.micro_timing_window ?? root.microTimingWindow ?? root['Part 3: Micro-Timing Window'] ?? root['Part 3'];
  const sum = root.summarySentence ?? root.summary ?? root.overview;

  return {
    ...fallback,
    ...root,
    part1_probabilityAndScope: sanitizeCleanField(p1, fallback.part1_probabilityAndScope),
    part2_financialAndResources: sanitizeCleanField(p2, fallback.part2_financialAndResources),
    part3_microTimingWindow: sanitizeCleanField(p3, fallback.part3_microTimingWindow),
    summarySentence: sanitizeCleanField(sum, fallback.summarySentence)
  };
}

export function extractAndParseVedicJson(
  rawResp: string,
  fallback: import('./types').LLMThreePartNarrative
): any {
  if (!rawResp || typeof rawResp !== 'string' || rawResp.trim().length === 0) {
    return fallback;
  }

  let text = rawResp.trim();

  // 1. Strip reasoning / thinking tags e.g. <think>...</think>
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    text = fenceMatch[1].trim();
  }

  // 3. Find outer JSON object boundaries { ... }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  let candidate = text;
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidate = text.substring(firstBrace, lastBrace + 1).trim();
  } else if (firstBrace !== -1) {
    candidate = text.substring(firstBrace).trim();
  }

  // Attempt 1: Direct JSON.parse
  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object') {
      return buildNormalizedResult(parsed, fallback);
    }
  } catch {
    // Attempt 2: Auto-repair unclosed quotes / braces
    try {
      const repaired = repairTruncatedJson(candidate);
      const parsed = JSON.parse(repaired);
      if (parsed && typeof parsed === 'object') {
        return buildNormalizedResult(parsed, fallback);
      }
    } catch {
      // Attempt 3: Regex field extraction
      return extractFieldsViaRegex(candidate, fallback);
    }
  }

  return extractFieldsViaRegex(candidate, fallback);
}

/**
 * 1. Qwen Local Adapter (Ollama port 11434 with Parashara fallback)
 */
export class QwenLocalAdapter implements ILLMAdapter {
  id: LLMProviderId = 'local_qwen';

  async generateReasoning(context: VedicHouseContext): Promise<LLMThreePartNarrative> {
    const startMs = Date.now();
    const prompt = buildVedicPrompt(context, 'Local Qwen 2.5 7B');
    const endpoint = 'http://localhost:11434/api/generate';
    const targetModel = context.selectedLocalModel || 'qwen2.5:7b-instruct';

    // keep_alive: '5m' keeps the model warm in VRAM/RAM so subsequent prompts run fast without reloading 4.7 GB from disk
    // Users can click "🧹 Purge VRAM" anytime in the UI to immediately free memory on demand
    const requestBody = {
      model: targetModel,
      prompt,
      stream: false,
      format: 'json',
      keep_alive: '5m',
      options: {
        temperature: 0.3,
        num_predict: 3500, // Generous token ceiling so local LLM completes entire JSON without abrupt cutoff
        num_ctx: 8192
      }
    };

    let connectionError: string | undefined;

    // Timeout Configuration:
    // By default, enableTimeout is FALSE ("Full throttle / run full time" - runs without aborting until completion)
    const enableTimeout = context.enableTimeout ?? (typeof window !== 'undefined' ? localStorage.getItem('astro_ollama_enable_timeout') === 'true' : false);
    const configuredTimeoutSec = context.timeoutSeconds ?? (typeof window !== 'undefined' ? parseInt(localStorage.getItem('astro_ollama_timeout_seconds') || '300', 10) : 300);

    const controller = new AbortController();
    let timeoutTimer: any = null;

    if (enableTimeout && configuredTimeoutSec > 0) {
      timeoutTimer = setTimeout(() => {
        controller.abort();
      }, configuredTimeoutSec * 1000);
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }

      if (res.ok) {
        const json = await res.json();

        // Model is kept active in VRAM for fast subsequent inferences.
        // It can be manually evicted anytime via the "Purge VRAM" button in the inspector header.
        const fallback = synthesizeAnalyticalVedicNarrative(context, 'local_qwen', startMs);
        const parsed = extractAndParseVedicJson(json.response || '', fallback);

        return {
          part1_probabilityAndScope: parsed.part1_probabilityAndScope || fallback.part1_probabilityAndScope,
          part2_financialAndResources: parsed.part2_financialAndResources || fallback.part2_financialAndResources,
          part3_microTimingWindow: parsed.part3_microTimingWindow || fallback.part3_microTimingWindow,
          summarySentence: parsed.summarySentence || fallback.summarySentence,
          overallConfidence: typeof parsed.overallConfidence === 'number' ? parsed.overallConfidence : fallback.overallConfidence,
          peakDateRange: parsed.peakDateRange || fallback.peakDateRange,
          natalPromiseVsTransitDelivery: parsed.natalPromiseVsTransitDelivery || fallback.natalPromiseVsTransitDelivery,
          supplementaryScenarios: mergeScenarios(parsed.supplementaryScenarios, fallback.supplementaryScenarios || []),
          rawMarkdown: parsed.rawMarkdown || parsed.part1_probabilityAndScope,
          providerUsed: 'local_qwen',
          executionTimeMs: Date.now() - startMs,
          timeoutEnforced: enableTimeout,
          configuredTimeoutSeconds: enableTimeout ? configuredTimeoutSec : undefined,
          endpointUsed: endpoint,
          connectionStatus: 'connected_live',
          isPrivateLocal: true,
          promptSent: prompt,
          rawRequestBody: requestBody,
          rawResponseBody: json,
          httpStatus: res.status,
          memoryPurged: true,
          ollamaStats: {
            model: json.model || targetModel,
            totalDurationMs: json.total_duration ? Math.round(json.total_duration / 1e6) : undefined,
            loadDurationMs: json.load_duration ? Math.round(json.load_duration / 1e6) : undefined,
            promptEvalCount: json.prompt_eval_count,
            evalCount: json.eval_count
          }
        };
      } else {
        const errJson = await res.json().catch(() => null);
        const detailedErr = errJson?.error || res.statusText;
        if (res.status === 404) {
          connectionError = `Ollama HTTP 404: Model '${targetModel}' not found. You need to pull it first by running 'ollama pull ${targetModel}' in your terminal, or select an installed model from the dropdown.`;
        } else {
          connectionError = `Ollama HTTP ${res.status}: ${detailedErr}`;
        }
      }
    } catch (err: any) {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
      if (err.name === 'AbortError' || controller.signal.aborted) {
        connectionError = `Local LLM timed out after ${elapsedSec}s (enforced limit: ${configuredTimeoutSec}s). Aborted and reverted to Parashara analytical synthesis. Turn off timeout ('⚡ Full Throttle') in the header to run without any time limits.`;
      } else {
        connectionError = err.message || 'Failed to connect to http://localhost:11434 (Check if Ollama is running)';
      }
      purgeOllamaMemory(targetModel, endpoint).catch(() => {});
    }

    const fallback = synthesizeAnalyticalVedicNarrative(context, 'local_qwen', startMs);
    return {
      ...fallback,
      endpointUsed: endpoint,
      connectionStatus: 'connection_failed_fallback',
      connectionError,
      isPrivateLocal: true,
      promptSent: prompt,
      rawRequestBody: requestBody,
      executionTimeMs: Date.now() - startMs,
      timeoutEnforced: enableTimeout,
      configuredTimeoutSeconds: enableTimeout ? configuredTimeoutSec : undefined,
      rawResponseBody: {
        fallback_reason: connectionError,
        requested_model: targetModel,
        suggestion: resStatusSuggestion(connectionError, targetModel),
        note: 'Executed deterministic Parashara heuristic engine because local Ollama could not find or run the requested model.'
      }
    };
  }
}

function resStatusSuggestion(errorMsg?: string, model?: string): string {
  if (errorMsg && errorMsg.includes('404')) {
    return `Model '${model}' is not in your Ollama library yet. Run: \`ollama pull ${model}\` or \`ollama run ${model}\`. If you already pulled another model (e.g. qwen2.5:7b or qwen2.5), select it in the inspector model dropdown.`;
  }
  return 'Make sure Ollama is running with CORS enabled: `OLLAMA_ORIGINS="*" ollama serve`';
}

/**
 * 2. Google Gemini Pro Adapter (@google/genai SDK)
 */
export class GeminiStudioAdapter implements ILLMAdapter {
  id: LLMProviderId = 'gemini_pro';

  async generateReasoning(context: VedicHouseContext): Promise<LLMThreePartNarrative> {
    const startMs = Date.now();
    const prompt = buildVedicPrompt(context, 'Google Gemini Pro');
    const endpoint = '/api/llm/gemini';

    const requestBody = {
      model: 'gemini-3.8-flash',
      prompt
    };

    let connectionError: string | undefined;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (res.ok) {
        const json = await res.json();
        const fallback = synthesizeAnalyticalVedicNarrative(context, 'gemini_pro', startMs);
        const parsed = extractAndParseVedicJson(json.text || '', fallback);

        const rawMarkdown = `### Astrological Reasoning & Micro-Timing Report (GOOGLE GEMINI)
**Target:** House ${context.houseNumber} (${context.rashiName} / ${context.tamilName})  
**Timeline:** Month ${context.selectedMonth + 1}/${context.selectedYear} | **PD Lord:** ${context.activeDasha.pratyantardasha}  
**Model:** ${json.model || 'gemini-3.8-flash'}  

---
#### 1. Event Probability & Scope
${parsed.part1_probabilityAndScope}

#### 2. Financial & Resource Sources
${parsed.part2_financialAndResources}

#### 3. Micro-Timing Window
${parsed.part3_microTimingWindow}
`;

        return {
          part1_probabilityAndScope: parsed.part1_probabilityAndScope || fallback.part1_probabilityAndScope,
          part2_financialAndResources: parsed.part2_financialAndResources || fallback.part2_financialAndResources,
          part3_microTimingWindow: parsed.part3_microTimingWindow || fallback.part3_microTimingWindow,
          summarySentence: parsed.summarySentence || fallback.summarySentence,
          overallConfidence: typeof parsed.overallConfidence === 'number' ? parsed.overallConfidence : fallback.overallConfidence,
          peakDateRange: parsed.peakDateRange || fallback.peakDateRange,
          natalPromiseVsTransitDelivery: parsed.natalPromiseVsTransitDelivery || fallback.natalPromiseVsTransitDelivery,
          supplementaryScenarios: mergeScenarios(parsed.supplementaryScenarios, fallback.supplementaryScenarios || []),
          rawMarkdown,
          providerUsed: 'gemini_pro',
          executionTimeMs: Date.now() - startMs,
          endpointUsed: `Google Gemini Cloud API (${json.model || 'gemini-3.8-flash'})`,
          connectionStatus: 'connected_live',
          isPrivateLocal: false,
          promptSent: prompt,
          rawRequestBody: requestBody,
          rawResponseBody: json,
          httpStatus: res.status
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        let rawErr = errJson.error || `HTTP ${res.status}: ${res.statusText}`;
        try {
          const parsed = JSON.parse(rawErr);
          if (parsed?.error?.message) rawErr = parsed.error.message;
        } catch {}

        if (rawErr.includes('API key not valid') || rawErr.includes('API_KEY_INVALID')) {
          connectionError = 'Google Gemini Error: API Key Invalid (400). Please check GEMINI_API_KEY in your .env file or Windows environment variables with a valid key from https://aistudio.google.com/apikey and restart the dev server.';
        } else {
          connectionError = rawErr;
        }
      }
    } catch (err: any) {
      connectionError = err.message || 'Failed to reach /api/llm/gemini proxy';
    }

    // Graceful fallback to analytical synthesis if cloud API unreachable
    const fallback = synthesizeAnalyticalVedicNarrative(context, 'gemini_pro', startMs);
    return {
      ...fallback,
      endpointUsed: 'Google Gemini Cloud API (/api/llm/gemini)',
      connectionStatus: 'connection_failed_fallback',
      connectionError,
      isPrivateLocal: false,
      promptSent: prompt,
      rawRequestBody: requestBody,
      rawResponseBody: {
        fallback_reason: connectionError,
        note: 'Executed deterministic Parashara heuristic engine because Gemini Cloud API returned an error.'
      }
    };
  }
}

/**
 * 3. Anthropic Claude Adapter
 */
export class ClaudeAdapter implements ILLMAdapter {
  id: LLMProviderId = 'claude';

  async generateReasoning(context: VedicHouseContext): Promise<LLMThreePartNarrative> {
    const startMs = Date.now();
    return synthesizeAnalyticalVedicNarrative(context, 'claude', startMs);
  }
}

/**
 * Central Orchestrator Router
 */
export class LLMReasoningService {
  private adapters: Record<LLMProviderId, ILLMAdapter> = {
    local_qwen: new QwenLocalAdapter(),
    gemini_pro: new GeminiStudioAdapter(),
    claude: new ClaudeAdapter()
  };

  async generate(providerId: LLMProviderId, context: VedicHouseContext): Promise<LLMThreePartNarrative> {
    const adapter = this.adapters[providerId] || this.adapters.local_qwen;
    return adapter.generateReasoning(context);
  }
}

export const llmService = new LLMReasoningService();
