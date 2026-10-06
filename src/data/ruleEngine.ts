/**
 * Astrological Rule Engine & House Activation Scorer
 * Evaluates Dasha authority, Double Transit (Saturn + Jupiter),
 * Natal Overlays, and Karaka stimulation.
 */

export interface AstroRule {
  id: string;
  name: string;
  category: 'dasha' | 'transit' | 'overlay' | 'karaka';
  description: string;
  weight: number; // 0.0 to 1.0
  isEnabled: boolean;
  evaluate: (context: RuleEvaluationContext, signIndex: number) => { matched: boolean; reason: string };
}

export interface RuleEvaluationContext {
  natalLagnaIdx: number;
  natalRashiIdx: number;
  activePdLord: string;
  activeAdLord: string;
  activeMdLord: string;
  pdLordOwnedSigns: number[];
  transitPlanets: {
    graha_key: string;
    transit_rashi_index: number;
    aspect_targets: number[];
  }[];
  natalPlanets: {
    body_name: string;
    rashi_index: number;
  }[];
}

export interface HouseActivationResult {
  signIndex: number;
  houseNumber: number; // 1 to 12 from Lagna
  totalScore: number; // 0.0 to 1.0
  isEventActive: boolean; // threshold >= 0.60
  matchedRules: { ruleId: string; ruleName: string; weight: number; reason: string }[];
}

