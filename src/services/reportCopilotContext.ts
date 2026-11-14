import {
  VedicHouseContext,
  LLMThreePartNarrative,
  LLM_PROVIDERS
} from './llm/types';

export interface DynamicQuestionCard {
  id: string;
  badge: string;
  category: 'career' | 'love' | 'finance' | 'health' | 'family' | 'event' | 'yoga';
  title: string;
  promptTemplate: string;
  reasoningTag: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function truncateText(text: string | undefined, maxLen: number): string {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 3)}...`;
}

/**
 * Generates dynamic, prediction-driven follow-up question cards tailored to the active
 * report's strongest supplementary scenarios, specific events, and Vedic special yogas.
 * Zero generic canned hints: every card cites the active prediction's verdict & timing window.
 */
export function buildDynamicQuestionCards(
  context: VedicHouseContext | null,
  narrative: LLMThreePartNarrative | null
): DynamicQuestionCard[] {
  if (!context && !narrative) return [];

  const cards: DynamicQuestionCard[] = [];
  const scenarios = narrative?.supplementaryScenarios || [];
  const events = narrative?.predictedSpecificEvents || [];
  const special = context?.vedicSpecialEvents;

  // Sort scenarios so highest-impact favorable OR frictional scenarios rise first
  const rankedScenarios = [...scenarios].sort((a, b) => {
    const scoreA = a.verdict.toLowerCase().includes('favorable') || a.verdict.toLowerCase().includes('frictional')
      ? a.confidenceScore + 12
      : a.confidenceScore;
    const scoreB = b.verdict.toLowerCase().includes('favorable') || b.verdict.toLowerCase().includes('frictional')
      ? b.confidenceScore + 12
      : b.confidenceScore;
    return scoreB - scoreA;
  });

  for (const sc of rankedScenarios) {
    if (sc.id === 'career_job') {
      const isFavorable = sc.verdict.toLowerCase().includes('favorable') || sc.confidenceScore >= 70;
      cards.push({
        id: `sc_${sc.id}`,
        category: 'career',
        badge: `Career • ${sc.verdict} (${sc.confidenceScore}%)`,
        title: isFavorable
          ? `Possibility of promotion or role jump (${sc.timingWindow})`
          : `Career timing: hold steady or push during ${sc.timingWindow}?`,
        promptTemplate: isFavorable
          ? `Based on the Career prediction (${sc.verdict}, ${sc.confidenceScore}% confidence, window: ${sc.timingWindow}), what is the real possibility of a promotion, salary hike, or better role switch in ${sc.timingWindow}? My current work context: `
          : `The Career section predicts ${sc.verdict} (${sc.confidenceScore}%, window: ${sc.timingWindow}). How should I navigate office dynamics or timing a job move around ${sc.timingWindow}? My situation: `,
        reasoningTag: truncateText(sc.astrologicalReasoning, 90)
      });
    } else if (sc.id === 'love_romance') {
      const outcomeHint = sc.manifestationPath?.outcomeLabel
        ? ` (${sc.manifestationPath.outcomeLabel})`
        : '';
      cards.push({
        id: `sc_${sc.id}`,
        category: 'love',
        badge: `Relationships • ${sc.verdict} (${sc.confidenceScore}%)`,
        title: `Can an unresolved bond or relationship clarify in ${sc.timingWindow}?`,
        promptTemplate: `Based on the Love & Relationship prediction (${sc.verdict}${outcomeHint}, ${sc.confidenceScore}%, window: ${sc.timingWindow}), I want to ask about a specific past relationship/person: [describe what happened in the past and current status]. Will things get cleared up or resolve in ${sc.timingWindow}?`,
        reasoningTag: truncateText(sc.crushStatusInference?.existingCrushTrajectory || sc.astrologicalReasoning, 90)
      });
    } else if (sc.id === 'finance_wealth') {
      cards.push({
        id: `sc_${sc.id}`,
        category: 'finance',
        badge: `Finance • ${sc.verdict} (${sc.confidenceScore}%)`,
        title: `Inflow vs outflow & major money call (${sc.timingWindow})`,
        promptTemplate: `Looking at the Finance prediction (${sc.verdict}, ${sc.confidenceScore}%, window: ${sc.timingWindow}), is this a safe window for an investment, loan, or payout? My specific financial question: `,
        reasoningTag: truncateText(sc.financeDetails?.liquidityVsOutflow || sc.astrologicalReasoning, 90)
      });
    } else if (sc.id === 'family_home' && (sc.confidenceScore >= 68 || sc.verdict.toLowerCase().includes('favorable') || sc.verdict.toLowerCase().includes('caution'))) {
      cards.push({
        id: `sc_${sc.id}`,
        category: 'family',
        badge: `Home & Family • ${sc.verdict} (${sc.confidenceScore}%)`,
        title: `Domestic stability, property, or relocation outlook (${sc.timingWindow})`,
        promptTemplate: `Based on the Family & Home prediction (${sc.verdict}, ${sc.confidenceScore}%, window: ${sc.timingWindow}), what does this indicate for my home/property/family question: `,
        reasoningTag: truncateText(sc.familyDetails?.propertyAndRelocation || sc.astrologicalReasoning, 90)
      });
    } else if (sc.id === 'health_vitality' && (sc.verdict.toLowerCase().includes('caution') || sc.verdict.toLowerCase().includes('delay') || sc.confidenceScore <= 68)) {
      cards.push({
        id: `sc_${sc.id}`,
        category: 'health',
        badge: `Health • ${sc.verdict} (${sc.confidenceScore}%)`,
        title: `Vitality watch & stress triggers around ${sc.timingWindow}`,
        promptTemplate: `The Health prediction notes ${sc.verdict} (${sc.confidenceScore}%) around ${sc.timingWindow}. What practical precautions apply if I am experiencing: `,
        reasoningTag: truncateText(sc.healthDetails?.mentalTranquilityAndStress || sc.astrologicalReasoning, 90)
      });
    }
  }

  // Add top specific event from predictedSpecificEvents
  if (events.length > 0) {
    const sortedEvents = [...events].sort((a, b) => (b.likelihoodScore || 0) - (a.likelihoodScore || 0));
    const topEvent = sortedEvents[0];
    cards.push({
      id: `evt_${topEvent.category}`,
      category: 'event',
      badge: `${topEvent.categoryLabel} • ${topEvent.likelihood}`,
      title: `${topEvent.eventTitle} (${topEvent.projectedWindow})`,
      promptTemplate: `Regarding the predicted event "${topEvent.eventTitle}" (${topEvent.likelihood}, window: ${topEvent.projectedWindow}), how strongly could this manifest in my actual case: `,
      reasoningTag: truncateText(topEvent.concreteImplication, 90)
    });
  }

  // Add special Vedic Yoga/Station card if active
  if (special) {
    if (special.parivartanaYogas.length > 0) {
      const p = special.parivartanaYogas[0];
      const range = `${p.startDate}..${p.endDate}`;
      const pairLabel = `${p.grahaA}-${p.grahaB} (${p.signAName} <-> ${p.signBName})`;
      cards.push({
        id: 'yoga_parivartana',
        category: 'yoga',
        badge: `Parivartana Exchange • ${range}`,
        title: `${pairLabel} (H${p.lagnaHouseA} <-> H${p.lagnaHouseB})`,
        promptTemplate: `Explain how the ${pairLabel} Parivartana (${p.bhavaExchangeSummary}, active ${range}) directly impacts my real-life question here: `,
        reasoningTag: truncateText(p.predictedEvents || p.lordshipSummary, 90)
      });
    } else if (special.sameSignStations.length > 0) {
      const s = special.sameSignStations[0];
      cards.push({
        id: 'yoga_station',
        category: 'yoga',
        badge: `${s.turnType} • ${s.stationDate}`,
        title: `${s.grahaKey} ${s.turnType} in ${s.signName}`,
        promptTemplate: `How does ${s.grahaKey} turning ${s.turnType} in ${s.signName} around ${s.stationDate} shift stalled or past matters for my question: `,
        reasoningTag: truncateText(s.eventImpact || s.summary, 90)
      });
    } else if (special.debilitationEvents.length > 0) {
      const d = special.debilitationEvents[0];
      const range = `${d.startDate}..${d.endDate}`;
      cards.push({
        id: 'yoga_neecha',
        category: 'yoga',
        badge: `${d.neechaBhangaStatus} • ${range}`,
        title: `${d.grahaKey} in ${d.signName}`,
        promptTemplate: `With ${d.grahaKey} in ${d.signName} (${range}, ${d.neechaBhangaStatus}), how does an initial setback turn around for my situation: `,
        reasoningTag: truncateText(d.predictedEvents || d.summary, 90)
      });
    }
  }

  // Dedupe & limit to 6 cards
  const seen = new Set<string>();
  return cards.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }).slice(0, 6);
}

/**
 * Extracts a token-efficient, comprehensive JSON/structured text pack from the cached report JSON,
 * original prompt, and question-matched transit windows so local Ollama models (Qwen 7B-17B)
 * have exact grounding without blowing 8K-16K context limits.
 */
export function buildCompactReportContextPack(
  context: VedicHouseContext | null,
  narrative: LLMThreePartNarrative | null,
  userQuestion: string,
  options?: {
    promptSent?: string;
    cacheTitle?: string;
    providerLabel?: string;
  }
): string {
  const qLower = userQuestion.toLowerCase();
  const lines: string[] = [];

  // 1. Report Header
  const monthName = context ? (MONTH_NAMES[context.selectedMonth] || `Month ${context.selectedMonth + 1}`) : '';
  const scopeLabel = context?.isMultiYearPrediction
    ? `Multi-Year Timeline (${context.timelineStartDate || ''} to ${context.timelineEndDate || ''})`
    : context?.isComprehensiveMonthly
    ? `Monthly Comprehensive Report (${monthName} ${context?.selectedYear || ''})`
    : context?.houseNumber
    ? `House ${context.houseNumber} (${context.rashiName || ''}) • ${monthName} ${context.selectedYear}`
    : (options?.cacheTitle || 'Vedic Prediction Synthesis Report');

  lines.push('=== 1. ACTIVE PREDICTION REPORT METADATA ===');
  lines.push(`Report: ${options?.cacheTitle || scopeLabel}`);
  lines.push(`Scope: ${scopeLabel}`);
  if (narrative) {
    lines.push(`Report Engine: ${options?.providerLabel || LLM_PROVIDERS[narrative.providerUsed]?.name || narrative.providerUsed}`);
    lines.push(`Peak Timing Window: ${narrative.peakDateRange || 'Not specified'} | Overall Confidence: ${narrative.overallConfidence ?? 'N/A'}%`);
  }

  // 2. Native Identity & Personal Backstory
  if (context) {
    lines.push('\n=== 2. NATIVE HOROSCOPE & LIVED REALITY ===');
    if (context.natalLagnaSignName || context.natalMoonSignName) {
      lines.push(`Natal Lagna: ${context.natalLagnaSignName || 'N/A'} | Natal Moon Rashi: ${context.natalMoonSignName || 'N/A'}`);
    }
    if (context.natalJanmaStar) {
      lines.push(`Janma Nakshatra: ${context.natalJanmaStar.nakshatra_name} Pada ${context.natalJanmaStar.pada} (${context.natalJanmaStar.rashi_name})`);
    }
    if (context.activeDasha) {
      lines.push(`Active Dasha Triad: MD ${context.activeDasha.mahadasha} -> AD ${context.activeDasha.antardasha} -> PD ${context.activeDasha.pratyantardasha} (${context.activeDasha.startDate} to ${context.activeDasha.endDate})`);
    }
    if (context.livedExperienceNarrative) {
      lines.push(`Lived Experience / Past Baseline: ${truncateText(context.livedExperienceNarrative, 600)}`);
    }
    if (context.currentEventsNarrative) {
      lines.push(`Current Ongoing Reality: ${truncateText(context.currentEventsNarrative, 600)}`);
    }
    if (context.flattenedNatalD1 && context.flattenedNatalD1.length > 0) {
      const d1Summary = context.flattenedNatalD1
        .map(p => `${p.body_name} in ${p.rashi_name}${p.house_number ? ` H${p.house_number}` : ''}${p.is_retrograde ? '(R)' : ''}`)
        .join('; ');
      lines.push(`Natal D1 Chart: ${d1Summary}`);
    }
    if (context.multiYearDashas && context.multiYearDashas.length > 0) {
      const dashaSlice = context.multiYearDashas
        .slice(0, 14)
        .map(d => `${d.startDate}..${d.endDate}: ${d.mahadasha}/${d.antardasha}/${d.pratyantardasha}`)
        .join(' | ');
      lines.push(`Timeline Dasha Windows: ${dashaSlice}`);
    }
  }

  // 3. Special Deterministic Vedic Events (Parivartana, Neecha Bhanga, Vakra<->Direct Stations)
  if (context?.vedicSpecialEvents) {
    const vse = context.vedicSpecialEvents;
    lines.push('\n=== 3. DETERMINISTIC SPECIAL VEDIC EVENTS (PARIVARTANA, NEECHA BHANGA, RETROGRADE STATIONS) ===');
    lines.push(`Consolidated One-Liner: ${vse.consolidatedOneLiner}`);
    if (vse.parivartanaYogas.length > 0) {
      vse.parivartanaYogas.forEach(p => {
        lines.push(`- [PARIVARTANA ${p.kind}] ${p.grahaA} (${p.signAName}, H${p.lagnaHouseA}) <-> ${p.grahaB} (${p.signBName}, H${p.lagnaHouseB}) (${p.startDate}..${p.endDate}, ${p.yogaClass}): ${p.bhavaExchangeSummary} | ${p.lordshipSummary} | Likely: ${p.predictedEvents}`);
      });
    }
    if (vse.debilitationEvents.length > 0) {
      vse.debilitationEvents.forEach(d => {
        lines.push(`- [${d.neechaBhangaStatus}] ${d.grahaKey} in ${d.signName} (${d.startDate}..${d.endDate}, H${d.houseFromLagna}, ${d.motionState}): ${d.summary} | Cancellations: ${d.cancellationReasons.join(', ') || 'None'} | Likely: ${d.predictedEvents}`);
      });
    }
    if (vse.sameSignStations.length > 0) {
      vse.sameSignStations.forEach(s => {
        lines.push(`- [STATION ${s.turnType}] ${s.grahaKey} in ${s.signName} (Station ${s.stationDate}, Before ${s.beforeRange} -> After ${s.afterRange}, H${s.houseFromLagna}): ${s.summary} | Impact: ${s.eventImpact}`);
      });
    }
  }

  // 4. Generated Prediction Report JSON (Core Narrative + 5 Life Domains + Specific Events)
  if (narrative) {
    lines.push('\n=== 4. GENERATED PREDICTION REPORT (JSON SYNTHESIS) ===');
    lines.push(`Summary Sentence: ${narrative.summarySentence}`);
    if (narrative.natalPromiseVsTransitDelivery) {
      const np = narrative.natalPromiseVsTransitDelivery;
      lines.push(`Dual Evaluation: Natal Promise ${np.natalPromiseScore}% (${np.natalPromiseVerdict}) vs Transit Delivery ${np.transitDeliveryScore}% (${np.transitDeliveryVerdict}) -> ${np.synthesisVerdict}`);
    }
    lines.push(`Part 1 (Scope & Probability): ${truncateText(narrative.part1_probabilityAndScope, 900)}`);
    lines.push(`Part 2 (Resources & Support): ${truncateText(narrative.part2_financialAndResources, 650)}`);
    lines.push(`Part 3 (Micro-Timing): ${truncateText(narrative.part3_microTimingWindow, 650)}`);

    if (narrative.supplementaryScenarios && narrative.supplementaryScenarios.length > 0) {
      lines.push('\n--- Domain Scenarios ---');
      narrative.supplementaryScenarios.forEach(sc => {
        const extraBits: string[] = [];
        if (sc.employmentStatusInference) {
          extraBits.push(`Employment: ${sc.employmentStatusInference.label} (${sc.employmentStatusInference.inferenceReasoning})`);
        }
        if (sc.crushStatusInference) {
          extraBits.push(`Relationship Trajectory: ${sc.crushStatusInference.existingCrushTrajectory} | New Interest: ${sc.crushStatusInference.newCrushProbability} (${sc.crushStatusInference.newCrushDetails})`);
        }
        if (sc.manifestationPath) {
          extraBits.push(`Manifestation: ${sc.manifestationPath.outcomeLabel} (${sc.manifestationPath.manifestationLikelihood})`);
        }
        if (sc.romanceAtmosphere) {
          extraBits.push(`Romance Weather: ${sc.romanceAtmosphere.emotionalWeather} (Chemistry ${sc.romanceAtmosphere.chemistryRating}/100)`);
        }
        if (sc.financeDetails) {
          extraBits.push(`Liquidity: ${sc.financeDetails.liquidityVsOutflow}`);
        }
        lines.push(
          `• [${sc.title}] Verdict=${sc.verdict} (${sc.confidenceScore}%), Window=${sc.timingWindow}\n  Reasoning: ${truncateText(sc.astrologicalReasoning, 380)}\n  Guidance: ${truncateText(sc.practicalGuidance, 260)}${extraBits.length ? `\n  Sub-Details: ${truncateText(extraBits.join(' | '), 360)}` : ''}`
        );
      });
    }

    if (narrative.predictedSpecificEvents && narrative.predictedSpecificEvents.length > 0) {
      lines.push('\n--- Predicted Specific Events ---');
      narrative.predictedSpecificEvents.forEach(ev => {
        lines.push(`• ${ev.eventTitle} [${ev.categoryLabel} | ${ev.likelihood} (${ev.likelihoodScore}%) | Window: ${ev.projectedWindow}]: ${truncateText(ev.concreteImplication, 260)} (Trigger: ${truncateText(ev.astrologicalTrigger, 200)})`);
      });
    }
  }

  // 5. Current Gochara & Question-Matched Transit / Moon Windows
  if (context) {
    lines.push('\n=== 5. EPHEMERIS GOCHARA & QUESTION-MATCHED WINDOWS ===');
    if (context.allTransitPlacements && context.allTransitPlacements.length > 0) {
      const gochara = context.allTransitPlacements
        .map(p => `${p.graha_key}: ${p.transit_rashi_name} (H${p.house_from_lagna} Lagna / H${p.house_from_moon} Moon, ${p.degree_sputa}, ${p.nakshatra_name} P${p.pada})${p.is_retrograde ? ' [VAKRA/RETRO]' : ' [DIRECT]'}`)
        .join('\n');
      lines.push(`Current Planetary Positions:\n${gochara}`);
    }

    if (context.monthlyMotionSpans && context.monthlyMotionSpans.length > 0) {
      const spans = context.monthlyMotionSpans
        .map(s => `${s.grahaKey} in ${s.signName} (Days ${s.startDay}-${s.endDay}: ${s.isRetrograde ? 'Retrograde' : 'Direct'})`)
        .join(' | ');
      lines.push(`Monthly Motion Spans: ${spans}`);
    }

    if (context.multiYearMajorTransits && context.multiYearMajorTransits.length > 0) {
      const major = context.multiYearMajorTransits
        .slice(0, 28)
        .map(m => `${m.grahaKey} in ${m.signName} (${m.startDate}..${m.endDate}, H${m.houseFromLagna || '?'}${m.isRetrograde ? ' Retro' : ''})`)
        .join(' | ');
      lines.push(`Major Planet Shifts: ${major}`);
    }

    // Question-aware Moon / Chandrashtama filtering
    if (context.chandraBalaDailyTimeline && context.chandraBalaDailyTimeline.length > 0) {
      const cbList = context.chandraBalaDailyTimeline
        .map(cb => `${cb.dayRange}: Moon in ${cb.moonSignName} (H${cb.houseFromNatalMoon} from Moon, ${cb.moonStarName}, Tara: ${cb.taraBala?.taraName})${cb.isChandrashtama ? ' [CHANDRASHTAMA]' : ''}`)
        .join(' | ');
      lines.push(`Chandra Bala Daily Windows: ${cbList}`);
    } else if (context.multiYearMoonTransits && context.multiYearMoonTransits.length > 0) {
      const matchedYears = ['2025', '2026', '2027', '2028', '2029'].filter(y => qLower.includes(y));
      const matchedMonthIndices = SHORT_MONTHS
        .map((m, idx) => (qLower.includes(m) || qLower.includes(MONTH_NAMES[idx].toLowerCase()) ? String(idx + 1).padStart(2, '0') : ''))
        .filter(Boolean);

      let filteredMoon = context.multiYearMoonTransits.filter(m => {
        const yearOk = matchedYears.length === 0 || matchedYears.some(y => m.startDate.startsWith(y) || m.endDate.startsWith(y));
        const monthOk = matchedMonthIndices.length === 0 || matchedMonthIndices.some(mm => m.startDate.includes(`-${mm}-`) || m.endDate.includes(`-${mm}-`));
        return yearOk && monthOk;
      });

      if (filteredMoon.length === 0) {
        filteredMoon = context.multiYearMoonTransits;
      }

      const highlightMoon = filteredMoon.slice(0, 16);
      lines.push(`Moon Transit Windows (${matchedYears.length || matchedMonthIndices.length ? 'Question-Matched' : 'Sample'}): ${highlightMoon.map(m => `${m.startDate}..${m.endDate}: ${m.signName} (H${m.houseFromLagna}${m.isChandrashtama ? ' CHANDRASHTAMA' : ''})`).join(' | ')}`);
    }
  }

  // 6. Original Prompt Excerpt for Audit Traceability
  const rawPrompt = options?.promptSent || narrative?.promptSent;
  if (rawPrompt) {
    lines.push('\n=== 6. ORIGINAL PROMPT REFERENCE (CACHED EXCERPT) ===');
    lines.push(truncateText(rawPrompt, 1500));
  }

  return lines.join('\n');
}
