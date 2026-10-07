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

// Classical House (Bhava) Significations Matrix
const BHAVA_NAMES: Record<number, { title: string; karakas: string; financialRole: string }> = {
  1: { title: 'Tanu Bhava (1st - Self, Vitality & Identity)', karakas: 'Sun, Mars', financialRole: 'Personal direct efforts & self-made income' },
  2: { title: 'Dhana Bhava (2nd - Accumulated Wealth, Liquid Savings & Family)', karakas: 'Jupiter, Mercury', financialRole: 'Accumulated liquid cash, savings deposits & family wealth' },
  3: { title: 'Sahaja Bhava (3rd - Enterprise, Valor & Contracts)', karakas: 'Mars, Saturn', financialRole: 'Commission, short contracts, media, trade & entrepreneurial grit' },
  4: { title: 'Sukha Bhava (4th - Real Estate, Vehicles & Fixed Assets)', karakas: 'Moon, Venus, Mars', financialRole: 'Collateral loans, mortgage financing, property equity & fixed capital' },
  5: { title: 'Putra Bhava (5th - Intellect, Speculation & Creativity)', karakas: 'Jupiter', financialRole: 'Speculative investments, stock equity, bonuses & creative ventures' },
  6: { title: 'Ari / Rina Bhava (6th - Debt, Banking Loans & Litigation)', karakas: 'Mars, Saturn', financialRole: 'Bank borrowings, credit lines, debt restructuring & servicing' },
  7: { title: 'Yuvati Bhava (7th - Partnerships, Legal Contracts & Public Standing)', karakas: 'Venus', financialRole: 'Joint venture equity, business partnership capital & customer contracts' },
  8: { title: 'Randhra Bhava (8th - Sudden Windfalls, Insurance & Inheritance)', karakas: 'Saturn', financialRole: 'Insurance claims, inheritance, joint spousal funds & unearned windfalls' },
  9: { title: 'Bhagya Bhava (9th - Fortune, Divine Grace & Long Journeys)', karakas: 'Jupiter, Sun', financialRole: 'Ancestral capital, divine fortune, venture patronage & high-ticket investments' },
  10: { title: 'Karma Bhava (10th - Career Elevation, Status & Authority)', karakas: 'Sun, Mercury, Saturn', financialRole: 'Corporate salary, executive remuneration, professional turnover' },
  11: { title: 'Labha Bhava (11th - Maximum Gains, Profits & Large Networks)', karakas: 'Jupiter', financialRole: 'Residual income, milestone profits, venture syndicates & large scale inflows' },
  12: { title: 'Vyaya Bhava (12th - Capital Outflows, Foreign Investments & Exit)', karakas: 'Saturn, Ketu', financialRole: 'Institutional foreign capital, high-ticket expenses & investment deployments' }
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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

  // 1. Flattened Natal D1 Placements table
  const natalD1Table = (context.flattenedNatalD1 && context.flattenedNatalD1.length > 0)
    ? context.flattenedNatalD1.map(p => 
        `  • ${p.body_name.padEnd(9)}: ${p.rashi_name} (H${p.house_number || '?'}) | Sputa: ${p.degree_sputa || 'N/A'} | Nakshatra: ${p.nakshatra_name || 'N/A'} (Pada ${p.pada || '?'}) ${p.is_retrograde ? '[R]' : ''}`
      ).join('\n')
    : (context.natalOccupants.length > 0
        ? context.natalOccupants.map(o => `  • ${o.body_name} (Sputa: ${o.degree_sputa || 'N/A'}, Nakshatra: ${o.nakshatra_name || 'N/A'})`).join('\n')
        : '  • None (Empty Bhava)');

  // 2. Flattened Natal D9 Navamsha table
  const natalD9Table = (context.flattenedNatalD9 && context.flattenedNatalD9.length > 0)
    ? context.flattenedNatalD9.map(p => `  • ${p.body_name.padEnd(9)}: ${p.rashi_name} | Sputa: ${p.degree_sputa || 'N/A'}`).join('\n')
    : '  • Standard D9 placements align with natal varga grid';

  // 3. Gochara Transits in target sign (including user drag-and-drop overrides)
  const transitTable = context.transitOccupants.length > 0
    ? context.transitOccupants.map(t => 
        `  • ${t.graha_key}${t.is_custom ? ' [USER DRAG-AND-DROP ADJUSTED OVERRIDE]' : ''} ${t.is_retrograde ? '[R]' : ''} (Sputa: ${t.degree_sputa || 'N/A'}, Nakshatra: ${t.nakshatra_name || 'N/A'})`
      ).join('\n')
    : '  • No Direct Transit Ingress in this sign';

  // 4. Moon (Chandra) 2.25-day Sign Progression Timeline
  const moonSpansTable = (context.monthlyMoonSpans && context.monthlyMoonSpans.length > 0)
    ? context.monthlyMoonSpans.map(m => 
        `  • ${m.label} ${m.houseNumber === context.houseNumber ? '===> [DIRECT TRANSIT OVER TARGET HOUSE] <===' : [1, 4, 5, 7, 9, 10, 11].includes(m.houseNumber) ? '[Kendra/Trikona Angle]' : ''}`
      ).join('\n')
    : '  • Moon completes one 360-degree zodiacal circuit through 12 signs (~2.25 days per sign)';

  // 5. Fast Graha Ingress Events
  const ingressTable = (context.monthlyIngressEvents && context.monthlyIngressEvents.length > 0)
    ? context.monthlyIngressEvents.map(e => `  • ${e}`).join('\n')
    : '  • Major slow Grahas maintain sign stability; fast Grahas transition per ephemeris.';

  // 6. Dasha Triad Delivery Report (Rule 5)
  const dashaDelivery = context.dashaDeliveryReport
    ? `Dasha Triad Delivery Index: ${(context.dashaDeliveryReport.overallIndex * 100).toFixed(0)}% (${context.dashaDeliveryReport.status})
  - MD Lord (${context.activeDasha.mahadasha}): ${context.dashaDeliveryReport.mdDignity} [Score: ${context.dashaDeliveryReport.mdScore.toFixed(2)}]
  - AD Lord (${context.activeDasha.antardasha}): ${context.dashaDeliveryReport.adDignity} [Score: ${context.dashaDeliveryReport.adScore.toFixed(2)}]
  - PD Lord (${context.activeDasha.pratyantardasha}): ${context.dashaDeliveryReport.pdDignity} [Score: ${context.dashaDeliveryReport.pdScore.toFixed(2)}]`
    : `Active Vimshottari Hierarchy: MD: ${context.activeDasha.mahadasha} > AD: ${context.activeDasha.antardasha} > PD: ${context.activeDasha.pratyantardasha}`;

  // 7. Matched Rules
  const rulesStr = context.matchedRules.length > 0
    ? context.matchedRules.map(r => `• ${r.ruleName} (Weight: ${r.weight}): ${r.reason}`).join('\n')
    : '• Baseline house evaluation';

  return `You are an elite Vedic Astrologer & Data Reasoning Engine synthesizing monthly transit activations under classical Parashara and Jaimini principles.

======================================================================
1. TARGET BHAVA & TEMPORAL HORIZON
======================================================================
- Targeted House: House ${context.houseNumber} (${bhavaInfo.title})
- Rashi Sign: ${context.rashiName} (${context.tamilName}) ${context.isLagna ? '[Lagna Sign / 1st House]' : ''}
- Evaluation Month: ${monthName} ${context.selectedYear}
- Code Rule Engine Activation Score: ${context.activationScore.toFixed(2)} / 1.00 (${context.isEventActive ? 'CRITICAL EVENT EMITTING (Threshold >= 0.55 crossed)' : 'Standard Preparatory / Baseline'})
- Matched Classical Rules:
${rulesStr}

======================================================================
2. COMPLETE FLATTENED NATAL DATASET (D1 & D9 PLACEMENTS)
======================================================================
NATAL D1 (RASI KUNDALI):
${natalD1Table}

NATAL D9 (NAVAMSHA KUNDALI):
${natalD9Table}

======================================================================
3. GOCHARA (TRANSIT) DATASET FOR TARGET SIGN (INCL. USER OVERRIDES)
======================================================================
${transitTable}

======================================================================
4. CHANDRA (MOON) 2.25-DAY SIGN PROGRESSION ACROSS ${monthName.toUpperCase()} ${context.selectedYear}
(Chandra is the psychological catalyst and real-time trigger for event fruition)
======================================================================
${moonSpansTable}

======================================================================
5. PLANETARY INGRESS EVENTS IN ${monthName.toUpperCase()} ${context.selectedYear}
======================================================================
${ingressTable}

======================================================================
6. VIMSHOTTARI DASHA HIERARCHY & DELIVERY CAPACITY (RULE 5)
======================================================================
${dashaDelivery}
Active PD Window: ${context.activeDasha.startDate} to ${context.activeDasha.endDate}

======================================================================
7. USER SPECIFIC INQUIRY
======================================================================
"${context.userQuery || `Provide a definitive astrological evaluation for House ${context.houseNumber} in ${monthName} ${context.selectedYear}`}"

======================================================================
8. TASK & FORMATTING INSTRUCTIONS
======================================================================
Synthesize a rigorous, grounded Vedic Narrative with both a Primary Synthesis and 5 Cross-Domain Supplementary Scenarios.

${context.language === 'ta' ? `CRITICAL LANGUAGE REQUIREMENT - TAMIL (தமிழ்):
You MUST formulate all narrative descriptions, astrological reasoning, verdicts, and practical guidance in authentic, formal Tamil (தமிழ்).
Use classical Vedic astrological terminology in Tamil:
- லக்னம், தன ஸ்தானம் (2), சுக ஸ்தானம் (4), பூர்வ புண்ணியம் (5), கர்ம ஸ்தானம் (10), லாப ஸ்தானம் (11).
- தசா புத்தி அந்தர பலன்கள், கோச்சார கிரக அமைப்புகள், குரு/சனி பார்வை, சுப கிரக சேர்க்கை.
Keep the JSON keys strictly in English as shown below, but ensure ALL string values (summarySentence, verdicts, parts 1-3, astrologicalReasoning, practicalGuidance) are written in natural, fluent Tamil (தமிழ்).
` : ''}
CRITICAL IN-DEPTH REASONING & STRUCTURE REQUIREMENTS (NO ONE-LINERS OR BRIEF SUMMARIES):
You MUST provide thorough, detailed, multi-paragraph astrological analysis for every aspect.
Do NOT output generic one-line or two-line summaries. Deliver deep, nuanced insights.

Specific required breakdowns:
1. CAREER & JOB ('career_job'):
   a) TEST TRIGGER - NATIVE EMPLOYMENT STATUS INFERENCE:
      Infer whether the native is currently actively serving in a job (employed), actively seeking / in transition, or on sabbatical / unemployed.
      Base this inference strictly on the 10th house (Karma Bhava status, dispositor dignity), 6th house (daily service/employment), 1st house (vitality), active Dasha Triad lord, and current Gochara transits.
      Provide 'employmentStatusInference': {
        'status': 'currently_serving' | 'actively_seeking' | 'sabbatical_unemployed',
        'label': 'Currently Serving in a Job (Employed)' | 'In Transition / Actively Seeking Job' | 'Sabbatical / Unemployed Phase',
        'indicatorColor': 'green' | 'yellow' | 'amber',
        'confidence': 0.85,
        'inferenceReasoning': 'Explicit astrological reasoning explaining how the engine deduced this state...'
      }
   b) JOB SEARCH & TIMING AUSPICIOUSNESS:
      Analyze past job search momentum vs current timing: How much has past delay or struggle factored in, and is this month the correct, auspicious period to land an offer or achieve breakthrough?
   c) NEW JOB ACQUISITION & MOOD:
      What kind and mood of job will the native get at this point in time (corporate leadership, tech architecture, client consulting, remote autonomy, or service)? Will this new prospective job be significantly better in compensation, respect, and growth than what they are currently serving (if employed)? If not currently serving, will it provide solid landing?
   d) EXISTING JOB PHASE:
      If currently serving, what is the exact workplace climate (management dynamics, promotions, friction, burnout vs recognition)?
   e) Provide 'detailedParagraphs' with 2-3 substantive, rich paragraphs of career analysis.

2. LOVE, CRUSH & ROMANCE ('love_romance'):
   a) EXISTING CRUSH OUTLOOK:
      How will any existing crush or romantic affection evolve this month? Will it find reciprocation, hit emotional friction, or face reality checks?
   b) NEW CRUSH POSSIBILITY:
      Is there a distinct astrological trigger for a new crush or romantic interest forming under current 5th/7th/Venus/Moon transits? Provide probability ('High' | 'Moderate' | 'Low') and context.
   c) ROMANCE CHEMISTRY & FLUTTERING ATMOSPHERE:
      Describe the psychological and romantic weather: emotional chemistry, passion vs hesitation, romantic excitement.
   d) REAL LOVE MANIFESTATION OUTCOME:
      Will real love manifestation work out? What form will it take:
      'outcomeType': 'classical_traditional_marriage' (sacred lifelong commitment) | 'living_together_modern' (co-habitation / modern partnership) | 'exploratory_flutter' (passing sweet attraction) | 'platonic_delayed'
      Explain the astrological causal mechanism (5th house Purva Punya, 7th house Kalatra, Venus dignity, D9 Navamsha).
   e) Provide 'detailedParagraphs' with 2-3 substantive, rich paragraphs of romantic analysis.

3. FINANCE & WEALTH ('finance_wealth'):
   Liquid cashflow (2nd house) vs long-term property/asset loans (4th house), speculative stock/crypto windfalls (5th/8th), and 11th house residual profit timing. Provide 'detailedParagraphs' with rich paragraphs.

4. HEALTH & VITALITY ('health_vitality'):
   Physical stamina, Sukha (inner emotional serenity), thoracic/cardiac/digestive vulnerability zones based on 6th/8th houses and Saturn/Mars aspects, and preventive Ayurvedic/lifestyle pacing. Provide 'detailedParagraphs'.

5. FAMILY & HOME ('family_home'):
   Domestic sanctuary, residence relocation or interior renovations, maternal health, ancestral roots, and family harmony. Provide 'detailedParagraphs'.

Return ONLY a valid, raw JSON object matching this schema (do NOT include markdown code blocks or surrounding commentary):
{
  "summarySentence": "Crisp one-sentence bottom-line synthesis of the event activation.",
  "natalPromiseVsTransitDelivery": {
    "natalPromiseScore": 0.88,
    "natalPromiseVerdict": "Strong natal sanction with dignified karakas in birth chart.",
    "transitDeliveryScore": 0.78,
    "transitDeliveryVerdict": "Gochara transits and Rule 5 Dasha Triad permit manifestation with minor friction.",
    "synthesisVerdict": "High fruition with tangible real-world outcomes before month end."
  },
  "part1_probabilityAndScope": "Detailed breakdown of Event Probability & Scope based on House ${context.houseNumber} significations and the active PD Lord (${context.activeDasha.pratyantardasha}) authority. State clearly whether the event will manifest and why.",
  "part2_financialAndResources": "Detailed analysis of Financial & Resource Sources. Map the exact origin of capital (e.g. 2nd house liquid savings, 4th house property loans, 9th house fortune/inheritance, 11th house profits/gains) required for or generated by this event.",
  "part3_microTimingWindow": "Exact 3 to 7 day peak activation window within ${monthName} ${context.selectedYear}. Name the exact calendar days when transiting Moon or fast planets trigger this Bhava.",
  "peakDateRange": "${monthName} DD – DD, ${context.selectedYear} (Derived strictly from Moon or ingress schedule)",
  "overallConfidence": 0.85,
  "supplementaryScenarios": [
    {
      "id": "career_job",
      "title": "Career & Professional Elevation",
      "verdict": "Favorable Expansion",
      "confidenceScore": 0.85,
      "timingWindow": "${monthName} DD – DD, ${context.selectedYear}",
      "astrologicalReasoning": "Detailed astrological synthesis connecting 10th house Karma, 6th house service, and active Dasha...",
      "practicalGuidance": "Actionable strategic workplace guidance...",
      "employmentStatusInference": {
        "status": "currently_serving",
        "label": "Currently Serving in a Job (Employed)",
        "indicatorColor": "green",
        "confidence": 0.86,
        "inferenceReasoning": "10th lord and 6th lord form a fortified Artha trikona with active Dasha governance..."
      },
      "jobSearchAnalysis": {
        "momentum": "Favorable acceleration after past stagnation",
        "pastStruggleVsCurrentPhase": "Prior periods carried delays due to Saturnian aspect, but current transits unlock recruitment channels.",
        "timingAuspiciousness": "High-probability window for interview conversions and offer letters."
      },
      "newJobAcquisition": {
        "jobTypeAndMood": "High-responsibility leadership or analytical role in structured enterprise.",
        "workplaceAtmosphere": "High-growth culture with cross-functional autonomy.",
        "comparisonWithCurrentRole": "Significantly better in package and growth scope compared to current tenure."
      },
      "existingJobPhase": {
        "currentPhaseNature": "High workload and organizational reorganization; management testing stamina.",
        "retentionVsExitAdvice": "Maintain diplomacy and leverage incoming offers for retention bargaining."
      },
      "detailedParagraphs": [
        "Paragraph 1 covering employment landscape and natal promise...",
        "Paragraph 2 covering job search dynamics and timing...",
        "Paragraph 3 covering comparative evaluation and strategic next steps..."
      ]
    },
    {
      "id": "love_romance",
      "title": "Love, Crush & Romance",
      "verdict": "Moderate Progress",
      "confidenceScore": 0.78,
      "timingWindow": "${monthName} DD – DD, ${context.selectedYear}",
      "astrologicalReasoning": "Venus transit aspecting 5th house stimulates romantic affections...",
      "practicalGuidance": "Communicate heartfelt intentions with emotional honesty...",
      "crushStatusInference": {
        "existingCrushTrajectory": "Clarification of mutual feelings; conversations deepen if reciprocal.",
        "newCrushProbability": "High",
        "newCrushDetails": "Transit trigger in 5th house indicates unexpected romantic interest sparking in intellectual/social circles."
      },
      "romanceAtmosphere": {
        "emotionalWeather": "Sweet emotional fluttering with anticipation and curiosity.",
        "chemistryRating": 82
      },
      "manifestationPath": {
        "outcomeType": "classical_traditional_marriage",
        "outcomeLabel": "Classical Sacred Union & Long-Term Commitment",
        "manifestationLikelihood": "High karmic viability to mature into enduring marital union.",
        "astrologicalPathReasoning": "Jupiter rays on 7th Kalatra Bhava and fortified 5th lord in Navamsha D9."
      },
      "detailedParagraphs": [
        "Paragraph 1 covering emotional weather and romantic openness...",
        "Paragraph 2 covering crush developments and mutual chemistry...",
        "Paragraph 3 covering love manifestation path and long-term marriage viability..."
      ]
    },
    {
      "id": "health_vitality",
      "title": "Health & Mental Tranquility (Sukha)",
      "verdict": "Caution Required",
      "confidenceScore": 0.76,
      "timingWindow": "${monthName} DD – DD, ${context.selectedYear}",
      "astrologicalReasoning": "Saturn presence in 4th chest/cardiac zone urges pacing of physical exertion...",
      "practicalGuidance": "Maintain consistent sleep and cardiovascular care; avoid overthinking.",
      "healthDetails": {
        "vulnerableZones": ["Thoracic / cardiac zone", "Nervous fatigue", "Sleep cycles"],
        "mentalTranquilityAndStress": "Mental peace fluctuates under work stress; needs conscious decompression.",
        "holisticRemedies": "Pranayama, hydration, and restorative sleep discipline."
      },
      "detailedParagraphs": [
        "Paragraph 1 covering physical stamina and organ systems...",
        "Paragraph 2 covering mental serenity and practical preventive remedies..."
      ]
    },
    {
      "id": "finance_wealth",
      "title": "Wealth, Cashflow & Assets",
      "verdict": "Favorable Expansion",
      "confidenceScore": 0.84,
      "timingWindow": "${monthName} DD – DD, ${context.selectedYear}",
      "astrologicalReasoning": "Venus in 11th Labha supports asset acquisition and equity appreciation...",
      "practicalGuidance": "Review loan terms carefully; long-term compounding is solid.",
      "financeDetails": {
        "liquidityVsOutflow": "Liquid savings in 2nd house remain stable; capital deployed toward fixed assets.",
        "windfallAndSpeculation": "Moderate speculative upside; avoid high-leverage gambles.",
        "debtAndAssetFinancing": "Institutional loans or asset financing approved with favorable terms."
      },
      "detailedParagraphs": [
        "Paragraph 1 covering cashflow liquidity and milestone inflows...",
        "Paragraph 2 covering capital assets, investments, and debt leverage..."
      ]
    },
    {
      "id": "family_home",
      "title": "Domestic Peace & Family",
      "verdict": "Favorable Expansion",
      "confidenceScore": 0.88,
      "timingWindow": "${monthName} DD – DD, ${context.selectedYear}",
      "astrologicalReasoning": "Primary House 4 domain activates home improvement and maternal harmony...",
      "practicalGuidance": "Upgrade household living spaces and spend quality time supporting family elders.",
      "familyDetails": {
        "domesticAmbiance": "Peaceful domestic atmosphere with interior upgrades.",
        "maternalWellbeing": "Mother's health and emotional blessings are fortified.",
        "propertyAndRelocation": "Excellent timing for home acquisition, renovation, or relocation."
      },
      "detailedParagraphs": [
        "Paragraph 1 covering domestic living sanctuary...",
        "Paragraph 2 covering maternal wellbeing and familial alignment..."
      ]
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
        model: model || 'qwen2.5:14b-instruct',
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
 * 1. Qwen Local Adapter (Ollama port 11434 with Parashara fallback)
 */
export class QwenLocalAdapter implements ILLMAdapter {
  id: LLMProviderId = 'local_qwen';

  async generateReasoning(context: VedicHouseContext): Promise<LLMThreePartNarrative> {
    const startMs = Date.now();
    const prompt = buildVedicPrompt(context, 'Local Qwen 2.5 14B');
    const endpoint = 'http://localhost:11434/api/generate';
    const targetModel = context.selectedLocalModel || 'qwen2.5:14b-instruct';

    // keep_alive: 0 ensures Ollama unloads the model from VRAM/RAM immediately upon finishing
    const requestBody = {
      model: targetModel,
      prompt,
      stream: false,
      format: 'json',
      keep_alive: 0,
      options: {
        temperature: 0.3,
        num_predict: 2048,
        num_ctx: 8192,
        num_keep: 0
      }
    };

    let connectionError: string | undefined;
    const LOCAL_TIMEOUT_MS = 180000; // Strict 180 seconds upper ceiling
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, LOCAL_TIMEOUT_MS);

    try {
      // 180-second hard timeout: if hardware is struggling, safely abort and purge VRAM
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutTimer);

      if (res.ok) {
        const json = await res.json();

        // Immediately trigger an explicit memory purge to release all VRAM/RAM for subsequent queries
        purgeOllamaMemory(targetModel, endpoint).catch(() => {});

        let parsed: any = {};
        try {
          let rawResp = (json.response || '').trim();
          if (rawResp.startsWith('```json')) rawResp = rawResp.substring(7);
          if (rawResp.startsWith('```')) rawResp = rawResp.substring(3);
          if (rawResp.endsWith('```')) rawResp = rawResp.substring(0, rawResp.length - 3);
          parsed = JSON.parse(rawResp.trim());
        } catch {
          parsed = {
            part1_probabilityAndScope: json.response || 'Local Qwen synthesis generated.',
            part2_financialAndResources: 'Derived from chart significations.',
            part3_microTimingWindow: 'Active during the current Pratyantardasha window.'
          };
        }

        const fallback = synthesizeAnalyticalVedicNarrative(context, 'local_qwen', startMs);

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
      clearTimeout(timeoutTimer);
      if (err.name === 'AbortError' || controller.signal.aborted) {
        connectionError = 'Local LLM timed out (>180s): Struggling to interpret this complex multi-domain dataset on current hardware within 180 seconds. Aborted and reverted to Parashara analytical synthesis.';
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
    return `Model '${model}' is not in your Ollama library yet. Run: \`ollama pull ${model}\` or \`ollama run ${model}\`. If you already pulled another model (e.g. qwen2.5:14b or qwen2.5), select it in the inspector model dropdown.`;
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
        // Clean markdown backticks if Gemini wrapped the JSON in ```json ... ```
        let cleanText = (json.text || '').trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith('```')) {
          cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        cleanText = cleanText.trim();

        const parsed = JSON.parse(cleanText);

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

        const fallback = synthesizeAnalyticalVedicNarrative(context, 'gemini_pro', startMs);

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