export const DEFAULT_RULES: AstroRule[] = [
  {
    id: 'rule_pd_lord_domain',
    name: 'Rule 1: PD Lord Domain Focus',
    category: 'dasha',
    description: 'House owned or occupied by the active Pratyantar Dasha (PD) Lord.',
    weight: 0.35,
    isEnabled: true,
    evaluate: (ctx, signIndex) => {
      const isOwner = ctx.pdLordOwnedSigns.includes(signIndex);
      const pdShort = ctx.activePdLord.split(' ')[0].toLowerCase();
      const isNatalOccupied = ctx.natalPlanets.some(
        p => p.rashi_index === signIndex && p.body_name.toLowerCase().includes(pdShort)
      );
      const isTransitOccupied = ctx.transitPlanets.some(
        p => p.transit_rashi_index === signIndex && p.graha_key.toLowerCase().includes(pdShort)
      );

      if (isOwner || isNatalOccupied || isTransitOccupied) {
        return {
          matched: true,
          reason: `Activated by PD Lord ${ctx.activePdLord} (${isOwner ? 'Rulership' : 'Occupation'})`
        };
      }
      return { matched: false, reason: '' };
    }
  },
  {
    id: 'rule_double_transit',
    name: 'Rule 2: Double Transit Sanction (Sani + Guru)',
    category: 'transit',
    description: 'House jointly transited or aspected by BOTH Saturn (Sani) and Jupiter (Guru).',
    weight: 0.40,
    isEnabled: true,
    evaluate: (ctx, signIndex) => {
      const saturn = ctx.transitPlanets.find(p => p.graha_key === 'Saturn');
      const jupiter = ctx.transitPlanets.find(p => p.graha_key === 'Jupiter');

      const saturnTouches = saturn && (saturn.transit_rashi_index === signIndex || saturn.aspect_targets.includes(signIndex));
      const jupiterTouches = jupiter && (jupiter.transit_rashi_index === signIndex || jupiter.aspect_targets.includes(signIndex));

      if (saturnTouches && jupiterTouches) {
        return {
          matched: true,
          reason: 'Double Transit: Jointly aspected/transited by Saturn (Sani) and Jupiter (Guru)'
        };
      }
      return { matched: false, reason: '' };
    }
  },
  {
    id: 'rule_natal_overlay',
    name: 'Rule 3: Sensitive Natal Overlay Trigger',
    category: 'overlay',
    description: 'Transiting Jupiter, Saturn, or Mars conjunct or directly aspecting sensitive natal Grahas.',
    weight: 0.25,
    isEnabled: true,
    evaluate: (ctx, signIndex) => {
      const natalOccupants = ctx.natalPlanets.filter(p => p.rashi_index === signIndex);
      if (natalOccupants.length === 0) return { matched: false, reason: '' };

      const transitBeneficsOrMalefics = ctx.transitPlanets.filter(
        p => (p.graha_key === 'Jupiter' || p.graha_key === 'Saturn' || p.graha_key === 'Mars') &&
             p.transit_rashi_index === signIndex
      );

      if (transitBeneficsOrMalefics.length > 0) {
        const names = transitBeneficsOrMalefics.map(p => p.graha_key).join(', ');
        return {
          matched: true,
          reason: `Transit ${names} directly conjunct Natal ${natalOccupants.map(p => p.body_name).join(', ')}`
        };
      }
      return { matched: false, reason: '' };
    }
  },
  {
    id: 'rule_karaka_activation',
    name: 'Rule 4: Natural Karaka Stimulation',
    category: 'karaka',
    description: 'Transiting Jupiter or Venus stimulating Venus (7th/Kalatra), Mars (4th/Property), or Sun (10th/Career).',
    weight: 0.20,
    isEnabled: true,
    evaluate: (ctx, signIndex) => {
      const houseFromLagna = ((signIndex - ctx.natalLagnaIdx + 12) % 12) + 1;
      const jup = ctx.transitPlanets.find(p => p.graha_key === 'Jupiter');
      const ven = ctx.transitPlanets.find(p => p.graha_key === 'Venus');

      const isJupiterAspecting = jup && (jup.transit_rashi_index === signIndex || jup.aspect_targets.includes(signIndex));
      const isVenusInSign = ven && ven.transit_rashi_index === signIndex;

      if ([1, 4, 7, 9, 10, 11].includes(houseFromLagna) && (isJupiterAspecting || isVenusInSign)) {
        return {
          matched: true,
          reason: `Benefic stimulation on Kendra/Trikona House ${houseFromLagna}`
        };
      }
      return { matched: false, reason: '' };
    }
  },
  {
    id: 'rule_dasha_triad_delivery',
    name: 'Rule 5: Dasha Triad Delivery Capacity (Karyasiddhi)',
    category: 'dasha',
    description: 'Evaluates the functional transit dignity of the Dasha Triad (MD 20%, AD 30%, PD 50%). Dignified lords unlock physical delivery of active house karma.',
    weight: 0.20,
    isEnabled: true,
    evaluate: (ctx, signIndex) => {
      const delivery = calculateDashaDeliveryFactor(ctx);
      const houseFromLagna = ((signIndex - ctx.natalLagnaIdx + 12) % 12) + 1;
      const isPdDomain = ctx.pdLordOwnedSigns.includes(signIndex);
      const isKendraTrikona = [1, 4, 5, 7, 9, 10, 11].includes(houseFromLagna);

      // Trigger Rule 5 if the house is linked to PD domain or key manifestation Kendra/Trikona and delivery index is healthy
      if ((isPdDomain || isKendraTrikona) && delivery.overallIndex >= 0.55) {
        return {
          matched: true,
          reason: `Dasha Triad Delivery Capacity: ${(delivery.overallIndex * 100).toFixed(0)}% (${delivery.status}) — PD Lord ${ctx.activePdLord.split(' ')[0]} ${delivery.pdDignity}`
        };
      }
      return { matched: false, reason: '' };
    }
  }
];

export interface DashaDeliveryReport {
  overallIndex: number; // 0.0 to 1.0
  status: 'High Fruition' | 'Moderate Manifestation' | 'Delayed / Frictional Delivery';
  mdScore: number;
  mdDignity: string;
  adScore: number;
  adDignity: string;
  pdScore: number;
  pdDignity: string;
}

export function calculateDashaDeliveryFactor(ctx: RuleEvaluationContext): DashaDeliveryReport {
  const evaluateLordDignity = (lordFullName: string): { score: number; label: string } => {
    if (!lordFullName) return { score: 0.5, label: 'Neutral' };
    const shortName = lordFullName.split(' ')[0];
    const transit = ctx.transitPlanets.find(p => p.graha_key.toLowerCase().includes(shortName.toLowerCase()));
    if (!transit) return { score: 0.5, label: 'Unchecked Transit' };

    const sign = transit.transit_rashi_index;
    const hFromLagna = ((sign - ctx.natalLagnaIdx + 12) % 12) + 1;

    // Exaltation & Debilitation mappings
    const EXALTATION_SIGNS: Record<string, number> = {
      Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7, Rahu: 2, Ketu: 8
    };
    const DEBILITATION_SIGNS: Record<string, number> = {
      Sun: 7, Moon: 8, Mars: 4, Mercury: 12, Jupiter: 10, Venus: 6, Saturn: 1, Rahu: 8, Ketu: 2
    };
    const OWN_SIGNS: Record<string, number[]> = {
      Sun: [5], Moon: [4], Mars: [1, 8], Mercury: [3, 6], Jupiter: [9, 12], Venus: [2, 7], Saturn: [10, 11]
    };

    const exSign = EXALTATION_SIGNS[shortName];
    const debSign = DEBILITATION_SIGNS[shortName];
    const ownSigns = OWN_SIGNS[shortName] || [];

    let score = 0.60;
    let label = `Transiting House ${hFromLagna}`;

    if (sign === exSign) {
      score = 0.95;
      label = `Exalted (Uchha) in Sign ${sign} (House ${hFromLagna})`;
    } else if (ownSigns.includes(sign)) {
      score = 0.88;
      label = `Own Sign (Swakshetra) in Sign ${sign} (House ${hFromLagna})`;
    } else if (sign === debSign) {
      score = 0.25;
      label = `Debilitated (Neecha) in Sign ${sign} (House ${hFromLagna})`;
    } else if ([1, 4, 5, 7, 9, 10, 11].includes(hFromLagna)) {
      score = 0.72;
      label = `Auspicious Kendra/Trikona Placement (House ${hFromLagna})`;
    } else if ([6, 8, 12].includes(hFromLagna)) {
      score = 0.40;
      label = `Dusthana Placement (House ${hFromLagna})`;
    }

    // Check for combustion with Sun
    const sunTransit = ctx.transitPlanets.find(p => p.graha_key === 'Sun');
    if (sunTransit && shortName !== 'Sun' && shortName !== 'Rahu' && shortName !== 'Ketu') {
      if (sunTransit.transit_rashi_index === sign) {
        score = Math.max(0.20, score - 0.20);
        label += ' [Combust with Surya]';
      }
    }

    return { score, label };
  };

  const mdEval = evaluateLordDignity(ctx.activeMdLord);
  const adEval = evaluateLordDignity(ctx.activeAdLord);
  const pdEval = evaluateLordDignity(ctx.activePdLord);

  // Classical Weighting: MD 20% (Commanding King), AD 30% (Executive Minister), PD 50% (Ground Trigger)
  const compositeIndex = parseFloat((0.20 * mdEval.score + 0.30 * adEval.score + 0.50 * pdEval.score).toFixed(2));

  let status: 'High Fruition' | 'Moderate Manifestation' | 'Delayed / Frictional Delivery' = 'Moderate Manifestation';
  if (compositeIndex >= 0.70) {
    status = 'High Fruition';
  } else if (compositeIndex < 0.45) {
    status = 'Delayed / Frictional Delivery';
  }

  return {
    overallIndex: compositeIndex,
    status,
    mdScore: mdEval.score,
    mdDignity: mdEval.label,
    adScore: adEval.score,
    adDignity: adEval.label,
    pdScore: pdEval.score,
    pdDignity: pdEval.label
  };
}

export function evaluateHouseActivations(
  rules: AstroRule[],
  context: RuleEvaluationContext
): HouseActivationResult[] {
  const results: HouseActivationResult[] = [];

  for (let signIdx = 1; signIdx <= 12; signIdx++) {
    let score = 0;
    const matches: { ruleId: string; ruleName: string; weight: number; reason: string }[] = [];

    for (const rule of rules) {
      if (!rule.isEnabled) continue;
      const res = rule.evaluate(context, signIdx);
      if (res.matched) {
        score += rule.weight;
        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          weight: rule.weight,
          reason: res.reason
        });
      }
    }

    const houseNum = ((signIdx - context.natalLagnaIdx + 12) % 12) + 1;
    const normalizedScore = Math.min(1.0, parseFloat(score.toFixed(2)));

    results.push({
      signIndex: signIdx,
      houseNumber: houseNum,
      totalScore: normalizedScore,
      isEventActive: normalizedScore >= 0.55,
      matchedRules: matches
    });
  }

  return results;
}
